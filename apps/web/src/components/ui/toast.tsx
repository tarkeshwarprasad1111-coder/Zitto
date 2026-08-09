'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { cn, uuid } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** Milliseconds before auto-dismiss. `0` keeps it until dismissed. */
  duration: number;
  action?: { label: string; onClick: () => void };
}

export type ToastInput = Omit<Partial<Toast>, 'id'> & { title: string };

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; accent: string; iconColor: string }
> = {
  default: {
    icon: <Info size={18} aria-hidden="true" />,
    accent: 'border-surface-border',
    iconColor: 'text-surface-subtle',
  },
  success: {
    icon: <CheckCircle2 size={18} aria-hidden="true" />,
    accent: 'border-success-500/45',
    iconColor: 'text-success-400',
  },
  warning: {
    icon: <AlertTriangle size={18} aria-hidden="true" />,
    accent: 'border-warning-500/45',
    iconColor: 'text-warning-400',
  },
  error: {
    icon: <XCircle size={18} aria-hidden="true" />,
    accent: 'border-danger-500/45',
    iconColor: 'text-danger-400',
  },
  info: {
    icon: <Info size={18} aria-hidden="true" />,
    accent: 'border-tiger-500/45',
    iconColor: 'text-tiger-300',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput): string => {
      const id = uuid();
      const next: Toast = {
        id,
        title: input.title,
        variant: input.variant ?? 'default',
        duration: input.duration ?? 4_500,
        ...(input.description ? { description: input.description } : {}),
        ...(input.action ? { action: input.action } : {}),
      };

      setToasts((current) => [...current, next].slice(-MAX_VISIBLE));

      if (next.duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), next.duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  const dismissAll = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setToasts([]);
  }, []);

  // Clear pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss, dismissAll }),
    [toasts, toast, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-safe"
    >
      <div className="flex w-full max-w-sm flex-col gap-2 pt-3">
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const config = variantConfig[item.variant];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                role={item.variant === 'error' ? 'alert' : 'status'}
                aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
                className={cn(
                  'pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-surface-elevated/95 p-3.5 shadow-elevated backdrop-blur-md',
                  config.accent,
                )}
              >
                <span className={cn('mt-0.5 shrink-0', config.iconColor)}>{config.icon}</span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-surface-fg">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-surface-muted">
                      {item.description}
                    </p>
                  ) : null}
                  {item.action ? (
                    <button
                      type="button"
                      onClick={() => {
                        item.action?.onClick();
                        onDismiss(item.id);
                      }}
                      className="mt-2 text-xs font-semibold text-gold-400 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-gold-400"
                    >
                      {item.action.label}
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  aria-label="Dismiss notification"
                  className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-surface-muted transition-colors hover:bg-surface-overlay hover:text-surface-fg focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}

/** Access the toast queue. Must be called under a {@link ToastProvider}. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return context;
}
