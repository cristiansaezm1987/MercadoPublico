from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")
print("Status:", res.status_code)
urls = re.findall(r'"https://[\w.-]+(?:/[\w.-]+)*"', res.text)
apis = set([u for u in urls if 'api' in u or 'mercadopublico' in u])
print("URLs found:", apis)

# Search for api domains config
config = re.findall(r'\w+\.env\.REACT_APP[\w_]*\s*=\s*\"[^\"]+\"', res.text)
print("ENV Vars:", config)
