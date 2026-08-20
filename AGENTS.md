---
applyTo: '**'
---

# ong-agame — instrucciones del agente

Estas instrucciones complementan la conducta global del agente y sustituyen cualquier guía anterior para
este proyecto.

## Alcance del proyecto

- El proyecto se identifica como `ong-agame` y su producto público es **El Proyecto Ágape**.
- Esta rama parte del template `glory-rs-template`: Rust/Axum es el backend y React/Vite es el frontend.
- `glory-rs/` es el submódulo de framework reutilizable. No colocar allí lógica específica de Ágape.
- El ZIP vigente de referencia es `el-proyecto-agape-web.zip`; cualquier ZIP anterior queda descartado.

## Flujo de trabajo

- Ejecutar directamente el análisis, implementación, pruebas y documentación de tareas locales; no pedir
  confirmación para continuar.
- Preservar cambios ajenos y revisar `git status` antes de editar.
- No hacer deploy, push a producción ni escrituras en servicios externos sin autorización explícita.
- No usar SSH directo. Las operaciones de producción, si se solicitan, pasan por `coolify-manager-rs`.
- No ejecutar procesos persistentes sin una señal de readiness y un mecanismo de cierre.

## Arquitectura

- La landing vive en `frontend/src/features/landing/` y se monta desde `frontend/src/App.tsx`.
- Los tokens visuales globales viven en `frontend/src/styles/variables.css`; el reset global en
  `frontend/src/styles/global.css`.
- Los assets públicos viven en `frontend/public/`.
- Las imágenes críticas de la landing deben ser locales; no depender de URLs de terceros sin una decisión
  explícita sobre licencia, privacidad, disponibilidad y fallback.
- Las llamadas futuras al backend deben pasar por `frontend/src/api/` y consumir rutas `/api` mediante el
  proxy de Vite.
- El contenido público puede ser anónimo; donaciones, formularios y datos persistentes requieren contrato
  explícito de API antes de implementarse.

## Gate de calidad (Sentinel)

- Sentinel es la autoridad de cierre del proyecto. El gate se declara en `sentinel.config.json`
  (`schemaVersion: 2`, `mode: enforce`, `project.primaryBranch: ong-agape`) y se coordina con el
  binario global `sentinel` (0.7.4).
- Comandos: `npm run quality:doctor`, `npm run gate:check -- <TareaId>` (o `sentinel check <TareaId>`).
- No afirmar PASS del gate sin ejecutar el doctor con `readyForGate: true` y un check real.
- Los submódulos `tools/sentinel` y `tools/varsense` son la fuente del gate; no editar su contenido
  desde el consumidor.

## Validación

Desde la raíz:

```powershell
npm run check:front
```

Desde `frontend/`:

```powershell
npm run type-check
npm run build
```

El resultado se reporta con el comando exacto ejecutado y cualquier limitación real de cobertura.
