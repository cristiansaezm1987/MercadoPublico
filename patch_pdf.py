# -*- coding: utf-8 -*-
with open('main.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# 1. Update exportToPDF
start_pdf = text.find('window.exportToPDF = function() {')
end_pdf = text.find('};', start_pdf) + 2
pdf_func = text[start_pdf:end_pdf]

new_pdf_func = pdf_func.replace('window.exportToPDF = function() {', 'window.exportToPDF = function(customCot = null, customMatchData = null) {')
new_pdf_func = new_pdf_func.replace('if (!window.lastMatchData || !window.activeCotCode) return;', 'const matchData = customMatchData || window.lastMatchData;\n        if (!matchData) return;')
new_pdf_func = new_pdf_func.replace('const cot = window.DATA_FIXTURES.LICITACIONES_ACTIVAS.find(x => x.codigo === window.activeCotCode);', 'const cot = customCot || window.DATA_FIXTURES.LICITACIONES_ACTIVAS.find(x => x.codigo === (customCot ? customCot.codigo : window.activeCotCode));\n        if (!cot) return;')
new_pdf_func = new_pdf_func.replace('window.lastMatchData', 'matchData')

text = text.replace(pdf_func, new_pdf_func)

# 2. Update saveBid to save the objects
save_find = "estado: 'Guardada'"
save_replace = "estado: 'Guardada',\n            matchData: window.lastMatchData,\n            cotObj: cot"
text = text.replace(save_find, save_replace)

# 3. Add PDF button in renderBidsTable
row_find = 'onclick="window.deleteBid(\'${b.codigo}\')">Eliminar</button>'
row_replace = 'onclick="window.downloadSavedPDF(\'${b.codigo}\')" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: none; padding: 4px 8px; font-size: 0.75rem; margin-right: 4px; cursor: pointer;">PDF</button>\n                    <button class="btn" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: none; padding: 4px 8px; font-size: 0.75rem; cursor: pointer;" onclick="window.deleteBid(\'${b.codigo}\')">Eliminar</button>'
text = text.replace(row_find, row_replace)

# 4. Add window.downloadSavedPDF function
download_func = """
    window.downloadSavedPDF = function(codigo) {
        let bids = [];
        try { bids = JSON.parse(localStorage.getItem('my_bids')) || []; } catch(e){}
        const b = bids.find(x => x.codigo === codigo);
        if (!b) return;
        if (!b.cotObj || !b.matchData) {
            alert('Este registro antiguo no tiene el formato para generar PDF.');
            return;
        }
        window.exportToPDF(b.cotObj, b.matchData);
    };
"""

text = text.replace('window.deleteBid = function(codigo) {', download_func + '\n    window.deleteBid = function(codigo) {')

# Bump cache to v107
text = text.replace('v=106', 'v=107')

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(text)
with open('dashboard/static/js/main.js', 'w', encoding='utf-8') as f:
    f.write(text)

# Bump HTML
for html_file in ['index.html', 'dashboard/templates/dashboard/index.html']:
    with open(html_file, 'r', encoding='utf-8') as f:
        html = f.read()
    html = html.replace('v=106', 'v=107')
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html)
        
print('Updated PDF functionality!')
