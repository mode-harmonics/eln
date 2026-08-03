import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { UpdateProcurementDto } from './update-procurement.dto';

/** One row of a batch procurement update. `id` identifies the record; the
 *  remaining optional fields are the same contract as the single update. */
export class UpdateProcurementItemDto extends UpdateProcurementDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}

/** Batch update body: an array of per-record partial updates. */
export class BatchUpdateProcurementDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateProcurementItemDto)
  items!: UpdateProcurementItemDto[];
}
