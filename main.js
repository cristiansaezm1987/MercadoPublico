/**
 * MeliPulse Chile - Frontend Controller
 * Handles real-time scraping requests, client-side API fallbacks, KPI calculations, 
 * sorting/filtering, and the comparison drawer.
 * Supports Mercado Libre Chile scraper and DuckDuckGo Web search results.
 */

document.addEventListener("DOMContentLoaded", () => {
    // State management
    window.currentResults = []; // Unified array: {title, price, currency, permalink, image, delivery_days, free_shipping, is_full, raw_shipping, origin, snippet}
    window.compareList = [];

    // DOM Elements
    const searchForm = document.getElementById("search-form");
    const searchInput = document.getElementById("search-input");
    const btnSearch = document.getElementById("btn-search");
    const searchBtnSpinner = document.getElementById("search-btn-spinner");
    
    const loadingSection = document.getElementById("loading-section");
    const placeholderSection = document.getElementById("placeholder-section");
    const insightsSection = document.getElementById("insights-section");
    const resultsSection = document.getElementById("results-section");
    
    const consoleLogs = document.getElementById("console-logs");
    const loaderTitle = document.getElementById("loader-title");
    
    const statusPulse = document.getElementById("status-pulse");
    const statusText = document.getElementById("status-text");
    const dataChannelBadge = document.getElementById("data-channel-badge");
    
    const kpiTotalCount = document.getElementById("kpi-total-count");
    const kpiSourceText = document.getElementById("kpi-source-text");
    const kpiAvgPrice = document.getElementById("kpi-avg-price");
    const kpiMinPrice = document.getElementById("kpi-min-price");
    const kpiMaxPrice = document.getElementById("kpi-max-price");
    const kpiAvgDelivery = document.getElementById("kpi-avg-delivery");
    const kpiFastestDelivery = document.getElementById("kpi-fastest-delivery");
    
    const sortResults = document.getElementById("sort-results");
    const filterOrigin = document.getElementById("filter-origin");
    const filterFreeShipping = document.getElementById("filter-free-shipping");
    const filterFullShipping = document.getElementById("filter-full-shipping");
    
    const productsGrid = document.getElementById("products-grid");
    
    const comparisonDrawer = document.getElementById("comparison-drawer");
    const compareCount = document.getElementById("compare-count");
    const btnClearCompare = document.getElementById("btn-clear-compare");
    const btnToggleDrawer = document.getElementById("btn-toggle-drawer");
    const comparisonGrid = document.getElementById("comparison-grid");

    // Initialize formatting helpers
    const formatCLP = (value) => {
        return new Intl.NumberFormat("es-CL", {
            style: "currency",
            currency: "CLP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    // Extract Domain Info for Web Cards
    const getDomainName = (urlStr) => {
        try {
            const url = new URL(urlStr);
            let hostname = url.hostname;
            if (hostname.startsWith("www.")) {
                hostname = hostname.substring(4);
            }
            return hostname;
        } catch (e) {
            return "Web externa";
        }
    };

    const getDomainInitial = (urlStr) => {
        const domain = getDomainName(urlStr);
        return domain.charAt(0).toUpperCase();
    };

    // Terminal Logging helper
    const logMsg = (message, type = "info") => {
        const line = document.createElement("div");
        line.className = `log-line ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${message}`;
        
        consoleLogs.appendChild(line);
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    };

    const clearLogs = () => {
        consoleLogs.innerHTML = "";
    };

    // UI State Switcher
    const showLoading = (query) => {
        clearLogs();
        loaderTitle.textContent = `Buscando "${query}" en Mercado Libre Chile y Web...`;
        loadingSection.classList.remove("hidden");
        placeholderSection.classList.add("hidden");
        insightsSection.classList.add("hidden");
        resultsSection.classList.add("hidden");
        
        btnSearch.disabled = true;
        searchBtnSpinner.style.display = "block";
    };

    const hideLoading = () => {
        loadingSection.classList.add("hidden");
        btnSearch.disabled = false;
        searchBtnSpinner.style.display = "none";
    };

    // Form submission
    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;
        
        executeSearch(query);
    });

    // Main search orchestrator
    const executeSearch = (query) => {
        showLoading(query);
        logMsg(`Iniciando escaneo unificado para: "${query}"`, "system");
        logMsg("Llamando a la API del servidor local (/api/search/)...");
        
        // Attempt Django Server Web Scraper first
        fetch(`/api/search/?q=${encodeURIComponent(query)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const otherResults = (data.other_results || []).map(item => ({ ...item, origin: "other" }));
                
                if (data.error) {
                    logMsg(`[Servidor] Advertencia: ${data.message}`, "warning");
                    if (data.fallback_suggested) {
                        triggerFallback(query, otherResults);
                    } else {
                        throw new Error(data.message || "Error del servidor");
                    }
                } else {
                    logMsg(`[Servidor] Scraper de Mercado Libre completado con éxito.`, "success");
                    logMsg(`[Servidor] Búsqueda web (DuckDuckGo) retornó ${otherResults.length} resultados de otras tiendas.`, "success");
                    
                    // Update connection state
                    statusPulse.className = "pulse-dot green";
                    statusText.textContent = "Conexión Activa";
                    dataChannelBadge.textContent = "Servidor (Scraper)";
                    dataChannelBadge.style.borderColor = "rgba(16, 185, 129, 0.4)";
                    dataChannelBadge.style.color = "var(--success)";
                    
                    const meliResults = (data.meli_results || []).map(item => ({ ...item, origin: "meli" }));
                    const combined = [...meliResults, ...otherResults];
                    processResults(combined, "server");
                }
            })
            .catch(error => {
                logMsg(`[Servidor] Error o canal cerrado (ej: estático): ${error.message}`, "warning");
                triggerFallback(query, []);
            });
    };

    // Contingency Fallback: Request API from Client Browser
    const triggerFallback = (query, serverOtherResults) => {
        logMsg("Activando canal de datos de contingencia (Browser Fallback Meli)...", "system");
        logMsg("[Cliente] Consultando API pública de Mercado Libre desde tu dirección IP...");
        
        const apiUrl = `https://api.mercadolibre.com/sites/MLC/search?q=${encodeURIComponent(query)}`;
        
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`CORS/API error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const results = data.results || [];
                logMsg(`[Cliente] API de Mercado Libre respondió con éxito. Procesando ${results.length} resultados.`, "success");
                
                // Update connection state to Fallback mode (yellow)
                statusPulse.className = "pulse-dot yellow";
                statusText.textContent = "Canal Fallback (API)";
                dataChannelBadge.textContent = "Cliente (API)";
                dataChannelBadge.style.borderColor = "rgba(245, 158, 11, 0.4)";
                dataChannelBadge.style.color = "var(--warning)";
                
                // Map the Mercado Libre API model
                const meliMapped = results.map(item => {
                    const isFull = item.shipping?.logistic_type === "fulfillment";
                    const isFree = item.shipping?.free_shipping === true;
                    
                    let deliveryDays = null;
                    if (isFull) {
                        deliveryDays = 1;
                    } else if (isFree) {
                        deliveryDays = 2;
                    } else {
                        deliveryDays = 3;
                    }
                    
                    let imageUrl = item.thumbnail || "";
                    if (imageUrl.includes("-I.jpg")) {
                        imageUrl = imageUrl.replace("-I.jpg", "-O.jpg");
                    }
                    
                    return {
                        title: item.title,
                        price: item.price,
                        currency: item.currency_id || "CLP",
                        permalink: item.permalink,
                        image: imageUrl,
                        delivery_days: deliveryDays,
                        free_shipping: isFree,
                        is_full: isFull,
                        raw_shipping: isFull ? "Envío FULL" : (isFree ? "Envío gratis" : "Envío normal"),
                        origin: "meli"
                    };
                });
                
                const combined = [...meliMapped, ...serverOtherResults];
                processResults(combined, "client");
            })
            .catch(error => {
                logMsg(`[Cliente] Error crítico: No se pudo conectar a la API de contingencia. ${error.message}`, "error");
                hideLoading();
                
                if (serverOtherResults.length > 0) {
                    logMsg("[Sistema] Mostrando únicamente resultados alternativos obtenidos por el servidor.");
                    processResults(serverOtherResults, "server_partial");
                } else {
                    // Render error state
                    placeholderSection.classList.remove("hidden");
                    placeholderSection.innerHTML = `
                        <div class="placeholder-card">
                            <div class="placeholder-illustration" style="color: var(--error); background: rgba(239,68,68,0.1); border-color: var(--error)">
                                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                            </div>
                            <h3>Servidor Inactivo u Obsoleto</h3>
                            <p>No se pudo conectar al servidor local ni al API de cliente (Cuyo acceso público directo ahora requiere un token de desarrollo de Mercado Libre).</p>
                            <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--primary-light); font-weight: 500;">
                                Para solucionar esto, por favor inicia el servidor ejecutando:<br>
                                <code>.venv\\Scripts\\python manage.py runserver</code> en tu terminal, y abre la app desde <a href="http://127.0.0.1:8000/" style="color: var(--meli-yellow); text-decoration: underline;">http://127.0.0.1:8000/</a>.
                            </p>
                        </div>
                    `;
                }
            });
    };

    // Result calculations and rendering trigger
    const processResults = (results, source) => {
        hideLoading();
        window.currentResults = results;
        
        if (results.length === 0) {
            placeholderSection.classList.remove("hidden");
            placeholderSection.innerHTML = `
                <div class="placeholder-card">
                    <div class="placeholder-illustration">
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </div>
                    <h3>Sin resultados</h3>
                    <p>No encontramos productos que coincidan con tu búsqueda. Intenta con otros términos.</p>
                </div>
            `;
            return;
        }

        // Split counts
        const meliItems = results.filter(r => r.origin === "meli");
        const otherItems = results.filter(r => r.origin === "other");
        
        // Prices (filter out price == 0 which represents unparsed values)
        const prices = results.map(r => r.price).filter(p => p > 0);
        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 0;
        const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
        
        // Deliveries (usually only meli items)
        const deliveries = results.map(r => r.delivery_days).filter(d => d !== null);
        const avgDelivery = deliveries.length ? Math.round(deliveries.reduce((a, b) => a + b, 0) / deliveries.length) : null;
        const fastestDelivery = deliveries.length ? Math.min(...deliveries) : null;
        
        // Update KPIs in DOM
        kpiTotalCount.textContent = `${meliItems.length} Meli | ${otherItems.length} Web`;
        kpiSourceText.textContent = `Escaneado: ${source === "server" ? "Servidor Local" : (source === "server_partial" ? "Servidor Parcial" : "Fallback Cliente")}`;
        
        kpiAvgPrice.textContent = avgPrice > 0 ? formatCLP(avgPrice) : "--";
        kpiMinPrice.textContent = minPrice > 0 ? formatCLP(minPrice) : "--";
        kpiMaxPrice.textContent = maxPrice > 0 ? formatCLP(maxPrice) : "--";
        
        if (avgDelivery !== null) {
            kpiAvgDelivery.textContent = avgDelivery === 0 ? "Hoy mismo" : `${avgDelivery} ${avgDelivery === 1 ? 'día' : 'días'}`;
        } else {
            kpiAvgDelivery.textContent = "--";
        }
        
        if (fastestDelivery !== null) {
            if (fastestDelivery === 0) {
                kpiFastestDelivery.textContent = "Despacho hoy disponible";
                kpiFastestDelivery.className = "kpi-trend positive";
            } else if (fastestDelivery === 1) {
                kpiFastestDelivery.textContent = "Llega mañana disponible";
                kpiFastestDelivery.className = "kpi-trend positive";
            } else {
                kpiFastestDelivery.textContent = `Llega en mínimo ${fastestDelivery} días`;
                kpiFastestDelivery.className = "kpi-trend neutral";
            }
        } else {
            kpiFastestDelivery.textContent = "Entrega estándar";
            kpiFastestDelivery.className = "kpi-trend neutral";
        }

        // Display sections
        insightsSection.classList.remove("hidden");
        resultsSection.classList.remove("hidden");
        
        // Render products
        applySortingAndRendering();
    };

    // Sort & Filter controller
    const applySortingAndRendering = () => {
        let filtered = [...window.currentResults];
        
        // Apply Origin Filter
        const originVal = filterOrigin.value;
        if (originVal === "meli") {
            filtered = filtered.filter(item => item.origin === "meli");
        } else if (originVal === "other") {
            filtered = filtered.filter(item => item.origin === "other");
        }
        
        // Apply Free Shipping Filter (Only affects Mercado Libre results)
        if (filterFreeShipping.checked) {
            filtered = filtered.filter(item => item.origin !== "meli" || item.free_shipping === true);
        }
        
        // Apply FULL shipping Filter (Only affects Mercado Libre results)
        if (filterFullShipping.checked) {
            filtered = filtered.filter(item => item.origin !== "meli" || item.is_full === true);
        }
        
        // Apply Sorting
        const sortVal = sortResults.value;
        if (sortVal === "price_asc") {
            // Put items with price = 0 at the end
            filtered.sort((a, b) => {
                const pa = a.price === 0 ? 999999999 : a.price;
                const pb = b.price === 0 ? 999999999 : b.price;
                return pa - pb;
            });
        } else if (sortVal === "price_desc") {
            filtered.sort((a, b) => b.price - a.price);
        } else if (sortVal === "delivery_asc") {
            filtered.sort((a, b) => {
                const da = a.delivery_days === null ? 999 : a.delivery_days;
                const db = b.delivery_days === null ? 999 : b.delivery_days;
                return da - db;
            });
        }
        
        renderCards(filtered);
    };

    // Add listeners to filter controllers
    filterOrigin.addEventListener("change", applySortingAndRendering);
    sortResults.addEventListener("change", applySortingAndRendering);
    filterFreeShipping.addEventListener("change", applySortingAndRendering);
    filterFullShipping.addEventListener("change", applySortingAndRendering);

    // Cards Grid Renderer
    const renderCards = (items) => {
        productsGrid.innerHTML = "";
        
        items.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "product-card";
            card.id = `product-item-${index}`;
            
            if (item.origin === "meli") {
                // Mercado Libre Card layout
                let badgesHtml = "";
                if (item.free_shipping) {
                    badgesHtml += `<span class="badge free">Envío Gratis</span>`;
                }
                if (item.is_full) {
                    badgesHtml += `<span class="badge full">FULL</span>`;
                }
                
                let shippingDotClass = "normal";
                let shippingText = "Consultar fecha";
                let isHighlight = false;
                
                if (item.delivery_days !== null) {
                    if (item.delivery_days === 0) {
                        shippingDotClass = "fast";
                        shippingText = "Llega hoy";
                        isHighlight = true;
                    } else if (item.delivery_days === 1) {
                        shippingDotClass = "fast";
                        shippingText = "Llega mañana";
                        isHighlight = true;
                    } else {
                        shippingText = `Llega en ${item.delivery_days} días`;
                    }
                } else if (item.raw_shipping) {
                    shippingText = item.raw_shipping;
                }
                
                const isChecked = window.compareList.some(c => c.permalink === item.permalink) ? "checked" : "";
                
                card.innerHTML = `
                    <div class="card-img-wrapper">
                        <div class="card-badges">${badgesHtml}</div>
                        <img src="${item.image || 'https://via.placeholder.com/180?text=Sin+Imagen'}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/180?text=Sin+Imagen'">
                    </div>
                    <div class="card-info">
                        <h4 class="product-title" title="${item.title}">${item.title}</h4>
                        <div class="price-row">
                            <span class="price-symbol">$</span>
                            <span class="price-val">${item.price.toLocaleString("es-CL")}</span>
                            <span class="price-currency">CLP</span>
                        </div>
                        <div class="shipping-info-row">
                            <span class="shipping-dot ${shippingDotClass}"></span>
                            <span class="shipping-text-span ${isHighlight ? 'highlight' : ''}">${shippingText}</span>
                        </div>
                        <div class="card-actions">
                            <a href="${item.permalink}" target="_blank" rel="noopener noreferrer" class="btn-secondary">
                                <span>Ver en ML</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                            </a>
                            <label class="compare-btn-label" title="Comparar este producto">
                                <input type="checkbox" class="compare-checkbox" data-index="${index}" ${isChecked}>
                                <span class="compare-btn-visual">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                </span>
                            </label>
                        </div>
                    </div>
                `;
                
                // Add comparison handler
                const checkbox = card.querySelector(".compare-checkbox");
                checkbox.addEventListener("change", (e) => {
                    handleCompareToggle(e.target.checked, item, checkbox);
                });
                
            } else {
                // External Web Card layout
                const domain = getDomainName(item.permalink);
                const initial = getDomainInitial(item.permalink);
                
                let priceHtml = "";
                if (item.price > 0) {
                    priceHtml = `
                        <span class="price-symbol">$</span>
                        <span class="price-val">${item.price.toLocaleString("es-CL")}</span>
                        <span class="price-currency">CLP</span>
                    `;
                } else {
                    priceHtml = `
                        <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-muted);">Ver precio en tienda</span>
                    `;
                }
                
                card.innerHTML = `
                    <div class="card-img-wrapper" style="background-color: var(--bg-secondary);">
                        <div class="card-badges"><span class="badge web">Web</span></div>
                        <div class="card-web-placeholder">
                            ${initial}
                            <span>${domain}</span>
                        </div>
                    </div>
                    <div class="card-info">
                        <h4 class="product-title" title="${item.title}">${item.title}</h4>
                        <div class="price-row" style="min-height: 2.2rem; display: flex; align-items: center;">
                            ${priceHtml}
                        </div>
                        <div class="web-snippet" title="${item.snippet}">
                            ${item.snippet || "Sin descripción disponible."}
                        </div>
                        <div class="shipping-info-row">
                            <span class="shipping-dot"></span>
                            <span class="shipping-text-span">Consultar en tienda</span>
                        </div>
                        <div class="card-actions">
                            <a href="${item.permalink}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="flex: 1; border-color: rgba(139, 92, 246, 0.3);">
                                <span>Ver en Web</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                `;
            }
            
            productsGrid.appendChild(card);
        });
    };

    // Comparison Drawer manager
    const handleCompareToggle = (checked, item, element) => {
        if (checked) {
            // Limit to 4 items
            if (window.compareList.length >= 4) {
                alert("Puedes comparar un máximo de 4 productos simultáneamente.");
                element.checked = false;
                return;
            }
            window.compareList.push(item);
        } else {
            window.compareList = window.compareList.filter(c => c.permalink !== item.permalink);
        }
        
        updateCompareDrawer();
    };

    const updateCompareDrawer = () => {
        compareCount.textContent = window.compareList.length;
        
        // Clear grid
        comparisonGrid.innerHTML = "";
        
        // Render slots (always 4)
        for (let i = 0; i < 4; i++) {
            const col = document.createElement("div");
            col.className = "compare-col";
            
            if (i < window.compareList.length) {
                const item = window.compareList[i];
                col.classList.add("active");
                
                let shippingText = "Entrega estándar";
                let isHighlight = false;
                if (item.delivery_days !== null) {
                    if (item.delivery_days === 0) {
                        shippingText = "Llega HOY";
                        isHighlight = true;
                    } else if (item.delivery_days === 1) {
                        shippingText = "Llega MAÑANA";
                        isHighlight = true;
                    } else {
                        shippingText = `Llega en ${item.delivery_days} días`;
                    }
                }
                
                col.innerHTML = `
                    <button class="compare-card-remove" data-index="${i}">&times;</button>
                    <div class="compare-card-img">
                        <img src="${item.image || 'https://via.placeholder.com/60?text=Sin+Imagen'}" alt="${item.title}">
                    </div>
                    <div class="compare-card-title">${item.title}</div>
                    <div class="compare-card-price">${formatCLP(item.price)}</div>
                    <div class="compare-card-delivery ${isHighlight ? '' : 'standard'}">
                        ${shippingText} ${item.is_full ? '⚡ FULL' : ''}
                    </div>
                `;
                
                // Add click event for individual remove button
                col.querySelector(".compare-card-remove").addEventListener("click", () => {
                    removeCompareItem(i);
                });
            } else {
                col.innerHTML = `
                    <div class="compare-col-empty">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <div>Vacío</div>
                    </div>
                `;
            }
            comparisonGrid.appendChild(col);
        }
        
        // Slide open or close drawer based on list count
        if (window.compareList.length > 0) {
            comparisonDrawer.classList.add("open");
        } else {
            comparisonDrawer.classList.remove("open");
        }
    };

    const removeCompareItem = (index) => {
        const removedItem = window.compareList[index];
        window.compareList.splice(index, 1);
        updateCompareDrawer();
        
        // Uncheck corresponding checkbox in the list
        const checkboxes = document.querySelectorAll(".compare-checkbox");
        checkboxes.forEach(cb => {
            const cardIndex = parseInt(cb.getAttribute("data-index"));
            const cardItem = window.currentResults[cardIndex];
            if (cardItem && cardItem.permalink === removedItem.permalink) {
                cb.checked = false;
            }
        });
    };

    // Toggle drawer open/collapsed
    btnToggleDrawer.addEventListener("click", () => {
        comparisonDrawer.classList.toggle("open");
    });
    
    // Clicking the drawer header toggles it (except when clicking clear button)
    document.querySelector(".drawer-header").addEventListener("click", (e) => {
        if (e.target !== btnClearCompare && !btnClearCompare.contains(e.target) && e.target !== btnToggleDrawer && !btnToggleDrawer.contains(e.target)) {
            comparisonDrawer.classList.toggle("open");
        }
    });

    // Clear all compared items
    btnClearCompare.addEventListener("click", () => {
        window.compareList = [];
        updateCompareDrawer();
        
        // Uncheck all checkboxes
        const checkboxes = document.querySelectorAll(".compare-checkbox");
        checkboxes.forEach(cb => cb.checked = false);
    });
});
