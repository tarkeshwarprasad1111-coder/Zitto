#!/usr/bin/env bash
#
# Runs once, right after the Codespace container is created.
#
# Tolerant by design: if migrations fail (database still warming up, schema
# drift, whatever) the container should still come up so the failure can be
# read and fixed from a terminal — a half-built Codespace is easier to debug
# than one that refuses to start.
set -uo pipefail

cd "$(dirname "$0")/.."

echo "==> Preparing .env"
if [ ! -f .env ]; then
  cp .env.example .env
  # Inside the devcontainer the databases are other compose services, not
  # localhost. Rewrite the two hostnames that differ from a local setup.
  sed -i 's|@localhost:5432|@postgres:5432|' .env
  sed -i 's|redis://localhost:6379|redis://redis:6379|' .env
  echo "    created .env (db hosts pointed at the compose services)"
else
  echo "    .env already present, leaving it alone"
fi

echo "==> Enabling pnpm"
corepack enable
corepack prepare pnpm@8.15.0 --activate

echo "==> Installing dependencies (this is the slow part, ~2 min)"
pnpm install --frozen-lockfile || pnpm install

echo "==> Generating Prisma client"
pnpm --filter @zitto/api prisma:generate

echo "==> Waiting for Postgres"
for i in $(seq 1 30); do
  if pg_isready -h postgres -U zitto -q 2>/dev/null; then
    echo "    ready"
    break
  fi
  sleep 2
done

# No migration files are committed yet, so the first run has to *create* the
# initial migration rather than replay existing ones. Later runs just replay.
if [ -d apps/api/prisma/migrations ]; then
  echo "==> Applying migrations"
  MIGRATED=$(pnpm --filter @zitto/api exec prisma migrate deploy && echo ok)
else
  echo "==> No migrations yet — creating the initial one from schema.prisma"
  MIGRATED=$(pnpm --filter @zitto/api exec prisma migrate dev --name init && echo ok)
fi

if [ "${MIGRATED:-}" = "ok" ] || [ -d apps/api/prisma/migrations ]; then
  echo "==> Seeding"
  pnpm --filter @zitto/api prisma:seed || echo "    seed skipped — not fatal"
else
  cat <<'EOF'

    Migrations did not apply. Read the error above, then retry from a terminal:

        pnpm --filter @zitto/api exec prisma migrate dev --name init

EOF
fi

cat <<'EOF'

  ────────────────────────────────────────────────
   Setup finished. Start everything with:

       pnpm dev

   Then open the Ports tab:
       3000  Player app
       3001  Admin console
       4000  API      (docs at /docs)
  ────────────────────────────────────────────────

EOF
