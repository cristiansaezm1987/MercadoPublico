# -*- coding: utf-8 -*-
with open("main.js", "r", encoding="utf-8") as f:
    text = f.read()

# Add loadRealTenders() and call it in init()
init_find = """    async function init() {
        populateDropdownsAndTables();
        setupNavigation();
        await loadDashboardData();
        setupApiTab();
    }"""
init_replace = """    async function init() {
        populateDropdownsAndTables();
        setupNavigation();
        await loadDashboardData();
        await loadRealTenders();
        setupApiTab();
    }

    window.REAL_TENDERS = [];
    async function loadRealTenders() {
        try {
            const data = await safeFetch('/api/tenders/', () => {
                return { tenders: window.DATA_FIXTURES.LICITACIONES_ACTIVAS };
            });
            window.REAL_TENDERS = data.tenders || window.DATA_FIXTURES.LICITACIONES_ACTIVAS;
            if (window.REAL_TENDERS.length === 0) {
                 window.REAL_TENDERS = window.DATA_FIXTURES.LICITACIONES_ACTIVAS;
            }
        } catch(e) {
            window.REAL_TENDERS = window.DATA_FIXTURES.LICITACIONES_ACTIVAS;
        }
    }"""
text = text.replace(init_find, init_replace)

# Replace all DATA_FIXTURES.LICITACIONES_ACTIVAS with REAL_TENDERS
text = text.replace("window.DATA_FIXTURES.LICITACIONES_ACTIVAS", "window.REAL_TENDERS")

# Bump cache to 109
text = text.replace('v=108', 'v=109')

with open("main.js", "w", encoding="utf-8") as f:
    f.write(text)

with open("dashboard/static/js/main.js", "w", encoding="utf-8") as f:
    f.write(text)

# Bump HTML files
for html_file in ['index.html', 'dashboard/templates/dashboard/index.html']:
    with open(html_file, 'r', encoding='utf-8') as f:
        html = f.read()
    html = html.replace('v=108', 'v=109')
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html)

print("main.js updated with REAL_TENDERS integration")
