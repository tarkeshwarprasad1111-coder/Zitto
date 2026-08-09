'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserX, UserCheck, Coins, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  buildUserDetail,
  buildUserLedger,
  buildUserNotes,
  buildUserSessions,
} from '@/lib/mock-data';
import { ledgerTypeBadge, isLedgerDebit, userStatusBadge } from '@/lib/display';
import { formatCoins, formatDateTime, formatPercent, formatRelativeTime } from '@/lib/utils';

type PendingAction = 'suspend' | 'activate' | 'exclude' | null;

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const [pending, setPending] = useState<PendingAction>(null);

  const user = buildUserDetail(params.id);
  if (!user) notFound();

  const sessions = buildUserSessions(params.id);
  const notes = buildUserNotes(params.id);
  const ledger = buildUserLedger(params.id).slice(0, 12);
  const statusBadge = userStatusBadge(user.status);

  return (
    <div className="p-6 space-y-6">
      <Link
        href="/dashboard/users"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All users
      </Link>

      {/* Identity */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{user.displayName}</h1>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            {user.email ?? 'no email'} · {user.mobile ?? 'no mobile'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Joined {formatDateTime(user.createdAt)}
            {user.lastActiveAt ? ` · last active ${formatRelativeTime(user.lastActiveAt)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.status === 'active' ? (
            <Button size="sm" variant="danger" onClick={() => setPending('suspend')}>
              <UserX className="h-3.5 w-3.5 mr-1.5" />
              Suspend
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setPending('activate')}>
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              Activate
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setPending('exclude')}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            Enforce self-exclusion
          </Button>
        </div>
      </div>

      {/* Wallet + play stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { k: 'Balance', v: formatCoins(user.wallet.balance) },
          { k: 'Locked', v: formatCoins(user.wallet.locked) },
          { k: 'Lifetime wagered', v: formatCoins(user.wallet.lifetimeWagered) },
          { k: 'Lifetime won', v: formatCoins(user.wallet.lifetimeWon) },
          { k: 'Rounds played', v: user.stats.roundsPlayed.toLocaleString() },
          { k: 'Win rate', v: formatPercent(user.stats.winRate) },
          { k: 'Biggest win', v: formatCoins(user.stats.biggestWin) },
          { k: 'Referrals', v: user.stats.referrals.toLocaleString() },
        ].map(({ k, v }) => (
          <div key={k} className="rounded-lg border border-surface-border bg-surface-raised p-3">
            <p className="text-[11px] text-zinc-400">{k}</p>
            <p className="text-lg font-semibold tabular-nums mt-0.5">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Ledger */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Wallet ledger
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <EmptyState title="No transactions" description="This account has no wallet movements." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Type</TableHead>
                      <TableHead scope="col">When</TableHead>
                      <TableHead scope="col" className="text-right">Amount</TableHead>
                      <TableHead scope="col" className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((entry) => {
                      const spec = ledgerTypeBadge(entry.type);
                      const debit = isLedgerDebit(entry.type);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell><Badge variant={spec.variant}>{spec.label}</Badge></TableCell>
                          <TableCell className="text-xs text-zinc-400 whitespace-nowrap">
                            {formatRelativeTime(entry.createdAt)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${debit ? 'text-danger-400' : 'text-success-400'}`}
                          >
                            {debit ? '−' : '+'}{formatCoins(Math.abs(entry.amount))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-zinc-400">
                            {formatCoins(entry.balanceAfter)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <EmptyState title="No active sessions" description="This account is not signed in anywhere." />
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-surface-border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm truncate">
                          {s.deviceLabel}
                          {s.current && <span className="ml-2 text-[10px] uppercase text-success-400">current</span>}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {s.ipAddress}{s.location ? ` · ${s.location}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {formatRelativeTime(s.lastSeenAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <EmptyState title="No notes" description="Moderator notes on this account appear here." />
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} className="border-l-2 border-surface-border pl-3">
                      <p className="text-sm">{n.body}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {n.authorName} · {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-zinc-500 mt-3">
                Notes are visible to staff only and are never shown to the player.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/*
        One dialog serves all three actions. ConfirmDialog collects the mandatory
        reason itself, so no action can reach the API without one to log.
      */}
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={(reason) => {
          // TODO: PATCH /admin/users/:id/status { status, reason }
          void reason;
          setPending(null);
        }}
        title={
          pending === 'suspend'
            ? 'Suspend user?'
            : pending === 'activate'
              ? 'Reactivate user?'
              : 'Enforce self-exclusion?'
        }
        description={
          pending === 'activate'
            ? 'The account regains access immediately.'
            : 'All active sessions are signed out immediately.'
        }
        consequences={
          pending === 'exclude'
            ? [
                'The player cannot sign in until the exclusion period ends.',
                'Staff cannot lift an exclusion early — this is deliberate.',
              ]
            : ['The reason you give is written to the audit log and cannot be edited later.']
        }
        confirmLabel={pending === 'activate' ? 'Activate' : 'Confirm'}
        tone={pending === 'activate' ? 'default' : 'danger'}
        reasonLabel="Reason (required)"
        reasonPlaceholder="Explain why you are taking this action…"
      />
    </div>
  );
}
