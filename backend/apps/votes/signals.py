from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.matches.models import Match

from .models import Vote

WIN_BONUS = 2


@receiver(post_save, sender=Match)
def resolve_votes_on_match_finished(sender, instance, **kwargs):
    if instance.status != Match.Status.FINISHED or not instance.winner_id:
        return

    for vote in instance.votes.filter(status=Vote.Status.ACTIVE).select_related("user__wallet"):
        wallet = vote.user.wallet
        if vote.predicted_team_id == instance.winner_id:
            payout = vote.stake * 2 + WIN_BONUS
            vote.status = Vote.Status.WIN
            vote.payout = payout
            wallet.balance += payout
            wallet.transactions.create(amount=payout, type="bet_win", related_vote=vote)
        else:
            vote.status = Vote.Status.LOSE
            vote.payout = 0
            wallet.transactions.create(amount=0, type="bet_lose", related_vote=vote)
        vote.save(update_fields=["status", "payout"])
        wallet.save(update_fields=["balance"])
