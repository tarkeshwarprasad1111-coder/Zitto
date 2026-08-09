'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminLoginPage() {
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // TODO: POST /auth/login
    await new Promise((r) => setTimeout(r, 800));
    setStep('2fa');
    setLoading(false);
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // TODO: POST /auth/2fa/verify, then redirect to /dashboard
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10">
            <Shield className="h-6 w-6 text-brand-400" />
          </div>
          <CardTitle className="text-xl">Zitto Admin</CardTitle>
          <p className="text-sm text-zinc-400">Authorised personnel only</p>
        </CardHeader>
        <CardContent>
          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Continue'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handle2FA} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Two-Factor Code</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  autoFocus
                  required
                />
                <p className="text-xs text-zinc-400 mt-1">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <Button type="submit" className="w-full" disabled={loading || totp.length !== 6}>
                {loading ? 'Verifying…' : 'Sign In'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('credentials')}>
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
