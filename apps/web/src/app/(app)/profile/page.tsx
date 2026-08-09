'use client';

import { useState } from 'react';
import { User, Shield, Clock, LogOut } from 'lucide-react';
import Link from 'next/link';
import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth-store';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <User className="h-5 w-5 text-gold-500" />
          Profile
        </h1>
      </PageSection>

      {/* Avatar + name */}
      <PageSection>
        <div className="flex flex-col items-center gap-3">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-dragon-600 to-tiger-500 flex items-center justify-center text-3xl font-bold text-white select-none">
            {(user?.displayName ?? 'P')[0]?.toUpperCase()}
          </div>
          {editing ? (
            <div className="flex gap-2 w-full max-w-xs">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="flex-1" />
              <Button size="sm" onClick={() => setEditing(false)}>Save</Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-display text-xl font-bold">{user?.displayName ?? 'Player'}</p>
              <p className="text-sm text-surface-muted">{user?.email ?? user?.mobile}</p>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="mt-1">Edit name</Button>
            </div>
          )}
          <div className="flex gap-2">
            <Badge variant="default" className="bg-emerald-600">Verified</Badge>
            <Badge variant="default" className="bg-blue-600">Player</Badge>
          </div>
        </div>
      </PageSection>

      {/* Quick links */}
      <PageSection>
        <div className="space-y-2">
          {[
            { href: '/settings', label: 'Settings', icon: User },
            { href: '/settings/security', label: 'Security & Sessions', icon: Shield },
            { href: '/settings/responsible-gaming', label: 'Responsible Gaming', icon: Clock },
            { href: '/support', label: 'Support', icon: User },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="hover:bg-surface-card/80 transition-colors cursor-pointer">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <span className="flex items-center gap-3 text-sm">
                    <Icon className="h-4 w-4 text-surface-muted" />
                    {label}
                  </span>
                  <span className="text-surface-muted">›</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </PageSection>

      {/* Logout */}
      <PageSection>
        <Button variant="destructive" className="w-full" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Log Out
        </Button>
      </PageSection>
    </PageContainer>
  );
}
