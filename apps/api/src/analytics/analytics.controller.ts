import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('bearer')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Outcome frequency summary with mandatory disclaimer' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('window', new DefaultValuePipe(50), ParseIntPipe) window: number,
  ) {
    return this.analytics.getSummary(user.id, Math.min(window, 100));
  }

  @Get('streaks')
  @ApiOperation({ summary: 'Streak detection' })
  streaks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('window', new DefaultValuePipe(100), ParseIntPipe) window: number,
  ) {
    return this.analytics.getStreaks(user.id, window);
  }

  @Get('prediction/current')
  @ApiOperation({
    summary: 'Statistical model estimate — not a guaranteed outcome',
    description:
      'Returns a historical-frequency-based estimate for informational purposes only. ' +
      'Confidence is capped at "low". Every response includes a mandatory disclaimer.',
  })
  prediction(
    @CurrentUser() user: AuthenticatedUser,
    @Query('roomId') roomId?: string,
  ) {
    return this.analytics.getCurrentPrediction(user.id, roomId);
  }
}
