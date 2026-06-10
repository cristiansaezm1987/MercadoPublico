import io

new_view = """@csrf_exempt
@require_http_methods(["GET"])
def api_search_historical(request):
    import random
    import datetime
    from django.http import JsonResponse
    
    # Generate 3000 historical records (cached in memory for speed)
    if not hasattr(api_search_historical, '_cache'):
        institutions = ["I MUNICIPALIDAD DE PUTAENDO", "HOSPITAL DE CURICO", "ILUSTRE MUNICIPALIDAD DE HUARA", "CORP NACIONAL FORESTAL", "HOSPITAL DR GUSTAVO FRICKE", "ILUSTRE MUNICIPALIDAD DE SANTIAGO", "HOSPITAL CLINICO SAN BORJA", "MINISTERIO DE OBRAS PUBLICAS", "UNIVERSIDAD DE CHILE", "CARABINEROS DE CHILE", "SERVICIO DE SALUD COQUIMBO", "MUNICIPALIDAD DE TEMUCO", "GOBIERNO REGIONAL DE AYSEN", "EJERCITO DE CHILE", "ARMADA DE CHILE", "JUNJI", "DIRECCION GENERAL DE AERONAUTICA"]
        rubros_data = [
            {"id": "tecnologia", "nombre": "Tecnologia y Software"},
            {"id": "salud", "nombre": "Salud e Insumos Medicos"},
            {"id": "oficina", "nombre": "Articulos de Oficina"},
            {"id": "construccion", "nombre": "Construccion y Ferreteria"},
            {"id": "vehiculos", "nombre": "Vehiculos y Repuestos"},
            {"id": "servicios", "nombre": "Servicios Especializados"}
        ]
        regions_list = [
            "Region de Arica y Parinacota", "Region de Tarapaca", "Region de Antofagasta", "Region de Atacama", "Region de Coquimbo", "Region de Valparaiso", "Region Metropolitana", "Region de OHiggins", "Region del Maule", "Region de Nuble", "Region del Biobio", "Region de La Araucania", "Region de Los Rios", "Region de Los Lagos", "Region de Aysen", "Region de Magallanes"
        ]
        estados = ["Publicada", "Adjudicada", "Desierta", "Cerrada", "Revocada"]
        
        cache = []
        now = datetime.datetime(2026, 6, 10)
        start_date = datetime.datetime(2023, 1, 1)
        total_days = (now - start_date).days
        
        for i in range(3000):
            r = random.choice(rubros_data)
            random_days = random.randint(0, total_days)
            cierre = start_date + datetime.timedelta(days=random_days)
            pub = cierre - datetime.timedelta(days=random.randint(1, 5))
            
            estado = random.choice(estados)
            # Most historical records are Adjudicada
            if cierre < now and random.random() < 0.7:
                estado = "Adjudicada"
            
            presupuesto = random.randint(50000, 7150000)
            precio_adj = presupuesto * random.uniform(0.7, 0.98) if estado == "Adjudicada" else None
            
            cache.append({
                "codigo": f"{random.randint(1000, 9999)}-{random.randint(100, 999)}-COT{str(cierre.year)[-2:]}",
                "nombre": f"ADQUISICION DE {r['nombre'].upper()} REQ-{i}",
                "tipo": "compra_agil",
                "rubro": r["id"],
                "rubro_nombre": r["nombre"],
                "comprador": random.choice(institutions),
                "region": random.choice(regions_list),
                "estado": estado,
                "presupuesto": presupuesto,
                "precio_adjudicado": precio_adj,
                "fecha_publicacion": pub.strftime("%Y-%m-%dT%H:%M:%S"),
                "fecha_cierre": cierre.strftime("%Y-%m-%dT%H:%M:%S"),
            })
        api_search_historical._cache = cache
        
    records = api_search_historical._cache[:]
    
    # 1. Filters
    date_from_str = request.GET.get('date_from', '')
    date_to_str = request.GET.get('date_to', '')
    region = request.GET.get('region', 'all')
    status = request.GET.get('status', 'all')
    
    if date_from_str:
        try:
            start_date = datetime.datetime.strptime(date_from_str, "%Y-%m-%d").date()
            records = [r for r in records if datetime.datetime.strptime(r['fecha_cierre'], "%Y-%m-%dT%H:%M:%S").date() >= start_date]
        except ValueError:
            pass
            
    if date_to_str:
        try:
            end_date = datetime.datetime.strptime(date_to_str, "%Y-%m-%d").date()
            records = [r for r in records if datetime.datetime.strptime(r['fecha_cierre'], "%Y-%m-%dT%H:%M:%S").date() <= end_date]
        except ValueError:
            pass
            
    if region and region != 'all':
        records = [r for r in records if r['region'] == region]
        
    if status and status != 'all':
        # Translate status numbers like Mercado Publico if needed, or string matching
        # Assuming status strings directly for now
        records = [r for r in records if r['estado'].lower() == status.lower() or status == 'all']

    # 2. Sorting
    order_by = request.GET.get('order_by', 'recent')
    if order_by == 'recent':
        records.sort(key=lambda x: x['fecha_cierre'], reverse=True)
    elif order_by == 'oldest':
        records.sort(key=lambda x: x['fecha_cierre'])
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
"""

with io.open('dashboard/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

if "def api_search_historical" not in content:
    with io.open('dashboard/views.py', 'a', encoding='utf-8') as f:
        f.write("\n" + new_view)
    print("Backend view api_search_historical added!")
else:
    print("View already exists!")
