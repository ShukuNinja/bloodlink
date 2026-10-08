import type { INestApplication } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';
import { ApiResponseInterceptor } from './api-response.interceptor';

export function configureApi(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(app.get(ApiExceptionFilter));
  app.useGlobalInterceptors(app.get(ApiResponseInterceptor));
}
