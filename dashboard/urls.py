from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard_view, name="dashboard"),
    path("api/historical/", views.api_search_historical, name="api_search_historical"),
    path('api/cot_detail/', views.api_cot_detail, name='api_cot_detail'),
    path("api/tenders/", views.api_tenders, name="api_tenders"),
]
