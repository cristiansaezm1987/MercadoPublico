from curl_cffi import requests
import json

base = "https://api.buscador.mercadopublico.cl"
paths = [
    "/compra-agil",
    "/compra-agil/list",
    "/compra-agil/search",
    "/search/compra-agil"
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'x-api-key': 'e93089e4-437c-4723-b343-4fa20045e3bc',
    'Accept': 'application/json',
    'Origin': 'https://buscador.mercadopublico.cl',
    'Referer': 'https://buscador.mercadopublico.cl/'
}

for p in paths:
    url = f"{base}{p}?date_from=2026-05-11&date_to=2026-06-10&order_by=recent&page_number=1&region=all&status=2"
    res = requests.get(url, headers=headers, impersonate="chrome110")
    print(p, res.status_code, res.text[:100])

