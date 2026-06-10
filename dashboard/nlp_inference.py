import re
import random

def infer_items_from_title(title, total_budget):
    """
    Given a tender title and its total budget, infer plausible items and quantities.
    This simulates an AI reading the title and predicting the breakdown.
    """
    title_lower = title.lower()
    items = []
    
    # Generic logic based on keywords
    if "papel" in title_lower or "resma" in title_lower or "escritorio" in title_lower or "libreria" in title_lower:
        items.append({"producto": "Resma de Papel Tamaño Carta", "cantidad": random.randint(10, 50)})
        items.append({"producto": "Lápiz Pasta Azul", "cantidad": random.randint(50, 200)})
        items.append({"producto": "Archivador Lomo Ancho", "cantidad": random.randint(10, 30)})
        
    elif "computador" in title_lower or "notebook" in title_lower or "tecnología" in title_lower or "informatica" in title_lower:
        items.append({"producto": "Notebook Corporativo i5/8GB/256GB SSD", "cantidad": random.randint(1, 5)})
        if random.random() > 0.5:
            items.append({"producto": "Mouse Inalámbrico", "cantidad": random.randint(1, 10)})
            
    elif "salud" in title_lower or "insumo" in title_lower or "medico" in title_lower or "farmacia" in title_lower or "jeringa" in title_lower:
        items.append({"producto": "Jeringas Desechables 5ml", "cantidad": random.randint(100, 500)})
        items.append({"producto": "Guantes de Látex Talla M", "cantidad": random.randint(20, 100)})
        if random.random() > 0.3:
            items.append({"producto": "Mascarillas Quirúrgicas 3 Pliegues", "cantidad": random.randint(50, 200)})
            
    elif "aseo" in title_lower or "limpieza" in title_lower or "higiene" in title_lower:
        items.append({"producto": "Detergente Líquido 5L", "cantidad": random.randint(5, 20)})
        items.append({"producto": "Cloro Concentrado 5L", "cantidad": random.randint(10, 30)})
        items.append({"producto": "Bolsas de Basura 120L", "cantidad": random.randint(50, 200)})
        
    elif "construccion" in title_lower or "ferreteria" in title_lower or "material" in title_lower or "pintura" in title_lower:
        items.append({"producto": "Tinetas de Pintura Esmalte al Agua", "cantidad": random.randint(2, 10)})
        items.append({"producto": "Cemento Saco 25kg", "cantidad": random.randint(10, 50)})
        items.append({"producto": "Clavos 2 Pulgadas (Caja)", "cantidad": random.randint(1, 5)})
        
    elif "vehiculo" in title_lower or "repuesto" in title_lower or "neumatico" in title_lower or "mantencion" in title_lower:
        items.append({"producto": "Neumáticos Aro 15", "cantidad": random.choice([2, 4, 8])})
        if "mantencion" in title_lower:
            items.append({"producto": "Filtro de Aceite", "cantidad": random.randint(1, 4)})
            items.append({"producto": "Aceite Sintético 5W30 4L", "cantidad": random.randint(1, 4)})

    # Fallback
    if not items:
        # Just use the title as the product description
        # Clean title slightly
        clean_title = re.sub(r'compra agil|adquisicion de|adquisición de|req-\d+', '', title, flags=re.IGNORECASE).strip()
        if not clean_title:
            clean_title = "Insumos/Servicios Varios"
            
        items.append({"producto": clean_title.capitalize(), "cantidad": 1})
        
        # Give a 30% chance to add a generic related item to make it look robust
        if random.random() > 0.7:
            items.append({"producto": "Servicio de Despacho e Instalación", "cantidad": 1})
            
    return items

def infer_rubro(title):
    title_lower = title.lower()
    if any(k in title_lower for k in ["papel", "resma", "escritorio", "libreria", "oficina"]):
        return "Articulos de Oficina", "oficina"
    elif any(k in title_lower for k in ["computador", "notebook", "tecnología", "informatica", "software"]):
        return "Tecnologia y Software", "tecnologia"
    elif any(k in title_lower for k in ["salud", "insumo", "medico", "farmacia", "jeringa"]):
        return "Salud e Insumos Medicos", "salud"
    elif any(k in title_lower for k in ["aseo", "limpieza", "higiene"]):
        return "Aseo e Higiene", "servicios"
    elif any(k in title_lower for k in ["construccion", "ferreteria", "material", "pintura", "madera"]):
        return "Construccion y Ferreteria", "construccion"
    elif any(k in title_lower for k in ["vehiculo", "repuesto", "neumatico", "mantencion", "auto"]):
        return "Vehiculos y Repuestos", "vehiculos"
    elif any(k in title_lower for k in ["capacitacion", "curso", "taller", "charla"]):
        return "Servicios Especializados", "servicios"
    return "Adquisición General", "general"
