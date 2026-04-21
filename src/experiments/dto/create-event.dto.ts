import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

/**
 * Maps cleanly to analytics "track" payloads (e.g. Segment):
 * { event: eventType, properties: { ...payload, experimentId, variantId }, userId }
 */
export class CreateEventDto {
  @IsString()
  userId!: string;

  @IsInt()
  @Min(1)
  experimentId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  variantId?: number | null;

  @IsString()
  eventType!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown> | null;
}
