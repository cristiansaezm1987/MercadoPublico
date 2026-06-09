import requests
from bs4 import BeautifulSoup
import re
import urllib.parse
from datetime import datetime

def parse_delivery_days(shipping_text):
    """
    Parses shipping text like 'Llega gratis mañana', 'Llega hoy', 'Llega el miércoles'
    and estimates the number of delivery days.
    """
    if not shipping_text:
        return None, False
    
    text = shipping_text.lower().strip()
    is_free = "gratis" in text or "free" in text
    
    # Check same day
    if "hoy" in text or "same day" in text:
        return 0, is_free
        
    # Check tomorrow
    if "mañana" in text or "tomorrow" in text:
        return 1, is_free
        
    # Check week day (e.g. "Llega el miércoles", "Llega el lunes")
    weekdays = {
        "lunes": 0, "martes": 1, "miércoles": 2, "miercoles": 2,
        "jueves": 3, "viernes": 4, "sábado": 5, "sabado": 5, "domingo": 6
    }
    
    for day_name, day_idx in weekdays.items():
        if day_name in text:
            today_idx = datetime.now().weekday()
            days_diff = (day_idx - today_idx) % 7
            if days_diff == 0:
                days_diff = 7  # If today is Wednesday and it says "Llega el miércoles", it means next Wednesday
            return days_diff, is_free
            
    # Check number of days (e.g. "Llega en 3 días", "Entrega en 48 horas")
    days_match = re.search(r'en (\d+)\s*días', text)
    if days_match:
        return int(days_match.group(1)), is_free
        
    hours_match = re.search(r'en (\d+)\s*horas', text)
    if hours_match:
        hours = int(hours_match.group(1))
        return max(1, hours // 24), is_free
        
    return None, is_free

def extract_price_from_text(title, snippet):
    """
    Heuristically extracts a CLP price (e.g., $19.990, CLP 45.000) from title or snippet text
    using regular expressions. Returns the price integer or 0 if not found.
    """
    # Regex targets standard Chilean price formats, ignoring "cuotas de ..."
    # Example matches: $49.990, CLP 12.500, $ 9.990
    price_regex = r'(?:\$|clp)\s*?(\d{1,3}(?:\.\d{3})+)(?!\s*?cuotas)'
    
    # Check in title first, then in snippet
    for text in [title, snippet]:
        if not text:
            continue
        matches = re.findall(price_regex, text.lower())
        if matches:
            # Take the first matched price string, remove dots, convert to int
            price_str = re.sub(r"[^\d]", "", matches[0])
            try:
                price = int(price_str)
                if price > 100:  # Ignore trivial numbers
                    return price
            except ValueError:
                continue
    return 0

def scrape_mercado_libre(query):
    """
    Scrapes www.mercadolibre.cl for products matching the query.
    Utilizes a robust Googlebot Crawler impersonation and config/noscript redirect bypass.
    Returns a list of dicts: {title, price, currency, permalink, image, delivery_days, free_shipping, is_full, raw_shipping}
    """
    query_encoded = urllib.parse.quote(query)
    
    # Bypass verification block by routing through the webdevice noscript config redirect
    url = f"https://www.mercadolibre.cl/gz/webdevice/config?go=https%3A%2F%2Flistado.mercadolibre.cl%2F{query_encoded}&noscript=true"
    
    headers = {
        # Googlebot User-Agent bypasses Akamai block pages completely
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CL,es;q=0.9",
        "Connection": "keep-alive"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=12, allow_redirects=True)
        
        # Check if we were redirected to verification page
        if "account-verification" in response.url:
            return {
                "error": "blocked",
                "message": "Mercado Libre solicitó verificación de cuenta (CAPTCHA).",
                "fallback_suggested": True
            }
            
        if response.status_code != 200:
            return {
                "error": "http_error",
                "message": f"Error del servidor de Mercado Libre (Código: {response.status_code})",
                "fallback_suggested": True
            }
            
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Select poly-card product item elements from static HTML
        items = soup.select(".ui-search-layout__item")
        
        if not items:
            # Broader selectors just in case
            items = soup.select(".ui-search-result__wrapper, [class*='ui-search-result__wrapper']")
            
        results = []
        for item in items:
            try:
                # 1. Title & Link
                title_elem = item.select_one("a.poly-component__title")
                if not title_elem:
                    continue
                title = title_elem.text.strip()
                permalink = title_elem["href"]
                
                # Clean up permalink URL
                if "?" in permalink:
                    permalink = permalink.split("?")[0]
                if "#" in permalink:
                    permalink = permalink.split("#")[0]
                    
                # 2. Price
                # Targets current price, avoids installments fractions
                price_elem = item.select_one(".poly-price__current span.andes-money-amount__fraction")
                if price_elem:
                    price_text = re.sub(r"[^\d]", "", price_elem.text)
                    price = int(price_text) if price_text else 0
                else:
                    # Alternative selector
                    price_elem = item.select_one("span.andes-money-amount__fraction")
                    if price_elem:
                        price_text = re.sub(r"[^\d]", "", price_elem.text)
                        price = int(price_text) if price_text else 0
                    else:
                        price = 0
                
                # 3. Image
                img_elem = item.select_one("img.poly-component__picture")
                image_url = ""
                if img_elem:
                    image_url = img_elem.get("data-src") or img_elem.get("src") or ""
                
                # 4. Shipping / Delivery days
                shipping_text = ""
                shipping_elem = item.select_one(".poly-component__shipping-v2, .poly-shipping-v2__item")
                if shipping_elem:
                    shipping_text = shipping_elem.text.strip()
                else:
                    pill_elem = item.select_one(".polylabel-pill")
                    if pill_elem:
                        shipping_text = pill_elem.text.strip()
                
                # Clean shipping text (if it duplicates text e.g. "Envío gratisEnvío gratis")
                if shipping_text:
                    # Remove duplicates if any
                    half_len = len(shipping_text) // 2
                    if half_len > 0 and shipping_text[:half_len] == shipping_text[half_len:]:
                        shipping_text = shipping_text[:half_len]
                
                # 5. FULL badge
                is_full = False
                if "poly_full" in str(item):
                    is_full = True
                
                # Filter out international products
                if "internacional" in title.lower() or "internacional" in shipping_text.lower():
                    continue
                
                # Parse days
                delivery_days, free_shipping = parse_delivery_days(shipping_text)
                
                # If FULL and no delivery days estimated, default to 1 day
                if is_full and delivery_days is None:
                    delivery_days = 1
                
                results.append({
                    "title": title,
                    "price": price,
                    "currency": "CLP",
                    "permalink": permalink,
                    "image": image_url,
                    "delivery_days": delivery_days,
                    "free_shipping": free_shipping,
                    "is_full": is_full,
                    "raw_shipping": shipping_text
                })
            except Exception as e:
                continue
                
        return {
            "results": results,
            "source": "server_scraper",
            "count": len(results)
        }
        
    except Exception as e:
        return {
            "error": "exception",
            "message": str(e),
            "fallback_suggested": True
        }


# ---- Dominios chilenos conocidos que NO usan TLD .cl ----
CHILE_KNOWN_DOMAINS = {
    "falabella.com", "lider.cl", "paris.cl", "ripley.cl",
    "abcdin.cl", "sodimac.cl", "easy.cl", "hites.cl",
    "pcfactory.cl", "spdigital.cl", "weplay.cl", "bip.cl",
    "notebookstore.cl", "winpy.cl", "sidemarket.cl", "bcp.cl",
    "mutant.cl", "entel.cl", "wom.cl", "claro.cl", "movistar.cl",
    "lenovo.cl", "hp.com",  # hp.com/cl/ cuentan como Chile
    "dell.com",  # dell.com/es-cl/
    "samsung.com",  # samsung.com/cl/
    "la-comer.cl", "presto.cl", "cornershop.cl", "jumbo.cl",
    "walmart.cl", "fes.cl", "coolboxchile.cl",
}

# Palabras clave que indican que un resultado es artículo/blog, no tienda
CONTENT_EXCLUSION_KEYWORDS = [
    "/blog", "/noticias", "/articulo", "/guia", "/review",
    "/opinion", "/como-", "wikipedia", "wiki", "foro",
    "/top-", "/mejores-", "/ranking", "/comparativa",
    "uss.cl", "uchile.cl", "puc.cl",  # universidades
]


def _is_chilean_url(url: str) -> bool:
    """Returns True if the URL belongs to a Chilean site (.cl TLD or known Chilean retailer)."""
    try:
        parsed = urllib.parse.urlparse(url)
        host = parsed.netloc.lower()
        if host.startswith("www."):
            host = host[4:]

        # Exact .cl TLD check
        if host.endswith(".cl"):
            return True

        # Check known Chilean retailer domains
        for known in CHILE_KNOWN_DOMAINS:
            if host == known or host.endswith("." + known):
                return True

        # Check if the path contains a Chilean country code segment
        path = parsed.path.lower()
        if "/cl/" in path or path.startswith("/cl/") or "/es-cl" in path:
            return True

    except Exception:
        pass
    return False


def _is_store_url(url: str) -> bool:
    """Returns True only if the URL looks like a product/store page, not a blog/article."""
    url_lower = url.lower()
    for kw in CONTENT_EXCLUSION_KEYWORDS:
        if kw in url_lower:
            return False
    return True


def scrape_duckduckgo_results(query):
    """
    Searches DuckDuckGo via the ddgs library for Chilean stores selling the product,
    excluding Mercado Libre.

    Strategy:
      1. Primary search: `{query} comprar site:.cl -mercadolibre.cl` (forces .cl TLD)
      2. Fallback search: `{query} comprar chile tienda` filtered post-hoc to Chilean domains.
    Returns up to 10 deduplicated, Chilean-only results.
    """
    try:
        from ddgs import DDGS
    except ImportError:
        return []

    seen_domains = set()
    parsed_results = []

    def _process_raw(raw_list):
        """Parse and filter a list of raw ddgs results, appending to parsed_results."""
        for res in (raw_list or []):
            if len(parsed_results) >= 10:
                break
            try:
                title = res.get("title", "").strip()
                link = res.get("href", "").strip()
                snippet = res.get("body", "").strip()

                if not title or not link:
                    continue

                # --- Chilean domain filter ---
                if not _is_chilean_url(link):
                    continue

                # --- Content type filter (exclude blogs/articles) ---
                if not _is_store_url(link):
                    continue

                # --- Skip MercadoLibre/MercadoPago ---
                link_lower = link.lower()
                if "mercadolibre" in link_lower or "mercadopago" in link_lower:
                    continue

                # --- Deduplicate by domain ---
                try:
                    parsed_href = urllib.parse.urlparse(link)
                    domain = parsed_href.netloc.lower()
                    if domain.startswith("www."):
                        domain = domain[4:]
                except Exception:
                    domain = link[:40]

                if domain in seen_domains:
                    continue
                seen_domains.add(domain)

                # Price extraction heuristic
                estimated_price = extract_price_from_text(title, snippet)

                parsed_results.append({
                    "title": title,
                    "permalink": link,
                    "snippet": snippet,
                    "display_url": domain,
                    "price": estimated_price,
                    "currency": "CLP",
                    "source": "other_site",
                    "delivery_days": None,
                    "free_shipping": False,
                    "is_full": False,
                })
            except Exception:
                continue

    # ---- PASS 1: Enforce Chilean TLD (.cl) directly in the query ----
    query_cl = f"{query} comprar site:.cl -mercadolibre.cl -mercadopago.cl"
    try:
        with DDGS() as ddgs:
            raw1 = ddgs.text(query_cl, region="cl-es", safesearch="off", max_results=15)
        _process_raw(raw1)
    except Exception:
        pass

    # ---- PASS 2: Broader Chile search, filter post-hoc (covers falabella.com, etc.) ----
    if len(parsed_results) < 10:
        query_broad = f"{query} comprar precio chile tienda -site:mercadolibre.cl"
        try:
            with DDGS() as ddgs:
                raw2 = ddgs.text(query_broad, region="cl-es", safesearch="off", max_results=20)
            _process_raw(raw2)
        except Exception:
            pass

    return parsed_results


def get_best_price(query, cantidad=1):
    """
    MeliPulse Chile — Motor de Cotización Inteligente.
    Busca el mejor precio disponible para un ítem en MercadoLibre Chile.

    Estrategia de selección:
      1. Filtra productos con precio > 0
      2. Prefiere productos con envío gratis (free_shipping=True)
      3. Selecciona el de menor precio dentro del grupo preferido
      4. Si no hay resultados de Meli, intenta otras tiendas chilenas (DDG)

    Returns:
        dict con keys: producto, cantidad, best_price, unit_price, permalink,
                       image, source, delivery_days, free_shipping, is_full,
                       total_cost, error (bool), error_message
    """
    base_result = {
        "producto": query,
        "cantidad": cantidad,
        "best_price": 0,
        "unit_price": 0,
        "permalink": "",
        "image": "",
        "source": "fallback_estatico",
        "delivery_days": None,
        "free_shipping": False,
        "is_full": False,
        "total_cost": 0,
        "error": False,
        "error_message": ""
    }

    try:
        meli_data = scrape_mercado_libre(query)

        # Check for blocking error
        if isinstance(meli_data, dict) and "error" in meli_data:
            # Try DuckDuckGo fallback
            ddg_results = scrape_duckduckgo_results(query)
            priced_ddg = [r for r in ddg_results if r.get("price", 0) > 0]
            if priced_ddg:
                best = min(priced_ddg, key=lambda x: x["price"])
                unit_price = best["price"]
                base_result.update({
                    "best_price": unit_price,
                    "unit_price": unit_price,
                    "permalink": best.get("permalink", ""),
                    "image": "",
                    "source": best.get("display_url", "tienda_chile"),
                    "delivery_days": None,
                    "free_shipping": False,
                    "total_cost": unit_price * cantidad,
                    "error": False
                })
            else:
                base_result.update({
                    "error": True,
                    "error_message": meli_data.get("message", "Sin resultados disponibles")
                })
            return base_result

        products = meli_data.get("results", [])
        if not products:
            base_result.update({
                "error": True,
                "error_message": f"No se encontraron resultados para: {query}"
            })
            return base_result

        # Filter products with valid prices
        priced = [p for p in products if p.get("price", 0) > 100]
        if not priced:
            base_result.update({
                "error": True,
                "error_message": "No se pudieron extraer precios válidos"
            })
            return base_result

        # Prefer free shipping products
        free_ship = [p for p in priced if p.get("free_shipping", False)]
        pool = free_ship if free_ship else priced

        # Pick the lowest price from the preferred pool
        best = min(pool, key=lambda x: x["price"])
        unit_price = best["price"]

        base_result.update({
            "best_price": unit_price,
            "unit_price": unit_price,
            "permalink": best.get("permalink", ""),
            "image": best.get("image", ""),
            "source": "MercadoLibre Chile",
            "delivery_days": best.get("delivery_days"),
            "free_shipping": best.get("free_shipping", False),
            "is_full": best.get("is_full", False),
            "total_cost": unit_price * cantidad,
            "error": False,
            "error_message": ""
        })

    except Exception as e:
        base_result.update({
            "error": True,
            "error_message": str(e)
        })

    return base_result
