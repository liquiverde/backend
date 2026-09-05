import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SubstitutionResponseDto } from './dto/substitution-response.dto';
import { SubstitutionService } from './substitution.service';

@ApiTags('substitution')
@Controller('substitution')
export class SubstitutionController {
  constructor(private readonly substitutionService: SubstitutionService) {}

  @Public()
  @Get(':productId')
  @ApiOperation({ summary: 'Suggest sustainable/cheaper substitutes (RF-06)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findSubstitutes(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('limit') limit?: string,
  ): Promise<SubstitutionResponseDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 3;
    return this.substitutionService.findSubstitutesFor(productId, parsedLimit);
  }
}
