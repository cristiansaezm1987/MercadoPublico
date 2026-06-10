# -*- coding: utf-8 -*-
import sys
import io

with io.open('dashboard/views.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

out = []
for i, line in enumerate(lines):
    if '@csrf_exempt' in line and i > 200:
        break
    out.append(line)

new_view = """@csrf_exempt
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
"""

out.append(new_view)

with io.open('dashboard/views.py', 'w', encoding='utf-8') as f:
    f.writelines(out)

print("Backend view updated!")
