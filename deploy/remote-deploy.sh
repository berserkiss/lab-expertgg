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
DB_NAME=${DB_NAME:-lab_expertgg}
# Keep this many dumps. A dump of this database is tiny, so a month of
# deploys still costs the droplet almost nothing.
KEEP_BACKUPS=${KEEP_BACKUPS:-30}

cd "$(dirname "$0")/../backend"
# shellcheck disable=SC1091
source venv/bin/activate
pip install -q -r requirements.txt

# Taken BEFORE migrate, and `set -e` means a failed dump stops the deploy
# rather than letting it run unprotected. A half-applied migration here is
# not a rollback problem, it is people's balances: the ledger is the only
# record that a bet was ever placed or paid.
echo "==> Backing up $DB_NAME"
mkdir -p "$BACKUP_DIR"
DUMP="$BACKUP_DIR/$(date +%F-%H%M%S).dump"
su postgres -c "pg_dump -Fc $DB_NAME" > "$DUMP"
echo "    $DUMP ($(du -h "$DUMP" | cut -f1))"
ls -1t "$BACKUP_DIR"/*.dump | tail -n "+$((KEEP_BACKUPS + 1))" | xargs -r rm --

echo "==> Migrating"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "==> Restarting"
systemctl restart expertgg
systemctl is-active expertgg
