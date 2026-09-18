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


@receiver(post_save, sender=Match)
def void_votes_on_match_canceled(sender, instance, **kwargs):
    """
    Give the stake back when the feed voids a match.

    A canceled match has no winner, so it can never settle through
    resolve_votes_on_match_finished - without this the bet would hold its
    stake as 'active' for good. Filtering on ACTIVE is what keeps a repeated
    sync of the same canceled match from refunding twice.
    """
    if instance.status != Match.Status.CANCELED:
        return

    with transaction.atomic():
        votes = list(instance.votes.select_for_update().filter(status=Vote.Status.ACTIVE))
        for vote in votes:
            wallet = Wallet.objects.select_for_update().get(user_id=vote.user_id)
            wallet.credit(vote.stake, CoinTransaction.Type.BET_REFUND, related_vote=vote)
            vote.status = Vote.Status.VOID
            vote.payout = vote.stake
            vote.save(update_fields=["status", "payout"])
