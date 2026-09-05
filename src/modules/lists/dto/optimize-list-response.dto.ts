import { ApiProperty } from '@nestjs/swagger';
import { ListResponseDto } from './list-response.dto';

export class OptimizeListResponseDto extends ListResponseDto {
  @ApiProperty({
    description:
      'True when the exact DP was skipped in favor of the greedy approximation (large candidate set)',
  })
  usedFallback!: boolean;

  @ApiProperty({ description: 'Optimizer wall-clock time in milliseconds' })
  computeTimeMs!: number;
}
