import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BloodRequestRecord,
  HospitalPatientNeedQuery,
  PatientNeedRecord,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';
import { toPatientNeedRecord } from '../patient-needs/patient-needs.service';
import { findMemberHospitalIds } from './d3-memberships';
import { normalizeD3Pagination } from './d3.validation';

/**
 * OWNER: D3
 * PURPOSE: Hospital-scoped PatientNeed persistence access for review.
 * ENDPOINT/METHOD: Supports hospital review, verify, and reject routes.
 * INPUT: Authenticated user ID, PatientNeed ID, review query.
 * OUTPUT: Existing PatientNeed contract records.
 * AUTHORIZATION: Every lookup verifies active membership in the record's
 * HOSPITAL organization; non-member hospitals are indistinguishable from
 * missing records (404).
 * DEPENDENCIES: Central PrismaService and D2 PatientNeed model.
 * STATE CHANGES: PENDING_HOSPITAL_REVIEW -> VERIFIED (creating exactly one
 * BloodRequest transactionally) or -> REJECTED. Conditional writes make the
 * transition concurrency-safe; no other status is ever written.
 * NON-RESPONSIBILITIES: PatientNeed creation/cancellation or D2 behavior.
 */
@Injectable()
export class HospitalPatientNeedsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyForUser(userId: string, query: HospitalPatientNeedQuery) {
    const { page, pageSize, skip } = normalizeD3Pagination(query);
    const hospitalIds = await findMemberHospitalIds(this.prisma, userId);
    if (hospitalIds.length === 0) {
      return {
        data: [] as PatientNeedRecord[],
        meta: { page, pageSize, total: 0, totalPages: 0 },
      };
    }

    const where = {
      hospitalId: { in: hospitalIds },
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.patientNeed.count({ where }),
      this.prisma.patientNeed.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map(toPatientNeedRecord),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOneForUser(
    userId: string,
    patientNeedId: string,
  ): Promise<PatientNeedRecord> {
    const hospitalIds = await findMemberHospitalIds(this.prisma, userId);
    const row = await this.prisma.patientNeed.findFirst({
      where: { id: patientNeedId, hospitalId: { in: hospitalIds } },
    });
    if (!row) throw new NotFoundException('PatientNeed not found');
    return toPatientNeedRecord(row);
  }

  /**
   * Transitions a pending PatientNeed to VERIFIED and creates the official
   * BloodRequest in a single transaction. The conditional update makes
   * concurrent verifications safe (the loser sees a decided record), and the
   * unique patientNeedId constraint guarantees at most one BloodRequest per
   * PatientNeed even under races.
   */
  async verifyForUser(
    userId: string,
    patientNeedId: string,
  ): Promise<{
    patientNeed: PatientNeedRecord;
    bloodRequest: BloodRequestRecord;
  }> {
    const hospitalIds = await findMemberHospitalIds(this.prisma, userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const need = await tx.patientNeed.findFirst({
          where: { id: patientNeedId, hospitalId: { in: hospitalIds } },
        });
        if (!need) throw new NotFoundException('PatientNeed not found');
        if (need.status !== 'PENDING_HOSPITAL_REVIEW') {
          throw new ConflictException('PatientNeed already decided');
        }

        const updated = await tx.patientNeed.updateMany({
          where: {
            id: patientNeedId,
            hospitalId: { in: hospitalIds },
            status: 'PENDING_HOSPITAL_REVIEW',
          },
          data: { status: 'VERIFIED' },
        });
        if (updated.count === 0) {
          throw new ConflictException('PatientNeed already decided');
        }

        const created = await tx.bloodRequest.create({
          data: {
            hospitalId: need.hospitalId,
            patientNeedId: need.id,
            bloodGroup: need.bloodGroup,
            component: need.component,
            unitsRequired: need.units,
            urgency: need.urgency,
            requiredBy: need.requiredBy,
            status: 'OPEN',
          },
        });

        return {
          patientNeed: toPatientNeedRecord({ ...need, status: 'VERIFIED' }),
          bloodRequest: toBloodRequestRecord(created),
        };
      });
    } catch (error) {
      // Unique violation on patientNeedId means a concurrent verification
      // already created the BloodRequest; report it as a conflict.
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('PatientNeed already decided');
      }
      throw error;
    }
  }

  /**
   * Transitions a pending PatientNeed to REJECTED with the same conditional
   * write; verification and rejection are mutually exclusive terminal review
   * outcomes.
   */
  async rejectForUser(
    userId: string,
    patientNeedId: string,
  ): Promise<PatientNeedRecord> {
    const hospitalIds = await findMemberHospitalIds(this.prisma, userId);
    const need = await this.prisma.patientNeed.findFirst({
      where: { id: patientNeedId, hospitalId: { in: hospitalIds } },
    });
    if (!need) throw new NotFoundException('PatientNeed not found');
    if (need.status !== 'PENDING_HOSPITAL_REVIEW') {
      throw new ConflictException('PatientNeed already decided');
    }

    const updated = await this.prisma.patientNeed.updateMany({
      where: {
        id: patientNeedId,
        hospitalId: { in: hospitalIds },
        status: 'PENDING_HOSPITAL_REVIEW',
      },
      data: { status: 'REJECTED' },
    });
    if (updated.count === 0) {
      throw new ConflictException('PatientNeed already decided');
    }
    return toPatientNeedRecord({ ...need, status: 'REJECTED' });
  }
}

export function toBloodRequestRecord(row: {
  id: string;
  hospitalId: string;
  patientNeedId: string;
  bloodGroup: string;
  component: string;
  unitsRequired: number;
  urgency: string;
  requiredBy: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): BloodRequestRecord {
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    patientNeedId: row.patientNeedId,
    bloodGroup: row.bloodGroup as BloodRequestRecord['bloodGroup'],
    component: row.component as BloodRequestRecord['component'],
    unitsRequired: row.unitsRequired,
    urgency: row.urgency as BloodRequestRecord['urgency'],
    requiredBy: row.requiredBy.toISOString(),
    status: row.status as BloodRequestRecord['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
