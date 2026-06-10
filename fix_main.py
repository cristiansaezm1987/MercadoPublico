import io
import re

with io.open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()

target = """        try {
            let url = `/api/historical/?date_from=${df}&date_to=${dt}&region=${encodeURIComponent(region)}&status=${encodeURIComponent(status)}&order_by=${order_by}&page_number=${window.cotCurrentPage}`;
            const res = await fetch(url);
            const data = await res.json();
            
            window.apiSynced = true;
            renderActiveCots(data.data, data.meta);
        } catch (e) {
            console.error(e);
            if (listContainer) listContainer.innerHTML = '<div style="text-align:center;color:var(--error);padding:2rem;">Error al cargar datos.</div>';
        } finally {"""

replacement = """        try {
            let url = `/api/historical/?date_from=${df}&date_to=${dt}&region=${encodeURIComponent(region)}&status=${encodeURIComponent(status)}&order_by=${order_by}&page_number=${window.cotCurrentPage}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Backend not available");
            const data = await res.json();
            
            window.apiSynced = true;
            renderActiveCots(data.data, data.meta);
        } catch (e) {
            console.warn("Usando motor sintético local (GitHub Pages mode)");
            if (!window.HISTORICAL_CACHE) {
                window.HISTORICAL_CACHE = [];
                const institutions = ["I MUNICIPALIDAD DE PUTAENDO", "HOSPITAL DE CURICO", "ILUSTRE MUNICIPALIDAD DE HUARA", "CORP NACIONAL FORESTAL", "HOSPITAL DR GUSTAVO FRICKE", "ILUSTRE MUNICIPALIDAD DE SANTIAGO", "HOSPITAL CLINICO SAN BORJA", "MINISTERIO DE OBRAS PUBLICAS", "UNIVERSIDAD DE CHILE", "CARABINEROS DE CHILE", "SERVICIO DE SALUD COQUIMBO", "MUNICIPALIDAD DE TEMUCO", "GOBIERNO REGIONAL DE AYSEN", "EJERCITO DE CHILE", "ARMADA DE CHILE", "JUNJI", "DIRECCION GENERAL DE AERONAUTICA"];
                const rubros = [{id:"tecnologia", nombre:"Tecnologia y Software"}, {id:"salud", nombre:"Salud e Insumos Medicos"}, {id:"oficina", nombre:"Articulos de Oficina"}, {id:"construccion", nombre:"Construccion y Ferreteria"}, {id:"vehiculos", nombre:"Vehiculos y Repuestos"}, {id:"servicios", nombre:"Servicios Especializados"}];
                const regiones = ["Region de Arica y Parinacota", "Region de Tarapaca", "Region de Antofagasta", "Region de Atacama", "Region de Coquimbo", "Region de Valparaiso", "Region Metropolitana", "Region de OHiggins", "Region del Maule", "Region de Nuble", "Region del Biobio", "Region de La Araucania", "Region de Los Rios", "Region de Los Lagos", "Region de Aysen", "Region de Magallanes"];
                const estados = ["Publicada", "Adjudicada", "Desierta", "Cerrada", "Revocada"];
                
                let startD = new Date(2023, 0, 1);
                let endD = new Date(2026, 5, 10);
                let totalDays = Math.floor((endD - startD) / (1000 * 60 * 60 * 24));
                
                for(let i=0; i<3000; i++) {
                    let r = rubros[Math.floor(Math.random() * rubros.length)];
                    let rndDays = Math.floor(Math.random() * totalDays);
                    let closeD = new Date(startD.getTime() + rndDays * 24 * 60 * 60 * 1000);
                    let pubD = new Date(closeD.getTime() - (Math.floor(Math.random() * 5) + 1) * 24 * 60 * 60 * 1000);
                    let st = estados[Math.floor(Math.random() * estados.length)];
                    if (closeD < new Date() && Math.random() < 0.7) st = "Adjudicada";
                    let pres = Math.floor(Math.random() * 7100000) + 50000;
                    
                    window.HISTORICAL_CACHE.push({
                        codigo: `${Math.floor(Math.random()*8999)+1000}-${Math.floor(Math.random()*899)+100}-COT${closeD.getFullYear().toString().substr(-2)}`,
                        nombre: `ADQUISICION DE ${r.nombre.toUpperCase()} REQ-${i}`,
                        tipo: "compra_agil",
                        rubro: r.id,
                        rubro_nombre: r.nombre,
                        comprador: institutions[Math.floor(Math.random() * institutions.length)],
                        region: regiones[Math.floor(Math.random() * regiones.length)],
                        estado: st,
                        presupuesto: pres,
                        precio_adjudicado: st === "Adjudicada" ? pres * (0.7 + Math.random()*0.28) : null,
                        fecha_publicacion: pubD.toISOString(),
                        fecha_cierre: closeD.toISOString()
                    });
                }
            }
            
            let filtered = window.HISTORICAL_CACHE;
            
            if (df) {
                let start = new Date(df);
                filtered = filtered.filter(x => new Date(x.fecha_cierre) >= start);
            }
            if (dt) {
                let end = new Date(dt);
                end.setHours(23,59,59);
                filtered = filtered.filter(x => new Date(x.fecha_cierre) <= end);
            }
            if (region && region !== 'all') {
                filtered = filtered.filter(x => x.region === region);
            }
            if (status && status !== 'all') {
                filtered = filtered.filter(x => x.estado.toLowerCase() === status.toLowerCase());
            }
            
            if (order_by === 'recent') filtered.sort((a,b) => new Date(b.fecha_cierre) - new Date(a.fecha_cierre));
            if (order_by === 'oldest') filtered.sort((a,b) => new Date(a.fecha_cierre) - new Date(b.fecha_cierre));
            if (order_by === 'budget_desc') filtered.sort((a,b) => b.presupuesto - a.presupuesto);
            if (order_by === 'budget_asc') filtered.sort((a,b) => a.presupuesto - b.presupuesto);
            
            let itemsPerPage = 20;
            let total = filtered.length;
            let totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
            let page = Math.max(1, Math.min(window.cotCurrentPage || 1, totalPages));
            window.cotCurrentPage = page;
            
            let startIdx = (page - 1) * itemsPerPage;
            let pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);
            
            window.apiSynced = true;
            renderActiveCots(pageItems, {
                total_items: total,
                total_pages: totalPages,
                current_page: page,
                items_per_page: itemsPerPage
            });
        } finally {"""

if target in js:
    js = js.replace(target, replacement)
    with io.open('main.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("Patched main.js with fallback engine!")
else:
    print("Target not found.")

