import { IsInt, Min } from 'class-validator';

export class AssignBodyDto {
  @IsInt()
  @Min(1)
  experimentId!: number;
}
