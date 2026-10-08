import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { ApiSuccess, ApiSuccessWithMeta } from '@bloodlink/contracts';
import { map, Observable } from 'rxjs';

function isResponseEnvelope(
  value: unknown,
): value is ApiSuccess<unknown> | ApiSuccessWithMeta<unknown, unknown> {
  if (typeof value !== 'object' || value === null || !('data' in value)) {
    return false;
  }

  return Object.keys(value).every((key) => key === 'data' || key === 'meta');
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method: string }>();
    if (request.method === 'DELETE') {
      http
        .getResponse<{ status: (statusCode: number) => unknown }>()
        .status(HttpStatus.NO_CONTENT);
    }

    return next
      .handle()
      .pipe(
        map((value: unknown) =>
          isResponseEnvelope(value) ? value : { data: value },
        ),
      );
  }
}
