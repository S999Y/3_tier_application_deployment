from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("auth/login/", obtain_auth_token, name="login"),
    path("results/upload/", views.upload_results, name="upload-results"),
    path("results/<str:student_id>/", views.get_result, name="get-result"),
]
