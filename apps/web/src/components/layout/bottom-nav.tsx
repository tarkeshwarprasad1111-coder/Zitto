'use client';

import { BarChart3, Gift, Home, Spade, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  /** Extra path prefixes that should also light this tab. */
  matches?: string[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/game', label: 'Game', icon: Spade },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/rewards', label: 'Rewards', icon: Gift },
  { href: '/profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface-card/95 pb-safe backdrop-blur-lg"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {NAV_ITEMS.map(({ href, label, icon: Icon, matches }) => {
          const isActive =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (matches?.some((prefix) => pathname.startsWith(prefix)) ?? false);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 px-1 py-2',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-400',
                  isActive ? 'text-gold-400' : 'text-surface-muted hover:text-surface-subtle',
                )}
              >
                {/* Active indicator is a bar as well as a colour change, so the
                    current tab is not signalled by colour alone. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-4 top-0 h-0.5 rounded-full transition-opacity duration-150',
                    isActive ? 'bg-gold-400 opacity-100' : 'opacity-0',
                  )}
                />
                <Icon size={21} aria-hidden="true" strokeWidth={isActive ? 2.4 : 1.9} />
                <span className="text-2xs font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
