from curl_cffi import requests
import json

base = "https://api.buscador.mercadopublico.cl"
url = f"{base}/compra-agil"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'x-api-key': 'e93089e4-437c-4723-b343-4fa20045e3bc',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}
payload = {
    "date_from": "2026-05-11",
    "date_to": "2026-06-10",
    "order_by": "recent",
    "page_number": 1,
    "region": "all",
    "status": 2
}

try:
    res = requests.post(url, headers=headers, json=payload, impersonate="chrome110")
    print("POST", res.status_code, res.text[:200])
except Exception as e:
    pass

try:
    # Maybe parameters in URL and POST empty body?
    url2 = f"{base}/compra-agil?date_from=2026-05-11&date_to=2026-06-10&order_by=recent&page_number=1&region=all&status=2"
    res2 = requests.post(url2, headers=headers, json={}, impersonate="chrome110")
    print("POST URL Params", res2.status_code, res2.text[:200])
except:
    pass
