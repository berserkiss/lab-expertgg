# Lab Expertgg

A mobile app for predicting esports matches (CS, LoL), where you bet with a
virtual in-app currency called **gg**. Match data comes from the PandaScore
feed; bets settle automatically when a match finishes.

## Repository structure

```
lab-expertgg/
├── backend/     # Django + DRF API, PostgreSQL
├── mobile/      # React Native (Android)
├── api-tests/   # Postman collection, run headless by newman
├── loadtest/    # k6 scenarios
├── deploy/      # what runs on the droplet: systemd units, deploy script
└── code.md      # the requirements document, and every correction since
```

[`code.md`](code.md) is the one to read first if you want to know why the
code looks the way it does. It records the requirements, the decisions, the
corrections made along the way — including the ones that were wrong the
first time — and a standing list of what is still open.

## Stack

- **Backend:** Python 3.13 / Django / Django REST Framework / PostgreSQL,
  JWT auth (SimpleJWT)
- **Mobile:** React Native 0.87 (Android)
- **Feed:** PandaScore, pulled by a management command on a systemd timer
- **Hosting:** DigitalOcean, one droplet, gunicorn behind nginx
- **CI/CD:** GitLab CI and GitHub Actions, both pointed at the same droplet

## Local development

Both need PostgreSQL. The project expects it on `localhost:5432`; the
credentials live in `backend/.env`.

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

### Mobile

```bash
cd mobile
npm install
npx react-native run-android
```

### Match data

Nothing settles on its own without this — it is the command that writes a
match as finished, which is what pays out the bets on it.

```bash
cd backend && python manage.py sync_pandascore
```

In production it runs every ten minutes on a systemd timer; see
[deploy/README.md](deploy/README.md).

## Tests

Four layers, each answering something the others cannot.

| Layer | What | How to run |
| --- | --- | --- |
| **Django** — 48 tests | payout arithmetic, row locking, idempotent settlement, the overdraw race with real threads | `cd backend && python manage.py test` |
| **Jest** — 15 tests | client logic with no server to check it: token refresh, paging races, the history card's states | `cd mobile && npx jest` |
| **Postman / newman** — 44 assertions | the API as a client sees it: status codes, response shape, paging that must not repeat a row | see [api-tests/README.md](api-tests/README.md) |
| **k6** — 3 scenarios | what only concurrency can ask: can fifty simultaneous bets spend the same gg twice? | see [loadtest/README.md](loadtest/README.md) |

The Django suite knows the domain but talks to the code, so a serializer
that stopped sending a field passes it. The API tests see only what a client
sees. The k6 scenarios use load as an instrument rather than as the subject.

## Pipelines

Both hosts run the same gates, because `git push origin main` reaches both
by configuration.

| | Runs | Gates the deploy |
| --- | --- | --- |
| backend tests | `manage.py test` + a missing-migration check against a real Postgres | yes |
| API tests | newman against a freshly seeded server | yes |
| mobile checks | `tsc --noEmit`, `eslint`, `jest` | no — it ships nothing to the droplet |
| load tests | k6 against gunicorn | manual only |

The deploy itself takes a lock on the droplet and a `pg_dump` before
migrating; a deploy whose backup failed does not migrate. The reasoning is
in [deploy/README.md](deploy/README.md).
