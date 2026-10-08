import { BadRequestException } from '@nestjs/common';
import type { ZodIssue } from '@bloodlink/validation';

export type PublicValidationIssue = {
  path: string[];
  code: string;
};

export class ZodValidationException extends BadRequestException {
  readonly issues: PublicValidationIssue[];

  constructor(issues: ZodIssue[]) {
    super('Request validation failed');
    this.issues = issues.map((issue) => ({
      path: issue.path.map(String),
      code: issue.code,
    }));
  }
}
