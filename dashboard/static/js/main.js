document.addEventListener('DOMContentLoaded', () => {
    let activeTabId = 'tab-dashboard';
    let rubrosData = [];
    let recDebounceTimer = null;

    init();

    async function init() {
        setupNavigation();
        await loadDashboardData();
        setupSimulator();
        setupSuppliers();
        setupLiveSearch();
        setupBudgetSlider();
        setupRegionDependentDropdowns();
    }

    // ---- NAVIGATION ----
    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');
        navItems.forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                const targetTab = item.getAttribute('data-tab');
                if (targetTab === activeTabId) return;
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                tabContents.forEach(c => c.classList.remove('active'));
                const el = document.getElementById(targetTab);
                if (el) el.classList.add('active');
                activeTabId = targetTab;
                updateHeaderTitles(targetTab);
            });
        });
    }

    function updateHeaderTitles(tabId) {
        const map = {
            'tab-dashboard': ['Panel de Control Inteligente', 'Monitoreo de competencia, simulacion de ofertas y optimizacion de margenes.'],
            'tab-rubros': ['Matriz de Oportunidades por Rubro', 'Deteccion automatica de rubros con mayor tasa de adjudicacion.'],
            'tab-recommend': ['Recomendaciones IA por Presupuesto', 'Desliza el variador y la IA sugiere las mejores licitaciones activas para tu rango de precios.'],
            'tab-simulator': ['Simulador de Precios IA', 'Calcula probabilidad de exito de tus ofertas y ajusta tu margen.'],
            'tab-suppliers': ['Buscador de Proveedores Estrategicos', 'Encuentra distribuidores con mejores precios en regiones especificas.'],
            'tab-api': ['Explorador Mercado Publico API', 'Conexion directa y busquedas en tiempo real, incluyendo compras agiles (COT).']
        };
        const t = document.getElementById('page-title');
        const s = document.getElementById('page-subtitle');
        if (t && map[tabId]) { t.textContent = map[tabId][0]; s.textContent = map[tabId][1]; }
    }

    // ---- UTILS ----
    function formatCLP(val) {
        if (!val && val !== 0) return '$0';
        return '$' + Math.round(val).toLocaleString('es-CL');
    }

    function formatDateShort(dateStr) {
        if (!dateStr || dateStr === 'N/A') return 'N/A';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr.split('T')[0] || dateStr;
            return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return dateStr.split('T')[0] || dateStr; }
    }

    function animateValue(el, start, end, duration) {
        if (!el) return;
        let ts = null;
        const step = t => {
            if (!ts) ts = t;
            const prog = Math.min((t - ts) / duration, 1);
            el.textContent = Math.floor(prog * (end - start) + start) + '%';
            if (prog < 1) requestAnimationFrame(step);
            else el.textContent = end + '%';
        };
        requestAnimationFrame(step);
    }

    function getProbColor(prob) {
        if (prob >= 65) return 'var(--success)';
        if (prob >= 40) return 'var(--warning)';
        return 'var(--danger)';
    }

    const CHART_COLORS = ['#6366f1','#06b6d4','#d946ef','#10b981','#f59e0b','#ef4444'];
    const CHART_BASE = {
        chart: { background: 'transparent', foreColor: '#94a3b8', toolbar: { show: false }, animations: { enabled: true, speed: 600 } },
        tooltip: { theme: 'dark' },
        grid: { borderColor: 'rgba(148,163,184,0.1)', strokeDashArray: 4 },
        colors: CHART_COLORS,
        fontFamily: 'Inter, sans-serif'
    };

    let chartRubrosOverview = null, chartMarketShare = null, chartRadar = null, chartSensitivity = null;

    async function loadDashboardData() {
        try {
            const res = await fetch('/api/rubros/?region=Region%20Metropolitana');
            const json = await res.json();
            rubrosData = json.rubros || [];
            renderOverviewChart(rubrosData);
            renderMarketShareChart(rubrosData);
        } catch (err) {
            console.error('Dashboard load error:', err);
        }
        const regionEl = document.getElementById('filter-region-rubros');
        if (regionEl) {
            regionEl.addEventListener('change', async () => {
                const region = encodeURIComponent(regionEl.value);
                const res = await fetch(`/api/rubros/?region=${region}`);
                const json = await res.json();
                rubrosData = json.rubros || [];
                renderRubrosTable(rubrosData);
                renderRadarChart(rubrosData);
            });
        }
    }

    function renderOverviewChart(data) {
        const el = document.getElementById('chart-rubros-overview');
        if (!el || !data.length) return;
        if (chartRubrosOverview) chartRubrosOverview.destroy();
        chartRubrosOverview = new ApexCharts(el, {
            ...CHART_BASE,
            chart: { ...CHART_BASE.chart, type: 'bar', height: 300 },
            plotOptions: { bar: { horizontal: true, borderRadius: 6, dataLabels: { position: 'top' } } },
            series: [{ name: 'Score IA', data: data.map(r => r.score) }],
            xaxis: { categories: data.map(r => r.nombre.substring(0, 30)), axisBorder: { show: false } },
            yaxis: { max: 100, labels: { style: { fontSize: '11px' } } },
            dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%', style: { fontSize: '10px', colors: ['#fff'] } },
            legend: { show: false }
        });
        chartRubrosOverview.render();
    }

    function renderMarketShareChart(data) {
        const el = document.getElementById('chart-market-share');
        if (!el || !data.length) return;
        if (chartMarketShare) chartMarketShare.destroy();
        chartMarketShare = new ApexCharts(el, {
            ...CHART_BASE,
            chart: { ...CHART_BASE.chart, type: 'donut', height: 300 },
            series: data.map(r => r.volumen_clp),
            labels: data.map(r => r.nombre.split(' ').slice(0, 3).join(' ')),
            legend: { position: 'bottom', fontSize: '11px', labels: { colors: '#94a3b8' } },
            plotOptions: { pie: { donut: { size: '55%' } } },
            dataLabels: { enabled: false }
        });
        chartMarketShare.render();
    }

    function renderRubrosTable(data) {
        const tbody = document.getElementById('rubros-table-body');
        if (!tbody) return;
        tbody.innerHTML = data.map(r => {
            let badgeClass = 'badge-warning';
            if (r.score >= 70) badgeClass = 'badge-success';
            if (r.score < 45) badgeClass = 'badge-danger';
            return `<tr>
                <td style="font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.nombre}</td>
                <td><span class="badge ${badgeClass}">${r.score.toFixed(1)}%</span></td>
                <td>${r.competidores}</td>
                <td>${r.tasa_adjudicacion}%</td>
                <td>${r.margen}%</td>
                <td><span style="font-size:0.75rem;color:var(--text-muted);">${r.dificultad}</span></td>
            </tr>`;
        }).join('');
    }

    function renderRadarChart(data) {
        const el = document.getElementById('chart-rubros-radar');
        if (!el || !data.length) return;
        if (chartRadar) chartRadar.destroy();
        chartRadar = new ApexCharts(el, {
            ...CHART_BASE,
            chart: { ...CHART_BASE.chart, type: 'radar', height: 320 },
            series: data.slice(0, 4).map((r, i) => ({ name: r.nombre.split(' ')[0], data: [r.score, r.tasa_adjudicacion, r.margen, 100 - r.competidores * 4, r.proveedores_disponibles * 15] })),
            xaxis: { categories: ['Score IA', 'Tasa Adj.', 'Margen', 'Baja Comp.', 'Proveedores'] },
            yaxis: { max: 100, show: false },
            legend: { fontSize: '11px', labels: { colors: '#94a3b8' } },
            markers: { size: 4 }
        });
        chartRadar.render();
    }

    // ---- BUDGET SLIDER / RECOMMENDATIONS ----
    function setupBudgetSlider() {
        const slider = document.getElementById('budget-slider');
        const display = document.getElementById('budget-display');
        if (!slider) return;

        slider.addEventListener('input', () => {
            const val = parseInt(slider.value);
            display.textContent = formatCLP(val);
            triggerRecommendation();
        });
        const recRubroEl = document.getElementById('rec-rubro');
        const recRegionEl = document.getElementById('rec-region');
        if (recRubroEl) recRubroEl.addEventListener('change', triggerRecommendation);
        if (recRegionEl) recRegionEl.addEventListener('change', triggerRecommendation);

        // Initial load
        const initVal = parseInt(slider.value);
        display.textContent = formatCLP(initVal);
        loadRecommendations(initVal, '', '');
    }

    function triggerRecommendation() {
        clearTimeout(recDebounceTimer);
        recDebounceTimer = setTimeout(() => {
            const slider = document.getElementById('budget-slider');
            const rubroEl = document.getElementById('rec-rubro');
            const regionEl = document.getElementById('rec-region');
            const budget = slider ? parseInt(slider.value) : 15000000;
            const rubro = rubroEl ? rubroEl.value : '';
            const region = regionEl ? regionEl.value : '';
            loadRecommendations(budget, rubro, region);
        }, 400);
    }

    async function loadRecommendations(budget, rubroId, region) {
        const loadingEl = document.getElementById('rec-loading');
        const tbody = document.getElementById('rec-results-body');
        if (loadingEl) loadingEl.style.display = 'inline';
        let url = `/api/recommend/?budget=${budget}`;
        if (rubroId) url += `&rubro_id=${encodeURIComponent(rubroId)}`;
        if (region) url += `&region=${encodeURIComponent(region)}`;
        try {
            const res = await fetch(url);
            const json = await res.json();
            const recs = json.recommendations || [];
            renderRecommendations(recs, budget);
        } catch (err) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--danger);">Error al consultar la API de recomendaciones.</td></tr>`;
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    function renderRecommendations(recs, budget) {
        const tbody = document.getElementById('rec-results-body');
        const countEl = document.getElementById('rec-count');
        const avgProbEl = document.getElementById('rec-avg-prob');
        const bestNameEl = document.getElementById('rec-best-name');
        const bestOfferEl = document.getElementById('rec-best-offer');

        if (countEl) countEl.textContent = recs.length;

        if (recs.length > 0) {
            const avgProb = (recs.reduce((s, r) => s + r.win_probability, 0) / recs.length).toFixed(1);
            if (avgProbEl) { avgProbEl.textContent = avgProb + '%'; avgProbEl.style.color = getProbColor(parseFloat(avgProb)); }
            if (bestNameEl) bestNameEl.textContent = recs[0].nombre;
            if (bestOfferEl) bestOfferEl.textContent = formatCLP(recs[0].suggested_offer);
        } else {
            if (avgProbEl) avgProbEl.textContent = '—';
            if (bestNameEl) bestNameEl.textContent = '—';
            if (bestOfferEl) bestOfferEl.textContent = '—';
        }

        if (!tbody) return;

        if (!recs.length) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-dark);padding:2rem;">No se encontraron licitaciones en ese rango de presupuesto. Ajusta el variador o los filtros.</td></tr>`;
            return;
        }

        tbody.innerHTML = recs.map((r, i) => {
            const probColor = getProbColor(r.win_probability);
            const tipoBadge = r.tipo === 'compra_agil'
                ? `<span class="badge badge-success" style="font-size:0.65rem;">Compra Agil</span>`
                : `<span class="badge badge-info" style="font-size:0.65rem;">Licitacion</span>`;
            const podiumIcon = i === 0 ? '<span title="Mejor oportunidad">🏆</span> ' : '';
            return `<tr style="cursor:pointer;" onclick="window.openTenderModal('${r.codigo}')">
                <td>${tipoBadge}</td>
                <td><code style="font-family:monospace;font-size:0.72rem;background:rgba(99,102,241,0.12);padding:2px 6px;border-radius:4px;color:var(--primary-light);">${r.codigo}</code></td>
                <td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.nombre}">${podiumIcon}${r.nombre}</td>
                <td style="font-size:0.82rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.comprador}</td>
                <td style="font-size:0.8rem;color:var(--text-muted);">${r.region.replace('Region de la', 'R.').replace('Region de', 'R.').replace('Region del', 'R.').replace('Region Metropolitana','R.M.')}</td>
                <td style="font-family:monospace;">${formatCLP(r.presupuesto)}</td>
                <td style="font-size:0.8rem;color:var(--text-muted);">${formatDateShort(r.fecha_publicacion)}</td>
                <td style="font-size:0.8rem;color:var(--warning);">${formatDateShort(r.fecha_cierre)}</td>
                <td><span class="badge" style="background:${probColor}22;color:${probColor};border:1px solid ${probColor}44;font-weight:700;">${r.win_probability}%</span></td>
                <td style="font-family:monospace;font-weight:700;color:var(--secondary);">${formatCLP(r.suggested_offer)}</td>
                <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();window.openTenderModal('${r.codigo}')">Ver</button></td>
            </tr>`;
        }).join('');
    }

    // ---- SIMULATOR ----
    function setupSimulator() {
        const form = document.getElementById('simulator-form');
        if (form) form.addEventListener('submit', runSimulation);
        const btn = document.getElementById('btn-simulate');
        if (btn) btn.addEventListener('click', runSimulation);
    }

    async function runSimulation(e) {
        if (e) e.preventDefault();
        const cost = parseFloat(document.getElementById('sim-cost')?.value || 0);
        const rubro = document.getElementById('sim-rubro')?.value || '';
        const region = document.getElementById('sim-region')?.value || '';
        const comprador = document.getElementById('sim-comprador')?.value || '';
        if (!cost || cost <= 0 || !rubro || !region) {
            alert('Por favor completa Costo Base, Rubro y Region.'); return;
        }
        const btn = document.getElementById('btn-simulate');
        if (btn) { btn.disabled = true; btn.innerHTML = 'Calculando...'; }
        try {
            let url = `/api/analyze/?cost=${cost}&rubro_id=${encodeURIComponent(rubro)}&region=${encodeURIComponent(region)}`;
            if (comprador) url += `&comprador=${encodeURIComponent(comprador)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.error) { alert('Error: ' + data.error); return; }
            updateSimulatorResults(data, cost);
        } catch (err) {
            alert('Error al conectar con la API de analisis.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> Calcular Oferta Optima'; }
        }
    }

    function updateSimulatorResults(data, cost) {
        const priceEl = document.getElementById('sim-suggested-price');
        const probEl = document.getElementById('sim-probability');
        const marginEl = document.getElementById('sim-margin');
        const marginPesosEl = document.getElementById('sim-margin-pesos');
        const multiplierEl = document.getElementById('sim-multiplier');

        if (priceEl) priceEl.textContent = formatCLP(data.suggested_price);
        if (probEl) {
            animateValue(probEl, 0, data.suggested_prob, 800);
            probEl.style.color = getProbColor(data.suggested_prob);
        }
        if (marginEl) marginEl.textContent = data.suggested_margin + '%';
        if (marginPesosEl) {
            const marginPesos = (data.suggested_price || 0) - cost;
            marginPesosEl.textContent = formatCLP(marginPesos) + ' margen';
        }
        if (multiplierEl) multiplierEl.textContent = 'Multiplicador: ' + data.suggested_multiplier + 'x';

        // Draw sensitivity chart
        renderSensitivityChart(data);

        // Competitors table
        renderCompetitorsTable(data.competitors || [], cost, data.suggested_multiplier);
    }

    function renderSensitivityChart(data) {
        const el = document.getElementById('chart-sensitivity');
        if (!el) return;
        if (chartSensitivity) chartSensitivity.destroy();
        const pts = data.pricing_points || [];
        chartSensitivity = new ApexCharts(el, {
            ...CHART_BASE,
            chart: { ...CHART_BASE.chart, type: 'line', height: 250 },
            series: [
                { name: 'Prob. Adjudicacion %', data: pts.map(p => ({ x: p.multiplier, y: p.probability })) },
                { name: 'Utilidad Esperada CLP', data: pts.map(p => ({ x: p.multiplier, y: Math.round(p.expected_profit / 1000) })) }
            ],
            xaxis: { title: { text: 'Multiplicador (x costo)' }, labels: { formatter: v => v + 'x' } },
            yaxis: [
                { title: { text: 'Prob. %' }, max: 100, labels: { style: { fontSize: '10px' } } },
                { opposite: true, title: { text: 'Utilidad (Miles CLP)' }, labels: { style: { fontSize: '10px' } } }
            ],
            stroke: { curve: 'smooth', width: [3, 2], dashArray: [0, 5] },
            markers: { size: 0 },
            legend: { fontSize: '11px', labels: { colors: '#94a3b8' } }
        });
        chartSensitivity.render();
    }

    function renderCompetitorsTable(competitors, cost, myMult) {
        const tbody = document.getElementById('sim-competitors-body');
        if (!tbody) return;
        if (!competitors.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-dark);">Sin datos de competidores para este rubro.</td></tr>'; return; }
        tbody.innerHTML = competitors.map(c => {
            const estPrice = formatCLP(cost * c.multiplicador_precio);
            let repClass = 'badge-warning';
            if (c.reputacion === 'Alta' || c.reputacion === 'Muy Alta') repClass = 'badge-danger';
            if (c.reputacion === 'Baja') repClass = 'badge-success';
            return `<tr>
                <td style="font-weight:500;">${c.nombre}</td>
                <td style="font-family:monospace;">${estPrice}</td>
                <td>${(c.tasa_exito * 100).toFixed(0)}%</td>
                <td><span class="badge ${repClass}">${c.reputacion}</span></td>
            </tr>`;
        }).join('');
    }

    // ---- SUPPLIERS ----
    function setupSuppliers() {
        const form = document.getElementById('suppliers-form');
        if (form) form.addEventListener('submit', runSupplierSearch);
        const btn = document.getElementById('btn-find-suppliers');
        if (btn) btn.addEventListener('click', runSupplierSearch);
    }

    async function runSupplierSearch(e) {
        if (e) e.preventDefault();
        const rubro = document.getElementById('sup-rubro')?.value || '';
        const region = document.getElementById('sup-region')?.value || '';
        const cost = parseFloat(document.getElementById('sup-cost')?.value || 0);
        if (!rubro || !region || !cost) { alert('Por favor completa todos los campos.'); return; }
        try {
            const res = await fetch(`/api/suppliers/?rubro_id=${encodeURIComponent(rubro)}&region=${encodeURIComponent(region)}&cost=${cost}`);
            const json = await res.json();
            renderSupplierCards(json.suppliers || []);
        } catch (err) { alert('Error al buscar proveedores.'); }
    }

    function renderSupplierCards(suppliers) {
        const container = document.getElementById('suppliers-results');
        if (!container) return;
        if (!suppliers.length) {
            container.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;"><p>No se encontraron proveedores en esa region para ese rubro.</p><p style="font-size:0.85rem;margin-top:0.5rem;">Intenta con una region diferente o un rubro mas amplio.</p></div>`;
            return;
        }
        container.innerHTML = suppliers.map((s, i) => `
            <div class="card supplier-card" style="animation-delay:${i * 0.05}s">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                    <span class="badge badge-success" style="font-size:0.8rem;">${s.descuento_pct}% descuento</span>
                    <div class="prob-meter-value" style="font-size:1.4rem;">${s.score}</div>
                </div>
                <h4 style="font-weight:600;margin-bottom:0.5rem;font-size:0.9rem;">${s.nombre}</h4>
                <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:1rem;">${s.region}</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.8rem;margin-bottom:1rem;">
                    <div><span style="color:var(--text-dark);">Costo estimado</span><div style="font-family:monospace;font-weight:700;color:var(--primary-light);">${formatCLP(s.costo_estimado)}</div></div>
                    <div><span style="color:var(--text-dark);">Ahorro total</span><div style="font-family:monospace;font-weight:700;color:var(--success);">${formatCLP(s.ahorro_estimado)}</div></div>
                    <div><span style="color:var(--text-dark);">Confiabilidad</span><div style="color:var(--secondary);">${s.confiabilidad_pct}%</div></div>
                    <div><span style="color:var(--text-dark);">Contacto</span><div style="font-size:0.72rem;">${s.telefono}</div></div>
                </div>
                <a href="mailto:${s.email}" class="btn btn-sm btn-secondary" style="width:100%;text-align:center;">Contactar: ${s.email}</a>
            </div>
        `).join('');
    }

    // ---- LIVE API SEARCH ----
    function setupLiveSearch() {
        const searchBtn = document.getElementById('btn-api-search');
        const todayBtn = document.getElementById('btn-api-today');
        const searchInput = document.getElementById('api-search-code');

        if (searchBtn) searchBtn.addEventListener('click', () => {
            const code = searchInput?.value?.trim();
            if (!code) { alert('Ingresa un codigo de licitacion o compra agil.'); return; }
            fetchTenderByCode(code);
        });
        if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchBtn?.click(); });
        if (todayBtn) todayBtn.addEventListener('click', fetchTodayTenders);

        document.getElementById('btn-close-modal')?.addEventListener('click', () => {
            document.getElementById('tender-modal')?.classList.remove('open');
        });
        document.getElementById('tender-modal')?.addEventListener('click', e => {
            if (e.target.id === 'tender-modal') e.target.classList.remove('open');
        });
    }

    async function fetchTenderByCode(code) {
        const tbody = document.getElementById('api-results-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);">Buscando ${code}...</td></tr>`;
        try {
            const res = await fetch(`/api/tenders/${encodeURIComponent(code)}/`);
            const json = await res.json();
            renderApiResults(json.Listado || [], json);
        } catch (err) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--danger);">Error al buscar. Verifica la conexion.</td></tr>`;
        }
    }

    async function fetchTodayTenders() {
        const tbody = document.getElementById('api-results-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);">Cargando licitaciones de hoy...</td></tr>`;
        try {
            const res = await fetch('/api/tenders/');
            const json = await res.json();
            renderApiResults(json.Listado || [], json);
        } catch (err) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--danger);">Error al conectar con la API.</td></tr>`;
        }
    }

    function renderApiResults(listado, fullData) {
        const tbody = document.getElementById('api-results-body');
        if (!tbody) return;
        if (!listado.length) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-dark);">No se encontraron resultados.</td></tr>';
            return;
        }
        tbody.innerHTML = listado.map(item => {
            const code = item.CodigoExterno || 'N/D';
            const isCOT = code.toUpperCase().includes('COT');
            const tipoBadge = isCOT
                ? `<span class="badge badge-success" style="font-size:0.65rem;">Compra Agil</span>`
                : `<span class="badge badge-info" style="font-size:0.65rem;">Licitacion</span>`;
            const name = item.Nombre || 'Sin nombre';
            const comprador = item.Comprador?.NombreOrganismo || 'N/D';
            const region = item.Comprador?.Region || 'N/D';
            const pubDate = formatDateShort(item.FechaPublicacion);
            const closeDate = formatDateShort(item.FechaCierre);
            const monto = formatCLP(item.ValorEstimado || 0);
            const estado = item.Estado || 'Publicada';
            return `<tr style="cursor:pointer;" onclick="window.openTenderModal('${code}')">
                <td>${tipoBadge}</td>
                <td><code style="font-family:monospace;font-size:0.72rem;background:rgba(99,102,241,0.12);padding:2px 6px;border-radius:4px;color:var(--primary-light);">${code}</code></td>
                <td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${name}">${name}</td>
                <td style="font-size:0.82rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${comprador}">${comprador}</td>
                <td style="font-size:0.8rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${region}</td>
                <td style="font-size:0.8rem;color:var(--text-muted);">${pubDate}</td>
                <td style="font-size:0.8rem;color:var(--warning);">${closeDate}</td>
                <td style="font-family:monospace;">${monto}</td>
                <td><span class="badge badge-info" style="font-size:0.65rem;">${estado}</span></td>
                <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();window.openTenderModal('${code}')">Ver</button></td>
            </tr>`;
        }).join('');
    }

    window.openTenderModal = async function(codigo) {
        const modal = document.getElementById('tender-modal');
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-tender-title');
        if (!modal || !modalBody) return;
        modal.classList.add('open');
        modalTitle.textContent = 'Cargando ' + codigo + '...';
        modalBody.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Consultando informacion...</div>';
        try {
            const res = await fetch(`/api/tenders/${encodeURIComponent(codigo)}/`);
            const json = await res.json();
            const item = json.Listado?.[0] || {};
            modalTitle.textContent = item.Nombre || codigo;
            const isCOT = codigo.toUpperCase().includes('COT');
            const tipo = isCOT ? 'Compra Agil' : (item.TipoLicitacion || 'Licitacion Publica');
            const items = item.Items?.Listado || [];
            modalBody.innerHTML = `
                <div class="modal-meta-grid">
                    <div><span>Codigo</span><strong><code>${codigo}</code></strong></div>
                    <div><span>Tipo</span><strong>${tipo}</strong></div>
                    <div><span>Estado</span><strong>${item.Estado || 'Publicada'}</strong></div>
                    <div><span>Monto Estimado</span><strong style="color:var(--secondary);font-family:monospace;">${formatCLP(item.ValorEstimado)}</strong></div>
                    <div><span>Comprador</span><strong>${item.Comprador?.NombreOrganismo || 'N/D'}</strong></div>
                    <div><span>Region</span><strong>${item.Comprador?.Region || 'N/D'}</strong></div>
                    <div><span>Publicacion</span><strong>${formatDateShort(item.FechaPublicacion)}</strong></div>
                    <div><span>Cierre</span><strong style="color:var(--warning);">${formatDateShort(item.FechaCierre)}</strong></div>
                    <div><span>Est. Adjudicacion</span><strong>${formatDateShort(item.FechaEstimadaAdjudicacion)}</strong></div>
                    <div><span>Contacto</span><strong>${item.Comprador?.MailContacto || 'N/D'}</strong></div>
                </div>
                ${item.Descripcion ? `<div style="margin-top:1rem;padding:1rem;background:rgba(148,163,184,0.07);border-radius:8px;font-size:0.88rem;color:var(--text-muted);line-height:1.6;">${item.Descripcion}</div>` : ''}
                ${items.length ? `<div style="margin-top:1.2rem;"><h4 style="font-weight:600;margin-bottom:0.75rem;font-size:0.9rem;">Items del Proceso</h4>
                    <div class="table-container"><table><thead><tr><th>Producto/Servicio</th><th>Cantidad</th><th>Unidad</th></tr></thead>
                    <tbody>${items.map(it => `<tr><td>${it.Producto || it.CodigoProducto || 'N/D'}</td><td>${it.Cantidad ?? 'N/D'}</td><td>${it.UnidadMedida || 'Unidad'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
            `;
        } catch (err) {
            modalBody.innerHTML = '<div style="color:var(--danger);text-align:center;padding:2rem;">Error al cargar los detalles.</div>';
        }
    };

    // ---- REGION-DEPENDENT DROPDOWNS ----
    function setupRegionDependentDropdowns() {
        const simRegion = document.getElementById('sim-region');
        const simComprador = document.getElementById('sim-comprador');
        if (simRegion && simComprador) {
            simRegion.addEventListener('change', async () => {
                const region = simRegion.value;
                simComprador.innerHTML = '<option value="">-- Cargando... --</option>';
                try {
                    const res = await fetch(`/api/compradores/?region=${encodeURIComponent(region)}`);
                    const json = await res.json();
                    const compradores = json.compradores || [];
                    simComprador.innerHTML = '<option value="">-- Todos los compradores --</option>' +
                        compradores.map(c => `<option value="${c.nombre}">${c.nombre} (${c.ciudad})</option>`).join('');
                } catch { simComprador.innerHTML = '<option value="">-- Error al cargar --</option>'; }
            });
        }
    }

}); // End DOMContentLoaded
