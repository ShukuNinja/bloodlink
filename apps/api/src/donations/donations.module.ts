import { Module } from '@nestjs/common';
import { DonationsService } from './donations.service';

@Module({ providers: [DonationsService], exports: [DonationsService] })
export class DonationsModule {}
