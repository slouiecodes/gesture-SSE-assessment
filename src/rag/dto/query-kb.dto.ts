import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class QueryKbDto {
  @IsString()
  @MinLength(2)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  k?: number;

  /**
   * Optional tracking context. If provided, the server will log `question_asked`
   * and `query_results` events to the `events` table.
   */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  experimentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  variantId?: number;
}
