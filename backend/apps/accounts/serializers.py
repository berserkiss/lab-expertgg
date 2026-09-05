from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.wallet.models import Wallet

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ("id", "email", "username", "password")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "username", "avatar", "balance")
        read_only_fields = ("id", "email")

    def get_balance(self, obj):
        wallet, _ = Wallet.objects.get_or_create(user=obj)
        return wallet.balance
