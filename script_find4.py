from curl_cffi import requests
import re
url = "https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js"
res = requests.get(url, impersonate="chrome110")

match = re.search(r'hn\s*=\s*\"([^\"]+)\"', res.text)
if match:
    print("API Key found:", match.group(1))
else:
    match2 = re.search(r'var [a-zA-Z0-9_]+,.*hn=\"([^\"]+)\"', res.text)
    if match2:
        print("API Key found (2):", match2.group(1))
    else:
        # Just dump all assignments to hn
        all_matches = re.findall(r'.{0,30}hn.{0,30}', res.text)
        print("All mentions of hn:", all_matches[:10])

