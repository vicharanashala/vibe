from django.urls import include, path
from oauth2_provider import urls as oauth2_urls

from .views import signup, login, logout, password_reset, change_password, refresh_token

urlpatterns = [
    path("o/", include(oauth2_urls)),
    path("signup/", signup, name="signup"),
    path("login/", login, name="login"),
    path("logout/", logout, name="logout_custom"),
    path("password_reset/", password_reset, name="password_reset"),
    path("change_password/", change_password, name="change_password"),
    path("refresh_token/", refresh_token, name="refresh_token"),
]
