'use client';

import { ArrowLeft, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BetPanel } from '@/components/game/bet-panel';
import { CountdownTimer } from '@/components/game/countdown-timer';
import { PlayingCard } from '@/components/game/playing-card';
import { ResultOverlay } from '@/components/game/result-overlay';
import { RoundHistoryStrip } from '@/components/game/round-history-strip';
import { PageContainer } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { mockOutcomeHistory, mockRooms } from '@/lib/mock-data';
import { cn, formatCoins, resolveOutcome } from '@/lib/utils';
import { selectCanBet, useGameStore } from '@/store/game-store';
import {
  DEFAULT_PAYOUTS,
  type BetSide,
  type CardRank,
  type CardSuit,
  type Coins,
  type PlayingCardData,
  type RoundResultSummary,
  type RoundState,
} from '@/types';

/* ------------------------------------------------------------------ */
/* MOCK round engine                                                   */
/* ------------------------------------------------------------------ */
/*
 * Everything in this block simulates the server-authoritative game engine so
 * the room is playable before the WebSocket is wired. Replace it with the
 * `/game` socket namespace from PLAN.md §5.5:
 *   round:tick { round_id, phase, remaining_ms }
 *   round:cards { round_id, dragon_card, tiger_card }
 *   round:settled { round_id, outcome, your_result }
 * The client must never decide an outcome — this is illustration only.
 */

const RANKS: readonly CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: readonly CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

// MOCK: draw a random card.
function randomCard(): PlayingCardData {
  const rankIndex = Math.floor(Math.random() * RANKS.length);
  const suitIndex = Math.floor(Math.random() * SUITS.length);
  return {
    rank: RANKS[rankIndex] ?? 'A',
    suit: SUITS[suitIndex] ?? 'spades',
    value: rankIndex + 1,
  };
}

const PHASE_LABELS: Record<RoundState, string> = {
  WAITING: 'Waiting for the next round',
  BETTING: 'Betting open',
  DRAWING: 'Drawing cards',
  REVEALING: 'Revealing',
  SETTLED: 'Round settled',
  VOIDED: 'Round voided',
};

const RESULT_DURATION_MS = 6_000;
const DRAWING_DURATION_MS = 4_000;

export default function GameRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const { toast } = useToast();

  const room = mockRooms.find((candidate) => candidate.id === roomId);
  if (!room) notFound();

  const bettingDurationMs = room.bettingDurationMs;

  /* Store bindings */
  const phase = useGameStore((state) => state.phase);
  const countdown = useGameStore((state) => state.countdown);
  const remainingMs = useGameStore((state) => state.remainingMs);
  const selectedSide = useGameStore((state) => state.selectedSide);
  const betAmount = useGameStore((state) => state.betAmount);
  const isSubmitting = useGameStore((state) => state.isSubmitting);
  const confirmedSelection = useGameStore((state) => state.confirmedSelection);
  const history = useGameStore((state) => state.history);
  const lastResult = useGameStore((state) => state.lastResult);
  const isResultVisible = useGameStore((state) => state.isResultVisible);
  const isConnected = useGameStore((state) => state.isConnected);
  const canBet = useGameStore(selectCanBet);

  const setRoom = useGameStore((state) => state.setRoom);
  const setPhase = useGameStore((state) => state.setPhase);
  const tick = useGameStore((state) => state.tick);
  const selectSide = useGameStore((state) => state.selectSide);
  const setBetAmount = useGameStore((state) => state.setBetAmount);
  const clearSelection = useGameStore((state) => state.clearSelection);
  const setSubmitting = useGameStore((state) => state.setSubmitting);
  const confirmSelection = useGameStore((state) => state.confirmSelection);
  const settleRound = useGameStore((state) => state.settleRound);
  const dismissResult = useGameStore((state) => state.dismissResult);
  const setHistory = useGameStore((state) => state.setHistory);
  const setConnected = useGameStore((state) => state.setConnected);
  const resetForNextRound = useGameStore((state) => state.resetForNextRound);

  /* Local round view */
  const [roundNumber, setRoundNumber] = useState(10_429);
  const [dragonCard, setDragonCard] = useState<PlayingCardData | null>(null);
  const [tigerCard, setTigerCard] = useState<PlayingCardData | null>(null);
  const [cardsRevealed, setCardsRevealed] = useState(false);

  // Balance lives in the store so it survives leaving the table and closing
  // the app, and so the wallet screen sees the same figure.
  const balance = useGameStore((state) => state.balance);
  const adjustBalance = useGameStore((state) => state.adjustBalance);

  // Read live values without making the round loop depend on them — the loop
  // owns its own scheduling and must not restart when state changes.
  const selectionRef = useRef(confirmedSelection);
  selectionRef.current = confirmedSelection;

  const roundNumberRef = useRef(roundNumber);
  roundNumberRef.current = roundNumber;

  /* Join the room */
  useEffect(() => {
    setRoom(roomId);

    // Seed the rail only on a first visit. The player's own outcomes are
    // persisted, and overwriting them here would wipe their history every time
    // they walked back into a room.
    if (useGameStore.getState().history.length === 0) {
      setHistory(mockOutcomeHistory);
    }

    setConnected(true);
    return () => {
      setRoom(null);
      setConnected(false);
    };
  }, [roomId, setRoom, setHistory, setConnected]);

  /* MOCK: the round lifecycle loop. */
  useEffect(() => {
    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let ticker: ReturnType<typeof setInterval> | undefined;

    function runRound() {
      if (cancelled) return;

      resetForNextRound();
      setDragonCard(null);
      setTigerCard(null);
      setCardsRevealed(false);

      // --- Betting phase ---
      const bettingEndsAt = Date.now() + bettingDurationMs;
      setPhase('BETTING', bettingDurationMs, bettingDurationMs);

      ticker = setInterval(() => {
        const left = bettingEndsAt - Date.now();
        tick(left);
        if (left <= 0 && ticker) {
          clearInterval(ticker);
          ticker = undefined;
        }
      }, 200);

      timers.push(
        setTimeout(() => {
          if (cancelled) return;

          // --- Drawing phase ---
          setPhase('DRAWING', DRAWING_DURATION_MS, DRAWING_DURATION_MS);
          const drawnDragon = randomCard();
          const drawnTiger = randomCard();
          setDragonCard(drawnDragon);
          setTigerCard(drawnTiger);

          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              setPhase('REVEALING', 1_500, 1_500);
              setCardsRevealed(true);
            }, 1_200),
          );

          // --- Settlement ---
          timers.push(
            setTimeout(() => {
              if (cancelled) return;

              const outcome = resolveOutcome(drawnDragon, drawnTiger);
              const selection = selectionRef.current;
              const currentRoundNumber = roundNumberRef.current;

              let summary: RoundResultSummary = {
                roundId: `rnd_${currentRoundNumber}`,
                roundNumber: currentRoundNumber,
                outcome,
                dragonCard: drawnDragon,
                tigerCard: drawnTiger,
                settledAt: new Date().toISOString(),
                yourSelection: null,
              };

              if (selection) {
                const won = selection.side === outcome;
                const payout = won ? selection.amount + selection.amount * DEFAULT_PAYOUTS[selection.side] : 0;

                summary = {
                  ...summary,
                  yourSelection: {
                    id: `bet_${currentRoundNumber}`,
                    roundId: summary.roundId,
                    userId: 'usr_7f3a91c2',
                    side: selection.side,
                    amount: selection.amount,
                    status: won ? 'won' : 'lost',
                    payout,
                    placedAt: new Date().toISOString(),
                    settledAt: new Date().toISOString(),
                  },
                };

                if (payout > 0) adjustBalance(payout);
              }

              settleRound(summary);
              setRoundNumber((value) => value + 1);

              timers.push(
                setTimeout(() => {
                  if (cancelled) return;
                  dismissResult();
                  runRound();
                }, RESULT_DURATION_MS),
              );
            }, DRAWING_DURATION_MS),
          );
        }, bettingDurationMs),
      );
    }

    runRound();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (ticker) clearInterval(ticker);
    };
    // The loop owns its own scheduling; re-running it on every state change
    // would restart the round mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bettingDurationMs]);

  /* Actions */
  const handleConfirm = useCallback(async () => {
    if (!selectedSide) return;

    setSubmitting(true);
    try {
      // MOCK: replace with
      // `api.post('/game/rounds/:id/select', { side, amount }, { idempotencyKey: uuid() })`.
      // The server validates the balance and the phase — this client-side
      // deduction is optimistic display only.
      await new Promise((resolve) => setTimeout(resolve, 350));

      confirmSelection(selectedSide, betAmount);
      adjustBalance(-betAmount);
      toast({
        title: 'Selection confirmed',
        description: `${formatCoins(betAmount)} on ${selectedSide.charAt(0)}${selectedSide.slice(1).toLowerCase()}`,
        variant: 'success',
        duration: 2_500,
      });
    } catch {
      setSubmitting(false);
      toast({ title: 'Could not place selection', variant: 'error' });
    }
  }, [selectedSide, betAmount, confirmSelection, setSubmitting, toast]);

  const showCountdown = phase === 'BETTING';
  const isDragonWinner = cardsRevealed && dragonCard && tigerCard
    ? resolveOutcome(dragonCard, tigerCard) === 'DRAGON'
    : false;
  const isTigerWinner = cardsRevealed && dragonCard && tigerCard
    ? resolveOutcome(dragonCard, tigerCard) === 'TIGER'
    : false;

  return (
    <PageContainer className="flex flex-col gap-4">
      {/* Room header */}
      <header className="flex items-center gap-3">
        <Link
          href="/game"
          aria-label="Back to tables"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-surface-muted transition-colors hover:bg-surface-elevated hover:text-surface-fg focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold">{room.name}</h1>
          <p className="text-xs text-surface-muted">
            Round #{roundNumber} · {room.playerCount.toLocaleString('en-IN')} playing
          </p>
        </div>

        <Badge variant={isConnected ? 'success' : 'warning'} size="sm">
          {isConnected ? (
            <Wifi size={11} aria-hidden="true" />
          ) : (
            <WifiOff size={11} aria-hidden="true" />
          )}
          {isConnected ? 'Live' : 'Reconnecting'}
        </Badge>
      </header>

      {/* Table */}
      <Card variant="glass" className="flex flex-col items-center gap-4 p-4">
        <p
          className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-muted"
          aria-live="polite"
        >
          {PHASE_LABELS[phase]}
        </p>

        <div className="flex w-full items-center justify-center gap-3 sm:gap-6">
          <div className="flex flex-col items-center gap-2">
            <PlayingCard
              card={dragonCard}
              faceDown={!cardsRevealed}
              size="lg"
              side="DRAGON"
              isWinner={isDragonWinner}
            />
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-widest transition-colors',
                isDragonWinner ? 'text-dragon-300' : 'text-dragon-500',
              )}
            >
              Dragon
            </span>
          </div>

          {showCountdown ? (
            <CountdownTimer
              seconds={countdown}
              totalSeconds={Math.round(bettingDurationMs / 1000)}
              size={88}
              label="Betting closes"
            />
          ) : (
            <span aria-hidden="true" className="font-display text-xl text-surface-muted">
              vs
            </span>
          )}

          <div className="flex flex-col items-center gap-2">
            <PlayingCard
              card={tigerCard}
              faceDown={!cardsRevealed}
              size="lg"
              side="TIGER"
              isWinner={isTigerWinner}
              flipDelay={0.18}
            />
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-widest transition-colors',
                isTigerWinner ? 'text-tiger-300' : 'text-tiger-500',
              )}
            >
              Tiger
            </span>
          </div>
        </div>

        {/* Progress bar mirrors the ring, so the phase is readable even when
            the countdown is not on screen. */}
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-border"
          role="progressbar"
          aria-label="Phase progress"
          aria-valuenow={Math.round((remainingMs / Math.max(1, bettingDurationMs)) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-200 ease-linear',
              phase === 'BETTING' ? 'bg-gold-500' : 'bg-surface-muted',
            )}
            style={{
              width: `${Math.min(100, Math.max(0, (remainingMs / Math.max(1, bettingDurationMs)) * 100))}%`,
            }}
          />
        </div>
      </Card>

      {/* Bet panel */}
      <BetPanel
        selectedSide={selectedSide}
        onSelectSide={(side: BetSide) => selectSide(side)}
        amount={betAmount}
        onAmountChange={setBetAmount}
        onConfirm={handleConfirm}
        onClear={clearSelection}
        canBet={canBet}
        isSubmitting={isSubmitting}
        confirmedSelection={confirmedSelection}
        balance={balance}
        minBet={room.minBet}
        maxBet={room.maxBet}
      />

      {/* History */}
      <Card className="p-4">
        <RoundHistoryStrip history={history} limit={20} />
      </Card>

      {/* Responsible gaming footer */}
      <p className="flex items-start gap-2 text-xs leading-relaxed text-surface-muted">
        <ShieldCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          Virtual coins only, with no cash value. Every round is independent — take a break whenever
          you want one.
        </span>
      </p>

      <ResultOverlay
        open={isResultVisible}
        result={lastResult}
        nextRoundInSeconds={Math.ceil(RESULT_DURATION_MS / 1000)}
        onDismiss={dismissResult}
      />
    </PageContainer>
  );
}
