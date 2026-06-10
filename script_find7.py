from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")

# Let's search for "POST" or "GET" in the context of api.buscador or /compra-agil
# Or search for "compra-agil" in the string to see if it's a template string
matches = re.findall(r'.{0,50}\"/compra-agil\".{0,50}', res.text)
for m in matches:
    print("Match:", m)
