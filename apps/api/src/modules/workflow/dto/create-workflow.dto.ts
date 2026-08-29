import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsObject,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  type!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsNotEmpty()
  version!: number;

  @IsObject()
  @IsNotEmpty()
  config!: object;
}
