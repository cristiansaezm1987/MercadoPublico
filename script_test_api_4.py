from curl_cffi import requests
import datetime

url = "https://api.buscador.mercadopublico.cl/compra-agil?date_from=2023-05-11&date_to=2024-05-11&order_by=recent&page_number=1&region=all&status=2"
headers = {
    'x-api-key': 'e93089e4-437c-4723-b343-4fa20045e3bc',
    'Accept': 'application/json'
}
res = requests.get(url, headers=headers, impersonate="chrome110")
print("Status 2023-2024:", res.status_code)
if res.status_code == 200:
    print(res.text[:300])

url2 = "https://api.buscador.mercadopublico.cl/compra-agil?date_from=2024-01-01&date_to=2024-01-31&order_by=recent&page_number=1&region=all&status=2"
res2 = requests.get(url2, headers=headers, impersonate="chrome110")
print("Status 2024 Jan:", res2.status_code)

url3 = "https://api.buscador.mercadopublico.cl/compra-agil?date_from=2026-01-01&date_to=2026-06-10&order_by=recent&page_number=1&region=all&status=2"
res3 = requests.get(url3, headers=headers, impersonate="chrome110")
print("Status 2026:", res3.status_code)

