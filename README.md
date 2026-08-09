# Zitto

A Dragon Tiger game and analytics platform built around **virtual coins**.

> **Virtual coins have no cash value.** They cannot be purchased, exchanged, or
> withdrawn. Real-money functionality is architected but disabled by default and
> must not be enabled without legal review for the target jurisdiction.
>
> **Every round is independent.** The analytics in this app describe what has
> already happened. They cannot predict future rounds, and nothing in this
> product should be presented as a guaranteed outcome.

---

## What is in here

| App | Port | Role |
|---|---|---|
| `apps/web` | 3000 | Player-facing Next.js app (PWA) |
| `apps/admin` | 3001 | Admin console |
| `apps/api` | 4000 | NestJS REST API, auth, wallet, admin |
| `apps/realtime` | 4001 | Socket.IO fan-out for live round state |
| `apps/game-engine` | — | Round scheduler, card draw, settlement |

Supporting services: PostgreSQL 15, Redis 7, MailHog (dev mail catcher).

### Why the game engine is separate

The engine is the **only** writer for `game_rounds` and for `WIN`/`REFUND`
ledger rows. If the API were ever compromised, an attacker still could not forge
a round outcome or mint a payout. Every settled round is signed, and corrections
are appended as new rows rather than editing history.

---

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker Desktop

### Setup

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
docker compose up -d
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

Then open:

- Player app — http://localhost:3000
- Admin console — http://localhost:3001
- API docs (Swagger) — http://localhost:4000/docs
- Mail catcher — http://localhost:8025

### Seeded accounts

The seed creates a super admin. Set `SEED_ADMIN_PASSWORD` in `.env` before
running the seed; it falls back to a development-only default otherwise.

| Email | Role |
|---|---|
| `admin@zitto.local` | `super_admin` |

Change this password before deploying anywhere reachable.

---

## Useful commands

```bash
pnpm dev
```

```bash
pnpm test
```

```bash
pnpm typecheck
```

```bash
pnpm lint
```

```bash
pnpm db:studio
```

```bash
pnpm docker:down
```

---

## Game rules

Dragon Tiger deals exactly two cards: one to Dragon, one to Tiger. The higher
card wins. Suits never matter.

- Ace is **low** (value 1), King is **high** (value 13)
- Equal ranks produce a **Tie**

Default payouts (configurable by an admin, always shown in the rules modal
before a player bets):

| Selection | Wins | Pays |
|---|---|---|
| Dragon | Dragon card is higher | 1:1 |
| Tiger | Tiger card is higher | 1:1 |
| Tie | Both cards share a rank | 8:1 |

On a tie, Dragon and Tiger stakes are refunded at **50%**.

---

## Provable fairness

Each round commits to its result before betting opens:

1. Before the round, the engine generates a `serverSeed` and publishes only
   `sha256(serverSeed)`.
2. Betting opens. The seed stays hidden, so the outcome cannot be changed in
   response to the bets placed.
3. After settlement, the `serverSeed` is revealed alongside the `clientSeed` and
   `nonce`.
4. Anyone can recompute the cards from those three values and confirm the hash
   matches what was published in step 1.

`GET /api/v1/game/fairness/:roundId` returns the full proof for any settled
round and requires no authentication.

---

## Responsible gaming

These are product requirements, not optional extras:

- Age confirmation at registration
- Per-user daily bet and loss limits
- Session time limits with break reminders
- Self-exclusion (24h through permanent) that revokes all sessions immediately
- Loss-awareness display in session summaries
- Support and helpline resources linked from every screen

Self-exclusion is enforced server-side at bet placement, not only in the UI.

---

## Analytics honesty rules

The CI pipeline fails the build if prohibited phrasing appears anywhere in
`apps/` or `packages/` — including "guaranteed win", "sure shot",
"100% accurate", "fixed result", and "double your money".

Every analytics surface must state:

- the data period analysed
- the number of rounds in the sample
- the calculation method
- a confidence label, capped at *Moderate signal*
- the last updated time
- the independence disclaimer

Prediction components are written to fail rather than render if the sample size,
confidence label, or disclaimer is missing.

Model accuracy is published through `GET /api/v1/analytics/model-status`. Poor
performance is shown to users, never hidden, and a model whose accuracy falls
below its configured floor is disabled automatically.

---

## Money handling

- All coin amounts are `BigInt`. There are no floating-point balances.
- Balances are never written directly. Every change is a `wallet_ledger` row
  with `balanceBefore`, `balanceAfter`, and an idempotency key.
- Wallet mutations take a row lock (`SELECT … FOR UPDATE`) inside a transaction.
- A nightly reconciliation job compares the ledger sum against the stored
  balance and reports any drift.

---

## Project layout

```
zitto/
├── apps/
│   ├── web/          Next.js player app
│   ├── admin/        Next.js admin console
│   ├── api/          NestJS API + Prisma schema
│   ├── realtime/     Socket.IO gateway
│   └── game-engine/  Round lifecycle and settlement
├── packages/         Shared config, types, UI
├── docker-compose.yml
└── PLAN.md           Full architecture and milestone plan
```

`PLAN.md` holds the complete specification: ER design, API surface, screen list,
risk register, and milestone breakdown.

---

## Status

Milestone 0 (setup) and the core service skeletons are in place. See `PLAN.md`
for the remaining milestones.
