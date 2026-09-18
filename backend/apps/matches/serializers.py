from rest_framework import serializers

from apps.votes.models import Vote

from .models import Game, Match, Team, Tournament


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ("id", "name", "slug", "icon")


class TeamSerializer(serializers.ModelSerializer):
    # A locally-uploaded `logo` file wins if present; otherwise fall back to
    # PandaScore's hosted logo_url for teams synced from the feed.
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ("id", "name", "logo")

    def get_logo(self, obj):
        if obj.logo:
            request = self.context.get("request")
            url = obj.logo.url
            return request.build_absolute_uri(url) if request else url
        return obj.logo_url


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
    # What a winning bet on this match pays: stake * multiplier + bonus.
    # Sent rather than assumed, so the Vote button quotes the server's rule
    # instead of a constant compiled into the app months ago.
    payout_multiplier = serializers.SerializerMethodField()
    payout_bonus = serializers.SerializerMethodField()

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
            "payout_multiplier",
            "payout_bonus",
        )

    def get_payout_multiplier(self, obj):
        from apps.votes.betting import WIN_MULTIPLIER

        return WIN_MULTIPLIER

    def get_payout_bonus(self, obj):
        from apps.votes.betting import WIN_BONUS

        return WIN_BONUS

    def get_has_active_bet(self, obj):
        user = self.context["request"].user
        if not user.is_authenticated:
            return False
        return obj.votes.filter(user=user, status=Vote.Status.ACTIVE).exists()
