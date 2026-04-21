import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class VariantCreateDto {
  @IsString()
  @MaxLength(8)
  key!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateExperimentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantCreateDto)
  variants!: VariantCreateDto[];
}
