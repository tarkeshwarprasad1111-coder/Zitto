'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { useState } from 'react';

import { OfflineBanner } from '@/components/ui/offline-banner';
import { ToastProvider } from '@/components/ui/toast';
import { createQueryClient } from '@/lib/query-client';

export interface ProvidersProps {
  locale: string;
  messages: AbstractIntlMessages;
  timeZone?: string;
  children: React.ReactNode;
}

/**
 * Client-side provider stack.
 *
 * The QueryClient is created inside `useState` so each browser session gets
 * exactly one instance, and server renders never share a cache between
 * requests.
 */
export function Providers({ locale, messages, timeZone = 'Asia/Kolkata', children }: ProvidersProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <OfflineBanner />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
