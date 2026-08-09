'use client';

import { useState } from 'react';
import { ShieldCheck, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';

const HELPLINES = [
  { name: 'iCall (India)', phone: '9152987821' },
  { name: 'Vandrevala Foundation', phone: '1860-2662-345' },
  { name: 'Snehi', phone: '044-24640050' },
];

const EXCLUSION_DURATIONS = [
  { label: '24 hours', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '6 months', value: 180 },
  { label: 'Permanently', value: -1 },
];

export default function ResponsibleGamingPage() {
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const CONFIRM_PHRASE = 'EXCLUDE ME';
  const canConfirm = confirmText === CONFIRM_PHRASE && selectedDuration !== null;

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Responsible Gaming
        </h1>
        <p className="text-sm text-surface-muted mt-1">
          Your wellbeing matters. Use these tools to stay in control.
        </p>
      </PageSection>

      {/* Key facts */}
      <PageSection>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                Zitto uses <strong>virtual coins only</strong> — no real money is involved.
              </p>
            </div>
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                Every round is <strong>independent and random</strong>. No pattern or analytics can predict the next outcome.
              </p>
            </div>
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                If you feel you are spending too much time playing, <strong>take a break</strong> or use self-exclusion below.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      {/* Session timer */}
      <PageSection>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Session Time Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-muted mb-3">Set a reminder when you have been playing for this long.</p>
            <div className="flex gap-2 flex-wrap">
              {[30, 60, 90, 120].map((mins) => (
                <Button key={mins} size="sm" variant="outline">{mins} min</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageSection>

      {/* Self-exclusion */}
      <PageSection>
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-base text-red-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Self-Exclusion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-muted mb-4">
              Temporarily or permanently block yourself from the platform. This action will immediately log you out and
              cancel any active sessions. It <strong>cannot be undone</strong> before the exclusion period ends.
            </p>
            <Button variant="destructive" onClick={() => setShowExclusionModal(true)}>
              Set Up Self-Exclusion
            </Button>
          </CardContent>
        </Card>
      </PageSection>

      {/* Helplines */}
      <PageSection>
        <h2 className="font-semibold mb-3 text-sm text-surface-muted uppercase tracking-wide">Support Resources</h2>
        <div className="space-y-2">
          {HELPLINES.map((h) => (
            <Card key={h.name}>
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-sm text-gold-400">{h.phone}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-surface-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </PageSection>

      {/* Self-exclusion modal */}
      <Modal open={showExclusionModal} onClose={() => setShowExclusionModal(false)} title="Self-Exclusion">
        <div className="space-y-4">
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
            This will lock your account. You will not be able to log in until the exclusion period ends.
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Select duration:</p>
            <div className="flex flex-wrap gap-2">
              {EXCLUSION_DURATIONS.map((d) => (
                <Button
                  key={d.value}
                  size="sm"
                  variant={selectedDuration === d.value ? 'destructive' : 'outline'}
                  onClick={() => setSelectedDuration(d.value)}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-surface-muted mb-2">
              Type <strong className="text-red-400">{CONFIRM_PHRASE}</strong> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
            />
          </div>
          <Button variant="destructive" disabled={!canConfirm} className="w-full">
            Confirm Self-Exclusion
          </Button>
        </div>
      </Modal>
    </PageContainer>
  );
}
