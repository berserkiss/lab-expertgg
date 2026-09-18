from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, permissions

from .models import Match
from .serializers import MatchSerializer


class MatchListView(generics.ListAPIView):
    """
    Play screen. Query params:
      ?game=cs           - filter by Game.slug
      ?range=today|tomorrow|week   - filter by start_time
    """

    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Finished matches can't be bet on (see votes/serializers.py) and
        # have no reason to clutter the Play list - History is where a
        # resolved bet's match shows up. Matters in practice now that real
        # matches come from PandaScore (sync_pandascore backfills plenty of
        # already-finished ones alongside upcoming/live).
        qs = (
            Match.objects.select_related("tournament__game", "team_a", "team_b")
            .exclude(status__in=[Match.Status.FINISHED, Match.Status.CANCELED])
            # id breaks ties: dozens of matches share a start_time, and a sort that
            # is not unique lets Postgres order ties differently per query - which
            # with pagination shows some rows twice and hides others entirely.
            .order_by("start_time", "id")
        )

        game_slug = self.request.query_params.get("game")
        if game_slug:
            qs = qs.filter(tournament__game__slug=game_slug)

        date_range = self.request.query_params.get("range")
        today = timezone.localdate()
        if date_range == "today":
            qs = qs.filter(start_time__date=today)
        elif date_range == "tomorrow":
            qs = qs.filter(start_time__date=today + timedelta(days=1))
        elif date_range == "week":
            qs = qs.filter(start_time__date__range=(today, today + timedelta(days=7)))

        return qs


class MatchDetailView(generics.RetrieveAPIView):
    queryset = Match.objects.select_related("tournament__game", "team_a", "team_b")
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]
