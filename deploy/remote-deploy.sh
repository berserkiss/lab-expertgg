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
  # `|| true`: docker being installed does not mean its daemon answers, and
  # under `set -e` a failed command substitution would kill the deploy here.
  DB_CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | awk '$2 ~ /postgres/ {print $1; exit}') || true
fi
# Each is tried in an `if`, which suspends `set -e` for that command, so a
# path that exists but does not work falls through to the next instead of
# ending the deploy. Only running out of paths does that.
BACKED_UP=0
if [ $BACKED_UP -eq 0 ] && command -v pg_dump > /dev/null 2>&1; then
  if PGPASSWORD="${DB_PASSWORD:-}" pg_dump -Fc -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$DUMP"; then
    BACKED_UP=1
  else
    echo "    local pg_dump failed, trying the next way" >&2
  fi
fi
if [ $BACKED_UP -eq 0 ] && [ -n "$DB_CONTAINER" ]; then
  if docker exec -e PGPASSWORD="${DB_PASSWORD:-}" "$DB_CONTAINER" pg_dump -Fc -U "$DB_USER" "$DB_NAME" > "$DUMP"; then
    echo "    through the $DB_CONTAINER container"
    BACKED_UP=1
  else
    echo "    pg_dump in $DB_CONTAINER failed, trying the next way" >&2
  fi
fi
if [ $BACKED_UP -eq 0 ]; then
  # Last resort, and it needs nothing installed: Django's own dumpdata,
  # through the venv that is already active. It saves the rows rather than
  # the schema, which is the half that matters - a migration that goes
  # wrong loses balances, not table definitions. Restore with loaddata.
  echo "    no usable pg_dump, falling back to manage.py dumpdata"
  rm -f "$DUMP"
  DUMP="${DUMP%.dump}.json"
  python manage.py dumpdata --natural-foreign --natural-primary --exclude contenttypes --exclude auth.permission --exclude sessions --output "$DUMP"
fi
echo "    $DUMP ($(du -h "$DUMP" | cut -f1))"
ls -1t "$BACKUP_DIR"/* | tail -n "+$((KEEP_BACKUPS + 1))" | xargs -r rm --

echo "==> Migrating"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "==> Restarting"
systemctl restart expertgg
systemctl is-active expertgg
