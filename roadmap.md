Objetivo: convertir la base `glory-rs-template` en `ong-agame`, una aplicación Rust + React para El Proyecto Ágape, con landing pública y un sistema verificable de donaciones, transparencia y administración.

## Estado: ✅ Base del template, landing React, blog público, página de donación y panel protegido listos; proveedores externos pendientes

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

### 218A-1 — Frontend v2: página de donación `/donar` + panel administrativo con login (completada, 2026-08-22)

Pedido del cliente: al hacer clic en "Quiero ayudar" abrir una página de donación
similar a [dona.yummyrides.com](https://dona.yummyrides.com/) pero con el estilo v2
(píldora, Playfair/Rubik, tarjetas). Incluye panel + login para que el cliente
administre blog, métodos de pago y donaciones.

Alcance de esta tarea:
- [x] Página pública `/donar` en frontend-v2: selector de monto (presets + "otro"),
  datos del donante (nombre opcional + correo), métodos de pago habilitados desde
  `/api/payment-methods`, instrucciones del método manual y confirmación de aporte.
- [x] Cablear los botones "Quiero ayudar" / "Sé parte del cambio" (nav, hero, pie) a `/donar`.
- [x] Panel administrativo migrado a frontend-v2: login (JWT), rutas protegidas por rol
  (owner/finance_editor/auditor/viewer) y gestión de blog, recibos/donaciones,
  métodos de pago y transparencia reutilizando los endpoints `/api/admin/*` existentes.
- [x] Sin adaptadores PayPal/Stripe reales ni escrituras en proveedores externos
  (requiere confirmación explícita del cliente; regla del plan 118A-1).
- [x] Sin registro público abierto para el panel: alta de usuarios solo desde BD/owner.

### 226A-2 — Fase C de `/donar`: carrusel infinito, comprobante en la donación, datos de pago configurables y simulación de métodos (completada, 2026-08-22)

Pedido del cliente (Fase C): convertir las donaciones en vivo en un carrusel
infinito con solo nombres de pila, que el bloque "meta donar" tenga el mismo
ancho que el formulario, que el comprobante no se envíe por correo sino adjunto
en la misma donación, que los datos de pago móvil/transferencia sean modificables
desde la configuración y aparezcan en un modal al donar, y que se muestren todos
los métodos de pago (de momento en simulación).

- [x] Carrusel infinito de donaciones en vivo con solo nombres de pila (~6 entradas),
  reutilizando el patrón de Aliados (`.cintaDonaciones` + `.pistaDonaciones` +
  `translateX(-50%)` + `mask-image` + `prefers-reduced-motion`).
- [x] `.metaDonar` con el mismo ancho que `.donarFormulario` (`min(100%, 720px)`).
- [x] El comprobante se adjunta en la misma donación (multipart `POST /api/donations`),
  no se envía por correo; el backend lo valida (imagen/PDF ≤5MB), lo guarda en
  `/uploads` y crea el recibo en `pending_verification`.
- [x] Datos de pago móvil/transferencia modificables desde el panel (modal de
  edición de método) y visibles en la página de donar en un modal ("Ver datos de
  pago").
- [x] Verificación de la donación con los distintos tipos de pago: flujo completo
  donación → `pending_verification` → aprobación en panel → aparece en el carrusel.
- [x] Todos los métodos de pago visibles en `/donar` (PayPal/Stripe en simulación
  con "· Próximamente"; manuales habilitados operativos).
  - Ajuste 2026-08-25: eliminados los métodos cripto simulados (Binance Pay, Airtm,
    USDT) por decisión del cliente (no necesarios). Quedan PayPal, Stripe, Pago
    móvil, Transferencia bancaria y Zelle. Detalle: `Agente/completados/tareas-2026-08-25.md`
    (migración `20260828000000`).
  - Ajuste 2026-08-25: acciones de transparencia (como
    [dona.yummyrides.com/transparency](https://dona.yummyrides.com/transparency))
    — sección "Así se está usando tu ayuda" en `/donar` con las 3 acciones más
    recientes, página `/acciones` con todas, modal de detalle (título, descripción,
    imágenes) y gestión desde el panel (pestaña "Acciones": editar, publicar/ocultar).
    Seed con 6 acciones de ejemplo publicadas. Detalle:
    `Agente/completados/tareas-2026-08-25.md` (migración `20260829000000`).

### 268A-1 — Pulido del panel admin: alertas personalizadas, botones-icono, borrado y ajustes de estilo (completada, 2026-08-26)

Pedido del cliente: alertas como componente personalizado, botones de acciones de las tablas
como iconos, poder borrar acciones/campañas/blogs, chip de estado con texto centrado, botón
"Ver comprobante" que diga solo "Ver" y fuente más pequeña en el nav del panel.

- [x] Componente `AlertaPanel` (`src/components/ui/`) aplicado a las 10 vistas del panel.
- [x] Componente `IconoAccion` (SVG) para los botones de acción de las tablas.
- [x] Endpoints DELETE + botones de borrado con confirmación en Acciones, Blog y Campañas
  (`/api/admin/transparency/entries/:id`, `/api/admin/blog/posts/:id`, `/api/admin/campaigns/:id`).
- [x] `.panelEstadoChip` centrado, botón "Ver comprobante" → "Ver", nav del panel con fuente menor.
- [x] Type-check 0 errores; DELETE verificado por API (204/404) + auditoría; vistas verificadas en navegador.
- Detalle: `Agente/completados/tareas-2026-08-26.md`.

### 268A-2 — Panel admin: toasts, confirmación de borrado personalizada y actualización en tiempo real (completada, 2026-08-26)

Pedido del cliente: las acciones del panel carecían de actualización en tiempo real, notificaciones
toast y confirmación de borrado. Se añadieron las tres cosas.

- [x] Sistema global de toasts (`ToastProvider` + `useToast()`, auto-cierre 4 s, tipos éxito/error/info).
- [x] Modal de confirmación de borrado personalizado (`ConfirmarProvider` + `useConfirmar()`,
  basado en promesas) que reemplaza al `window.confirm` nativo.
- [x] Refresco automático por pestaña visible (`useRefresco`): 30 s en la mayoría de vistas, 20 s en
  Recibos, ninguno en Nuestra historia (protege el formulario en edición).
- [x] Integrado en las 8 vistas del panel (se retiró el aviso local de éxito → toast).
- [x] Type-check 0 errores; verificado en navegador: toast, cancelar/confirmar borrado (fila real
  borrada en BD), y la campaña insertada en BD apareció sin recargar (polling).
- Detalle: `Agente/completados/tareas-2026-08-26.md`.

### 268A-3 — Fix carruseles SPA: rotación detenida al cambiar de página sin recargar (completada, 2026-08-26)

Pedido del cliente: al pasar de una página a otra sin recargar, el carrusel de donaciones
(`.pistaDonaciones` en `/donar`) dejaba de rotar. Se revisó todo el recorrido SPA.

- [x] Renombrados los keyframes colisionados: `desplazarPista` (duplicado en `Donar.css` y `Aliados.css`)
  → `desplazarDonaciones` (60 s) y `desplazarAliados` (55 s).
- [x] Reinicio condicional de la animación al remontar en SPA (doble RAF + Web Animations API:
  solo reinicia si `idle`/`paused`/ausente), en `CarruselDonaciones.tsx` y `Aliados.tsx`.
- [x] Type-check 0 errores; verificado en navegador: carrusel de donaciones arranca en cada remontaje
  (3 ciclos SPA), aliados se mueve al volver de `/blog/:slug`, y recorrido completo
  `/` → `/donar` → `/acciones` (modal) → `/blog/:slug` → `/admin` (tabs) → `/` sin recarga.
- Detalle: `Agente/completados/tareas-2026-08-26.md`.

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
- [x] Implementar CRUD administrativo de campañas (2026-08-22): tablas
  `campaigns`, endpoint `/api/admin/campaigns` + `/api/campaigns` público, y vista
  `Campañas` en el panel con alta/edición/activar/completar. Pendiente: reportes y
  exportaciones.
- [x] Completar página pública de transparencia con resumen, movimientos publicados y métodos habilitados.
- [ ] Activar adaptadores PayPal/Stripe con credenciales, checkout y webhooks idempotentes; Zelle queda fuera hasta tener cuenta propia.
  - [x] Diseñar configuración coherente y configurable de PayPal/Stripe (campos públicos en panel, secretos solo en entorno; checkout, webhook idempotente, recibo y ledger unificados). Plan: `Agente/planes/completados/plan-pagos-automaticos-2026-08-25.md` (2026-08-25).
  - [x] Implementar columna `provider_config` + modelos/servicio adaptador (checkout real/simulado, verificación webhook).
  - [x] Implementar endpoints checkout/webhook/confirmación con idempotencia por `provider_event_id`.
  - [x] Panel: configuración de automáticos (client_id/publishable_key, entorno, moneda) solo rol owner.
  - [x] Front de donar: flujo automático (redirección a checkout o simulación verificable) y confirmación de recibo.
  - [x] Verificar E2E simulado (recibo → feed en vivo → transparencia) y gate Sentinel.
- [x] Añadir auditoría, validaciones iniciales, separación de secretos y controles de privacidad en DTOs públicos.
- [ ] Añadir pruebas automatizadas de autorización, estados, idempotencia, responsive QA y privacidad.
- [ ] Planificar “Juega y gana” como fase separada después de revisar legalidad de rifas/sorteos pagados.

## Notas

- Configurar coolify-manager-rs para desplegar proyectos Rust (repo separado)
- La referencia visual/funcional de transparencia es [dona.yummyrides.com/transparency](https://dona.yummyrides.com/transparency).
- No conectar pagos reales ni escribir en proveedores externos hasta tener confirmación explícita de proveedor, cuenta y contrato.
- **Gate de Sentinel operativo (2026-08-20, commit `71a13e8`):** `sentinel.config.json`
  (`schemaVersion: 2`, `mode: enforce`, `primaryBranch: ong-agape`) + `sentinel.lock.json`
  bootstrap con `sentinel init --preset mixed`. `sentinel doctor` → `readyForGate: true`.
  Autoridad de cierre: `npm run quality:doctor` / `sentinel check <TareaId>`.
- Prioridades: 1. Velocidad desarrollo, 2. Decisiones futuras, 3. Rendimiento, 4. Seguridad, 5. Popularidad, 6. Facilidad, 7. Docs, 8. Compatibilidad, 9. Flexibilidad, 10. Escalabilidad

