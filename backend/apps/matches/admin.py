from django.contrib import admin

from .models import Game, Match, Team, Tournament


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ("name", "game", "external_id")
    list_filter = ("game",)


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "external_id")


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ("team_a", "team_b", "tournament", "start_time", "status", "winner", "external_id")
    list_filter = ("status", "tournament__game")
