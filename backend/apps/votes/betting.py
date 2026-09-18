"""
The bet lifecycle, as operations you can call.

Placing, settling and refunding a bet each move gg, so each is a named
function here rather than something buried in a serializer's create() or
reachable only by remembering to call Match.save(). That is what lets a bet
be placed by a management command or a domain test, and a match be settled
or re-settled deliberately instead of as a side effect.

This module is also the single definition of what a bet pays. The API hands
that rule to the client (see MatchSerializer) so no screen has to hardcode
it.
"""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.matches.models import Match
from apps.wallet.models import CoinTransaction, InsufficientBalance, Wallet

from .models import Vote

# A winning bet returns the stake multiplied, plus a flat bonus.
WIN_MULTIPLIER = 2
WIN_BONUS = 2

BETTABLE_STATUSES = (Match.Status.UPCOMING, Match.Status.LIVE)

# How long past its start time a match may stay unresolved before the stakes
# on it are given back. Longer for a match that never reached a terminal
# status at all: "finished, winner missing" is a hole in one field and will
# not fill itself, while "still live" may simply be a fixture running long.
UNRESOLVED_GRACE = timedelta(hours=12)
ABANDONED_GRACE = timedelta(hours=36)


def payout_for(stake):
    """What a winning bet of `stake` pays back, the stake included."""
    return stake * WIN_MULTIPLIER + WIN_BONUS


class BettingError(Exception):
    """A bet the rules do not allow. `field` names the input at fault, if one does."""

    def __init__(self, message, field=None):
        super().__init__(message)
        self.message = message
        self.field = field


def place_bet(user, match, team, stake):
    """
    Take `stake` gg from `user` and open a bet on `team` winning `match`.

    Raises BettingError if the rules refuse it. The balance is checked under
    a row lock rather than beforehand: two concurrent bets could both pass a
    check against the same stale balance and overdraw the wallet.
    """
    if stake < 1:
        raise BettingError("Stake must be at least 1 gg.", field="stake")
    # Status, not start_time, decides: a live match has necessarily already
    # started, and betting on it is allowed.
    if match.status not in BETTABLE_STATUSES:
        raise BettingError("Betting is closed for this match.")
    if team.id not in (match.team_a_id, match.team_b_id):
        raise BettingError("This team is not playing in this match.", field="predicted_team")

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=user)
        try:
            wallet.debit(stake, CoinTransaction.Type.BET_STAKE)
        except InsufficientBalance:
            raise BettingError("Not enough gg balance.", field="stake")
        return Vote.objects.create(user=user, match=match, predicted_team=team, stake=stake)


def settle_match(match):
    """
    Pay out and close every open bet on a finished `match`. Returns how many.

    Only bets still ACTIVE are touched, so calling this twice on the same
    match pays nobody twice - which is what makes the sync safe to re-run.
    """
    if match.status != Match.Status.FINISHED or not match.winner_id:
        return 0

    with transaction.atomic():
        votes = list(match.votes.select_for_update().filter(status=Vote.Status.ACTIVE))
        for vote in votes:
            # Re-fetch and lock the wallet fresh on every iteration instead of
            # reusing a `select_related` snapshot: a user can have more than
            # one active vote on the same match, and reusing a stale Python
            # object per row would make later saves overwrite earlier payouts.
            wallet = Wallet.objects.select_for_update().get(user_id=vote.user_id)
            if vote.predicted_team_id == match.winner_id:
                vote.payout = payout_for(vote.stake)
                vote.status = Vote.Status.WIN
                wallet.credit(vote.payout, CoinTransaction.Type.BET_WIN, related_vote=vote)
            else:
                vote.status = Vote.Status.LOSE
                vote.payout = 0
                wallet.transactions.create(
                    amount=0, type=CoinTransaction.Type.BET_LOSE, related_vote=vote
                )
            vote.save(update_fields=["status", "payout"])
        return len(votes)


def refund_active_votes(match):
    """
    Give every open stake on `match` back, and mark those bets void. Returns how many.

    A match can become unsettleable in more than one way - cancelled
    upstream, or finished with a winner the feed will never name - so this
    has to be callable directly, not only reachable by saving a Match.
    Filtering on ACTIVE is what keeps a repeated call from refunding twice.
    """
    with transaction.atomic():
        votes = list(match.votes.select_for_update().filter(status=Vote.Status.ACTIVE))
        for vote in votes:
            wallet = Wallet.objects.select_for_update().get(user_id=vote.user_id)
            wallet.credit(vote.stake, CoinTransaction.Type.BET_REFUND, related_vote=vote)
            vote.status = Vote.Status.VOID
            vote.payout = vote.stake
            vote.save(update_fields=["status", "payout"])
        return len(votes)


def refund_if_unresolvable(match, now=None):
    """
    Give the stakes back once it is clear no winner is ever coming. Returns how many.

    Three shapes of unresolvable, all decided from local state and a clock
    rather than from the feed - which matters, because the commonest way for
    a match to become unresolvable is the feed losing it:
      - cancelled: nothing to wait for, refund at once;
      - finished with no winner: a walkover, a forfeit, a field the provider
        never filled in, after UNRESOLVED_GRACE;
      - never resolved at all - still upcoming or live long after it was due
        to start, because the fixture was dropped or postponed indefinitely -
        after ABANDONED_GRACE.

    The match row is locked and re-read inside the transaction that performs
    the refund. Deciding "no winner is coming" from a read taken outside it
    can void a match whose winner landed in between: settlement happens
    inside the sync's own atomic block, so taking this lock is what makes the
    two orderings exclusive rather than merely unlikely.

    Refunding a match that turns out to have been playable is the survivable
    error - the bettor gets their stake back rather than losing it - which is
    why the graces are generous but not infinite.
    """
    now = now or timezone.now()
    with transaction.atomic():
        match = Match.objects.select_for_update().get(pk=match.pk)
        if match.status == Match.Status.CANCELED:
            return refund_active_votes(match)
        if match.status == Match.Status.FINISHED:
            if match.winner_id:
                return 0  # settle_match's job, not this one's
            if now - match.start_time < UNRESOLVED_GRACE:
                return 0
        elif now - match.start_time < ABANDONED_GRACE:
            return 0
        return refund_active_votes(match)
