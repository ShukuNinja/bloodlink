import { Injectable, NotImplementedException } from '@nestjs/common';
import type { CreatePatientNeedCommand } from './patient-needs.types';
import type { PatientNeedRecord } from '@bloodlink/contracts';

/** TODO(D2): Implement owner-scoped persistence using the centralized PrismaService. */
@Injectable()
export class PatientNeedRepository {
  async create(_command: CreatePatientNeedCommand): Promise<PatientNeedRecord> {
    void _command;
    throw new NotImplementedException('TODO(D2): create PatientNeed');
  }

  async findManyByOwner(
    _userId: string,
    _query: { page?: string; pageSize?: string },
  ): Promise<PatientNeedRecord[]> {
    void _userId;
    void _query;
    throw new NotImplementedException('TODO(D2): list owned PatientNeeds');
  }

  async findByOwner(
    _userId: string,
    _patientNeedId: string,
  ): Promise<PatientNeedRecord> {
    void _userId;
    void _patientNeedId;
    throw new NotImplementedException('TODO(D2): find owned PatientNeed');
  }

  async cancelOwned(
    _userId: string,
    _patientNeedId: string,
  ): Promise<PatientNeedRecord> {
    void _userId;
    void _patientNeedId;
    // TODO(D2): Permit cancellation only from PENDING_HOSPITAL_REVIEW.
    throw new NotImplementedException('TODO(D2): cancel owned PatientNeed');
  }
}
