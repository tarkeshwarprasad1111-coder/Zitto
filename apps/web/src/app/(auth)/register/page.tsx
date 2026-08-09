'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { forwardRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn, passwordStrength } from '@/lib/utils';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;

const registerSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Enter your email or mobile number')
    .refine(
      (value) => EMAIL_PATTERN.test(value) || MOBILE_PATTERN.test(value.replace(/\D/g, '')),
      'Enter a valid email address or 10-digit mobile number',
    ),
  displayName: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(24, 'Display name must be 24 characters or fewer'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  ageConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm you are 18 or older' }),
  }),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service' }),
  }),
});

type RegisterValues = z.infer<typeof registerSchema>;

const STRENGTH_COLORS = [
  'bg-danger-500',
  'bg-danger-500',
  'bg-warning-500',
  'bg-gold-400',
  'bg-success-500',
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      identifier: '',
      displayName: '',
      password: '',
    },
  });

  const password = watch('password') ?? '';
  const strength = passwordStrength(password);

  async function onSubmit(values: RegisterValues) {
    try {
      // MOCK: replace with `api.post('/auth/register', ...)`.
      await new Promise((resolve) => setTimeout(resolve, 800));

      const channel = EMAIL_PATTERN.test(values.identifier) ? 'email' : 'mobile';
      toast({
        title: 'Account created',
        description: 'Verify your account to finish signing up.',
        variant: 'success',
      });

      router.push(
        `/verify-otp?channel=${channel}&target=${encodeURIComponent(values.identifier)}`,
      );
    } catch {
      toast({ title: 'Could not create account', variant: 'error' });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="mt-1.5 text-sm text-surface-muted">Virtual coins only. 18+.</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input
          {...register('identifier')}
          label="Email or mobile number"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com or 98765 43210"
          leftIcon={<Mail size={17} />}
          error={errors.identifier?.message}
          hint="We will send a 6-digit code to verify it."
          required
        />

        <Input
          {...register('displayName')}
          label="Display name"
          type="text"
          autoComplete="nickname"
          placeholder="How other players see you"
          leftIcon={<UserRound size={17} />}
          error={errors.displayName?.message}
          required
        />

        <div className="flex flex-col gap-2">
          <Input
            {...register('password')}
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            leftIcon={<Lock size={17} />}
            error={errors.password?.message}
            required
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-surface-muted transition-colors hover:text-surface-fg focus-visible:ring-2 focus-visible:ring-gold-400"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            }
          />

          {/* Strength meter — the track is a muted step of the same scale, and
              the label carries the state so it is never colour-alone. */}
          {password.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div
                className="flex gap-1"
                role="meter"
                aria-valuenow={strength.score}
                aria-valuemin={0}
                aria-valuemax={4}
                aria-label={`Password strength: ${strength.label}`}
              >
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-200',
                      index < strength.score
                        ? STRENGTH_COLORS[strength.score]
                        : 'bg-surface-border',
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-surface-muted">
                Strength: <span className="font-semibold text-surface-subtle">{strength.label}</span>
                {strength.hints[0] ? ` · ${strength.hints[0]}` : ''}
              </p>
            </div>
          ) : null}
        </div>

        {/* Consent */}
        <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-card/50 p-3.5">
          <CheckboxField
            id="age-confirm"
            {...register('ageConfirmed')}
            error={errors.ageConfirmed?.message}
          >
            I confirm I am 18 years of age or older.
          </CheckboxField>

          <CheckboxField
            id="terms-confirm"
            {...register('termsAccepted')}
            error={errors.termsAccepted?.message}
          >
            I accept the{' '}
            <Link href="/terms" className="font-medium text-gold-400 underline underline-offset-2">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium text-gold-400 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </CheckboxField>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          loadingText="Creating account"
        >
          Create account
        </Button>
      </form>

      <p className="text-center text-xs leading-relaxed text-surface-muted">
        Zitto is played entirely with virtual coins. Coins have no cash value and cannot be
        exchanged for money.
      </p>

      <p className="text-center text-sm text-surface-muted">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-gold-400 underline-offset-2 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  children: React.ReactNode;
}

// forwardRef so react-hook-form's `register()` ref reaches the input.
const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { id, error, children, ...props },
  ref,
) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 py-1">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-surface-border bg-surface-elevated text-gold-500 accent-gold-500 focus-visible:ring-2 focus-visible:ring-gold-400"
          {...props}
        />
        <span className="text-sm leading-snug text-surface-subtle">{children}</span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="pl-7 text-xs text-danger-400">
          {error}
        </p>
      ) : null}
    </div>
  );
});
