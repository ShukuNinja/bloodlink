import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { RequestContext } from './request-context';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

type RequestWithId = {
  get: (name: string) => string | undefined;
  requestId?: string;
};
type RequestResponse = { setHeader: (name: string, value: string) => void };

@Injectable()
export class ApiRequestIdMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContext) {}

  use(
    request: RequestWithId,
    response: RequestResponse,
    next: () => void,
  ): void {
    const incoming = request.get(REQUEST_ID_HEADER);
    const requestId =
      incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    this.requestContext.run(requestId, next);
  }
}
