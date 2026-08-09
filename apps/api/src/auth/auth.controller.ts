import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  ReqContext,
  type RequestContextData,
} from '../common/decorators/request-context.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuthService } from './auth.service';
import {
  LoginResponseDto,
  MessageResponseDto,
  RegisterResponseDto,
  VerifyOtpResponseDto,
} from './dto/auth-response.dto';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';

/**
 * Authentication endpoints.
 *
 * Every route here is aggressively rate-limited: these are the endpoints an
 * attacker probes first. Registration, login and recovery are `@Public()`; the
 * logout routes require a live access token.
 */
@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Registers with an email address or a mobile number. Creates the user, an empty wallet and default preferences atomically, then sends a 6-digit verification code. **No tokens are issued until the code is verified.**',
  })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiConflictResponse({ description: 'The email address or mobile number is already registered.' })
  @ApiUnprocessableEntityResponse({ description: 'Validation failed, or age/terms not confirmed.' })
  async register(
    @Body() dto: RegisterDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(dto, ctx);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a one-time code',
    description:
      'Confirms ownership of the email or mobile, credits the signup bonus (once, ever) and signs the user in.',
  })
  @ApiOkResponse({ type: VerifyOtpResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Code is wrong, expired, or attempts exhausted.' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<VerifyOtpResponseDto> {
    return this.authService.verifyOtp(dto, ctx);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Resend a verification code',
    description:
      'Issues a fresh code and invalidates the previous one. The response is identical whether or not the account exists.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Resend cooldown is still active.' })
  async resendOtp(
    @Body() dto: ResendOtpDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<{ message: string; expiresIn: number }> {
    return this.authService.resendOtp(dto, ctx);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Exchanges credentials for an access + refresh token pair. Suspended and self-excluded accounts are refused.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials, or the account cannot sign in.' })
  async login(
    @Body() dto: LoginDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto, ctx);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Rotate the token pair',
    description:
      'Refresh tokens are single-use. The old session is revoked and a new one issued. Presenting an already-rotated token signs out every session for that account.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token invalid, expired, revoked, or already used.' })
  async refresh(
    @Body() dto: RefreshDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<LoginResponseDto> {
    return this.authService.refresh(dto, ctx);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Sign out of the current session' })
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @ReqContext() ctx: RequestContextData,
  ): Promise<{ message: string }> {
    return this.authService.logout(user.id, user.sessionId, ctx);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Sign out everywhere',
    description: 'Revokes every session for the account, on every device.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @ReqContext() ctx: RequestContextData,
  ): Promise<{ message: string; revoked: number }> {
    return this.authService.logoutAll(userId, ctx);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request a password reset code',
    description:
      'Always returns the same response whether or not the account exists, so this endpoint cannot be used to enumerate users.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<{ message: string; expiresIn: number }> {
    return this.authService.forgotPassword(dto, ctx);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password with a reset code',
    description: 'On success every existing session is revoked.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Code is wrong, expired, or attempts exhausted.' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @ReqContext() ctx: RequestContextData,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto, ctx);
  }
}
