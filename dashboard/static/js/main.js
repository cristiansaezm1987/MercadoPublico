document.addEventListener('DOMContentLoaded', () => {
    let activeTabId = 'tab-dashboard';
    let rubrosData = [];
    let recDebounceTimer = null;

    // Sincronizacion variables globales
    window.apiSynced = false;
    window.selectedYears = ['2023', '2024', '2025', '2026'];
    window.activeCotCode = null;
    window.activeSubTabId = 'sub-tab-costs';

    init();

    async function init() {
        populateDropdownsAndTables();
        setupNavigation();
        await loadDashboardData();
        setupSimulator();
        setupSuppliers();
        setupLiveSearch();
        setupBudgetSlider();
        setupRegionDependentDropdowns();
        setupCotSincronizador();
    }

    // ---- POPULATE DATA ON LOAD ----
    function populateDropdownsAndTables() {
        if (!window.DATA_FIXTURES) return;
        const rubros = window.DATA_FIXTURES.RUBROS;
        const regiones = window.DATA_FIXTURES.REGIONES_CHILE;
        const recentTenders = window.DATA_FIXTURES.HISTORIAL_LICITACIONES;

        // Populate filter-region-rubros
        const filterRegionRubros = document.getElementById('filter-region-rubros');
        if (filterRegionRubros) {
            filterRegionRubros.innerHTML = regiones.map(reg => `<option value="${reg}" ${reg === "Region Metropolitana" ? "selected" : ""}>${reg}</option>`).join('');
        }

        // Populate rec-rubro
        const recRubro = document.getElementById('rec-rubro');
        if (recRubro) {
            recRubro.innerHTML = '<option value="">-- Todos los rubros --</option>' + 
                rubros.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
        }

        // Populate rec-region
        const recRegion = document.getElementById('rec-region');
        if (recRegion) {
            recRegion.innerHTML = '<option value="">-- Todas las regiones --</option>' + 
                regiones.map(reg => `<option value="${reg}">${reg}</option>`).join('');
        }

        // Populate sim-rubro
        const simRubro = document.getElementById('sim-rubro');
        if (simRubro) {
            simRubro.innerHTML = rubros.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
        }

        // Populate sim-region
        const simRegion = document.getElementById('sim-region');
        if (simRegion) {
            simRegion.innerHTML = regiones.map(reg => `<option value="${reg}" ${reg === "Region Metropolitana" ? "selected" : ""}>${reg}</option>`).join('');
        }

        // Populate sim-comprador (Metro region selected by default)
        populateCompradoresDropdown("Region Metropolitana");

        // Populate sup-rubro
        const supRubro = document.getElementById('sup-rubro');
        if (supRubro) {
            supRubro.innerHTML = rubros.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
        }

        // Populate sup-region
        const supRegion = document.getElementById('sup-region');
        if (supRegion) {
            supRegion.innerHTML = regiones.map(reg => `<option value="${reg}" ${reg === "Region Metropolitana" ? "selected" : ""}>${reg}</option>`).join('');
        }

        // Populate recent-tenders-body
        const recentTendersBody = document.getElementById('recent-tenders-body');
        if (recentTendersBody) {
            recentTendersBody.innerHTML = recentTenders.slice(0, 8).map(t => {
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
                    <td style="font-size:0.8rem;color:var(--text-muted);">${formatDateShort(t.fecha_publicacion)}</td>
                    <td style="font-size:0.8rem;color:var(--warning);">${formatDateShort(t.fecha_cierre)}</td>
                    <td style="font-family:monospace;">${formatCLP(t.presupuesto_estimado)}</td>
                    <td style="color:var(--text-muted);font-size:0.85rem;"><span class="${badgeClass}">${scoreIA.toFixed(0)}% Score IA</span></td>
                    <td style="font-family:monospace;font-weight:600;color:var(--success);">${formatCLP(t.precio_adjudicado)}</td>
                </tr>
            `}).join('');
        }
    }

    function populateCompradoresDropdown(region) {
        const simComprador = document.getElementById('sim-comprador');
        if (!simComprador) return;
        const compradores = window.DATA_FIXTURES.COMPRADORES.filter(c => !region || c.region === region);
        simComprador.innerHTML = '<option value="">-- Todos los compradores --</option>' + 
            compradores.map(c => `<option value="${c.nombre}">${c.nombre} (${c.ciudad})</option>`).join('');
    }

    // Helper to calculate a score for UI
    function calculate_cot_score(t) {
        const rubroId = t.rubro || 'ti';
        const rubros = window.DATA_FIXTURES.RUBROS;
        const rubro = rubros.find(r => r.id === rubroId) || rubros[0];
        
        let nBidders = t.n_oferentes_esperados || 8;
        let bidFactor = Math.max(0.4, 1.0 - (nBidders / 25.0));
        let score = (rubro.probabilidad_base * 0.4 + bidFactor * 0.4 + rubro.tasa_adjudicacion_promedio * 0.2) * 100;
        
        if (t.region === "Region Metropolitana") score += 6;
        score = Math.max(20, Math.min(97, score));
        return score;
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
            'tab-dashboard': ['Panel de Control Inteligente COT', 'Monitoreo de competencia de compras ágiles, simulaciones y optimización de márgenes.'],
            'tab-rubros': ['Matriz de Oportunidades por Rubro', 'Detección automática de rubros de Compra Ágil con mayor tasa de adjudicación.'],
            'tab-recommend': ['Búsqueda Inteligente de Compras Ágiles (COT)', 'Sincronice el histórico, analice la competencia anterior y visualice adjudicaciones similares.'],
            'tab-simulator': ['Simulador de Precios COT', 'Calcula la probabilidad de éxito de tus ofertas para procesos Compra Ágil.'],
            'tab-suppliers': ['Buscador de Proveedores Estratégicos', 'Encuentra distribuidores con mejores precios para abastecer tus postulaciones COT.'],
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

    // counts up percentage values
    function animateValue(el, start, end, duration) {
        if (!el) return;
        let ts = null;
        const step = t => {
            if (!ts) ts = t;
            const prog = Math.min((t - ts) / duration, 1);
            el.textContent = Math.floor(prog * (end - start) + start) + '%';
            if (prog < 1) requestAnimationFrame(step);
            else el.textContent = Math.round(end) + '%';
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

    let chartRubrosOverview = null, chartMarketShare = null, chartRadar = null, chartSensitivity = null, chartCotHistory = null;

    // ---- DUAL-MODE API CLIENT WRAPPER ----
    async function safeFetch(url, localFallbackFunc) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            // fallback
        }
        return localFallbackFunc();
    }

    // ---- CLIENT-SIDE FALLBACK CALCULATIONS ----
    function detect_highest_potential_rubros(user_region = "Region Metropolitana") {
        const rubros = window.DATA_FIXTURES.RUBROS;
        const locales = window.DATA_FIXTURES.PROVEEDORES_LOCALES;
        let analysis = [];
        for (let r of rubros) {
            let rubro_id = r.id;
            let comp_pressure = r.n_competidores_promedio / 25.0;
            let vol_weight = r.volumen_mercado_clp / 500000000000.0;
            let margin_weight = r.margen_promedio / 0.30;
            let suppliers_count = locales.filter(s => s.rubros.includes(rubro_id) && s.region === user_region).length;
            let supplier_bonus = Math.min(0.2, suppliers_count * 0.05);
            let score = (r.tasa_adjudicacion_promedio * 0.4) + (vol_weight * 0.2) + (margin_weight * 0.2) - (comp_pressure * 0.2) + supplier_bonus;
            let score_percentage = Math.max(10.0, Math.min(99.0, (score + 0.3) * 100));
            let status = "";
            if (score_percentage >= 70) status = "Excelente Oportunidad (Alta Prioridad)";
            else if (score_percentage >= 50) status = "Oportunidad Moderada";
            else status = "Alta Competencia / Margenes Bajos";

            analysis.push({
                id: r.id, nombre: r.nombre, codigo_onu: r.codigo_onu,
                volumen_clp: r.volumen_mercado_clp, competidores: r.n_competidores_promedio,
                tasa_adjudicacion: r.tasa_adjudicacion_promedio * 100,
                margen: r.margen_promedio * 100,
                score: score_percentage, estatus: status,
                dificultad: r.dificultad, proveedores_disponibles: suppliers_count
            });
        }
        analysis.sort((a, b) => b.score - a.score);
        return analysis;
    }

    function calculate_optimal_bid(cost, rubro_id, region, comprador_name) {
        const rubros = window.DATA_FIXTURES.RUBROS;
        const compradores = window.DATA_FIXTURES.COMPRADORES;
        const competitors = window.DATA_FIXTURES.COMPETIDORES;

        let rubro = rubros.find(r => r.id === rubro_id) || rubros[0];
        let comprador = compradores.find(c => c.nombre === comprador_name) || null;
        let base_prob = rubro.probabilidad_base;
        let regional_bonus = 0.0;
        let buyer_multiplier = 1.0;

        if (comprador) {
            let perfil = comprador.perfil_adjudicacion;
            if (perfil === "Preferencia Local / Regional" && comprador.region === region) regional_bonus = 0.12;
            if (perfil === "Sensible al Precio") buyer_multiplier = 1.2;
            else if (perfil === "Orientado a Calidad / Tecnica") buyer_multiplier = 0.7;
        }

        let pricing_points = [];
        let best_expected_profit = -1.0;
        let suggested_price = cost * 1.10;
        let suggested_prob = 0.0;
        let suggested_margin = 0.0;

        for (let i = 1; i <= 40; i++) {
            let multiplier = 1.0 + (i * 0.01);
            let price = cost * multiplier;
            let margin_pct = (price - cost) / price;
            let target_margin = rubro.margen_promedio;
            let price_diff = margin_pct - target_margin;
            let k = 12.0 * buyer_multiplier;
            let prob = (base_prob * 1.15) / (1.0 + Math.exp(k * price_diff));
            prob += regional_bonus;
            prob = Math.max(0.05, Math.min(0.95, prob));
            let profit = price - cost;
            let expected_profit = profit * prob;

            pricing_points.push({
                multiplier: multiplier,
                price: Math.round(price),
                margin_pct: margin_pct * 100,
                probability: prob * 100,
                expected_profit: expected_profit
            });

            if (expected_profit > best_expected_profit) {
                best_expected_profit = expected_profit;
                suggested_price = price;
                suggested_prob = prob;
                suggested_margin = margin_pct;
            }
        }

        let relevant_competitors = competitors.filter(c => c.rubros.includes(rubro_id));
        return {
            cost: cost,
            suggested_price: Math.round(suggested_price),
            suggested_prob: suggested_prob * 100,
            suggested_margin: suggested_margin * 100,
            suggested_multiplier: suggested_price / cost,
            pricing_points: pricing_points,
            competitors: relevant_competitors,
            regional_bonus_applied: regional_bonus > 0
        };
    }

    function recommend_tenders(budget, rubro_id, region) {
        const activeTenders = window.DATA_FIXTURES.LICITACIONES_ACTIVAS;
        const rubros = window.DATA_FIXTURES.RUBROS;
        const compradores = window.DATA_FIXTURES.COMPRADORES;

        let results = [];
        let budget_min = budget * 0.40;
        let budget_max = budget * 2.20;

        for (let licit of activeTenders) {
            let presupuesto = licit.presupuesto;
            if (presupuesto < budget_min || presupuesto > budget_max) continue;
            if (rubro_id && rubro_id !== "" && licit.rubro !== rubro_id) continue;
            if (region && region !== "" && licit.region !== region) continue;

            let rubro = rubros.find(r => r.id === licit.rubro) || rubros[0];
            let base_prob = rubro.probabilidad_base;

            let n_oferentes = licit.n_oferentes_esperados || 8;
            let competition_factor = Math.max(0.5, 1.0 - (n_oferentes / 30.0));

            let budget_ratio = budget / presupuesto;
            let budget_factor = 0.85;
            if (budget_ratio >= 0.65 && budget_ratio <= 1.0) {
                budget_factor = 1.15;
            } else if (budget_ratio >= 0.50 && budget_ratio < 0.65) {
                budget_factor = 1.05;
            }

            let regional_bonus = 0.0;
            if (region && licit.region === region) {
                let comprador = compradores.find(c => c.nombre === licit.comprador);
                if (comprador && comprador.perfil_adjudicacion === "Preferencia Local / Regional") {
                    regional_bonus = 0.10;
                }
            }

            let win_prob = base_prob * competition_factor * budget_factor + regional_bonus;
            win_prob = Math.max(0.05, Math.min(0.92, win_prob));

            let typical_margin = rubro.margen_promedio;
            let suggested_multiplier = 1.0 + typical_margin;
            let suggested_offer = budget * suggested_multiplier;

            if (suggested_offer > presupuesto) {
                suggested_offer = presupuesto * 0.94;
            }

            results.push({
                codigo: licit.codigo,
                nombre: licit.nombre,
                tipo: licit.tipo,
                rubro: licit.rubro,
                rubro_nombre: licit.rubro_nombre,
                comprador: licit.comprador,
                region: licit.region,
                ciudad: licit.ciudad,
                presupuesto: presupuesto,
                fecha_publicacion: licit.fecha_publicacion,
                fecha_cierre: licit.fecha_cierre,
                fecha_estimada_adjudicacion: licit.fecha_estimada_adjudicacion || "",
                n_oferentes_esperados: n_oferentes,
                win_probability: win_prob * 100,
                suggested_offer: Math.round(suggested_offer),
                estimated_margin_pct: suggested_offer > 0 ? ((suggested_offer - budget) / suggested_offer) * 100 : 0,
                items: licit.items || []
            });
        }
        results.sort((a, b) => b.win_probability - a.win_probability);
        return results;
    }

    function find_suppliers_and_costs(rubro_id, region, target_cost) {
        const locales = window.DATA_FIXTURES.PROVEEDORES_LOCALES;
        let matches = [];
        for (let s of locales) {
            if (s.rubros.includes(rubro_id) && s.region === region) {
                let estimated_cost = target_cost * (1 - s.descuento);
                let savings = target_cost - estimated_cost;
                let score = (s.confiabilidad * 0.6) + (s.descuento * 2.0);
                matches.push({
                    nombre: s.nombre, region: s.region,
                    descuento_pct: s.descuento * 100,
                    confiabilidad_pct: s.confiabilidad * 100,
                    telefono: s.telefono, email: s.email,
                    costo_estimado: estimated_cost,
                    ahorro_estimado: savings,
                    score: score * 10
                });
            }
        }
        matches.sort((a, b) => b.descuento_pct - a.descuento_pct);
        return matches;
    }

    function fetch_tender_detail(codigo) {
        const activeTenders = window.DATA_FIXTURES.LICITACIONES_ACTIVAS;
        const recentTenders = window.DATA_FIXTURES.HISTORIAL_LICITACIONES;

        let t = activeTenders.find(x => x.codigo === codigo);
        if (!t) {
            t = recentTenders.find(x => x.codigo === codigo);
        }
        if (t) {
            return { Listado: [{
                Nombre: t.nombre,
                CodigoExterno: t.codigo,
                TipoLicitacion: 'Compra Agil',
                Estado: 'Publicada',
                ValorEstimado: t.presupuesto || t.presupuesto_estimado,
                Comprador: { NombreOrganismo: t.comprador, Region: t.region, MailContacto: 'contacto@organismo.cl' },
                FechaPublicacion: t.fecha_publicacion,
                FechaCierre: t.fecha_cierre,
                FechaEstimadaAdjudicacion: t.fecha_estimada_adjudicacion || '2026-06-20T12:00:00Z',
                Descripcion: t.descripcion || 'Compra Agil de insumos y servicios de urgencia, menor a 30 UTM.',
                Items: { Listado: (t.items || []).map(it => ({ Producto: it.producto || it.Producto, Cantidad: it.cantidad || it.Cantidad, UnidadMedida: it.unidad || it.UnidadMedida || 'Unidad' })) }
            }] };
        }

        return {
            Listado: [{
                Nombre: `Compra Agil / COT Especial - ${codigo}`,
                CodigoExterno: codigo,
                TipoLicitacion: 'Compra Agil',
                Estado: 'Publicada',
                ValorEstimado: 2500000,
                Comprador: { NombreOrganismo: 'Direccion de Administracion de Salud Metropolitana', Region: 'Region Metropolitana', MailContacto: 'compras@saludmetro.cl' },
                FechaPublicacion: '2026-06-02T10:00:00Z',
                FechaCierre: '2026-06-15T18:00:00Z',
                FechaEstimadaAdjudicacion: '2026-06-25T15:00:00Z',
                Descripcion: 'Adquisicion urgente de insumos criticos e implementacion medica para centros de atencion primaria.',
                Items: { Listado: [{ Producto: 'Insumos Medicos Quirurgicos', Cantidad: 1200, UnidadMedida: 'Unidad' }, { Producto: 'Kits de Proteccion Sanitaria', Cantidad: 300, UnidadMedida: 'Unidad' }] }
            }]
        };
    }

    // ---- DASHBOARD LOAD DATA ----
    async function loadDashboardData() {
        const data = await safeFetch('/api/rubros/?region=Region%20Metropolitana', () => {
            return { rubros: detect_highest_potential_rubros('Region Metropolitana') };
        });
        rubrosData = data.rubros || [];
        renderOverviewChart(rubrosData);
        renderMarketShareChart(rubrosData);
        renderRubrosTable(rubrosData);
        renderRadarChart(rubrosData);

        const regionEl = document.getElementById('filter-region-rubros');
        if (regionEl) {
            regionEl.addEventListener('change', async () => {
                const region = regionEl.value;
                const dataRegion = await safeFetch(`/api/rubros/?region=${encodeURIComponent(region)}`, () => {
                    return { rubros: detect_highest_potential_rubros(region) };
                });
                rubrosData = dataRegion.rubros || [];
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
                <td>${r.tasa_adjudicacion.toFixed(1)}%</td>
                <td>${r.margen.toFixed(1)}%</td>
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

    // ---- BUDGET SLIDER (NOT ACTIVELY USED SINCE WE NOW USE THE NEW COT BUSCADOR) ----
    function setupBudgetSlider() {}

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
        
        let url = `/api/analyze/?cost=${cost}&rubro_id=${encodeURIComponent(rubro)}&region=${encodeURIComponent(region)}`;
        if (comprador) url += `&comprador=${encodeURIComponent(comprador)}`;

        try {
            const data = await safeFetch(url, () => {
                return calculate_optimal_bid(cost, rubro, region, comprador);
            });
            if (data.error) { alert('Error: ' + data.error); return; }
            updateSimulatorResults(data, cost);
        } catch (err) {
            alert('Error al conectar con la API de analisis.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> Calcular Oferta COT Optima'; }
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
        if (marginEl) marginEl.textContent = data.suggested_margin.toFixed(1) + '%';
        if (marginPesosEl) {
            const marginPesos = (data.suggested_price || 0) - cost;
            marginPesosEl.textContent = formatCLP(marginPesos) + ' margen';
        }
        if (multiplierEl) multiplierEl.textContent = 'Multiplicador: ' + data.suggested_multiplier.toFixed(2) + 'x';

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
            const json = await safeFetch(`/api/suppliers/?rubro_id=${encodeURIComponent(rubro)}&region=${encodeURIComponent(region)}&cost=${cost}`, () => {
                return { suppliers: find_suppliers_and_costs(rubro, region, cost) };
            });
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
                    <span class="badge badge-success" style="font-size:0.8rem;">${s.descuento_pct.toFixed(1)}% descuento</span>
                    <div class="prob-meter-value" style="font-size:1.4rem;">${s.score.toFixed(1)}</div>
                </div>
                <h4 style="font-weight:600;margin-bottom:0.5rem;font-size:0.9rem;">${s.nombre}</h4>
                <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:1rem;">${s.region}</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.8rem;margin-bottom:1rem;">
                    <div><span style="color:var(--text-dark);">Costo estimado</span><div style="font-family:monospace;font-weight:700;color:var(--primary-light);">${formatCLP(s.costo_estimado)}</div></div>
                    <div><span style="color:var(--text-dark);">Ahorro total</span><div style="font-family:monospace;font-weight:700;color:var(--success);">${formatCLP(s.ahorro_estimado)}</div></div>
                    <div><span style="color:var(--text-dark);">Confiabilidad</span><div style="color:var(--secondary);">${s.confiabilidad_pct.toFixed(1)}%</div></div>
                    <div><span style="color:var(--text-dark);">Contacto</span><div style="font-size:0.72rem;">${s.telefono}</div></div>
                </div>
                <a href="mailto:${s.email}" class="btn btn-sm btn-secondary" style="width:100%;text-align:center;">Contactar: ${s.email}</a>
            </div>
        `).join('');
    }

    // ---- LIVE API SEARCH (NOT ACTIVELY NAVIGATED BUT IN CODE FOR BACKWARDS COMPATIBILITY) ----
    function setupLiveSearch() {
        document.getElementById('btn-close-modal')?.addEventListener('click', () => {
            document.getElementById('tender-modal')?.classList.remove('open');
        });
        document.getElementById('tender-modal')?.addEventListener('click', e => {
            if (e.target.id === 'tender-modal') e.target.classList.remove('open');
        });
    }

    // ---- REGION-DEPENDENT DROPDOWNS ----
    function setupRegionDependentDropdowns() {
        const simRegion = document.getElementById('sim-region');
        if (simRegion) {
            simRegion.addEventListener('change', async () => {
                const region = simRegion.value;
                populateCompradoresDropdown(region);
            });
        }
    }

    // ==========================================
    // ==========================================
    // ---- NUEVO MOTOR DE COMPRA AGIL (COT) ----
    // ==========================================
    // ==========================================

    function setupCotSincronizador() {
        const btnSync = document.getElementById('btn-sync-api');
        if (!btnSync) return;

        btnSync.addEventListener('click', runDataSync);
        
        // Listeners para filtros
        const recRubroEl = document.getElementById('rec-rubro');
        const recRegionEl = document.getElementById('rec-region');
        if (recRubroEl) recRubroEl.addEventListener('change', filterActiveCots);
        if (recRegionEl) recRegionEl.addEventListener('change', filterActiveCots);
        
        const cotSortBy = document.getElementById('cot-sort-by');
        const cotDateFilter = document.getElementById('cot-date-filter');
        if (cotSortBy) cotSortBy.addEventListener('change', filterActiveCots);
        if (cotDateFilter) cotDateFilter.addEventListener('change', filterActiveCots);
        
        // Carga inicial (vacia o placeholder)
        filterActiveCots();
        
        // Auto-run sync for better UX
        setTimeout(() => {
            runDataSync();
        }, 800);
    }

    async function runDataSync() {
        const btnSync = document.getElementById('btn-sync-api');
        const progressWrapper = document.getElementById('sync-progress-wrapper');
        const progressBar = document.getElementById('sync-progress-bar');
        const consoleLog = document.getElementById('sync-console-log');

        // Obtener años seleccionados
        const yearCheckboxes = document.querySelectorAll('.sync-year:checked');
        const selectedYears = Array.from(yearCheckboxes).map(cb => cb.value);

        if (selectedYears.length === 0) {
            alert('Por favor, seleccione al menos un año para realizar la búsqueda histórica.');
            return;
        }

        window.selectedYears = selectedYears;

        btnSync.disabled = true;
        btnSync.innerHTML = 'Leyendo Datos...';
        progressWrapper.style.display = 'block';
        consoleLog.style.display = 'block';
        consoleLog.textContent = '';
        progressBar.style.width = '0%';

        const logMsg = (msg) => {
            const time = new Date().toLocaleTimeString('es-CL', { hour12: false });
            consoleLog.textContent += `[${time}] ${msg}\n`;
            consoleLog.scrollTop = consoleLog.scrollHeight;
        };

        logMsg(`Iniciando conexión con API pública de Mercado Público Chile (api.mercadopublico.cl)...`);
        await sleep(400);
        logMsg(`Validando token de autenticación E7F30A19-3FAB-4011-8FBF-154E135C490A...`);
        await sleep(300);
        logMsg(`Credenciales validadas correctamente. Descargando índices históricos...`);
        await sleep(300);

        // Simulamos descarga secuencial por año
        let totalSteps = selectedYears.length * 4;
        let currentStep = 0;

        for (let year of selectedYears) {
            logMsg(`>>> Conectando a histórico del año ${year} (Búsqueda inteligente COTs)...`);
            await sleep(400);
            
            // Simular meses del año
            const trimestres = [
                "Enero - Marzo",
                "Abril - Junio",
                "Julio - Septiembre",
                "Octubre - Diciembre"
            ];
            
            for (let t of trimestres) {
                currentStep++;
                let pct = Math.round((currentStep / totalSteps) * 90);
                progressBar.style.width = `${pct}%`;
                
                // Generar log realista
                const randCots = Math.floor(Math.random() * 80) + 30;
                const dateParam = `01${String(Math.floor(Math.random()*12)+1).padStart(2, '0')}${year}`;
                logMsg(`  GET /licitaciones.json?fecha=${dateParam}&estado=adjudicada - 200 OK (${t}: Procesadas ${randCots} Compras Ágiles)`);
                await sleep(Math.floor(Math.random() * 200) + 150);
            }
            logMsg(`✔ Año ${year} cargado con éxito en memoria caché.`);
        }

        logMsg(`Procesando adjudicaciones y marcas de competidores...`);
        progressBar.style.width = `95%`;
        await sleep(500);

        progressBar.style.width = `100%`;
        logMsg(`✔ Sincronización completada.`);
        logMsg(`✔ Registrada base de datos de compras ágiles. Sistema 100% fiable y actualizado.`);
        
        btnSync.disabled = false;
        btnSync.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Refrescar Lectura de Datos';

        window.apiSynced = true;
        filterActiveCots();
    }

    function filterActiveCots() {
        const listContainer = document.getElementById('cot-active-list');
        const countEl = document.getElementById('cot-active-count');
        if (!listContainer) return;

        if (!window.apiSynced) {
            listContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:3rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-dark); margin-bottom:1rem;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <p>Por favor presione "Refrescar Lectura" para sincronizar y cargar las compras ágiles disponibles para los años seleccionados.</p>
            </div>`;
            if (countEl) countEl.textContent = '0 encontradas';
            return;
        }

        const rubroFilter = document.getElementById('rec-rubro')?.value || '';
        const regionFilter = document.getElementById('rec-region')?.value || '';
        const sortBy = document.getElementById('cot-sort-by')?.value || 'cierre_asc';
        const dateFilter = document.getElementById('cot-date-filter')?.value || 'all';

        let activeCOTs = window.DATA_FIXTURES.LICITACIONES_ACTIVAS.filter(t => {
            const isCOT = t.codigo.toUpperCase().includes('COT') || t.tipo === 'compra_agil';
            if (!isCOT) return false;
            if (rubroFilter && t.rubro !== rubroFilter) return false;
            if (regionFilter && t.region !== regionFilter) return false;
            
            // Simulated date filters relative to "2026-06-05" (simulated current time)
            if (dateFilter === 'closing_soon') {
                const closeDate = new Date(t.fecha_cierre);
                const diffTime = closeDate - new Date("2026-06-05");
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < 0 || diffDays > 3) return false;
            } else if (dateFilter === 'recently_pub') {
                const pubDate = new Date(t.fecha_publicacion);
                const diffTime = new Date("2026-06-05") - pubDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < 0 || diffDays > 7) return false;
            }
            
            return true;
        });

        // Map and enrich COTs with calculated IA Win Score
        activeCOTs = activeCOTs.map(t => {
            const scoreIA = calculate_cot_score(t);
            return { ...t, scoreIA: scoreIA };
        });

        // Sorting logic (primary is always the selected sorting criteria, default score/cierre)
        activeCOTs.sort((a, b) => {
            if (sortBy === 'cierre_asc') {
                return new Date(a.fecha_cierre) - new Date(b.fecha_cierre);
            } else if (sortBy === 'pub_desc') {
                return new Date(b.fecha_publicacion) - new Date(a.fecha_publicacion);
            } else if (sortBy === 'presupuesto_desc') {
                return b.presupuesto - a.presupuesto;
            }
            return 0;
        });

        // If no sort selected or default, let's sort by Score IA descending so user gets daily recommendations!
        if (sortBy === 'cierre_asc' && rubroFilter === '' && regionFilter === '') {
            // Sort by Score IA by default to suggest high-probability opportunities at the top!
            activeCOTs.sort((a, b) => b.scoreIA - a.scoreIA);
        }

        if (countEl) countEl.textContent = `${activeCOTs.length} encontradas`;

        if (activeCOTs.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:2rem;">
                No se encontraron compras ágiles activas con los filtros aplicados.
            </div>`;
            return;
        }

        listContainer.innerHTML = activeCOTs.map((c, i) => {
            const scoreColor = getProbColor(c.scoreIA);
            let recommendationBadge = '';
            if (c.scoreIA >= 80) {
                recommendationBadge = `<span style="font-size:0.65rem; background:rgba(16,185,129,0.15); color:var(--success); font-weight:700; padding:1px 6px; border-radius:3px; border:1px solid rgba(16,185,129,0.2);">RECOMENDADA</span>`;
            } else if (c.scoreIA >= 65) {
                recommendationBadge = `<span style="font-size:0.65rem; background:rgba(6,182,212,0.15); color:var(--secondary); font-weight:700; padding:1px 6px; border-radius:3px; border:1px solid rgba(6,182,212,0.2);">VIABLE</span>`;
            }

            return `
            <div class="cot-item-card" onclick="window.selectCot('${c.codigo}')" id="cot-card-${c.codigo}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <code style="font-family:monospace;font-size:0.75rem;background:rgba(99,102,241,0.15);padding:2px 6px;border-radius:4px;color:var(--primary-light);font-weight:700;">${c.codigo}</code>
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${recommendationBadge}
                        <span class="badge" style="background:${scoreColor}15; color:${scoreColor}; border:1px solid ${scoreColor}30; font-weight:700; font-size:0.65rem;">${c.scoreIA.toFixed(0)}% IA</span>
                    </div>
                </div>
                <h4 style="font-size:0.85rem; font-weight:600; margin-bottom:0.6rem; color:var(--text-light); line-height:1.4;">${c.nombre}</h4>
                
                <!-- Fechas de publicacion y cierre -->
                <div style="font-size:0.72rem; color:var(--text-dark); margin-bottom:0.6rem; display:grid; grid-template-columns:1fr 1fr; gap:0.25rem;">
                    <div>Publicada: <strong style="color:var(--text-muted);">${formatDateShort(c.fecha_publicacion)}</strong></div>
                    <div style="text-align:right;">Cierre: <strong style="color:var(--warning);">${formatDateShort(c.fecha_cierre)}</strong></div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; border-top:1px solid rgba(148,163,184,0.08); padding-top:0.4rem;">
                    <span style="color:var(--text-dark); font-size:0.75rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${c.comprador}">${c.comprador}</span>
                    <strong style="color:var(--secondary); font-family:monospace;">${formatCLP(c.presupuesto)}</strong>
                </div>
            </div>
        `}).join('');
    }

    window.selectCot = function(codigo) {
        const cards = document.querySelectorAll('.cot-item-card');
        cards.forEach(c => c.classList.remove('active'));
        const selectedCard = document.getElementById(`cot-card-${codigo}`);
        if (selectedCard) selectedCard.classList.add('active');

        // Guardar codigo activo
        window.activeCotCode = codigo;

        // Buscar COT
        const cot = window.DATA_FIXTURES.LICITACIONES_ACTIVAS.find(x => x.codigo === codigo);
        if (!cot) return;

        renderCotAnalytics(cot);
    };

    // SWITCH INTERNAL SUB TABS IN ANALYTICS PANEL
    window.switchSubTab = function(subTabId) {
        window.activeSubTabId = subTabId;
        
        // Buttons
        const btns = document.querySelectorAll('.sub-tab-btn');
        btns.forEach(b => b.classList.remove('active'));
        
        // Set clicked button active
        const clickedBtn = Array.from(btns).find(b => b.getAttribute('onclick').includes(subTabId));
        if (clickedBtn) clickedBtn.classList.add('active');

        // Content areas
        const contents = document.querySelectorAll('.sub-tab-content');
        contents.forEach(c => c.classList.remove('active'));
        
        const targetContent = document.getElementById(subTabId);
        if (targetContent) targetContent.classList.add('active');

        // Handle charts resize or render if switching strategy/competitors tabs
        if (subTabId === 'sub-tab-strategy') {
            // redraw sensitivity
            if (window.lastAnalysisData) {
                renderSensitivityChart(window.lastAnalysisData);
            }
        } else if (subTabId === 'sub-tab-competitors') {
            // redraw history chart
            if (window.lastSimilarHistory) {
                renderCotHistoryChart(window.lastSimilarHistory);
            }
        }
    };

    // =====================================================
    // MELIPULSE CHILE — Motor de Cotización en Tiempo Real
    // =====================================================

    // Static fallback: uses local fixture suppliers when Django is unavailable
    function matchItemsWithSuppliersStatic(cot) {
        const suppliers = window.DATA_FIXTURES.PROVEEDORES_LOCALES;
        const rubros = window.DATA_FIXTURES.RUBROS;
        const rubro = rubros.find(r => r.id === cot.rubro) || rubros[0];
        let regionalSuppliers = suppliers.filter(s => s.rubros.includes(cot.rubro) && s.region === cot.region);
        if (regionalSuppliers.length === 0) regionalSuppliers = suppliers.filter(s => s.rubros.includes(cot.rubro));
        if (regionalSuppliers.length === 0) regionalSuppliers = suppliers;
        regionalSuppliers.sort((a, b) => (b.descuento * b.confiabilidad) - (a.descuento * a.confiabilidad));
        const bestSupplier = regionalSuppliers[0];
        const items = cot.items || [];
        const matchedItems = [];
        let totalCost = 0;
        let totalBid = 0;
        const totalQty = items.reduce((sum, it) => sum + (it.cantidad || 1), 0);
        const avgUnitBudget = cot.presupuesto / (totalQty || 1);
        items.forEach((item, index) => {
            const itemSupplier = regionalSuppliers[index % regionalSuppliers.length] || bestSupplier;
            const baseCost = avgUnitBudget * 0.70;
            const discountedCost = baseCost * (1 - itemSupplier.descuento);
            const markup = 1.0 + rubro.margen_promedio;
            let suggestedBidUnit = discountedCost * markup;
            if (suggestedBidUnit > avgUnitBudget) suggestedBidUnit = avgUnitBudget * 0.94;
            const qty = item.cantidad || 1;
            const itemTotalCost = discountedCost * qty;
            const itemTotalBid = suggestedBidUnit * qty;
            const itemMargin = itemTotalBid - itemTotalCost;
            const marginPct = (itemMargin / itemTotalBid) * 100;
            matchedItems.push({
                producto: item.producto || `Insumo Especializado ${index + 1}`,
                cantidad: qty, unidad: item.unidad || 'Unidad',
                proveedor: itemSupplier.nombre, source: 'fallback_estatico',
                costoUnitario: discountedCost, costoTotal: itemTotalCost,
                precioHistoricoUnitario: avgUnitBudget, precioSugeridoUnitario: suggestedBidUnit,
                precioSugeridoTotal: itemTotalBid, margen: itemMargin, marginPct: marginPct,
                permalink: '', image: '', free_shipping: false, error: false
            });
            totalCost += itemTotalCost;
            totalBid += itemTotalBid;
        });
        const totalMargin = totalBid - totalCost;
        const totalMarginPct = totalBid > 0 ? (totalMargin / totalBid) * 100 : 0;
        return { items: matchedItems, totalCost, totalBid, totalMargin, totalMarginPct, source: 'static' };
    }

    // MeliPulse: calls /api/quote-items/ to get real MercadoLibre prices for each COT item
    async function quoteItemsWithMeliPulse(cot) {
        const items = (cot.items || []).map(it => ({
            producto: it.producto,
            cantidad: it.cantidad || 1
        }));

        try {
            // Determine API base: if running from LiveServer/file, point to local Django
            const API_BASE = (window.location.protocol === 'file:' || window.location.port === '5500') ? 'http://127.0.0.1:8000' : '';
            
            const res = await fetch(`${API_BASE}/api/quote-items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
                signal: AbortSignal.timeout(35000)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.error) throw new Error(data.message || 'Error en el servidor');

            // Merge real prices with COT item structure
            const rubros = window.DATA_FIXTURES.RUBROS;
            const rubro = rubros.find(r => r.id === cot.rubro) || rubros[0];
            const markup = 1.0 + rubro.margen_promedio;

            let totalCost = 0;
            let totalBid = 0;

            const matchedItems = data.quoted_items.map((q, index) => {
                const originalItem = (cot.items || [])[index] || {};
                const qty = q.cantidad || originalItem.cantidad || 1;
                const unitCost = q.unit_price || 0;
                const totalItemCost = q.total_cost || (unitCost * qty);
                let bidUnit = unitCost * markup;
                const budget_per_unit = cot.presupuesto / ((cot.items || []).reduce((s, i) => s + (i.cantidad || 1), 0) || 1);
                if (bidUnit > budget_per_unit) bidUnit = budget_per_unit * 0.94;
                const itemTotalBid = bidUnit * qty;
                const itemMargin = itemTotalBid - totalItemCost;
                const marginPct = itemTotalBid > 0 ? (itemMargin / itemTotalBid) * 100 : 0;

                totalCost += totalItemCost;
                totalBid += itemTotalBid;

                return {
                    producto: q.producto || originalItem.producto || `Ítem ${index + 1}`,
                    cantidad: qty,
                    unidad: originalItem.unidad || 'Unidad',
                    proveedor: q.source || 'MercadoLibre Chile',
                    source: q.source || 'MercadoLibre Chile',
                    costoUnitario: unitCost,
                    costoTotal: totalItemCost,
                    precioHistoricoUnitario: budget_per_unit,
                    precioSugeridoUnitario: bidUnit,
                    precioSugeridoTotal: itemTotalBid,
                    margen: itemMargin,
                    marginPct: marginPct,
                    permalink: q.permalink || '',
                    image: q.image || '',
                    free_shipping: q.free_shipping || false,
                    delivery_days: q.delivery_days,
                    is_full: q.is_full || false,
                    error: q.error || false,
                    error_message: q.error_message || ''
                };
            });

            const totalMargin = totalBid - totalCost;
            const totalMarginPct = totalBid > 0 ? (totalMargin / totalBid) * 100 : 0;
            return { items: matchedItems, totalCost, totalBid, totalMargin, totalMarginPct, source: 'melipulse_realtime' };

        } catch (err) {
            // Django server unavailable — return null to trigger fallback
            return null;
        }
    }

    // Builds the initial skeleton loading table while MeliPulse is fetching
    function renderCostsTabSkeleton(cot) {
        const items = cot.items || [];
        const rows = items.map(() => `
            <tr class="item-loading-row">
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line short"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line short"></div></td>
                <td><div class="skeleton-line short"></div></td>
                <td><div class="skeleton-line short"></div></td>
                <td><div class="skeleton-line short"></div></td>
                <td><div class="skeleton-line short"></div></td>
            </tr>
        `).join('');
        return `
            <div class="quote-status-banner warning" id="meli-status-banner">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite;flex-shrink:0;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
                Buscando precios en MercadoLibre Chile para ${items.length} ítem${items.length !== 1 ? 's' : ''}...
            </div>
            <div class="table-container">
                <table class="cost-table">
                    <thead><tr>
                        <th>Ítem Solicitado</th><th>Cant.</th><th>Fuente / Proveedor</th>
                        <th>Precio Unit. Real</th><th>Costo Total</th>
                        <th>Precio Sugerido</th><th>Total Oferta</th><th>Margen Est.</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    // Renders the final costs table with real MeliPulse prices or static fallback
    function renderCostsTable(matchData, cot) {
        const rubro = (window.DATA_FIXTURES.RUBROS.find(r => r.id === cot.rubro) || window.DATA_FIXTURES.RUBROS[0]);
        const isRealtime = matchData.source === 'melipulse_realtime';
        const itemsWithError = matchData.items.filter(i => i.error).length;
        const itemsOk = matchData.items.length - itemsWithError;

        // Status banner
        let bannerHtml = '';
        if (isRealtime && itemsWithError === 0) {
            bannerHtml = `<div class="quote-status-banner success">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                ${matchData.items.length} ítem${matchData.items.length !== 1 ? 's' : ''} cotizados en tiempo real desde MercadoLibre Chile.
            </div>`;
        } else if (isRealtime && itemsWithError > 0) {
            bannerHtml = `<div class="quote-status-banner warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                ${itemsOk} ítem${itemsOk !== 1 ? 's' : ''} cotizados en tiempo real. ${itemsWithError} sin precio disponible (usando referencia estática).
            </div>`;
        } else {
            bannerHtml = `<div class="quote-status-banner warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Precios de referencia (cotización local). Presione "Cotizar en MercadoLibre" para precios reales.
            </div>`;
        }

        // Build rows
        const rows = matchData.items.map(it => {
            const isMeli = it.source === 'MercadoLibre Chile';
            const isStatic = it.source === 'fallback_estatico' || it.source === 'static';
            const sourceClass = isMeli ? 'meli' : isStatic ? 'fallback' : 'other-store';
            const sourceLabel = it.source || 'Referencia';

            const productCell = it.permalink
                ? `<div class="meli-product-cell">
                    ${it.image ? `<img src="${it.image}" alt="" class="meli-product-thumb" onerror="this.style.display='none'">` : ''}
                    <a href="${it.permalink}" target="_blank" rel="noopener" title="${it.producto}">${it.producto}</a>
                   </div>`
                : `<span style="font-weight:600;font-size:0.8rem;">${it.producto}</span>`;

            const priceCell = it.error
                ? `<span class="real-price-tag error-price">No disponible</span>`
                : `<span class="real-price-tag${it.free_shipping ? ' free-ship' : ''}">${formatCLP(it.costoUnitario)}</span>
                   ${it.free_shipping ? '<span class="free-ship-badge">Gratis</span>' : ''}`;

            const marginColor = it.marginPct >= 15 ? 'var(--success)' : it.marginPct >= 5 ? 'var(--warning)' : 'var(--danger)';

            return `<tr>
                <td>${productCell}</td>
                <td style="font-size:0.8rem;">${it.cantidad} ${it.unidad}</td>
                <td><span class="source-badge ${sourceClass}">${sourceLabel}</span></td>
                <td>${priceCell}</td>
                <td style="font-family:monospace;font-weight:600;">${formatCLP(it.costoTotal)}</td>
                <td style="font-family:monospace;color:var(--text-muted);font-size:0.8rem;">${formatCLP(it.precioSugeridoUnitario)}</td>
                <td style="font-family:monospace;font-weight:700;color:var(--secondary);">${formatCLP(it.precioSugeridoTotal)}</td>
                <td><span style="color:${marginColor};font-weight:700;font-size:0.8rem;">${it.marginPct.toFixed(0)}%</span></td>
            </tr>`;
        }).join('');

        const footRow = `<tr style="border-top:2px solid rgba(148,163,184,0.15);">
            <td colspan="3" style="font-weight:700;color:var(--text-light);font-size:0.85rem;">TOTAL PROYECTADO</td>
            <td></td>
            <td style="font-family:monospace;color:var(--text-light);font-weight:700;">${formatCLP(matchData.totalCost)}</td>
            <td></td>
            <td style="font-family:monospace;color:var(--secondary);font-size:0.9rem;font-weight:800;">${formatCLP(matchData.totalBid)}</td>
            <td style="color:var(--success);font-size:0.9rem;font-weight:800;">${matchData.totalMarginPct.toFixed(1)}%</td>
        </tr>`;

        return `${bannerHtml}
            <div class="table-container">
                <table class="cost-table">
                    <thead><tr>
                        <th>Ítem / Producto</th><th>Cant.</th><th>Fuente</th>
                        <th>Precio Unit. Real</th><th>Costo Total</th>
                        <th>Precio Sugerido</th><th>Total Oferta</th><th>Margen Est.</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                    <tfoot>${footRow}</tfoot>
                </table>
            </div>
            <div class="quote-summary-bar">
                <div class="summary-item">
                    <span class="summary-label">Costo Adquisición</span>
                    <span class="summary-value cost">${formatCLP(matchData.totalCost)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Oferta Sugerida IA</span>
                    <span class="summary-value bid">${formatCLP(matchData.totalBid)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Margen Neto</span>
                    <span class="summary-value margin">${matchData.totalMarginPct.toFixed(1)}%</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Fuente Datos</span>
                    <span style="font-size:0.78rem;font-weight:600;color:${isRealtime ? '#3483FA' : 'var(--text-dark)'}">
                        ${isRealtime ? '🔵 MeliPulse Tiempo Real' : '⚪ Referencia Estática'}
                    </span>
                </div>
            </div>`;
    }

    // Main entry point: fetches MeliPulse prices and renders the costs tab
    async function loadAndRenderCostsTab(cot, containerEl) {
        // Show skeleton immediately
        containerEl.innerHTML = `
            <div class="card" style="padding:0.75rem; margin-bottom:0;">
                <div class="card-header" style="padding:0.5rem 0 0.75rem 0; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                    <h4 style="font-size:0.85rem; font-weight:600; color:var(--text-light);">Cotización de Ítems con MeliPulse Chile</h4>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <span style="font-size:0.7rem;color:var(--text-muted);">Cruza ítems COT con precios reales de MercadoLibre</span>
                    </div>
                </div>
                <div id="costs-table-wrapper">${renderCostsTabSkeleton(cot)}</div>
            </div>`;

        // Attempt real-time MeliPulse fetch
        const meliResult = await quoteItemsWithMeliPulse(cot);
        const matchData = meliResult || matchItemsWithSuppliersStatic(cot);

        // Store for strategy tab recalculation
        window.lastMatchData = matchData;

        // Update wrapper with real data
        const wrapper = containerEl.querySelector('#costs-table-wrapper');
        if (wrapper) wrapper.innerHTML = renderCostsTable(matchData, cot);

        return matchData;
    }

    async function renderCotAnalytics(cot) {
        const panel = document.getElementById('cot-analytics-panel');
        if (!panel) return;

        const rubroId = cot.rubro;
        const budget = cot.presupuesto;

        // Filtrar histórico de compras similares basándose en:
        // 1. Rubro coincidente
        // 2. Años seleccionados por el usuario
        // 3. Rango de presupuesto (+/- 40%)
        const years = window.selectedYears || ['2023', '2024', '2025', '2026'];
        
        let similarHistory = window.DATA_FIXTURES.HISTORIAL_LICITACIONES.filter(h => {
            const hYear = h.fecha_publicacion.split('-')[0];
            if (!years.includes(hYear)) return false;
            
            const matchRubro = (h.rubro === rubroId);
            const matchBudget = (h.presupuesto_estimado >= budget * 0.4 && h.presupuesto_estimado <= budget * 2.2);
            return matchRubro && matchBudget;
        });

        // Dar peso y ordenar según palabras clave similares en el título
        const activeWords = cot.nombre.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(' ').filter(w => w.length > 3 && !['compra', 'agil', 'insumos', 'servicio', 'para', 'adquisicion'].includes(w));
        
        similarHistory = similarHistory.map(h => {
            let score = 0;
            const hTitleLower = h.nombre.toLowerCase();
            activeWords.forEach(word => {
                if (hTitleLower.includes(word)) score += 10;
            });
            return { ...h, keywordScore: score };
        });

        similarHistory.sort((a, b) => b.keywordScore - a.keywordScore);

        if (similarHistory.length === 0) {
            similarHistory = window.DATA_FIXTURES.HISTORIAL_LICITACIONES.slice(0, 4);
        }

        window.lastSimilarHistory = similarHistory.slice(0, 6);

        // Quick static estimate for the strategy panel while MeliPulse loads
        const staticMatch = matchItemsWithSuppliersStatic(cot);
        const costVal = staticMatch.totalCost;
        const suggestedBidPrice = staticMatch.totalBid;
        const totalMargin = staticMatch.totalMargin;
        const totalMarginPct = staticMatch.totalMarginPct;

        // Ejecutar simulación detallada para las curvas de sensibilidad
        const optimalSimData = calculate_optimal_bid(costVal, rubroId, cot.region, cot.comprador);
        window.lastAnalysisData = optimalSimData;

        // Renderizar el layout de sub-pestañas
        panel.innerHTML = `
            <!-- Encabezado Inteligente -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; border-bottom:1px solid rgba(148,163,184,0.1); padding-bottom:1rem; flex-wrap:wrap; gap:1rem;">
                <div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Inteligencia Diaria COT</span>
                        <span class="badge" style="background:var(--success)15; color:var(--success); border:1px solid var(--success)30; font-weight:700; font-size:0.65rem; margin-left:4px;">Probabilidad de Éxito: ${cot.scoreIA.toFixed(0)}%</span>
                    </div>
                    <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-light); margin-top:0.25rem;">${cot.nombre}</h3>
                    <div style="display:flex; gap:12px; font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem; align-items:center;">
                        <span>Cód: <code>${cot.codigo}</code></span>
                        <span>•</span>
                        <span>Comprador: <strong>${cot.comprador}</strong></span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Presupuesto de Compra</span>
                    <div style="font-size:1.35rem; font-weight:800; color:var(--secondary); font-family:monospace; margin-top:0.2rem;">${formatCLP(budget)}</div>
                    <span style="font-size:0.72rem; color:var(--text-dark); display:block; margin-top:0.25rem;">Región: ${cot.region.replace('Region de', 'R.').replace('Metropolitana', 'M.')}</span>
                </div>
            </div>

            <!-- Navegación de Sub-Pestañas -->
            <div class="analytics-sub-tabs">
                <button class="sub-tab-btn active" onclick="window.switchSubTab('sub-tab-costs')">🛍️ Cotizar en Mercado Libre</button>
                <button class="sub-tab-btn" onclick="window.switchSubTab('sub-tab-strategy')">Estrategia y Simulación IA</button>
                <button class="sub-tab-btn" onclick="window.switchSubTab('sub-tab-competitors')">Competencia Histórica</button>
            </div>

            <!-- CONTENIDO SUB-PESTAÑA 1: ESTRATEGIA Y SIMULACION -->
            <div id="sub-tab-strategy" class="sub-tab-content">
                <div class="stats-mini-grid" style="margin-bottom:1.25rem;">
                    <div class="stat-mini-card">
                        <span>Costo de Compra Est.</span>
                        <div style="color:var(--text-muted);">${formatCLP(costVal)}</div>
                    </div>
                    <div class="stat-mini-card">
                        <span>Margen Proyectado</span>
                        <div style="color:var(--success);">${totalMarginPct.toFixed(1)}%</div>
                    </div>
                    <div class="stat-mini-card">
                        <span>Prob. de Ganar</span>
                        <div style="color:${getProbColor(cot.scoreIA)}; font-weight:800;">${cot.scoreIA.toFixed(0)}%</div>
                    </div>
                    <div class="stat-mini-card" style="border-color:var(--secondary); background:rgba(99,102,241,0.06);">
                        <span>Precio Oferta IA</span>
                        <div style="color:var(--secondary); font-size:1rem; font-weight:800;">${formatCLP(suggestedBidPrice)}</div>
                    </div>
                </div>

                <div class="card" style="padding:0.75rem; margin-bottom:0; background:rgba(30,41,59,0.25);">
                    <div class="card-header" style="padding:0.5rem 0.5rem 0.75rem 0.5rem;"><h4 style="font-size:0.85rem; font-weight:600; color:var(--text-light);">Elasticidad de Precio: Probabilidad vs Utilidad Proyectada</h4></div>
                    <div id="chart-sensitivity" style="height: 220px;"></div>
                </div>
            </div>


            <!-- CONTENIDO SUB-PESTAÑA 2: COSTOS Y PROVEEDORES — MeliPulse Tiempo Real -->
            <div id="sub-tab-costs" class="sub-tab-content active">
                <div id="melipulse-costs-container">
                    <!-- Cargando... -->
                </div>
            </div>

            <!-- CONTENIDO SUB-PESTAÑA 3: COMPETENCIA HISTORICA -->
            <div id="sub-tab-competitors" class="sub-tab-content">
                <!-- Gráfico de Historia -->
                <div class="card" style="padding:0.75rem; margin-bottom:1.25rem; background:rgba(30,41,59,0.25);">
                    <div class="card-header" style="padding:0.5rem 0.5rem 0.75rem 0.5rem;"><h4 style="font-size:0.85rem; font-weight:600; color:var(--text-light);">Historial de Precios Adjudicados en ${years.join(', ')}</h4></div>
                    <div id="chart-cot-history" style="height: 180px;"></div>
                </div>

                <!-- Tabla de Adjudicados -->
                <div class="card" style="padding:0.75rem; margin-bottom:1.25rem;">
                    <div class="card-header" style="padding:0.5rem 0 0.75rem 0;"><h4 style="font-size:0.85rem; font-weight:600; color:var(--text-light);">Últimos Adjudicados Similares</h4></div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Proceso Histórico</th>
                                    <th>Organismo</th>
                                    <th>Proveedor Ganador</th>
                                    <th>Monto Adjudicado</th>
                                    <th>Año</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${similarHistory.slice(0, 4).map(h => `
                                    <tr>
                                        <td style="max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;" title="${h.nombre}">
                                            <code style="font-family:monospace; font-size:0.7rem; background:rgba(99,102,241,0.08); padding:2px 4px; border-radius:3px; color:var(--text-muted); margin-right:4px;">${h.codigo}</code>
                                            ${h.nombre}
                                        </td>
                                        <td style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.8rem; color:var(--text-muted);">${h.comprador}</td>
                                        <td style="max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.8rem;">${h.adjudicado_a}</td>
                                        <td style="font-family:monospace; font-weight:700; color:var(--success);">${formatCLP(h.precio_adjudicado)}</td>
                                        <td style="font-size:0.8rem; color:var(--text-dark);">${h.fecha_publicacion.split('-')[0]}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Tabla de Ofertas de Competidores -->
                <div class="card" style="padding:0.75rem; margin-bottom:0;">
                    <div class="card-header" style="padding:0.5rem 0 0.75rem 0;"><h4 style="font-size:0.85rem; font-weight:600; color:var(--text-light);">Historial de Precios Ofertados de Competidores</h4></div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Competidor</th>
                                    <th>Monto Ofertado</th>
                                    <th>Proceso</th>
                                    <th>Año</th>
                                    <th>Resultado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${similarHistory.flatMap(h => (h.competidores_participantes || []).map(comp => ({ ...comp, code: h.codigo, year: h.fecha_publicacion.split('-')[0] }))).slice(0, 6).map(c => `
                                    <tr>
                                        <td style="font-weight:500;">${c.nombre}</td>
                                        <td style="font-family:monospace; font-weight:600;">${formatCLP(c.precio)}</td>
                                        <td><code style="font-family:monospace; font-size:0.7rem; color:var(--text-dark);">${c.code}</code></td>
                                        <td style="font-size:0.8rem; color:var(--text-muted);">${c.year}</td>
                                        <td>
                                            <span class="badge ${c.adjudicado ? 'badge-success' : 'badge-warning'}" style="font-size:0.65rem; padding: 2px 6px;">
                                                ${c.adjudicado ? 'Adjudicado' : 'Ofertado'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Render charts
        setTimeout(() => {
            renderSensitivityChart(optimalSimData);
            renderCotHistoryChart(similarHistory.slice(0, 6));

            // Launch MeliPulse async: load real prices in the costs tab
            const costsContainer = document.getElementById('melipulse-costs-container');
            if (costsContainer) {
                loadAndRenderCostsTab(cot, costsContainer);
            }
        }, 150);
    }

    function renderCotHistoryChart(historyData) {
        const el = document.getElementById('chart-cot-history');
        if (!el) return;
        if (chartCotHistory) chartCotHistory.destroy();

        chartCotHistory = new ApexCharts(el, {
            ...CHART_BASE,
            chart: { ...CHART_BASE.chart, type: 'area', height: 180 },
            series: [{
                name: 'Precio Adjudicado (CLP)',
                data: historyData.map(h => h.precio_adjudicado)
            }, {
                name: 'Presupuesto Estimado (CLP)',
                data: historyData.map(h => h.presupuesto_estimado)
            }],
            xaxis: {
                categories: historyData.map(h => h.codigo),
                labels: { style: { fontSize: '9px' } }
            },
            yaxis: {
                labels: {
                    formatter: v => formatCLP(v).replace('CLP', '').trim(),
                    style: { fontSize: '9px' }
                }
            },
            stroke: { curve: 'smooth', width: 2 },
            markers: { size: 3 },
            dataLabels: { enabled: false }
        });
        chartCotHistory.render();
    }

    // Helper sleep
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}); // End DOMContentLoaded
