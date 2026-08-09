import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  ReqContext,
  type RequestContextData,
} from '../common/decorators/request-context.decorator';
import {
  CreateRoomDto,
  GameHistoryDto,
  JoinRoomDto,
  ListRoomsDto,
  PlaceBetDto,
} from './dto/game.dto';
import { GameService } from './game.service';
import { FairnessService } from './fairness.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('Game')
@ApiBearerAuth('bearer')
@Controller('game')
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly fairnessService: FairnessService,
  ) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Game configuration (public)' })
  config() {
    return this.gameService.getConfig();
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List game rooms' })
  listRooms(@Query() q: ListRoomsDto) {
    return this.gameService.listRooms(q);
  }

  @Post('rooms')
  @Idempotent()
  @ApiOperation({ summary: 'Create private room' })
  createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqContext() ctx: RequestContextData,
  ) {
    return this.gameService.createRoom(user.id, dto, ctx);
  }

  @Post('rooms/:id/join')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Join a room' })
  joinRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinRoomDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqContext() ctx: RequestContextData,
  ) {
    return this.gameService.joinRoom(user.id, id, dto, ctx);
  }

  @Post('rooms/:id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a room' })
  leaveRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqContext() ctx: RequestContextData,
  ) {
    return this.gameService.leaveRoom(user.id, id, ctx);
  }

  @Get('rooms/:id/current-round')
  @ApiOperation({ summary: 'Current round in a room' })
  currentRound(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.getCurrentRound(id);
  }

  @Post('rounds/:id/select')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Place a bet on an open round' })
  placeBet(
    @Param('id', ParseUUIDPipe) roundId: string,
    @Body() dto: PlaceBetDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqContext() ctx: RequestContextData,
  ) {
    return this.gameService.placeBet(user.id, roundId, dto, ctx);
  }

  @Get('rounds/:id')
  @ApiOperation({ summary: 'Get round details' })
  getRound(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.getRound(id);
  }

  @Get('history')
  @ApiOperation({ summary: "User's bet history" })
  history(@Query() q: GameHistoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gameService.getHistory(user.id, q);
  }

  @Public()
  @Get('fairness/:roundId')
  @ApiOperation({ summary: 'Provably-fair verification for a completed round (public)' })
  fairness(@Param('roundId', ParseUUIDPipe) roundId: string) {
    return this.fairnessService.verifyRound(roundId);
  }
}
