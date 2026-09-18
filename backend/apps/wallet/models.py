from django.conf import settings
from django.db import models


class InsufficientBalance(Exception):
    """Raised by Wallet.debit() when the wallet doesn't hold enough gg.

    Callers are expected to hold a row lock on the wallet (select_for_update()
    inside transaction.atomic()) before calling debit(), and to translate this
    into whatever error response fits their call site (e.g. a 400 with a
    field-specific message from an API serializer)."""


class Wallet(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet")
    balance = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user} - {self.balance} gg"

    def debit(self, amount, transaction_type, *, related_vote=None):
        if amount > self.balance:
            raise InsufficientBalance(f"Wallet {self.pk} has {self.balance} gg, cannot debit {amount}.")
        self.balance -= amount
        self.save(update_fields=["balance"])
        self.transactions.create(amount=-amount, type=transaction_type, related_vote=related_vote)

    def credit(self, amount, transaction_type, *, related_vote=None):
        self.balance += amount
        self.save(update_fields=["balance"])
        self.transactions.create(amount=amount, type=transaction_type, related_vote=related_vote)


class CoinTransaction(models.Model):
    class Type(models.TextChoices):
        BET_STAKE = "bet_stake", "Bet stake"
        BET_WIN = "bet_win", "Bet win"
        BET_LOSE = "bet_lose", "Bet lose"
        BET_REFUND = "bet_refund", "Bet refund"
        AD_REWARD = "ad_reward", "Ad reward"
        SIGNUP_BONUS = "signup_bonus", "Signup bonus"
        # Written only by the reconcile_wallets command, to account for
        # balance set outside credit()/debit() - a seeded or admin-edited
        # balance leaves no transaction behind on its own.
        ADJUSTMENT = "adjustment", "Adjustment"

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name="transactions")
    amount = models.IntegerField()
    type = models.CharField(max_length=20, choices=Type.choices)
    related_vote = models.ForeignKey(
        "votes.Vote", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.wallet.user} {self.amount:+d} ({self.type})"
