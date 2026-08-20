Objetivo: convertir la base `glory-rs-template` en `ong-agame`, una aplicación Rust + React para El Proyecto Ágape, con landing pública y un sistema verificable de donaciones, transparencia y administración.

## Estado: ✅ Base del template, landing React, blog público y panel protegido listos; proveedores externos pendientes

Ver `Agente/completados/tareas-2026-03-25.md` para detalles.

## Stack implementado

| Capa | Herramienta |
|------|-------------|
| Framework web | Axum 0.7 |
| OpenAPI | utoipa 4 + utoipa-swagger-ui 7 |
| Serialización | serde |
| Base de datos | SQLx 0.8 (PostgreSQL) |
| Migraciones | SQLx migrate |
| Validación | validator 0.18 |
| Variables de entorno | dotenvy |
| Logging | tracing + tracing-subscriber |
| Errores | thiserror 2 |
| Auth | jsonwebtoken + argon2 |
| CORS | tower-http |
| Linter | clippy (deny all + warn pedantic) |
| Frontend | React 18 + TypeScript + Vite |
| Panel UI | Tailwind CSS 3 |
| State | React Query + Zustand |
| Codegen | Orval 8 (reemplaza openapi-typescript-codegen) |

## Pendientes

### 128A-1 — Frontend v2 desde cero (construcción por sesiones)

Plan: `Agente/planes/plan-frontend-v2-2026-08-12.md`.

- [x] Crear `frontend-v2/` (React + Vite + TS) con scaffold mínimo verificado, sin tocar `frontend/` (referencia).
- [x] Archivar el bloque de landing (misión, alianzas, llamado a donación) en `src/archivado/landing-v1/` como referencia (2026-08-19).
- [x] Construir la landing y páginas del frontend v2 por bloques supervisados.
  - [x] Sesión 2: bloque de misión verde pastel, tarjetas 50/50 de igual altura, gap compacto y hero centrado.
  - [x] Sesión 3: "Nuestra historia" + galería.
  - [x] Sesión 4 (2026-08-20): sección de blog con 3 posts de ejemplo (seed en BD, consumido vía `/api/blog`), tarjetas con portada/fecha/extracto y CTA Instagram; responsive 3→1 columna.
  - [x] Sesión 5 (2026-08-20): página individual de historia como ruta real `/blog/:slug` con react-router (URL propia, compartible y recargable; commit `ecd9a00`). Anclas de nav/pie corregidas a `/#nosotros`.
- [ ] Decidir cuándo `frontend-v2` reemplaza a `frontend/`.

### 118A-1 — Donaciones, transparencia y panel administrativo

Plan detallado: `Agente/planes/plan-donaciones-transparencia-2026-08-11.md`.

- [ ] Confirmar con el cliente entidad legal, dominio definitivo (`.org`/`.ong`), monedas y proveedores de pago.
- [x] Diseñar ledger inicial de ingresos/gastos, evidencias y estados de publicación.
- [x] Preparar endpoint público de resumen y migración inicial de `transparency_entries`.
- [x] Montar vista preliminar `/admin` para validar la operación del panel.
- [x] Añadir tabs laterales, contenido público, métodos automáticos/manuales y auditoría como UI reutilizable.
- [x] Añadir contratos agnósticos de proveedores y tablas de `payment_methods`/`payment_receipts`.
- [x] Implementar autenticación JWT, roles owner/editor/auditor/lector y rutas protegidas en Rust + React.
- [x] Implementar gestión administrativa de movimientos, recibos manuales, métodos de pago, contenido de transparencia y auditoría.
- [x] Añadir página pública de rendición con movimientos publicados y métodos de aporte habilitados.
- [x] Añadir formularios del panel para registrar recibos manuales y movimientos, con flujo verificar → publicar.
- [x] Implementar blog público y editor administrativo con borradores, publicación separada y texto plano seguro.
- [ ] Implementar CRUD administrativo de campañas y reportes/exportaciones.
- [x] Completar página pública de transparencia con resumen, movimientos publicados y métodos habilitados.
- [ ] Activar adaptadores PayPal/Stripe con credenciales, checkout y webhooks idempotentes; Zelle queda fuera hasta tener cuenta propia.
- [x] Añadir auditoría, validaciones iniciales, separación de secretos y controles de privacidad en DTOs públicos.
- [ ] Añadir pruebas automatizadas de autorización, estados, idempotencia, responsive QA y privacidad.
- [ ] Planificar “Juega y gana” como fase separada después de revisar legalidad de rifas/sorteos pagados.

## Notas

- Configurar coolify-manager-rs para desplegar proyectos Rust (repo separado)
- La referencia visual/funcional de transparencia es [dona.yummyrides.com/transparency](https://dona.yummyrides.com/transparency).
- No conectar pagos reales ni escribir en proveedores externos hasta tener confirmación explícita de proveedor, cuenta y contrato.
- Prioridades: 1. Velocidad desarrollo, 2. Decisiones futuras, 3. Rendimiento, 4. Seguridad, 5. Popularidad, 6. Facilidad, 7. Docs, 8. Compatibilidad, 9. Flexibilidad, 10. Escalabilidad

