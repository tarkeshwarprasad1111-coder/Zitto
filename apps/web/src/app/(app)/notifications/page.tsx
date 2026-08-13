'use client';

import { useState } from 'react';
import { Bell, CheckCheck, Gift, Trophy, BarChart3, ShieldCheck } from 'lucide-react';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { mockNotifications } from '@/lib/mock-data';
import { cn, formatRelativeTime } from '@/lib/utils';

/** Icon per notification kind, so the list is scannable without reading it. */
const ICONS = {
  reward: Gift,
  tournament: Trophy,
  analytics: BarChart3,
  system: ShieldCheck,
} as const;

function iconFor(type: string) {
  if (type.includes('reward') || type.includes('mission')) return ICONS.reward;
  if (type.includes('tournament')) return ICONS.tournament;
  if (type.includes('analytic') || type.includes('round')) return ICONS.analytics;
  return ICONS.system;
}

export default function NotificationsPage() {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const items = mockNotifications.map((n) => ({
    ...n,
    isRead: n.readAt !== null || readIds.has(n.id),
  }));

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <div className="flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-xl font-bold">
            <Bell className="h-5 w-5 text-gold-500" />
            Notifications
          </h1>
          {unread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReadIds(new Set(items.map((n) => n.id)))}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </div>
      </PageSection>

      <PageSection>
        {items.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="Nothing new"
            description="Round results, rewards and tournament updates land here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((n) => {
              const Icon = iconFor(n.type);

              return (
                <li key={n.id}>
                  <Card
                    className={cn(
                      'transition-colors',
                      // Unread carries a left rail as well as a brighter
                      // ground — colour alone would leave it invisible to
                      // anyone who cannot distinguish these two shades.
                      !n.isRead && 'border-l-2 border-l-gold-500 bg-surface-elevated',
                    )}
                  >
                    <CardContent className="flex items-start gap-3 py-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          n.isRead ? 'bg-surface-elevated text-surface-muted' : 'bg-gold-500/15 text-gold-400',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <button
                        type="button"
                        onClick={() => setReadIds((prev) => new Set(prev).add(n.id))}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className={cn('text-sm', !n.isRead && 'font-semibold')}>{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 text-xs leading-relaxed text-surface-muted">{n.body}</p>
                        )}
                        <p className="mt-1 text-2xs text-surface-muted">
                          {formatRelativeTime(n.createdAt)}
                          {!n.isRead && <span className="ml-2 text-gold-400">Unread</span>}
                        </p>
                      </button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </PageSection>
    </PageContainer>
  );
}
