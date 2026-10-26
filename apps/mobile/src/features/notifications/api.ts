import type { InAppNotificationListResponse } from '@bloodlink/contracts';
import { apiRequest } from '../../api/client';

export function listNotifications() {
  return apiRequest<InAppNotificationListResponse>('GET', '/notifications');
}
