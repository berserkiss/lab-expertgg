from django.conf import settings
from django.db import models


class Wallet(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet")
    balance = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user} - {self.balance} gg"


class CoinTransaction(models.Model):
    class Type(models.TextChoices):
        BET_STAKE = "bet_stake", "Bet stake"
        BET_WIN = "bet_win", "Bet win"
        BET_LOSE = "bet_lose", "Bet lose"
        AD_REWARD = "ad_reward", "Ad reward"
        SIGNUP_BONUS = "signup_bonus", "Signup bonus"

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name="transactions")
    amount = models.IntegerField()
    type = models.CharField(max_length=20, choices=Type.choices)
    related_vote = models.ForeignKey(
        "votes.Vote", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.wallet.user} {self.amount:+d} ({self.type})"
