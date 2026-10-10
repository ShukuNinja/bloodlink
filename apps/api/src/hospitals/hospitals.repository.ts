import { Injectable } from '@nestjs/common';
import { Prisma } from '../database/generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

export type HospitalSearchRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

export type HospitalSearchCriteria = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  namePattern?: string;
};

/**
 * OWNER: D2
 * PURPOSE: PostGIS-backed hospital discovery against the canonical
 * Organization.location geography column and its GiST index.
 * INPUT: Transient caller coordinates (never persisted), radius, optional
 * name pattern.
 * OUTPUT: Discovery-safe rows: id, name, coordinates derived from the
 * canonical geography (ST_X/ST_Y), and distance used for ranking.
 * AUTHORIZATION: None in the repository; the route layer enforces INDIVIDUAL.
 * DEPENDENCIES: Central PrismaService, PostGIS functions.
 * STATE CHANGES: None; read-only discovery query.
 * NON-RESPONSIBILITIES: Staff/membership data, donor locations, district
 * boundaries, Haversine reimplementation, or coordinate persistence.
 */
@Injectable()
export class HospitalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  searchNearby(criteria: HospitalSearchCriteria): Promise<HospitalSearchRow[]> {
    const searchPoint = Prisma.sql`ST_SetSRID(ST_MakePoint(${criteria.longitude}, ${criteria.latitude}), 4326)::geography`;
    const nameFilter = criteria.namePattern
      ? Prisma.sql`AND "name" ILIKE ${criteria.namePattern}`
      : Prisma.empty;

    const query = Prisma.sql`
      SELECT "id",
             "name",
             ST_Y("location"::geometry)::double precision AS "latitude",
             ST_X("location"::geometry)::double precision AS "longitude",
             ST_Distance("location", ${searchPoint}) AS "distanceMeters"
      FROM "Organization"
      WHERE "type" = 'HOSPITAL'
        AND "status" = 'ACTIVE'
        AND "location" IS NOT NULL
        AND ST_DWithin("location", ${searchPoint}, ${criteria.radiusMeters}::double precision)
        ${nameFilter}
      ORDER BY "distanceMeters" ASC, "name" ASC
    `;

    return this.prisma.$queryRaw<HospitalSearchRow[]>(query);
  }
}
