"""
Wiring only: a match reaching a terminal state triggers the matching
operation in betting.py. The work itself lives there so it can also be
invoked directly - see betting.settle_match / betting.refund_active_votes.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.matches.models import Match

from .betting import refund_active_votes, settle_match


@receiver(post_save, sender=Match)
def settle_on_match_finished(sender, instance, **kwargs):
    if instance.status != Match.Status.FINISHED or not instance.winner_id:
        return
    settle_match(instance)


@receiver(post_save, sender=Match)
def refund_on_match_canceled(sender, instance, **kwargs):
    if instance.status != Match.Status.CANCELED:
        return
    refund_active_votes(instance)
