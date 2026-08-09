'use client';

import { useState } from 'react';
import { Search, UserX, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { MOCK_USERS as mockUsers } from '@/lib/mock-data';
import Link from 'next/link';

type StatusFilter = 'all' | 'active' | 'suspended' | 'self_excluded';

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const loading = false;

  const filtered = mockUsers.filter((u) => {
    // `email` is nullable — roughly one in seven accounts registered by mobile only.
    const needle = q.toLowerCase();
    const matchQ =
      !q ||
      (u.email?.toLowerCase().includes(needle) ?? false) ||
      u.displayName.toLowerCase().includes(needle);
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchQ && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search email or name…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'suspended', 'self_excluded'] as StatusFilter[]).map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'primary' : 'outline'} onClick={() => setStatusFilter(s)} className="capitalize text-xs">
              {s.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No users found" description="Try a different search." />
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">User</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Joined</TableHead>
                <TableHead scope="col"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div>
                      <Link href={`/dashboard/users/${u.id}`} className="font-medium text-brand-400 hover:underline">
                        {u.displayName}
                      </Link>
                      {/* Mobile-only accounts have no email — show the gap rather than an empty row. */}
                      <p className="text-xs text-zinc-400">{u.email ?? 'mobile only'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      u.status === 'active' ? 'bg-emerald-700' :
                      u.status === 'suspended' ? 'bg-red-700' : 'bg-zinc-600'
                    }>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Link href={`/dashboard/users/${u.id}`}>
                        <Button size="sm" variant="ghost">View</Button>
                      </Link>
                      {u.status === 'active' ? (
                        <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setSuspendTarget(u.id)}>
                          <UserX className="h-3.5 w-3.5 mr-1" />
                          Suspend
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-emerald-400">
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Activate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/*
        ConfirmDialog supplies the mandatory reason field itself — it enforces a
        minimum length and hands the trimmed text to onConfirm. Rolling our own
        textarea here would duplicate that and, worse, let the two validations drift.
      */}
      <ConfirmDialog
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={(reason) => {
          // TODO: PATCH /admin/users/:id/status { status: 'suspended', reason }
          void reason;
          setSuspendTarget(null);
        }}
        title="Suspend user?"
        description="This will immediately revoke all active sessions. The user will see a suspension notice."
        consequences={[
          'All active sessions are signed out immediately.',
          'The reason you give is written to the audit log and cannot be edited later.',
        ]}
        confirmLabel="Suspend"
        tone="danger"
        reasonLabel="Reason (required)"
        reasonPlaceholder="Describe the reason for suspension…"
      />
    </div>
  );
}
