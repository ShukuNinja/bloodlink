import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  HospitalSearchRequest,
  HospitalSummary,
} from '@bloodlink/contracts';

@Injectable()
export class HospitalsService {
  /**
   * TODO(D2): Use PostGIS for geographic distance and derive HospitalSummary.latitude/longitude
   * from canonical Organization.location (ST_Y/ST_X); do not use district boundaries
   * or reintroduce persisted coordinate fields.
   */
  async search(_input: HospitalSearchRequest): Promise<HospitalSummary[]> {
    void _input;
    throw new NotImplementedException('TODO(D2): discover nearby hospitals');
  }
}
