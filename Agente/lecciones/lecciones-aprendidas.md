# Lecciones aprendidas

## 2026-05-08 — Core editor-agnostico en extensiones
- Para extraer un core real no basta cambiar tipos: hay que eliminar imports indirectos de servicios del editor, como `configService`, `vscode.workspace` o registries que lean settings globales.
- Si una regla aun necesita workspace/watchers, aislarla como callback/adaptador permite avanzar el core sin romper el provider existente.
- Los reportes y scanners deben recibir datos y providers como parametros; escribir archivos, abrir documentos y escuchar watchers pertenece al adaptador, no al core.
- Las pruebas unitarias con mocks de VS Code no garantizan que una CLI arranque en Node puro; despues de compilar hay que ejecutar el JS real y buscar imports indirectos de `vscode`.

## 2026-05-10 — LSP y lint como cierre de arquitectura
- Un LSP fino debe importar core y adaptadores de transporte, no la CLI; si CLI y LSP comparten defaults, moverlos a `core/config.ts` evita drift silencioso.
- Smoke stdio real debe buscar `textDocument/publishDiagnostics` y un `ruleId` esperado; compilar no prueba que el entrypoint LSP no este ejecutando codigo CLI.
- Activar lint tarde puede revelar errores de regex antiguos. Corregir escapes redundantes es bajo riesgo; patrones Unicode compuestos intencionales necesitan excepcion local documentada.
- Si se agregan fixtures `.tsx` fuera de `src`, `tsconfig.json` debe declarar `include` explicito; si no, `tsc` intenta compilar fixtures fuera de `rootDir` y crashea antes de ejecutar tests reales.

## 2026-08-22 — Panel v2, aliados, campañas y donar
- El carrusel infinito requiere dos copias del grupo de logos y `translateX(-50%)`; el
  `padding-right` de cada grupo debe ser **igual** al `gap` interno para que el bucle
  no tenga salto. Un solo grupo con `translateX(calc(-50% - gap/2))` deja un hueco
  blanco en el límite de la copia.
- Una única campaña en estado `active` basta como meta global de `/donar`: el título
  de la meta = nombre de la campaña y el monto = `goal_minor`. Evita duplicar estado
  entre tablas cuando una entidad ya modela el dato.
- Los recibos aprobados con `donor_name` son la fuente natural de "donaciones en
  vivo": no hace falta una tabla nueva, solo un endpoint público `LIMIT n ORDER BY
  received_at DESC`. El nombre del donante pasa a ser obligatorio en el formulario.
- Al verificar con el navegador, recargar la página del panel conserva la sesión
  (`sessionStorage`), pero las peticiones de datos que se abortean durante la
  navegación (`ERR_ABORTED`) pueden dejar secciones vacías temporalmente; recargar
  o re-navegar resuelve.
- Los nuevos endpoints (públicos y admin) deben registrarse en tres sitios del
  backend: router (`api_routes()`), OpenAPI `paths(...)` y `components(schemas(...))`;
  olvidar cualquiera rompe el Swagger o el contrato tipado del front.

## 2026-08-25 — Configuración self-service de pagos y gate con stages
- La configuración de PayPal/Stripe debe separar lo público (`provider_config`) de lo
  secreto (`provider_secrets`, solo-escritura con `#[serde(skip_serializing)]`). La
  prioridad de secretos es **env var → BD**; sin credenciales el checkout opera en
  modo simulado verificable que recorre TODO el flujo sin tocar la red.
- `sentinel check` real exige un manifest declarativo `--stages <json>` (el proyecto
  nunca lo tuvo; el alias `gate:check` es `sentinel check` directo). El manifest solo
  sustituye `{reportPath}`; el adapter de etapas es responsabilidad del consumidor.
- Gotcha Windows (shims de GlorySentinel): en `PATH` hay shims interceptores
  (`C:\Users\Owner\AppData\Local\GlorySentinel\shims\npm.cmd`, `node.cmd`) que NO son
  el binario real y rompen `spawn`/`execFile` con `spawn EINVAL`. Para lanzar
  herramientas en scripts del gate:
  - `node` → `process.execPath` (inmune a shims).
  - `npm` → `node <npm-cli.js>` (`C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`).
  - `sentinel` → `node <GlorySentinel>/current.js` (el shim `.cmd` no se lanza con execFile).
  - `where.exe` puede devolver el binario sin extensión (script sh) antes que el `.cmd`;
    excluir los shims de GlorySentinel y preferir `.exe`/`.cmd`.
- El contrato del reporte de etapa del gate: JSON `{schemaVersion:"1", entries:[{findings:
  [{ruleId,severity,message}]}]}`; el proceso debe salir con 0 siempre (los findings con
  severity `error` hacen FAIL; un exit != 0 es tool-error = SETUP ERROR). Un wrapper
  `stage-report.mjs` que normaliza cualquier comando del stack a ese contrato es la
  pieza clave del adapter de stages.
