# -*- coding: utf-8 -*-
import io

new_view = """@csrf_exempt
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
"""

with io.open('dashboard/views.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

out = []
for i, line in enumerate(lines):
    if '@csrf_exempt' in line and i > 200:
        break
    out.append(line)

out.append(new_view)

with io.open('dashboard/views.py', 'w', encoding='utf-8') as f:
    f.writelines(out)

print("Backend view updated with filters and bulk data!")
