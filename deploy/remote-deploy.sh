#!/usr/bin/env bash
#
# What a deploy does on the droplet once the code is already updated. Both
# pipelines run this same file instead of each carrying its own copy of the
# command: the chain migrates a money ledger, and two copies of it drift.
#
# Updating the checkout is deliberately NOT done here. bash reads a script as
# it runs it, so a script that git-resets its own file can resume executing
# at a byte offset in a different version of itself. The caller pulls, then
# invokes this - and holds the deploy lock across both (see the pipelines).
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/root/backups}
# Keep this many dumps. A dump of this database is tiny, so a month of
# deploys still costs the droplet almost nothing.
KEEP_BACKUPS=${KEEP_BACKUPS:-30}

cd "$(dirname "$0")/../backend"

# The dump connects the same way Django does, with the credentials from the
# app's own .env, over TCP. Reading them here rather than assuming a local
# `postgres` superuser means this works whether Postgres was installed on
# the box or is a container publishing 5432 - if the app can reach its
# database, so can this.
if [ -f .env ]; then
  DB_NAME=${DB_NAME:-$(grep -E "^DB_NAME=" .env | cut -d= -f2-)}
  DB_USER=${DB_USER:-$(grep -E "^DB_USER=" .env | cut -d= -f2-)}
  DB_PASSWORD=${DB_PASSWORD:-$(grep -E "^DB_PASSWORD=" .env | cut -d= -f2-)}
  DB_HOST=${DB_HOST:-$(grep -E "^DB_HOST=" .env | cut -d= -f2-)}
  DB_PORT=${DB_PORT:-$(grep -E "^DB_PORT=" .env | cut -d= -f2-)}
fi
# Same fallbacks as config/settings/base.py.
DB_NAME=${DB_NAME:-lab_expertgg}
DB_USER=${DB_USER:-lab_expertgg}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
# shellcheck disable=SC1091
source venv/bin/activate
pip install -q -r requirements.txt

# Taken BEFORE migrate, and `set -e` means a failed dump stops the deploy
# rather than letting it run unprotected. A half-applied migration here is
# not a rollback problem, it is people's balances: the ledger is the only
# record that a bet was ever placed or paid.
echo "==> Backing up $DB_NAME as $DB_USER@$DB_HOST:$DB_PORT"
mkdir -p "$BACKUP_DIR"
DUMP="$BACKUP_DIR/$(date +%F-%H%M%S).dump"
# Two ways the client can be reachable, in the order that needs no install.
# A host with Postgres in a container has no pg_dump of its own but has one
# inside the container - and that one is guaranteed to match the server
# version, which a separately-installed client is not.
DB_CONTAINER=""
if command -v docker > /dev/null 2>&1; then
  DB_CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /postgres/ {print $1; exit}')
fi
if command -v pg_dump > /dev/null 2>&1; then
  PGPASSWORD="${DB_PASSWORD:-}" pg_dump -Fc -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$DUMP"
elif [ -n "$DB_CONTAINER" ]; then
  echo "    through the $DB_CONTAINER container"
  docker exec -e PGPASSWORD="${DB_PASSWORD:-}" "$DB_CONTAINER" pg_dump -Fc -U "$DB_USER" "$DB_NAME" > "$DUMP"
else
  echo "No pg_dump on this host and no Postgres container to borrow one from." >&2
  echo "Run: apt-get update && apt-get install -y postgresql-client" >&2
  echo "This deploy will not migrate a ledger it cannot back up." >&2
  exit 1
fi
echo "    $DUMP ($(du -h "$DUMP" | cut -f1))"
ls -1t "$BACKUP_DIR"/*.dump | tail -n "+$((KEEP_BACKUPS + 1))" | xargs -r rm --

echo "==> Migrating"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "==> Restarting"
systemctl restart expertgg
systemctl is-active expertgg
