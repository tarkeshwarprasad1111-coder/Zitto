# Responsible Gaming

This document describes what the product does to keep play safe, and what it
deliberately refuses to do. These are engineering requirements, not marketing
copy.

---

## What Zitto is

Zitto is a Dragon Tiger game played with **virtual coins**. Virtual coins have
no cash value. They cannot be bought, sold, exchanged, or withdrawn. There is no
mechanism in the product to convert them into money, and the real-money module
ships disabled.

## What the analytics can and cannot do

Dragon Tiger rounds are **independent events**. Each round deals from a fresh
shuffle, and the outcome of one round has no influence on the next.

The analytics in this app are **descriptive**. They summarise rounds that have
already been played. They are not, and cannot be, a forecast.

A player who has seen eight Dragons in a row has learned something about the
past eight rounds and nothing at all about the ninth.

### Language rules

The product may say:

- "Historical tendency"
- "Statistical observation"
- "Model estimate"
- "Low confidence"
- "No reliable signal"

The product may never say:

- "Guaranteed win"
- "Sure shot"
- "100% accurate"
- "Fixed result"
- "Double your money"
- "Recover your loss"

These banned phrases are enforced by a CI job that greps the whole codebase and
fails the build on a match. This is not a style preference — a build carrying
that language does not ship.

### Confidence ceiling

Confidence labels stop at **Moderate signal**. There is no high-confidence
tier, and adding one would require changing a shared type that several tests
assert against. This is intentional: for an independent-trial game, no sample
size justifies high confidence about the next round.

### Accuracy is published, not hidden

Every model's real historical accuracy is available at
`GET /api/v1/analytics/model-status` and shown in the UI, including when it is
poor. A model whose accuracy falls below its configured floor is disabled
automatically. Administrators can see the accuracy figures but have no control
that hides them from players.

---

## Player controls

### Limits

A player can set, at any time:

- **Daily bet limit** — total coins that may be staked in a day
- **Daily loss limit** — net loss at which play stops for the day
- **Session time limit** — minutes before the session ends

Limits are checked **server-side at bet placement**, not only in the UI. A
modified client cannot bypass them.

Tightening a limit takes effect immediately. Loosening one takes effect after a
cooling-off delay, so a limit cannot be raised in the middle of a losing run.

### Break reminders

A visible session timer runs throughout play. After a configurable interval the
app interrupts with a break prompt showing time played and net result for the
session.

### Loss awareness

Session summaries show net position plainly, in both directions. Losses are not
softened, buried, or reframed as "almost won".

### Self-exclusion

A player can self-exclude for 24 hours, 7 days, 30 days, 6 months, or
permanently.

On self-exclusion the server:

1. Records a `self_exclusion_records` row
2. Sets the account status to `SELF_EXCLUDED`
3. Revokes every active session immediately
4. Blocks login until the exclusion period ends
5. Rejects bet placement even if a stale token is replayed

Self-exclusion cannot be reversed early by the player, by support, or by an
administrator. That is the point of it.

### Account deletion

A player can request deletion. Personal data is removed within 30 days, except
records that must be retained for audit or legal reasons, which are anonymised
rather than deleted.

---

## Design rules

The interface must not manufacture urgency or pressure.

Prohibited patterns:

- Countdown timers on anything other than the round itself
- "Last chance" or "Don't miss out" prompts
- Flashing or strobing effects
- Hiding the player's selected side or stake
- Obscuring the balance after a loss
- Streak framing that implies a side is "due"
- Loss-chasing prompts of any kind

Required patterns:

- The stake and selection stay visible until the round resolves
- The balance is always on screen
- Results are shown plainly, win or lose
- Rules and payouts are reachable from the game screen in one tap
- Responsible-gaming resources are linked from every screen footer

---

## Age

Registration requires age confirmation. The minimum age is configurable per
jurisdiction and defaults to 18.

---

## Support

Players can open a support ticket from within the app. Tickets about gambling
harm are routed to a priority queue and are never handled by automated replies.

Helpline resources are shown per locale on the responsible gaming page.

---

## For operators

Before enabling any real-money feature you must have, in writing:

- Legal authorisation for each target jurisdiction
- A licence where one is required
- KYC and AML processes with a named responsible owner
- Geo-fencing configured and tested
- Deposit, loss, and session limits enabled by default
- A documented complaints and disputes process
- Tax reporting where required

The `FEATURE_REAL_MONEY` flag exists so this decision is explicit and auditable.
Enabling it without the above is not a configuration choice — it is a
compliance failure.
