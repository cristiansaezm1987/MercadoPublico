import time
import os
import urllib.parse
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import math

def scrape_mercadopublico_excel(params: dict) -> list:
    """
    params: dictionary of query params e.g. {'region': 'all', 'status': '2', 'llamado': 'all'}
    """
    print("Initializing UC Scraper...")
    options = uc.ChromeOptions()
    
    download_dir = os.path.join(os.getcwd(), 'downloads')
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
        
    options.add_experimental_option('prefs', {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True
    })
    
    # We map our frontend params to Mercado Publico params
    # Frontend: region (string, 'Region del Maule' or '7'?), status ('all', 'activas', 'adjudicadas'), etc.
    # We can just build a basic URL for now or just navigate to the base url.
    # Let's pass the params correctly if possible, or just default to recent.
    # A generic URL that downloads everything recent:
    
    # url = "https://buscador.mercadopublico.cl/compra-agil"
    
    base_url = "https://buscador.mercadopublico.cl/compra-agil"
    
    # Map status
    st_val = ""
    if params.get('status') == 'published': st_val = "3"
    elif params.get('status') == 'adjudicated': st_val = "2"
    elif params.get('status') == 'closed': st_val = "5"
    elif params.get('status') == 'deserted': st_val = "4"
    elif params.get('status') == 'revoked': st_val = "6"
    
    # Map region
    reg_val = params.get('region', '')
    if reg_val == 'all': reg_val = ""
    
    q_params = []
    if st_val: q_params.append(f"status={st_val}")
    if reg_val: q_params.append(f"region={reg_val}")
    
    query_string = "?" + "&".join(q_params) if q_params else ""
    if query_string:
        query_string += "&order_by=recent"
    else:
        query_string = "?order_by=recent"
        
    url = base_url + query_string
    print(f"Scraping URL: {url}")
    
    driver = uc.Chrome(options=options)
    
    try:
        driver.get(url)
        button = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.XPATH, "//*[contains(text(), 'Descargar resultados en excel')]"))
        )
        files_before = set(os.listdir(download_dir))
        button.click()
        
        file_path = None
        for _ in range(30):
            time.sleep(1)
            files_after = set(os.listdir(download_dir))
            new_files = files_after - files_before
            if new_files:
                for fn in new_files:
                    if not fn.endswith('.crdownload') and fn.endswith('.xlsx'):
                        file_path = os.path.join(download_dir, fn)
                        break
                if file_path:
                    break
                    
        if not file_path:
            return []
            
        # Parse Excel
        df = pd.read_excel(file_path)
        
        results = []
        for _, row in df.iterrows():
            d = row.to_dict()
            # Map Excel columns to our JSON structure
            
            # Helper to handle NaN and weird encodings in column names
            def get_val(key, default=""):
                if key in d:
                    val = d[key]
                    if not pd.isna(val): return val
                # Fallback for weird characters (e.g. 'Fecha de Publicacin')
                for k in d.keys():
                    if key[:10] in k:
                        val = d[k]
                        if not pd.isna(val): return val
                return default
                
            estado_original = get_val("Estado")
            
            # Map to our standard statuses
            status = "published"
            if estado_original == "Publicada":
                status = "published"
            elif estado_original == "Adjudicada":
                status = "adjudicated"
            elif estado_original == "Cerrada":
                status = "closed"
            elif estado_original == "Desierta":
                status = "deserted"
            elif estado_original == "Revocada":
                status = "revoked"
                
            def infer_region(organismo, unidad):
                text = (str(organismo) + " " + str(unidad)).upper()
                import unicodedata
                text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('ASCII')
                if 'TARAPACA' in text or 'IQUIQUE' in text: return 'Región de Tarapacá'
                if 'ANTOFAGASTA' in text or 'CALAMA' in text: return 'Región de Antofagasta'
                if 'ATACAMA' in text or 'COPIAPO' in text: return 'Región de Atacama'
                if 'COQUIMBO' in text or 'SERENA' in text: return 'Región de Coquimbo'
                if 'VALPARAISO' in text or 'VINA' in text or 'FRICKE' in text or 'QUILLOTA' in text: return 'Región de Valparaíso'
                if 'HIGGINS' in text or 'RANCAGUA' in text: return 'Región del Libertador General Bernardo O\'Higgins'
                if 'MAULE' in text or 'TALCA' in text or 'CURICO' in text or 'LINARES' in text: return 'Región del Maule'
                if 'BIOBIO' in text or 'BIO BIO' in text or 'CONCEPCION' in text or 'TALCAHUANO' in text or 'VICTOR RIOS' in text: return 'Región del Biobío'
                if 'ARAUCANIA' in text or 'TEMUCO' in text or 'FRONTERA' in text or 'ARAVENA' in text: return 'Región de La Araucanía'
                if 'LOS LAGOS' in text or 'MONTT' in text or 'OSORNO' in text or 'RELONCAVI' in text: return 'Región de Los Lagos'
                if 'AYSEN' in text or 'COYHAIQUE' in text: return 'Región Aysén del General Carlos Ibáñez del Campo'
                if 'MAGALLANES' in text or 'PUNTA ARENAS' in text: return 'Región de Magallanes y de la Antártica Chilena'
                if 'LOS RIOS' in text or 'VALDIVIA' in text: return 'Región de Los Ríos'
                if 'ARICA' in text or 'PARINACOTA' in text: return 'Región de Arica y Parinacota'
                if 'NUBLE' in text or 'CHILLAN' in text: return 'Región de Ñuble'
                return 'Región Metropolitana'
                
            org_name = get_val("Organismo")
            unit_name = get_val("Unidad")
            
            item = {
                "id": get_val("ID"),
                "name": get_val("Nombre"),
                "buyer": {
                    "name": org_name,
                    "unit": unit_name,
                    "region": infer_region(org_name, unit_name)
                },
                "status": status,
                "amount": float(get_val("Monto Disponible", 0)),
                "currency": get_val("Moneda"),
                "dates": {
                    "published": get_val("Fecha de Publicación"),
                    "closing": get_val("Fecha de cierre")
                },
                "llamado": get_val("Estado Convocatoria"),
                # generate generic items based on the title for the intelligent quoter
                "items": [
                    {
                        "description": get_val("Nombre"),
                        "quantity": 1,
                        "unit_measure": "UN"
                    }
                ]
            }
            results.append(item)
            
        # Optional: delete the file after reading
        try:
            os.remove(file_path)
        except:
            pass
            
        return results
        
    except Exception as e:
        print("Scraper Error:", e)
        return []
    finally:
        try:
            driver.quit()
        except:
            pass
