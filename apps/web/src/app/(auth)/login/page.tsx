'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { mockUser } from '@/lib/mock-data';
import { useAuthStore } from '@/store/auth-store';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Enter your email or mobile number')
    .refine(
      (value) => EMAIL_PATTERN.test(value) || MOBILE_PATTERN.test(value.replace(/\D/g, '')),
      'Enter a valid email address or 10-digit mobile number',
    ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    try {
      // MOCK: replace with `api.post<AuthSession>('/auth/login', ...)`.
      await new Promise((resolve) => setTimeout(resolve, 700));

      login(mockUser, {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 300,
      });

      toast({ title: 'Welcome back', variant: 'success' });
      router.push('/home');
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (field === 'identifier' || field === 'password') {
            setError(field, { message: messages[0] ?? 'Invalid value' });
          }
        }
        toast({
          title: error.problem.title,
          description: error.problem.detail,
          variant: 'error',
        });
        // Deliberately vague on 401 so the form cannot be used to discover
        // which accounts exist.
        if (error.isUnauthorized) {
          setError('password', { message: 'Email, mobile or password is incorrect' });
        }
      } else {
        toast({ title: 'Could not log in', variant: 'error' });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="font-display text-2xl font-bold">Welcome back</h1>
        <p className="mt-1.5 text-sm text-surface-muted">Log in to continue playing.</p>
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
          leftIcon={<User size={17} />}
          error={errors.identifier?.message}
          required
        />

        <Input
          {...register('password')}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Your password"
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

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-gold-400 underline-offset-2 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          loadingText="Logging in"
        >
          Log in
        </Button>
      </form>

      <p className="text-center text-sm text-surface-muted">
        New to Zitto?{' '}
        <Link
          href="/register"
          className="font-semibold text-gold-400 underline-offset-2 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
