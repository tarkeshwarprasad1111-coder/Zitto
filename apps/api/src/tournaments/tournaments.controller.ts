import { Controller, Get, Param, ParseUUIDPipe, Post, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import {
  ReqContext,
  requireIdempotencyKey,
  type RequestContextData,
} from '../common/decorators/request-context.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { TournamentsService } from './tournaments.service';

@ApiTags('Tournaments')
@ApiBearerAuth('bearer')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  @ApiOperation({ summary: 'List tournaments' })
  list(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.tournaments.list(status, cursor, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Tournament details' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournaments.getById(id);
  }

  @Post(':id/join')
  @Idempotent()
  @ApiOperation({ summary: 'Join a tournament' })
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqContext() ctx: RequestContextData,
  ) {
    return this.tournaments.join(user.id, id, requireIdempotencyKey(ctx));
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Live leaderboard' })
  leaderboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.tournaments.leaderboard(id, cursor, limit);
  }
}
