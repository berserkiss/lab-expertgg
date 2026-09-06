from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LogoutView, MeView, RegisterView, ThrottledTokenObtainPairView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    # USERNAME_FIELD = "email" on the User model, so SimpleJWT already
    # expects {"email": ..., "password": ...} here - no custom view needed.
    path("login/", ThrottledTokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
]
