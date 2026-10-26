import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CreatePatientNeedRequest,
  PatientNeedListResponse,
  PatientNeedRecord,
} from '@bloodlink/contracts';
import {
  PatientNeedRepository,
  type PatientNeedRow,
} from './patient-needs.repository';
import {
  parsePatientNeedPagination,
  type PatientNeedListQueryInput,
} from './patient-needs.validation';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * OWNER: D2
 * PURPOSE: Individual PatientNeed application-service boundary.
 * ENDPOINT/METHOD: POST /patient-needs, GET /patient-needs,
 * GET /patient-needs/:id, POST /patient-needs/:id/cancel.
 * INPUT: Authenticated user ID, shared CreatePatientNeedRequest, pagination query.
 * OUTPUT: Shared PatientNeed contracts in the canonical response envelope.
 * AUTHORIZATION: INDIVIDUAL platform role; ownership is enforced in the
 * repository database queries using the authenticated principal identity.
 * Client-supplied owner identifiers are never accepted.
 * DEPENDENCIES: PatientNeedRepository, canonical CreatePatientNeedSchema
 * (validated at the controller boundary).
 * STATE CHANGES: Create inserts PENDING_HOSPITAL_REVIEW; cancel transitions
 * PENDING_HOSPITAL_REVIEW -> CANCELLED only.
 * NON-RESPONSIBILITIES: Hospital verification/rejection (D3), BloodRequest or
 * ResponderAssignment mutation (D3), response/notification writes (D4),
 * medical eligibility, donor cooldown, or donation fulfillment.
 */
@Injectable()
export class PatientNeedsService {
  constructor(private readonly repository: PatientNeedRepository) {}

  async create(
    userId: string,
    input: CreatePatientNeedRequest,
  ): Promise<PatientNeedRecord> {
    // LEAD DECISION D4 (APPROVED): malformed hospital identifier -> 400;
    // valid UUID referencing a missing or ineligible hospital -> 422, without
    // revealing organization details (the global filter owns the message).
    if (!UUID_PATTERN.test(input.hospitalId)) {
      throw new BadRequestException('hospitalId must be a UUID');
    }

    const hospital = await this.repository.findApprovedHospital(
      input.hospitalId,
    );
    if (!hospital) {
      throw new UnprocessableEntityException('Hospital is not eligible');
    }

    const row = await this.repository.createHospitalReviewHandoff({
      ...input,
      submittedByUserId: userId,
    });
    return toPatientNeedRecord(row);
  }

  async findManyByOwner(
    userId: string,
    query: PatientNeedListQueryInput,
  ): Promise<PatientNeedListResponse> {
    const pagination = parsePatientNeedPagination(query);
    const { items, total } = await this.repository.findManyByOwner(userId, {
      skip: pagination.skip,
      take: pagination.take,
    });

    return {
      data: items.map(toPatientNeedRecord),
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  }

  async findByOwner(
    userId: string,
    patientNeedId: string,
  ): Promise<PatientNeedRecord> {
    const row = await this.repository.findByOwner(userId, patientNeedId);
    if (!row) {
      throw new NotFoundException('PatientNeed not found');
    }
    return toPatientNeedRecord(row);
  }

  async cancelOwned(
    userId: string,
    patientNeedId: string,
  ): Promise<PatientNeedRecord> {
    const row = await this.repository.cancelOwned(userId, patientNeedId);
    return toPatientNeedRecord(row);
  }
}

export function toPatientNeedRecord(row: PatientNeedRow): PatientNeedRecord {
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    patientName: row.patientName,
    bloodGroup: row.bloodGroup,
    component: row.component,
    units: row.units,
    urgency: row.urgency,
    requiredBy: row.requiredBy.toISOString(),
    additionalNotes: row.additionalNotes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
