from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.matches.models import Match
from apps.wallet.models import CoinTransaction, Wallet

from .models import Vote

WIN_BONUS = 2


@receiver(post_save, sender=Match)
def resolve_votes_on_match_finished(sender, instance, **kwargs):
    if instance.status != Match.Status.FINISHED or not instance.winner_id:
        return

    with transaction.atomic():
        votes = list(instance.votes.select_for_update().filter(status=Vote.Status.ACTIVE))
        for vote in votes:
            # Re-fetch and lock the wallet fresh on every iteration instead of
            # reusing a `select_related` snapshot: a user can have more than
            # one active vote on the same match, and reusing a stale Python
            # object per row would make later saves overwrite earlier payouts.
            wallet = Wallet.objects.select_for_update().get(user_id=vote.user_id)
            if vote.predicted_team_id == instance.winner_id:
                payout = vote.stake * 2 + WIN_BONUS
                vote.status = Vote.Status.WIN
                vote.payout = payout
                wallet.credit(payout, CoinTransaction.Type.BET_WIN, related_vote=vote)
            else:
                vote.status = Vote.Status.LOSE
                vote.payout = 0
                wallet.transactions.create(amount=0, type=CoinTransaction.Type.BET_LOSE, related_vote=vote)
            vote.save(update_fields=["status", "payout"])


def refund_active_votes(match):
    """
    Give every open stake on `match` back, and mark those bets void.

    Named and callable rather than only reachable by saving a Match: a bet
    can become unrefundable-by-signal (a match that finishes with no winner
    the feed will ever report), and that case needs to invoke this directly.
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


@receiver(post_save, sender=Match)
def void_votes_on_match_canceled(sender, instance, **kwargs):
    """Give the stake back when the feed voids a match."""
    if instance.status != Match.Status.CANCELED:
        return
    refund_active_votes(instance)
