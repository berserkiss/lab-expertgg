from rest_framework import serializers

from .models import Wallet


class LeaderboardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username")
    avatar = serializers.ImageField(source="user.avatar")

    class Meta:
        model = Wallet
        fields = ("username", "avatar", "balance")
