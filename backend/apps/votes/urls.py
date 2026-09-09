from django.urls import path

from .views import LeaderboardView, VoteHistoryView

# vote-create and match-bets live in apps/matches/urls.py instead - they're
# nested under /api/matches/<id>/..., which that app's urls.py owns.
urlpatterns = [
    path("votes/history/", VoteHistoryView.as_view(), name="vote-history"),
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
]
