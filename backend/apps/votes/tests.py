import threading
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.matches.models import Game, Match, Team, Tournament
from apps.wallet.models import Wallet

from .betting import (BettingError, WIN_BONUS, WIN_MULTIPLIER, payout_for,
                      place_bet, refund_active_votes, settle_match)
from .models import Vote

User = get_user_model()


def make_match(**overrides):
    game, _ = Game.objects.get_or_create(slug="cs", defaults={"name": "Counter-Strike"})
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


class VoteCreateTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="bettor", email="bettor@example.com", password="pass12345")
        # Use self.user.wallet (not a separately-queried Wallet instance) so
        # the balance we set here is visible through request.user.wallet in
        # the view - accessing a OneToOne reverse relation caches it on the
        # instance, and the wallet-creation signal already populated that
        # cache with balance=0 the moment create_user() ran.
        self.wallet = self.user.wallet
        self.wallet.balance = 100
        self.wallet.save()
        self.match = make_match()
        self.client.force_authenticate(self.user)

    def vote_url(self, match=None):
        return f"/api/matches/{(match or self.match).id}/vote/"

    def test_place_bet_deducts_balance(self):
        response = self.client.post(self.vote_url(), {"predicted_team": self.match.team_a_id, "stake": 30})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 70)

    def test_cannot_bet_more_than_balance(self):
        response = self.client.post(self.vote_url(), {"predicted_team": self.match.team_a_id, "stake": 1000})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 100)

    def test_cannot_bet_on_team_not_in_match(self):
        outsider = Team.objects.create(name="Outsider")
        response = self.client.post(self.vote_url(), {"predicted_team": outsider.id, "stake": 10})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_bet_on_finished_match(self):
        self.match.status = Match.Status.FINISHED
        self.match.save()
        response = self.client.post(self.vote_url(), {"predicted_team": self.match.team_a_id, "stake": 10})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_can_bet_on_a_live_match(self):
        # Betting stays open once a match is under way - status decides, not
        # start_time, which a live match has necessarily already passed.
        started = make_match(start_time=timezone.now() - timedelta(minutes=1), status=Match.Status.LIVE)
        response = self.client.post(self.vote_url(started), {"predicted_team": started.team_a_id, "stake": 10})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cannot_bet_on_canceled_match(self):
        canceled = make_match(status=Match.Status.CANCELED)
        response = self.client.post(self.vote_url(canceled), {"predicted_team": canceled.team_a_id, "stake": 10})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class VoteResolutionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="bettor2", email="bettor2@example.com", password="pass12345")
        self.wallet = Wallet.objects.get(user=self.user)
        self.wallet.balance = 100
        self.wallet.save()
        self.match = make_match()

    def test_single_win_payout(self):
        Vote.objects.create(user=self.user, match=self.match, predicted_team=self.match.team_a, stake=20)
        self.match.status = Match.Status.FINISHED
        self.match.winner = self.match.team_a
        self.match.save()

        self.wallet.refresh_from_db()
        # stake*2 + flat bonus(2), credited on top of the untouched starting balance
        self.assertEqual(self.wallet.balance, 100 + 42)

    def test_multiple_active_votes_on_same_match_all_get_paid(self):
        """Regression test for the lost-update bug: resolving a match with 2+
        active votes from the same user must not let one payout overwrite
        the other."""
        Vote.objects.create(user=self.user, match=self.match, predicted_team=self.match.team_a, stake=10)
        Vote.objects.create(user=self.user, match=self.match, predicted_team=self.match.team_a, stake=15)

        self.match.status = Match.Status.FINISHED
        self.match.winner = self.match.team_a
        self.match.save()

        self.wallet.refresh_from_db()
        expected = 100 + (10 * 2 + 2) + (15 * 2 + 2)
        self.assertEqual(self.wallet.balance, expected)

    def test_losing_vote_does_not_refund(self):
        Vote.objects.create(user=self.user, match=self.match, predicted_team=self.match.team_b, stake=20)
        self.match.status = Match.Status.FINISHED
        self.match.winner = self.match.team_a
        self.match.save()

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 100)
        vote = Vote.objects.get(match=self.match, user=self.user)
        self.assertEqual(vote.status, Vote.Status.LOSE)


class ConcurrentBetTests(TransactionTestCase):
    """Uses real threads + TransactionTestCase (not the default TestCase's
    wrapping transaction, which would hide any real locking behavior) so
    select_for_update() actually contends across separate DB connections."""

    def setUp(self):
        self.user = User.objects.create_user(username="racer", email="racer@example.com", password="pass12345")
        self.wallet = self.user.wallet
        self.wallet.balance = 100
        self.wallet.save()
        self.match = make_match()

    def test_concurrent_bets_cannot_overdraw_balance(self):
        results = []

        def place_bet():
            try:
                client = APIClient()
                client.force_authenticate(self.user)
                response = client.post(
                    f"/api/matches/{self.match.id}/vote/",
                    {"predicted_team": self.match.team_a_id, "stake": 60},
                )
                results.append(response.status_code)
            finally:
                # Each thread opens its own DB connection; Django only closes
                # the main thread's connection automatically, so this must be
                # explicit or the test database can't be torn down afterwards.
                connection.close()

        threads = [threading.Thread(target=place_bet) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Only one of the two 60-gg bets can succeed against a 100-gg balance.
        self.assertEqual(sorted(results), [201, 400])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 40)


class BettingOperationTests(TestCase):
    """The lifecycle is callable without HTTP - that is the point of betting.py."""

    def setUp(self):
        self.user = User.objects.create_user(email="ops@example.com", password="x", username="ops")
        self.wallet = Wallet.objects.get(user=self.user)
        self.wallet.balance = 100
        self.wallet.save()
        self.match = make_match()

    def test_place_bet_needs_no_request(self):
        vote = place_bet(self.user, self.match, self.match.team_a, 30)
        self.wallet.refresh_from_db()
        self.assertEqual(vote.status, Vote.Status.ACTIVE)
        self.assertEqual(self.wallet.balance, 70)

    def test_place_bet_refuses_more_than_the_balance(self):
        with self.assertRaises(BettingError) as caught:
            place_bet(self.user, self.match, self.match.team_a, 500)
        self.assertEqual(caught.exception.field, "stake")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 100)

    def test_settling_twice_pays_once(self):
        place_bet(self.user, self.match, self.match.team_a, 30)
        self.match.status = Match.Status.FINISHED
        self.match.winner = self.match.team_a
        self.match.save()
        self.wallet.refresh_from_db()
        paid = self.wallet.balance

        self.assertEqual(settle_match(self.match), 0)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, paid)

    def test_refunding_twice_returns_the_stake_once(self):
        place_bet(self.user, self.match, self.match.team_a, 30)
        self.assertEqual(refund_active_votes(self.match), 1)
        self.assertEqual(refund_active_votes(self.match), 0)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 100)

    def test_payout_is_defined_in_one_place(self):
        self.assertEqual(payout_for(10), 10 * WIN_MULTIPLIER + WIN_BONUS)
