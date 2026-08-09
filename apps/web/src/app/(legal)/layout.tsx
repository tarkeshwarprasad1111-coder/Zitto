import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Shell for the public legal pages.
 *
 * Deliberately outside the `(app)` group: these documents are linked from the
 * landing page and from the registration consent checkbox, so a visitor who has
 * not signed in — and by definition has not yet accepted anything — must be able
 * to read them.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-bg text-surface-fg">
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-surface-muted hover:text-surface-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back
        </Link>

        <article className="prose-zitto mt-6">{children}</article>
      </div>
    </div>
  );
}
