'use client';

import { Users, Gamepad2, Ticket, AlertCircle, Coins, Activity } from 'lucide-react';
import { StatTile } from '@/components/ui/stat-tile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MOCK_DASHBOARD as mockDashboard, MOCK_AUDIT_LOGS } from '@/lib/mock-data';

const mockRecentActivity = MOCK_AUDIT_LOGS.slice(0, 5).map((l) => ({
  description: `${l.action} on ${l.targetType}`,
  time: new Date(l.createdAt).toLocaleTimeString(),
}));

export default function DashboardPage() {
  const d = mockDashboard;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Platform overview — {new Date().toLocaleDateString()}</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Users" value={d.totalUsers.toLocaleString()} icon={<Users className="h-4 w-4" />} />
        <StatTile label="Active Today" value={d.activeToday.toLocaleString()} icon={<Gamepad2 className="h-4 w-4" />} />
        <StatTile label="Open Tickets" value={d.openTickets.toString()} icon={<Ticket className="h-4 w-4" />} tone={d.openTickets > 10 ? 'warning' : 'default'} />
        <StatTile label="Fraud Alerts" value={d.fraudAlerts.toString()} icon={<AlertCircle className="h-4 w-4" />} tone={d.fraudAlerts > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { service: 'API', status: 'healthy' },
              { service: 'Database', status: 'healthy' },
              { service: 'Redis', status: 'healthy' },
              { service: 'Game Engine', status: 'healthy' },
              { service: 'Realtime', status: 'healthy' },
            ].map(({ service, status }) => (
              <div key={service} className="flex items-center justify-between">
                <span className="text-sm">{service}</span>
                <Badge className={status === 'healthy' ? 'bg-emerald-700' : 'bg-red-700'}>
                  {status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockRecentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-sm py-1 border-b border-zinc-800 last:border-0">
                <AlertCircle className="h-3.5 w-3.5 text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-zinc-200">{a.description}</p>
                  <p className="text-xs text-zinc-500">{a.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
