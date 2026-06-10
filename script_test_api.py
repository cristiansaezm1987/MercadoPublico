from curl_cffi import requests
import json

url = "https://api.buscador.mercadopublico.cl/compra-agil?date_from=2026-05-11&date_to=2026-06-10&order_by=recent&page_number=1&region=all&status=2"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'x-api-key': 'e93089e4-437c-4723-b343-4fa20045e3bc',
    'Accept': 'application/json'
}
res = requests.get(url, headers=headers, impersonate="chrome110")
print("Status:", res.status_code)
print("Response:", res.text[:500])

url2 = "https://ywri2h0ar5.execute-api.us-east-1.amazonaws.com/prod/compra-agil"
res2 = requests.get(url2, headers=headers, impersonate="chrome110")
print("Status 2:", res2.status_code)

