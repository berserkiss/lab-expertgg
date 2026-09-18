from rest_framework import serializers

from apps.matches.serializers import MatchSerializer, TeamSerializer
from apps.wallet.models import Wallet

from .betting import BettingError, place_bet
from .models import Vote


class VoteCreateSerializer(serializers.ModelSerializer):
    """HTTP adapter over betting.place_bet - the rules themselves live there."""

    class Meta:
        model = Vote
        fields = ("id", "predicted_team", "stake", "status", "created_at")
        read_only_fields = ("id", "status", "created_at")

    def create(self, validated_data):
        try:
            return place_bet(
                user=self.context["request"].user,
                match=self.context["match"],
                team=validated_data["predicted_team"],
                stake=validated_data["stake"],
            )
        except BettingError as e:
            raise serializers.ValidationError({e.field: e.message} if e.field else e.message)


class VoteHistorySerializer(serializers.ModelSerializer):
    match = MatchSerializer(read_only=True)
    predicted_team = TeamSerializer(read_only=True)
    # Signed net result: +profit on win, -stake on lose, plain stake while active
    # (mirrors the "+100 gg / -70 gg / 20 gg" badges on the History screen).
    amount = serializers.SerializerMethodField()

    class Meta:
        model = Vote
        fields = ("id", "match", "predicted_team", "stake", "status", "amount", "created_at")

    def get_amount(self, obj):
        if obj.status == Vote.Status.WIN:
            return obj.payout - obj.stake
        if obj.status == Vote.Status.LOSE:
            return -obj.stake
        return obj.stake


class LeaderboardSerializer(serializers.ModelSerializer):
    """Serializes a Wallet as a leaderboard row - lives here (not in the wallet
    app) since ranking players against each other is a votes/competition
    concern, not a personal-balance concern."""

    username = serializers.CharField(source="user.username")
    avatar = serializers.ImageField(source="user.avatar")

    class Meta:
        model = Wallet
        fields = ("username", "avatar", "balance")
