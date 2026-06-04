document.addEventListener('DOMContentLoaded', () => {
    let activeTabId = 'tab-dashboard';
    let rubrosData = [];
    let recDebounceTimer = null;

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
            recentTendersBody.innerHTML = recentTenders.map(t => `
                <tr>
                    <td><code style="font-family:monospace;font-size:0.75rem;background:rgba(99,102,241,0.1);padding:2px 6px;border-radius:4px;color:var(--primary-light);">${t.codigo}</code></td>
                    <td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${t.nombre}">${t.nombre}</td>
                    <td>${t.rubro_nombre}</td>
                    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.comprador}</td>
                    <td style="font-size:0.8rem;color:var(--text-muted);">${formatDateShort(t.fecha_publicacion)}</td>
                    <td style="font-size:0.8rem;color:var(--warning);">${formatDateShort(t.fecha_cierre)}</td>
                    <td style="font-family:monospace;">${formatCLP(t.presupuesto_estimado)}</td>
                    <td style="color:var(--text-muted);font-size:0.85rem;">${t.adjudicado_a}</td>
                    <td style="font-family:monospace;font-weight:600;color:var(--success);">${formatCLP(t.precio_adjudicado)}</td>
                </tr>
            `).join('');
        }
    }

    function populateCompradoresDropdown(region) {
        const simComprador = document.getElementById('sim-comprador');
        if (!simComprador) return;
        const compradores = window.DATA_FIXTURES.COMPRADORES.filter(c => !region || c.region === region);
        simComprador.innerHTML = '<option value="">-- Todos los compradores --</option>' + 
            compradores.map(c => `<option value="${c.nombre}">${c.nombre} (${c.ciudad})</option>`).join('');
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

    let chartRubrosOverview = null, chartMarketShare = null, chartRadar = null, chartSensitivity = null;

    // ---- DUAL-MODE API CLIENT WRAPPER ----
    async function safeFetch(url, localFallbackFunc) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                return await res.json();
            }
            console.warn(`Fetch to ${url} returned status ${res.status}. Falling back to client-side logic.`);
        } catch (err) {
            console.warn(`Fetch to ${url} failed. Falling back to client-side logic.`);
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
                TipoLicitacion: t.tipo === 'compra_agil' ? 'Compra Agil' : 'Licitacion Publica',
                Estado: 'Publicada',
                ValorEstimado: t.presupuesto || t.presupuesto_estimado,
                Comprador: { NombreOrganismo: t.comprador, Region: t.region, MailContacto: 'contacto@organismo.cl' },
                FechaPublicacion: t.fecha_publicacion,
                FechaCierre: t.fecha_cierre,
                FechaEstimadaAdjudicacion: t.fecha_estimada_adjudicacion || '2026-07-10T12:00:00Z',
                Descripcion: 'Servicios y suministros generales adjudicados conforme a bases tecnicas de la institucion.',
                Items: { Listado: t.items || [{ Producto: t.rubro_nombre, Cantidad: 1, UnidadMedida: 'Servicio' }] }
            }] };
        }

        if (codigo.toUpperCase().includes('COT')) {
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
        return { Listado: [] };
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
            const json = await safeFetch(url, () => {
                return { recommendations: recommend_tenders(budget, rubroId, region) };
            });
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
            if (avgProbEl) avgProbEl.textContent = '-';
            if (bestNameEl) bestNameEl.textContent = '-';
            if (bestOfferEl) bestOfferEl.textContent = '-';
        }

        if (!tbody) return;
        if (!recs.length) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:2rem;">No se encontraron licitaciones recomendadas en este rango de presupuesto.</td></tr>`;
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
                <td><span class="badge" style="background:${probColor}22;color:${probColor};border:1px solid ${probColor}44;font-weight:700;">${r.win_probability.toFixed(1)}%</span></td>
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
            const json = await safeFetch(`/api/tenders/${encodeURIComponent(code)}/`, () => {
                return fetch_tender_detail(code);
            });
            renderApiResults(json.Listado || [], json);
        } catch (err) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--danger);">Error al buscar. Verifica la conexion.</td></tr>`;
        }
    }

    async function fetchTodayTenders() {
        const tbody = document.getElementById('api-results-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);">Cargando licitaciones de hoy...</td></tr>`;
        try {
            const json = await safeFetch('/api/tenders/', () => {
                return { Listado: window.DATA_FIXTURES.LICITACIONES_ACTIVAS };
            });
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
            const code = item.CodigoExterno || item.codigo || 'N/D';
            const isCOT = code.toUpperCase().includes('COT') || item.tipo === 'compra_agil';
            const tipoBadge = isCOT
                ? `<span class="badge badge-success" style="font-size:0.65rem;">Compra Agil</span>`
                : `<span class="badge badge-info" style="font-size:0.65rem;">Licitacion</span>`;
            const name = item.Nombre || item.nombre || 'Sin nombre';
            const comprador = item.Comprador?.NombreOrganismo || item.comprador || 'N/D';
            const region = item.Comprador?.Region || item.region || 'N/D';
            const pubDate = formatDateShort(item.FechaPublicacion || item.fecha_publicacion);
            const closeDate = formatDateShort(item.FechaCierre || item.fecha_cierre);
            const monto = formatCLP(item.ValorEstimado || item.presupuesto || 0);
            const estado = item.Estado || item.estado || 'Publicada';
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
            const json = await safeFetch(`/api/tenders/${encodeURIComponent(codigo)}/`, () => {
                return fetch_tender_detail(codigo);
            });
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
        if (simRegion) {
            simRegion.addEventListener('change', async () => {
                const region = simRegion.value;
                populateCompradoresDropdown(region);
            });
        }
    }

}); // End DOMContentLoaded
