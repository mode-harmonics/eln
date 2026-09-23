import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

/** Validate scalar parameters, which class DTO validation does not inspect. */
@Injectable()
export class HttpParametersPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const name = metadata.data;
    if (metadata.type === 'param' && name && (name === 'id' || name.endsWith('Id'))) {
      if (typeof value !== 'string' || !isUUID(value)) {
        throw new BadRequestException(`${name} must be a UUID`);
      }
    }
    if (metadata.type === 'query' && (name === 'page' || name === 'limit') && value !== undefined) {
      const text = String(value);
      const number = Number(text);
      if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < 1 || (name === 'limit' && number > 1000)) {
        throw new BadRequestException(`${name} must be a positive integer${name === 'limit' ? ' at most 1000' : ''}`);
      }
    }
    return value;
  }
}
