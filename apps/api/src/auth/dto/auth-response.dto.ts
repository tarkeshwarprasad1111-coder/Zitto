import { ApiProperty } from '@nestjs/swagger';

/** Documented response shapes for the auth endpoints. */

export class TokenPairDto {
  @ApiProperty({ description: 'Short-lived bearer token for API calls.' })
  accessToken!: string;

  @ApiProperty({ description: 'Long-lived token; rotated on every use.' })
  refreshToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds.', example: 300 })
  expiresIn!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';
}

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  mobile!: string | null;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED', 'DELETED'] })
  status!: string;

  @ApiProperty({ example: 'en' })
  locale!: string | null;

  @ApiProperty({ type: [String], example: ['player'] })
  roles!: string[];

  @ApiProperty({ description: 'True once email or mobile has been verified.' })
  verified!: boolean;
}

export class LoginResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: TokenPairDto })
  tokens!: TokenPairDto;
}

export class RegisterResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({
    description:
      'Channel the verification code was sent to. No tokens are issued until it is verified.',
    enum: ['email', 'mobile'],
  })
  verificationChannel!: string;

  @ApiProperty({ description: 'Masked destination, e.g. `a***@example.com`.' })
  verificationTarget!: string;

  @ApiProperty({ description: 'Seconds until the code expires.', example: 300 })
  expiresIn!: number;
}

export class VerifyOtpResponseDto extends LoginResponseDto {
  @ApiProperty({
    description: 'Signup bonus credited on first successful verification, in coins.',
    example: '500',
    nullable: true,
  })
  signupBonusCoins!: string | null;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}
