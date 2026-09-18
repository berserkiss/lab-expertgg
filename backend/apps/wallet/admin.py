from django.contrib import admin

from .models import CoinTransaction, Wallet


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("user", "balance")
    # Read-only on purpose. Typing a number into this field wrote it straight
    # to the row and left no CoinTransaction behind, so the ledger and the
    # balance stopped agreeing with no record of who changed what - and that
    # is the drift reconcile_wallets exists to hunt for. With this, the only
    # writers of a balance are credit() and debit(), each of which records
    # the reason it moved.
    readonly_fields = ("balance",)


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    list_display = ("wallet", "amount", "type", "created_at")
    list_filter = ("type",)
    # The ledger is append-only in spirit; editing a past row would rewrite
    # history and silently break the sum the balance is checked against.
    readonly_fields = ("wallet", "amount", "type", "related_vote", "created_at")

    def has_change_permission(self, request, obj=None):
        return False
