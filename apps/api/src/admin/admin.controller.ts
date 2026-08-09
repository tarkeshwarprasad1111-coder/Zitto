import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post,
  Query, DefaultValuePipe, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { RequestContext, RequestContextData } from '../common/decorators/request-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AdminService } from './admin.service';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

class SetStatusDto extends createZodDto(z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().min(5).max(500),
})) {}

class CreditDto extends createZodDto(z.object({
  amount: z.coerce.bigint().positive(),
  reason: z.string().min(5).max(500),
})) {}

class SettingDto extends createZodDto(z.object({
  key: z.string().min(1),
  value: z.string(),
})) {}

@ApiTags('Admin')
@ApiBearerAuth('bearer')
@Roles('admin', 'super_admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform dashboard stats' })
  dashboard() {
    return this.admin.getDashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'Search / list users' })
  listUsers(
    @Query('q') q?: string,
    @Query('status') status?: UserStatus,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.admin.listUsers(q, status, cursor, limit);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'User detail with wallet + sessions' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Suspend / activate / exclude user — reason mandatory' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.setUserStatus(user.id, id, dto.status, dto.reason);
  }

  @Post('users/:id/credit')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Admin coin credit — reason mandatory' })
  credit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreditDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.admin.creditUser(user.id, id, dto.amount, dto.reason, ctx.idempotencyKey ?? user.id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Audit log — read-only, no delete' })
  auditLogs(
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('target') target?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.admin.getAuditLogs(
      actor, action, target,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      cursor, limit,
    );
  }

  @Patch('settings')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update app setting (super admin only)' })
  updateSetting(
    @Body() dto: SettingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.upsertAppSetting(user.id, dto.key, dto.value);
  }

  @Post('analytics/validate-model-note')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate model note for banned phrases before saving' })
  validateModelNote(@Body() body: { note: string }) {
    return this.admin.validateModelNote(body.note);
  }
}
