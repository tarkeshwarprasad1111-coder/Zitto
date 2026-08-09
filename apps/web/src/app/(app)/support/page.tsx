'use client';

import { useState } from 'react';
import { ChevronDown, Headphones, Plus } from 'lucide-react';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatRelativeTime } from '@/lib/utils';

// MOCK: replace with GET /support/tickets.
const TICKETS = [
  {
    id: 't1',
    subject: 'Daily reward did not credit',
    status: 'open' as const,
    updatedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
  },
  {
    id: 't2',
    subject: 'Question about round #4,102 result',
    status: 'resolved' as const,
    updatedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  },
];

const FAQS = [
  {
    q: 'Do Zitto coins have any cash value?',
    a: 'No. Coins are virtual only. They cannot be purchased, exchanged for money, or withdrawn.',
  },
  {
    q: 'Can the analytics tell me what comes next?',
    a: 'No. Every round is an independent draw. The analytics describe rounds already played, and confidence never rises above "Moderate signal" because no sample size would justify a stronger claim.',
  },
  {
    q: 'How do I know a round was fair?',
    a: 'Each round commits to a hashed server seed before betting opens and reveals the seed after settlement. Open any settled round to reproduce the cards yourself.',
  },
  {
    q: 'How do I take a break?',
    a: 'Settings → Responsible gaming lets you set session reminders or exclude yourself for a fixed period.',
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold">
          <Headphones className="h-5 w-5 text-gold-500" />
          Support
        </h1>
      </PageSection>

      <PageSection>
        <Button className="w-full">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New ticket
        </Button>
      </PageSection>

      <PageSection>
        <h2 className="mb-2 text-sm font-semibold text-surface-subtle">Your tickets</h2>
        {TICKETS.length === 0 ? (
          <EmptyState
            icon={<Headphones className="h-8 w-8" />}
            title="No tickets"
            description="Raise one and we will reply here."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {TICKETS.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{t.subject}</p>
                    <p className="text-xs text-surface-muted">
                      Updated {formatRelativeTime(t.updatedAt)}
                    </p>
                  </div>
                  <Badge variant={t.status === 'open' ? 'warning' : 'success'}>
                    {t.status === 'open' ? 'Open' : 'Resolved'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection>
        <h2 className="mb-2 text-sm font-semibold text-surface-subtle">Common questions</h2>
        <div className="flex flex-col gap-2">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <Card key={f.q}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-sm font-medium">{f.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-surface-muted transition-transform motion-reduce:transition-none ${
                        open ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {open && (
                    <p className="px-4 pb-3 text-sm leading-relaxed text-surface-muted">{f.a}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageSection>
    </PageContainer>
  );
}
