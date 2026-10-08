import type {
  CreatePatientNeedRequest,
  PatientNeedRecord,
} from '@bloodlink/contracts';

export type { CreatePatientNeedRequest, PatientNeedRecord };

export type PatientNeedListQuery = {
  page?: string;
  pageSize?: string;
};

export type CreatePatientNeedCommand = CreatePatientNeedRequest & {
  submittedByUserId: string;
};

export type PatientNeedResult = PatientNeedRecord;
