# Plan — Donaciones, transparencia y panel administrativo

**Proyecto:** ong-agame / El Proyecto Ágape  
**ID:** 118A-1  
**Fecha:** 2026-08-11  
**Estado:** Contratos, migración, landing, blog público y panel protegido implementados; campañas, pruebas
automatizadas y proveedores externos pendientes.

## Objetivo

Construir una plataforma de donaciones que permita al público aportar y comprobar el destino de los fondos,
mientras el cliente administra desde un panel privado las campañas, eventos, movimientos, evidencias,
métodos de pago y reportes publicados.

La referencia de experiencia es [Yummy Rides — transparencia](https://dona.yummyrides.com/transparency):
estado visible, total recaudado, fondos utilizados y llamada a aportar. Se toma como referencia funcional,
no se copia su código, marca ni contenido.

## Alcance funcional propuesto

### 1. Página pública de transparencia

- Resumen en vivo: total recaudado, total utilizado, saldo/pendiente y número de campañas.
- Filtros por campaña, evento, fecha y categoría de ayuda.
- Movimientos publicados: fecha, concepto, monto, moneda, campaña y evidencia pública opcional.
- Estado de cada dato: borrador, en revisión, verificado y publicado.
- CTA `Quiero aportar` con métodos disponibles y contacto.
- No mostrar nombres, teléfonos, correos ni referencias privadas de donantes.
- La primera integración ya tiene `GET /api/transparency/summary?currency=USD` y un fallback visible en React.

### 2. Panel administrativo del cliente

- Inicio con resumen de ingresos, egresos, saldo, campañas activas y pendientes de revisión.
- Campañas y eventos: nombre, objetivo, fecha, meta, descripción, estado y material público.
- Ingresos: monto, moneda, fecha, método, referencia, campaña/evento, origen opcional y evidencia.
- Gastos: monto, moneda, fecha, concepto, categoría, campaña/evento, beneficiario interno y evidencia.
- Revisión: aprobar, rechazar, devolver a borrador y publicar; publicar no debe ser automático al registrar.
- Métodos de pago: activar/desactivar, nombre público, instrucciones, moneda, cuenta destino enmascarada y
  proveedor/adaptador.
- Reportes: resumen por campaña/evento y exportación futura; la primera versión puede comenzar con vista web.
- Usuarios y permisos: administrador, editor financiero y lector/auditor, con mínimo privilegio.
- La ruta `/admin` ya existe con tabs laterales minimalistas para resumen, movimientos, contenido público,
  campañas, métodos de pago y auditoría. Incluye estados locales de activación/desactivación para validar la
  operación, pero no persiste cambios hasta conectar autenticación, roles y el ledger administrativo.

### 3. Pagos

- Primera fase: enlaces o instrucciones de pago controladas por el panel, sin asumir proveedores.
- Segunda fase: adaptadores para proveedores confirmados por el cliente, por ejemplo PayPal/Stripe si la
  entidad y las cuentas lo permiten.
- Zelle queda bloqueado hasta que exista una cuenta propia de la ONG y un flujo confirmado.
- Pagos manuales deben poder registrarse con referencia y evidencia, pero no deben aparecer publicados sin
  verificación.
- Cada webhook debe ser idempotente por `provider_event_id`; nunca duplicar ingresos por reintentos.
- PayPal y Stripe quedan representados como adaptadores automáticos pendientes de secretos de entorno y
  webhooks firmados. Pago móvil, transferencia y Zelle quedan como manuales; Zelle inicia desactivado.

## Modelo de datos inicial

### Entidades

- `admin_users`: usuario, rol, estado, hash Argon2, último acceso.
- `campaigns`: campaña/evento, meta, moneda base, periodo, estado y texto público.
- `payment_methods`: proveedor, etiqueta pública, configuración no secreta, estado y orden.
- `payment_receipts`: comprobantes manuales o confirmaciones automáticas, con idempotencia por evento externo.
- `transparency_content`: textos públicos editables para que el cliente gestione la sección de transparencia.
- `audit_events`: registro de acciones sensibles sin almacenar secretos ni payloads completos.
- `fund_entries`: ledger único de ingresos y gastos, con tipo, monto entero en unidad menor, moneda, fecha,
  concepto, campaña, método, referencia y estado de verificación.
- `evidence`: comprobante o enlace, visibilidad, hash/metadatos y relación con el movimiento.
- `audit_events`: actor, acción, entidad, metadata, fecha y razón opcional.
- `blog_posts`: slug, título, resumen, cuerpo de texto plano, estado, portada opcional y fechas de publicación.
- `provider_events`: proveedor, identificador único, payload normalizado, estado de procesamiento y error.

### Invariantes

- Dinero en enteros de unidad menor; prohibidos `float` para importes.
- Moneda explícita en cada ingreso y gasto; no mezclar USD/VEF sin conversión visible y fuente de tasa.
- Solo movimientos `verified` y `published` alimentan los agregados públicos.
- Un movimiento publicado no se elimina físicamente: se corrige mediante reverso/ajuste auditable.
- Toda acción administrativa sensible genera evento de auditoría.
- La suma pública debe poder reproducirse desde el ledger filtrado.

## Arquitectura técnica

- Backend Rust/Axum existente, con módulos de dominio separados para transparencia, pagos y administración.
- PostgreSQL con migraciones SQLx y constraints únicas para idempotencia.
- OpenAPI como contrato; generar cliente React con Orval en modo dividido por tags.
- React/Vite: rutas públicas y `/admin`, React Query para servidor y Zustand solo para estado de sesión/UI.
- Tailwind CSS se usa en el panel mediante primitives reutilizables; la landing conserva sus tokens visuales
  propios y no depende de Glory RS.
- `glory-rs` se mantiene agnóstico; el código específico de Ágape se queda en el proyecto.
- Secrets de proveedores solo en variables de entorno/secret manager; nunca en el panel ni en el frontend.

## Fases de implementación

### Fase A — Contrato y seguridad

1. Confirmar proveedor(es), cuentas, monedas, dominio y roles con el cliente.
2. Definir OpenAPI, estados, permisos, política de publicación y retención de evidencias.
3. Crear migraciones, constraints e índices; incluir fixtures de ingresos/gastos positivos y negativos.

### Fase B — Panel sin pagos externos

1. ✅ Autenticación administrativa y autorización por rol.
2. ✅ Métodos de pago informativos, recibos manuales y movimientos con revisión.
3. ✅ Flujo de revisión/publicación y auditoría.
4. ✅ Editor de contenido de transparencia y blog público con publicación separada.
5. CRUD de campañas, reportes y pruebas de autorización, validación de dinero, concurrencia e idempotencia.

### Fase C — Transparencia pública

1. Endpoint agregado seguro y página pública de movimientos publicados.
2. ✅ Página `/transparency` inspirada en la referencia, con datos reales del ledger y métodos habilitados.
3. Estados vacíos, `EN ACTUALIZACIÓN`, errores visibles y responsive desde 320px.
4. Prueba de que datos borrador/rechazados y PII nunca llegan al endpoint público.

### Fase D — Proveedores de pago

1. Implementar un adaptador por proveedor confirmado.
2. Crear checkout/enlace, retorno, webhook firmado y deduplicación.
3. Conciliación entre pago externo, movimiento interno y campaña.
4. Pruebas con sandbox antes de cualquier entorno real.

El proyecto ya deja el registro de capacidades y las variables de entorno preparadas; el checkout y los
webhooks reales se mantienen pendientes hasta recibir las credenciales, cuenta legal y contrato del proveedor.

### Fase E — Reportes y operación

1. Exportación CSV/PDF si el cliente la confirma.
2. Alertas para movimientos pendientes y errores de webhook.
3. Copias de seguridad y procedimiento de restauración.
4. Revisión de privacidad, accesibilidad, rendimiento y guía operativa del cliente.

## Fuera del primer alcance

- `Juega y gana`, rifas, sorteos y tarjetas pagadas: requiere una fase propia de requisitos legales, reglas,
  auditoría, pagos y tratamiento fiscal.
- Portal de la iglesia y transmisión de oraciones: proyecto separado.
- Integración Zelle: bloqueada hasta contar con cuenta y contrato operativo.
- Subida pública de comprobantes o datos de donantes: no permitida sin modelo de privacidad y moderación.

## Criterios de aceptación

- Un administrador puede crear una campaña y registrar un ingreso/gasto sin publicar datos incompletos.
- Un revisor puede verificar y publicar; un lector no puede modificar.
- La página pública refleja solo movimientos publicados y sus agregados son reproducibles.
- Reintentar el mismo webhook no duplica fondos.
- Los cambios administrativos quedan auditados.
- Las pruebas cubren autorización, importes, monedas, estados, privacidad e idempotencia.
- El flujo funciona en móvil, tablet y escritorio y tiene mensajes de error visibles.
