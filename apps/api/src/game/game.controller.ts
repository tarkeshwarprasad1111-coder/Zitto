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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequestContext, RequestContextData } from '../common/decorators/request-context.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateRoomDto,
  GameHistoryQueryDto,
  JoinRoomDto,
  ListRoomsDto,
  PlaceSelectionDto,
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
  listRooms(@Query() q: ListRoomsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gameService.listRooms(user.id, q);
  }

  @Post('rooms')
  @Idempotent()
  @ApiOperation({ summary: 'Create private room' })
  createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() ctx: RequestContextData,
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
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.gameService.joinRoom(user.id, id, dto, ctx);
  }

  @Post('rooms/:id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a room' })
  leaveRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gameService.leaveRoom(user.id, id);
  }

  @Get('rooms/:id/current-round')
  @ApiOperation({ summary: 'Current round in a room' })
  currentRound(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gameService.getCurrentRound(user.id, id);
  }

  @Post('rounds/:id/select')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Place a selection on an open round' })
  placeSelection(
    @Param('id', ParseUUIDPipe) roundId: string,
    @Body() dto: PlaceSelectionDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.gameService.placeSelection(user.id, roundId, dto, ctx);
  }

  @Get('rounds/:id')
  @ApiOperation({ summary: 'Get round details' })
  getRound(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gameService.getRound(user.id, id);
  }

  @Get('history')
  @ApiOperation({ summary: "User's bet history" })
  history(
    @Query() q: GameHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gameService.getHistory(user.id, q);
  }

  @Public()
  @Get('fairness/:roundId')
  @ApiOperation({ summary: 'Provably-fair verification for a completed round (public)' })
  fairness(@Param('roundId', ParseUUIDPipe) roundId: string) {
    return this.fairnessService.getVerificationPayload(roundId);
  }
}
