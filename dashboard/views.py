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
    import requests
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from datetime import datetime

    ticket = "F8537A18-6766-4DEF-9E59-426B4FEE2844"
    url_list = f"https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=publicada&ticket={ticket}"
    
    try:
        res = requests.get(url_list, timeout=10)
        data = res.json()
        items_raw = data.get("Listado", [])
        
        # Take the first 10 items to prevent overload
        items_raw = items_raw[:10]
        
        def fetch_detail(codigo):
            detail_url = f"https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo={codigo}&ticket={ticket}"
            try:
                d_res = requests.get(detail_url, timeout=10)
                d_data = d_res.json()
                if d_data.get("Listado") and len(d_data["Listado"]) > 0:
                    return d_data["Listado"][0]
            except:
                pass
            return None
        
        detailed_items = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_code = {executor.submit(fetch_detail, item["CodigoExterno"]): item for item in items_raw}
            for future in as_completed(future_to_code):
                res_detail = future.result()
                if res_detail:
                    detailed_items.append(res_detail)
        
        # Map to dashboard format
        dashboard_tenders = []
        for d in detailed_items:
            # Map rubro roughly based on string match or default
            desc = (d.get("Descripcion", "") + " " + d.get("Nombre", "")).lower()
            rubro = "oficina"
            rubro_nombre = "Insumos de Oficina"
            if "computador" in desc or "notebook" in desc or "tecnolog" in desc or "software" in desc:
                rubro = "tecnologia"
                rubro_nombre = "Tecnologia e Informatica"
            elif "salud" in desc or "medic" in desc or "hospital" in desc:
                rubro = "salud"
                rubro_nombre = "Salud e Insumos Medicos"
            elif "construccion" in desc or "material" in desc or "herramienta" in desc or "madera" in desc:
                rubro = "construccion"
                rubro_nombre = "Construccion y Ferreteria"
            elif "aseo" in desc or "limpieza" in desc:
                rubro = "aseo"
                rubro_nombre = "Aseo e Higiene"
                
            comprador = d.get("Comprador", {})
            
            # Map items
            items_list = []
            api_items_list = d.get("Items", {}).get("Listado", [])
            for it in api_items_list:
                items_list.append({
                    "producto": it.get("NombreProducto", "Producto desconocido"),
                    "cantidad": it.get("Cantidad", 1)
                })
                
            presupuesto = d.get("MontoEstimado", 0)
            if not presupuesto:
                presupuesto = 500000  # fallback
                
            dashboard_tenders.append({
                "codigo": d.get("CodigoExterno"),
                "nombre": d.get("Nombre"),
                "tipo": "compra_agil",
                "rubro": rubro,
                "rubro_nombre": rubro_nombre,
                "comprador": comprador.get("NombreOrganismo", "Organismo Publico"),
                "region": comprador.get("RegionUnidad", "Region Metropolitana"),
                "ciudad": comprador.get("ComunaUnidad", "Santiago"),
                "presupuesto": presupuesto,
                "fecha_cierre": d.get("FechaCierre"),
                "items": items_list
            })
            
        return JsonResponse({"tenders": dashboard_tenders})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
