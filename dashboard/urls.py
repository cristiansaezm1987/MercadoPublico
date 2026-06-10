from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard_view, name="dashboard"),
    path("api/historical/", views.api_search_historical, name="api_search_historical"),
    path("api/tenders/", views.api_tenders, name="api_tenders"),
]
