'use client';

import { useState } from 'react';
import { KeyRound, LogOut, Monitor, Shield, Smartphone } from 'lucide-react';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';

// MOCK: replace with GET /me/sessions and GET /me/devices.
const SESSIONS = [
  {
    id: 's1',
    device: 'Chrome on Windows',
    location: 'Mumbai, IN',
    ip: '103.21.44.18',
    lastSeenAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    current: true,
  },
  {
    id: 's2',
    device: 'Zitto app on Android',
    location: 'Mumbai, IN',
    ip: '103.21.44.18',
    lastSeenAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    current: false,
  },
  {
    id: 's3',
    device: 'Safari on iPhone',
    location: 'Pune, IN',
    ip: '49.36.180.4',
    lastSeenAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    current: false,
  },
];

export default function SecuritySettingsPage() {
  const [twoFactorOn, setTwoFactorOn] = useState(false);

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold">
          <Shield className="h-5 w-5 text-gold-500" />
          Security
        </h1>
      </PageSection>

      <PageSection>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="h-4 w-4 text-surface-muted" aria-hidden="true" />
                  Two-factor authentication
                  {twoFactorOn && <Badge variant="success">On</Badge>}
                </p>
                <p className="mt-1 text-xs text-surface-muted">
                  Adds a code from your authenticator app when you sign in on a new device.
                </p>
              </div>
              <Button
                size="sm"
                variant={twoFactorOn ? 'outline' : 'primary'}
                onClick={() => setTwoFactorOn((v) => !v)}
              >
                {twoFactorOn ? 'Turn off' : 'Set up'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection>
        <h2 className="mb-2 text-sm font-semibold text-surface-subtle">Active sessions</h2>
        <div className="flex flex-col gap-2">
          {SESSIONS.map((s) => {
            const Icon = s.device.toLowerCase().includes('android') || s.device.toLowerCase().includes('iphone')
              ? Smartphone
              : Monitor;

            return (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-surface-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm">
                        {s.device}
                        {s.current && <Badge variant="success">This device</Badge>}
                      </p>
                      <p className="truncate text-xs text-surface-muted">
                        {s.location} · {s.ip} · {formatRelativeTime(s.lastSeenAt)}
                      </p>
                    </div>
                  </div>
                  {!s.current && (
                    <Button size="sm" variant="ghost" className="shrink-0 text-xs">
                      Revoke
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageSection>

      <PageSection>
        <Button variant="danger" className="w-full">
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign out everywhere
        </Button>
        <p className="mt-2 text-center text-xs text-surface-muted">
          Ends every session including this one. You will need to sign in again.
        </p>
      </PageSection>
    </PageContainer>
  );
}
