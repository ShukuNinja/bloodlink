import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  HospitalSearchRequest,
  HospitalSummary,
} from '@bloodlink/contracts';

@Injectable()
export class HospitalsService {
  /** TODO(D2): Use a PostGIS geographic-distance query; do not use district boundaries. */
  async search(_input: HospitalSearchRequest): Promise<HospitalSummary[]> {
    void _input;
    throw new NotImplementedException('TODO(D2): discover nearby hospitals');
  }
}
