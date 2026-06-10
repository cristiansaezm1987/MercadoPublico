from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")

# find all strings that look like paths starting with slash
paths = set(re.findall(r'\"(/[a-z-]+/[a-z-]+)\"', res.text))
print("Paths:", paths)

# Let's search around api.buscador
idx = res.text.find('api.buscador')
print("Context around api.buscador:", res.text[max(0, idx-100):min(len(res.text), idx+300)])

