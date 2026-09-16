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
  `upcoming`, predicted_team must belong to the match. Atomic via
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
- "Bet placed!" confirmation modal
- "Get coins" ad-reward flow (stays a disconnected stub)
- Settings screen
- Sign-up / registration flow
- Dota 2 / Valorant support (unless the open question above resolves to
  include more than CS)
- Live in-match state / PandaScore WebSocket feed (free-tier REST polling
  for schedules+results is sufficient; no need for real-time push)
- Dynamic/market-based odds (fixed `stake*2+2` payout stays as-is)

## 4. Deliverables (from the assignment)

1. Android **.apk** build of the mobile app.
2. A link to this artifact (`code.md`) — git repo or a file in Slack — plus
   the corresponding backend/mobile changes as commits.

## 5. Open questions to resolve before/while implementing

1. Which PandaScore game(s) to sync — CS only, or CS+LoL? (defaulted to CS
   only above)
2. Does match resolution (winner) come from PandaScore automatically, or
   stay a manual admin action? (defaulted to automatic above)
3. Profile display name: reuse an existing field or add `display_name`?
   (needs a quick look at `accounts.User` before implementing)
