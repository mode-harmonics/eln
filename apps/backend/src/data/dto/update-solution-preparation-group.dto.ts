import { IsString } from 'class-validator';

export class UpdateSolutionPreparationGroupDto {
  @IsString()
  groupName!: string;

  @IsString()
  formulaInfo!: string;
}
