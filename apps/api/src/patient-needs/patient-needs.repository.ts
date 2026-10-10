import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../database/generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { CreatePatientNeedCommand } from './patient-needs.types';

export type PatientNeedRow = Prisma.PatientNeedGetPayload<undefined>;

const PENDING_STATUS = 'PENDING_HOSPITAL_REVIEW';
const CANCELLED_STATUS = 'CANCELLED';

/**
 * OWNER: D2
 * PURPOSE: Owner-scoped PatientNeed persistence on the central PrismaService.
 * INPUT: Authenticated user ID plus shared PatientNeed contracts.
 * OUTPUT: Raw PatientNeed rows for the service layer to project.
 * AUTHORIZATION: Ownership is enforced inside every database query; a record
 * belonging to another individual is indistinguishable from a missing record.
 * DEPENDENCIES: Central PrismaService (PatientNeed, Organization models).
 * STATE CHANGES: Create inserts PENDING_HOSPITAL_REVIEW; cancelOwned performs a
 * conditional PENDING_HOSPITAL_REVIEW -> CANCELLED write inside a transaction.
 * NON-RESPONSIBILITIES: Hospital verification/rejection (D3), BloodRequest or
 * ResponderAssignment writes (D3), response writes (D4), medical decisions.
 */
@Injectable()
export class PatientNeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createHospitalReviewHandoff(
    command: CreatePatientNeedCommand,
  ): Promise<PatientNeedRow> {
    return this.prisma.patientNeed.create({
      data: {
        submittedByUserId: command.submittedByUserId,
        hospitalId: command.hospitalId,
        bloodGroup: command.bloodGroup,
        component: command.component,
        units: command.units,
        urgency: command.urgency,
        requiredBy: new Date(command.requiredBy),
        additionalNotes: command.additionalNotes,
        status: PENDING_STATUS,
      },
    });
  }

  /**
   * Resolves the target hospital for a new PatientNeed. Only organizations
   * that exist, are typed HOSPITAL, and are ACTIVE are approved targets;
   * anything else returns null, which the service maps to 422 (LEAD DECISION
   * D4) without revealing whether the organization exists, its type, or its
   * status.
   */
  async findApprovedHospital(hospitalId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: hospitalId },
      select: { id: true, type: true, status: true },
    });

    if (
      !organization ||
      organization.type !== 'HOSPITAL' ||
      organization.status !== 'ACTIVE'
    ) {
      return null;
    }
    return organization;
  }

  async findManyByOwner(
    userId: string,
    options: { skip: number; take: number },
  ) {
    const where = {
      submittedByUserId: userId,
    } satisfies Prisma.PatientNeedWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.patientNeed.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: options.skip,
        take: options.take,
      }),
      this.prisma.patientNeed.count({ where }),
    ]);

    return { items, total };
  }

  async findByOwner(userId: string, patientNeedId: string) {
    return this.prisma.patientNeed.findFirst({
      where: { id: patientNeedId, submittedByUserId: userId },
    });
  }

  /**
   * Owner-scoped cancellation. The conditional updateMany guarantees that a
   * concurrent cancellation or a concurrent hospital review transition cannot
   * be overwritten: only one caller can observe count === 1.
   */
  async cancelOwned(
    userId: string,
    patientNeedId: string,
  ): Promise<PatientNeedRow> {
    // Atomically allow only one request to transition PENDING -> CANCELLED.
    const updated = await this.prisma.patientNeed.updateMany({
      where: {
        id: patientNeedId,
        submittedByUserId: userId,
        status: PENDING_STATUS,
      },
      data: {
        status: CANCELLED_STATUS,
      },
    });

    if (updated.count === 1) {
      return this.prisma.patientNeed.findUniqueOrThrow({
        where: { id: patientNeedId },
      });
    }

    // The conditional update did not match. Determine whether the record
    // is missing, belongs to another user, or is no longer cancellable.
    const existing = await this.prisma.patientNeed.findFirst({
      where: {
        id: patientNeedId,
        submittedByUserId: userId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('PatientNeed not found');
    }

    if (existing.status === CANCELLED_STATUS) {
      throw new ConflictException('PatientNeed is already cancelled');
    }

    throw new ConflictException(
      'PatientNeed can only be cancelled while pending hospital review',
    );
  }
}