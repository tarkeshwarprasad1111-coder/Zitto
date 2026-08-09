'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { mockUser } from '@/lib/mock-data';
import { cn, maskContact } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<Spinner size="lg" className="mx-auto text-gold-400" />}>
      <VerifyOtpForm />
    </Suspense>
  );
}

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const login = useAuthStore((state) => state.login);

  const target = searchParams.get('target') ?? '';
  const channel = searchParams.get('channel') === 'mobile' ? 'mobile' : 'email';

  const [digits, setDigits] = useState<string[]>(Array<string>(OTP_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join('');

  // Resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== OTP_LENGTH) {
        setError('Enter all 6 digits');
        return;
      }

      setIsVerifying(true);
      setError(null);

      try {
        // MOCK: replace with `api.post('/auth/verify-otp', { channel, target, code })`.
        await new Promise((resolve) => setTimeout(resolve, 700));

        login(mockUser, {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 300,
        });

        toast({ title: 'Account verified', variant: 'success' });
        router.push('/home');
      } catch {
        setError('That code is not correct or has expired.');
        setDigits(Array<string>(OTP_LENGTH).fill(''));
        inputsRef.current[0]?.focus();
      } finally {
        setIsVerifying(false);
      }
    },
    [login, router, toast],
  );

  function setDigitAt(index: number, value: string) {
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function handleChange(index: number, rawValue: string) {
    const numeric = rawValue.replace(/\D/g, '');
    if (numeric.length === 0) {
      setDigitAt(index, '');
      return;
    }

    // A paste or autofill can deliver several digits into one box.
    if (numeric.length > 1) {
      const next = Array<string>(OTP_LENGTH).fill('');
      digits.forEach((digit, i) => {
        next[i] = digit;
      });
      numeric
        .slice(0, OTP_LENGTH - index)
        .split('')
        .forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      setDigits(next);

      const filled = next.join('');
      const focusIndex = Math.min(index + numeric.length, OTP_LENGTH - 1);
      inputsRef.current[focusIndex]?.focus();
      if (filled.length === OTP_LENGTH) void submit(filled);
      return;
    }

    setDigitAt(index, numeric);
    setError(null);

    if (index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    } else {
      const filled = [...digits.slice(0, index), numeric].join('');
      if (filled.length === OTP_LENGTH) void submit(filled);
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      setDigitAt(index - 1, '');
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    // MOCK: replace with `api.post('/auth/resend-otp', { channel, target })`.
    await new Promise((resolve) => setTimeout(resolve, 400));
    setCooldown(RESEND_COOLDOWN_SECONDS);
    toast({ title: 'Code sent again', variant: 'info' });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="font-display text-2xl font-bold">Verify your account</h1>
        <p className="mt-1.5 text-sm text-surface-muted">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-surface-subtle">
            {target ? maskContact(target) : `your ${channel}`}
          </span>
          .
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
        className="flex flex-col gap-4"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Verification code</legend>

          <div className="flex justify-center gap-2">
            {digits.map((digit, index) => (
              <input
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={OTP_LENGTH}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onFocus={(event) => event.target.select()}
                disabled={isVerifying}
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'otp-error' : undefined}
                className={cn(
                  'h-14 w-11 rounded-xl border bg-surface-elevated text-center font-display text-2xl font-bold tabular-nums text-surface-fg',
                  'transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-bg',
                  'disabled:opacity-60',
                  error
                    ? 'border-danger-500/70 focus:ring-danger-500/60'
                    : 'border-surface-border focus:border-gold-500/70 focus:ring-gold-400',
                )}
              />
            ))}
          </div>

          {error ? (
            <p id="otp-error" role="alert" className="text-center text-xs text-danger-400">
              {error}
            </p>
          ) : null}
        </fieldset>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isVerifying}
          loadingText="Verifying"
          disabled={code.length !== OTP_LENGTH}
        >
          Verify
        </Button>
      </form>

      <div className="flex flex-col items-center gap-2 text-sm">
        {cooldown > 0 ? (
          <p className="text-surface-muted" aria-live="polite">
            Resend in <span className="tabular-nums">{cooldown}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="font-semibold text-gold-400 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            Resend code
          </button>
        )}

        <Link href="/register" className="text-surface-muted underline-offset-2 hover:underline">
          Use a different email or number
        </Link>
      </div>
    </div>
  );
}
