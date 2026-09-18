# API tests

A Postman collection that exercises the backend over real HTTP, and the
environment it runs against.

It lives in this repository rather than in one of its own **because it tests
this API**. The endpoint and its test then change in the same commit, get
reviewed together, and cannot drift apart. A separate repository makes sense
when several services or several teams share one suite; here it would only
mean that a breaking change and the test that catches it land in different
places at different times.

## What it covers

Every request asserts something — none of them exist only to be clicked.

| Folder | What it proves |
| --- | --- |
| 1. Auth | a protected endpoint really is protected, sign-in returns both tokens, a wrong password hands out none |
| 2. Matches and pagination | the response is a page; every match carries the payout rule; **page two shares no row with page one** |
| 3. Bets the rules refuse | stake below the minimum, a team that is not playing, more than the balance — and that none of them moved any gg |
| 4. Placing a bet | 201, the balance falls by exactly the stake, the bet appears in the match book and in history |
| 5. Leaderboard | rows are shaped right and ranked highest first |

Two of these are regressions rather than hypotheticals. Paging used to
repeat rows from page one on page two, because `start_time` alone is not a
unique ordering. And a refusal that still debited would be the worst bug in
this system, so it is checked explicitly rather than assumed.

Order matters: the refusals run before the successful bet, so a refusal
cannot be masked by a balance the bet already changed. The token is captured
once at sign-in and inherited by everything after it through the
collection's bearer auth — it is never pasted into a request.

## Running it

The collection needs a known starting point: a user, a balance, and enough
matches for a second page. That is what the seed command is for, and it is
safe to run repeatedly.

```bash
cd backend && python manage.py seed_api_tests && python manage.py runserver
```

Then, from the repository root:

```bash
npx newman run api-tests/expertgg.postman_collection.json -e api-tests/local.postman_environment.json
```

Or import both files into the Postman app and run the collection there — the
same assertions, with somewhere to click.

## In CI

Both pipelines run it as a second gate beside the unit suite: GitHub's
`api-tests` job (`deploy` declares `needs: [test, api-tests]`), GitLab's
`api_tests` in the `test` stage. Each boots Postgres, migrates, seeds,
starts the server and runs newman headless, publishing the JUnit report.

It is worth having *both* gates because they fail at different things. The
Django suite knows the domain — payout arithmetic, locking, idempotency —
but talks to the code, so a serializer that stopped sending a field, a
status code that changed, or a `next` link that repeats a row can all pass
it. This one only sees what a client sees.

## The password in `local.postman_environment.json`

It is not a secret. It belongs to the fixture user that `seed_api_tests`
creates and exists only in test databases. A real credential would go in a
CI variable and never in a committed file.
