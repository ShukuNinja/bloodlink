import { Injectable } from '@nestjs/common';
import type { CreatePatientNeedRequest } from '@bloodlink/contracts';
import { PatientNeedRepository } from './patient-needs.repository';
import type { PatientNeedListQuery } from './patient-needs.types';

@Injectable()
export class PatientNeedsService {
  constructor(private readonly repository: PatientNeedRepository) {}

  create(userId: string, input: CreatePatientNeedRequest) {
    return this.repository.create({ ...input, submittedByUserId: userId });
  }

  findManyByOwner(userId: string, query: PatientNeedListQuery) {
    return this.repository.findManyByOwner(userId, query);
  }

  findByOwner(userId: string, patientNeedId: string) {
    return this.repository.findByOwner(userId, patientNeedId);
  }

  cancelOwned(userId: string, patientNeedId: string) {
    return this.repository.cancelOwned(userId, patientNeedId);
  }
}
