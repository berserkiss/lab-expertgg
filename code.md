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
