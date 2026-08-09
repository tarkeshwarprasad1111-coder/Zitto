import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Profile and responsible-gaming contracts. */

export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(
        /^[\p{L}\p{N} ._-]+$/u,
        'Display name may only contain letters, numbers, spaces, dots, underscores and hyphens.',
      )
      .optional(),
    avatarUrl: z.string().url().max(512).nullable().optional(),
    locale: z.enum(['en', 'hi']).optional(),
    timezone: z.string().trim().max(64).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

export const updatePreferencesSchema = z
  .object({
    locale: z.enum(['en', 'hi']).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    chartWindow: z
      .coerce
      .number()
      .int()
      .min(10)
      .max(1000)
      .optional()
      .describe('Default sample size for analytics charts.'),
    notifyEmail: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
    notifyInApp: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one preference to update.',
  });

export class UpdatePreferencesDto extends createZodDto(updatePreferencesSchema) {}

/**
 * Responsible-gaming limits.
 *
 * `null` clears a limit. Amounts are coin strings, parsed to BigInt server-side.
 */
export const rgLimitsSchema = z
  .object({
    dailyBetLimit: z
      .string()
      .regex(/^\d+$/, 'Must be a non-negative integer coin amount.')
      .nullable()
      .optional()
      .describe('Maximum coins that may be staked in a calendar day.'),
    dailyLossLimit: z
      .string()
      .regex(/^\d+$/, 'Must be a non-negative integer coin amount.')
      .nullable()
      .optional()
      .describe('Maximum net coin loss permitted in a calendar day.'),
    sessionTimeLimit: z
      .coerce
      .number()
      .int()
      .min(5)
      .max(1440)
      .nullable()
      .optional()
      .describe('Maximum continuous play time, in minutes.'),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one limit to set or clear.',
  });

export class SetRgLimitsDto extends createZodDto(rgLimitsSchema) {}

export const selfExcludeSchema = z.object({
  durationDays: z
    .coerce
    .number()
    .int()
    .min(1, 'Self-exclusion must last at least one day.')
    .max(3650, 'Self-exclusion cannot exceed 10 years.')
    .describe('Length of the exclusion in days. This cannot be shortened once set.'),
  reason: z.string().trim().max(500).optional(),
  /** Deliberate friction — the client must make the consequence explicit. */
  confirm: z.literal(true, {
    errorMap: () => ({
      message:
        'You must confirm you understand that self-exclusion cannot be reversed or shortened.',
    }),
  }),
});

export class SelfExcludeDto extends createZodDto(selfExcludeSchema) {}

// ───────────────────────── Response shapes ─────────────────────────

export class ProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  mobile!: string | null;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true })
  locale!: string | null;

  @ApiProperty({ nullable: true })
  timezone!: string | null;

  @ApiProperty({ nullable: true })
  theme!: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED', 'DELETED'] })
  status!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  mobileVerified!: boolean;

  @ApiProperty({ type: [String], example: ['player'] })
  roles!: string[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true })
  ip!: string | null;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty({ nullable: true })
  deviceFingerprint!: string | null;

  @ApiProperty({ description: 'True for the session making this request.' })
  current!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class PreferencesDto {
  @ApiProperty({ nullable: true })
  locale!: string | null;

  @ApiProperty({ nullable: true })
  theme!: string | null;

  @ApiProperty({ nullable: true })
  chartWindow!: number | null;

  @ApiProperty({ nullable: true })
  notifyEmail!: boolean | null;

  @ApiProperty({ nullable: true })
  notifyPush!: boolean | null;

  @ApiProperty({ nullable: true })
  notifyInApp!: boolean | null;
}

export class RgLimitsDto {
  @ApiProperty({ nullable: true, example: '5000' })
  dailyBetLimit!: string | null;

  @ApiProperty({ nullable: true, example: '2000' })
  dailyLossLimit!: string | null;

  @ApiProperty({ nullable: true, example: 60 })
  sessionTimeLimit!: number | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  enabledAt!: string | null;
}

export class SelfExclusionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ nullable: true })
  reason!: string | null;

  @ApiProperty({ description: 'Sessions revoked as part of the exclusion.' })
  sessionsRevoked!: number;
}
