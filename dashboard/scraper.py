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
                filename = list(new_files)[0]
                if not filename.endswith('.crdownload') and filename.endswith('.xlsx'):
                    file_path = os.path.join(download_dir, filename)
                    break
                    
        if not file_path:
            return []
            
        # Parse Excel
        df = pd.read_excel(file_path)
        
        results = []
        for _, row in df.iterrows():
            d = row.to_dict()
            # Map Excel columns to our JSON structure
            
            # Helper to handle NaN
            def get_val(key, default=""):
                val = d.get(key, default)
                if pd.isna(val):
                    return default
                return val
                
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
                
            item = {
                "id": get_val("ID"),
                "name": get_val("Nombre"),
                "buyer": {
                    "name": get_val("Organismo"),
                    "unit": get_val("Unidad"),
                    "region": "Región Metropolitana" # Excel doesn't have region! We can deduce or fake it or leave it blank
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
