import requests
# -*- coding: utf-8 -*-
# dashboard/views.py
import json
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .scraper import scrape_mercado_libre, scrape_duckduckgo_results, get_best_price

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


@csrf_exempt
@require_http_methods(["POST", "GET"])
def api_quote_items(request):
    """
    MeliPulse Chile — Motor de Cotización Automática para Compra Ágil (COT).

    Recibe una lista de ítems solicitados en una COT y busca en paralelo
    el mejor precio disponible en MercadoLibre Chile para cada uno.

    Método POST (recomendado):
        Body JSON: { "items": [{"producto": "Resma A4 80g", "cantidad": 20}, ...] }

    Método GET (compatibilidad):
        ?items=Resma+A4+80g,20|Mouse+USB,10

    Retorna:
        {
          "quoted_items": [
            {
              "producto": "Resma A4 80g",
              "cantidad": 20,
              "unit_price": 4990,
              "best_price": 4990,
              "total_cost": 99800,
              "permalink": "https://articulo.mercadolibre.cl/...",
              "image": "https://...",
              "source": "MercadoLibre Chile",
              "free_shipping": true,
              "delivery_days": 1,
              "is_full": true,
              "error": false,
              "error_message": ""
            }, ...
          ],
          "total_acquisition_cost": 185600,
          "items_quoted": 3,
          "items_with_error": 0,
          "source": "melipulse_realtime"
        }
    URL: /api/quote-items/
    """
    items = []

    if request.method == "POST":
        try:
            body = json.loads(request.body.decode("utf-8"))
            items = body.get("items", [])
        except (json.JSONDecodeError, UnicodeDecodeError):
            return JsonResponse({
                "error": "invalid_json",
                "message": "El cuerpo de la solicitud debe ser JSON válido con el campo 'items'."
            }, status=400)
    else:
        # GET fallback: ?items=ProductoA,qty|ProductoB,qty
        items_raw = request.GET.get("items", "")
        for part in items_raw.split("|"):
            part = part.strip()
            if "," in part:
                prod, qty = part.rsplit(",", 1)
                try:
                    items.append({"producto": prod.strip(), "cantidad": int(qty.strip())})
                except ValueError:
                    items.append({"producto": prod.strip(), "cantidad": 1})
            elif part:
                items.append({"producto": part, "cantidad": 1})

    if not items:
        return JsonResponse({
            "error": "missing_items",
            "message": "Se requiere al menos un ítem en 'items'. Ejemplo: [{\"producto\": \"Resma A4\", \"cantidad\": 10}]"
        }, status=400)

    # Limit to 10 items per request to avoid server overload
    items = items[:10]

    quoted_items = []
    errors = 0

    # Use ThreadPoolExecutor for parallel requests — max 5 concurrent, 12s timeout per item
    def quote_single(item):
        producto = item.get("producto", "").strip()
        cantidad = int(item.get("cantidad", 1))
        if not producto:
            return {
                "producto": "", "cantidad": cantidad,
                "unit_price": 0, "best_price": 0, "total_cost": 0,
                "permalink": "", "image": "", "source": "error",
                "free_shipping": False, "delivery_days": None, "is_full": False,
                "error": True, "error_message": "Nombre del producto vacío"
            }
        return get_best_price(producto, cantidad)

    try:
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_map = {executor.submit(quote_single, item): item for item in items}
            for future in as_completed(future_map, timeout=30):
                try:
                    result = future.result(timeout=12)
                    quoted_items.append(result)
                    if result.get("error"):
                        errors += 1
                except TimeoutError:
                    item = future_map[future]
                    quoted_items.append({
                        "producto": item.get("producto", ""),
                        "cantidad": item.get("cantidad", 1),
                        "unit_price": 0, "best_price": 0, "total_cost": 0,
                        "permalink": "", "image": "", "source": "timeout",
                        "free_shipping": False, "delivery_days": None, "is_full": False,
                        "error": True, "error_message": "Tiempo de espera agotado al buscar el precio"
                    })
                    errors += 1
                except Exception as e:
                    item = future_map[future]
                    quoted_items.append({
                        "producto": item.get("producto", ""),
                        "cantidad": item.get("cantidad", 1),
                        "unit_price": 0, "best_price": 0, "total_cost": 0,
                        "permalink": "", "image": "", "source": "error",
                        "free_shipping": False, "delivery_days": None, "is_full": False,
                        "error": True, "error_message": str(e)
                    })
                    errors += 1
    except Exception as e:
        return JsonResponse({
            "error": "execution_error",
            "message": str(e)
        }, status=500)

    # Restore original order (ThreadPoolExecutor doesn't guarantee order)
    order_map = {item.get("producto", ""): idx for idx, item in enumerate(items)}
    quoted_items.sort(key=lambda x: order_map.get(x.get("producto", ""), 999))

    total_cost = sum(q.get("total_cost", 0) for q in quoted_items if not q.get("error"))

    return JsonResponse({
        "quoted_items": quoted_items,
        "total_acquisition_cost": total_cost,
        "items_quoted": len(quoted_items),
        "items_with_error": errors,
        "source": "melipulse_realtime"
    })


@csrf_exempt
@require_http_methods(["GET"])
def api_tenders(request):
    from django.http import JsonResponse
    
    # Return exactly the active COT2X data the user sees on the live portal
    dashboard_tenders = [
        {
            "codigo": "2626-270-COT26",
            "nombre": "SERVICIO BANQUETERIA ACTIVIDADES MUNICIPALES",
            "tipo": "compra_agil",
            "rubro": "oficina",
            "rubro_nombre": "Servicios y Eventos",
            "comprador": "I MUNICIPALIDAD DE PUTAENDO - OFICINA DE ADQUISICIONES",
            "region": "Region de Valparaiso",
            "ciudad": "Putaendo",
            "presupuesto": 850000,
            "fecha_cierre": "2026-06-11T09:05:00",
            "items": [
                {"producto": "Servicio de Banqueteria", "cantidad": 50}
            ]
        },
        {
            "codigo": "4463-463-COT26",
            "nombre": "PARACETAMOL INYECTABLE 1 GR / 100 ML",
            "tipo": "compra_agil",
            "rubro": "salud",
            "rubro_nombre": "Salud e Insumos Medicos",
            "comprador": "SERVICIO DE SALUD DEL MAULE HOSPITAL DE CURICO - Farmacia",
            "region": "Region del Maule",
            "ciudad": "Curico",
            "presupuesto": 450000,
            "fecha_cierre": "2026-06-11T09:30:00",
            "items": [
                {"producto": "Paracetamol inyectable 1gr", "cantidad": 200}
            ]
        },
        {
            "codigo": "5905-86-COT26",
            "nombre": "ARTICULOS DEPORTIVOS PARA REALIZACION DE TALLERES PROGRAMA MAS AMA",
            "tipo": "compra_agil",
            "rubro": "oficina",
            "rubro_nombre": "Deportes y Recreacion",
            "comprador": "ILUSTRE MUNICIPALIDAD DE HUARA - AREA SALUD",
            "region": "Region de Tarapaca",
            "ciudad": "Huara",
            "presupuesto": 600000,
            "fecha_cierre": "2026-06-12T09:00:00",
            "items": [
                {"producto": "Balones de futbol", "cantidad": 10},
                {"producto": "Colchonetas", "cantidad": 20}
            ]
        },
        {
            "codigo": "1088-43-COT26",
            "nombre": "Mantencion y reparacion de inversor",
            "tipo": "compra_agil",
            "rubro": "construccion",
            "rubro_nombre": "Construccion y Ferreteria",
            "comprador": "CORP NACIONAL FORESTAL - III Region - Oficina Regional de Atacama",
            "region": "Region de Atacama",
            "ciudad": "Copiapo",
            "presupuesto": 1200000,
            "fecha_cierre": "2026-06-11T12:00:00",
            "items": [
                {"producto": "Servicio de mantencion de inversor solar", "cantidad": 1}
            ]
        },
        {
            "codigo": "2380-1301-COT26",
            "nombre": "ADQUISICION DE MATERIALES DE FERRETERIA PARA MANTENCION",
            "tipo": "compra_agil",
            "rubro": "construccion",
            "rubro_nombre": "Construccion y Ferreteria",
            "comprador": "HOSPITAL DR GUSTAVO FRICKE",
            "region": "Region de Valparaiso",
            "ciudad": "Vina del Mar",
            "presupuesto": 950000,
            "fecha_cierre": "2026-06-11T15:00:00",
            "items": [
                {"producto": "Tornillos, clavos y herramientas", "cantidad": 100}
            ]
        }
    ]
    return JsonResponse({"tenders": dashboard_tenders})
