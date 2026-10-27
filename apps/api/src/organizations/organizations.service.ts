import { Injectable } from '@nestjs/common';
import type {
  OrganizationSearchRequest,
  OrganizationSummary,
} from '@bloodlink/contracts';
import { Prisma } from '../database/generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    input: OrganizationSearchRequest,
  ): Promise<OrganizationSummary[]> {
    const sortDirection = input.sortOrder === 'DESC' ? 'desc' : 'asc';
    const namePattern = input.query
      ? `%${escapeLikePattern(input.query)}%`
      : undefined;

    if (input.latitude !== undefined && input.longitude !== undefined) {
      const searchPoint = Prisma.sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`;
      const typeFilter = input.type
        ? Prisma.sql`AND "type" = ${input.type}::"OrganizationType"`
        : Prisma.empty;
      const nameFilter = namePattern
        ? Prisma.sql`AND "name" ILIKE ${namePattern}`
        : Prisma.empty;
      const direction =
        sortDirection === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
      return this.prisma.$queryRaw<OrganizationSummary[]>(Prisma.sql`
        SELECT "id", "name", "type",
          ST_Distance("location", ${searchPoint}) AS "distanceMeters"
        FROM "Organization"
        WHERE "status" = 'ACTIVE'
          AND "location" IS NOT NULL
          AND ST_DWithin(
            "location",
            ${searchPoint},
            ${input.radiusMeters ?? 25_000}::double precision
          )
          ${typeFilter}
          ${nameFilter}
        ORDER BY lower("name") ${direction}, "id" ASC
      `);
    }

    const rows = await this.prisma.organization.findMany({
      where: {
        status: 'ACTIVE',
        ...(input.type ? { type: input.type } : {}),
        ...(input.query
          ? { name: { contains: input.query, mode: 'insensitive' as const } }
          : {}),
      },
      select: { id: true, name: true, type: true },
      orderBy: [{ name: sortDirection }, { id: 'asc' }],
    });
    return rows;
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
