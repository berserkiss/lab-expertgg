from django.urls import path

# VoteCreateView/MatchBetsView are votes-app business logic, but their URLs
# are nested under /api/matches/<id>/... so they're registered here rather
# than in apps/votes/urls.py - one app owns the whole /api/matches/ routing
# table instead of it being split across two apps' url files.
from apps.votes.views import MatchBetsView, VoteCreateView

from .views import MatchDetailView, MatchListView

urlpatterns = [
    path("", MatchListView.as_view(), name="match-list"),
    path("<int:pk>/", MatchDetailView.as_view(), name="match-detail"),
    path("<int:match_id>/vote/", VoteCreateView.as_view(), name="vote-create"),
    path("<int:match_id>/bets/", MatchBetsView.as_view(), name="match-bets"),
]
