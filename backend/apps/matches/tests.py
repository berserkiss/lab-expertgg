from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Game, Match, Team, Tournament

User = get_user_model()

MATCHES_URL = "/api/matches/"


def make_match(game_slug="cs", game_name="Counter-Strike", **overrides):
    game, _ = Game.objects.get_or_create(slug=game_slug, defaults={"name": game_name})
    tournament = Tournament.objects.create(name="Test Cup", game=game)
    team_a = Team.objects.create(name="Alpha")
    team_b = Team.objects.create(name="Beta")
    defaults = dict(
        tournament=tournament,
        team_a=team_a,
        team_b=team_b,
        start_time=timezone.now() + timedelta(hours=1),
        status=Match.Status.UPCOMING,
    )
    defaults.update(overrides)
    return Match.objects.create(**defaults)


class MatchListTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="viewer", email="viewer@example.com", password="pass12345")
        self.client.force_authenticate(user=self.user)
        now = timezone.now()
        self.today_match = make_match(start_time=now + timedelta(hours=2))
        self.tomorrow_match = make_match(start_time=now + timedelta(days=1, hours=1))
        self.next_week_match = make_match(start_time=now + timedelta(days=6))
        self.lol_match = make_match(game_slug="lol", game_name="League of Legends", start_time=now + timedelta(hours=3))

    def _ids(self, response):
        data = response.json()
        return {row["id"] for row in data.get("results", data)}

    def test_lists_all_matches_by_default(self):
        response = self.client.get(MATCHES_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._ids(response),
            {self.today_match.id, self.tomorrow_match.id, self.next_week_match.id, self.lol_match.id},
        )

    def test_filters_by_game_slug(self):
        response = self.client.get(MATCHES_URL, {"game": "lol"})
        self.assertEqual(self._ids(response), {self.lol_match.id})

    def test_filters_by_range_today(self):
        response = self.client.get(MATCHES_URL, {"range": "today"})
        self.assertEqual(self._ids(response), {self.today_match.id, self.lol_match.id})

    def test_filters_by_range_tomorrow(self):
        response = self.client.get(MATCHES_URL, {"range": "tomorrow"})
        self.assertEqual(self._ids(response), {self.tomorrow_match.id})

    def test_filters_by_range_week(self):
        response = self.client.get(MATCHES_URL, {"range": "week"})
        self.assertEqual(
            self._ids(response),
            {self.today_match.id, self.tomorrow_match.id, self.next_week_match.id, self.lol_match.id},
        )

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(MATCHES_URL)
        self.assertEqual(response.status_code, 401)
