'use client';

import { create } from 'zustand';

import type {
  BetSide,
  Coins,
  GameRound,
  Outcome,
  RoundResultSummary,
  RoundState,
} from '@/types';

/**
 * Client-side view of the live round.
 *
 * This store holds only presentation state. It is never the authority on
 * outcomes, balances or whether a selection was accepted — the game engine
 * settles rounds server-side and the client reconciles from `round:settled`.
 */
interface GameState {
  roomId: string | null;
  currentRound: GameRound | null;
  phase: RoundState;
  /** Whole seconds left in the current phase. */
  countdown: number;
  /** Milliseconds left, for smooth progress rings. */
  remainingMs: number;
  /** Full duration of the current phase, used to compute progress. */
  phaseDurationMs: number;

  selectedSide: BetSide | null;
  betAmount: Coins;
  /** True between "Confirm" and the server acknowledging the selection. */
  isSubmitting: boolean;
  /** Set once the server accepts the selection for this round. */
  confirmedSelection: { side: BetSide; amount: Coins } | null;

  /** Most recent settled outcomes, newest first. Capped at 100. */
  history: Outcome[];
  lastResult: RoundResultSummary | null;
  isResultVisible: boolean;
  isConnected: boolean;

  /* actions */
  setRoom: (roomId: string | null) => void;
  setRound: (round: GameRound | null) => void;
  setPhase: (phase: RoundState, remainingMs?: number, phaseDurationMs?: number) => void;
  tick: (remainingMs: number) => void;
  selectSide: (side: BetSide | null) => void;
  setBetAmount: (amount: Coins) => void;
  adjustBetAmount: (delta: Coins) => void;
  clearSelection: () => void;
  setSubmitting: (value: boolean) => void;
  confirmSelection: (side: BetSide, amount: Coins) => void;
  settleRound: (result: RoundResultSummary) => void;
  dismissResult: () => void;
  setHistory: (history: Outcome[]) => void;
  pushOutcome: (outcome: Outcome) => void;
  setConnected: (value: boolean) => void;
  resetForNextRound: () => void;
}

const MAX_HISTORY = 100;

export const useGameStore = create<GameState>()((set, get) => ({
  roomId: null,
  currentRound: null,
  phase: 'WAITING',
  countdown: 0,
  remainingMs: 0,
  phaseDurationMs: 0,

  selectedSide: null,
  betAmount: 100,
  isSubmitting: false,
  confirmedSelection: null,

  history: [],
  lastResult: null,
  isResultVisible: false,
  isConnected: false,

  setRoom: (roomId) =>
    set({
      roomId,
      currentRound: null,
      phase: 'WAITING',
      countdown: 0,
      remainingMs: 0,
      selectedSide: null,
      confirmedSelection: null,
      lastResult: null,
      isResultVisible: false,
    }),

  setRound: (round) =>
    set({
      currentRound: round,
      phase: round?.state ?? 'WAITING',
    }),

  setPhase: (phase, remainingMs, phaseDurationMs) =>
    set((state) => ({
      phase,
      remainingMs: remainingMs ?? state.remainingMs,
      countdown: Math.ceil((remainingMs ?? state.remainingMs) / 1000),
      phaseDurationMs: phaseDurationMs ?? state.phaseDurationMs,
    })),

  tick: (remainingMs) =>
    set({
      remainingMs: Math.max(0, remainingMs),
      countdown: Math.max(0, Math.ceil(remainingMs / 1000)),
    }),

  selectSide: (side) => {
    // Selections are locked once the server has accepted one for this round.
    if (get().confirmedSelection) return;
    set({ selectedSide: side });
  },

  setBetAmount: (amount) => set({ betAmount: Math.max(0, Math.trunc(amount)) }),

  adjustBetAmount: (delta) =>
    set((state) => ({ betAmount: Math.max(0, Math.trunc(state.betAmount + delta)) })),

  clearSelection: () => set({ selectedSide: null }),

  setSubmitting: (value) => set({ isSubmitting: value }),

  confirmSelection: (side, amount) =>
    set({
      confirmedSelection: { side, amount },
      selectedSide: side,
      isSubmitting: false,
    }),

  settleRound: (result) =>
    set((state) => ({
      lastResult: result,
      isResultVisible: true,
      phase: 'SETTLED',
      history: [result.outcome, ...state.history].slice(0, MAX_HISTORY),
    })),

  dismissResult: () => set({ isResultVisible: false }),

  setHistory: (history) => set({ history: history.slice(0, MAX_HISTORY) }),

  pushOutcome: (outcome) =>
    set((state) => ({ history: [outcome, ...state.history].slice(0, MAX_HISTORY) })),

  setConnected: (value) => set({ isConnected: value }),

  resetForNextRound: () =>
    set({
      selectedSide: null,
      confirmedSelection: null,
      isSubmitting: false,
      isResultVisible: false,
      phase: 'WAITING',
      countdown: 0,
      remainingMs: 0,
    }),
}));

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

/** Selections are only accepted while the round is in its betting phase. */
export const selectCanBet = (state: GameState): boolean =>
  state.phase === 'BETTING' && !state.confirmedSelection && !state.isSubmitting;

export const selectProgress = (state: GameState): number => {
  if (state.phaseDurationMs <= 0) return 0;
  return Math.min(1, Math.max(0, state.remainingMs / state.phaseDurationMs));
};
