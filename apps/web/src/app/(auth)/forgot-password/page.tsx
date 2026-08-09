'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;

const schema = z.object({
  identifier: z
    .string()
    .min(1, 'Enter your email or mobile number')
    .refine(
      (v) => EMAIL_PATTERN.test(v) || MOBILE_PATTERN.test(v),
      'Enter a valid email address or 10-digit mobile number',
    ),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(_values: FormValues) {
    // TODO: POST /auth/forgot-password
    await new Promise((r) => setTimeout(r, 700));
    setSent(true);
  }

  /*
   * The confirmation is deliberately identical whether or not the account
   * exists. Saying "no account found" would turn this form into a way to test
   * whether a given email or number is registered here.
   */
  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden="true" />
        <h1 className="font-display text-xl font-bold">Check your messages</h1>
        <p className="text-sm leading-relaxed text-surface-muted">
          If that email or number belongs to a Zitto account, we have sent a reset link. It expires
          in 15 minutes.
        </p>
        <Link href="/login" className="mt-2 text-sm font-medium text-gold-400 underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold">Reset your password</h1>
        <p className="mt-1 text-sm text-surface-muted">
          We will send a reset link to the email or mobile number on your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Input owns the label, error text and aria wiring — passing them as
            props keeps this field consistent with the sign-in form. */}
        <Input
          id="identifier"
          label="Email or mobile"
          autoComplete="username"
          inputMode="email"
          placeholder="you@example.com or 9876543210"
          leftIcon={<User className="h-4 w-4" />}
          error={errors.identifier?.message}
          {...register('identifier')}
        />

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-surface-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-gold-400 underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
