from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard_view, name="dashboard"),
    path("api/search/", views.api_search, name="api_search"),
    path("api/quote-items/", views.api_quote_items, name="api_quote_items"),
]
