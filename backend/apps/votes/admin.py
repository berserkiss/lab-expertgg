from django.contrib import admin

from .models import Vote


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ("user", "match", "predicted_team", "stake", "status", "payout", "created_at")
    list_filter = ("status",)
