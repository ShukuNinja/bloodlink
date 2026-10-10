import type {
  PatientNeedBloodGroup,
  PatientNeedComponent,
  PatientNeedStatus,
  PatientNeedUrgency,
} from '@bloodlink/contracts';

export const BLOOD_GROUPS: PatientNeedBloodGroup[] = [
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
];

export const COMPONENTS: PatientNeedComponent[] = [
  'WHOLE_BLOOD',
  'RED_BLOOD_CELLS',
  'PLATELETS',
  'PLASMA',
];

export const URGENCIES: PatientNeedUrgency[] = [
  'ROUTINE',
  'URGENT',
  'CRITICAL',
];

export const BLOOD_GROUP_LABELS: Record<PatientNeedBloodGroup, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A−',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B−',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB−',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O−',
};

export const COMPONENT_LABELS: Record<PatientNeedComponent, string> = {
  WHOLE_BLOOD: 'Whole blood',
  RED_BLOOD_CELLS: 'Red blood cells',
  PLATELETS: 'Platelets',
  PLASMA: 'Plasma',
};

export const URGENCY_LABELS: Record<PatientNeedUrgency, string> = {
  ROUTINE: 'Routine',
  URGENT: 'Urgent',
  CRITICAL: 'Critical',
};

export const STATUS_LABELS: Record<PatientNeedStatus, string> = {
  PENDING_HOSPITAL_REVIEW: 'Pending hospital review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
