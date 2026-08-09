import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Coins, ISODateString } from '@/types';

/**
 * Merge conditional class names, resolving Tailwind conflicts so the last
 * utility wins (`cn('p-2', 'p-4')` → `'p-4'`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ */
/* Coins & numbers                                                     */
/* ------------------------------------------------------------------ */

const COIN_LOCALE = 'en-IN';

/**
 * Parse any coin wire value into a `bigint`.
 *
 * Platform-wide totals (coins in circulation, lifetime wagered) routinely
 * exceed `Number.MAX_SAFE_INTEGER`, so the API sends them as decimal strings.
 * Going through `Number` first would silently round them.
 */
function toBigInt(value: Coins): bigint | null {
  if (typeof value === 'bigint') return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return BigInt(Math.trunc(value));
  }

  const trimmed = value.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) {
    // Tolerate a decimal string by truncating the fraction — coins are whole.
    const match = /^([+-]?\d+)(?:\.\d+)?$/.exec(trimmed);
    if (!match?.[1]) return null;
    return BigInt(match[1]);
  }

  return BigInt(trimmed);
}

/**
 * Format a virtual coin amount for display.
 *
 * Coins carry no cash value, so no currency symbol is ever attached. Values are
 * grouped with `Intl.NumberFormat` and stay exact for arbitrarily large
 * balances because the digits are grouped as a string, never as a float.
 */
export function formatCoins(
  amount: Coins | null | undefined,
  options: { compact?: boolean; signed?: boolean } = {},
): string {
  const { compact = false, signed = false } = options;

  if (amount === null || amount === undefined) return '—';

  const value = toBigInt(amount);
  if (value === null) return '—';

  const negative = value < 0n;
  const abs = negative ? -value : value;
  const sign = negative ? '-' : signed && abs > 0n ? '+' : '';

  if (compact && abs >= 1_000n) {
    // Compact notation is inherently lossy, so a Number cast is safe here even
    // for very large values — only the leading significant digits are shown.
    const approx = Number(abs);
    const formatted = new Intl.NumberFormat(COIN_LOCALE, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(approx);
    return `${sign}${formatted}`;
  }

  return `${sign}${new Intl.NumberFormat(COIN_LOCALE).format(abs)}`;
}

/** Format a plain count, e.g. `12480` → `12,480`. */
export function formatNumber(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(COIN_LOCALE, {
    ...(compact ? { notation: 'compact' as const, maximumFractionDigits: 1 } : {}),
  }).format(value);
}

/** Format a 0–1 ratio as a percentage, e.g. `0.4823` → `48.2%`. */
export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 1,
  signed = false,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(fractionDigits)}%`;
}

/** Format a millisecond duration for config forms, e.g. `15000` → `15.0s`. */
export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
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

/** Date only, e.g. `9 Aug 2026`. */
export function formatDate(
  input: ISODateString | Date | number | null | undefined,
  locale = 'en-IN',
): string {
  const date = toDate(input);
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Date and time to the second, e.g. `9 Aug 2026, 10:24:07`.
 *
 * Audit and ledger rows need second precision — "10:24" is not enough to order
 * two entries during an incident review.
 */
export function formatDateTime(
  input: ISODateString | Date | number | null | undefined,
  options: { locale?: string; seconds?: boolean } = {},
): string {
  const { locale = 'en-IN', seconds = true } = options;
  const date = toDate(input);
  if (!date) return '—';

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(date);
}

/** Clock time only, e.g. `10:24`. */
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

const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

/** Relative timestamp, e.g. `2 minutes ago`. Under 45s collapses to `just now`. */
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

  for (const entry of RELATIVE_UNITS) {
    const [unit, secondsInUnit] = entry;
    if (absSeconds >= secondsInUnit) {
      return formatter.format(Math.round(deltaSeconds / secondsInUnit), unit);
    }
  }

  return 'just now';
}

/** `YYYY-MM-DD` for `<input type="date">` round-trips. */
export function toDateInputValue(input: ISODateString | Date | null | undefined): string {
  const date = toDate(input);
  if (!date) return '';
  const iso = date.toISOString();
  return iso.slice(0, 10);
}

/** `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">` round-trips. */
export function toDateTimeInputValue(input: ISODateString | Date | null | undefined): string {
  const date = toDate(input);
  if (!date) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/* ------------------------------------------------------------------ */
/* Strings                                                             */
/* ------------------------------------------------------------------ */

/** Shorten to `length` characters, appending an ellipsis when clipped. */
export function truncate(value: string | null | undefined, length = 40): string {
  if (!value) return '—';
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

/** Middle-ellipsis for ids and hashes, e.g. `a1b2c3…9f8e7d`. */
export function truncateMiddle(value: string | null | undefined, head = 8, tail = 6): string {
  if (!value) return '—';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Initials for an avatar fallback, e.g. `Ravi Kumar` → `RK`. */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/** `admin.user.suspend` → `Admin user suspend`. */
export function humanizeAction(action: string): string {
  const spaced = action.replace(/[._-]/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `SELF_EXCLUDED` / `self_excluded` → `Self excluded`. */
export function humanizeEnum(value: string): string {
  const lower = value.replace(/[_-]/g, ' ').toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Crypto-safe-enough id for client keys and idempotency keys. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

/**
 * Escape a CSV cell.
 *
 * Values starting with `=`, `+`, `-` or `@` are prefixed with a quote so a
 * spreadsheet treats them as text rather than a formula (CSV injection).
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Serialise rows to CSV using the supplied column order. */
export function toCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: ReadonlyArray<{ key: keyof T & string; header: string }>,
): string {
  const head = columns.map((column) => csvCell(column.header)).join(',');
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(','));
  return [head, ...body].join('\r\n');
}

/** Trigger a browser download for generated text. No-op during SSR. */
export function downloadTextFile(filename: string, contents: string, mimeType = 'text/csv'): void {
  if (typeof document === 'undefined') return;

  // A BOM makes Excel read the file as UTF-8 rather than the system codepage.
  const blob = new Blob([`﻿${contents}`], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
