from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.dateparse import parse_datetime

from apps.matches.models import Game, Match, Team, Tournament
from apps.matches.pandascore import PandaScoreError, fetch_matches

STATUS_MAP = {
    "not_started": Match.Status.UPCOMING,
    "running": Match.Status.LIVE,
    "finished": Match.Status.FINISHED,
    # canceled/postponed have no equivalent Match.Status - skipped entirely,
    # see _sync_one. A match that goes stale this way (already upcoming
    # locally, then canceled upstream) is a known gap for Simplified 2.
}


class Command(BaseCommand):
    help = "Sync matches from the PandaScore feed into local Game/Tournament/Team/Match rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--games",
            nargs="*",
            default=None,
            help="Override PANDASCORE_GAMES from settings for this run (PandaScore videogame slugs).",
        )

    def handle(self, *args, **options):
        games = options["games"] or settings.PANDASCORE_GAMES
        for slug in games:
            self.stdout.write(f"Syncing {slug}...")
            for status, sort in (
                ("not_started", "begin_at"),
                ("running", "begin_at"),
                ("finished", "-end_at"),
            ):
                self._sync_status(slug, status, sort)

    def _sync_status(self, slug, status, sort):
        try:
            raw_matches = fetch_matches(slug, status, sort=sort)
        except PandaScoreError as e:
            self.stderr.write(self.style.ERROR(str(e)))
            return

        created = updated = skipped = 0
        for raw in raw_matches:
            result = self._sync_one(raw, slug)
            if result == "created":
                created += 1
            elif result == "updated":
                updated += 1
            else:
                skipped += 1
        self.stdout.write(f"  {status}: {created} created, {updated} updated, {skipped} skipped")

    def _sync_one(self, raw, videogame_slug):
        opponents = raw.get("opponents") or []
        teams = [o["opponent"] for o in opponents if o.get("opponent") and o.get("type") == "Team"]
        if len(teams) < 2:
            return "skip"  # TBD/placeholder slot, nothing to bet on yet

        our_status = STATUS_MAP.get(raw.get("status"))
        if our_status is None:
            return "skip"  # canceled/postponed - not modeled

        start_time = parse_datetime(raw.get("begin_at") or raw.get("scheduled_at") or "")
        if not start_time:
            return "skip"

        league = raw.get("league") or {}
        if not league.get("id"):
            return "skip"  # can't file it under a Tournament without one

        with transaction.atomic():
            game, _ = Game.objects.get_or_create(
                slug=videogame_slug,
                defaults={"name": (raw.get("videogame") or {}).get("name", videogame_slug)},
            )
            tournament, _ = Tournament.objects.update_or_create(
                external_id=str(league["id"]),
                defaults={"name": league.get("name", "Unknown"), "game": game},
            )
            team_a = self._upsert_team(teams[0])
            team_b = self._upsert_team(teams[1])

            winner_team = None
            winner = raw.get("winner") or {}
            if winner.get("id"):
                winner_team = Team.objects.filter(external_id=str(winner["id"])).first()

            match, created = Match.objects.get_or_create(
                external_id=str(raw["id"]),
                defaults={
                    "tournament": tournament,
                    "team_a": team_a,
                    "team_b": team_b,
                    "start_time": start_time,
                    "status": our_status,
                },
            )
            match.tournament = tournament
            match.team_a = team_a
            match.team_b = team_b
            match.start_time = start_time
            match.status = our_status
            if our_status == Match.Status.FINISHED:
                match.winner = winner_team
            # Always .save() (never .update()) - post_save is what triggers
            # apps.votes.signals.resolve_votes_on_match_finished.
            match.save()
            return "created" if created else "updated"

    def _upsert_team(self, team_data):
        team, _ = Team.objects.update_or_create(
            external_id=str(team_data["id"]),
            defaults={"name": team_data.get("name", "Unknown")},
        )
        return team
