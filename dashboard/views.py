# -*- coding: utf-8 -*-
# dashboard/views.py
from django.shortcuts import render
from django.http import JsonResponse
from .scraper import scrape_mercado_libre, scrape_duckduckgo_results

def dashboard_view(request):
    """
    Renders the main dashboard page.
    """
    return render(request, "dashboard/index.html")

def api_search(request):
    """
    API endpoint that receives a search query and returns combined results:
    Mercado Libre Chile products + DuckDuckGo search results from other stores.
    URL: /api/search/?q=<query>
    """
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({
            "error": "missing_query",
            "message": "El parámetro de búsqueda 'q' es requerido."
        }, status=400)
        
    try:
        # 1. Scrape Mercado Libre Chile
        meli_data = scrape_mercado_libre(query)
        
        # 2. Scrape other stores via DuckDuckGo
        other_results = scrape_duckduckgo_results(query)
        
        # Check if Mercado Libre returned a blocking/captcha error
        if isinstance(meli_data, dict) and "error" in meli_data:
            # We return the error details for Meli but include other results if any
            return JsonResponse({
                "error": meli_data["error"],
                "message": meli_data["message"],
                "fallback_suggested": meli_data.get("fallback_suggested", False),
                "meli_results": [],
                "other_results": other_results,
                "count_meli": 0,
                "count_other": len(other_results)
            })
            
        return JsonResponse({
            "meli_results": meli_data.get("results", []),
            "other_results": other_results,
            "source": "server_scraper",
            "count_meli": len(meli_data.get("results", [])),
            "count_other": len(other_results)
        })
    except Exception as e:
        return JsonResponse({
            "error": "server_error",
            "message": str(e)
        }, status=500)
