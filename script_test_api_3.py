from curl_cffi import requests

url = "https://api.buscador.mercadopublico.cl/compra-agil?date_from=2026-05-11&date_to=2026-06-10&order_by=recent&page_number=1&region=all&status=2"
headers = {
    'authority': 'api.buscador.mercadopublico.cl',
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'es-CL,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'origin': 'https://buscador.mercadopublico.cl',
    'referer': 'https://buscador.mercadopublico.cl/compra-agil',
    'sec-ch-ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'x-api-key': 'e93089e4-437c-4723-b343-4fa20045e3bc'
}
res = requests.get(url, headers=headers, impersonate="chrome110")
print("Status:", res.status_code)
print("Response:", res.text[:500])

