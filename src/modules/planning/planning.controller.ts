import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { RepurchaseSuggestionResponseDto } from './dto/repurchase-suggestion-response.dto';
import { PlanningService } from './planning.service';

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('repurchase-suggestions')
  @ApiOperation({
    summary: 'Suggested repurchase timing from purchase history (RF-10, bonus)',
  })
  getSuggestions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RepurchaseSuggestionResponseDto[]> {
    return this.planningService.getRepurchaseSuggestions(user.sub);
  }
}
