# Mercado Inteligente AI

> Copiloto de inteligencia artificial para Mercado Publico de Chile.

## Descripcion

Plataforma Django que analiza licitaciones y compras agiles del portal Mercado Publico de Chile, sugiriendo las mejores oportunidades de negocio por rubro y presupuesto mediante un motor de IA.

## Funcionalidades

- **Recomendaciones IA por Presupuesto**: Variador de precios que sugiere licitaciones activas con mayor probabilidad de adjudicacion
- **Simulador de Precios**: Calcula el precio optimo de oferta con curva de sensibilidad
- **Analisis de Rubros**: Detecta oportunidades por rubro y region (16 regiones de Chile)
- **Soporte Compras Agiles (COT)**: Incluye busqueda de codigos COT como `3874-128-COT26`
- **Proveedores Locales**: Busqueda de distribuidores por region para optimizar costos
- **API en Vivo**: Conexion directa a api.mercadopublico.cl con fallback robusto

## Stack Tecnologico

- **Backend**: Django 6.x (Python)
- **Frontend**: HTML5 + CSS3 (glassmorphism dark mode) + JavaScript ES6+
- **Charts**: ApexCharts
- **Fuente de datos**: API oficial Mercado Publico Chile + base local enriquecida

## Instalacion

```bash
# Clonar repositorio
git clone https://github.com/cristiansaezm1987/MercadoPublico.git
cd MercadoPublico

# Crear entorno virtual
python -m venv .venv
.venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor
python manage.py runserver
```

Abrir en: http://127.0.0.1:8000

## Estructura del Proyecto

```
MercadoPublico/
├── config/                  # Configuracion Django
├── dashboard/
│   ├── api_client.py        # Conexion API Mercado Publico + COT
│   ├── intelligence.py      # Motor IA: probabilidades y recomendaciones
│   ├── data_fixtures.py     # Base de datos: 16 regiones, compradores, licitaciones
│   ├── views.py             # Endpoints API
│   ├── urls.py
│   ├── static/
│   │   ├── css/style.css    # UI premium dark mode
│   │   └── js/main.js       # Logica frontend
│   └── templates/dashboard/index.html
├── manage.py
└── requirements.txt
```

## API Endpoints

| Endpoint | Descripcion |
|---|---|
| `GET /` | Dashboard principal |
| `GET /api/rubros/?region=X` | Analisis de rubros por region |
| `GET /api/recommend/?budget=N` | Recomendaciones IA por presupuesto |
| `GET /api/analyze/?cost=N&rubro_id=X&region=Y` | Simulacion de precio optimo |
| `GET /api/suppliers/?rubro_id=X&region=Y&cost=N` | Proveedores locales |
| `GET /api/tenders/` | Licitaciones del dia |
| `GET /api/tenders/<codigo>/` | Detalle de licitacion o compra agil |
