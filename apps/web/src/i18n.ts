import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

import type { Locale } from '@/types';

export const LOCALES: readonly Locale[] = ['en', 'hi'] as const;
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

function isLocale(value: string | undefined | null): value is Locale {
  return value !== undefined && value !== null && (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the active locale.
 *
 * There is no `[locale]` route segment — the app is a single URL space and
 * the player's language is a preference, so it is read from a cookie first
 * and falls back to the browser's `Accept-Language`.
 */
export function resolveLocale(): Locale {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const acceptLanguage = headers().get('accept-language') ?? '';
  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim().slice(0, 2).toLowerCase())
    .find(isLocale);

  return preferred ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = resolveLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'Asia/Kolkata',
    now: new Date(),
  };
});
