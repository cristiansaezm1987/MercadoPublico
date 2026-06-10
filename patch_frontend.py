# -*- coding: utf-8 -*-
import io
import re

# 1. Update index.html
with io.open("dashboard/templates/dashboard/index.html", "r", encoding="utf-8") as f:
    html = f.read()

filter_html = """<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
          <h3 class="card-title" style="margin:0;">Últimas Compras Ágiles Analizadas</h3>
          <div style="display:flex;gap:10px;align-items:center;">
            <select id="dash-filter-region" style="padding:4px 8px;border-radius:4px;border:1px solid rgba(148,163,184,0.3);background:rgba(15,23,42,0.8);color:#fff;"><option value="Todos">Todas las Regiones</option></select>
            <input type="date" id="dash-filter-fecha" style="padding:4px 8px;border-radius:4px;border:1px solid rgba(148,163,184,0.3);background:rgba(15,23,42,0.8);color:#fff;">
          </div>
        </div>"""

html = re.sub(r'<div class="card-header"><h3 class="card-title">Últimas Compras Ágiles Analizadas</h3></div>', filter_html, html)

with io.open("dashboard/templates/dashboard/index.html", "w", encoding="utf-8") as f:
    f.write(html)


# 2. Update main.js
with io.open("main.js", "r", encoding="utf-8") as f:
    js = f.read()

# Replace loadRealTenders
new_load_real_tenders = """    async function loadRealTenders(region = '', fecha = '') {
        try {
            let url = '/api/tenders/?';
            if (region && region !== 'Todos') url += 'region=' + encodeURIComponent(region) + '&';
            if (fecha) url += 'fecha_start=' + encodeURIComponent(fecha) + '&';
            
            const data = await safeFetch(url, () => {
                return { tenders: window.DATA_FIXTURES.LICITACIONES_ACTIVAS };
            });
            window.REAL_TENDERS = data.tenders || window.DATA_FIXTURES.LICITACIONES_ACTIVAS;
            if (window.REAL_TENDERS.length === 0) {
                 window.REAL_TENDERS = window.DATA_FIXTURES.LICITACIONES_ACTIVAS;
            }
            renderRecentTenders(window.REAL_TENDERS);
        } catch(e) {
            window.REAL_TENDERS = window.DATA_FIXTURES.LICITACIONES_ACTIVAS;
            renderRecentTenders(window.REAL_TENDERS);
        }
    }
    
    function renderRecentTenders(tenders) {
        const tbody = document.getElementById('recent-tenders-body');
        if (!tbody) return;
        if (tenders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-dark);">No hay compras ágiles que coincidan con el filtro.</td></tr>';
            return;
        }
        
        tbody.innerHTML = tenders.slice(0, 15).map(t => {
            const scoreIA = calculate_cot_score(t);
            let badgeClass = 'score-badge-green';
            if (scoreIA >= 80) badgeClass = 'score-badge-gold';
            if (scoreIA < 50) badgeClass = 'score-badge-blue';
            return `
            <tr>
                <td><code style="font-family:monospace;font-size:0.75rem;background:rgba(99,102,241,0.1);padding:2px 6px;border-radius:4px;color:var(--primary-light);">${t.codigo}</code></td>
                <td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${t.nombre}">${t.nombre}</td>
                <td>${t.rubro_nombre}</td>
                <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.comprador}</td>
                <td style="font-size:0.8rem;color:var(--text-muted);">${formatDateShort(t.fecha_publicacion || t.fecha_cierre)}</td>
                <td style="font-size:0.8rem;color:var(--warning);">${formatDateShort(t.fecha_cierre)}</td>
                <td style="font-family:monospace;">${window.formatCLP(t.presupuesto || t.presupuesto_estimado)}</td>
                <td style="color:var(--text-muted);font-size:0.85rem;"><span class="${badgeClass}">${scoreIA.toFixed(0)}% Score IA</span></td>
                <td style="font-family:monospace;font-weight:600;color:var(--success);">${window.formatCLP(t.precio_adjudicado || (t.presupuesto * 0.95))}</td>
            </tr>
            `;
        }).join('');
    }
"""

js = re.sub(r'async function loadRealTenders\(\) \{.*?\n    \}', new_load_real_tenders, js, flags=re.DOTALL)

# Add event listeners to populateDropdownsAndTables
listeners_code = """
        // Populate dash-filter-region
        const dashRegion = document.getElementById('dash-filter-region');
        if (dashRegion) {
            dashRegion.innerHTML += regiones.map(reg => `<option value="${reg}">${reg}</option>`).join('');
            dashRegion.addEventListener('change', () => {
                const dateVal = document.getElementById('dash-filter-fecha')?.value;
                loadRealTenders(dashRegion.value, dateVal);
            });
        }
        const dashFecha = document.getElementById('dash-filter-fecha');
        if (dashFecha) {
            dashFecha.addEventListener('change', () => {
                const regVal = document.getElementById('dash-filter-region')?.value;
                loadRealTenders(regVal, dashFecha.value);
            });
        }
"""

js = js.replace('function populateDropdownsAndTables() {', 'function populateDropdownsAndTables() {' + listeners_code)

# Remove the old static render inside populateDropdownsAndTables
js = re.sub(r'const recentTendersBody = document\.getElementById\(\'recent-tenders-body\'\);.*?\}\).join\(\'\'\);\s*\}', '', js, flags=re.DOTALL)

with io.open("main.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Frontend patched with filters")
