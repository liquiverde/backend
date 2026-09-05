import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsUUID } from 'class-validator';

function splitCommaSeparated({ value }: TransformFnParams): unknown {
  return typeof value === 'string'
    ? value.split(',').map((v) => v.trim())
    : value;
}

export class CompareProductsDto {
  @ApiProperty({
    description: 'Comma-separated product ids, 2-5 (RF-08)',
    example: 'uuid1,uuid2',
  })
  @Transform(splitCommaSeparated)
  @IsUUID('4', { each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  ids!: string[];
}
