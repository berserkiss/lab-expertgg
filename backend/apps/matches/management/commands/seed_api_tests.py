"""
Deterministic fixture for the Postman/newman run.

The API tests assert on exact numbers - a balance that goes down by exactly
the stake, a second page that shares no ids with the first - so they need a
known starting point rather than whatever the database happens to hold. This
command creates that starting point and is safe to run repeatedly.

It is a test fixture, not demo data: it deliberately does NOT touch any user
other than the one it owns.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.matches.models import Game, Match, Team, Tournament
from apps.wallet.models import CoinTransaction, Wallet

User = get_user_model()

DEFAULT_EMAIL = "api-tests@example.com"
DEFAULT_PASSWORD = "api-tests-password"
# More than one page (PAGE_SIZE is 20), so the collection can walk `next`
# and check that paging does not repeat or skip rows.
DEFAULT_MATCHES = 25


class Command(BaseCommand):
    help = "Create the user, wallet balance and matches the API test collection expects."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=DEFAULT_EMAIL)
        parser.add_argument("--password", default=DEFAULT_PASSWORD)
        parser.add_argument("--balance", type=int, default=1000)
        parser.add_argument("--matches", type=int, default=DEFAULT_MATCHES)

    @transaction.atomic
    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email=options["email"],
            defaults={"username": options["email"].split("@")[0]},
        )
        # Always reset the password: the collection signs in with it, and a
        # fixture whose credentials depend on when it was first created is
        # not a fixture.
        user.set_password(options["password"])
        user.save()

        wallet = Wallet.objects.get(user=user)
        target = options["balance"]
        # Moved through credit()/debit() rather than assigned, so the ledger
        # still sums to the balance afterwards - the seed does not create
        # the very drift the reconcile command exists to find.
        if wallet.balance < target:
            wallet.credit(target - wallet.balance, CoinTransaction.Type.ADJUSTMENT)
        elif wallet.balance > target:
            wallet.debit(wallet.balance - target, CoinTransaction.Type.ADJUSTMENT)

        game, _ = Game.objects.get_or_create(slug="csgo", defaults={"name": "Counter-Strike"})
        tournament, _ = Tournament.objects.get_or_create(
            name="API Test Cup", defaults={"game": game}
        )
        teams = [
            Team.objects.get_or_create(name=f"API Test Team {i}")[0]
            for i in range(1, 5)
        ]
        # A team that plays in no match at all, so the collection can assert
        # that betting on an unrelated team is refused.
        outsider, _ = Team.objects.get_or_create(name="API Test Outsider")

        start = timezone.now() + timedelta(hours=1)
        created_matches = 0
        for i in range(options["matches"]):
            match, was_created = Match.objects.get_or_create(
                tournament=tournament,
                team_a=teams[i % 2],
                team_b=teams[2 + (i % 2)],
                # Distinct start times: identical ones are legitimate in real
                # data, but here they would make "page two differs from page
                # one" depend on the tiebreak rather than test it.
                start_time=start + timedelta(minutes=i),
                defaults={"status": Match.Status.UPCOMING},
            )
            created_matches += int(was_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"{options['email']} ready: balance {target} gg, "
                f"{Match.objects.filter(tournament=tournament).count()} matches "
                f"({created_matches} new), outsider team #{outsider.id}"
            )
        )
