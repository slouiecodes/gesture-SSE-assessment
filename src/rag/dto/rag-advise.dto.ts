import { IsOptional, IsString, MinLength } from 'class-validator';

export class RagAdviseDto {
  @IsString()
  @MinLength(3)
  experimentGoal!: string;

  @IsOptional()
  @IsString()
  query?: string;
}
