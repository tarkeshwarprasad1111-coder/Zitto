import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Coins, ISODateString, Outcome, PlayingCardData } from '@/types';

/**
 * Merge conditional class names, resolving Tailwind conflicts so the last
 * utility wins (`cn('p-2', 'p-4')` → `'p-4'`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ */
/* Numbers & coins                                                     */
/* ------------------------------------------------------------------ */

/**
 * Format a virtual coin amount for display.
 *
 * Coins are integers and carry no cash value, so no currency symbol is ever
 * attached. Large values are abbreviated to keep the top bar readable on a
 * 320px screen.
 */
export function formatCoins(
  amount: Coins | null | undefined,
  options: { compact?: boolean; signed?: boolean } = {},
): string {
  const { compact = false, signed = false } = options;

  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '—';
  }

  const rounded = Math.trunc(amount);
  const abs = Math.abs(rounded);
  const sign = signed && rounded > 0 ? '+' : rounded < 0 ? '-' : '';

  if (compact && abs >= 1_000) {
    const formatted = new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(abs);
    return `${sign}${formatted}`;
  }

  return `${sign}${new Intl.NumberFormat('en-IN').format(abs)}`;
}

/** Format a 0–1 ratio as a percentage string, e.g. `0.4823` → `48.2%`. */
export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

/** Format a payout multiplier as odds, e.g. `8` → `8:1`. */
export function formatOdds(multiplier: number): string {
  return `${multiplier}:1`;
}

/** Clamp `value` into the inclusive range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

function toDate(input: ISODateString | Date | number | null | undefined): Date | null {
  if (input === null || input === undefined) return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format an absolute date. Defaults to a compact, unambiguous form
 * (`9 Aug 2026, 10:24`) that reads the same in en and hi locales.
 */
export function formatDate(
  input: ISODateString | Date | number | null | undefined,
  options: { includeTime?: boolean; locale?: string } = {},
): string {
  const { includeTime = true, locale = 'en-IN' } = options;
  const date = toDate(input);
  if (!date) return '—';

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(date);
}

/** Format just the clock time, e.g. `10:24`. */
export function formatTime(
  input: ISODateString | Date | number | null | undefined,
  locale = 'en-IN',
): string {
  const date = toDate(input);
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

/**
 * Format a timestamp relative to now, e.g. `2 minutes ago`, `in 3 days`.
 * Anything under 45 seconds collapses to `just now`.
 */
export function formatRelativeTime(
  input: ISODateString | Date | number | null | undefined,
  options: { locale?: string; now?: Date } = {},
): string {
  const { locale = 'en', now = new Date() } = options;
  const date = toDate(input);
  if (!date) return '—';

  const deltaSeconds = (date.getTime() - now.getTime()) / 1000;
  const absSeconds = Math.abs(deltaSeconds);

  if (absSeconds < 45) return 'just now';

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (absSeconds >= secondsInUnit) {
      const value = Math.round(deltaSeconds / secondsInUnit);
      return formatter.format(value, unit);
    }
  }

  return 'just now';
}

/** Format a millisecond duration as `m:ss`, e.g. `95000` → `1:35`. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Seconds remaining until `target`, floored at 0. */
export function secondsUntil(
  target: ISODateString | Date | null | undefined,
  now: Date = new Date(),
): number {
  const date = toDate(target);
  if (!date) return 0;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000));
}

/* ------------------------------------------------------------------ */
/* Dragon Tiger helpers                                                */
/* ------------------------------------------------------------------ */

const OUTCOME_SHORT: Record<Outcome, string> = {
  DRAGON: 'D',
  TIGER: 'T',
  TIE: '=',
};

/** Single-character badge label for an outcome. */
export function outcomeShortLabel(outcome: Outcome): string {
  return OUTCOME_SHORT[outcome];
}

/** Title-case label for an outcome, e.g. `DRAGON` → `Dragon`. */
export function outcomeLabel(outcome: Outcome): string {
  return outcome.charAt(0) + outcome.slice(1).toLowerCase();
}

/**
 * Tailwind class bundles per outcome, so Dragon is red, Tiger is blue and
 * Tie is gold everywhere without each component re-deriving it.
 */
export const OUTCOME_STYLES: Record<
  Outcome,
  { text: string; bg: string; border: string; solid: string; dot: string; glow: string }
> = {
  DRAGON: {
    text: 'text-dragon-400',
    bg: 'bg-dragon-500/12',
    border: 'border-dragon-500/40',
    solid: 'bg-dragon-600',
    dot: 'bg-dragon-500',
    glow: 'shadow-glow-dragon',
  },
  TIGER: {
    text: 'text-tiger-400',
    bg: 'bg-tiger-500/12',
    border: 'border-tiger-500/40',
    solid: 'bg-tiger-600',
    dot: 'bg-tiger-500',
    glow: 'shadow-glow-tiger',
  },
  TIE: {
    text: 'text-gold-400',
    bg: 'bg-gold-500/12',
    border: 'border-gold-500/40',
    solid: 'bg-gold-500',
    dot: 'bg-gold-500',
    glow: 'shadow-glow-gold',
  },
};

const RANK_VALUES: Record<PlayingCardData['rank'], number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
};

/** Numeric comparison value for a rank. Ace is low (1), King is high (13). */
export function rankValue(rank: PlayingCardData['rank']): number {
  return RANK_VALUES[rank];
}

/** Decide a round from the two drawn cards. Equal ranks are a Tie. */
export function resolveOutcome(dragon: PlayingCardData, tiger: PlayingCardData): Outcome {
  if (dragon.value > tiger.value) return 'DRAGON';
  if (tiger.value > dragon.value) return 'TIGER';
  return 'TIE';
}

/** Accessible description of a card, for screen readers. */
export function describeCard(card: PlayingCardData): string {
  const rankNames: Record<PlayingCardData['rank'], string> = {
    A: 'Ace',
    '2': 'Two',
    '3': 'Three',
    '4': 'Four',
    '5': 'Five',
    '6': 'Six',
    '7': 'Seven',
    '8': 'Eight',
    '9': 'Nine',
    '10': 'Ten',
    J: 'Jack',
    Q: 'Queen',
    K: 'King',
  };
  return `${rankNames[card.rank]} of ${card.suit}`;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Initials for an avatar fallback, e.g. `Ravi Kumar` → `RK`. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Mask an email or mobile for display, e.g. `ra***@mail.com`. */
export function maskContact(value: string): string {
  if (value.includes('@')) {
    const [local = '', domain = ''] = value.split('@');
    const head = local.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }
  const tail = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${tail}`;
}

/** Crypto-safe-enough id for client-side keys and idempotency keys. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Time-of-day greeting key. */
export function greetingKey(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Password strength on a 0–4 scale, with a matching label. */
export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hints: string[];
} {
  const hints: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else hints.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;
  else if (password.length >= 8) hints.push('12+ characters is stronger');

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else hints.push('Mix upper and lower case');

  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  else hints.push('Add a number and a symbol');

  const clamped = clamp(score, 0, 4) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;

  return { score: clamped, label: labels[clamped] ?? 'Very weak', hints };
}
