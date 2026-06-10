import os

with open('main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Fix the renderQuoteResults UI bug
buggy_str = 'resultsContainer.innerHTML = listHtml + demoHtml;'
fixed_str = 'resultsContainer.innerHTML = tabsHtml + demoHtml + listHtml;'
if buggy_str in text:
    text = text.replace(buggy_str, fixed_str)
    print('Fixed tabsHtml bug')

# 2. Check smart tabs
idx = text.find("window.currentQuoteTab = 'meli';\n            window.renderQuoteResults(itemIndex);")
if idx != -1:
    replacement = """
            // Smart auto-select tab based on query
            const qLower = query.toLowerCase();
            const constWords = ['pino', 'madera', 'cemento', 'zinc', 'fierro', 'dimensionado', 'plancha', 'volcanita', 'osb', 'terciado', 'hormigon', 'ladrillo', 'arena', 'ripio', 'grava', 'acero', 'perfil', 'tubo', 'pvc', 'cobre'];
            if ((constWords.some(w => qLower.includes(w)) || window.quoteSearchResultsCache.meli.length === 0) && window.quoteSearchResultsCache.other.length > 0) {
                window.currentQuoteTab = 'other';
            } else {
                window.currentQuoteTab = 'meli';
            }
            window.renderQuoteResults(itemIndex);"""
    text = text[:idx] + replacement + text[idx + len("window.currentQuoteTab = 'meli';\n            window.renderQuoteResults(itemIndex);"):]
    print('Applied smart tabs')

with open('main.js', 'w', encoding='utf-8') as out:
    out.write(text)
with open('dashboard/static/js/main.js', 'w', encoding='utf-8') as out:
    out.write(text)
