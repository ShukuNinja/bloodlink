import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { environmentSchema } from './config/environment';
import { PrismaModule } from './database/prisma.module';
import { HealthController } from './health/health.controller';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { ApiResponseInterceptor } from './http/api-response.interceptor';
import { ApiRequestIdMiddleware } from './http/request-id.middleware';
import { RequestContext } from './http/request-context';
import { AuthModule } from './auth/auth.module';
import { PatientNeedsModule } from './patient-needs/patient-needs.module';
import { HospitalsModule } from './hospitals/hospitals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: environmentSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    PrismaModule,
    AuthModule,
    PatientNeedsModule,
    HospitalsModule,
  ],
  controllers: [HealthController],
  providers: [
    ApiExceptionFilter,
    ApiResponseInterceptor,
    ApiRequestIdMiddleware,
    RequestContext,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiRequestIdMiddleware).forRoutes('{*path}');
  }
}
