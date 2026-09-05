from rest_framework import serializers

from apps.votes.models import Vote

from .models import Game, Match, Team, Tournament


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ("id", "name", "slug", "icon")


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ("id", "name", "logo")


class TournamentSerializer(serializers.ModelSerializer):
    game = GameSerializer(read_only=True)

    class Meta:
        model = Tournament
        fields = ("id", "name", "game")


class MatchSerializer(serializers.ModelSerializer):
    tournament = TournamentSerializer(read_only=True)
    team_a = TeamSerializer(read_only=True)
    team_b = TeamSerializer(read_only=True)
    # Drives the "Book" badge on the match card in the Play screen -
    # true when the current user already has an active bet on this match.
    has_active_bet = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = (
            "id",
            "tournament",
            "team_a",
            "team_b",
            "start_time",
            "status",
            "winner",
            "has_active_bet",
        )

    def get_has_active_bet(self, obj):
        user = self.context["request"].user
        if not user.is_authenticated:
            return False
        return obj.votes.filter(user=user, status=Vote.Status.ACTIVE).exists()
