import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Auth request contracts.
 *
 * All validation is Zod. The schemas are exported alongside the DTO classes so
 * services and tests can parse payloads that did not arrive over HTTP.
 */

/** Delivery channel for one-time codes. */
export const channelSchema = z.enum(['email', 'mobile']);
export type Channel = z.infer<typeof channelSchema>;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address.')
  .max(254);

/** E.164, which is what every SMS provider expects. */
export const mobileSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Must be an E.164 mobile number, e.g. +919876543210.');

/**
 * Password policy: length does the heavy lifting; the character rule only blocks
 * the most trivially guessable inputs. No maximum complexity theatre.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/\d/, 'Password must contain at least one digit.');

export const localeSchema = z.enum(['en', 'hi']).default('en');

export const registerSchema = z
  .object({
    email: emailSchema.optional(),
    mobile: mobileSchema.optional(),
    password: passwordSchema,
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters.')
      .max(32, 'Display name must be at most 32 characters.')
      .regex(
        /^[\p{L}\p{N} ._-]+$/u,
        'Display name may only contain letters, numbers, spaces, dots, underscores and hyphens.',
      ),
    locale: localeSchema,
    timezone: z.string().trim().max(64).default('Asia/Kolkata'),
    /** Legal gate — registration is refused without it. */
    ageConfirmed: z.literal(true, {
      errorMap: () => ({ message: 'You must confirm you are 18 or older to register.' }),
    }),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms of service to register.' }),
    }),
    referralCode: z.string().trim().min(4).max(32).optional(),
    deviceId: z.string().trim().max(128).optional(),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.mobile), {
    message: 'Provide either an email address or a mobile number.',
    path: ['email'],
  });

export class RegisterDto extends createZodDto(registerSchema) {}

export const loginSchema = z
  .object({
    email: emailSchema.optional(),
    mobile: mobileSchema.optional(),
    password: z.string().min(1, 'Password is required.').max(128),
    deviceId: z.string().trim().max(128).optional(),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.mobile), {
    message: 'Provide either an email address or a mobile number.',
    path: ['email'],
  });

export class LoginDto extends createZodDto(loginSchema) {}

export const verifyOtpSchema = z.object({
  channel: channelSchema,
  target: z.string().trim().min(3).max(254),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'The code must be exactly 6 digits.'),
  deviceId: z.string().trim().max(128).optional(),
});

export class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}

export const resendOtpSchema = z.object({
  channel: channelSchema,
  target: z.string().trim().min(3).max(254),
});

export class ResendOtpDto extends createZodDto(resendOtpSchema) {}

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'A refresh token is required.').max(4096),
});

export class RefreshDto extends createZodDto(refreshSchema) {}

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(4096).optional(),
});

export class LogoutDto extends createZodDto(logoutSchema) {}

export const forgotPasswordSchema = z
  .object({
    channel: channelSchema,
    target: z.string().trim().min(3).max(254),
  })
  .superRefine((data, ctx) => {
    const schema = data.channel === 'email' ? emailSchema : mobileSchema;
    const result = schema.safeParse(data.target);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target'],
        message: result.error.issues[0]?.message ?? 'Invalid target for this channel.',
      });
    }
  });

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export const resetPasswordSchema = z.object({
  channel: channelSchema,
  target: z.string().trim().min(3).max(254),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'The code must be exactly 6 digits.'),
  newPassword: passwordSchema,
});

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
