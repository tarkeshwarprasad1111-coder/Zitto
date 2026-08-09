'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface TooltipProps {
  /** Tooltip body. Kept short — long explanations belong in a modal. */
  content: React.ReactNode;
  /** Accessible name for the trigger, e.g. "How this is calculated". */
  label: string;
  children?: React.ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
  panelClassName?: string;
}

/**
 * Tap/hover/focus tooltip.
 *
 * Touch devices get no hover, so the trigger is a real button that toggles on
 * tap and is reachable by keyboard. The content is linked with
 * `aria-describedby` so screen readers announce it with the trigger.
 */
export function Tooltip({
  content,
  label,
  children,
  side = 'top',
  className,
  panelClassName,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-surface-muted transition-colors hover:text-surface-fg focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        {children ?? <HelpCircle size={15} aria-hidden="true" />}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.span
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className={cn(
              'absolute right-0 z-40 w-60 rounded-xl border border-surface-border bg-surface-overlay p-3 text-left text-xs leading-relaxed text-surface-subtle shadow-elevated',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
              panelClassName,
            )}
          >
            {content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
