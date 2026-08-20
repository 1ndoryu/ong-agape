# ong-agame — El Proyecto Ágape

Rama de sitio construida sobre `glory-rs-template`, con **Rust (Axum) + React (TypeScript) + OpenAPI**.
El producto público es El Proyecto Ágape: una ONG con landing, transparencia de fondos y panel administrativo.

Pensado para máxima velocidad de desarrollo, seguridad por defecto y escalabilidad.

## Stack

| Capa                 | Herramienta                  | Para qué                                |
| -------------------- | ---------------------------- | --------------------------------------- |
| Framework web        | Axum                         | HTTP, routing, middleware               |
| OpenAPI              | utoipa + utoipa-swagger-ui   | Genera schema OpenAPI desde código      |
| Serialización        | serde                        | JSON ↔ Structs                          |
| Base de datos        | SQLx (PostgreSQL)            | Queries SQL con verificación            |
| Migraciones          | SQLx migrate                 | Control de schema DB                    |
| Validación           | validator                    | Validar inputs del usuario              |
| Variables de entorno | dotenvy                      | Cargar .env                             |
| Logging              | tracing + tracing-subscriber | Logs estructurados                      |
| Errores              | thiserror                    | Errores tipados                         |
| Auth (JWT)           | jsonwebtoken                 | Tokens                                  |
| Hashing              | argon2                       | Hashing seguro de contraseñas           |
| CORS                 | tower-http                   | Middleware CORS                         |
| Linter               | clippy (paranoia)            | Código limpio                           |
| Frontend             | React + TypeScript + Vite    | UI                                      |
| State management     | React Query + Zustand        | Server state + client state             |
| Codegen              | Orval                        | Genera cliente TypeScript desde OpenAPI |

## Requisitos

- Rust (stable, 1.75+)
- Node.js (18+) y npm
- PostgreSQL corriendo localmente

## Inicio rápido

```bash
# 1. Clonar el template con el framework fijado
git clone --recurse-submodules --branch main https://github.com/1ndoryu/glory-rs-template.git nuevo-proyecto
cd nuevo-proyecto
git submodule update --init --recursive
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# 2. Crear la base de datos
psql -U postgres -c "CREATE DATABASE glory_db;"

# 3. Backend
cargo run
# El servidor inicia en http://localhost:3000
# Swagger UI en http://localhost:3000/swagger-ui/

# 4. Frontend (en otra terminal)
cd frontend
npm install
npm run dev
# Frontend en http://localhost:5173

# 5. Generar cliente API (con backend corriendo)
npm run codegen
```

## Estructura del proyecto

```
├── Cargo.toml              # Dependencias del backend
├── src/
│   ├── domain/              # Reglas agnósticas de proveedores y comprobantes
│   ├── main.rs             # Entry point del servidor
│   ├── lib.rs              # Re-exports y AppState
│   ├── config/             # Configuración desde env vars
│   ├── errors/             # Tipos de error → HTTP status codes
│   ├── handlers/           # Capa HTTP (routing, request/response)
│   ├── middleware/          # Auth middleware (JWT extractor)
│   ├── models/             # Structs de dominio y DTOs
│   ├── repositories/       # Capa de base de datos (queries)
│   └── services/           # Lógica de negocio
├── migrations/             # Migraciones SQL (SQLx)
├── frontend/
│   ├── src/
│   │   ├── features/admin/  # Panel minimalista y UI reutilizable
│   │   ├── features/landing/# Sitio público
│   │   ├── styles/          # Tokens globales + Tailwind
│   │   ├── api/            # Cliente API generado por Orval
│   │   ├── App.tsx         # Componente raíz
│   │   └── main.tsx        # Entry point React
│   ├── orval.config.ts     # Configuración de codegen
│   └── vite.config.ts      # Configuración de Vite + proxy
├── .env.example            # Variables de entorno de ejemplo
└── .gitignore
```

## Arquitectura

El backend sigue separación en capas:

- **handlers/** → Reciben HTTP requests, extraen datos, llaman services, retornan responses
- **services/** → Lógica de negocio, orquestan repositories
- **repositories/** → Queries a PostgreSQL via SQLx
- **models/** → Structs de dominio, DTOs de request/response, schemas OpenAPI
- **errors/** → Enum de errores que mapean a HTTP status codes
- **middleware/** → Extractores de Axum (auth JWT)
- **domain/** → Contratos de negocio que no conocen Axum, SQLx ni Glory RS; aquí viven los conceptos de
  proveedores y estados de comprobantes.

La UI administrativa usa Tailwind CSS con primitives reutilizables (`StatusPill`, `AdminCard`, `CardHeading`)
para que futuras ramas puedan compartir el panel sin acoplarse a Glory RS. `/admin` requiere JWT y autorización
por rol: owner publica y administra proveedores; finance_editor edita borradores; auditor revisa pagos y lee
auditoría; viewer consulta en modo solo lectura.

## API de ejemplo

El template incluye un CRUD de notas con autenticación:

| Método | Ruta               | Descripción             | Auth |
| ------ | ------------------ | ----------------------- | ---- |
| POST   | /api/auth/register | Registrar usuario       | No   |
| POST   | /api/auth/login    | Iniciar sesión          | No   |
| GET    | /api/health        | Health check            | No   |
| POST   | /api/notes         | Crear nota              | Sí   |
| GET    | /api/notes         | Listar notas (paginado) | Sí   |
| GET    | /api/notes/:id     | Obtener nota            | Sí   |
| PUT    | /api/notes/:id     | Actualizar nota         | Sí   |
| DELETE | /api/notes/:id     | Eliminar nota           | Sí   |
| GET    | /api/transparency/summary?currency=USD | Resumen público de fondos publicados | No |
| GET    | /api/transparency/content/:key | Contenido de transparencia publicado | No |
| GET    | /api/payment-methods | Métodos de aporte habilitados sin secretos | No |
| GET    | /api/blog | Artículos publicados | No |
| GET    | /api/blog/:slug | Artículo público | No |
| GET/POST/PUT | /api/admin/... | Ledger, transparencia, blog, pagos y auditoría | Sí |

## Ágape: transparencia y donaciones

- `/` muestra la landing y el resumen público de transparencia con fallback seguro si la API aún no está disponible.
- `/admin` muestra el panel lateral para resumen, movimientos, contenido público, campañas, métodos de pago y auditoría.
- La migración agrega `transparency_entries`, `payment_methods`, `payment_receipts`, `transparency_content` y `audit_events`.
- Los recibos reservan `provider_event_id` con índice único por método para evitar duplicar webhooks reintentados.
- PayPal y Stripe están modelados como proveedores automáticos pendientes de credenciales y webhooks firmados.
- Pago móvil, transferencia y Zelle son métodos manuales: un comprobante queda pendiente hasta revisión humana.
- Las claves de proveedores nunca deben entrar en React, en `public_config` ni en texto plano de PostgreSQL.
- Zelle permanece desactivado hasta confirmar que la ONG tenga una cuenta propia y un flujo aprobado.
- Transparencia y blog se editan como borradores; publicar requiere owner y queda auditado.
- `/transparency` ofrece la rendición pública detallada: resumen, movimientos publicados y métodos habilitados.
- PayPal/Stripe todavía no procesan dinero: siguen en `setup_required` hasta conectar secretos, checkout y webhooks firmados.
- El servidor solo permite activar PayPal/Stripe cuando detecta sus variables de entorno mínimas; las claves nunca viajan a React.
- “Juega y gana” queda fuera del primer lanzamiento y requiere revisión legal, reglas y auditoría antes de abrirse.

## Ramas por sitio

Este template está diseñado para usar **una rama por sitio/proyecto**:

```bash
git checkout -b mi-sitio-web
# Desarrollar en la rama
# Cambiar a otro sitio:
git checkout otro-sitio
```

La estructura es idéntica en cada rama. Solo cambia el contenido específico del sitio.

## Comandos útiles

```bash
# Comando unificado — verifica todo el proyecto (backend + frontend)
npm run check

# Backend
cargo run                    # Iniciar servidor
cargo check                  # Verificar compilación
cargo clippy                 # Linter (nivel paranoia)
cargo test                   # Tests
cargo fmt                    # Formatear código
npm run check:back           # cargo check + clippy

# Frontend
npm run dev:front            # Dev server con HMR
npm run check:front          # Type-check TypeScript
npm run codegen              # Regenerar cliente API desde OpenAPI

# O directamente desde frontend/
cd frontend
npm run dev                  # Dev server con HMR
npm run build                # Build producción
npm run type-check           # Verificar tipos TypeScript
npm run codegen              # Regenerar cliente API desde OpenAPI
```

## Clippy nivel paranoia

El proyecto tiene configurado clippy en modo estricto (`[lints.clippy]` en Cargo.toml):

- `clippy::all` → **deny** (error en cualquier warning estándar)
- `clippy::pedantic` → **warn** (warnings extra para código idiomático)

Antes de cada commit: `cargo fmt --check && cargo clippy && cargo test`
