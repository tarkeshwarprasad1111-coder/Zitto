import type { BadgeVariant } from '@/components/ui/badge';
import { humanizeEnum } from '@/lib/utils';
import type {
  LedgerEntryType,
  Outcome,
  ReportStatus,
  RoundState,
  TicketPriority,
  TicketStatus,
  TournamentState,
  UserStatus,
} from '@/types';

/**
 * Enum → badge mapping.
 *
 * Kept in one place so a suspended user looks identical on the user list, the
 * user detail page and the report queue. Colour carries meaning here, so the
 * label always travels with it for anyone who cannot distinguish the hues.
 */
export interface BadgeSpec {
  label: string;
  variant: BadgeVariant;
}

const USER_STATUS: Record<UserStatus, BadgeSpec> = {
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'danger' },
  self_excluded: { label: 'Self-excluded', variant: 'warning' },
  deleted: { label: 'Deleted', variant: 'outline' },
};

export function userStatusBadge(status: UserStatus): BadgeSpec {
  return USER_STATUS[status] ?? { label: humanizeEnum(status), variant: 'default' };
}

const ROUND_STATE: Record<RoundState, BadgeSpec> = {
  BETTING: { label: 'Betting', variant: 'info' },
  DRAWING: { label: 'Drawing', variant: 'warning' },
  SETTLED: { label: 'Settled', variant: 'success' },
  VOIDED: { label: 'Voided', variant: 'danger' },
};

export function roundStateBadge(state: RoundState): BadgeSpec {
  return ROUND_STATE[state] ?? { label: humanizeEnum(state), variant: 'default' };
}

/** True while the round is still running and its outcome is not yet fixed. */
export function isLiveRound(state: RoundState): boolean {
  return state === 'BETTING' || state === 'DRAWING';
}

const OUTCOME: Record<Outcome, BadgeSpec> = {
  DRAGON: { label: 'Dragon', variant: 'danger' },
  TIGER: { label: 'Tiger', variant: 'info' },
  TIE: { label: 'Tie', variant: 'warning' },
};

export function outcomeBadge(outcome: Outcome): BadgeSpec {
  return OUTCOME[outcome];
}

/** Chart fills, matched to the outcome badges. */
export const OUTCOME_CHART_COLOR: Record<Outcome, string> = {
  DRAGON: '#EF4444',
  TIGER: '#3B82F6',
  TIE: '#F59E0B',
};

const TICKET_STATUS: Record<TicketStatus, BadgeSpec> = {
  open: { label: 'Open', variant: 'info' },
  pending: { label: 'Pending', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'outline' },
};

export function ticketStatusBadge(status: TicketStatus): BadgeSpec {
  return TICKET_STATUS[status] ?? { label: humanizeEnum(status), variant: 'default' };
}

const TICKET_PRIORITY: Record<TicketPriority, BadgeSpec> = {
  low: { label: 'Low', variant: 'outline' },
  normal: { label: 'Normal', variant: 'default' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'danger' },
};

export function ticketPriorityBadge(priority: TicketPriority): BadgeSpec {
  return TICKET_PRIORITY[priority] ?? { label: humanizeEnum(priority), variant: 'default' };
}

const REPORT_STATUS: Record<ReportStatus, BadgeSpec> = {
  open: { label: 'Open', variant: 'warning' },
  reviewing: { label: 'Reviewing', variant: 'info' },
  resolved: { label: 'Resolved', variant: 'success' },
  dismissed: { label: 'Dismissed', variant: 'outline' },
};

export function reportStatusBadge(status: ReportStatus): BadgeSpec {
  return REPORT_STATUS[status] ?? { label: humanizeEnum(status), variant: 'default' };
}

const TOURNAMENT_STATE: Record<TournamentState, BadgeSpec> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  UPCOMING: { label: 'Upcoming', variant: 'info' },
  LIVE: { label: 'Live', variant: 'success' },
  ENDED: { label: 'Ended', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

export function tournamentStateBadge(state: TournamentState): BadgeSpec {
  return TOURNAMENT_STATE[state] ?? { label: humanizeEnum(state), variant: 'default' };
}

/** Ledger entry types that move coins out of a player's wallet. */
const DEBIT_TYPES = new Set<LedgerEntryType>(['bet', 'admin_debit', 'tournament_entry']);

export function isLedgerDebit(type: LedgerEntryType): boolean {
  return DEBIT_TYPES.has(type);
}

export function ledgerTypeBadge(type: LedgerEntryType): BadgeSpec {
  const label = humanizeEnum(type);
  if (type === 'correction') return { label, variant: 'warning' };
  if (type === 'admin_credit' || type === 'admin_debit') return { label, variant: 'info' };
  if (isLedgerDebit(type)) return { label, variant: 'outline' };
  return { label, variant: 'default' };
}

/** Suit glyphs for fairness card display. */
export const SUIT_GLYPH = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
} as const;

export function isRedSuit(suit: keyof typeof SUIT_GLYPH): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}
