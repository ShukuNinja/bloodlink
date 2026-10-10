import type { CreatePatientNeedRequest } from '@bloodlink/contracts';

export type {
  CreatePatientNeedRequest,
  PatientNeedRecord,
} from '@bloodlink/contracts';

export type CreatePatientNeedCommand = CreatePatientNeedRequest & {
  submittedByUserId: string;
};
