from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")

endpoints = re.findall(r'ln,\"[^\"]+\"', res.text)
print("Endpoints with ln:", endpoints)
