# -*- coding: utf-8 -*-
# dashboard/intelligence.py
import math
from .data_fixtures import RUBROS, COMPRADORES, COMPETIDORES, PROVEEDORES_LOCALES, HISTORIAL_LICITACIONES, LICITACIONES_ACTIVAS

def get_rubro_by_id(rubro_id):
    for r in RUBROS:
        if r["id"] == rubro_id:
            return r
    return RUBROS[0]

def get_comprador_by_name(name):
    for c in COMPRADORES:
        if c["nombre"] == name:
            return c
    return None

def calculate_optimal_bid(cost, rubro_id, region, comprador_name=None):
    rubro = get_rubro_by_id(rubro_id)
    comprador = get_comprador_by_name(comprador_name)
    base_prob = rubro["probabilidad_base"]
    avg_competitors = rubro["n_competidores_promedio"]
    regional_bonus = 0.0
    buyer_multiplier = 1.0
    if comprador:
        perfil = comprador["perfil_adjudicacion"]
        if perfil == "Preferencia Local / Regional" and comprador.get("region", "") == region:
            regional_bonus = 0.12
        if perfil == "Sensible al Precio":
            buyer_multiplier = 1.2
        elif perfil == "Orientado a Calidad / Tecnica":
            buyer_multiplier = 0.7
    pricing_points = []
    best_expected_profit = -1.0
    suggested_price = cost * 1.10
    suggested_prob = 0.0
    suggested_margin = 0.0
    for i in range(1, 41):
        multiplier = 1.0 + (i * 0.01)
        price = cost * multiplier
        margin_pct = (price - cost) / price
        target_margin = rubro["margen_promedio"]
        price_diff = margin_pct - target_margin
        k = 12.0 * buyer_multiplier
        prob = (base_prob * 1.15) / (1.0 + math.exp(k * price_diff))
        prob += regional_bonus
        prob = max(0.05, min(0.95, prob))
        profit = (price - cost)
        expected_profit = profit * prob
        pricing_points.append({
            "multiplier": round(multiplier, 2),
            "price": round(price, 0),
            "margin_pct": round(margin_pct * 100, 1),
            "probability": round(prob * 100, 1),
            "expected_profit": round(expected_profit, 0)
        })
        if expected_profit > best_expected_profit:
            best_expected_profit = expected_profit
            suggested_price = price
            suggested_prob = prob
            suggested_margin = margin_pct
    relevant_competitors = [c for c in COMPETIDORES if rubro_id in c["rubros"]]
    return {
        "cost": cost,
        "suggested_price": round(suggested_price, 0),
        "suggested_prob": round(suggested_prob * 100, 1),
        "suggested_margin": round(suggested_margin * 100, 1),
        "suggested_multiplier": round(suggested_price / cost, 2),
        "pricing_points": pricing_points,
        "competitors": relevant_competitors,
        "regional_bonus_applied": regional_bonus > 0
    }

def find_suppliers_and_costs(rubro_id, region, target_cost):
    matches = []
    for s in PROVEEDORES_LOCALES:
        if rubro_id in s["rubros"] and s["region"] == region:
            estimated_cost = target_cost * (1 - s["descuento"])
            savings = target_cost - estimated_cost
            score = (s["confiabilidad"] * 0.6) + (s["descuento"] * 2.0)
            matches.append({
                "nombre": s["nombre"], "region": s["region"],
                "descuento_pct": round(s["descuento"] * 100, 1),
                "confiabilidad_pct": round(s["confiabilidad"] * 100, 1),
                "telefono": s["telefono"], "email": s["email"],
                "costo_estimado": round(estimated_cost, 0),
                "ahorro_estimado": round(savings, 0),
                "score": round(score * 10, 1)
            })
    matches.sort(key=lambda x: x["descuento_pct"], reverse=True)
    return matches

def detect_highest_potential_rubros(user_region="Region Metropolitana"):
    analysis = []
    for r in RUBROS:
        rubro_id = r["id"]
        comp_pressure = r["n_competidores_promedio"] / 25.0
        vol_weight = r["volumen_mercado_clp"] / 500000000000.0
        margin_weight = r["margen_promedio"] / 0.30
        suppliers_count = len([s for s in PROVEEDORES_LOCALES if rubro_id in s["rubros"] and s["region"] == user_region])
        supplier_bonus = min(0.2, suppliers_count * 0.05)
        score = (r["tasa_adjudicacion_promedio"] * 0.4) + (vol_weight * 0.2) + (margin_weight * 0.2) - (comp_pressure * 0.2) + supplier_bonus
        score_percentage = max(10.0, min(99.0, (score + 0.3) * 100))
        if score_percentage >= 70:
            status = "Excelente Oportunidad (Alta Prioridad)"
        elif score_percentage >= 50:
            status = "Oportunidad Moderada"
        else:
            status = "Alta Competencia / Margenes Bajos"
        analysis.append({
            "id": r["id"], "nombre": r["nombre"], "codigo_onu": r["codigo_onu"],
            "volumen_clp": r["volumen_mercado_clp"], "competidores": r["n_competidores_promedio"],
            "tasa_adjudicacion": round(r["tasa_adjudicacion_promedio"] * 100, 1),
            "margen": round(r["margen_promedio"] * 100, 1),
            "score": round(score_percentage, 1), "estatus": status,
            "dificultad": r["dificultad"], "proveedores_disponibles": suppliers_count
        })
    analysis.sort(key=lambda x: x["score"], reverse=True)
    return analysis

def recommend_tenders(budget, rubro_id=None, region=None):
    """
    Given a budget, returns ranked licitaciones/compras agiles matching the budget range.
    Calculates win probability and suggested offer price for each.
    """
    results = []
    # budget tolerance: show tenders where presupuesto is between 50% and 200% of user budget
    budget_min = budget * 0.40
    budget_max = budget * 2.20

    for licit in LICITACIONES_ACTIVAS:
        presupuesto = licit["presupuesto"]
        if not (budget_min <= presupuesto <= budget_max):
            continue
        if rubro_id and rubro_id != "" and licit["rubro"] != rubro_id:
            continue
        if region and region != "" and licit["region"] != region:
            continue

        rubro = get_rubro_by_id(licit["rubro"])
        base_prob = rubro["probabilidad_base"]

        # Fewer expected bidders = higher probability
        n_oferentes = licit.get("n_oferentes_esperados", 8)
        competition_factor = max(0.5, 1.0 - (n_oferentes / 30.0))

        # Budget alignment: if user budget is close to presupuesto, higher chance
        budget_ratio = budget / presupuesto
        if 0.65 <= budget_ratio <= 1.0:
            budget_factor = 1.15  # cost is competitive
        elif 0.50 <= budget_ratio < 0.65:
            budget_factor = 1.05  # under-competitive but viable
        else:
            budget_factor = 0.85  # either too high or too low

        # Regional bonus
        regional_bonus = 0.0
        if region and licit["region"] == region:
            comprador = get_comprador_by_name(licit["comprador"])
            if comprador and comprador.get("perfil_adjudicacion") == "Preferencia Local / Regional":
                regional_bonus = 0.10

        win_prob = base_prob * competition_factor * budget_factor + regional_bonus
        win_prob = max(0.05, min(0.92, win_prob))

        # Suggested offer: multiply cost by rubro's typical winning multiplier
        typical_margin = rubro["margen_promedio"]
        suggested_multiplier = 1.0 + typical_margin
        suggested_offer = round(budget * suggested_multiplier, 0)

        # Cap offer at presupuesto
        if suggested_offer > presupuesto:
            suggested_offer = round(presupuesto * 0.94, 0)

        results.append({
            "codigo": licit["codigo"],
            "nombre": licit["nombre"],
            "tipo": licit["tipo"],
            "rubro": licit["rubro"],
            "rubro_nombre": licit["rubro_nombre"],
            "comprador": licit["comprador"],
            "region": licit["region"],
            "ciudad": licit["ciudad"],
            "presupuesto": presupuesto,
            "fecha_publicacion": licit["fecha_publicacion"],
            "fecha_cierre": licit["fecha_cierre"],
            "fecha_estimada_adjudicacion": licit.get("fecha_estimada_adjudicacion", ""),
            "n_oferentes_esperados": n_oferentes,
            "win_probability": round(win_prob * 100, 1),
            "suggested_offer": suggested_offer,
            "estimated_margin_pct": round(((suggested_offer - budget) / suggested_offer) * 100, 1) if suggested_offer > 0 else 0,
            "items": licit.get("items", [])
        })

    # Sort by win probability descending
    results.sort(key=lambda x: x["win_probability"], reverse=True)
    return results[:12]  # return top 12
