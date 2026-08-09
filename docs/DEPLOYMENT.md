# Deployment Guide

## Environments

| Environment | Purpose | Data |
|---|---|---|
| Local | Development | Seeded, disposable |
| Staging | Pre-release verification | Seeded, refreshed weekly |
| Production | Live | Real user data, backed up nightly |

Never point a staging build at the production database.

---

## Required environment variables

Copy `.env.example` and fill in real values. These have no safe default:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | 32+ random bytes, unique per environment |
| `JWT_REFRESH_SECRET` | 32+ random bytes, different from the access secret |
| `FAIRNESS_SIGNING_KEY` | Game engine only. Never share with the API. |
| `SEED_ADMIN_PASSWORD` | Used once by the seed script |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Feature flags

All optional modules ship disabled. Enabling `FEATURE_REAL_MONEY` or
`FEATURE_LIVE_DEALER` requires legal sign-off recorded outside this repository.

```
FEATURE_REAL_MONEY=false
FEATURE_LIVE_DEALER=false
FEATURE_SPIN_WHEEL=false
```

---

## First deploy

### 1. Provision infrastructure

- PostgreSQL 15 with automated backups enabled
- Redis 7 with persistence
- Object storage for exports and avatars
- TLS certificate for the API and both web apps

### 2. Create the database role for the game engine

The engine must not be able to rewrite history. Give it append-only rights on
the immutable tables:

```sql
CREATE ROLE zitto_engine LOGIN PASSWORD '<generated>';
GRANT CONNECT ON DATABASE zitto TO zitto_engine;
GRANT USAGE ON SCHEMA public TO zitto_engine;

GRANT SELECT, INSERT ON game_rounds, wallet_ledgers, audit_logs TO zitto_engine;
GRANT SELECT, INSERT, UPDATE ON bet_selections, virtual_wallets TO zitto_engine;
GRANT SELECT ON game_rooms, users, game_predictions TO zitto_engine;
```

Point `DATABASE_URL` for `apps/game-engine` at this role. The API keeps its own
role without `UPDATE` on `game_rounds`.

### 3. Run migrations

```bash
pnpm --filter @zitto/api exec prisma migrate deploy
```

`migrate deploy` applies committed migrations only. It never generates new ones
and never resets data.

### 4. Seed reference data

Run once, on a fresh database:

```bash
pnpm db:seed
```

This creates roles, permissions, the super admin, prediction models, feature
flags, and CMS pages. It is safe to re-run — it upserts.

### 5. Change the admin password

Log into the admin console and change it immediately. The seeded password is a
bootstrap value, not a credential.

### 6. Deploy services

Start order matters — the API and engine both need migrations applied first:

```
postgres, redis  →  api  →  game-engine, realtime  →  web, admin
```

### 7. Smoke test

- `GET /health/ready` returns 200 on the API
- `GET /health` returns 200 on realtime
- Register a test account and verify the OTP arrives
- Play one round in a demo room and confirm the wallet ledger balances
- Open `/api/v1/game/fairness/:roundId` for that round and verify the proof
- Suspend the test account from the admin console and confirm the audit entry

---

## Scaling notes

**API** — stateless, scale horizontally behind a load balancer.

**Realtime** — scale horizontally. The Redis adapter fans broadcasts across
replicas. Sticky sessions are recommended so a reconnect lands on the same node.

**Game engine** — safe to run multiple replicas. Each room is advanced under a
Redis lock, so only one replica opens or settles a given round. That said, one
replica handles a large number of rooms comfortably; scale only when tick
duration approaches the tick interval.

**Postgres** — the wallet path takes row locks. Watch for lock contention on
`virtual_wallets` under load; the per-user lock means contention only appears
when one user bets very rapidly.

---

## Monitoring

Alert on:

| Signal | Threshold | Why |
|---|---|---|
| Scheduler tick duration | > 400ms sustained | Rounds will start drifting |
| Rounds stuck in `DRAWING` | any, > 30s | Settlement is failing |
| Ledger reconciliation drift | any non-zero | Money bug — page immediately |
| Failed login rate | > 50/min from one IP | Credential stuffing |
| 5xx rate | > 1% of requests | Service degradation |
| Redis connection failures | any | Locks and rate limits are down |

The reconciliation alert is the highest priority. A non-zero drift means the
ledger and the cached balance disagree, and no further wallet writes should be
trusted until it is explained.

---

## Backups

- Nightly `pg_dump` to object storage, 30-day retention
- Weekly restore drill into a scratch database
- Verify the drill by running the reconciliation job against the restored copy

A backup you have never restored is not a backup.

---

## Rollback

1. Redeploy the previous application image.
2. Do **not** roll migrations back automatically. Prisma's `migrate resolve`
   marks a migration as rolled back, but the data change may not be reversible.
   Write a forward-fix migration instead.
3. If a settlement bug shipped, disable affected rooms via game config rather
   than editing settled rounds. Corrections belong in
   `game_round_corrections`.

---

## Maintenance mode

Toggle from the admin console, or set the app setting directly. The player app
renders the maintenance page and the game engine stops opening new rounds.
In-flight rounds are allowed to settle first so no bet is left unresolved.
