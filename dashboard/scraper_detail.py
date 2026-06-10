import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import json
import sys

def get_cot_detail(cot_id):
    options = uc.ChromeOptions()
    options.add_argument('--window-size=1280,720')
    options.add_argument('--window-position=-32000,-32000') # Hide off screen
    driver = uc.Chrome(options=options)
    
    try:
        # Load the detail page
        driver.get(f'https://buscador.mercadopublico.cl/compra-agil/{cot_id}')
        
        # Wait for the table to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//table[contains(@class, 'table')]"))
        )
        
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        
        products = []
        tables = soup.find_all('table')
        
        for table in tables:
            headers = [th.text.strip().lower() for th in table.find_all('th')]
            if 'cantidad' in headers or 'producto' in headers or 'producto o servicio' in headers:
                rows = table.find('tbody').find_all('tr') if table.find('tbody') else table.find_all('tr')[1:]
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) >= 3:
                        prod = {
                            "codigo": cols[0].text.strip(),
                            "producto": cols[1].text.strip(),
                            "cantidad": cols[2].text.strip()
                        }
                        if len(cols) >= 4:
                            prod["precio_unitario"] = cols[3].text.strip()
                        products.append(prod)
                break
                
        # Also grab any extra description if available
        desc_elem = soup.find(lambda tag: tag.name in ['p', 'div'] and 'Descripción' in tag.text)
        desc = desc_elem.text.strip() if desc_elem else ""

        print(json.dumps({"success": True, "id": cot_id, "products": products, "description": desc}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        driver.quit()

if __name__ == '__main__':
    cot_id = sys.argv[1] if len(sys.argv) > 1 else '2358-236-COT26'
    get_cot_detail(cot_id)
