from django.urls import path

from .views.signup import SignupView

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
]
