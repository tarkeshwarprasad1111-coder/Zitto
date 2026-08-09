'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight, Globe, Moon, Shield, ShieldCheck } from 'lucide-react';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
] as const;

const NOTIFICATION_PREFS = [
  { key: 'rounds', label: 'Round results', hint: 'When a round you played settles' },
  { key: 'rewards', label: 'Rewards and missions', hint: 'Daily reward ready, mission complete' },
  { key: 'tournaments', label: 'Tournaments', hint: 'Start reminders and final standings' },
  { key: 'breaks', label: 'Break reminders', hint: 'Session length nudges you have set' },
] as const;

export default function SettingsPage() {
  const [locale, setLocale] = useState<(typeof LOCALES)[number]['code']>('en');
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    rounds: true,
    rewards: true,
    tournaments: false,
    breaks: true,
  });

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="font-display text-xl font-bold">Settings</h1>
      </PageSection>

      <PageSection>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-subtle">
          <Globe className="h-4 w-4" aria-hidden="true" />
          Language
        </h2>
        <div role="group" aria-label="Language" className="flex gap-2">
          {LOCALES.map((l) => (
            <Button
              key={l.code}
              size="sm"
              variant={locale === l.code ? 'primary' : 'outline'}
              aria-pressed={locale === l.code}
              onClick={() => setLocale(l.code)}
            >
              {l.label}
            </Button>
          ))}
        </div>
      </PageSection>

      <PageSection>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-subtle">
          <Moon className="h-4 w-4" aria-hidden="true" />
          Appearance
        </h2>
        <Card>
          <CardContent className="py-3">
            <p className="text-sm">Dark theme</p>
            <p className="mt-0.5 text-xs text-surface-muted">
              Zitto is dark-only for now. A light theme is not yet available.
            </p>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-subtle">
          <Bell className="h-4 w-4" aria-hidden="true" />
          Notifications
        </h2>
        <Card>
          <CardContent className="py-1">
            {NOTIFICATION_PREFS.map((p) => (
              <label
                key={p.key}
                className="flex cursor-pointer items-center justify-between gap-3 border-b border-surface-border py-3 last:border-0"
              >
                <span className="min-w-0">
                  <span className="block text-sm">{p.label}</span>
                  <span className="block text-xs text-surface-muted">{p.hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={enabled[p.key] ?? false}
                  onChange={(e) => setEnabled((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                  className="h-5 w-5 shrink-0 accent-gold-500"
                />
              </label>
            ))}
          </CardContent>
        </Card>
      </PageSection>

      <PageSection>
        <div className="flex flex-col gap-2">
          {[
            { href: '/settings/security', label: 'Security and sessions', icon: Shield },
            // Responsible gaming lives outside the authenticated group: the public
            // landing page links to it too, and a guest must not hit an auth wall
            // on the way to harm-reduction information.
            { href: '/responsible-gaming', label: 'Responsible gaming', icon: ShieldCheck },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="transition-colors hover:bg-surface-elevated">
                <CardContent className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-3 text-sm">
                    <Icon className="h-4 w-4 text-surface-muted" aria-hidden="true" />
                    {label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-surface-muted" aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </PageSection>
    </PageContainer>
  );
}
