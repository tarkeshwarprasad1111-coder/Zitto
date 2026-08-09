# Security Checklist

Status legend: `[x]` implemented · `[ ]` planned · `[!]` requires operator action before launch

---

## Authentication

- [x] Passwords hashed with Argon2id (memoryCost 19456, timeCost 2)
- [x] Access tokens short-lived (5 minutes)
- [x] Refresh tokens rotated on every use; the old one is revoked
- [x] Refresh tokens stored as hashes, never in plaintext
- [x] OTP codes stored as hashes with a 5-minute TTL
- [x] OTP attempt cap (5) with lockout
- [x] Session revocation, including "log out everywhere"
- [ ] TOTP two-factor for players
- [x] Two-factor required for admin accounts
- [!] Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` before first deploy

## Authorization

- [x] Role-based access control (`guest`, `player`, `moderator`, `admin`, `super_admin`)
- [x] Route guards on every non-public endpoint
- [x] Moderators cannot touch financial or game-result data
- [x] Feature flags gated to `super_admin`
- [ ] Per-object ownership checks audited end to end

## Game integrity

- [x] Server-authoritative round state — the client never computes outcomes
- [x] Outcomes derived from a CSPRNG seed committed before betting opens
- [x] Rejection sampling on card selection (no modulo bias)
- [x] `serverSeedHash` published before the round; `serverSeed` revealed after
- [x] Public verification endpoint, no auth required
- [x] Settled rounds signed with an HMAC held only by the game engine
- [x] Corrections append a new record; settled rows are never edited
- [x] Redis lock prevents two engine replicas settling the same round
- [!] Give the game engine a database role with append-only rights on
      `game_rounds`, `wallet_ledgers`, and `audit_logs`

## Money handling

- [x] All amounts are `BigInt` — no floating point
- [x] Double-entry ledger; balances are never written directly
- [x] `SELECT … FOR UPDATE` row lock inside every wallet transaction
- [x] Idempotency key required on every mutating wallet operation
- [x] Debits rejected when they would produce a negative balance
- [ ] Nightly reconciliation job comparing ledger sum to stored balance
- [x] Real-money module disabled by default behind a feature flag

## Input handling

- [x] Zod validation on every request body, query, and param
- [x] Prisma parameterised queries (no string-built SQL)
- [x] Raw SQL limited to `FOR UPDATE` locks with bound parameters
- [ ] File upload validation — magic-byte sniffing, re-encoding, size cap
- [ ] Uploaded files served from a separate origin

## Transport and headers

- [!] HTTPS enforced in production (HSTS, redirect from HTTP)
- [ ] Content Security Policy
- [x] CORS restricted to configured origins
- [ ] `helmet` security headers verified in production build
- [x] Secure, HttpOnly, SameSite cookies where cookies are used

## Rate limiting and abuse

- [x] Global throttling on the API
- [x] Stricter limits on auth endpoints
- [x] Per-socket message budget on the realtime service
- [ ] CAPTCHA on repeated OTP requests
- [ ] Disposable-number blocklist
- [ ] Collusion detection for multiplayer and tournaments

## Secrets and data

- [!] No secrets in the repository — CI scans for common key formats
- [!] Production secrets supplied through the platform's secret store
- [ ] Encryption at rest for 2FA secrets and KYC documents
- [x] Passwords, OTPs, and tokens excluded from logs
- [x] Data minimisation — only what the product needs

## Auditing

- [x] Immutable `audit_logs` table
- [x] Every admin mutation records actor, action, target, and reason
- [x] Request IDs propagated and logged
- [ ] Alerting on suspicious admin activity

## Privacy and compliance

- [x] Age confirmation at registration
- [ ] Data export within 30 days of request
- [ ] Data deletion within 30 days of request
- [x] Self-exclusion enforced server-side at bet placement
- [x] Responsible-gaming limits checked before every bet
- [!] Legal review before enabling any real-money feature
- [!] Jurisdiction check and geo-fencing configuration

## Dependencies

- [x] `pnpm audit` in CI
- [ ] Renovate or Dependabot enabled
- [ ] SBOM generated per release

---

## Pre-launch gate

Do not deploy to production until every `[!]` item is resolved and signed off by
a named owner. Enabling `FEATURE_REAL_MONEY` additionally requires documented
legal authorisation for each target jurisdiction.
