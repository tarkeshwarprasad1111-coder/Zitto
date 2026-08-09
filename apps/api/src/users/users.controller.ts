import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import {
  ReqContext,
  type RequestContextData,
} from '../common/decorators/request-context.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  PreferencesDto,
  ProfileDto,
  RgLimitsDto,
  SelfExcludeDto,
  SelfExclusionDto,
  SessionDto,
  SetRgLimitsDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

/** Self-service account endpoints. Every route operates on the caller's own account. */
@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get my profile' })
  @ApiOkResponse({ type: ProfileDto })
  async getMe(@CurrentUser('id') userId: string): Promise<ProfileDto> {
    return this.usersService.getProfile(userId);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update my profile',
    description:
      'Updates display name, avatar, locale, timezone or theme. Email and mobile are identifiers and cannot be changed here.',
  })
  @ApiOkResponse({ type: ProfileDto })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<ProfileDto> {
    return this.usersService.updateProfile(userId, dto, ctx);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'List my active sessions',
    description: 'Live sessions across all devices, with the current one flagged.',
  })
  @ApiOkResponse({ type: [SessionDto] })
  async getSessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionDto[]> {
    return this.usersService.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign out one session',
    description: 'Revokes a single session. Passing the current session id signs this device out.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Session revoked.' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @ReqContext() ctx: RequestContextData,
  ): Promise<{ message: string }> {
    return this.usersService.revokeSession(user.id, sessionId, user.sessionId, ctx);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get my preferences' })
  @ApiOkResponse({ type: PreferencesDto })
  async getPreferences(@CurrentUser('id') userId: string): Promise<PreferencesDto> {
    return this.usersService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update my preferences' })
  @ApiOkResponse({ type: PreferencesDto })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<PreferencesDto> {
    return this.usersService.updatePreferences(userId, dto, ctx);
  }

  @Get('rg-limits')
  @ApiOperation({ summary: 'Get my responsible gaming limits' })
  @ApiOkResponse({ type: RgLimitsDto })
  async getRgLimits(@CurrentUser('id') userId: string): Promise<RgLimitsDto> {
    return this.usersService.getRgLimits(userId);
  }

  @Post('rg-limits')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: false })
  @ApiOperation({
    summary: 'Set my responsible gaming limits',
    description:
      'Sets or clears the daily bet limit, daily loss limit and session time limit. The game engine refuses stakes that would breach an active limit.',
  })
  @ApiOkResponse({ type: RgLimitsDto })
  async setRgLimits(
    @CurrentUser('id') userId: string,
    @Body() dto: SetRgLimitsDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<RgLimitsDto> {
    return this.usersService.setRgLimits(userId, dto, ctx);
  }

  @Post('self-exclude')
  @Idempotent()
  @ApiOperation({
    summary: 'Self-exclude',
    description:
      '**Irreversible.** Locks the account for the requested period, revokes every session immediately, and refuses login until the period ends. An active exclusion can be extended but never shortened.',
  })
  @ApiCreatedResponse({ type: SelfExclusionDto })
  @ApiConflictResponse({
    description: 'An active exclusion already runs at least as long as the requested one.',
  })
  async selfExclude(
    @CurrentUser('id') userId: string,
    @Body() dto: SelfExcludeDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<SelfExclusionDto> {
    return this.usersService.selfExclude(userId, dto, ctx);
  }
}
