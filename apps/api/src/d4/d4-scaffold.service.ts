import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * OWNER: D4
 * PURPOSE: Explicit TODO boundary for D4 API operations.
 * ENDPOINT/METHOD: Donor, blood-centre, subscription, and communication routes.
 * INPUT: Authenticated principal and structurally validated request data.
 * OUTPUT: TODO(D4); no domain objects are fabricated.
 * AUTHORIZATION: Enforced by route guards and future participant-scoped queries.
 * DEPENDENCIES: Existing AuthModule, shared contracts, shared validation.
 * STATE CHANGES: None until each operation is implemented by D4.
 * NON-RESPONSIBILITIES: D3 BloodRequest or ResponderAssignment mutations, medical decisions.
 * IMPLEMENTATION: TODO(D4).
 */
@Injectable()
export class D4ScaffoldService {
  private pending(operation: string, ...context: unknown[]): never {
    void context;
    throw new NotImplementedException(`TODO(D4): ${operation}`);
  }

  getDonorProfile(_userId: string): never {
    return this.pending('get donor profile', _userId);
  }
  updateDonorProfile(_userId: string, _input: unknown): never {
    return this.pending('update donor profile', _userId, _input);
  }
  listDonorRequests(_userId: string, _query: unknown): never {
    return this.pending('list donor requests', _userId, _query);
  }
  getDonorRequest(_userId: string, _requestId: string): never {
    return this.pending('get donor request', _userId, _requestId);
  }
  acceptRequest(_userId: string, _requestId: string): never {
    return this.pending('accept donor request', _userId, _requestId);
  }
  withdrawRequest(_userId: string, _requestId: string): never {
    return this.pending('withdraw donor response', _userId, _requestId);
  }
  listBloodCentreRequests(_userId: string, _query: unknown): never {
    return this.pending('list blood-centre requests', _userId, _query);
  }
  getBloodCentreRequest(_userId: string, _requestId: string): never {
    return this.pending('get blood-centre request', _userId, _requestId);
  }
  createOrganizationResponse(_userId: string, _requestId: string): never {
    return this.pending('create organization response', _userId, _requestId);
  }
  subscribe(_userId: string, _hospitalId: string): never {
    return this.pending('subscribe to hospital', _userId, _hospitalId);
  }
  unsubscribe(_userId: string, _hospitalId: string): never {
    return this.pending('unsubscribe from hospital', _userId, _hospitalId);
  }
  listSubscriptions(_userId: string): never {
    return this.pending('list hospital subscriptions', _userId);
  }
  getConversation(_userId: string, _requestId: string): never {
    return this.pending('get request conversation', _userId, _requestId);
  }
  createMessage(_userId: string, _requestId: string, _input: unknown): never {
    return this.pending(
      'create conversation message',
      _userId,
      _requestId,
      _input,
    );
  }
}
