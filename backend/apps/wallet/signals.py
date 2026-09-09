from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import CoinTransaction, Wallet

SIGNUP_BONUS = 0


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_wallet_for_new_user(sender, instance, created, **kwargs):
    if not created:
        return
    wallet = Wallet.objects.create(user=instance, balance=SIGNUP_BONUS)
    if SIGNUP_BONUS:
        wallet.transactions.create(amount=SIGNUP_BONUS, type=CoinTransaction.Type.SIGNUP_BONUS)
