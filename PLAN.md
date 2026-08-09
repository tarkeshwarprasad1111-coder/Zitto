# Zitto — Pre-Implementation Plan

**Product:** Zitto — Dragon Tiger Gaming Analytics Platform
**Version:** 0.1 Planning Draft
**Status:** Awaiting approval before implementation begins
**Default Mode:** Virtual-coin only. Real-money features are architected but disabled.

> **Guiding principles**
> 1. No prediction is ever presented as guaranteed. All analytics carry data-period, sample-size, method, confidence, and disclaimer.
> 2. Server-authoritative game state. Client never computes outcomes, balances, or payouts.
> 3. Responsible gaming is a first-class concern, not a footer link.
> 4. Every wallet mutation is a ledger entry. No direct balance writes.

---

## 1. Product Architecture

### 1.1 High-Level System

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │  Player Web  │   │  Player PWA  │   │  Admin Web   │         │
│  │  (Next.js)   │   │  (installable)│   │  (Next.js)   │         │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │ HTTPS + WSS      │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────────┐
│                       EDGE / GATEWAY                            │
│  Reverse proxy (Nginx / Caddy) · TLS · WAF rules · Rate limit   │
└─────────┬───────────────────────────────────────┬───────────────┘
          │                                       │
┌─────────▼─────────────┐                ┌────────▼──────────────┐
│    API SERVICE        │                │  WEBSOCKET SERVICE    │
│    (NestJS)           │                │  (Socket.IO)          │
│  - Auth, Wallet       │                │  - Room updates       │
│  - Game orchestration │                │  - Round countdown    │
│  - Admin, CMS         │                │  - Chat, Presence     │
│  - Analytics API      │                │                       │
└──┬───────┬───────┬────┘                └───────┬───────────────┘
   │       │       │                             │
   │       │       │                             │
┌──▼──┐ ┌──▼──┐ ┌──▼────────────────────┐ ┌──────▼──────┐
│ PG  │ │Redis│ │  Game Engine Worker   │ │  Job Queue  │
│ 15  │ │ 7   │ │  (Node worker)        │ │  (BullMQ)   │
│     │ │     │ │  - CSPRNG results     │ │  - Rewards  │
│     │ │     │ │  - Round scheduler    │ │  - Reports  │
│     │ │     │ │  - Settlement         │ │  - Email/SMS│
└─────┘ └─────┘ └───────────────────────┘ └─────────────┘

External (all optional, feature-flagged):
  · OTP provider  · Email provider  · Analytics sink  · Error monitor
  · Provably-fair verification page  · Live-dealer bridge (documented interface only)
```

### 1.2 Service Boundaries

| Service | Responsibility | Data ownership |
|---|---|---|
| `api` | REST + auth + admin + CMS + analytics reads | Read/write all except round settlement |
| `game-engine` | Round scheduler, CSPRNG, card draw, settlement, fairness hash | Sole writer to `game_rounds`, `game_results`, `wallet_ledger` (settlement rows) |
| `realtime` | WebSocket broadcast of round state, chat, presence | Ephemeral only; persistence via `api` |
| `worker` | Async jobs — daily rewards, tournament close, email/SMS dispatch, exports | Writes ledger entries via idempotent job handlers |

The **game-engine** owns the settlement pipeline so a compromised API instance cannot forge results. Every settlement is signed and appended to an immutable `game_results` table.

### 1.3 Deployment Topology

- **Development:** Docker Compose — api, game-engine, realtime, worker, postgres, redis, mailhog.
- **Staging:** Same containers on a single VPS or managed platform.
- **Production:** Container orchestration (Fly.io / Render / self-hosted k8s). Postgres managed (Neon / Supabase / RDS). Redis managed. CDN for static assets.

---

## 2. Recommended Technology Stack

### 2.1 Frontend (player + admin)

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14 (App Router)** + **React 18** | SSR for landing/SEO, RSC for admin lists, PWA support |
| Language | **TypeScript strict** | Type safety across API contract |
| Styling | **Tailwind CSS** + custom design tokens | Mobile-first, dark-first, fast iteration |
| Components | **Radix UI primitives** + custom Dragon Tiger themed skin | Accessible without vendor lock-in |
| State (server) | **TanStack Query** | Cache, refetch, optimistic updates |
| State (client) | **Zustand** for game state | Lightweight, no boilerplate |
| Forms | **React Hook Form** + **Zod** | Same schema on client + server |
| Charts | **Recharts** | Simple, accessible, sufficient for our metrics |
| Animation | **Framer Motion** | Card flip and reveal animations |
| Realtime | **Socket.IO client** | Round state, chat |
| i18n | **next-intl** | Hindi + English at launch |
| PWA | **next-pwa** | Installable, offline shell |

### 2.2 Backend

| Layer | Choice | Reason |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Widely supported, mature |
| Framework | **NestJS 10** | Modules, guards, DI — fits the many bounded contexts here |
| Language | **TypeScript strict** | Shared types with frontend |
| ORM | **Prisma 5** | Migrations, type-safe queries, easy to review |
| DB | **PostgreSQL 15** | Transactions, JSONB, row-level security, mature |
| Cache | **Redis 7** | Sessions, rate limits, pubsub for realtime |
| Queue | **BullMQ** | Rewards, tournament close, exports |
| Realtime | **Socket.IO 4** (separate service) | Sticky sessions, rooms |
| Validation | **Zod** (shared schemas) | Same rules across layers |
| Auth | **JWT access (5 min) + refresh (30 day, rotated)**, **Argon2id** password hashing | Modern, secure defaults |
| OTP | **Speakeasy TOTP** + provider-agnostic SMS/email adapter | Swap provider without code change |
| Docs | **@nestjs/swagger** → OpenAPI 3.1 | Auto-generated from decorators |

### 2.3 Infrastructure

| Concern | Choice |
|---|---|
| Containerization | Docker + Docker Compose (dev), production image via multi-stage build |
| CI/CD | GitHub Actions — lint, typecheck, test, build, image push |
| Migrations | Prisma migrate — reviewed in PR, applied automatically in staging, manually in production |
| Monitoring | OpenTelemetry traces → Grafana Tempo or Honeycomb (feature-flagged) |
| Errors | Sentry (feature-flagged) |
| Logs | Pino JSON logs → Loki or Cloudwatch |
| Backups | Nightly `pg_dump` to object storage, 30-day retention, weekly restore drill |
| Secrets | Env-based in dev, sealed secrets / vault in prod |

### 2.4 Testing

| Level | Tool |
|---|---|
| Unit | Vitest |
| Integration | Vitest + Testcontainers (real Postgres, real Redis) |
| E2E | Playwright |
| Load | k6 |
| Security | Semgrep in CI, `npm audit`, OWASP ZAP baseline scan against staging |

---

## 3. Complete Feature Matrix

Legend: `✓` = in scope for v1 · `L` = launch-gated (feature-flagged, off by default) · `—` = not in scope

| # | Feature | Guest | Player | Moderator | Admin | Super Admin |
|---|---|:-:|:-:|:-:|:-:|:-:|
| **Auth** |
| 1 | Register (email/mobile + OTP) | ✓ | — | — | — | — |
| 2 | Login | ✓ | — | ✓ | ✓ | ✓ |
| 3 | Forgot / reset password | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4 | 2FA (TOTP) | — | ✓ | ✓ | ✓ | ✓ |
| 5 | Google / Apple SSO | ✓ | ✓ | — | — | — |
| 6 | Session / device management | — | ✓ | ✓ | ✓ | ✓ |
| **Profile** |
| 7 | Avatar, display name, language | — | ✓ | ✓ | ✓ | ✓ |
| 8 | Responsible-gaming limits | — | ✓ | — | Set defaults | Set defaults |
| 9 | Self-exclusion | — | ✓ | Enforce on user | Enforce on user | Enforce on user |
| 10 | Data export / delete | — | ✓ | Process | Process | Process |
| **Game** |
| 11 | Rules & payout page | ✓ | ✓ | ✓ | Configure | Configure |
| 12 | Demo mode (no wallet impact) | ✓ | ✓ | — | — | — |
| 13 | Classic Dragon Tiger | — | ✓ | Spectate | Spectate | Spectate |
| 14 | Quick game | — | ✓ | — | — | — |
| 15 | Private room (invite code) | — | ✓ | — | — | — |
| 16 | Multiplayer public room | — | ✓ | — | — | — |
| 17 | Tournament mode | — | ✓ | — | Configure | Configure |
| 18 | Live-dealer integration | — | L | — | L | L |
| 19 | Provably-fair verification page | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Analytics** |
| 20 | Session win/loss chart | — | ✓ | — | ✓ | ✓ |
| 21 | Rolling frequency (10/25/50/100) | — | ✓ | — | ✓ | ✓ |
| 22 | Streak detection | — | ✓ | — | ✓ | ✓ |
| 23 | Model estimate w/ confidence label | — | ✓ | — | Configure | Configure |
| 24 | Historical accuracy of model | — | ✓ | — | ✓ | ✓ |
| 25 | CSV export of own history | — | ✓ | — | Any user | Any user |
| **Wallet** |
| 26 | Virtual balance display | — | ✓ | View | View | View |
| 27 | Transaction ledger | — | ✓ | View | View | View |
| 28 | Daily login reward | — | ✓ | — | Configure | Configure |
| 29 | Promo-code redeem | — | ✓ | — | Manage | Manage |
| 30 | Real-money deposit / withdraw | — | L | — | L | L |
| **Rewards** |
| 31 | Missions | — | ✓ | — | Configure | Configure |
| 32 | Achievements | — | ✓ | — | Configure | Configure |
| 33 | Referrals | — | ✓ | — | Configure | Configure |
| 34 | Spin wheel | — | L | — | L | L |
| **Tournaments** |
| 35 | Join / view leaderboard | — | ✓ | — | ✓ | ✓ |
| 36 | Create tournament | — | — | — | ✓ | ✓ |
| 37 | Anti-collusion monitor | — | — | View | View | View |
| **Social** |
| 38 | Friends / follow | — | ✓ | Moderate | Moderate | Moderate |
| 39 | Chat (safe) | — | ✓ | Moderate | Moderate | Moderate |
| 40 | Report / block user | — | ✓ | Review | Review | Review |
| 41 | Support tickets | — | ✓ | Respond | Respond | Respond |
| **Admin** |
| 42 | User management | — | — | Read-only | ✓ | ✓ |
| 43 | Game configuration | — | — | — | ✓ | ✓ |
| 44 | Rewards management | — | — | — | ✓ | ✓ |
| 45 | Tournament management | — | — | — | ✓ | ✓ |
| 46 | Prediction-model config | — | — | — | ✓ | ✓ |
| 47 | CMS (FAQ, T&C, banners) | — | — | Draft | Publish | Publish |
| 48 | Audit logs | — | — | Own actions | ✓ | ✓ |
| 49 | Role / permission mgmt | — | — | — | — | ✓ |
| 50 | Global feature flags | — | — | — | — | ✓ |

---

## 4. Database ER Plan (Prisma-flavored)

> All tables have `id UUID PK`, `created_at`, `updated_at`, and `deleted_at NULL` unless noted **immutable**.

### 4.1 Core

**users** — one row per human account
- `email` unique, nullable · `mobile` unique, nullable · `password_hash` (Argon2id)
- `email_verified_at`, `mobile_verified_at`, `age_confirmed_at`
- `display_name`, `avatar_url`, `locale`, `timezone`, `theme`
- `status` enum: `active | suspended | self_excluded | deleted`
- `two_factor_enabled bool`, `two_factor_secret_enc`
- Index: (`status`), (`email`), (`mobile`)

**roles** · **permissions** · **role_permissions** · **user_roles**
- RBAC. Seed: `guest`, `player`, `moderator`, `admin`, `super_admin`.

**user_sessions**
- `user_id`, `refresh_token_hash`, `device_fingerprint`, `ip`, `user_agent`, `expires_at`, `revoked_at`

**user_devices**
- Trust list. `user_id`, `device_id`, `last_seen_at`

**user_preferences**
- Notification prefs, language, theme, chart-window default.

**verification_records** — email/mobile OTP audit
- `channel`, `target`, `code_hash`, `expires_at`, `verified_at`, `attempts`, `ip`

### 4.2 Game (settlement-critical)

**game_rooms**
- `mode` enum: `classic | quick | practice | private | public | tournament`
- `host_user_id NULL`, `invite_code UNIQUE NULL`, `max_players`, `status`, `password_hash NULL`
- `settings_json` (timer, payout, min/max bet)

**game_rounds** — **immutable append-only**
- `room_id`, `round_number`, `state` enum: `betting | drawing | settled | voided`
- `betting_started_at`, `betting_ended_at`, `drawn_at`, `settled_at`
- `server_seed_hash` (published before round), `server_seed` (revealed after settlement)
- `client_seed`, `nonce`
- `dragon_card`, `tiger_card`, `outcome` enum: `dragon | tiger | tie`
- `fairness_signature` (HMAC over the round record)
- Only game-engine writes. Any correction creates a new `game_round_corrections` entry linking to the original — the original row is never mutated.

**bets_or_selections**
- `round_id`, `user_id`, `side` enum: `dragon | tiger | tie`
- `amount BIGINT` (coins as integer — no floats for money)
- `status` enum: `placed | won | lost | refunded | voided`
- `payout BIGINT`, `settled_at`
- `idempotency_key UNIQUE(user_id, round_id, key)`

**game_predictions** — recorded when analytics engine emits an estimate
- `round_id NULL` (may be pre-round), `user_id`, `model_id`, `model_version`
- `predicted_side`, `confidence NUMERIC(5,4)`, `features_json`
- `actual_side NULL` (populated after settlement for accuracy tracking)

**prediction_models**
- `code` unique (e.g. `freq_rolling_50`), `name`, `description`, `enabled`, `min_data_rounds`

**prediction_metrics** — rollup per model per day
- `model_id`, `date`, `total_predictions`, `correct`, `accuracy`, `brier_score`

### 4.3 Wallet (double-entry ledger)

**virtual_wallets**
- `user_id UNIQUE`, `balance BIGINT`, `locked BIGINT`, `bonus BIGINT`
- Balance is a **materialized view** of `wallet_ledger` — reconciled by a nightly job. Reads may use the cached value; writes always go through ledger insert + row-level lock on wallet.

**wallet_ledger** — **immutable append-only, double-entry**
- `wallet_id`, `user_id`, `type` enum: `bet | win | refund | daily_reward | mission | achievement | referral | promo | admin_credit | admin_debit | tournament_prize | correction`
- `amount BIGINT` (signed: positive = credit, negative = debit)
- `balance_before`, `balance_after`
- `source_type` (e.g. `round`, `mission`, `promo_code`), `source_id`
- `idempotency_key UNIQUE`
- `actor_type` enum: `system | user | admin | game_engine`, `actor_id`
- `metadata JSONB`

**promo_codes**
- `code UNIQUE`, `reward_amount`, `max_redemptions`, `per_user_limit`, `starts_at`, `expires_at`, `enabled`

### 4.4 Rewards / Progression

**rewards** — catalog · **missions** — repeatable tasks · **achievements** — one-time
- Definitions with rules JSON, reward amount, active window.

**user_rewards** — grant records (join to ledger via `source`).
- `user_id`, `reward_id | mission_id | achievement_id`, `granted_at`, `expires_at`

**referrals**
- `referrer_id`, `referee_id`, `code`, `status`, `reward_granted_at`

### 4.5 Tournaments

**tournaments** — `code`, `name`, `mode`, `starts_at`, `ends_at`, `entry_fee`, `prize_pool_json`, `rules_json`, `state`
**tournament_players** — `tournament_id`, `user_id`, `joined_at`, `score`, `rank`
**tournament_results** — final rank, prize granted, ledger link

### 4.6 Social

**friends** — `user_id`, `friend_id`, `status` (`requested`, `accepted`, `blocked`)
**messages** — chat, `channel_type` (`room`, `dm`, `support_ticket`), `channel_id`, `body`, `is_flagged`, `moderator_id`
**reports** — `reporter_id`, `target_type`, `target_id`, `reason`, `status`
**support_tickets** — `user_id`, `subject`, `status`, `priority`, `assigned_to`
**notifications** — `user_id`, `type`, `title`, `body`, `read_at`, `metadata_json`

### 4.7 Compliance / RG

**responsible_gaming_limits** — `user_id`, `daily_loss_limit`, `session_time_limit`, `deposit_limit_amount`, `enabled_at`
**self_exclusion_records** — `user_id`, `starts_at`, `ends_at`, `reason`
**kyc_records** — `user_id`, `status`, `provider`, `provider_reference`, `documents_json_encrypted` (real-money only)
**audit_logs** — **immutable append-only** — `actor_type`, `actor_id`, `action`, `target_type`, `target_id`, `payload_json`, `ip`, `user_agent`, `at`

### 4.8 Config / CMS

**app_settings** — key-value, versioned
**cms_pages** — `slug`, `locale`, `title`, `body`, `published_at`
**feature_flags** — `key`, `enabled`, `rollout_percent`, `metadata`

### 4.9 Indexes / Constraints Notes

- `wallet_ledger(user_id, created_at)` — history queries
- `game_rounds(room_id, round_number)` unique — no duplicates
- `bets_or_selections(round_id)` — settlement scan
- Row-level constraint: `bets_or_selections.status IN ('won','lost') ⇒ payout IS NOT NULL`
- Trigger: any UPDATE on `game_rounds` after `state='settled'` is blocked — corrections happen via a new row.

---

## 5. API Endpoint Plan (REST v1)

Base: `https://api.zitto.example/api/v1`
Auth header: `Authorization: Bearer <access>`
Idempotency for mutating endpoints: `Idempotency-Key: <uuid>`

### 5.1 Public
- `GET  /health` · `GET /health/ready`
- `GET  /cms/pages/:slug` — locale via `?locale=hi|en`
- `GET  /game/fairness/:roundId` — public verification

### 5.2 Auth
- `POST /auth/register` — email or mobile + password + locale + age confirmation
- `POST /auth/verify-otp` — `{ channel, target, code }`
- `POST /auth/resend-otp`
- `POST /auth/login` — returns access + refresh
- `POST /auth/refresh` — rotate refresh
- `POST /auth/logout` — current session
- `POST /auth/logout-all`
- `POST /auth/forgot-password` · `POST /auth/reset-password`
- `POST /auth/2fa/setup` · `POST /auth/2fa/verify` · `POST /auth/2fa/disable`
- `GET  /auth/oauth/google/start` · `GET /auth/oauth/google/callback`

### 5.3 Me / Profile
- `GET  /me` · `PATCH /me`
- `GET  /me/preferences` · `PATCH /me/preferences`
- `GET  /me/sessions` · `DELETE /me/sessions/:id`
- `GET  /me/devices`
- `POST /me/rg-limits` — set responsible gaming limits
- `POST /me/self-exclude` — `{ duration_days, reason }`
- `POST /me/export-data` — async → email link
- `POST /me/delete-account` — 14-day cool-off

### 5.4 Wallet
- `GET  /wallet` — balance + locked + bonus
- `GET  /wallet/ledger?cursor=&limit=&type=&from=&to=`
- `POST /wallet/claim-daily-reward` — idempotent
- `POST /wallet/redeem-promo` — `{ code }`

### 5.5 Game
- `GET  /game/config` — modes, timers, payouts, min/max bet
- `GET  /game/rooms?mode=&status=`
- `POST /game/rooms` — create private
- `POST /game/rooms/:id/join` — with optional invite code / password
- `POST /game/rooms/:id/leave`
- `GET  /game/rooms/:id/current-round`
- `POST /game/rounds/:id/select` — `{ side, amount, idempotency_key }` — validated server-side
- `GET  /game/rounds/:id` — includes cards after settle
- `GET  /game/history?cursor=&room_id=&from=&to=`

WebSocket namespace `/game`:
- Client → `room:join { room_id }`
- Server → `round:tick { round_id, phase, remaining_ms }`
- Server → `round:cards { round_id, dragon_card, tiger_card }`
- Server → `round:settled { round_id, outcome, your_result }`
- Server → `presence:update { user_id, status }`

### 5.6 Analytics
- `GET  /analytics/summary?window=50` — freq, streak, tie rate, sample size
- `GET  /analytics/trends?from=&to=&interval=day`
- `GET  /analytics/streaks?window=100`
- `GET  /analytics/model-status?code=` — accuracy, sample, last updated
- `GET  /analytics/prediction/current?room_id=` — with confidence + disclaimer payload
- `GET  /analytics/export?format=csv&from=&to=` — async, returns job id
- `GET  /analytics/export/:job_id`

### 5.7 Rewards / Progression
- `GET  /rewards/catalog`
- `GET  /rewards/missions` · `POST /rewards/missions/:id/claim`
- `GET  /rewards/achievements`
- `GET  /rewards/referrals` · `POST /rewards/referrals/apply { code }`

### 5.8 Tournaments
- `GET  /tournaments?status=upcoming|live|ended`
- `GET  /tournaments/:id`
- `POST /tournaments/:id/join`
- `GET  /tournaments/:id/leaderboard?cursor=`
- `GET  /leaderboards?scope=global|friends|country&period=day|week|month|all`

### 5.9 Social / Support
- `GET  /friends` · `POST /friends/requests` · `POST /friends/requests/:id/accept`
- `POST /users/:id/block` · `POST /users/:id/report`
- `GET  /chat/:channel_id/messages` · `POST /chat/:channel_id/messages`
- `POST /support/tickets` · `GET /support/tickets` · `POST /support/tickets/:id/messages`
- `GET  /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all`

### 5.10 Admin (all require role check + audit)
- `GET  /admin/dashboard`
- `GET  /admin/users?q=&status=&cursor=` · `GET /admin/users/:id`
- `PATCH /admin/users/:id/status` — `{ status, reason }`
- `POST /admin/users/:id/notes`
- `GET  /admin/users/:id/wallet-ledger` · `POST /admin/users/:id/credit` (admin_credit, reason mandatory)
- `GET  /admin/game/rounds?state=` · `POST /admin/game/rounds/:id/void` (with correction record)
- `PATCH /admin/game/config` · `POST /admin/game/maintenance` `{ enabled, message }`
- `GET  /admin/prediction/models` · `PATCH /admin/prediction/models/:code`
- `CRUD /admin/rewards/*` · `CRUD /admin/tournaments/*` · `CRUD /admin/cms/*`
- `GET  /admin/audit-logs?actor=&action=&target=&from=&to=`
- `GET  /admin/reports/tickets` · `PATCH /admin/reports/:id`
- `GET  /admin/feature-flags` · `PATCH /admin/feature-flags/:key` (super-admin only)

### 5.11 Cross-cutting API rules
- Errors: RFC 7807 `application/problem+json` — `{ type, title, status, detail, correlation_id }`
- Pagination: cursor-based (`?cursor=&limit=`) — max 100 per page
- Rate limits: default 100 req/min per IP + 300 req/min per user; auth endpoints 10/min per IP
- All list endpoints support `?fields=` for projection
- Every response carries `X-Request-Id`
- OpenAPI 3.1 spec generated from decorators, served at `/docs`

---

## 6. Screen List (40 screens)

### 6.1 Guest / Onboarding
1. **Splash** — logo animation, version, jump to onboarding
2. **Onboarding carousel** — 4 slides: game intro, virtual coins, analytics disclaimer, responsible gaming
3. **Login**
4. **Registration** (2-step: contact → OTP → profile)
5. **OTP verification**
6. **Forgot / Reset password**

### 6.2 Player Core
7. **Home dashboard** — greeting, wallet, primary CTAs, events, mission preview
8. **Game mode selection** — cards for classic / quick / private / tournament / practice
9. **Dragon Tiger game room** — the main screen
10. **Round result screen** — win/loss confetti or empathetic tone on loss, share button
11. **Historical results** — filterable table, CSV export
12. **Analytics dashboard** — charts, model card, disclaimer
13. **Prediction explanation modal** — how the model works, data window, accuracy history

### 6.3 Wallet & Rewards
14. **Virtual wallet** — balance, ledger with filters
15. **Rewards** — daily reward, promo redeem, catalog
16. **Missions**
17. **Achievements**

### 6.4 Competition
18. **Tournament list**
19. **Tournament details** — rules, prize, join CTA
20. **Leaderboard** — filterable

### 6.5 Social
21. **Friends** — list, requests, add via code
22. **Chat** — room chat + DMs
23. **Notifications**

### 6.6 Account
24. **Profile** — public view + edit
25. **Settings** — language, theme, notifications
26. **Security settings** — 2FA, sessions, devices
27. **Responsible gaming** — limits, self-exclusion, session timer, break reminder
28. **Support center** — tickets, FAQ
29. **Terms, privacy, help articles** (CMS)

### 6.7 Admin
30. **Admin dashboard**
31. **Admin user management**
32. **Admin game configuration**
33. **Admin rewards management**
34. **Admin tournaments management**
35. **Admin prediction models**
36. **Admin CMS**
37. **Admin audit logs**

### 6.8 Utility
38. **Maintenance**
39. **Offline**
40. **Error / 404 / 500**

Each screen has **loading / skeleton / empty / error / offline / permission-denied / success / retry** states.

---

## 7. User Flows (text diagrams)

### 7.1 Registration → First Round
```
[Splash] → [Onboarding] → [Register]
    → enter email/mobile + password + age confirmation + T&C
    → server: create user (unverified) + wallet(0) + issue OTP
    → [OTP verify]
        → correct? → mark verified + credit signup bonus (ledger entry)
                   → [Home] with 500 virtual coins
        → wrong 5x → lockout 15 min
    → [Home]
    → tap "Play Now" → [Game mode selection] → tap "Classic"
    → [Game room] joins next round (state: BETTING)
    → user picks side + amount → confirm modal → server places bet (idempotent)
    → timer ends → BETTING closes → server draws cards → DRAWING
    → cards animate → SETTLED → wallet updated via ledger → [Result screen]
    → back to [Game room] for next round
```

### 7.2 Analytics Consumption
```
[Home] → [Analytics]
    → default window: last 50 rounds of user's rooms
    → cards load: freq, streak, tie rate, model estimate, model accuracy
    → each card shows: window, sample size, method, confidence, updated_at
    → tap model card → [Prediction explanation modal]
        → "This estimate is based on X rounds. Model historical accuracy: Y%.
           Past results do not determine future rounds."
    → user can change window, date range, export CSV
```

### 7.3 Self-Exclusion
```
[Profile] → [Responsible gaming]
    → tap "Self-exclude"
    → confirm duration (24h / 7d / 30d / 6mo / permanent)
    → typed confirmation phrase
    → server: create self_exclusion_record + set user.status = self_excluded
    → invalidate all sessions
    → logout, show acknowledgement page with helpline links
    → future login attempts blocked until end date, then require re-verification
```

### 7.4 Admin Suspends Abusive User
```
[Admin login] → 2FA → [Admin dashboard]
    → [Users] → search by handle → [User detail]
    → tap "Suspend"
    → mandatory reason + linked report id
    → confirm
    → server: PATCH status=suspended, audit_log entry, revoke sessions
    → user sees suspension screen on next request with reason + appeal link
```

### 7.5 Tournament Round
```
[Home] → [Tournaments] → [Tournament detail] → "Join"
    → entry check: eligible + within window + coins available
    → wallet ledger: -entry_fee (source=tournament, idempotent)
    → tournament_players row created
    → [Game room] scoped to tournament
    → each round updates tournament_players.score via game-engine
    → live leaderboard broadcast over WS
    → tournament ends → worker computes final ranks → prize ledger entries → notifications
```

### 7.6 Bet Placement Sequence (server-authoritative)
```
Client → POST /game/rounds/:id/select { side, amount, idempotency_key }
API    → validate: round exists, state=BETTING, user has balance, within limits
       → BEGIN TX
         → SELECT wallet FOR UPDATE
         → check RG limits (daily loss, session time)
         → INSERT bets_or_selections (status=placed)
         → INSERT wallet_ledger (type=bet, -amount)
         → UPDATE virtual_wallets.balance
       → COMMIT
       → emit ws event round:bet_placed to room
Client ← 201 { bet_id, wallet_snapshot }

Later, game-engine settles:
GameEngine → BEGIN TX
  → SELECT round FOR UPDATE (state=DRAWING → SETTLED)
  → deterministic settlement per bet
  → for each winning bet: INSERT wallet_ledger (type=win, +payout) + UPDATE bet.status=won
  → for each losing bet: UPDATE bet.status=lost
  → UPDATE round.state=SETTLED, drawn cards, fairness_signature
  → COMMIT
  → emit ws round:settled
```

---

## 8. Security & Compliance Risks

### 8.1 Top Risks & Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **Legal exposure — jurisdiction may class this as gambling even in virtual-coin mode** | Product ban, legal action | Real-money strictly gated behind operator legal review; explicit "no cash value" language on every coin surface; geo-block toggles; app-store compliance review before publishing |
| R2 | **Client-side outcome tampering** | Fraudulent wins | Server-authoritative game state; game-engine is the only settlement writer; provably-fair verification page |
| R3 | **Race conditions on wallet** | Negative balance, double-spend | `SELECT … FOR UPDATE` on wallet row + idempotency key on every mutating endpoint + double-entry ledger reconciliation job |
| R4 | **Prediction misrepresentation** | Deceptive practice, user harm | Language guardrails enforced in code (banned phrase list in CI); every prediction card renders sample size, method, confidence label, disclaimer — components fail to render if these are missing |
| R5 | **Collusion in multiplayer / tournaments** | Prize theft, reputation | IP + device fingerprint diversity checks; unusual win-rate flags; per-tournament velocity limits; manual review for top ranks |
| R6 | **Account takeover** | Wallet drain, harassment | Argon2id + 2FA + device confirmation email on new-device login + refresh token rotation + session revocation UI |
| R7 | **OTP abuse (SMS pumping)** | Cost + rate-limit exhaustion | Per-phone + per-IP OTP limits, exponential backoff, CAPTCHA on repeated requests, disposable-number blocklist |
| R8 | **Chat abuse** | Harassment, minors risk | Profanity filter, rate limits, report/block, keyword flagging for moderator review, no PII sharing hints |
| R9 | **Data breach — PII, KYC docs** | Regulatory fines, user harm | Data minimization, encryption at rest for KYC/2FA secret, restricted admin queries, audit log on every read of sensitive fields |
| R10 | **Insider tampering with results / balances** | Fraud, loss of trust | Immutable `game_results` + `wallet_ledger`; corrections require new row with reason + approver id; nightly hash chain of critical tables; separate settlement DB user with only append rights on those tables |
| R11 | **DoS on WebSocket** | Game unavailability | Auth-required WS handshake, per-connection message rate limits, sticky-session with connection limits per user |
| R12 | **Malicious file uploads** (avatar) | RCE, malware distribution | Type sniff (magic bytes), image re-encoding via sharp, size cap, virus-scan hook, served from separate origin with `Content-Disposition: attachment` |
| R13 | **Underage users** | Legal + ethical | Age-gate at signup + optional re-verification; RG resources always visible; parental-lockout endpoint |
| R14 | **Regulatory: data subject rights** | Non-compliance | Export + delete workflows; consent records; retention policy per data class |
| R15 | **Third-party dependency vulns** | Supply chain | Renovate bot, Semgrep + `npm audit` in CI, pinned versions, SBOM |
| R16 | **Model bias / poor performance hidden from users** | Deceptive analytics | Public `analytics/model-status` endpoint always shows accuracy; models auto-disable if accuracy below configurable floor |
| R17 | **Refund / dispute abuse** | Fraud on real-money if enabled | Multi-step review workflow, cool-off before payouts, velocity checks |
| R18 | **Push notification abuse** | User annoyance / opt-out | Frequency caps, quiet hours, granular preferences |
| R19 | **Localization gaps** | Poor UX for Hindi users | Hindi as first-class from day 1, translation coverage report in CI |
| R20 | **App-store rejection** | Blocked launch | Follow Google/Apple gambling policy; real-money off by default; provide DPA if requested |

### 8.2 Compliance Checklist (living document)

- [ ] Age gate on registration (13+ / 18+ configurable per jurisdiction)
- [ ] T&C + Privacy Policy versions tracked with user acceptance stamps
- [ ] Data export within 30 days of request
- [ ] Data deletion within 30 days of request (except legal-hold data)
- [ ] Cookie / analytics consent
- [ ] Responsible gaming resources page linked from every screen footer
- [ ] Helpline numbers per locale
- [ ] Reasonable-fair language review sign-off from a non-engineer
- [ ] Security review sign-off before enabling any real-money flag
- [ ] Provably-fair proof reproducible from public endpoint

---

## 9. Development Milestones

### Milestone 0 — Setup (Week 0-1)
**Goal:** Repo skeleton compiles and deploys a health-check.
- Monorepo layout: `apps/web`, `apps/admin`, `apps/api`, `apps/game-engine`, `apps/realtime`, `apps/worker`, `packages/schema`, `packages/ui`, `packages/config`
- Docker Compose (postgres, redis, mailhog, api, web)
- CI: lint, typecheck, test, build
- Prisma init, first migration (users, roles, wallets)
- Deploy pipeline to staging
- Design tokens + Tailwind theme + Storybook seeded with 5 primitives

**Exit criteria:** `docker compose up` shows landing page + `/health` returns 200 + CI green on main.

### Milestone 1 — Auth & Profile (Week 2-3)
- Registration + OTP (email + mobile, adapter-based)
- Login + refresh token rotation + 2FA
- Session and device management
- Profile edit, preferences, i18n scaffolding (Hindi + English)
- Password reset

**Exit criteria:** E2E test: register → verify → login → edit profile → logout — passes.

### Milestone 2 — Wallet & Ledger (Week 4)
- Virtual wallet + double-entry ledger
- Reconciliation job
- Daily reward flow
- Promo code redemption
- Idempotency middleware

**Exit criteria:** Concurrent-bet fuzz test cannot produce negative balance; ledger sum matches wallet balance across 10k operations.

### Milestone 3 — Core Game Loop (Week 5-7)
- Room lifecycle
- Round state machine (betting → drawing → settled)
- CSPRNG card draw + fairness signature
- Server-side settlement + payout
- WebSocket round broadcast
- Player game room UI + result screen
- Bet placement with confirmation and RG-limit checks
- Round history

**Exit criteria:** 100 concurrent players playing quick games with zero settlement anomalies over a 1-hour soak.

### Milestone 4 — Analytics & Predictions (Week 8)
- Frequency, streak, tie-rate computation
- Simple baseline model (rolling frequency) + accuracy tracking
- Analytics dashboard UI with mandatory disclaimer components
- CSV export via worker

**Exit criteria:** Prediction cards fail to render if any of {sample size, window, method, confidence, disclaimer} is missing. Enforced by unit test.

### Milestone 5 — Rewards, Missions, Achievements, Referrals (Week 9)
- Mission engine with rules JSON
- Achievement triggers
- Referral flow + attribution

**Exit criteria:** Users can complete a mission and see the ledger entry immediately; referrer bonus grants after referee's first game.

### Milestone 6 — Tournaments & Leaderboards (Week 10)
- Tournament lifecycle
- Live leaderboard broadcast
- Prize distribution via worker

**Exit criteria:** 500-player tournament simulation completes with correct ranking and prize ledger entries.

### Milestone 7 — Social & Support (Week 11)
- Friends, chat with moderation, block/report
- Support tickets
- Notifications (in-app + email adapter)

**Exit criteria:** Report → moderator queue → resolution flow works E2E.

### Milestone 8 — Admin Panel (Week 12-13)
- Admin dashboard + user management
- Game config + maintenance toggle
- Rewards, tournaments, prediction models, CMS
- Audit log viewer
- Feature flags UI (super admin)

**Exit criteria:** Admin can suspend a user, void a round (with correction record), publish a CMS page, and every action is in audit log.

### Milestone 9 — Responsible Gaming & Compliance (Week 14)
- Limits, self-exclusion, session timer, break reminder
- Data export + delete workflows
- Consent management
- Helpline pages per locale

**Exit criteria:** Self-exclusion blocks login and refunds/voids in-flight bets per policy.

### Milestone 10 — Hardening (Week 15-16)
- Security audit (Semgrep + manual review + OWASP ZAP)
- Accessibility audit (axe + manual)
- Load test (k6 target: 5k concurrent WS + 500 rps API)
- Bug fix
- Documentation completion

**Exit criteria:** All critical + high issues resolved; runbook exists for every alert.

### Milestone 11 — Beta & Launch (Week 17-18)
- Closed beta on staging with real users
- Feedback intake and fixes
- Production deploy with feature flags off for optional modules
- On-call rotation set up

**Exit criteria:** Acceptance criteria from Section 26 of the original spec all satisfied.

---

## Assumptions & Open Questions

Before implementation begins, I need decisions on the following:

1. **Jurisdiction & app stores** — Where will Zitto be published? This affects age gate, RG features, and Google Play's gambling policy compliance.
2. **Real-money roadmap** — Confirmed off for v1. Will it be a v2 target? Impacts KYC schema decisions now.
3. **Hosting preference** — Managed (Vercel + Neon + Upstash) or self-hosted VPS?
4. **OTP provider** — SMS provider preference? (Twilio, MSG91, Textlocal — impacts India cost/latency significantly)
5. **Design direction** — Do you have brand colors / logo, or should we produce these? Section 10 describes red/gold/black/blue.
6. **Native mobile apps** — v1 is PWA. Do you want a React Native wrapper later, or is PWA sufficient?
7. **Live-dealer integration** — Any specific provider intended, or leave as documented interface only?
8. **Session length / round pacing** — Suggested: 20s bet, 6s draw, 4s result = 30s cycle. Confirm?
9. **Default virtual-coin economy** — Signup bonus, daily reward, mission payouts, bet min/max? Proposed starter numbers in an appendix if approved.
10. **Team size / timeline** — Milestones assume 2 engineers + 1 designer working full-time. Adjust if different.

---

## Next Action

**Awaiting approval.** Once you confirm the plan and answer the open questions above (or say "use defaults"), I will begin **Milestone 0 — Setup**: repo skeleton, Docker Compose, first migrations, and CI. I'll report at the end of each milestone with:
- Files created
- Features completed
- Known issues
- Test results
- Next recommended action
