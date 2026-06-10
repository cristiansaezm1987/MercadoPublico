from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")

# find assignment of hn or similar var right before "x-api-key":hn
idx = res.text.find('"x-api-key"')
start = max(0, idx - 500)
end = min(len(res.text), idx + 50)
print(res.text[start:end])

