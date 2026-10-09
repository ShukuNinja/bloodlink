import type { OrganizationResponseActionResponse } from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Blood-centre response API boundary. | ENDPOINT/METHOD: POST organization response. | INPUT: BloodRequest ID. | OUTPUT: OrganizationResponse envelope. | AUTHORIZATION: API verifies active blood-centre membership. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: TODO(D4) response only. | NON-RESPONSIBILITIES: D3 assignment or BloodRequest changes. | IMPLEMENTATION: TODO(D4). */
export type BloodCentreResponsesApi = {
  respond(id: string): Promise<OrganizationResponseActionResponse>;
};
