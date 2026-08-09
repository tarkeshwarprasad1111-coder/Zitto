import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { getLocale, getMessages } from 'next-intl/server';

import { Providers } from '@/app/providers';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Zitto — Dragon Tiger analytics',
    template: '%s · Zitto',
  },
  description:
    'Play Dragon Tiger with virtual coins and see the statistics behind every round — sample sizes, rolling windows and methods, always shown.',
  applicationName: 'Zitto',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Zitto — Dragon Tiger analytics',
    description:
      'Dragon Tiger played with virtual coins, with every statistic shown alongside the data it came from.',
    siteName: 'Zitto',
    type: 'website',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${outfit.variable} dark`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <a
          href="#main-content"
          className="sr-only sr-only-focusable absolute left-3 top-3 z-[80] rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-bg"
        >
          Skip to content
        </a>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
