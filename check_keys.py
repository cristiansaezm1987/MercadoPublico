from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")

keys = set(re.findall(r'"x-api-key"\s*:\s*"([^"]+)"', res.text, re.IGNORECASE))
print("x-api-keys:", keys)

headers = set(re.findall(r'"([xX]-[\w-]+)"', res.text))
print("Custom headers:", headers)

auth = set(re.findall(r'"Authorization"\s*:\s*"([^"]+)"', res.text, re.IGNORECASE))
print("Authorization:", auth)

urls = set(re.findall(r'"https://[^"]+"', res.text))
api_urls = [u for u in urls if 'api' in u or 'mercadopublico' in u]
print("All API URLs:", api_urls)
