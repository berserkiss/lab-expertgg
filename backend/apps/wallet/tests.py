from django.contrib.auth import get_user_model
from django.test import TestCase

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
