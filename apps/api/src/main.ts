import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApi } from './http/configure-api';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApi(app);
  const config = app.get(ConfigService);
  await app.listen(config.get<number>('PORT', 3001));
}

void bootstrap();
