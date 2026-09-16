from django.urls import path

from .views import AdRewardView

urlpatterns = [
    path("ad-reward/", AdRewardView.as_view(), name="ad-reward"),
]
