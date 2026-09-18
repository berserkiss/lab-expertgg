# Task 2 — Simplified 2: requirements

This document describes what "Simplified 2" means for this project, grounded
in the actual current codebase (not assumptions). It's meant to be specific
enough that another model/dev could implement the same thing from this file
alone. Anything marked **ASSUMPTION** is a default I picked where the
assignment or designs didn't say explicitly — flag it if wrong and this file
gets corrected, not the chat history.

## 1. What already exists (verified against code, not the demo video)

The demo video (`expert gg demo.mov`) shows a **more advanced reference
app** — game/day filter tabs, a "Bet placed!" confirmation modal, a working
"Get coins" ad-reward flow, Settings, 4 games (LoL/CS/Dota2/Valorant). **None
of that is what we're building.** The actual target is the Figma flow
("DK. Play/History/Leaderboard/Account/Get coins" + "Play/with match" +
"Play/no match"), which is simpler and matches most of what's already coded.

### Backend (Django + DRF + SimpleJWT, `backend/apps/`)

- `accounts`: custom `User` (email login, `avatar` image field). No sign-up
  screen exists client-side yet — login only.
- `matches`: `Game` -> `Tournament` -> `Match` (team_a/team_b FKs to `Team`,
  `start_time`, `status` upcoming/live/finished, `winner`). Fully generic
  schema, but **zero real seed data** — no fixtures, no management command,
  no celery/cron. Matches only exist if entered by hand in Django admin.
- `votes`: `Vote` = a bet (user, match, predicted_team, stake, status
  active/win/lose, payout). Betting is **fully implemented and working**:
  `POST /api/matches/{id}/vote/` validates stake vs balance, match must be
  `upcoming` **or `live`** (see §3 — betting on live matches is in scope,
  not just upcoming), predicted_team must belong to the match. Atomic via
  `select_for_update`.
- `wallet`: `Wallet.balance` (the "gg" currency) + `CoinTransaction` ledger.
  Payout is **fixed-odds**: win = `stake * 2 + 2`, lose = `0`
  (`WIN_BONUS = 2`, a constant in `apps/votes/signals.py`, mirrored in the
  mobile UI string "win 2gg + bonus"). Resolution happens via a `post_save`
  signal on `Match` when an admin sets `status=finished` + `winner` — this
  stays manual for now (see §3).
- **No PandaScore integration exists at all.** No HTTP client library is
  even installed (`requirements.txt` has none of requests/httpx/aiohttp).

### Mobile (React Native, `mobile/src/`)

- Screens: Splash, SignIn (only auth screen — no sign-up), Play,
  MatchVote, Book, History, Leaderboard, Account (title + Log out button
  only), GetCoins (dead stub, unreachable, no `onPress`).
- Tab bar: Play / History / Leaderboard / Account — matches the Figma
  labels ("Leaders" in Figma is just a shorter label for the same tab).
- `MatchVoteScreen` already matches the Figma bet-placement screen almost
  exactly: numeric keypad (default stake 10, +/- steppers, backspace,
  Cancel), team selection highlight, "Vote / win {WIN_BONUS}gg + bonus"
  button. **No changes needed here.**
- Game/date filter tabs exist in code but are **commented out** (code
  comment: "re-add tabsRow/rangeRow once design comes back for them") — the
  Figma flow confirms they should stay hidden. Leave them hidden.
- No confirmation modal after voting (screen just closes) — matches Figma
  (no such modal exists there either). Leave as-is.
- No profile-editing screen exists anywhere (no `EditProfile` file, no
  update-profile API call, no avatar upload).
- No empty-state UI for an empty match list — Figma's "Play/no match" shows
  a centered crossed-swords icon + "No Matches" text, same header/tab-bar
  as the normal Play screen.

## 2. Scope of Task 2 ("Simplified 2")

### 2.1 Primary: real match data via PandaScore (required)

Replace manual admin-entered matches with a PandaScore-backed feed.

**Auth**: personal token from the PandaScore dashboard, sent as
`Authorization: Bearer <token>`. Store as `PANDASCORE_API_KEY` in settings/env
(never commit it — `.env`, already gitignored in this repo's convention).

**Fetching**: `GET https://api.pandascore.co/matches`
- `filter[videogame]=cs-go` (and/or `league-of-legends` — see open question
  below on which games)
- `filter[status]=not_started` for upcoming matches (what we actually need
  to bet on), optionally also fetch `running`/`finished` for status sync
- Paginate with `page`/`per_page` (max 100/page); free tier = 60 req/min,
  1000 req/hour — trivial to stay under for a periodic sync.

**Sync mechanism (new)**: a Django management command
(`backend/apps/matches/management/commands/sync_pandascore.py`) that:
1. Calls the PandaScore matches endpoint for the configured game(s).
2. Upserts `Team` rows (by PandaScore team id or by name — **ASSUMPTION**:
   match by name since there's no `external_id` field yet; add one if
   duplicate-name collisions become a problem).
3. Upserts `Tournament` (from `league`/`serie` fields) and `Game` (from
   `videogame`).
4. Upserts `Match`: `start_time` from `scheduled_at`/`begin_at`, `status`
   mapped `not_started`→`upcoming`, `running`→`live`, `finished`→`finished`,
   `winner` set from PandaScore's `winner`/`winner_id` when status is
   `finished`.
5. Setting a `Match` to `finished` with a `winner` already triggers the
   existing `resolve_votes_on_match_finished` signal — **no changes needed
   to the betting/payout logic**, it just needs real matches flowing in.

**ASSUMPTION**: the sync command resolves match status/winner automatically
from PandaScore (not manual admin resolution) — this is what "получаем
данные о матчах с помощью data feed" implies, and it's what makes the whole
loop (bet -> match finishes -> payout) work without a human in the loop.
Running the sync itself can be a manually-triggered management command for
Simplified 2 (no need for celery/cron) — just run it periodically by hand or
via a simple loop/cron entry when demoing.

**Which games**: **OPEN QUESTION**, not yet answered. Current test data
only covers CS (`cs-go`) and LoL (`league-of-legends`); the Figma mockups
only show Counter-Strike. Defaulting to **CS only** for the sync command's
initial game list (`PANDASCORE_GAMES = ["cs-go"]` in settings, easy to
extend) since that's the only game visible in the actual target designs —
correct this if LoL should be included too.

### 2.2 Optional: profile management (only if time allows)

Now concretely scoped by the Figma "DK. Account" + edit-profile mockup:
- **Account screen addition**: an "Edit profile" button (Account screen
  currently only has Log out).
- **New EditProfile screen**: avatar (tap "+" overlay to pick/upload a new
  photo), a text field for display name (pre-filled with current value),
  "Save" button.
- **New backend endpoint**: `PATCH /api/auth/me/` (or similar) accepting
  `avatar` (multipart) and a display-name field. `accounts.User` already
  has `avatar` — needs a display-name field added if the current model only
  has Django's default `first_name`/`username` (verify before implementing;
  reuse `username` if it's already free-text and unique-per-user isn't
  required for display purposes — **ASSUMPTION**: reuse `username` rather
  than adding a new column, unless `username` is also the login identifier
  duplicate of `email` in which case add a small `display_name` field).

## 3. Explicitly out of scope for Simplified 2

Per the demo video vs. the actual Figma target, these are NOT required:
- Game/date filter tabs on Play (stay hidden)
- Settings screen
- Sign-up / registration flow
- Dota 2 / Valorant support (unless the open question above resolves to
  include more than CS)
- PandaScore WebSocket live feed (free-tier REST polling for
  schedules+results is sufficient; no need for real-time push)
- Dynamic/market-based odds (fixed `stake*2+2` payout stays as-is)

**Reversed from an earlier draft of this doc** (corrected per direct
feedback, not just in chat):
- **Betting on live matches is IN SCOPE**, not just upcoming. `votes/
  serializers.py` now allows `match.status in (UPCOMING, LIVE)` — only
  `FINISHED` closes betting. A live match's `start_time` is necessarily
  already in the past, so status (not start_time) is the authoritative
  check.
- **"Bet placed!" confirmation banner is IN SCOPE.** Shown inline on the
  Play screen for `CONFIRMATION_MS` (2.5s) after a successful vote: "Bet
  placed! {stake} gg on {team}".
- **The "Get coins" ad-reward flow is IN SCOPE and now fully wired**, not a
  disconnected stub:
  - Backend: `GET`/`POST /api/wallet/ad-reward/` (`apps/wallet/views.py`).
    `GET` checks cooldown status without side effects; `POST` grants
    `AD_REWARD_AMOUNT` (250 gg, matches the reference video's "+250 coins")
    if the cooldown has elapsed, using the existing `CoinTransaction.Type.
    AD_REWARD` ledger entry type (was defined but unused before). Cooldown
    is derived from the most recent `AD_REWARD` transaction's timestamp, no
    new field needed.
  - **ASSUMPTION**: `AD_REWARD_COOLDOWN_SECONDS = 60` (a constant in
    `apps/wallet/views.py`) — short on purpose so this is easy to demo
    live; tune freely, nothing else depends on the exact value.
  - Mobile: `GetCoinsScreen` fetches status on focus, runs a local 1s
    countdown while on cooldown (button disabled, shows "Available in
    Xs"), and calls the reward endpoint on tap when available, refreshing
    the balance and showing a native "Success — +N coins added to your
    balance!" alert (matches the reference video's wording).
  - Reached from **any** tab: tapping the wallet-icon `BalanceBadge` (shown
    in every screen's header) navigates to `GetCoins` under the Account
    stack via `useNavigation().navigate('Account', {screen: 'GetCoins'})`
    — not just from within the Account tab.
- **Team logos come from PandaScore, not just uploaded files.** `Team`
  gained a `logo_url` field (PandaScore's `opponent.image_url`, captured by
  `sync_pandascore`); `TeamSerializer.logo` prefers a locally-uploaded
  `logo` file if one exists, else falls back to `logo_url`. Teams PandaScore
  doesn't have an image for (~22% in practice) still show the swords-icon
  placeholder client-side.

## 4. Deliverables (from the assignment)

1. Android **.apk** build of the mobile app.
2. A link to this artifact (`code.md`) — git repo or a file in Slack — plus
   the corresponding backend/mobile changes as commits.

## 5. Open questions to resolve before/while implementing

1. Which PandaScore game(s) to sync — CS only, or CS+LoL? (defaulted to CS
   only above)
2. Does match resolution (winner) come from PandaScore automatically, or
   stay a manual admin action? (defaulted to automatic above)
3. ~~Profile display name: reuse an existing field or add `display_name`?~~
   **Resolved**: `User.username` is already the display-name field the
   client reads (`api/auth.ts`'s `User.username`, matched against in
   `LeaderboardScreen`) — reuse it, no new column needed.

## 6. Progress log

- **Mobile**: new Figma-exported assets (`wallet.svg`, `coins.svg`,
  `coins-glow.svg`, `film.svg`, `clock.svg`) added under
  `mobile/src/assets/`. `colors.win`/`colors.lose` corrected to the real
  Figma values (`#12CC46`/`#FF383C`). New shared `BalanceBadge` component
  (money-bag icon + `{balance} gg`) wired into the header of all 4 tabs
  (Play/History/Leaderboard/Account) + GetCoins, matching every Figma
  frame. Play's match-card countdown now has the clock icon. GetCoins got
  its illustration (coins + glow) and the film icon on its button — still
  visually only, no backend wiring (stays out of scope, see §3).
- **Backend**: `apps/matches/pandascore.py` (API client) +
  `sync_pandascore` management command implemented. Added nullable
  `external_id` to `Tournament`/`Team`/`Match` for idempotent upserts
  (migration `0003`). Verified the token works against the live API
  (`GET /matches` for `cs-go`/`not_started` returned real data). **Not yet
  verified end-to-end against the DB** — local Postgres isn't running in
  this environment; run `python manage.py migrate` then
  `python manage.py sync_pandascore` once it's up, and check Django admin
  for synced matches.
- **Resolved**: bet placement now expands *inline* on the Play list per the
  "Play/with match" Figma frame (team highlight, keypad, Vote button,
  countdown, all within the tapped match's card; other cards stay visible).
  `MatchVoteScreen` and its route were removed — redundant once voting
  moved into `PlayScreen` directly.
- **Live-refresh**: `useFetchList` takes an optional `pollMs` and silently
  re-fetches on that interval while a screen is focused (on top of its
  existing focus/pull-to-refresh reload). Wired into Play/History/
  Leaderboard at 15s, and `BalanceBadge` polls `refreshUser()` the same way
  — match status, bet outcomes, rankings, and the header balance all update
  on their own, no manual reload needed.
- **Backend**: `MatchListView` now excludes `status=finished` — matches
  can only be bet on while upcoming/live, so finished ones have no reason
  to clutter the Play feed (only became visible once `sync_pandascore`
  started backfilling real finished matches alongside upcoming/live ones).
- **Design-correction pass** (verified against a real Figma dev-mode export,
  not just the earlier screenshots):
  - Team-selection buttons: background `#666C7C`, white border (blue when
    selected), white text — was rendering as the dark card color, plus long
    real team names (e.g. "QUINTESSÊNCIA") were overflowing the button
    instead of staying inside it.
  - Long team names: `numberOfLines={1}` + `adjustsFontSizeToFit` +
    `minimumFontScale={0.55}` (multi-line wrapping still let single long
    words break mid-word on Android, e.g. "QUINTESSÊNCI"/"A" — shrinking to
    fit one line reads cleaner than a broken word).
  - Tournament/game name text: `#959595` (`colors.textGray`), was the wrong
    muted-blue token.
  - Backspace key: real delete icon (Figma-exported `delete.svg`) instead
    of a plain "&lt;x" text button.
  - Vote/keypad accent color: `#FFA800` (`colors.coin`), was `#F5A623`.
  - Added client-side stake validation (can't submit 0/empty, can't exceed
    current balance) with an inline red error message, in addition to the
    existing server-side check — the Vote button disables itself rather
    than only failing after a round-trip.

### Design-correction pass 2 (side-by-side against the Figma frames)

Corrections raised after comparing the running app against the Figma
"DK. Play"/"DK. Get coins" frames pane-by-pane:

- **Match cards and history rows have no outer border at all** — they
  are separated from the screen by their fill alone. What is outlined is
  the *badge*: "Book" is a blue-outlined pill with blue-on-dark text,
  not a solid blue chip, and a history row's status badge is outlined in
  its status colour (green won / red lost / orange active) with matching
  text. `colors.border` (`rgba(255,255,255,0.14)`) is for inner
  outlines only — keypad keys, the stepper group, the divider.
- **Card fill is `#191B28`** on Play, the same token already used by
  history rows, the leaderboard rows and the Get Coins panel.
- **The countdown is a pill, not loose text** — its own `#090C15`
  rounded background, centred under the teams.
- **Long team names truncate, they do not shrink.** Reverted the
  `adjustsFontSizeToFit` approach from pass 1: Figma shows
  "QUINTESSÊN…" with an ellipsis at full size, so it is
  `numberOfLines={1}` + `ellipsizeMode="tail"` only.
- **Team buttons are outline only** — no fill at all, `#666C7C` border
  (blue when selected), name in regular weight at 12pt inside a taller
  box (56pt min height) than the text alone needs.
- **The countdown pill hangs off the bottom of the card**, not floating
  above it: it is the same colour as the screen behind the card and its
  bottom edge meets the card's, so it reads as notched in.
- **The tournament name stays centred on the card even with a "Book"
  badge** — the badge is positioned absolutely rather than sharing the
  header row, which was pushing the name off-centre.
- **The balance bag icon matches the balance text's height** (21×20,
  was 28×27 and towering over it).
- **The Get coins button reads just "Get coins"** — no reward amount in
  the label — and the panel around it is tighter than a default
  spacing pass gives: 24pt panel padding, 16pt between title, coins and
  button.
- **The leaderboard tab is labelled "Leaders"**, which also removes the
  need for the shrink-to-fit label hack the longer word required.
- **Bet keypad is two rows of six outlined keys.** 1–6 / 7, 8, 9, 0 and
  a double-width 00, each key its own bordered box, with the orange Vote
  button filling the column to their right across both rows — not a
  4-wide grid of bare digits with Vote as a trailing cell. The Vote
  label is two sizes: "Vote" bold over a smaller "win 2gg + bonus".
- **Stake stepper is one bordered group** — minus, a white input-style
  field holding the amount in dark text, plus — with the backspace and
  Cancel buttons as separate equal-height outlined buttons beside it.
  The white field fills the group's full height; inset like a real
  input rather than floating inside it with dark gaps above and below.
- **The tournament name outranks the game name** (14pt over 11pt) —
  at the same size the header reads as two equal lines of grey.
- **A divider separates the teams row from the bet controls** when a
  card is expanded.
- **Confirmations are in-app modals, not OS alerts or banners.** Both
  "Bet placed!" and the Get Coins "Success" use a shared
  `ConfirmationModal` (dark card, accent-coloured check badge,
  auto-dismiss); `Alert.alert` is only kept for error paths.
- **The Get coins button lives inside the Free Coins panel**, sized
  exactly like the shared `Button` component (height 50, radius 24).
- **Vote button text is white**, not dark, on the orange fill.
- **The stake field is `#EBEBE9`**, an off-white, not pure white.
- **"VS" is white and larger** (18pt medium) than the team names — it
  was set in the muted blue-grey used for captions and read as
  secondary to the names it separates.
- **The countdown plate has a fixed 100pt width and an 8pt radius** —
  it does not shrink to hug a short label like "Live", and it is a
  rounded plate rather than a fully-rounded pill.

### History rows (DK.History frame)

A history row is not a text list — it mirrors the Play card:

- Outlined status badge (Win green / Lose red / Active orange) on the left of
  the top row, `Game: Tournament` muted on the right, truncating rather than
  colliding with the badge.
- The two teams as the same outlined boxes the Play screen uses, with the
  team this bet was placed on carrying the blue border.
- Bottom row: the placement time as `17 Jan 14:23` on the left, and the
  result as an outlined badge in the status colour on the right. A settled
  bet shows a sign (`+ 100 gg` / `- 70 gg`); one still running shows the
  stake at risk with no sign (`20 gg`).

### One match box, both screens

Play and History render the same match, so the team box is a single
component (`components/TeamBox.tsx`) owning its own measurements — 56pt
min height, 12/8 padding, 8pt radius, 6pt icon gap, 12pt regular name —
rather than a set of numbers copied into each screen and drifting apart.

The row around it is also identical on both: a card of 16pt padding inside
a list of 16pt padding, and `[box flex:1][28pt][box flex:1]`. Play draws
"VS" in that 28pt middle column; History leaves it empty. Fixing the
column's width rather than letting "VS" measure itself is what keeps the
boxes the same width on a screen that draws no VS.

### Who settles a bet

Nothing settles a bet on its own. The payout signal
(`apps/votes/signals.py`) fires on `Match.post_save`, and the only thing
that ever saves a match as finished is the `sync_pandascore` command. So a
bet resolves exactly when that command runs — there is no scheduler, no
celery, no cron. **The command has to be run (by hand or from a cron
entry) for bets to pay out at all.**

Running the feed sync is not enough by itself. The feed endpoints return a
recency window (one page, `finished` sorted by `-end_at`), so a match that
finished more than a page of results ago never comes back through them —
the bet on it would hold its stake as `active` forever no matter how often
the sync ran. The command therefore ends with a settle pass: every match
that still carries an active vote and is not yet finished is fetched from
PandaScore **by id** and re-synced. That is one request per match with
money on it, so it stays cheap.

A match can also finish with no winner the feed will ever name — a
walkover, a forfeit, data the provider never fills in. Neither receiver
settles that, so the settle pass revisits **every** match still holding an
active vote regardless of its local status (a match with an open bet is
unsettled by definition), and once such a match is more than 12 hours past
its start it is refunded outright. `refund_active_votes()` is a named
callable for exactly this reason: a refund has to be invocable, not only
reachable by saving a Match.

A voided match refunds. `canceled` maps to `Match.Status.CANCELED`, a
terminal status with no winner, and saving a match into it fires
`void_votes_on_match_canceled`: every active vote on it goes to
`Vote.Status.VOID` and its stake is credited back as a `bet_refund`
transaction. Both resolution paths only ever touch votes still in `ACTIVE`,
which is what stops a repeated sync of the same match from paying out or
refunding twice. `postponed` is not terminal — the match is still going to
be played, so it stays `UPCOMING` and simply picks up its new start time.
Canceled matches are excluded from the Play list alongside finished ones.

**Scheduling is part of the system, not an afterthought.** `deploy/`
carries a systemd service + timer that runs the sync every 10 minutes, and
`deploy/README.md` has the one-time install. The interval is the worst-case
delay between a match ending and the wallet seeing the payout. CI does not
install these — the deploy job only updates code, migrates and restarts —
so it is one manual step per server.

### Status and result colours

Win `#12CC46`, Lose `#FF383C`, Active `#F5A623` — used as the *outline* of
the status badge with matching text. The result badge at the bottom of a
history row is different: a neutral `#666C7C` outline with only its text in
the status colour.

### The stake stepper is a light control

Grey `#EBEBE9` body carrying dark − and + glyphs, with the amount itself on
a plain white field between them — not a dark control with light glyphs.

### The ledger has to explain the balance

`Wallet.balance` is denormalised, and `credit()`/`debit()` are the only
writers that also record a `CoinTransaction`. Anything that sets a balance
around them — seeding, an edit in the admin — leaves the ledger no longer
summing to the balance, which makes it useless for auditing where a user's
gg came from. `manage.py reconcile_wallets` reports the drift and, with
`--apply`, books the difference as an explicit `adjustment` transaction
rather than quietly rewriting either side. Run it after any out-of-band
balance change.

### The bet lifecycle is a set of operations, not side effects

`apps/votes/betting.py` owns everything that moves gg: `place_bet`,
`settle_match`, `refund_active_votes`, and `payout_for`. Each is an
ordinary function, so a bet can be placed or settled by a management
command, a domain test or a background job — not only by an HTTP request
arriving, or by someone remembering that saving a `Match` has monetary
consequences.

- `apps/votes/signals.py` is wiring and nothing else: a match reaching a
  terminal status calls the matching operation.
- `VoteCreateSerializer` is an HTTP adapter. It translates
  `BettingError` into a DRF field error and holds no rules of its own.
- The payout is defined once, in `betting.py`, and **sent to the client**
  on every match as `payout_multiplier` / `payout_bonus`. The Vote button
  quotes the server's rule instead of a constant compiled into the app,
  so changing the payout cannot leave the screen lying.

### The feed is a boundary

`pandascore.py` raises exactly one exception type outward. Previously only
a missing key and a 429 were wrapped, so any other upstream failure escaped
as `requests.HTTPError` and aborted the run **before** the settle pass —
one provider hiccup and nobody got paid that cycle. Every failure now
arrives as `PandaScoreError` carrying `status_code`, and in the settle pass
a single unreachable match is skipped rather than ending the pass; only a
rate limit stops it, since every further request would hit the same wall.

**A fixture is never rewritten under an open bet.** If the feed changes a
match's opponents while bets are on it, the stored teams stay as they were
and the change is reported. The teams are what people bet on; swapping them
underneath a stake is not a data update.

### Running the tests

Locally, from `backend/` with the virtualenv active:

```
python manage.py test
```

They need Postgres reachable — the same `lab-expertgg-db` container local
development uses. Django creates and drops its own `test_*` database, so a
run never touches development data.

Both pipelines now run the suite as a `test` stage and only deploy if it
passes (`needs: test` on GitHub, a `test` stage before `deploy` on GitLab),
each against a throwaway Postgres service. The suite covers the payout
maths and the wallet's behaviour under concurrent bets; a deploy that
migrates a money ledger is the wrong moment to discover a test was already
red. That is not hypothetical here: a stale test had been failing unnoticed
because nothing ran it.

### Lists are paginated, and their order has to be unique

`PAGE_SIZE` is 20, and the app used to take `results` and drop `next` — so
Play, History and the leaderboard silently showed the first twenty rows and
looked complete. The list fetchers now return the whole page, `useFetchList`
exposes `loadMore()`, and Play and History hand it to `onEndReached`. A poll
tick refuses to run once the user has paged further, so a background refresh
cannot yank away what they scrolled to.

The leaderboard is served whole instead: it is a top 100 by definition, and
the screen scrolls straight to the logged-in player's row, which paging
would hide behind a scroll they have to know to perform.

**Every paginated list orders by something unique.** `start_time` alone is
not: 83 matches here share 27 distinct start times, up to nine at the same
instant, and Postgres may order ties differently per query — so page two
repeated rows from page one and skipped others entirely. Each list now
carries `id` as a tiebreak. Ordering is part of pagination being correct,
not a display preference.

## Corrections found by re-checking the earlier ones

An architecture review produced a list of judgments about this codebase;
twenty of them were never adversarially checked, and several described code
that had since been rewritten. Re-running the check against the current code
— including one pass that audited the repairs themselves without being shown
what they were meant to fix — found three of those repairs incomplete. They
are written up here because "fixed" claimed too early is worse than an open
defect: nobody looks at it again.

### A refund that only happened when the feed answered

The settle pass was changed so a match finished with no winner has its
stakes returned after a grace period. The check was placed after the
PandaScore fetch, and every failure path above it did `continue` — so the
one case that most clearly means *no winner is ever coming*, the feed
returning 404 for a match it has dropped, was exactly the case that never
reached the refund. A feed error skipped it too. So did a match with no
`external_id`, which the query excluded outright.

Whether a match has become unresolvable is decided from local state and a
clock. It does not need the feed, and depending on the feed is precisely
wrong, because the commonest way for a match to become unresolvable is the
feed losing it. The policy now lives in `betting.refund_if_unresolvable()`,
next to the operation it governs rather than in the command, and the command
calls it for every match holding an open bet — after a successful sync,
after a 404, after an error, and for matches the feed has never heard of.

It covers three shapes:

| state | waits | why |
| --- | --- | --- |
| cancelled | not at all | terminal, and there is nothing to wait for |
| finished, no winner | 12h | a hole in one field; it will not fill itself |
| never resolved (still upcoming/live) | 36h | a fixture running long is not an abandoned one |

The function locks and re-reads the match row inside the transaction that
performs the refund. Reading "no winner" outside it can void a match whose
winner lands in the same instant: settlement runs inside the sync's own
atomic block, so taking the row lock is what makes the two orderings
mutually exclusive rather than merely unlikely to collide. Refunding a match
that turns out to have been playable is the survivable error — the bettor
gets their stake back rather than losing it — which is why the graces are
generous but finite.

The work after the fetch is now inside the per-match `try` as well. It was
not, so a single malformed payload aborted the settlement of every match
after it — the same failure shape the error isolation was added to remove.

### The payout rule reached the client, and the client ignored it

`payout_multiplier` and `payout_bonus` are sent on every match so no screen
has to hardcode what a win pays. The Vote button rendered
`win {payout_bonus}gg + bonus`: the flat bonus printed as if it were the
winnings, with the multiplier and the stake both ignored. The value
travelled; nothing read it. It now quotes the server's rule against the
stake actually typed.

The test that was supposed to protect this asserted
`payout_for(10) == 10 * WIN_MULTIPLIER + WIN_BONUS` — a restatement of the
function's own body, true for any constants, touching neither the serializer
nor the API. It has been replaced by one that reads `payout_multiplier` and
`payout_bonus` out of an HTTP response, places a bet through the API,
finishes the match, and asserts the wallet was credited what the response
promised. A test that cannot fail is worse than no test: it occupies the
space where the real one would go.

### Pagination raced, because the guard was checked at the wrong moment

`useFetchList` refused to run a poll tick once the user had paged further.
The flag was set when a `loadMore` *resolved*, and read when a poll tick
*started* — so nothing was protected in between, which is the entire window
where it goes wrong. A poll that started before the user reached the end
could land after page two arrived, replace the list with page one and set
the cursor back to page two. Pull-to-refresh was worse: it reset the flag
without abandoning the in-flight `loadMore`, leaving the list as page one
followed by page four, with two and three silently skipped and no duplicate
key to give it away.

Responses do not arrive in the order they were asked for, and no flag read
at call time can see that. Every request now records a generation; a
response from an older one is dropped, `reload()` bumps the generation and
resets the paging state before it fetches, and the poll re-checks on arrival
as well as at the start. `BookScreen` — the one paginated list still taking
`results` and discarding `next` — pages like the others now.

### Deploys serialise on the droplet, and back up before migrating

`git push origin main` reaches GitLab and GitHub at once; that is how the
remote is configured. Both pipelines then `git reset --hard` and
`migrate --noinput` the same directory on the same box, within seconds of
each other. A provider-level concurrency group cannot help, because the two
racers are in different providers — the only place they meet is the droplet,
so the lock lives there: `flock` around the whole chain, waiting up to ten
minutes and then failing loudly.

The chain itself was written out in full in both pipeline files — two copies
of a command that migrates a money ledger, free to drift. It is now
`deploy/remote-deploy.sh`, run by both, and it takes a `pg_dump` into
`/root/backups` before migrating. The dump is not advisory: `set -e` means a
deploy whose backup failed does not migrate. Thirty are kept. CI also runs
`makemigrations --check --dry-run`, so a model change pushed without its
migration fails in CI rather than half-way through a deploy.

### Still open, and named rather than quietly carried

- **gg is not conserved.** `credit()` mints with no counterparty, a win pays
  `stake * 2 + 2` against even odds — so betting has positive expected value
  and no vig — and the ad faucet is 250 gg a minute with no daily cap. Since
  the signup bonus is 0, the faucet is now the *only* source of gg in the
  system, which makes the leaderboard a ranking of faucet claims. Either the
  payout becomes fair (bonus 0) or the faucet gets a cap; ranking on realised
  profit rather than raw balance would fix the board alone.
- **`reconcile_wallets` treats the balance as truth and patches the ledger to
  match.** It reports drift before it books anything, so it does detect, but
  applying it destroys the evidence. The drift source it exists for — an
  admin editing `Wallet.balance` directly, which writes no transaction —
  would be better removed than reconciled.
- **The droplet cannot be rebuilt from this repository.** CI restarts an
  `expertgg` unit that is not in it; there is no nginx site, no TLS issuance,
  no Postgres role or database creation, no venv bootstrap.
- **The release APK compiles in the droplet's IP address** wearing an
  `sslip.io` hostname, with no build variant or env injection — and the
  signing keystore is gitignored and stored nowhere else, so a rebuilt server
  strands every installed copy and there is no key to ship an update with.
- **`refreshAccessToken` cannot tell an expired session from a dropped
  connection** and resolves both by deleting the refresh token. Every deploy
  ends in `systemctl restart expertgg`, which is exactly such a window, so
  this logs people out routinely rather than theoretically.
