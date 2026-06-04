# -*- coding: utf-8 -*-
# dashboard/views.py
from django.shortcuts import render
from django.http import JsonResponse
from . import api_client
from . import intelligence
from .data_fixtures import RUBROS, COMPRADORES, HISTORIAL_LICITACIONES, REGIONES_CHILE

def dashboard_view(request):
    regiones = REGIONES_CHILE
    recommended_rubros = intelligence.detect_highest_potential_rubros()
    context = {
        "rubros": RUBROS,
        "compradores": COMPRADORES,
        "regiones": regiones,
        "recommended_rubros": recommended_rubros,
        "recent_tenders": HISTORIAL_LICITACIONES,
    }
    return render(request, "dashboard/index.html", context)

def api_tenders(request):
    fecha = request.GET.get("fecha", None)
    estado = request.GET.get("estado", "publicada")
    data = api_client.fetch_recent_tenders(date_str=fecha, estado=estado)
    return JsonResponse(data)

def api_tender_detail(request, codigo):
    data = api_client.fetch_tender_detail(codigo)
    return JsonResponse(data)

def api_analyze(request):
    try:
        cost_val = request.GET.get("cost") or request.POST.get("cost")
        if not cost_val:
            return JsonResponse({"error": "Parametro cost es requerido"}, status=400)
        cost = float(cost_val)
        rubro_id = request.GET.get("rubro_id", "") or request.POST.get("rubro_id", "")
        region = request.GET.get("region", "") or request.POST.get("region", "")
        comprador = request.GET.get("comprador", "") or request.POST.get("comprador", "")
        if not rubro_id or not region:
            return JsonResponse({"error": "Faltan parametros requeridos (rubro_id, region)"}, status=400)
        analysis = intelligence.calculate_optimal_bid(cost, rubro_id, region, comprador)
        return JsonResponse(analysis)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def api_rubros(request):
    region = request.GET.get("region", "Region Metropolitana")
    data = intelligence.detect_highest_potential_rubros(user_region=region)
    return JsonResponse({"rubros": data})

def api_suppliers(request):
    try:
        rubro_id = request.GET.get("rubro_id", "")
        region = request.GET.get("region", "")
        cost_val = request.GET.get("cost", 0)
        if not rubro_id or not region or not cost_val:
            return JsonResponse({"error": "Faltan parametros requeridos (rubro_id, region, cost)"}, status=400)
        cost = float(cost_val)
        suppliers = intelligence.find_suppliers_and_costs(rubro_id, region, cost)
        return JsonResponse({"suppliers": suppliers})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def api_recommend(request):
    try:
        budget_val = request.GET.get("budget", 0)
        if not budget_val:
            return JsonResponse({"error": "Parametro budget es requerido"}, status=400)
        budget = float(budget_val)
        rubro_id = request.GET.get("rubro_id", "")
        region = request.GET.get("region", "")
        recommendations = intelligence.recommend_tenders(budget, rubro_id, region)
        return JsonResponse({"recommendations": recommendations})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def api_compradores_por_region(request):
    region = request.GET.get("region", "")
    if region:
        filtered = [c for c in COMPRADORES if c["region"] == region]
    else:
        filtered = COMPRADORES
    return JsonResponse({"compradores": filtered})
