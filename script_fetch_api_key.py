from curl_cffi import requests

url = "https://api.buscador.mercadopublico.cl/compra-agil?date_from=2026-05-11&date_to=2026-06-10&order_by=recent&page_number=1&region=all&status=2"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'x-api-key': '41186b85826e80d1a0d445a6ce67d1a3'
}
try:
    res = requests.get(url, headers=headers, impersonate="chrome110")
    print("Status:", res.status_code)
    print("Response:", res.text[:500])
except Exception as e:
    print("Error:", e)
