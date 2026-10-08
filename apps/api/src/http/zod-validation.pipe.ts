import { Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from '@bloodlink/validation';
import { ZodValidationException } from './zod-validation.exception';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<
  unknown,
  Promise<T>
> {
  constructor(private readonly schema: ZodType<T>) {}

  async transform(value: unknown): Promise<T> {
    const result = await this.schema.safeParseAsync(value);
    if (!result.success) {
      throw new ZodValidationException(result.error.issues);
    }

    return result.data;
  }
}
