'use client';

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
  /** Shorthand helpers. Errors stick around until dismissed. */
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 4;

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; accent: string; iconColor: string }
> = {
  default: {
    icon: <Info size={16} aria-hidden="true" />,
    accent: 'border-surface-border',
    iconColor: 'text-surface-subtle',
  },
  success: {
    icon: <CheckCircle2 size={16} aria-hidden="true" />,
    accent: 'border-success-500/40',
    iconColor: 'text-success-400',
  },
  warning: {
    icon: <AlertTriangle size={16} aria-hidden="true" />,
    accent: 'border-warning-500/40',
    iconColor: 'text-warning-400',
  },
  error: {
    icon: <XCircle size={16} aria-hidden="true" />,
    accent: 'border-danger-500/40',
    iconColor: 'text-danger-400',
  },
  info: {
    icon: <Info size={16} aria-hidden="true" />,
    accent: 'border-brand-500/40',
    iconColor: 'text-brand-300',
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
      const variant = input.variant ?? 'default';
      const next: Toast = {
        id,
        title: input.title,
        variant,
        // An admin who missed an error message has no way to recover it, so
        // errors never auto-dismiss.
        duration: input.duration ?? (variant === 'error' ? 0 : 4_500),
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

  const success = useCallback(
    (title: string, description?: string) =>
      toast({ title, variant: 'success', ...(description ? { description } : {}) }),
    [toast],
  );

  const error = useCallback(
    (title: string, description?: string) =>
      toast({ title, variant: 'error', ...(description ? { description } : {}) }),
    [toast],
  );

  const dismissAll = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, toast, success, error, dismiss, dismissAll }),
    [toasts, toast, success, error, dismiss, dismissAll],
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
      className="pointer-events-none fixed bottom-0 right-0 z-[70] flex max-w-full flex-col items-end gap-2 p-4"
    >
      {toasts.map((item) => {
        const config = variantConfig[item.variant];
        return (
          <div
            key={item.id}
            role={item.variant === 'error' ? 'alert' : 'status'}
            aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto flex w-[22rem] max-w-[calc(100vw-2rem)] animate-slide-down items-start gap-2.5 rounded-lg border bg-surface-overlay p-3 shadow-elevated',
              config.accent,
            )}
          >
            <span className={cn('mt-0.5 shrink-0', config.iconColor)}>{config.icon}</span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-surface-fg">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 break-words text-xs leading-relaxed text-surface-muted">
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
                  className="mt-1.5 text-xs font-semibold text-brand-300 underline-offset-2 hover:underline"
                >
                  {item.action.label}
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss notification"
              className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-surface-muted transition-colors hover:bg-surface-hover hover:text-surface-fg"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
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
