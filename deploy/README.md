# Deploying the match sync

Bets do not settle on their own. `sync_pandascore` is what saves a match as
finished, and saving it is what fires the payout signal — so the command has
to run on a schedule or bets sit `active` holding their stake.

Install the timer once, on the droplet:

```bash
cp deploy/expertgg-sync.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now expertgg-sync.timer
```

Check it:

```bash
systemctl list-timers expertgg-sync.timer   # when it next fires
journalctl -u expertgg-sync.service -n 50   # what the last run did
systemctl start expertgg-sync.service       # run it right now
```

The unit files assume the layout the deploy pipeline creates:
`/root/lab-expertgg` with the virtualenv at `backend/venv`. They are not
installed by CI — the deploy job only updates code, runs migrations and
restarts `expertgg`, so this is a one-time manual step per server.

## What a deploy runs

Both pipelines ssh in and run the same thing:

```bash
flock -w 600 /var/lock/expertgg.deploy -c 'cd /root/lab-expertgg && git fetch origin main && git reset --hard origin/main && bash deploy/remote-deploy.sh'
```

Two details in that line are deliberate.

**The lock.** `git push origin main` reaches GitLab and GitHub at once —
that is how the remote is configured, not an accident — so both pipelines
start a deploy within seconds of each other. They `git reset --hard` and
migrate the *same* directory. A provider-level concurrency group cannot help,
because the two racers are in different providers; the only place they meet
is the droplet, so the lock lives there. The second deploy waits up to ten
minutes and then fails loudly rather than interleaving.

**The script.** The chain used to be written out in full in both pipeline
files, which is two copies of a command that migrates a money ledger. It is
now [`remote-deploy.sh`](remote-deploy.sh), and it takes a `pg_dump` into
`/root/backups` before `migrate`. The dump is not optional: `set -e` means a
deploy whose backup failed does not migrate. Thirty are kept.

Restoring one:

```bash
systemctl stop expertgg
su postgres -c "pg_restore -c -d lab_expertgg /root/backups/2026-09-18-1430.dump"
systemctl start expertgg
```

Still not in this repository, and still done by hand on the droplet: the
`expertgg` unit itself, the nginx site, TLS, and the Postgres role and
database. The box cannot be rebuilt from a clean droplet with what is here.
