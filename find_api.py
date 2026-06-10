import requests
import re
url = 'https://buscador.mercadopublico.cl/static/js/main.1f0f35d8.js'
headers = {
    'User-Agent': 'Mozilla/5.0'
}
res = requests.get(url, headers=headers)
urls = set(re.findall(r'"/api/[\w/-]+"', res.text) + re.findall(r'"/api/v\d/[\w/-]+"', res.text))
print('Relative URLs:', urls)

domains = set(re.findall(r'"https://[\w.-]*mercadopublico[\w.-]*"', res.text))
print('Domains:', domains)

agil = set(re.findall(r'.{0,50}compra-agil.{0,50}', res.text))
for a in agil:
    if 'api' in a or 'http' in a:
        print('Agil match:', a)
