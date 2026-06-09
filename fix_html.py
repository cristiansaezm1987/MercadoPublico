import os

files = ['index.html', 'dashboard/templates/dashboard/index.html']

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Add html2pdf.js
    if 'html2pdf.bundle.min.js' not in content:
        content = content.replace('<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>', '<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>')
    
    # 2. Add sidebar tab
    sidebar_tab = '''      <li class="nav-item" data-tab="tab-mis-licitaciones">
        <a href="#">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Mis Licitaciones
        </a>
      </li>'''
    if 'data-tab="tab-mis-licitaciones"' not in content:
        content = content.replace('      <li class="nav-item" data-tab="tab-simulator">', sidebar_tab + '\n      <li class="nav-item" data-tab="tab-simulator">')

    # 3. Add view container
    view_container = '''    <div id="tab-mis-licitaciones" class="tab-content">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.5rem; color: var(--text-light);">Repositorio de Participaciones</h2>
      </div>
      <div class="card">
          <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                  <tr style="border-bottom: 1px solid rgba(148,163,184,0.2);">
                      <th style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted);">CÓDIGO LICI.</th>
                      <th style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted);">ORGANISMO / COMPRADOR</th>
                      <th style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted);">FECHA PARTICIPACIÓN</th>
                      <th style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted);">TOTAL COTIZADO</th>
                      <th style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted); text-align: center;">ESTADO</th>
                      <th style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted); text-align: right;">ACCIONES</th>
                  </tr>
              </thead>
              <tbody id="my-bids-table-body">
                  <tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">No tienes licitaciones guardadas aún.</td></tr>
              </tbody>
          </table>
      </div>
    </div>'''
    if 'id="tab-mis-licitaciones"' not in content:
        content = content.replace('    <!-- Simulator View -->\n    <div id="tab-simulator" class="tab-content">', view_container + '\n\n    <!-- Simulator View -->\n    <div id="tab-simulator" class="tab-content">')

    # 4. Change Modal Title properly
    content = content.replace('<h3 id="quote-modal-title" style="margin:0; font-size:1.1rem; color:var(--text-light);">Buscando Alternativas en MeliPulse</h3>', '<h3 id="quote-modal-title" style="margin:0; font-size:1.1rem; color:var(--text-light);">Cotizador Inteligente</h3>')
    content = content.replace('Busqueda Rapida con', 'Cotizador')

    # 5. Add PDF Container at the bottom
    pdf_container = '''  <div style="display:none; position:absolute; left:-9999px;">
    <div id="pdf-export-container" style="width: 800px; padding: 40px; background: white; color: black; font-family: 'Inter', sans-serif;"></div>
  </div>'''
    if 'id="pdf-export-container"' not in content:
        content = content.replace('</div>\n<script src="data_fixtures.js">', pdf_container + '\n</div>\n<script src="data_fixtures.js">')
        
    # Bump v version
    content = content.replace('main.js?v=7', 'main.js?v=18')
    content = content.replace('main.js?v=5', 'main.js?v=18')
    content = content.replace('style.css?v=5', 'style.css?v=18')
    content = content.replace('style.css?v=6', 'style.css?v=18')
    content = content.replace('style.css?v=7', 'style.css?v=18')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Now fix the PDF layout background issue in main.js
# The table had gray backgrounds with gray text, let's make text black and background #ddd
filepath = 'main.js'
with open(filepath, 'r', encoding='utf-8') as f:
    main_content = f.read()
    
main_content = main_content.replace('color:#fff', 'color:#000') # Fix white text on gray backgrounds
main_content = main_content.replace('background:#999', 'background:#e0e0e0; color:#000; border:1px solid #333') # Make headers readable
main_content = main_content.replace('border-right:1px solid #fff', 'border-right:1px solid #333; border-bottom:1px solid #333; border-top:1px solid #333')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(main_content)

with open('dashboard/static/js/main.js', 'w', encoding='utf-8') as f:
    f.write(main_content)
