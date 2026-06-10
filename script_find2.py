from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")

# Find the context around "x-api-key"
match = re.search(r'.{0,50}\"x-api-key\".{0,50}', res.text, re.IGNORECASE)
if match:
    print("Context around x-api-key:", match.group(0))

# Try looking for a string that looks like a JWT or long alphanumeric hash
tokens = set(re.findall(r'\"[a-zA-Z0-9_-]{30,}\"', res.text))
print("Long tokens:", list(tokens)[:10])

