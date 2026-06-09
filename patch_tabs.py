import os

files = ['main.js', 'dashboard/static/js/main.js']

target = """            window.quoteSearchResultsCache = { 
                meli: (data.meli_results || []).map(r => ({...r, source: 'MercadoLibre Chile'})), 
                other: (data.other_results || []).map(r => ({...r, source: 'Resultados Web'})) 
            };
            window.currentQuoteTab = 'meli';"""
            
replacement = """            window.quoteSearchResultsCache = { 
                meli: (data.meli_results || []).map(r => ({...r, source: 'MercadoLibre Chile'})), 
                other: (data.other_results || []).map(r => ({...r, source: 'Resultados Web'})) 
            };
            
            // Smart auto-select tab based on query (Mercado Libre is bad for construction materials)
            const qLower = query.toLowerCase();
            const constWords = ['pino', 'madera', 'cemento', 'zinc', 'fierro', 'dimensionado', 'plancha', 'volcanita', 'osb', 'terciado', 'hormigon', 'ladrillo', 'arena', 'ripio', 'grava', 'acero', 'perfil', 'tubo', 'pvc', 'cobre'];
            if ((constWords.some(w => qLower.includes(w)) || window.quoteSearchResultsCache.meli.length === 0) && window.quoteSearchResultsCache.other.length > 0) {
                window.currentQuoteTab = 'other';
            } else {
                window.currentQuoteTab = 'meli';
            }"""

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    if target in text:
        text = text.replace(target, replacement)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'Successfully applied smart tab auto-select in {filepath}!')
    else:
        print(f'Target not found in {filepath}. Please check exact string match.')

# Bump version to v28
for html_file in ['index.html', 'dashboard/templates/dashboard/index.html']:
    with open(html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    html_content = html_content.replace('main.js?v=27', 'main.js?v=28')
    html_content = html_content.replace('style.css?v=27', 'style.css?v=28')
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
