import io
import re

with io.open("dashboard/templates/dashboard/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the inner order/date filter
target = """          <!-- Controles de ordenamiento y filtrado por fecha -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid rgba(148,163,184,0.08); background: rgba(148, 163, 184, 0.02);">
            <div class="form-group" style="margin-bottom: 0;">
              <label for="cot-sort-by" style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Ordenar por</label>
              <select id="cot-sort-by" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; background: rgba(30,41,59,0.8); border: 1px solid rgba(148,163,184,0.15); border-radius: 4px; color: var(--text-light); width: 100%;">
                <option value="cierre_asc">Fecha de Cierre (Próximas primero)</option>
                <option value="pub_desc">Fecha de Publicación (Recientes primero)</option>
                <option value="presupuesto_desc">Presupuesto (Mayor primero)</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label for="cot-date-filter" style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Filtro Temporal</label>
              <select id="cot-date-filter" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; background: rgba(30,41,59,0.8); border: 1px solid rgba(148,163,184,0.15); border-radius: 4px; color: var(--text-light); width: 100%;">
                <option value="all">Todas las online</option>
                <option value="hoy">Cierran Hoy</option>
                <option value="24h">Cierran en 24 hrs</option>
                <option value="48h">Cierran en 48 hrs</option>
              </select>
            </div>
          </div>"""

replacement = """          <!-- Controles de ordenamiento -->
          <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid rgba(148,163,184,0.08); background: rgba(148, 163, 184, 0.02);">
            <div class="form-group" style="margin-bottom: 0;">
              <label for="cot-sort-by" style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Ordenar por</label>
              <select id="cot-sort-by" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; background: rgba(30,41,59,0.8); border: 1px solid rgba(148,163,184,0.15); border-radius: 4px; color: var(--text-light); width: 100%;">
                <option value="recent">Más recientes primero</option>
                <option value="oldest">Más antiguos primero</option>
                <option value="budget_desc">Mayor presupuesto</option>
                <option value="budget_asc">Menor presupuesto</option>
              </select>
            </div>
          </div>"""

if target in content:
    content = content.replace(target, replacement)
    print("Inner filters replaced.")
else:
    print("Inner filters target not found. Checking if already replaced...")
    if "<!-- Controles de ordenamiento -->" in content:
        print("Already replaced.")
    else:
        print("Target mismatch:")
        import difflib
        print("Expected:", repr(target[:100]))

# Add pagination controls under the table body
target2 = "            </div>\n          </div>\n        </div>"
pagination_html = """            </div>
            
            <div id="cot-pagination" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-top: 1px solid rgba(148,163,184,0.1);">
              <button id="cot-page-prev" class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.85rem;" disabled>&laquo; Anterior</button>
              <span id="cot-page-info" style="font-size: 0.85rem; color: var(--text-muted);">Página 1 de 1</span>
              <button id="cot-page-next" class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.85rem;" disabled>Siguiente &raquo;</button>
            </div>

          </div>
        </div>"""

if 'id="cot-pagination"' not in content:
    # Let's insert the pagination right before the end of the left column
    # The table is inside <div class="cot-list" id="cot-list-container">
    # Let's find: <div class="cot-list" id="cot-list-container">...</div>
    match = re.search(r'(<div class=\"cot-list\" id=\"cot-list-container\">.*?\n            </div>)', content, re.DOTALL)
    if match:
        original = match.group(1)
        new_str = original + """
            <div id="cot-pagination" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-top: 1px solid rgba(148,163,184,0.1);">
              <button id="cot-page-prev" class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.85rem;" disabled>&laquo; Anterior</button>
              <span id="cot-page-info" style="font-size: 0.85rem; color: var(--text-muted);">Página 1 de 1</span>
              <button id="cot-page-next" class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.85rem;" disabled>Siguiente &raquo;</button>
            </div>
"""
        content = content.replace(original, new_str)
        print("Pagination inserted.")
    else:
        print("cot-list-container not found.")

with io.open("dashboard/templates/dashboard/index.html", "w", encoding="utf-8") as f:
    f.write(content)

