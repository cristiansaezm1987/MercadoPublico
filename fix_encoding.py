import os

files = ['index.html', 'dashboard/templates/dashboard/index.html', 'main.js', 'dashboard/static/js/main.js']

replacements = {
    'ÃƒÂ¡': 'á',
    'ÃƒÂ©': 'é',
    'ÃƒÂ³': 'ó',
    'ÃƒÂº': 'ú',
    'ÃƒÂ­': 'í',
    'Ãƒâ€œ': 'Ó',
    'ÃƒÅ¡': 'Ú',
    'ÃƒÂ±': 'ñ',
    'ÃƒÂ': 'í',
    'Ã‚Â': '',
    'ÃƒÂ ': 'à',
    'Ãƒâ€ ': 'Á',
    'Ãƒâ€°': 'É',
    'ÃƒÂ ': 'Í',
    'Ãƒâ€˜': 'Ñ',
    'Ã¢â‚¬â„¢': "'",
    'Ã¢â‚¬â€œ': "-",
    'Ã¢â‚¬Â ': '"',
    'Ã¢â‚¬Å“': '"',
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã­': 'í',
    'Ã±': 'ñ',
    'Ã“': 'Ó',
    'Ãš': 'Ú',
    'Ã ': 'à',
    'Ã ': 'Á',
    'Ã‰': 'É',
    'Ã ': 'Í',
    'Ã‘': 'Ñ',
    '\ufffd': 'í'
}

for filepath in files:
    if not os.path.exists(filepath):
        continue
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        with open(filepath, 'r', encoding='windows-1252', errors='ignore') as f:
            content = f.read()

    for bad, good in replacements.items():
        content = content.replace(bad, good)
        
    # Manual fixes for broken replacements
    content = content.replace('Detección automíítica de rubros de Compra ígil', 'Detección automática de rubros de Compra Ágil')
    content = content.replace('Búsqueda Inteligente de Compras ígiles', 'Búsqueda Inteligente de Compras Ágiles')
    content = content.replace('Sincronice el histírico, analice', 'Sincronice el histórico, analice')
    content = content.replace('probabilidad de íxito', 'probabilidad de éxito')
    content = content.replace('ítem', 'Ítem')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
