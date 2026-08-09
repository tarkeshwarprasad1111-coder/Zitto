'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { cn, describeCard } from '@/lib/utils';
import type { CardSuit, PlayingCardData } from '@/types';

const SUIT_GLYPH: Record<CardSuit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

/** Hearts and diamonds are red; clubs and spades near-black on a light face. */
function suitColor(suit: CardSuit): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#DC2626' : '#111118';
}

const sizeStyles = {
  sm: { width: 56, height: 80, rank: 15, pip: 26, corner: 9 },
  md: { width: 84, height: 120, rank: 22, pip: 40, corner: 13 },
  lg: { width: 108, height: 154, rank: 28, pip: 52, corner: 16 },
  xl: { width: 132, height: 188, rank: 34, pip: 64, corner: 20 },
} as const;

export type PlayingCardSize = keyof typeof sizeStyles;

export interface PlayingCardProps {
  /** `null` while the card has not been drawn yet. */
  card: PlayingCardData | null;
  /** When true the back is shown, regardless of `card`. */
  faceDown?: boolean;
  size?: PlayingCardSize;
  /** Colours the glow when the card belongs to the winning side. */
  side?: 'DRAGON' | 'TIGER';
  /** Adds a winner highlight ring. */
  isWinner?: boolean;
  /** Seconds of delay before the flip starts, for staggered reveals. */
  flipDelay?: number;
  className?: string;
}

/**
 * A single SVG playing card with a 3D flip between its back and face.
 *
 * The face is drawn rather than imaged so it stays crisp at every size and
 * ships no extra assets. Reduced-motion users get an instant cross-fade.
 */
export function PlayingCard({
  card,
  faceDown = false,
  size = 'md',
  side,
  isWinner = false,
  flipDelay = 0,
  className,
}: PlayingCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const dims = sizeStyles[size];
  const showBack = faceDown || !card;

  const glow =
    isWinner && side === 'DRAGON'
      ? 'shadow-glow-dragon ring-2 ring-dragon-500'
      : isWinner && side === 'TIGER'
        ? 'shadow-glow-tiger ring-2 ring-tiger-500'
        : isWinner
          ? 'shadow-glow-gold ring-2 ring-gold-500'
          : '';

  return (
    <div
      className={cn('perspective-1000 select-none', className)}
      style={{ width: dims.width, height: dims.height }}
      role="img"
      aria-label={showBack ? 'Face-down card' : describeCard(card)}
    >
      <motion.div
        className="preserve-3d relative h-full w-full"
        initial={false}
        animate={{ rotateY: showBack ? 180 : 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.6, delay: flipDelay, ease: [0.4, 0, 0.2, 1] }
        }
      >
        {/* Face */}
        <div className={cn('backface-hidden absolute inset-0 rounded-xl', glow)}>
          <CardFace card={card} dims={dims} />
        </div>

        {/* Back */}
        <div
          className={cn('backface-hidden absolute inset-0 rounded-xl')}
          style={{ transform: 'rotateY(180deg)' }}
        >
          <CardBack dims={dims} side={side} />
        </div>
      </motion.div>
    </div>
  );
}

function CardFace({
  card,
  dims,
}: {
  card: PlayingCardData | null;
  dims: (typeof sizeStyles)[PlayingCardSize];
}) {
  // Render a blank face rather than nothing, so the flip has something to
  // land on if the card arrives a frame late.
  const rank = card?.rank ?? '';
  const suit = card?.suit ?? 'spades';
  const color = suitColor(suit);
  const glyph = SUIT_GLYPH[suit];

  return (
    <svg
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
    >
      <defs>
        <linearGradient id={`face-${dims.width}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8E8EF" />
        </linearGradient>
      </defs>

      <rect
        x="1"
        y="1"
        width={dims.width - 2}
        height={dims.height - 2}
        rx="10"
        fill={`url(#face-${dims.width})`}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="1"
      />

      {card ? (
        <>
          {/* Top-left index */}
          <text
            x={dims.corner - 2}
            y={dims.corner + dims.rank * 0.6}
            fill={color}
            fontSize={dims.rank}
            fontWeight="700"
            fontFamily="var(--font-display), system-ui, sans-serif"
          >
            {rank}
          </text>
          <text
            x={dims.corner - 2}
            y={dims.corner + dims.rank * 1.55}
            fill={color}
            fontSize={dims.rank * 0.8}
            fontFamily="system-ui, sans-serif"
          >
            {glyph}
          </text>

          {/* Centre pip */}
          <text
            x={dims.width / 2}
            y={dims.height / 2}
            fill={color}
            fontSize={dims.pip}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="system-ui, sans-serif"
            opacity="0.92"
          >
            {glyph}
          </text>

          {/* Bottom-right index, rotated 180° */}
          <g transform={`rotate(180 ${dims.width / 2} ${dims.height / 2})`}>
            <text
              x={dims.corner - 2}
              y={dims.corner + dims.rank * 0.6}
              fill={color}
              fontSize={dims.rank}
              fontWeight="700"
              fontFamily="var(--font-display), system-ui, sans-serif"
            >
              {rank}
            </text>
            <text
              x={dims.corner - 2}
              y={dims.corner + dims.rank * 1.55}
              fill={color}
              fontSize={dims.rank * 0.8}
              fontFamily="system-ui, sans-serif"
            >
              {glyph}
            </text>
          </g>
        </>
      ) : null}
    </svg>
  );
}

function CardBack({
  dims,
  side,
}: {
  dims: (typeof sizeStyles)[PlayingCardSize];
  side?: 'DRAGON' | 'TIGER';
}) {
  const accent = side === 'DRAGON' ? '#DC2626' : side === 'TIGER' ? '#2563EB' : '#F59E0B';
  const patternId = `zitto-back-${dims.width}-${side ?? 'neutral'}`;

  return (
    <svg
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
    >
      <defs>
        {/* Zitto house pattern: interlocking diagonal lattice */}
        <pattern
          id={patternId}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="12" height="12" fill="#0F0F16" />
          <path d="M0 6 H12 M6 0 V12" stroke={accent} strokeWidth="1" opacity="0.28" />
          <circle cx="6" cy="6" r="1.4" fill={accent} opacity="0.5" />
        </pattern>

        <linearGradient id={`${patternId}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <rect
        x="1"
        y="1"
        width={dims.width - 2}
        height={dims.height - 2}
        rx="10"
        fill="#0F0F16"
        stroke={`url(#${patternId}-frame)`}
        strokeWidth="1.5"
      />

      <rect
        x="6"
        y="6"
        width={dims.width - 12}
        height={dims.height - 12}
        rx="7"
        fill={`url(#${patternId})`}
      />

      {/* Zitto mark */}
      <text
        x={dims.width / 2}
        y={dims.height / 2}
        fill={accent}
        fontSize={dims.pip * 0.62}
        fontWeight="800"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-display), system-ui, sans-serif"
        opacity="0.95"
      >
        Z
      </text>
    </svg>
  );
}
