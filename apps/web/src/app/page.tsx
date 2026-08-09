import {
  BarChart3,
  Coins,
  Equal,
  Eye,
  Layers,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PlayingCard } from '@/components/game/playing-card';
import { ZittoLogo } from '@/components/layout/top-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { INDEPENDENCE_DISCLAIMER, type PlayingCardData } from '@/types';

export const metadata: Metadata = {
  title: 'Zitto — Dragon Tiger, with the numbers shown',
  description:
    'Dragon Tiger played entirely with virtual coins. Every statistic is shown with its sample size, rolling window, method and last-updated time.',
};

// MOCK: illustrative cards for the hero. Replace with a live demo round.
const HERO_DRAGON: PlayingCardData = { rank: 'K', suit: 'hearts', value: 13 };
const HERO_TIGER: PlayingCardData = { rank: '9', suit: 'spades', value: 9 };

const RULES = [
  {
    icon: Layers,
    title: 'Two cards, one comparison',
    body: 'A single card goes to Dragon and a single card to Tiger. Nothing else is dealt — no draws, no extra hands.',
  },
  {
    icon: BarChart3,
    title: 'Ace is low, King is high',
    body: 'Ranks run Ace (1), 2 through 10, Jack (11), Queen (12), King (13). Suits are ignored entirely.',
  },
  {
    icon: Equal,
    title: 'Equal ranks are a Tie',
    body: 'If both cards share the same rank, the round is a Tie regardless of suit.',
  },
  {
    icon: Timer,
    title: 'Choose before the cards are drawn',
    body: 'You pick Dragon, Tiger or Tie during the betting window. Once it closes, the round is settled by the server.',
  },
] as const;

const PAYOUTS = [
  {
    selection: 'Dragon',
    pays: '1:1',
    note: 'Dragon holds the higher card',
    accent: 'text-dragon-400',
  },
  {
    selection: 'Tiger',
    pays: '1:1',
    note: 'Tiger holds the higher card',
    accent: 'text-tiger-400',
  },
  {
    selection: 'Tie',
    pays: '8:1',
    note: 'Both cards share a rank',
    accent: 'text-gold-400',
  },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-surface-border/60 bg-surface-bg/80 pt-safe backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <ZittoLogo />
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="sm">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 pb-16 px-safe">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 pb-12 pt-10 text-center">
          <Badge variant="gold" size="sm" dot>
            Virtual coins only — no cash value
          </Badge>

          <h1 className="max-w-xl font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Dragon Tiger,
            <br />
            <span className="text-gradient-dragon-tiger">with the numbers shown</span>
          </h1>

          <p className="max-w-md text-base leading-relaxed text-surface-subtle">
            One card each. The higher card wins. Every round is independent — and every statistic on
            Zitto arrives with the data behind it.
          </p>

          {/* Dragon vs Tiger visual */}
          <div className="flex items-center justify-center gap-4 py-2 sm:gap-8">
            <div className="flex flex-col items-center gap-2">
              <PlayingCard card={HERO_DRAGON} size="lg" side="DRAGON" isWinner />
              <span className="text-xs font-bold uppercase tracking-widest text-dragon-400">
                Dragon
              </span>
            </div>

            <span
              aria-hidden="true"
              className="font-display text-2xl font-bold text-surface-muted sm:text-3xl"
            >
              vs
            </span>

            <div className="flex flex-col items-center gap-2">
              <PlayingCard card={HERO_TIGER} size="lg" side="TIGER" />
              <span className="text-xs font-bold uppercase tracking-widest text-tiger-400">
                Tiger
              </span>
            </div>
          </div>

          <p className="text-sm text-surface-muted">
            King beats Nine — <span className="font-semibold text-dragon-400">Dragon wins</span>{' '}
            this round.
          </p>

          <div className="flex w-full max-w-xs flex-col gap-2.5 pt-2">
            <Link href="/register" className="w-full">
              <Button variant="primary" size="lg" fullWidth>
                Create free account
              </Button>
            </Link>
            <div className="flex gap-2.5">
              <Link href="/login" className="flex-1">
                <Button variant="outline" size="lg" fullWidth>
                  Log in
                </Button>
              </Link>
              <Link href="/game/practice-01" className="flex-1">
                <Button variant="ghost" size="lg" fullWidth>
                  Try demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-4 py-10" aria-labelledby="how-it-works">
          <div className="text-center">
            <h2 id="how-it-works" className="font-display text-2xl font-bold">
              How Dragon Tiger works
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-surface-muted">
              The simplest card game there is. Two cards are dealt — one to Dragon, one to Tiger.
              The higher card wins.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {RULES.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Card className="h-full p-4">
                  <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated text-gold-400">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-surface-fg">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-surface-muted">{body}</p>
                </Card>
              </li>
            ))}
          </ul>

          {/* Card comparison example */}
          <Card variant="flat" className="p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-muted">
              Comparison examples
            </h3>
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-center gap-3">
                <PlayingCard card={{ rank: 'Q', suit: 'diamonds', value: 12 }} size="sm" />
                <span className="text-surface-muted">vs</span>
                <PlayingCard card={{ rank: '7', suit: 'clubs', value: 7 }} size="sm" />
                <span className="ml-auto text-right text-dragon-400">
                  Queen (12) beats Seven (7)
                  <span className="block text-2xs text-surface-muted">Dragon wins</span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <PlayingCard card={{ rank: 'A', suit: 'spades', value: 1 }} size="sm" />
                <span className="text-surface-muted">vs</span>
                <PlayingCard card={{ rank: '5', suit: 'hearts', value: 5 }} size="sm" />
                <span className="ml-auto text-right text-tiger-400">
                  Five (5) beats Ace (1)
                  <span className="block text-2xs text-surface-muted">Tiger wins — Ace is low</span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <PlayingCard card={{ rank: '8', suit: 'hearts', value: 8 }} size="sm" />
                <span className="text-surface-muted">vs</span>
                <PlayingCard card={{ rank: '8', suit: 'clubs', value: 8 }} size="sm" />
                <span className="ml-auto text-right text-gold-400">
                  Same rank
                  <span className="block text-2xs text-surface-muted">Tie — suits are ignored</span>
                </span>
              </li>
            </ul>
          </Card>
        </section>

        {/* Payout table */}
        <section className="flex flex-col gap-3 py-10" aria-labelledby="payouts">
          <h2 id="payouts" className="text-center font-display text-2xl font-bold">
            Payouts
          </h2>
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Payout multipliers for each selection in Dragon Tiger.
              </caption>
              <thead>
                <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-surface-muted">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Selection
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Pays
                  </th>
                </tr>
              </thead>
              <tbody>
                {PAYOUTS.map(({ selection, pays, note, accent }) => (
                  <tr key={selection} className="border-b border-surface-border/50 last:border-0">
                    <th scope="row" className="px-4 py-3 font-normal">
                      <span className={`block font-semibold ${accent}`}>{selection}</span>
                      <span className="text-xs text-surface-muted">{note}</span>
                    </th>
                    <td className="px-4 py-3 text-right font-display text-lg font-bold tabular-nums text-surface-fg">
                      {pays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-center text-xs text-surface-muted">
            Payouts are expressed in virtual coins. A 1:1 selection returns your stake plus an equal
            amount; 8:1 returns your stake plus eight times it.
          </p>
        </section>

        {/* Analytics positioning */}
        <section className="py-10" aria-labelledby="analytics-intro">
          <Card variant="glass" className="p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 text-gold-400">
              <Eye size={20} aria-hidden="true" />
            </div>
            <h2 id="analytics-intro" className="font-display text-xl font-bold">
              Statistics, not tips
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-surface-subtle">
              Zitto shows outcome frequencies, streaks and model estimates — each one presented with
              its sample size, rolling window, calculation method and last-updated time. Nothing is
              hidden behind a paywall or a confidence score you cannot inspect.
            </p>
            <p className="mt-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3 text-xs font-medium leading-relaxed text-gold-200">
              {INDEPENDENCE_DISCLAIMER}
            </p>
          </Card>
        </section>

        {/* Virtual coin + responsible gaming */}
        <section className="grid gap-3 py-10 sm:grid-cols-2" aria-labelledby="safety">
          <h2 id="safety" className="sr-only">
            Virtual coins and responsible gaming
          </h2>

          <Card className="p-5">
            <CardHeader className="p-0">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated text-gold-400">
                <Coins size={20} aria-hidden="true" />
              </div>
              <CardTitle as="h3">Virtual coins only</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <CardDescription>
                Zitto is played entirely with virtual coins. Coins have no cash value and cannot be
                bought, sold, withdrawn, or exchanged for money or anything of monetary value.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="p-5">
            <CardHeader className="p-0">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated text-tiger-400">
                <ShieldCheck size={20} aria-hidden="true" />
              </div>
              <CardTitle as="h3">Play responsibly</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <CardDescription>
                This is entertainment, not income. Set a session limit, take breaks, and stop when it
                stops being fun. You must be 18 or older to create an account.
              </CardDescription>
              <Link
                href="/responsible-gaming"
                className="mt-3 inline-block text-sm font-semibold text-gold-400 underline-offset-2 hover:underline"
              >
                Responsible gaming
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* Final CTA */}
        <section className="flex flex-col items-center gap-3 py-8 text-center">
          <h2 className="font-display text-xl font-bold">Ready to play?</h2>
          <div className="flex w-full max-w-xs flex-col gap-2.5">
            <Link href="/register" className="w-full">
              <Button variant="primary" size="lg" fullWidth>
                Create free account
              </Button>
            </Link>
            <Link href="/game/practice-01" className="w-full">
              <Button variant="outline" size="lg" fullWidth>
                Try the demo first
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-surface-border bg-surface-card/40 pb-safe">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-6 text-center">
          <ZittoLogo className="text-base" />
          <p className="text-xs leading-relaxed text-surface-muted">
            Zitto uses virtual coins with no cash value. 18+ only. Every round is independent —
            historical patterns do not determine future outcomes.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
            <Link href="/terms" className="text-surface-subtle hover:text-surface-fg">
              Terms
            </Link>
            <Link href="/privacy" className="text-surface-subtle hover:text-surface-fg">
              Privacy
            </Link>
            <Link href="/responsible-gaming" className="text-surface-subtle hover:text-surface-fg">
              Responsible gaming
            </Link>
            <Link href="/support" className="text-surface-subtle hover:text-surface-fg">
              Support
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
