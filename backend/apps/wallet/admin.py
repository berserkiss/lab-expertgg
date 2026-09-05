from django.contrib import admin

from .models import CoinTransaction, Wallet


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("user", "balance")


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    list_display = ("wallet", "amount", "type", "created_at")
    list_filter = ("type",)
