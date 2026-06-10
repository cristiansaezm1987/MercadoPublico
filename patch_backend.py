# -*- coding: utf-8 -*-
import os

with open("dashboard/views.py", "r", encoding="utf-8") as f:
    text = f.read()

if "import requests" not in text:
    text = "import requests\n" + text

if "api_tenders" not in text:
    new_view = """
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
"""
    text = text + "\n" + new_view

with open("dashboard/views.py", "w", encoding="utf-8") as f:
    f.write(text)

with open("dashboard/urls.py", "r", encoding="utf-8") as f:
    urls_text = f.read()

if "api_tenders" not in urls_text:
    urls_text = urls_text.replace(
        "path(\"api/quote-items/\", views.api_quote_items, name=\"api_quote_items\"),",
        "path(\"api/quote-items/\", views.api_quote_items, name=\"api_quote_items\"),\n    path(\"api/tenders/\", views.api_tenders, name=\"api_tenders\"),"
    )
    with open("dashboard/urls.py", "w", encoding="utf-8") as f:
        f.write(urls_text)

print("Backend endpoints updated!")
