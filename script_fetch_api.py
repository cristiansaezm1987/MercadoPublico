from curl_cffi import requests
import json

url = "https://api.buscador.mercadopublico.cl/compra-agil?date_from=2026-05-11&date_to=2026-06-10&order_by=recent&page_number=1&region=all&status=2"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://buscador.mercadopublico.cl',
    'Referer': 'https://buscador.mercadopublico.cl/compra-agil'
}
try:
    res = requests.get(url, headers=headers, impersonate="chrome110")
    print("Status:", res.status_code)
    print("Headers:", res.headers)
    print(res.text[:1000])
except Exception as e:
    print("Error:", e)

# Test the other one just in case
url2 = "https://servicios-compra-agil.mercadopublico.cl/compra-agil/public/list?date_from=2026-05-11&date_to=2026-06-10&page_number=1&status=2"
try:
    res2 = requests.get(url2, headers=headers, impersonate="chrome110")
    print("Status 2:", res2.status_code)
    print(res2.text[:1000])
except Exception as e:
    pass
