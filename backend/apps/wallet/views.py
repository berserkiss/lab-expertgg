from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CoinTransaction, Wallet

# How long a user must wait between free "watch an ad" rewards, and how much
# each grant is worth. Matches the reference app's "+250 coins" reward.
# ASSUMPTION (not specified in the assignment): a short cooldown so this is
# easy to demo/test live - tune freely, nothing else depends on this value.
AD_REWARD_COOLDOWN_SECONDS = 60
AD_REWARD_AMOUNT = 250


def _cooldown_status(wallet):
    last = (
        wallet.transactions.filter(type=CoinTransaction.Type.AD_REWARD)
        .order_by("-created_at")
        .first()
    )
    if last is None:
        return True, 0
    elapsed = (timezone.now() - last.created_at).total_seconds()
    remaining = max(0, AD_REWARD_COOLDOWN_SECONDS - elapsed)
    return remaining <= 0, int(remaining)


class AdRewardView(APIView):
    """Get Coins screen: check/claim the free "watch an ad" reward."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wallet = request.user.wallet
        available, seconds_remaining = _cooldown_status(wallet)
        return Response(
            {
                "available": available,
                "seconds_remaining": seconds_remaining,
                "balance": wallet.balance,
                "reward": AD_REWARD_AMOUNT,
            }
        )

    def post(self, request):
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)
            available, seconds_remaining = _cooldown_status(wallet)
            if not available:
                return Response(
                    {"detail": "Come back later for more free coins.", "seconds_remaining": seconds_remaining},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            wallet.credit(AD_REWARD_AMOUNT, CoinTransaction.Type.AD_REWARD)
        return Response({"balance": wallet.balance, "reward": AD_REWARD_AMOUNT})
