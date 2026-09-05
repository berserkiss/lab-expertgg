from django.urls import path

from .views import LeaderboardView, MatchBetsView, VoteCreateView, VoteHistoryView

urlpatterns = [
    path("matches/<int:match_id>/vote/", VoteCreateView.as_view(), name="vote-create"),
    path("matches/<int:match_id>/bets/", MatchBetsView.as_view(), name="match-bets"),
    path("votes/history/", VoteHistoryView.as_view(), name="vote-history"),
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
]
