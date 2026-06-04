/**
 * Portal Cobre Chile - Dashboard Script
 */

// Fallback USD rate if API fails
const FALLBACK_USD_RATE = 894.29;

// State management
let state = {
    copperData: [], // Format: { fecha: string, valor: number, dateObj: Date }
    usdRate: FALLBACK_USD_RATE,
    activeRange: '30d',
    chart: null,
    currentPage: 1,
    pageSize: 10,
    apiStatus: 'connecting' // 'online', 'offline'
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

/**
 * Initialize Application
 */
async function initApp() {
    setupTheme();
    setupEventListeners();
    await loadData();
    updateDashboard();
}

/**
 * Setup Theme Toggler
 */
function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const body = document.body;

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        
        // Update chart theme if initialized
        if (state.chart) {
            state.chart.updateOptions({
                theme: {
                    mode: newTheme
                },
                grid: {
                    borderColor: newTheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
                }
            });
        }
    });
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('theme-icon');
    if (theme === 'light') {
        // Moon icon for light mode (to switch to dark)
        themeIcon.innerHTML = `
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
    } else {
        // Sun icon for dark mode (to switch to light)
        themeIcon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
    }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Range Filters
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            state.activeRange = e.target.getAttribute('data-range');
            state.currentPage = 1;
            updateDashboard();
        });
    });

    // Calculator inputs
    const weightInput = document.getElementById('calc-weight');
    const unitSelect = document.getElementById('calc-unit-type');
    
    weightInput.addEventListener('input', calculateValue);
    unitSelect.addEventListener('change', () => {
        const unitLabel = document.getElementById('unit-label');
        unitLabel.textContent = unitSelect.value === 'lb' ? 'Libras' : 'Toneladas';
        calculateValue();
    });

    // Table Pagination
    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            updateTable();
        }
    });

    document.getElementById('next-page-btn').addEventListener('click', () => {
        const filtered = getFilteredData();
        const totalPages = Math.ceil(filtered.length / state.pageSize);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            updateTable();
        }
    });

    // Export CSV
    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);
}

/**
 * Load Data from API or Fallback
 */
async function loadData() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    let apiDolarSucceeded = false;
    let apiCopperSucceeded = false;

    // 1. Fetch Exchange Rate
    try {
        const response = await fetch('https://mindicador.cl/api/dolar');
        if (response.ok) {
            const data = await response.json();
            if (data.serie && data.serie.length > 0) {
                state.usdRate = data.serie[0].valor;
                apiDolarSucceeded = true;
            }
        }
    } catch (e) {
        console.warn('Error al obtener tipo de cambio de la API. Usando valor de respaldo.', e);
    }

    // Update exchange rate info text
    const exchangeTextEl = document.getElementById('exchange-rate-text');
    exchangeTextEl.textContent = `Tasa del dólar: $${state.usdRate.toFixed(2)} CLP (USD Observado)`;

    // 2. Fetch Copper Data
    try {
        const response = await fetch('https://mindicador.cl/api/libra_cobre');
        if (response.ok) {
            const data = await response.json();
            if (data.serie && data.serie.length > 0) {
                // Parse API series
                const apiSeries = data.serie.map(item => ({
                    fecha: item.fecha,
                    valor: item.valor,
                    dateObj: new Date(item.fecha)
                }));

                // Merge with fallback data to have full history
                const fallbackParsed = COPPER_FALLBACK_DATA.map(item => ({
                    fecha: item.fecha,
                    valor: item.valor,
                    dateObj: new Date(item.fecha)
                }));

                // Combine and deduplicate by date (using YYYY-MM-DD key)
                const combinedMap = new Map();
                
                // Add fallback data first
                fallbackParsed.forEach(item => {
                    const dateKey = item.fecha.substring(0, 10);
                    combinedMap.set(dateKey, item);
                });
                
                // Overwrite/add with fresh API data
                apiSeries.forEach(item => {
                    const dateKey = item.fecha.substring(0, 10);
                    combinedMap.set(dateKey, item);
                });

                // Convert map back to sorted array (newest to oldest)
                state.copperData = Array.from(combinedMap.values()).sort((a, b) => b.dateObj - a.dateObj);
                apiCopperSucceeded = true;
            }
        }
    } catch (e) {
        console.warn('Error al obtener valor del cobre de la API. Usando datos históricos locales.', e);
    }

    // 3. Fallback check if API totally failed
    if (!apiCopperSucceeded) {
        state.copperData = COPPER_FALLBACK_DATA.map(item => ({
            fecha: item.fecha,
            valor: item.valor,
            dateObj: new Date(item.fecha)
        })).sort((a, b) => b.dateObj - a.dateObj);
        
        state.apiStatus = 'offline';
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Sin Conexión (Datos locales)';
    } else {
        state.apiStatus = 'online';
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Conectado (API)';
    }
}

/**
 * Filter copperData based on state.activeRange
 */
function getFilteredData() {
    if (state.copperData.length === 0) return [];
    
    const latestDate = state.copperData[0].dateObj;
    
    switch (state.activeRange) {
        case '30d':
            // Simply return the first 30 available trading days
            return state.copperData.slice(0, 30);
        case '2026':
            return state.copperData.filter(item => item.dateObj.getFullYear() === 2026);
        case '2025':
            return state.copperData.filter(item => item.dateObj.getFullYear() === 2025);
        case 'all':
        default:
            return state.copperData;
    }
}

/**
 * Update All Dashboard Components
 */
function updateDashboard() {
    if (state.copperData.length === 0) return;

    updateKPIs();
    updateChart();
    updateTable();
    calculateValue();
}

/**
 * Update Key Performance Indicators (KPI Cards)
 */
function updateKPIs() {
    const latest = state.copperData[0];
    const previous = state.copperData[1] || latest;
    
    // 1. USD Price Card
    const usdPriceEl = document.getElementById('price-usd');
    usdPriceEl.textContent = `$${latest.valor.toFixed(2)}`;

    // Calculate daily variance
    const diff = latest.valor - previous.valor;
    const pctChange = (diff / previous.valor) * 100;
    
    const changeBadge = document.getElementById('price-change-badge');
    const changeIcon = document.getElementById('price-change-icon');
    const changeText = document.getElementById('price-change-text');

    changeText.textContent = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}% (${pctChange >= 0 ? '+' : ''}${diff.toFixed(2)} USD)`;
    
    if (pctChange >= 0) {
        changeBadge.className = 'kpi-badge up';
        changeIcon.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
        `;
    } else {
        changeBadge.className = 'kpi-badge down';
        changeIcon.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;
    }

    // 2. CLP Price Card
    const clpPriceEl = document.getElementById('price-clp');
    const priceCLP = latest.valor * state.usdRate;
    clpPriceEl.textContent = `$${Math.round(priceCLP).toLocaleString('es-CL')}`;

    // 3. High & Low in selected period
    const filtered = getFilteredData();
    if (filtered.length > 0) {
        let maxItem = filtered[0];
        let minItem = filtered[0];
        
        filtered.forEach(item => {
            if (item.valor > maxItem.valor) maxItem = item;
            if (item.valor < minItem.valor) minItem = item;
        });

        // High
        document.getElementById('period-high').textContent = `$${maxItem.valor.toFixed(2)} USD`;
        document.getElementById('period-high-clp').textContent = `CLP $${Math.round(maxItem.valor * state.usdRate).toLocaleString('es-CL')}`;
        document.getElementById('period-high-date').textContent = formatDate(maxItem.dateObj);

        // Low
        document.getElementById('period-low').textContent = `$${minItem.valor.toFixed(2)} USD`;
        document.getElementById('period-low-clp').textContent = `CLP $${Math.round(minItem.valor * state.usdRate).toLocaleString('es-CL')}`;
        document.getElementById('period-low-date').textContent = formatDate(minItem.dateObj);
    }
}

/**
 * Format Date (e.g., "04 Jun, 2026")
 */
function formatDate(date) {
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('es-CL', options);
}

/**
 * Format Date short (e.g., "04/06/2026")
 */
function formatDateShort(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Update or Draw Chart
 */
function updateChart() {
    const filtered = getFilteredData();
    
    // Sort chronological (oldest to newest) for chart
    const chartData = [...filtered].sort((a, b) => a.dateObj - b.dateObj);
    
    const dates = chartData.map(item => formatDateShort(item.dateObj));
    const usdValues = chartData.map(item => parseFloat(item.valor.toFixed(2)));
    const clpValues = chartData.map(item => Math.round(item.valor * state.usdRate));

    const currentTheme = document.body.getAttribute('data-theme') || 'dark';

    const options = {
        series: [{
            name: 'Precio USD/lb',
            data: usdValues
        }, {
            name: 'Equivalente CLP/lb',
            data: clpValues
        }],
        chart: {
            type: 'area',
            height: 350,
            toolbar: {
                show: false
            },
            zoom: {
                enabled: false
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            },
            background: 'transparent',
            fontFamily: 'Inter, sans-serif'
        },
        theme: {
            mode: currentTheme
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth',
            width: [3, 2],
            colors: ['#e06a3b', '#9ca3af']
        },
        colors: ['#e06a3b', '#9ca3af'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: [0.45, 0.1],
                opacityTo: [0.05, 0],
                stops: [0, 90, 100]
            }
        },
        grid: {
            borderColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            strokeDashArray: 4,
            xaxis: {
                lines: {
                    show: false
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            }
        },
        xaxis: {
            categories: dates,
            labels: {
                style: {
                    colors: 'var(--text-secondary)',
                    fontSize: '11px'
                },
                rotate: -30,
                rotateAlways: false,
                hideOverlappingLabels: true
            },
            axisBorder: {
                show: false
            },
            axisTicks: {
                show: false
            }
        },
        yaxis: [{
            title: {
                text: 'USD por Libra (USD/lb)',
                style: {
                    color: '#e06a3b',
                    fontWeight: 600
                }
            },
            labels: {
                style: {
                    colors: '#e06a3b'
                },
                formatter: function (val) {
                    return '$' + val.toFixed(2);
                }
            }
        }, {
            opposite: true,
            title: {
                text: 'CLP por Libra (CLP/lb)',
                style: {
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                }
            },
            labels: {
                style: {
                    colors: 'var(--text-secondary)'
                },
                formatter: function (val) {
                    return '$' + val.toLocaleString('es-CL');
                }
            }
        }],
        tooltip: {
            shared: true,
            intersect: false,
            x: {
                show: true
            },
            y: [{
                formatter: function (val) {
                    return val.toFixed(2) + ' USD';
                }
            }, {
                formatter: function (val) {
                    return '$' + val.toLocaleString('es-CL') + ' CLP';
                }
            }]
        }
    };

    if (state.chart) {
        state.chart.updateOptions(options);
    } else {
        state.chart = new ApexCharts(document.querySelector("#copper-chart"), options);
        state.chart.render();
    }
}

/**
 * Update Historical Data Table
 */
function updateTable() {
    const filtered = getFilteredData();
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';

    const totalPages = Math.ceil(filtered.length / state.pageSize);
    
    // Boundary check
    if (state.currentPage > totalPages) state.currentPage = totalPages || 1;

    // Get slice for active page
    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = startIdx + state.pageSize;
    const pageData = filtered.slice(startIdx, endIdx);

    pageData.forEach((item, idx) => {
        // Find index in main data to calculate variation against the day before it
        const mainIdx = state.copperData.findIndex(d => d.fecha === item.fecha);
        const prevItem = state.copperData[mainIdx + 1];
        
        let pctChangeText = '-';
        let changeClass = '';
        
        if (prevItem) {
            const diff = item.valor - prevItem.valor;
            const pct = (diff / prevItem.valor) * 100;
            pctChangeText = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
            changeClass = pct >= 0 ? 'color: var(--success); font-weight: 500;' : 'color: var(--error); font-weight: 500;';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDateShort(item.dateObj)}</td>
            <td>$${item.valor.toFixed(2)} USD</td>
            <td>$${Math.round(item.valor * state.usdRate).toLocaleString('es-CL')} CLP</td>
            <td style="${changeClass}">${pctChangeText}</td>
        `;
        tableBody.appendChild(row);
    });

    // Update pagination controls
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageIndicator = document.getElementById('page-indicator');

    prevBtn.disabled = state.currentPage === 1;
    nextBtn.disabled = state.currentPage === totalPages || totalPages === 0;
    
    if (filtered.length > 0) {
        pageIndicator.textContent = `Pág. ${state.currentPage} de ${totalPages} (${filtered.length} registros)`;
    } else {
        pageIndicator.textContent = 'Sin registros';
    }
}

/**
 * Calculadora de Valor
 */
function calculateValue() {
    if (state.copperData.length === 0) return;
    
    const latest = state.copperData[0];
    const weightInput = document.getElementById('calc-weight');
    const unitSelect = document.getElementById('calc-unit-type');
    
    const weight = parseFloat(weightInput.value) || 0;
    const unit = unitSelect.value;
    
    let totalLbs = weight;
    if (unit === 'ton') {
        // 1 Metric Ton = 2204.62 Pounds
        totalLbs = weight * 2204.62;
    }

    const priceUsdPerLb = latest.valor;
    const totalUsd = totalLbs * priceUsdPerLb;
    const totalClp = totalUsd * state.usdRate;

    // Unit price display
    const unitPriceEl = document.getElementById('calc-unit-price');
    if (unit === 'lb') {
        unitPriceEl.textContent = `$${priceUsdPerLb.toFixed(2)} USD / lb`;
    } else {
        const pricePerTon = priceUsdPerLb * 2204.62;
        unitPriceEl.textContent = `$${pricePerTon.toLocaleString('es-CL', {maximumFractionDigits:2})} USD / t`;
    }

    // Total display
    document.getElementById('calc-total-usd').textContent = `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    document.getElementById('calc-total-clp').textContent = `$${Math.round(totalClp).toLocaleString('es-CL')} CLP`;
}

/**
 * Export Active Data to CSV
 */
function exportToCSV() {
    const filtered = getFilteredData();
    if (filtered.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Fecha,Valor USD por Libra,Equivalente CLP por Libra,Tasa Cambio CLP/USD\n";

    filtered.forEach(item => {
        const dateStr = formatDateShort(item.dateObj);
        const usdVal = item.valor.toFixed(2);
        const clpVal = Math.round(item.valor * state.usdRate);
        csvContent += `${dateStr},${usdVal},${clpVal},${state.usdRate.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const rangeName = state.activeRange === 'all' ? 'historico' : state.activeRange;
    link.setAttribute("download", `valor_cobre_chile_${rangeName}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
}
