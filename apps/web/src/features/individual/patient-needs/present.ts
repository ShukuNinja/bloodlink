import type {
  PatientNeedBloodGroup,
  PatientNeedComponent,
  PatientNeedStatus,
  PatientNeedUrgency,
} from '@bloodlink/contracts';

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

export function statusBadgeClass(status: PatientNeedStatus): string {
  switch (status) {
    case 'PENDING_HOSPITAL_REVIEW':
      return 'badge pending';
    case 'VERIFIED':
      return 'badge verified';
    case 'REJECTED':
      return 'badge rejected';
    case 'CANCELLED':
      return 'badge cancelled';
  }
}

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
