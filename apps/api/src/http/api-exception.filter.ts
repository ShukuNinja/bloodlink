import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ApiErrorCode, ApiErrorResponse } from '@bloodlink/contracts';
import { ZodValidationException } from './zod-validation.exception';

type ErrorPresentation = { code: ApiErrorCode; message: string };

const statusPresentations = new Map<number, ErrorPresentation>([
  [
    HttpStatus.BAD_REQUEST,
    { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
  ],
  [HttpStatus.UNAUTHORIZED, { code: 'UNAUTHORIZED', message: 'Unauthorized' }],
  [HttpStatus.FORBIDDEN, { code: 'FORBIDDEN', message: 'Forbidden' }],
  [HttpStatus.NOT_FOUND, { code: 'NOT_FOUND', message: 'Resource not found' }],
  [HttpStatus.CONFLICT, { code: 'CONFLICT', message: 'Conflict' }],
  [
    HttpStatus.TOO_MANY_REQUESTS,
    { code: 'RATE_LIMITED', message: 'Rate limit exceeded' },
  ],
  [
    HttpStatus.UNPROCESSABLE_ENTITY,
    { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
  ],
]);

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (statusCode: number) => {
        json: (body: ApiErrorResponse) => void;
      };
    }>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const presentation = statusPresentations.get(statusCode) ?? {
      code: 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : 'Request failed',
    };
    const details =
      exception instanceof ZodValidationException
        ? { issues: exception.issues }
        : undefined;

    response.status(statusCode).json({
      error: {
        code: presentation.code,
        message: presentation.message,
        ...(details ? { details } : {}),
      },
    });
  }
}
