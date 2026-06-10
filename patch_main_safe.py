import os

files = ['main.js', 'dashboard/static/js/main.js']

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix the renderQuoteResults UI bug
    buggy_str = 'resultsContainer.innerHTML = listHtml + demoHtml;'
    fixed_str = 'resultsContainer.innerHTML = tabsHtml + demoHtml + listHtml;'
    if buggy_str in content:
        content = content.replace(buggy_str, fixed_str)
        print('Fixed tabs in', filepath)

    # 2. Add smart tab auto-selection
    target_smart = '''            window.quoteSearchResultsCache = { 
                meli: (data.meli_results || []).map(r => ({...r, source: 'MercadoLibre Chile'})), 
                other: (data.other_results || []).map(r => ({...r, source: 'Resultados Web'})) 
            };
            window.currentQuoteTab = 'meli';'''
            
    replacement_smart = '''            window.quoteSearchResultsCache = { 
                meli: (data.meli_results || []).map(r => ({...r, source: 'MercadoLibre Chile'})), 
                other: (data.other_results || []).map(r => ({...r, source: 'Resultados Web'})) 
            };
            
            // Smart auto-select tab based on query (Mercado Libre is bad for construction materials)
            const qLower = query.toLowerCase();
            const constWords = ['pino', 'madera', 'cemento', 'zinc', 'fierro', 'dimensionado', 'plancha', 'volcanita', 'osb', 'terciado', 'hormigon', 'ladrillo', 'arena', 'ripio', 'grava', 'acero', 'perfil', 'tubo', 'pvc', 'cobre'];
            if ((constWords.some(w => qLower.includes(w)) || window.quoteSearchResultsCache.meli.length === 0) && window.quoteSearchResultsCache.other.length > 0) {
                window.currentQuoteTab = 'other';
            } else {
                window.currentQuoteTab = 'meli';
            }'''
    if target_smart in content:
        content = content.replace(target_smart, replacement_smart)
        print('Applied smart tabs in', filepath)

    # 3. Safely replace exportToPDF
    start_str = 'window.exportToPDF = function() {'
    start_idx = content.find(start_str)
    if start_idx != -1:
        end_str = "container.innerHTML = ''; // clear\n        });\n    };"
        end_idx = content.find(end_str, start_idx)
        if end_idx != -1:
            end_idx += len(end_str)
            
            new_pdf_func = """window.exportToPDF = function() {
        if (typeof html2pdf === 'undefined') {
            alert("El generador de PDF aún se está cargando. Inténtelo en unos segundos.");
            return;
        }
        
        if (!window.lastMatchData || !window.activeCotCode) return;
        
        const cot = window.DATA_FIXTURES.LICITACIONES_ACTIVAS.find(x => x.codigo === window.activeCotCode);
        if (!cot) return;

        const container = document.getElementById('pdf-export-container');
        if (!container) return;

        const today = new Date();
        const dateStr = today.toLocaleDateString('es-CL');
        const validUntil = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000)).toLocaleDateString('es-CL');
        
        let subtotal = 0;
        window.lastMatchData.items.forEach(it => {
            subtotal += (it.precioSugeridoTotal || 0);
        });
        const iva = Math.round(subtotal * 0.19);
        const total = subtotal + iva;

        let rowsHtml = '';
        window.lastMatchData.items.forEach(it => {
            rowsHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:12px; color:#334155; font-size:12px; line-height:1.4;">${it.producto || 'Ítem sin nombre'}</td>
                <td style="padding:12px; text-align:center; color:#475569; font-size:12px;">$ ${Math.round(it.precioSugeridoUnitario || 0).toLocaleString('es-CL')}</td>
                <td style="padding:12px; text-align:center; color:#475569; font-weight:600; font-size:12px;">${it.cantidad || 1}</td>
                <td style="padding:12px; text-align:right; color:#0f172a; font-weight:600; font-size:12px;">$ ${Math.round(it.precioSugeridoTotal || 0).toLocaleString('es-CL')}</td>
            </tr>`;
        });

        container.innerHTML = `
        <div style="font-family: 'Inter', Helvetica, sans-serif; color: #1e293b; width: 720px; margin: 0 auto; padding: 30px; background: #fff;">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 25px;">
                <div style="flex:1;">
                    <h1 style="margin:0; font-size:28px; color:#2563eb; display:flex; align-items:center;">
                        <span style="font-weight:900; letter-spacing:-2px; margin-right:8px;">TE</span> 
                        <span style="font-size:18px; font-weight:bold; color:#0f172a; line-height:1.2;">Tecno<br><span style="font-weight:normal; color:#64748b;">Express</span></span>
                    </h1>
                    <div style="font-size:12px; margin-top:12px; color:#64748b; line-height:1.6;">
                        Santiago - Chile - Talca<br>
                        <span style="color:#3b82f6;">www.tecnoexpress.com</span><br>
                        +56 9 97913325 / +56 9 931376854<br>
                        Rut: 77.043.858-6
                    </div>
                </div>
                <div style="text-align: right; width: 280px;">
                    <h2 style="margin:0 0 15px 0; font-size:24px; color:#0f172a; font-weight:700; letter-spacing:1px;">COTIZACIÓN</h2>
                    <table style="width:100%; font-size:12px; border-collapse: collapse;">
                        <tr><td style="padding:4px 8px; font-weight:600; color:#64748b; text-align:left;">Fecha:</td><td style="padding:4px 8px; text-align:right; font-weight:500;">${dateStr}</td></tr>
                        <tr><td style="padding:4px 8px; font-weight:600; color:#64748b; text-align:left;">Cotización #:</td><td style="padding:4px 8px; text-align:right; font-weight:700; color:#2563eb;">${cot.codigo}</td></tr>
                        <tr><td style="padding:4px 8px; font-weight:600; color:#64748b; text-align:left;">Válido hasta:</td><td style="padding:4px 8px; text-align:right; font-weight:500;">${validUntil}</td></tr>
                    </table>
                </div>
            </div>

            <!-- Client section -->
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 15px 20px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Preparado para</h3>
                <div style="font-size:13px; line-height:1.6;">
                    <div style="font-size: 15px; font-weight:bold; color:#0f172a;">${cot.comprador || 'I. MUNICIPALIDAD'}</div>
                    <div style="color: #334155; margin-top:2px;">Rut: ${cot.rut || '69.100.200-4'}</div>
                    <div style="color: #334155;">Región: ${cot.comprador_region || 'Maule'}</div>
                </div>
            </div>

            <!-- Items Table -->
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:30px;">
                <thead>
                    <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                        <th style="padding:12px; text-align:left; color:#0f172a; font-weight:700;">Descripción del Ítem</th>
                        <th style="padding:12px; text-align:center; color:#0f172a; font-weight:700; width:100px;">Precio Unit.</th>
                        <th style="padding:12px; text-align:center; color:#0f172a; font-weight:700; width:60px;">Cant.</th>
                        <th style="padding:12px; text-align:right; color:#0f172a; font-weight:700; width:110px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- Footer section: Terms & Totals -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <!-- Left: Bank & Terms -->
                <div style="width: 50%; font-size: 11px;">
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #0f172a; font-weight: 700; text-transform: uppercase;">Datos Bancarios</h4>
                        <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; line-height: 1.6; color: #334155;">
                            <strong style="color: #0f172a; font-size:12px;">Tecnoexpress SpA</strong><br>
                            RUT: 77.043.858-6<br>
                            Banco Estado<br>
                            Cuenta Vista: 43571636876<br>
                            chiletecnoexpress@gmail.com
                        </div>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #0f172a; font-weight: 700; text-transform: uppercase;">Términos y Condiciones</h4>
                        <ul style="margin: 0; padding-left: 15px; color: #475569; line-height: 1.6;">
                            <li>El pago será realizado a 30 días contra factura recibida conforme.</li>
                            <li>Cotización válida por 30 días.</li>
                            <li>Plazo de entrega 5 días recibida OC.</li>
                        </ul>
                    </div>
                </div>

                <!-- Right: Totals -->
                <div style="width: 45%;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <tr>
                            <td style="padding: 10px 12px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9;">Subtotal Neto</td>
                            <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">$ ${subtotal.toLocaleString('es-CL')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 12px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9;">IVA (19%)</td>
                            <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">$ ${iva.toLocaleString('es-CL')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 12px; color: #0f172a; font-weight: 800; font-size: 18px; border-bottom: 2px solid #2563eb;">TOTAL</td>
                            <td style="padding: 15px 12px; text-align: right; font-weight: 800; font-size: 18px; color: #2563eb; border-bottom: 2px solid #2563eb;">$ ${total.toLocaleString('es-CL')}</td>
                        </tr>
                    </table>
                    
                    <div style="margin-top: 35px; text-align: center; color: #64748b; font-size: 11px; font-style: italic;">
                        Si tiene alguna duda sobre esta cotización, por favor contáctenos.
                    </div>
                    <div style="margin-top: 5px; text-align: center; font-weight: bold; color: #0f172a; font-size: 12px;">
                        ¡Gracias por preferir TecnoExpress!
                    </div>
                </div>
            </div>
        </div>`;

        // Make PDF Generation smoother
        container.parentElement.style.display = 'block';
        const opt = {
            margin:       [0, 0, 0, 0],
            filename:     `Cotizacion_${cot.codigo}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container.children[0]).save().then(() => {
            container.parentElement.style.display = 'none';
        });
    };"""
            
            content = content[:start_idx] + new_pdf_func + content[end_idx:]
            print(f"Successfully patched PDF in {filepath}")
        else:
            print(f"Could not find end of exportToPDF in {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Update version bump in index.html and Django template to force client cache refresh
for html_file in ['index.html', 'dashboard/templates/dashboard/index.html']:
    with open(html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    html_content = html_content.replace('main.js?v=28', 'main.js?v=29')
    html_content = html_content.replace('style.css?v=28', 'style.css?v=29')
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
