import threading

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, TransactionTestCase

from .models import CoinTransaction, InsufficientBalance, Wallet

User = get_user_model()


class WalletSignalTests(TestCase):
    def test_wallet_created_automatically_for_new_user(self):
        user = User.objects.create_user(username="new", email="new@example.com", password="pass12345")
        self.assertTrue(Wallet.objects.filter(user=user).exists())
        self.assertEqual(user.wallet.balance, 0)


class WalletDebitCreditTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username="payer", email="payer@example.com", password="pass12345")
        self.wallet = user.wallet
        self.wallet.balance = 100
        self.wallet.save(update_fields=["balance"])

    def test_debit_reduces_balance_and_records_transaction(self):
        self.wallet.debit(30, CoinTransaction.Type.BET_STAKE)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 70)
        txn = self.wallet.transactions.get()
        self.assertEqual(txn.amount, -30)
        self.assertEqual(txn.type, CoinTransaction.Type.BET_STAKE)

    def test_debit_more_than_balance_raises_and_leaves_balance_unchanged(self):
        with self.assertRaises(InsufficientBalance):
            self.wallet.debit(101, CoinTransaction.Type.BET_STAKE)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 100)
        self.assertFalse(self.wallet.transactions.exists())

    def test_credit_increases_balance_and_records_transaction(self):
        self.wallet.credit(50, CoinTransaction.Type.BET_WIN)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 150)
        txn = self.wallet.transactions.get()
        self.assertEqual(txn.amount, 50)
        self.assertEqual(txn.type, CoinTransaction.Type.BET_WIN)

    def test_the_callers_instance_is_told_the_new_balance(self):
        # The move happens on a freshly locked row, so the caller's own
        # object would otherwise still hold the old number - and the ad
        # reward view answers the request with exactly that attribute.
        self.wallet.credit(50, CoinTransaction.Type.AD_REWARD)
        self.assertEqual(self.wallet.balance, 150)

    def test_a_stale_instance_cannot_write_back_an_old_balance(self):
        # Two handles on the same wallet, as two requests would have. The
        # second was loaded before the first moved any money, so it believes
        # the balance is still 100.
        stale = Wallet.objects.get(pk=self.wallet.pk)
        self.wallet.debit(40, CoinTransaction.Type.BET_STAKE)

        stale.debit(30, CoinTransaction.Type.BET_STAKE)

        # 100 - 40 - 30. If the balance were computed from what `stale` held
        # in Python, this would read 70: the second debit would have erased
        # the first one's, and the user would have bet 70 gg for the price
        # of 30.
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 30)
        self.assertEqual(self.wallet.transactions.count(), 2)


class WalletConcurrencyTests(TransactionTestCase):
    """
    The invariant has to hold without the caller doing anything about it.

    Every production call site does take a row lock first, and the docstring
    used to ask them to. This proves the rule no longer depends on that:
    nothing here locks, and the money still adds up.
    """

    def setUp(self):
        user = User.objects.create_user(username="racer", email="racer@example.com", password="pass12345")
        self.wallet = user.wallet
        self.wallet.balance = 0
        self.wallet.save(update_fields=["balance"])

    def test_concurrent_credits_all_land(self):
        def credit_ten():
            try:
                # A separate instance per thread, exactly as two web requests
                # would have, and no lock taken by the caller.
                Wallet.objects.get(pk=self.wallet.pk).credit(10, CoinTransaction.Type.AD_REWARD)
            finally:
                # Django only closes the main thread's connection on its own.
                connection.close()

        threads = [threading.Thread(target=credit_ten) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 50)
        self.assertEqual(self.wallet.transactions.count(), 5)

    def test_the_ledger_always_sums_to_the_balance(self):
        def move():
            try:
                wallet = Wallet.objects.get(pk=self.wallet.pk)
                wallet.credit(100, CoinTransaction.Type.AD_REWARD)
                try:
                    wallet.debit(30, CoinTransaction.Type.BET_STAKE)
                except InsufficientBalance:
                    pass
            finally:
                connection.close()

        threads = [threading.Thread(target=move) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.wallet.refresh_from_db()
        ledger = sum(t.amount for t in self.wallet.transactions.all())
        # The property the whole design rests on, and the one reconcile_wallets
        # has to go looking for when something else breaks it.
        self.assertEqual(self.wallet.balance, ledger)


class WalletAdminTests(TestCase):
    """
    The admin must not be able to move money without recording why.

    Written against the behaviour rather than against the `readonly_fields`
    setting: asserting that a setting has the value it was given proves
    nothing. This posts an edited balance the way a person would and checks
    the row did not follow.
    """

    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="root", email="root@example.com", password="pass12345"
        )
        holder = User.objects.create_user(
            username="holder", email="holder@example.com", password="pass12345"
        )
        self.wallet = holder.wallet
        self.wallet.balance = 100
        self.wallet.save(update_fields=["balance"])
        self.client.force_login(self.admin)

    def test_a_balance_typed_into_the_admin_is_ignored(self):
        response = self.client.post(
            f"/admin/wallet/wallet/{self.wallet.pk}/change/",
            {"user": self.wallet.user_id, "balance": 999999},
        )
        self.assertIn(response.status_code, (200, 302))

        self.wallet.refresh_from_db()
        # Still 100, and no ledger row invented to explain a change that did
        # not happen. An admin who needs to move gg books a transaction.
        self.assertEqual(self.wallet.balance, 100)
        self.assertFalse(self.wallet.transactions.exists())

