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
