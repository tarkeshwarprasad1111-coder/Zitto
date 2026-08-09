import Link from 'next/link';

import { ZittoLogo } from '@/components/layout/top-bar';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-safe">
      <header className="flex items-center justify-center pt-safe">
        <Link
          href="/"
          className="mt-6 rounded-lg px-2 py-1 focus-visible:ring-2 focus-visible:ring-gold-400"
          aria-label="Zitto home"
        >
          <ZittoLogo className="text-2xl" />
        </Link>
      </header>

      <main id="main-content" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8">
        {children}
      </main>

      <footer className="pb-safe">
        <p className="px-6 pb-6 text-center text-2xs leading-relaxed text-surface-muted">
          Zitto uses virtual coins with no cash value. 18+ only.
        </p>
      </footer>
    </div>
  );
}
