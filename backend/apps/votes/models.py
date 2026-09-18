from django.conf import settings
from django.db import models

from apps.matches.models import Match, Team


class Vote(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        WIN = "win", "Win"
        LOSE = "lose", "Lose"
        # The match was voided upstream; the stake went back to the wallet.
        VOID = "void", "Void"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="votes")
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="votes")
    predicted_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="+")
    stake = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    payout = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.stake}gg on {self.predicted_team} ({self.match})"
