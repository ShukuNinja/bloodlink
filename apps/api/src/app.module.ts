import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { environmentSchema } from './config/environment';
import { PrismaModule } from './database/prisma.module';
import { HealthController } from './health/health.controller';

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
