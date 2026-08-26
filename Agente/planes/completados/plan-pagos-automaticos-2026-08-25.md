# Plan — Configuración coherente y configurable de PayPal/Stripe

**Proyecto:** ong-agame / El Proyecto Ágape
**ID:** 118A-1 (checkbox "Activar adaptadores PayPal/Stripe")
**Fecha:** 2026-08-25
**Estado:** ✅ COMPLETADO (2026-08-25). Implementación verificada E2E en modo simulado; gate Sentinel PASS. Pendiente solo la activación real con cuentas/contrato del cliente.

## Objetivo

Que PayPal y Stripe dejen de ser "simulación" y pasen a ser métodos automáticos
**configurables desde el panel** y con un flujo de pago coherente: checkout
server-side, confirmación por webhook idempotente, recibo aprobado automático,
ingreso en el libro de transparencia y confirmación en el front. Ambos proveedores
comparten el mismo contrato y la misma UI, diferenciándose solo por sus credenciales.

## Requisito del cliente: configuración self-service

El cliente (sin depender de un programador) debe poder **completar él mismo la
configuración de PayPal y Stripe desde el panel**. Eso condiciona el diseño:

- El panel (rol Owner) edita los campos **públicos** (identificador, entorno,
  moneda, etiqueta) Y los **secretos** (Client Secret, Webhook ID, Secret Key,
  Webhook Secret) con campos de formulario claros y ayuda por proveedor.
- Los secretos se **guardan en la BD** (columna `provider_secrets` en
  `payment_methods`) para que el cliente los deje persistidos sin tocar el
  servidor. Son **solo-escritura**: el backend jamás los devuelve al frontend
  (siempre `#[serde(skip_serializing)]` y, si el panel los muestra, enmascarados
  con indicador "configurado ✓").
- Las **variables de entorno siguen funcionando como override** (producción):
  si existe la env var, tiene prioridad; si no, se usa el secreto guardado en BD.
- Salvaguardas: solo rol Owner edita secretos; se registra auditoría
  (`payment_method.updated`); el endpoint público nunca expone ni `provider_config`
  ni `provider_secrets` (solo `ready`).

## Restricciones que condicionan el diseño

- **No conectar pagos reales ni escribir en proveedores externos** hasta tener
  confirmación explícita de proveedor, cuenta y contrato (nota del roadmap + regla
  `no-deploy-implicito`). Por eso el adaptador real se implementa detrás de una
  puerta de credenciales: sin secretos (ni en BD ni en env), el checkout opera en
  **modo simulado verificable** que recorre TODO el flujo (orden → webhook → recibo →
  feed/transparencia) sin tocar la red.
- **Secretos nunca al frontend ni en respuestas** (regla `no-secrets`). El
  almacenamiento en BD es solo-escritura; la serialización está prohibida a nivel
  de modelo (`skip_serializing`). En producción, las env vars reemplazan a la BD.
- Zelle queda fuera (no tiene cuenta propia). Moneda automática: USD.

## Diseño coherente

### 1. Configuración (coherente entre PayPal y Stripe)

Se separa lo público de lo secreto:

| Aspecto | PayPal | Stripe | Dónde vive |
|---|---|---|---|
| Identificador público | `client_id` | `publishable_key` | `provider_config` (JSONB, columna en `payment_methods`) |
| Entorno | `environment` = sandbox/live | `environment` = sandbox/live | `provider_config` |
| Moneda | `currency` (USD) | `currency` (USD) | `provider_config` |
| Etiqueta de cuenta | `account_label` (opcional) | `account_label` (opcional) | `provider_config` |
| Secreto | `client_secret` | `secret_key` | `provider_secrets` (JSONB, solo-escritura) |
| Firma webhook | `webhook_id` | `webhook_secret` | `provider_secrets` (JSONB, solo-escritura) |

- El panel (rol owner) edita ambos grupos; el backend valida coherencia por
  proveedor (p. ej. `environment` solo acepta `sandbox`/`live`).
- `automatic_provider_ready` exige: campos públicos en `provider_config` + secretos
  (BD o env). Si falta algo, el método sigue `setup_required` y el backend lo
  bloquea al intentar habilitarlo (ya existía ese bloqueo; se amplía la
  comprobación).
- El endpoint público `/api/payment-methods` NO expone `provider_config` ni
  `provider_secrets`: el público solo ve `ready` (bool) para saber si el método
  automático acepta pagos.

### 2. Flujo de pago automático (un solo contrato para ambos)

```
Donante elige monto+datos y método automático habilitado
  → POST /api/payments/checkout  {payment_method_id, amount_minor, currency,
                                   donor_name, donor_email, success_url}
  → backend: valida método (automatic+enabled+ready), crea orden del proveedor
    (real si hay credenciales; simulado si no), guarda el intento y devuelve
    { reference, checkout_url, simulated }
  → el front redirige a checkout_url (real) o al modal de simulación (simulado)
  → el proveedor (o el simulador local) confirma
  → POST /api/payments/webhooks/:provider  (firma verificada; body normalizado)
  → backend: idempotente por provider_event_id (índice único ya existente),
    crea recibo `approved` + ingreso `verified` al ledger en la misma transacción
  → el front, al volver con ?reference=..., consulta
    GET /api/payments/checkout/:reference y muestra el recibo/estado
```

- **Idempotencia**: el índice `idx_payment_receipts_provider_event` (único por
  método+evento) ya existe; el webhook usa `INSERT ... ON CONFLICT DO NOTHING` y
  responde 200 aunque el evento ya se procesara (los proveedores reintentan).
- **Simulación verificable**: sin secretos (ni en BD ni en env), `POST /api/payments/
  checkout` devuelve `simulated: true` con una `checkout_url` local, y un endpoint
  `POST /api/payments/simulate/:reference` (solo activo en simulación) completa el
  pago disparando el mismo pipeline del webhook. Así se verifica E2E recibo → feed
  en vivo → transparencia sin tocar proveedores.
- **Recibo automático**: nace `approved` (el proveedor ya verificó el pago), con
  `provider_reference` = referencia de la orden y `provider_event_id` = id del
  evento; el ingreso `Donación recibida` se registra `verified` en el ledger
  (reutilizando la transacción de `review_receipt`).

### 3. Adaptador por proveedor (Rust)

Nuevo módulo de servicio (amplía `services/payments.rs`):

- `create_checkout(provider, monto, moneda, donante, correo, success_url) -> Orden`
  - PayPal: `POST /v1/oauth2/token` (client credentials) + `POST /v2/checkout/orders`
    con `intent: CAPTURE`, `purchase_units` y `application_context` (return/cancel).
    `checkout_url = approve` del `links`.
  - Stripe: `POST /v1/checkout/sessions` con `mode: payment`, `success_url`/
    `cancel_url`, `line_items`, `metadata`.
  - Sin credenciales → devuelve una orden simulada (`reference` con prefijo
    `SIM-`, `checkout_url` a la página de simulación local).
- `verify_webhook(provider, headers, body) -> Evento normalizado`:
  - PayPal: transmisión firmada (headers `PAYPAL-TRANSMISSION-*` + `PAYPAL-WEBHOOK-ID`)
    y verificación HMAC/llamada a la API de webhooks.
  - Stripe: `Stripe-Signature` (timestamp + firma HMAC con `STRIPE_WEBHOOK_SECRET`).
  - Simulación: token interno de simulación.
- `handle_event(evento) -> ()`: normaliza `COMPLETED`/`checkout.session.completed` →
  recibo aprobado idempotente + ingreso al ledger.
- Los secretos se resuelven con prioridad: **env var → BD (`provider_secrets`)**.
- Dependencia nueva: `reqwest` como dependencia normal (adaptador HTTP). El wrapper
  `run-with-db.mjs` ya fija `CARGO_TARGET_DIR` en `C:\tmp`.

### 4. Frontend panel — configuración de automáticos

`ModalEditarMetodo.tsx`: cuando `metodo.mode === 'automatic'`, se muestra la sección
"Configuración del proveedor" con campos según proveedor:
- PayPal: Client ID, Client Secret, Webhook ID, Entorno (sandbox/live), Moneda,
  Nombre de cuenta.
- Stripe: Publishable key, Secret key, Webhook secret, Entorno (sandbox/live),
  Moneda, Nombre de cuenta.
- Los secretos se muestran con indicador "configurado ✓ / pendiente" y un campo
  para escribir el nuevo valor (o limpiarlo); el backend nunca devuelve el valor
  existente.
- Aviso fijo: "Guarda aquí los datos de tu cuenta del proveedor. Los valores
  secretos no se muestran de nuevo por seguridad."
- `cuerpoPeticion` envía esos campos; el handler los fusiona en `provider_config`
  (público) y `provider_secrets` (solo-escritura).

`VistaMetodos.tsx`: muestra el entorno configurado y el estado de readiness
(configuración completa / pendiente) y un botón "Editar" que abre el modal.

### 5. Frontend donar — flujo automático

- `MetodoPagoPublico` gana `ready: boolean` (solo para automáticos; el backend lo
  calcula). `metodoOperativo` pasa a: manual+enabled (flujo actual con comprobante)
  o automatic+enabled+ready (flujo checkout).
- `Donar.tsx`: si el método activo es automático operativo, el botón "Donar" abre el
  modal que llama a `/api/payments/checkout` y redirige a `checkout_url`. En modo
  simulado el modal muestra el panel de simulación con "Completar pago de prueba",
  que llama a `/api/payments/simulate/:reference` y muestra la confirmación con el
  recibo.
- `ModalDatosPago.tsx`: para automáticos muestra el resumen del pago (monto, método)
  y el botón de pago seguro (o el panel de simulación), sin comprobante (no aplica).
- Confirmación: `GET /api/payments/checkout/:reference` devuelve estado del recibo
  (approved/pending/...), monto y referencia para la pantalla de gracias.

## Fases de implementación (verificables)

1. **Migración** `20260825000000_automatic_payment_config`: columnas
   `provider_config` (público) y `provider_secrets` (solo-escritura) en
   `payment_methods` + tabla `checkout_intents` (+ down). Recordar: tras añadir
   migración, `sqlx::migrate!` embebe en compilación → tocar `src/main.rs` para
   forzar recompilación.
2. **Modelos** `models/admin.rs`: `PaymentMethodRecord` gana `provider_config` y
   `provider_secrets` (este último con `#[serde(skip_serializing)]`); `has_secrets`
   calculado en SQL; `PublicPaymentMethod` gana `ready` y descarta ambos;
   `UpdatePaymentMethodRequest` gana `client_id`, `publishable_key`, `environment`,
   `currency`, `account_label` (públicos) y `client_secret`, `webhook_id`,
   `secret_key`, `webhook_secret` (secretos, opcionales, solo escritura).
3. **Servicio** `services/payments.rs`: config por proveedor,
   `automatic_provider_ready` ampliado (env → BD), adaptador checkout (real/simulado),
   verificación de webhook (real/simulado), normalización de eventos. Añadir
   `reqwest`.
4. **Repositorio** `repositories/payment.rs`: incluir `provider_config` y
   `provider_secrets` en SELECTs (admin) y en `update_method`; métodos
   `get_checkout`, `create_checkout` (intento), `apply_automatic_event`
   (recibo+ledger idempotente), `get_receipt_by_reference`.
5. **Handlers** nuevo `handlers/payments.rs` + registro en `handlers/mod.rs` y
   OpenAPI: `POST /api/payments/checkout`, `POST /api/payments/webhooks/:provider`,
   `POST /api/payments/simulate/:reference`, `GET /api/payments/checkout/:reference`.
   Ampliar `update_payment_method` (admin) para fusionar `provider_config` y
   `provider_secrets` con validación por proveedor y auditoría.
6. **Frontend panel**: `ModalEditarMetodo` (campos automáticos públicos + secretos
   con indicador "configurado/pendiente") + `VistaMetodos` (entorno/readiness).
   `MetodoPagoAdmin` gana los campos.
7. **Frontend donar**: `donarApi` (checkout/simular/estado), `Donar.tsx`,
   `ModalDatosPago.tsx` (flujo automático + simulación).
8. **Verificación**: type-check (0 errores), build backend, flujo E2E en navegador:
   configurar PayPal/Stripe en panel (sandbox, sin tocar el servidor) → habilitar →
   donar con método automático → completar pago simulado → recibo aprobado aparece
   en `VistaRecibos` y en el feed en vivo / transparencia.
9. **Gate y cierre**: `npm run quality:doctor` + `npm run gate:check -- <TareaId>`;
   actualizar roadmap (marcar avance de 118A-1), completados y lecciones.

## Definition of Done

- [x] El cliente configura ambos métodos automáticos desde el panel (campos públicos
      + secretos) sin tocar el servidor, con validación coherente por proveedor.
- [x] Los secretos se guardan en BD solo-escritura, nunca se serializan al frontend
      ni en respuestas; readiness visible en el panel.
- [x] `POST /api/payments/checkout` crea orden (real con credenciales, simulada sin
      ellas); idempotente y con estados claros.
- [x] Webhook verificado (firma real o simulación) procesa el evento una sola vez y
      crea recibo `approved` + ingreso `verified` al ledger.
- [x] El front de donar ofrece el flujo automático y muestra la confirmación con la
      referencia del recibo.
- [x] Flujo E2E simulado verificado en navegador (recibo → feed → transparencia).
- [x] Type-check frontend 0 errores; build backend OK; gate Sentinel PASS.

## Evidencia del cierre (2026-08-25)

- E2E simulado vía API y navegador verificado (recibo approved + transparencia).
  Detalle en `Agente/completados/tareas-2026-08-25.md`.
- Gate: `npm run gate:check -- 118A-1 --stages sentinel-stages.json` → **PASS**
  (exit 0; sentinel-analyze, backend-check, backend-clippy, frontend-typecheck).
  Reporte: `.quality-reports/check/118A-1/latest.json`.
- Adapter de stages creado: `sentinel-stages.json`, `scripts/stage-report.mjs`,
  `scripts/stage-analyze.mjs` (el proyecto no tenía manifest declarativo).

## Pendiente de confirmación del cliente (no bloquea la implementación del modo simulado)

- Cuentas reales de PayPal/Stripe y contrato de la ONG (para completar los secretos
  desde el panel y pasar de simulación a producción; en producción pueden usarse
  env vars como override).
