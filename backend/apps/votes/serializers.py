from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.matches.models import Match
from apps.matches.serializers import MatchSerializer, TeamSerializer
from apps.wallet.models import Wallet

from .models import Vote


class VoteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = ("id", "predicted_team", "stake", "status", "created_at")
        read_only_fields = ("id", "status", "created_at")

    def validate(self, attrs):
        match: Match = self.context["match"]
        team = attrs["predicted_team"]
        stake = attrs["stake"]

        if stake < 1:
            raise serializers.ValidationError({"stake": "Stake must be at least 1 gg."})
        if match.status != Match.Status.UPCOMING or match.start_time <= timezone.now():
            raise serializers.ValidationError("Betting is closed for this match.")
        if team.id not in (match.team_a_id, match.team_b_id):
            raise serializers.ValidationError({"predicted_team": "This team is not playing in this match."})

        # Fast, unlocked pre-check for a quick error message. This is NOT the
        # authoritative check - create() re-checks under a row lock, since two
        # concurrent bets could otherwise both pass this check against the
        # same stale balance and overdraw the wallet.
        wallet = self.context["request"].user.wallet
        if stake > wallet.balance:
            raise serializers.ValidationError({"stake": "Not enough gg balance."})

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        match = self.context["match"]
        stake = validated_data["stake"]

        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=user)
            if stake > wallet.balance:
                raise serializers.ValidationError({"stake": "Not enough gg balance."})
            wallet.balance -= stake
            wallet.save(update_fields=["balance"])
            wallet.transactions.create(amount=-stake, type="bet_stake")
            vote = Vote.objects.create(
                user=user,
                match=match,
                predicted_team=validated_data["predicted_team"],
                stake=stake,
            )
        return vote


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
