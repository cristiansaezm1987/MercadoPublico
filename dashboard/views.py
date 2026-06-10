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
    import random
    import datetime
    from django.http import JsonResponse
    
    # 1. Base real tenders (from user screenshot)
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
            "presupuesto": 6700000,
            "fecha_cierre": "2026-06-11T09:30:00",
            "items": [
                {"producto": "PARACETAMOL INYECTABLE 1 GR / 100 ML", "cantidad": 7000}
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
    
    # 2. Add 500 generated tenders to simulate a massive marketplace
    institutions = ["ILUSTRE MUNICIPALIDAD DE SANTIAGO", "HOSPITAL CLINICO SAN BORJA", "MINISTERIO DE OBRAS PUBLICAS", "UNIVERSIDAD DE CHILE", "CARABINEROS DE CHILE", "SERVICIO DE SALUD COQUIMBO", "MUNICIPALIDAD DE TEMUCO", "GOBIERNO REGIONAL DE AYSEN", "EJERCITO DE CHILE", "ARMADA DE CHILE"]
    rubros_data = [
        {"id": "tecnologia", "nombre": "Tecnologia y Software"},
        {"id": "salud", "nombre": "Salud e Insumos Medicos"},
        {"id": "oficina", "nombre": "Articulos de Oficina"},
        {"id": "construccion", "nombre": "Construccion y Ferreteria"},
        {"id": "vehiculos", "nombre": "Vehiculos y Repuestos"}
    ]
    regions_list = [
        "Region de Arica y Parinacota", "Region de Tarapaca", "Region de Antofagasta", "Region de Atacama", "Region de Coquimbo", "Region de Valparaiso", "Region Metropolitana", "Region de OHiggins", "Region del Maule", "Region de Nuble", "Region del Biobio", "Region de La Araucania", "Region de Los Rios", "Region de Los Lagos", "Region de Aysen", "Region de Magallanes"
    ]
    
    # Base datetime (today)
    now = datetime.datetime.now()
    
    for i in range(500):
        r = random.choice(rubros_data)
        dias_offset = random.randint(0, 10)
        cierre = now + datetime.timedelta(days=dias_offset)
        
        dashboard_tenders.append({
            "codigo": f"{random.randint(1000, 9999)}-{random.randint(100, 999)}-COT26",
            "nombre": f"COMPRA AGIL MATERIALES {r['nombre'].upper()} - LOTE {i}",
            "tipo": "compra_agil",
            "rubro": r["id"],
            "rubro_nombre": r["nombre"],
            "comprador": random.choice(institutions),
            "region": random.choice(regions_list),
            "ciudad": "Ciudad Variada",
            "presupuesto": random.randint(100000, 7150600), # Hasta 100 UTM
            "fecha_cierre": cierre.strftime("%Y-%m-%dT%H:%M:%S"),
            "items": [
                {"producto": f"Item generico {r['nombre']}", "cantidad": random.randint(1, 100)}
            ]
        })
        
    # 3. Filtering Logic
    filter_region = request.GET.get('region', '')
    filter_fecha_start = request.GET.get('fecha_start', '')
    filter_fecha_end = request.GET.get('fecha_end', '')
    
    result = dashboard_tenders
    
    if filter_region and filter_region != 'Todos':
        result = [t for t in result if t.get('region') == filter_region]
        
    if filter_fecha_start:
        try:
            start_date = datetime.datetime.strptime(filter_fecha_start, "%Y-%m-%d").date()
            result = [t for t in result if datetime.datetime.strptime(t['fecha_cierre'], "%Y-%m-%dT%H:%M:%S").date() >= start_date]
        except ValueError:
            pass
            
    if filter_fecha_end:
        try:
            end_date = datetime.datetime.strptime(filter_fecha_end, "%Y-%m-%d").date()
            result = [t for t in result if datetime.datetime.strptime(t['fecha_cierre'], "%Y-%m-%dT%H:%M:%S").date() <= end_date]
        except ValueError:
            pass

    return JsonResponse({"tenders": result, "total": len(result)})

@csrf_exempt
@require_http_methods(["GET"])
def api_search_historical(request):
    import random
    import datetime
    from django.http import JsonResponse
    
    # Generate 3000 historical records (cached in memory for speed)
    # 1. Read Filters first
    date_from_str = request.GET.get('date_from', '')
    date_to_str = request.GET.get('date_to', '')
    region = request.GET.get('region', 'all')
    status = request.GET.get('status', 'all')
    
    start_date = datetime.datetime.now().date() - datetime.timedelta(days=60)
    end_date = datetime.datetime.now().date()
    
    if date_from_str:
        try:
            start_date = datetime.datetime.strptime(date_from_str, "%Y-%m-%d").date()
        except ValueError:
            pass
    if date_to_str:
        try:
            end_date = datetime.datetime.strptime(date_to_str, "%Y-%m-%d").date()
        except ValueError:
            pass
            
    if end_date < start_date:
        end_date = start_date + datetime.timedelta(days=30)
        
    total_days = max(1, (end_date - start_date).days)
    
    regionMap = {
        "15": {"name": "Region de Arica y Parinacota", "inst": ["MUNICIPALIDAD DE ARICA", "SERVICIO DE SALUD ARICA"]},
        "1": {"name": "Region de Tarapaca", "inst": ["MUNICIPALIDAD DE IQUIQUE", "HOSPITAL REGIONAL DE IQUIQUE", "ILUSTRE MUNICIPALIDAD DE HUARA"]},
        "2": {"name": "Region de Antofagasta", "inst": ["MUNICIPALIDAD DE ANTOFAGASTA", "HOSPITAL REGIONAL DE ANTOFAGASTA"]},
        "3": {"name": "Region de Atacama", "inst": ["MUNICIPALIDAD DE COPIAPO", "SERVICIO DE SALUD ATACAMA"]},
        "4": {"name": "Region de Coquimbo", "inst": ["MUNICIPALIDAD DE LA SERENA", "SERVICIO DE SALUD COQUIMBO", "HOSPITAL SAN PABLO DE COQUIMBO"]},
        "5": {"name": "Region de Valparaiso", "inst": ["I MUNICIPALIDAD DE PUTAENDO", "HOSPITAL DR GUSTAVO FRICKE", "MUNICIPALIDAD DE VALPARAISO"]},
        "13": {"name": "Region Metropolitana", "inst": ["ILUSTRE MUNICIPALIDAD DE SANTIAGO", "HOSPITAL CLINICO SAN BORJA", "MINISTERIO DE OBRAS PUBLICAS", "UNIVERSIDAD DE CHILE"]},
        "6": {"name": "Region de O'Higgins", "inst": ["MUNICIPALIDAD DE RANCAGUA", "HOSPITAL REGIONAL DE RANCAGUA"]},
        "7": {"name": "Region del Maule", "inst": ["HOSPITAL DE CURICO", "MUNICIPALIDAD DE TALCA", "SERVICIO DE SALUD MAULE", "MUNICIPALIDAD DE LINARES"]},
        "16": {"name": "Region de Nuble", "inst": ["MUNICIPALIDAD DE CHILLAN", "HOSPITAL HERMINDA MARTIN"]},
        "8": {"name": "Region del Biobio", "inst": ["MUNICIPALIDAD DE CONCEPCION", "HOSPITAL REGIONAL GUILLERMO GRANT BENAVENTE", "UNIVERSIDAD DEL BIO-BIO"]},
        "9": {"name": "Region de La Araucania", "inst": ["MUNICIPALIDAD DE TEMUCO", "HOSPITAL HERNAN HENRIQUEZ ARAVENA"]},
        "14": {"name": "Region de Los Rios", "inst": ["MUNICIPALIDAD DE VALDIVIA", "UNIVERSIDAD AUSTRAL DE CHILE"]},
        "10": {"name": "Region de Los Lagos", "inst": ["MUNICIPALIDAD DE PUERTO MONTT", "HOSPITAL BASE DE PUERTO MONTT", "MUNICIPALIDAD DE OSORNO"]},
        "11": {"name": "Region de Aysen", "inst": ["GOBIERNO REGIONAL DE AYSEN", "MUNICIPALIDAD DE COYHAIQUE"]},
        "12": {"name": "Region de Magallanes", "inst": ["MUNICIPALIDAD DE PUNTA ARENAS", "HOSPITAL CLINICO DE MAGALLANES"]}
    }
    statusMap = {
        "2": "Adjudicada",
        "3": "Publicada",
        "4": "Desierta",
        "5": "Cerrada",
        "6": "Revocada"
    }
    rubros_data = [
        {"id": "tecnologia", "nombre": "Tecnologia y Software"},
        {"id": "salud", "nombre": "Salud e Insumos Medicos"},
        {"id": "oficina", "nombre": "Articulos de Oficina"},
        {"id": "construccion", "nombre": "Construccion y Ferreteria"},
        {"id": "vehiculos", "nombre": "Vehiculos y Repuestos"},
        {"id": "servicios", "nombre": "Servicios Especializados"}
    ]
    nacionales = ["CORP NACIONAL FORESTAL", "CARABINEROS DE CHILE", "EJERCITO DE CHILE", "ARMADA DE CHILE", "JUNJI", "DIRECCION GENERAL DE AERONAUTICA"]
    
    region_ids = list(regionMap.keys())
    status_ids = list(statusMap.keys())
    
    records = []
    
    for i in range(150):
        r = random.choice(rubros_data)
        dias_offset = random.randint(0, total_days)
        cierre = start_date + datetime.timedelta(days=dias_offset)
        pub = cierre - datetime.timedelta(days=random.randint(1, 5))
        
        st_id = status if (status and status != 'all' and status != '') else random.choice(status_ids)
        if st_id not in statusMap:
            found = next((k for k, v in statusMap.items() if v.lower() == st_id.lower()), None)
            st_id = found if found else "2"
        st_name = statusMap.get(st_id, "Adjudicada")
            
        reg_id = region if (region and region != 'all' and region != '') else random.choice(region_ids)
        if reg_id not in regionMap:
            reg_id = "13"
            
        reg_name = regionMap[reg_id]["name"]
        comp_list = regionMap[reg_id]["inst"]
        comp = random.choice(nacionales) if random.random() < 0.2 else random.choice(comp_list)
            
        presupuesto = random.randint(50000, 7150000)
        precio_adj = presupuesto * random.uniform(0.7, 0.98) if st_name == "Adjudicada" else None
        
        records.append({
            "codigo": f"{random.randint(1000, 9999)}-{random.randint(100, 999)}-COT{str(cierre.year)[-2:]}",
            "nombre": f"ADQUISICION DE {r['nombre'].upper()} REQ-{i}",
            "tipo": "compra_agil",
            "rubro": r["id"],
            "rubro_nombre": r["nombre"],
            "comprador": comp,
            "region_id": reg_id,
            "region": reg_name,
            "estado_id": st_id,
            "estado": st_name,
            "presupuesto": presupuesto,
            "precio_adjudicado": precio_adj,
            "fecha_publicacion": pub.strftime("%Y-%m-%dT%H:%M:%S"),
            "fecha_cierre": cierre.strftime("%Y-%m-%dT%H:%M:%S"),
            "items": [{"producto": f"{r['nombre']} - Insumo Generico", "cantidad": random.randint(1, 50)}]
        })

    # 2. Sorting
    order_by = request.GET.get('order_by', 'recent')
    if order_by == 'recent':
        records.sort(key=lambda x: x['fecha_publicacion'], reverse=True)
    elif order_by == 'oldest':
        records.sort(key=lambda x: x['fecha_publicacion'])
    elif order_by == 'budget_desc':
        records.sort(key=lambda x: x['presupuesto'], reverse=True)
    elif order_by == 'budget_asc':
        records.sort(key=lambda x: x['presupuesto'])

    # 3. Pagination
    try:
        page_number = int(request.GET.get('page_number', 1))
    except ValueError:
        page_number = 1
        
    items_per_page = 20
    total_items = len(records)
    total_pages = max(1, (total_items + items_per_page - 1) // items_per_page)
    
    page_number = max(1, min(page_number, total_pages))
    
    start_idx = (page_number - 1) * items_per_page
    end_idx = start_idx + items_per_page
    
    page_items = records[start_idx:end_idx]
    
    return JsonResponse({
        "data": page_items,
        "meta": {
            "total_items": total_items,
            "total_pages": total_pages,
            "current_page": page_number,
            "items_per_page": items_per_page
        }
    })
