import threading
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.matches.management.commands.sync_pandascore import Command as SyncCommand
from apps.matches.models import Game, Match, Team, Tournament
from apps.matches.pandascore import PandaScoreError
from apps.wallet.models import Wallet

# Where fetch_match is looked up, which is the name that has to be patched.
SYNC = "apps.matches.management.commands.sync_pandascore"

from .betting import (ABANDONED_GRACE, BettingError, UNRESOLVED_GRACE, WIN_BONUS,
                      WIN_MULTIPLIER, payout_for, place_bet, refund_active_votes,
                      refund_if_unresolvable, settle_match)
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


class PayoutContractTests(APITestCase):
    """
    What the API promises a win pays is what settlement actually pays.

    Asserting payout_for() against its own constants passes whatever they
    are. The contract worth protecting runs from the wire - the numbers the
    Vote button quotes - to the wallet, so this reads the rule out of the
    HTTP response and checks the credit against that, never against the
    module.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="quote", email="quote@example.com", password="pass12345"
        )
        self.wallet = self.user.wallet
        self.wallet.balance = 100
        self.wallet.save()
        self.match = make_match()
        self.client.force_authenticate(self.user)

    def test_the_quoted_rule_is_what_the_wallet_is_credited(self):
        listed = self.client.get("/api/matches/").data["results"]
        quoted = next(m for m in listed if m["id"] == self.match.id)
        multiplier, bonus = quoted["payout_multiplier"], quoted["payout_bonus"]

        stake = 10
        response = self.client.post(
            f"/api/matches/{self.match.id}/vote/",
            {"predicted_team": self.match.team_a.id, "stake": stake},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.match.status = Match.Status.FINISHED
        self.match.winner = self.match.team_a
        self.match.save()

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 100 - stake + (stake * multiplier + bonus))


class UnresolvableRefundTests(TestCase):
    """
    A stake must not be able to sit open forever.

    Each branch here is a way a match stops being settleable, and every one
    of them was reachable in a revision that stranded the money.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            email="void@example.com", password="x", username="void"
        )
        self.wallet = Wallet.objects.get(user=self.user)
        self.wallet.balance = 100
        self.wallet.save()

    def _match_with_a_bet(self, age, **overrides):
        match = make_match(start_time=timezone.now() - age, **overrides)
        place_bet(self.user, match, match.team_a, 30)
        return match

    def _balance(self):
        self.wallet.refresh_from_db()
        return self.wallet.balance

    def test_finished_with_no_winner_is_refunded_once_the_grace_lapses(self):
        match = self._match_with_a_bet(UNRESOLVED_GRACE + timedelta(hours=1))
        # .update() rather than .save(): saving would fire the settlement
        # receivers, and this test is about the state they both decline.
        Match.objects.filter(pk=match.pk).update(status=Match.Status.FINISHED)

        self.assertEqual(refund_if_unresolvable(match), 1)
        self.assertEqual(self._balance(), 100)
        self.assertEqual(match.votes.get().status, Vote.Status.VOID)
        # Idempotent, because the sync runs this every ten minutes.
        self.assertEqual(refund_if_unresolvable(match), 0)
        self.assertEqual(self._balance(), 100)

    def test_a_winner_that_has_not_landed_yet_is_waited_for(self):
        match = self._match_with_a_bet(UNRESOLVED_GRACE - timedelta(hours=1))
        Match.objects.filter(pk=match.pk).update(status=Match.Status.FINISHED)

        self.assertEqual(refund_if_unresolvable(match), 0)
        self.assertEqual(self._balance(), 70)
        self.assertEqual(match.votes.get().status, Vote.Status.ACTIVE)

    def test_a_match_with_a_winner_is_left_to_settlement(self):
        match = self._match_with_a_bet(UNRESOLVED_GRACE + timedelta(hours=1))
        match.status = Match.Status.FINISHED
        match.winner = match.team_a
        match.save()

        self.assertEqual(refund_if_unresolvable(match), 0)
        self.assertEqual(self._balance(), 70 + payout_for(30))
        self.assertEqual(match.votes.get().status, Vote.Status.WIN)

    def test_a_match_that_never_resolved_is_refunded_after_the_longer_grace(self):
        match = self._match_with_a_bet(ABANDONED_GRACE + timedelta(hours=1))
        Match.objects.filter(pk=match.pk).update(status=Match.Status.LIVE)

        self.assertEqual(refund_if_unresolvable(match), 1)
        self.assertEqual(self._balance(), 100)

    def test_a_fixture_running_long_is_not_voided_out_from_under_it(self):
        match = self._match_with_a_bet(UNRESOLVED_GRACE + timedelta(hours=1))
        Match.objects.filter(pk=match.pk).update(status=Match.Status.LIVE)

        self.assertEqual(refund_if_unresolvable(match), 0)
        self.assertEqual(self._balance(), 70)

    def test_a_cancelled_match_is_refunded_without_waiting(self):
        match = self._match_with_a_bet(timedelta(0))
        Match.objects.filter(pk=match.pk).update(status=Match.Status.CANCELED)

        self.assertEqual(refund_if_unresolvable(match), 1)
        self.assertEqual(self._balance(), 100)


class SettlePassTests(TestCase):
    """
    The sync's settle pass, with the feed replaced.

    None of this is about PandaScore being right - it is about the pass
    surviving PandaScore being wrong. Every case here is a feed failure that
    used to stop a stake coming back.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            email="pass@example.com", password="x", username="pass"
        )
        self.wallet = Wallet.objects.get(user=self.user)
        self.wallet.balance = 100
        self.wallet.save()
        self.command = SyncCommand()

    def _stranded_match(self, external_id="1"):
        """A match finished with no winner, long enough ago to be refundable."""
        match = make_match(
            start_time=timezone.now() - (UNRESOLVED_GRACE + timedelta(hours=1)),
            external_id=external_id,
        )
        place_bet(self.user, match, match.team_a, 30)
        Match.objects.filter(pk=match.pk).update(status=Match.Status.FINISHED)
        return match

    def _balance(self):
        self.wallet.refresh_from_db()
        return self.wallet.balance

    def test_a_match_the_feed_has_dropped_is_still_refunded(self):
        # The regression this pass exists for: the refund used to sit behind
        # a successful fetch, so a 404 - the clearest possible evidence that
        # no winner is coming - was the one case that held the stake forever.
        self._stranded_match()
        with mock.patch(f"{SYNC}.fetch_match", return_value=None):
            self.command._settle_open_bets()
        self.assertEqual(self._balance(), 100)

    def test_a_feed_error_does_not_hold_the_stake(self):
        self._stranded_match()
        with mock.patch(
            f"{SYNC}.fetch_match", side_effect=PandaScoreError("boom", status_code=500)
        ):
            self.command._settle_open_bets()
        self.assertEqual(self._balance(), 100)

    def test_a_match_the_feed_never_knew_about_is_swept_too(self):
        # No external_id: nothing to ask the feed for, but the clock still
        # says the stake is unrecoverable.
        self._stranded_match(external_id=None)
        with mock.patch(f"{SYNC}.fetch_match") as fetch:
            self.command._settle_open_bets()
        fetch.assert_not_called()
        self.assertEqual(self._balance(), 100)

    def test_one_malformed_payload_does_not_cost_the_others(self):
        self._stranded_match(external_id="1")
        self._stranded_match(external_id="2")
        # Not a dict, so the first attribute access inside the sync raises -
        # standing in for any shape the feed has no business returning.
        with mock.patch(f"{SYNC}.fetch_match", return_value=["not", "a", "match"]):
            self.command._settle_open_bets()
        self.assertEqual(self._balance(), 100)

    def test_a_rate_limit_stops_the_pass(self):
        self._stranded_match(external_id="1")
        self._stranded_match(external_id="2")
        with mock.patch(
            f"{SYNC}.fetch_match", side_effect=PandaScoreError("429", status_code=429)
        ) as fetch:
            self.command._settle_open_bets()
        # One request, not one per match - but the match it did reach still
        # got its refund check before the pass gave up.
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(self._balance(), 70)

