from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions

from apps.matches.models import Match
from apps.wallet.models import Wallet
from apps.wallet.serializers import LeaderboardSerializer

from .models import Vote
from .serializers import VoteCreateSerializer, VoteHistorySerializer


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
        ).order_by("-created_at")


class VoteHistoryView(generics.ListAPIView):
    """GET /api/votes/history/ - the History screen, all statuses."""

    serializer_class = VoteHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Vote.objects.filter(user=self.request.user).select_related(
            "match__tournament__game", "match__team_a", "match__team_b", "predicted_team"
        ).order_by("-created_at")


class LeaderboardView(generics.ListAPIView):
    """GET /api/leaderboard/ - ranked by gg balance, all-time."""

    serializer_class = LeaderboardSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Wallet.objects.select_related("user").order_by("-balance")[:100]
