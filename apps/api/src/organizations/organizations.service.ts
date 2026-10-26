import { Injectable } from '@nestjs/common';
import type {
  OrganizationSearchRequest,
  OrganizationSummary,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    input: OrganizationSearchRequest,
  ): Promise<OrganizationSummary[]> {
    const rows = await this.prisma.organization.findMany({
      where: {
        status: 'ACTIVE',
        ...(input.type ? { type: input.type } : {}),
        name: { contains: input.query, mode: 'insensitive' },
      },
      select: { id: true, name: true, type: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 50,
    });
    return rows;
  }
}
