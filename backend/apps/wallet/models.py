from django.conf import settings
from django.db import models, transaction


class InsufficientBalance(Exception):
    """Raised by Wallet.debit() when the wallet doesn't hold enough gg.

    Callers translate this into whatever error response fits their call site
    (e.g. a 400 with a field-specific message from an API serializer)."""


class Wallet(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet")
    balance = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user} - {self.balance} gg"

    def _move(self, delta, transaction_type, related_vote=None):
        """
        Change the balance by `delta` and record the matching ledger row.

        The row is locked and re-read here rather than trusted from `self`.
        This used to be a plain read-modify-write on whatever the caller had
        in hand, with a docstring asking callers to take the lock first -
        and every production caller did, so nothing was broken. But an
        invariant that holds because people remember to read a docstring is
        one bad afternoon from not holding: two concurrent calls against the
        same stale instance would each write their own idea of the balance,
        and the later write would erase the earlier one's money.

        Re-locking a row the caller already locked is free - it is the same
        transaction - so the existing call sites are unaffected.

        The balance write and the ledger row are in one transaction because
        the two are the same fact recorded twice. A balance that moved with
        no transaction behind it is exactly the drift that reconcile_wallets
        exists to find, and there is no reason for this code to create any.
        """
        with transaction.atomic():
            locked = Wallet.objects.select_for_update().get(pk=self.pk)
            new_balance = locked.balance + delta
            if new_balance < 0:
                raise InsufficientBalance(
                    f"Wallet {self.pk} has {locked.balance} gg, cannot debit {-delta}."
                )
            locked.balance = new_balance
            locked.save(update_fields=["balance"])
            locked.transactions.create(
                amount=delta, type=transaction_type, related_vote=related_vote
            )
        # The caller holds its own instance and often reads the balance back
        # off it (the ad-reward view answers with it), so it is told what the
        # locked row now says instead of being left with a stale number.
        self.balance = new_balance

    def debit(self, amount, transaction_type, *, related_vote=None):
        self._move(-amount, transaction_type, related_vote)

    def credit(self, amount, transaction_type, *, related_vote=None):
        self._move(amount, transaction_type, related_vote)


class CoinTransaction(models.Model):
    class Type(models.TextChoices):
        BET_STAKE = "bet_stake", "Bet stake"
        BET_WIN = "bet_win", "Bet win"
        BET_LOSE = "bet_lose", "Bet lose"
        BET_REFUND = "bet_refund", "Bet refund"
        AD_REWARD = "ad_reward", "Ad reward"
        SIGNUP_BONUS = "signup_bonus", "Signup bonus"
        # Written only by the reconcile_wallets command and the test-fixture
        # seed, to account for a balance set outside credit()/debit().
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
