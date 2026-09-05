import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SustainabilityService } from './sustainability.service';
import { SustainabilityResponseDto } from './dto/sustainability-response.dto';

@ApiTags('sustainability')
@Controller('sustainability')
export class SustainabilityController {
  constructor(private readonly sustainabilityService: SustainabilityService) {}

  @Public()
  @Get(':productId')
  @ApiOperation({ summary: 'Get a product sustainability score (RF-03)' })
  @ApiQuery({ name: 'history', required: false, type: Boolean })
  get(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('history') history?: string,
  ): Promise<SustainabilityResponseDto | SustainabilityResponseDto[]> {
    if (history === 'true') {
      return this.sustainabilityService.getHistory(productId);
    }
    return this.sustainabilityService.getCurrent(productId);
  }

  @ApiBearerAuth()
  @Post(':productId/recalculate')
  @ApiOperation({ summary: 'Force a score recalculation (QA/manual trigger)' })
  recalculate(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<SustainabilityResponseDto> {
    return this.sustainabilityService.recalculate(productId);
  }
}
