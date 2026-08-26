# Plan — Despliegue a producción (prueba temporal) en `agape.wandori.us`

**Proyecto:** ong-agame / El Proyecto Ágape
**ID:** 268A-4
**Fecha:** 2026-08-26
**Estado (2026-08-26 noche):** ✅ **DESPLIEGUE COMPLETO — `https://agape.wandori.us` PÚBLICO.**
Servicio `agape` (UUID `zgw440o8kowokcoww8s0csws`) con DNS (A agape → 66.94.100.241 en Cloudflare),
`CORS_ALLOWED_ORIGINS=https://agape.wandori.us`, cert Let's Encrypt emitido
(`CN=agape.wandori.us`), `https://agape.wandori.us/api/health` → **HTTP 200**
`{"status":"ok","version":"0.1.0"}`. `health --all` → todos los sitios saludables.
Incidentes resueltos durante el cierre: `setup-site-dns` roto (bugs 855c442/234A/6069f3f) y
regla Traefik `Host()` sin backticks en el template rust-stack (234B). Ver
`Agente/completados/tareas-2026-08-26.md` (268A-5, entrada final) y roadmap del manager.

---

## 1. Pedido

> "Commitea todo, y planifica lanzar a produccion para prueba temporal, usaremos agape.wandori.us"

- Los commits ya están hechos (rama `ong-agape`, 3 commits, árbol limpio salvo `.quality-reports/` gitignored).
- Este plan cubre el **lanzamiento a producción** en `https://agape.wandori.us` para que el cliente pruebe.

## 2. Preflight realizado (evidencia)

| Verificación | Resultado |
|---|---|
| Binario manager | `C:\tmp\glory-target\coolify-manager\release\coolify-manager.exe` (compilado 26/08, incluye fix 268A-5 ASCII + flags rust) |
| `--help` del manager | 60+ subcomandos disponibles (new, deploy-service, list, health, sync-env, setup-site-dns, switch-dns, db-migrate, env-toggle, etc.) |
| Sitios existentes | 8 (guillermo, padel, wandori, nakomi, cap, studio, kamples, glory-rest) + minecraft survival. **NO existe `agape`** |
| Sitios Rust de referencia | studio (nakomi.studio), kamples, glory-rest (restaurante.wandori.us) — todos `template: rust`, `repoUrl: glory-rs-template.git`, `gloryBranch` propia |
| Health de studio (referencia target) | `http_ok=true app_ok=true fatal_logs=false` |
| DNS `agape.wandori.us` | **Sin registros** (no resuelve) |
| Git remoto del proyecto | **Sin remotes**; la rama `ong-agape` NO existe en `glory-rs-template` ni en `glory-rs` |
| Binario del backend | `ong-agame-backend` (NO `glory-backend`) |
| Frontend activo | `frontend-v2/` (Vite :5176, build → `dist/`, 38 archivos ya compilados). `frontend/` es LEGACY |
| Backend sirve estático | **NO** — solo `ServeDir` en `/uploads`. No hay `STATIC_DIR` ni `ServeDir` del dist |
| Dockerfile en proyecto | **NO existe** (`Dockerfile`, `Dockerfile.rust` ausentes) |
| SQLx offline | Sin macros `query!`/`query_as!` (usa `sqlx::query` dinámico) → **no requiere** `.sqlx/` ni `SQLX_OFFLINE` |
| Migraciones | `sqlx::migrate!()` embebidas — corren al arrancar el binario (la nueva migración de contacto ya está compilada en el binario local) |
| Config backend | Lee `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `ADMIN_EMAILS`, `CORS_ALLOWED_ORIGINS`, `HOST` (default 127.0.0.1), `PORT` (3000), `UPLOAD_DIR` (./uploads), `RUST_LOG` |
| CORS producción | Si `CORS_ALLOWED_ORIGINS` vacío → fallback SOLO localhost → **imprescindible** fijar `https://agape.wandori.us` |
| Backend local | `GET /api/health` → `{"status":"ok","version":"0.1.0"}` (corriendo en terminal) |

## 3. VEREDICTO del preflight

```text
VEREDICTO: BLOQUEADO (plan listo; requiere autorización explícita del usuario para escrituras remotas
          y decisión sobre el repo de origen)
OBJETIVO: servicio agape en Coolify (stackUuid POR CREAR) → dominio https://agape.wandori.us
AUTORIZACIÓN: NO — solo preflight de solo lectura realizado. Toda escritura remota (crear servicio,
          push de repo, DNS, deploy, sync-env) requiere confirmación explícita por operación y objetivo.
ACCIONES: comandos exactos en §5 (preparados, no ejecutados)
EVIDENCIA: §2 (estado inicial, health studio OK, DNS vacío, sin sitio agape, sin remote)
ROLLBACK: §6
PENDIENTES: §7 — decisiones del usuario antes de ejecutar
```

## 4. Bloqueos y decisiones pendientes (crítico)

### B1 — Repo de origen del código (BLOQUEANTE)
El `Dockerfile.rust` del manager hace `git clone --branch ${BRANCH} ${REPO_URL}` y construye desde ahí.
El proyecto ONG AGAPE **no tiene remoto** y la rama `ong-agape` no existe en ningún repo accesible.
**Opciones (elegir una):**
- **(a) Crear repo `1ndoryu/ong-agape` (o similar) y pushear la rama `ong-agape`** — es la vía estándar.
  Requiere: decisión del nombre del repo + autorización de push (escritura externa).
- **(b) Reusar `1ndoryu/glory-rs-template`** creando la rama `ong-agape` desde el estado actual
  (el proyecto deriva de ese template). Mezcla estado del proyecto con el template — requiere
  autorización explícita y cuidado de no pisar ramas ajenas.
- **(c) Configurar el servicio manualmente en la UI de Coolify** apuntando a otro origen.

**Recomendado: (a)** — repo dedicado, no contamina el template.

### B2 — ~~Binario desactualizado~~ RESUELTO (268A-5, 2026-08-26)
- **Causa raíz real del 422:** Coolify 4.0.0-beta.460 valida el compose decodificado con
  `mb_detect_encoding($s, 'ASCII', true)` y reporta el MISMO mensaje "should be base64 encoded"
  ante bytes >127, aunque el base64 sea válido. El template `rust-stack.yaml` tenía un `é` en un
  comentario → cualquier `new --template rust` devolvía 422.
- **Fix aplicado en el manager (rama `main`):** `create_stack`/`update_stack_compose` sanean el
  compose a ASCII puro (`template_engine::to_ascii_safe`, con tests); templates limpios; `new`
  acepta `--repo-url/--app-bin/--frontend-dir` y resuelve `{{HEALTH_PATH}}`. Verificado con POST de
  prueba contra la API real: **201 CREATED** (servicio de prueba borrado).
- El manager vive ahora en `area-trabajo/coolify-manager-rs`; el binario se compila en `C:\tmp`.
- Nota: la ayuda del binario ya lista `rust` en `--template` y los flags nuevos.

### B3 — Dockerfile/build del proyecto (BLOQUEANTE)
El `Dockerfile.rust` estándar del manager asume:
- binario `glory-backend` (ONG AGAPE es **`ong-agame-backend`**);
- build de `frontend/` (ONG AGAPE activo es **`frontend-v2/`**);
- servir `/app/dist` vía `STATIC_DIR` (el backend de ONG AGAPE **no** sirve estático);
- clonar `glory-rs-framework.git` como `glory-rs/` (el proyecto sí lo usa como submódulo).

**Opciones (elegir una):**
- **(a) Ajustar el Dockerfile.rust del manager** con `APP_BIN=ong-agame-backend` y build de
  `frontend-v2` → requiere modificar el manager (proyecto de tooling) y recompilar.
- **(b) Crear un `Dockerfile` propio en el repo ONG AGAPE** (multi-stage: node build frontend-v2 +
  rust build ong-agame-backend + runtime que sirve dist y API) y un `compose`/config Coolify que lo
  use con `dockerfile: Dockerfile` (no `Dockerfile.rust`) → más control, no toca el manager.
- **(c) Servir el frontend por separado** (estático en Cloudflare Pages/otro) y solo el API en Coolify.
  Más piezas y otro proveedor; para una prueba temporal no es lo más simple.

**Recomendado: (b)** — un `Dockerfile` en el propio proyecto, sin depender del template del manager,
y el backend sirviendo también el dist (o nginx dentro del mismo contenedor).

### B4 — Frontend estático en producción
El backend solo sirve `/uploads`. Para que `https://agape.wandori.us` muestre la SPA:
- el contenedor debe servir `frontend-v2/dist` (fallback SPA → `index.html`) y proxy `/api` y
  `/uploads` al backend; **o**
- añadir al backend un `ServeDir` del `dist` + fallback SPA (cambio de código Rust + recompilar +
  commit) — lo más simple si el Dockerfile construye dentro del mismo repo.
- Requiere que las llamadas del frontend sigan siendo relativas (`/api`, `/uploads`) — verificado:
  `fetch('/api/...')` y `proof_url` relativa (`/uploads/...`). No usa `base` absoluto.

### B5 — Variables de entorno de producción
Fijar en Coolify (env del servicio):
- `DATABASE_URL` (postgres del stack, patrón `postgres://rust_app:...@postgres-{UUID}:5432/rust_db`)
- `JWT_SECRET` (≥32 chars, generado nuevo — no reutilizar el local)
- `ADMIN_EMAILS` (vacío hasta confirmar cuenta del cliente; el alta de owner es manual en BD)
- `CORS_ALLOWED_ORIGINS=https://agape.wandori.us` (imprescindible)
- `HOST=0.0.0.0`, `PORT=3000`
- `UPLOAD_DIR=/app/uploads`
- `RUST_LOG=info` (o `glory_backend=info`)
- Paypal/Stripe: **sin credenciales** en esta prueba temporal (queda en simulación).

### B6 — DNS de `agape.wandori.us`
- El manager tiene `setup-site-dns` / `switch-dns` y Cloudflare está configurado en `dnsProviders`
  (con capability de zone). Pero el registro apunta a la IP 66.94.100.241 (target actual).
- Verificar tras crear el servicio con `setup-site-dns` (o el flujo que el manager exponga para Rust).

### B7 — Migraciones en producción (riesgo bajo)
- `sqlx::migrate!()` corre al arrancar. Es primera vez → crea el schema completo.
- Backup previo no aplica (no hay datos en producción aún). Si hubiera reintento con volumen
  persistente y checksums viejos, aplicar lección de `deploy-lessons` (reset schema solo en
  despliegue fresco).

## 5. ACCIONES (comandos exactos — NO ejecutadas, requieren autorización)

> `$cm = "C:\tmp\glory-target\coolify-manager\release\coolify-manager.exe"`

**Fase 0 — Preparación local (sin escritura remota):**
```powershell
# Compilar el manager (regla: build en C:\tmp; ya incluye el fix 268A-5)
cd "C:\Users\Owner\OneDrive\Documentos\area-trabajo\coolify-manager-rs"
$env:CARGO_TARGET_DIR = "C:\tmp\glory-target\coolify-manager"
cargo build --release
# Verificar capacidades reales del binario nuevo
& $cm new --help    # debe listar rust + --repo-url/--app-bin/--frontend-dir
& $cm --version
```

**Fase 1 — Origen del código (según decisión B1, requiere autorización de push):**
```powershell
cd "c:\Users\Owner\OneDrive\Documentos\area-trabajo\TRABAJOS CLIENTES\ONG AGAPE"
git remote add origin https://github.com/1ndoryu/<repo>.git
git push -u origin ong-agape
```

**Fase 2 — Crear el servicio (requiere autorización; B2 ya resuelto):**
```powershell
# Con los flags nuevos el sitio queda configurado en settings.json sin edición manual:
& $cm new --name agape --domain "https://agape.wandori.us" --template rust --glory-branch ong-agape `
    --repo-url "https://github.com/1ndoryu/ong-agape.git" --app-bin ong-agame-backend --frontend-dir frontend-v2 `
    --skip-theme --skip-cache
# ── Alternativa si el manager siguiera sin poder crear Rust: crear el stack en la UI de Coolify ──
# (compose basado en rust-stack.yaml ajustado al Dockerfile propio, B3-b)
```

**Fase 3 — Env del servicio (requiere autorización):**
```powershell
& $cm sync-env --name agape --only DATABASE_URL
& $cm sync-env --name agape --only JWT_SECRET
& $cm sync-env --name agape --only CORS_ALLOWED_ORIGINS
& $cm sync-env --name agape --only HOST
& $cm sync-env --name agape --only PORT
& $cm sync-env --name agape --only UPLOAD_DIR
& $cm sync-env --name agape --only RUST_LOG
# (o sync-env completo desde un .env.production preparado localmente)
```

**Fase 4 — Desplegar (requiere autorización explícita del deploy):**
```powershell
# Para stack Rust el flujo recomendado por la memoria del proyecto:
& $cm deploy --name agape --update --skip-backup
# (≈8-12 min; 503 durante el build es normal; NO lanzar dos deploys a la vez)
# Si el manager requiere deploy-service (según cómo se cree el servicio):
#   & $cm deploy-service --name agape --skip-backup
```

**Fase 5 — DNS (requiere autorización):**
```powershell
& $cm setup-site-dns --name agape   # o el flujo equivalente del manager para Rust
```

**Fase 6 — Verificación obligatoria post-deploy:**
```powershell
& $cm health --name agape
& $cm logs --name agape --target app --lines 50
# HTTP:
#   https://agape.wandori.us/api/health  → {"status":"ok",...}
#   https://agape.wandori.us/            → index.html de la SPA
#   https://agape.wandori.us/uploads/... → comprobantes (tras subir uno)
# CORS: abrir la SPA en https://agape.wandori.us y comprobar /api/* sin error CORS
# BD: & $cm db-check --name agape  (migraciones aplicadas, tablas presentes)
```

## 6. ROLLBACK

- **Deploy fallido / servicio roto:** no hay datos de producción previos (primera vez).
  `deploy-service`/`redeploy` hacen swap zero-downtime; si el build falla, el contenedor anterior
  (o ninguno) queda sin servir → diagnosticar con `logs`/`diagnose` y reintentar una sola vez.
- **Rollback de datos:** no aplica (no hay datos). Si hubiera, el manager crea backup pre-deploy
  (`backup`/`restore`) según `backup_policy` del sitio.
- **Abortar prueba temporal:** detener el servicio con `restart --name agape` (NO `--all`) o
  `env-toggle` para apagar, y retirar el DNS. Borrar el sitio en Coolify cuando se confirme.
- **NUNCA** `restart --all` (deja los workloads Rust en `exited`; lección 2026-05-11).

## 7. PENDIENTES (decisiones del usuario antes de ejecutar)

1. **B1 — Repo de origen:** ¿crear `1ndoryu/ong-agape` y pushear `ong-agape`? (recomendado)
   ¿o prefieres otra vía?
2. **B3/B4 — Estrategia de build/servir:** ¿Dockerfile propio en el repo (recomendado) que
   construye `frontend-v2` + backend y sirve el dist, o ajustar el Dockerfile.rust del manager?
3. **B2 — ¿Recompilo el manager** (`cargo build --release`) para arreglar el 422 de `create_stack`,
   o creas el stack por la UI de Coolify?
4. **Autorización de escrituras remotas** (explícita por operación+objetivo):
   - push del repo (si aplica B1);
   - crear el servicio `agape` en Coolify;
   - fijar envs (JWT_SECRET nuevo, CORS, etc.);
   - ejecutar el deploy;
   - configurar DNS `agape.wandori.us`.
5. **ADMIN_EMAILS:** ¿correo del cliente para el primer owner, o se crea el usuario manualmente en BD?
6. **Duración de la prueba:** ¿dominio temporal `agape.wandori.us` ok, o prefieres otro (p. ej.
   `agape.elproyectoagape.org`) antes de definir el definitivo?

## 8. Estado de los commits (ya hecho)

- `8d40b16` feat(backend): pagos automáticos, aliados, acciones y mensajes de contacto
- `484b418` feat(frontend-v2): página de donar, panel admin, contacto y pulido
- `3ebddcf` chore: documentación, roadmap y configuración del gate
- Rama: `ong-agape`; árbol limpio (solo `?? .quality-reports/` gitignored).
