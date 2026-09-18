from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination

from apps.matches.models import Match
from apps.wallet.models import Wallet

from .models import Vote
from .serializers import LeaderboardSerializer, VoteCreateSerializer, VoteHistorySerializer


class VoteCreateView(generics.CreateAPIView):
    """POST /api/matches/{id}/vote/ - place a bet (the numpad + Vote button screen)."""

    serializer_class = VoteCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["match"] = get_object_or_404(Match, pk=self.kwargs["match_id"])
        return context


class MatchBetsView(generics.ListAPIView):
    """GET /api/matches/{id}/bets/ - the "Book" screen: my active bets on this match."""

    serializer_class = VoteHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Vote.objects.filter(
            user=self.request.user,
            match_id=self.kwargs["match_id"],
            status=Vote.Status.ACTIVE,
        ).select_related(
            "match__tournament__game", "match__team_a", "match__team_b", "predicted_team"
        ).order_by("-created_at", "-id")


class VoteHistoryView(generics.ListAPIView):
    """GET /api/votes/history/ - the History screen, all statuses."""

    serializer_class = VoteHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Vote.objects.filter(user=self.request.user).select_related(
            "match__tournament__game", "match__team_a", "match__team_b", "predicted_team"
        ).order_by("-created_at", "-id")


class LeaderboardPagination(PageNumberPagination):
    """The board is a top 100 by definition, so it arrives as one page.

    The screen scrolls straight to the logged-in player's row; splitting the
    ranking across pages would hide that row behind a scroll the user has to
    know to perform.
    """

    page_size = 100


class LeaderboardView(generics.ListAPIView):
    """GET /api/leaderboard/ - ranked by gg balance, all-time. Staff accounts don't count as players."""

    serializer_class = LeaderboardSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = LeaderboardPagination
    queryset = Wallet.objects.select_related("user").filter(user__is_staff=False).order_by("-balance", "id")[:100]
