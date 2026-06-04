# ChileanCooper

Dashboard interactivo y estático para visualizar y analizar la variación del valor del cobre en Chile en tiempo real.

## Características

- **Gráficos Interactivos:** Visualización de la serie temporal mediante ApexCharts (Últimos 30 días, 2025, 2026, Histórico completo).
- **Indicadores Clave (KPIs):** Precio en USD/lb, equivalente en CLP/lb mediante tipo de cambio actualizado, máximos y mínimos del período.
- **Calculadora Conversora:** Conversión rápida de peso (Libras o Toneladas Métricas) a valor en dólares y pesos chilenos.
- **Historial Completo:** Paginación de registros históricos con opción de descarga a archivo CSV.
- **Temas Claro / Oscuro:** Selector en la cabecera con transiciones fluidas.
- **Modo Fuera de Línea:** Incluye datos históricos de respaldo en local (`fallback_data.js`) para evitar problemas de conexión o errores de CORS al abrir de forma local (`file://`).

## Instalación y Ejecución

Solo requieres abrir el archivo `index.html` en cualquier navegador web moderno, o iniciar un servidor web en la carpeta:

```bash
python -m http.server 8000
```
Y abrir `http://localhost:8000`.
