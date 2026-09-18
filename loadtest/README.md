# Load tests

Three [k6](https://k6.io) scenarios. Two of them are correctness tests that
happen to need concurrency to ask their question; one is a load test in the
ordinary sense.

| Script | Question | Answer it should give |
| --- | --- | --- |
| [`overdraft.js`](overdraft.js) | can fifty simultaneous bets spend the same gg twice? | exactly `balance / stake` accepted, the rest refused, balance never negative |
| [`ad-reward-cooldown.js`](ad-reward-cooldown.js) | can ten simultaneous claims collect one reward more than once? | at most one granted |
| [`browse.js`](browse.js) | what does the Play screen cost under ordinary use? | p(95) under 800 ms |

They live in this repository, not one of their own, for the same reason the
Postman collection does: the numbers they assert come from
`seed_api_tests`, which is a backend management command. A stake of "a tenth
of the balance" is only meaningful next to the fixture that sets the
balance.

## k6 is not an npm package

It is a Go binary with a JavaScript engine inside it. The scripts are
JavaScript, but they do not run in Node: there is no `require` of npm
modules, no `fs`, and the HTTP calls are synchronous — `http.post()` returns
the response, there is nothing to await.

```bash
winget install k6
```

Or, with no install at all, through Docker:

```bash
docker run --rm -i -e BASE_URL=http://host.docker.internal:8000 grafana/k6 run - < loadtest/overdraft.js
```

## Running them

Two of the three spend money, so the fixture has to be reset first — and
reset again between runs. A second run of `overdraft.js` against a wallet
the first one emptied proves nothing while still reporting success.

```bash
cd backend && python manage.py seed_api_tests && python manage.py runserver
```

```bash
k6 run loadtest/overdraft.js
```

`BASE_URL`, `EMAIL` and `PASSWORD` are environment variables; `ATTEMPTS` and
`CLAIMS` set how big the wave is.

### Do not point them at the droplet

One small server, the real database, and your own wallet inside it. A load
test against production is how you take it down, and it would fill the
ledger with transactions indistinguishable from real ones. Local only.

### And do not measure `runserver`

Django's development server is not what runs in production, and it cannot
take a wave of fifty connections — it drops them rather than answering,
which fails `overdraft.js`'s "answered" gate for a reason that has nothing
to do with the code under test. Observed here: at `ATTEMPTS=50` the money
was still exactly right (ten accepted, forty refused, balance zero) while 33
requests got no response at all.

So: run locally at `ATTEMPTS=10` to check the scripts work, and use the CI
job for the real thing — it runs gunicorn with three workers, the same
server production uses. On Windows there is no local gunicorn at all, since
it is POSIX-only.

## Reading the output

- **`checks`** — must be 100%. A check *records* a result; it does not fail
  the run.
- **`thresholds`** — these fail the run, with exit code 99. That distinction
  is the whole game: a suite of checks with no thresholds reports problems
  and exits 0, and CI calls it green.
- **`http_req_duration`** — look at `p(95)`, not `avg`. The average hides
  the tail and the tail is what a person feels. If `avg` is 80 ms and `p(95)`
  is three seconds, something is queueing — which, in an application built
  on row locks, is worth knowing.
- **`http_req_failed`** — the share of non-2xx. Deliberately high in
  `overdraft.js`, because "not enough balance" is a 400 and is the expected
  answer for forty of the fifty. This is a metric you must *not* put a
  threshold on here.

Each mutating script also asserts its arithmetic in `teardown` and prints
the balance it ended on.

### One trap worth knowing

A threshold on a metric with no samples passes. If `setup()` throws — wrong
password, server down, empty fixture — every gate reports green and only the
script error gives it away. Both mutating scripts therefore count their
attempts and fail unless the wave actually happened:

```js
thresholds: { bets_attempted: [`count==${ATTEMPTS}`] }
```

## In CI

Manual only — `workflow_dispatch` on GitHub, a manual job in the `loadtest`
stage on GitLab. A load test on every push burns minutes and decides
nothing; these are for when you have changed something about locking,
paging or the wallet, and for showing that the locks hold.
