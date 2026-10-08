import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.verifyConnection();
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }
  }
}
