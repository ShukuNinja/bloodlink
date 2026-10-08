/* global require, process, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const { Test } = require('@nestjs/testing');
const { PrismaService } = require('../dist/database/prisma.service');
const { ApiExceptionFilter } = require('../dist/http/api-exception.filter');
const {
  ApiResponseInterceptor,
} = require('../dist/http/api-response.interceptor');
const { configureApi } = require('../dist/http/configure-api');
const {
  ApiRequestIdMiddleware,
} = require('../dist/http/request-id.middleware');
const { RequestContext } = require('../dist/http/request-context');
const { ZodValidationPipe } = require('../dist/http/zod-validation.pipe');
const {
  ZodValidationException,
} = require('../dist/http/zod-validation.exception');
const { of } = require('rxjs');

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3001';
process.env.DATABASE_URL ??=
  'postgresql://bloodlink_test:bloodlink_test@127.0.0.1:5432/bloodlink_test?schema=public';
process.env.JWT_ACCESS_SECRET ??=
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_SECRET ??=
  'test-refresh-secret-that-is-also-over-32-characters';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';

let app;
let baseUrl;
let verifyConnection;
let z;

before(async () => {
  ({ z } = await import('@bloodlink/validation'));
  const { AppModule } = require('../dist/app.module');
  verifyConnection = async () => {};
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ verifyConnection: () => verifyConnection() })
    .compile();

  app = moduleRef.createNestApplication();
  configureApi(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});

after(async () => {
  await app?.close();
});

describe('successful response contract', () => {
  it('wraps health data without requiring metadata', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: { status: 'ok', database: 'connected' },
    });
  });

  it('uses 204 for successful DELETE responses', async () => {
    let statusCode = 200;
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'DELETE' }),
        getResponse: () => ({ status: (value) => (statusCode = value) }),
      }),
    };
    const result = await new Promise((resolve, reject) => {
      new ApiResponseInterceptor()
        .intercept(context, { handle: () => of(undefined) })
        .subscribe({ next: resolve, error: reject });
    });

    assert.equal(statusCode, 204);
    assert.deepEqual(result, { data: undefined });
  });
});

describe('validation and error formatting', () => {
  it('formats Zod failures using the canonical validation error contract', async () => {
    const pipe = new ZodValidationPipe(z.object({ name: z.string() }));
    let thrown;
    try {
      await pipe.transform({ name: 123, privateValue: 'must not be echoed' });
    } catch (error) {
      thrown = error;
    }

    assert.ok(thrown instanceof ZodValidationException);
    const result = captureFilterResponse(thrown);
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
    assert.equal(result.body.error.message, 'Request validation failed');
    assert.deepEqual(result.body.error.details, {
      issues: [{ path: ['name'], code: 'invalid_type' }],
    });
    assert.equal(
      JSON.stringify(result.body).includes('must not be echoed'),
      false,
    );
  });

  it('does not expose internal exception messages or stack data', () => {
    const result = captureFilterResponse(new Error('database password=secret'));
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});

describe('request correlation', () => {
  it('generates an ID and makes it available in request context', () => {
    const context = new RequestContext();
    const middleware = new ApiRequestIdMiddleware(context);
    let responseId = '';
    let requestId = '';
    const request = { get: () => undefined };
    const response = { setHeader: (_name, value) => (responseId = value) };

    middleware.use(request, response, () => {
      requestId = context.getRequestId() ?? '';
    });

    assert.match(responseId, /^[0-9a-f-]{36}$/i);
    assert.equal(requestId, responseId);
  });

  it('preserves safe incoming IDs and replaces unsafe values', async () => {
    const preserved = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { 'X-Request-Id': 'client.trace:42' },
    });
    assert.equal(preserved.headers.get('x-request-id'), 'client.trace:42');

    const replaced = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { 'X-Request-Id': 'bad value' },
    });
    assert.match(
      replaced.headers.get('x-request-id') ?? '',
      /^[0-9a-f-]{36}$/i,
    );
  });
});

describe('versioned health endpoint', () => {
  it('uses /api/v1 and preserves the database connectivity check', async () => {
    verifyConnection = async () => {};
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { 'X-Request-Id': 'health-check-1' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-request-id'), 'health-check-1');
    assert.deepEqual(await response.json(), {
      data: { status: 'ok', database: 'connected' },
    });

    const oldPath = await fetch(`${baseUrl}/health`);
    assert.equal(oldPath.status, 404);
    assert.deepEqual(await oldPath.json(), {
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('returns a safe error if the database check fails', async () => {
    verifyConnection = async () => {
      throw new Error('database password=secret');
    };
    const response = await fetch(`${baseUrl}/api/v1/health`);

    assert.equal(response.status, 503);
    assert.match(
      response.headers.get('x-request-id') ?? '',
      /^[0-9a-f-]{36}$/i,
    );
    assert.deepEqual(await response.json(), {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});

function captureFilterResponse(exception) {
  let statusCode = 0;
  let body;
  const response = {
    status(code) {
      statusCode = code;
      return { json: (value) => (body = value) };
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) };

  new ApiExceptionFilter().catch(exception, host);
  return { statusCode, body };
}
