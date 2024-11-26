from home.views import *
from django.urls import path
from home.institutes import *
from home.questions import *
from home.articles import *
from home.program import *
from home.programGroupMap import *
from home.views import *
from home.groups import *
from home.courses import *
from home.auth import UserRegistrationView, UserLoginView, resetPasswordView, check_login

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('institutes/', InstitutesView.as_view()),
    path('questions/', questions),
    path('articles/', articles),

    path('programs/', ProgramsView.as_view()),
    path('programgroups/', programGroupMap),
    path('groups/', groupsRoute),

    path('register/', UserRegistrationView.as_view(), name='register'),
    path('login/', UserLoginView.as_view(), name='login'),
    # Get key for password reset
    # path('reset-password/<str:key>/', resetPasswordView),

    path('checkLogin/', check_login.as_view(), name='check_login'),
    path('courses/', courses, name='courses'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]