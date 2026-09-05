import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  RewardEventResponseDto,
  RewardsSummaryResponseDto,
} from './dto/reward-event-response.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@ApiBearerAuth()
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('history')
  @ApiOperation({ summary: 'Reward point history (RF-11, bonus)' })
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RewardEventResponseDto[]> {
    return this.rewardsService.getHistory(user.sub);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Reward points summary (RF-11, bonus)' })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RewardsSummaryResponseDto> {
    return this.rewardsService.getSummary(user.sub);
  }
}
