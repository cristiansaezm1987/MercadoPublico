from curl_cffi import requests
url = "https://api.buscador.mercadopublico.cl/compra-agil/?date_from=2024-01-01&date_to=2024-01-31&order_by=recent&page_number=1&region=all&status=2"
headers = {
    'x-api-key': 'e93089e4-437c-4723-b343-4fa20045e3bc',
    'Accept': 'application/json'
}
res = requests.get(url, headers=headers, impersonate="chrome110")
print("Status:", res.status_code)
