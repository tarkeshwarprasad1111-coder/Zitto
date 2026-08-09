'use client';

import { useState } from 'react';
import { Search, UserX, UserCheck, Coins } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
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
  const [reason, setReason] = useState('');
  const loading = false;

  const filtered = mockUsers.filter((u) => {
    const matchQ = !q || u.email.includes(q) || u.displayName.toLowerCase().includes(q.toLowerCase());
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
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)} className="capitalize text-xs">
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
                <Tr key={u.id}>
                  <TableCell>
                    <div>
                      <Link href={`/dashboard/users/${u.id}`} className="font-medium text-gold-400 hover:underline">
                        {u.displayName}
                      </Link>
                      <p className="text-xs text-zinc-400">{u.email}</p>
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

      {/* Suspend confirm — reason mandatory */}
      <ConfirmDialog
        open={!!suspendTarget}
        onClose={() => { setSuspendTarget(null); setReason(''); }}
        onConfirm={() => { /* TODO: PATCH /admin/users/:id/status */ setSuspendTarget(null); setReason(''); }}
        title="Suspend user?"
        description="This will immediately revoke all active sessions. The user will see a suspension notice."
        confirmLabel="Suspend"
        variant="destructive"
        disabled={!reason.trim()}
      >
        <div className="mt-3">
          <label className="text-sm font-medium block mb-1">Reason (required)</label>
          <textarea
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 text-sm p-2 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-gold-500"
            placeholder="Describe the reason for suspension…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-zinc-500 mt-1">This reason will be written to the audit log.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
