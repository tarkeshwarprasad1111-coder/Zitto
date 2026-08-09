'use client';

import { ScrollText, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MOCK_AUDIT_LOGS as mockAuditLogs } from '@/lib/mock-data';

/**
 * Audit log is read-only by design.
 * No edit or delete affordances exist on this page — that is intentional.
 */
export default function AuditLogsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-brand-400" />
          Audit Logs
        </h1>
        <div className="flex items-center gap-2 mt-2 text-sm text-zinc-400 bg-zinc-800/50 rounded-lg px-3 py-2 w-fit">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Audit logs are immutable. Records cannot be edited or deleted.
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Filter by actor…" className="w-48" />
        <Input placeholder="Filter by action…" className="w-48" />
        <Input type="date" className="w-40" />
        <Input type="date" className="w-40" />
      </div>

      {mockAuditLogs.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-8 w-8" />} title="No audit logs" description="Actions will appear here." />
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Time</TableHead>
                <TableHead scope="col">Actor</TableHead>
                <TableHead scope="col">Action</TableHead>
                <TableHead scope="col">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAuditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-zinc-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-zinc-700 text-xs">{log.actorType}</Badge>
                      <span className="text-xs text-zinc-300 font-mono">{log.actorId?.slice(0, 8)}…</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-xs font-mono text-brand-300">{log.action}</span></TableCell>
                  <TableCell>
                    <div className="text-xs text-zinc-400">
                      <span className="text-zinc-500">{log.targetType}</span>
                      {log.targetId && <span className="ml-1 font-mono">{log.targetId.slice(0, 8)}…</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
