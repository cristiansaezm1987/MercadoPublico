from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")

# find the assignment of ln
match = re.search(r'ln\s*=\s*\"([^\"]+)\"', res.text)
if match:
    print("ln found:", match.group(1))

# find any URL starting with "https://api"
print(re.findall(r'\"(https://api[^"]+)\"', res.text))

