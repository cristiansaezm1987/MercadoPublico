from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard_view, name="dashboard"),
    path("api/tenders/", views.api_tenders, name="api_tenders"),
    path("api/tenders/<str:codigo>/", views.api_tender_detail, name="api_tender_detail"),
    path("api/analyze/", views.api_analyze, name="api_analyze"),
    path("api/rubros/", views.api_rubros, name="api_rubros"),
    path("api/suppliers/", views.api_suppliers, name="api_suppliers"),
    path("api/recommend/", views.api_recommend, name="api_recommend"),
    path("api/compradores/", views.api_compradores_por_region, name="api_compradores"),
]
