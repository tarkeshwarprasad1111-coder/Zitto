'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Called with the typed reason once every gate passes. Throw (or reject) to
   * keep the dialog open and surface the failure to the admin.
   */
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  /** What is about to happen, in plain language. */
  description: string;
  /** Extra consequences worth spelling out — who is affected, what is logged. */
  consequences?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'default';
  isSubmitting?: boolean;
  /**
   * When set, the admin must type this string exactly before confirming.
   * Reserved for the highest-consequence actions (enabling a compliance flag,
   * voiding a settled round).
   */
  typeToConfirm?: string;
  /** Label above the reason field. */
  reasonLabel?: string;
  reasonPlaceholder?: string;
}

const toneStyles = {
  danger: { icon: 'bg-danger-500/12 text-danger-400', button: 'danger' as const },
  warning: { icon: 'bg-warning-500/12 text-warning-400', button: 'danger' as const },
  default: { icon: 'bg-brand-500/12 text-brand-300', button: 'primary' as const },
};

/**
 * Confirmation gate for admin actions that change a player's account, move
 * coins, or alter published state.
 *
 * Every such action is audited, and an audit entry without a justification is
 * useless three months later during a dispute — so the reason field is
 * mandatory and cannot be satisfied with whitespace or a single character.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  consequences,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isSubmitting = false,
  typeToConfirm,
  reasonLabel = 'Reason (required)',
  reasonPlaceholder = 'Explain why you are taking this action. This is recorded in the audit log.',
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [touched, setTouched] = useState(false);

  // Never carry a justification from one action over to the next.
  useEffect(() => {
    if (!open) {
      setReason('');
      setConfirmText('');
      setTouched(false);
    }
  }, [open]);

  const trimmedReason = reason.trim();
  const reasonError =
    trimmedReason.length === 0
      ? 'A reason is required.'
      : trimmedReason.length < MIN_REASON_LENGTH
        ? `Give at least ${MIN_REASON_LENGTH} characters so the audit log is useful later.`
        : undefined;

  const typedMatches = !typeToConfirm || confirmText.trim() === typeToConfirm;
  const canSubmit = !reasonError && typedMatches && !isSubmitting;

  const styles = toneStyles[tone];

  async function handleConfirm() {
    setTouched(true);
    if (!canSubmit) return;
    await onConfirm(trimmedReason);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            variant={styles.button}
            onClick={handleConfirm}
            isLoading={isSubmitting}
            loadingText="Working"
            disabled={!canSubmit}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded', styles.icon)}
        >
          {tone === 'default' ? <AlertTriangle size={16} /> : <AlertTriangle size={16} />}
        </span>

        <div className="min-w-0 flex-1 space-y-4">
          <p className="text-sm leading-relaxed text-surface-subtle">{description}</p>

          {consequences ? (
            <div className="rounded-md border border-surface-border bg-surface-elevated px-3 py-2.5 text-xs leading-relaxed text-surface-muted">
              {consequences}
            </div>
          ) : null}

          <Textarea
            label={reasonLabel}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={reasonPlaceholder}
            rows={3}
            required
            maxLength={MAX_REASON_LENGTH}
            showCount
            disabled={isSubmitting}
            {...(touched && reasonError ? { error: reasonError } : {})}
            hint="Recorded against your admin account in the immutable audit log."
          />

          {typeToConfirm ? (
            <Input
              label={`Type "${typeToConfirm}" to confirm`}
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={typeToConfirm}
              autoComplete="off"
              spellCheck={false}
              disabled={isSubmitting}
              className="font-mono"
              {...(touched && !typedMatches ? { error: 'The text does not match.' } : {})}
            />
          ) : null}

          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-surface-muted">
            <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            This action is attributed to you and cannot be removed from the audit log.
          </p>
        </div>
      </div>
    </Modal>
  );
}
