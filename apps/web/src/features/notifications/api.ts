import type { NotificationBoundary, PushPlatform } from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Privacy-safe notification boundary. | ENDPOINT/METHOD: Future push subscription and delivery operations. | INPUT: Platform and generic notification payload. | OUTPUT: TODO(D4). | AUTHORIZATION: Authenticated subscription owner. | DEPENDENCIES: Shared contracts and notification service. | STATE CHANGES: TODO(D4). | NON-RESPONSIBILITIES: Patient-identifying payloads or transport coupling. | IMPLEMENTATION: TODO(D4). */
export type NotificationBoundaryTypes = {
  platform: PushPlatform;
  payload: NotificationBoundary;
};
