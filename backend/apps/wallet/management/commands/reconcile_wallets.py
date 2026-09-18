from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum

from apps.wallet.models import CoinTransaction, Wallet


class Command(BaseCommand):
    help = (
        "Write an adjustment transaction wherever a wallet's balance and its "
        "ledger disagree, so the ledger sums to the balance."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the adjustments. Without it the command only reports.",
        )

    def handle(self, *args, **options):
        # Balance is denormalised onto Wallet, and anything that sets it
        # without going through credit()/debit() - seeding, a balance edited
        # in the admin - leaves no transaction behind. The ledger then no
        # longer explains the balance, which makes it useless for auditing.
        # This squares the two by booking the difference explicitly rather
        # than by quietly rewriting either side.
        drifted = []
        for wallet in Wallet.objects.all().order_by("user_id"):
            ledger = wallet.transactions.aggregate(total=Sum("amount"))["total"] or 0
            diff = wallet.balance - ledger
            if diff:
                drifted.append((wallet, ledger, diff))

        if not drifted:
            self.stdout.write(self.style.SUCCESS("Every wallet already matches its ledger."))
            return

        for wallet, ledger, diff in drifted:
            self.stdout.write(
                f"  user {wallet.user_id}: balance {wallet.balance}, ledger {ledger}, off by {diff:+d}"
            )

        if not options["apply"]:
            self.stdout.write(
                self.style.WARNING(f"{len(drifted)} wallet(s) drifted. Re-run with --apply to book them.")
            )
            return

        with transaction.atomic():
            for wallet, _ledger, diff in drifted:
                wallet.transactions.create(amount=diff, type=CoinTransaction.Type.ADJUSTMENT)
        self.stdout.write(self.style.SUCCESS(f"Booked {len(drifted)} adjustment(s)."))
