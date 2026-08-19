# Plan: frontend v2 de El Proyecto Ágape (128A-1)

- **Fecha:** 2026-08-12
- **Estado:** activo — bloque de landing archivado como referencia (2026-08-19); próxima
  sesión define qué se construye en la página limpia.
- **Objetivo:** tener un frontend nuevo desde cero para El Proyecto Ágape, sin borrar
  el frontend actual (`frontend/`), que queda intacto como referencia.

## Contexto y decisión de arquitectura

- `frontend/` (React + Vite + TS + Tailwind/Orval) es la implementación actual y se
  conserva **sin tocar** como referencia visual/funcional.
- `frontend-v2/` es el frontend nuevo y se construye por sesiones cortas supervisadas por
  el usuario. La primera sesión abarcó barra, navegación y hero; la segunda añade solo
  Nuestra misión, pendiente de revisión antes de continuar.
- El dev launcher (`glory-rs/scripts/dev.mjs`) sigue apuntando a `frontend/`; v2 se
  corre con su propio `npm run dev` (puerto 5176) y proxy configurable vía
  `BACKEND_PROXY` (default `http://localhost:3000`). La migración final a `frontend/`
  es un rename futuro, explícito.

## Estado actual

- Configs listas y verificadas: `package.json`, `vite.config.ts`, `tsconfig.json`,
  `index.html`.
- Entrada base: `src/main.tsx` (React 18 + StrictMode), `src/App.tsx` y
  `src/vite-env.d.ts`.
- Sesión 1: lenguaje Evergreen adaptado a la ONG (lienzo crema, editorial serif, acciones
  negras, acento botánico), aplicado solo al encabezado y hero. La navegación usa CTA de
  contorno y proporciones compactas (fila 74px, Rubik 15px, botón 42px/30px), siguiendo la
  referencia observada; el logo queda pendiente para una sesión posterior.
- Fuentes empaquetadas localmente con `@fontsource` para no depender de terceros en
  producción.
- Sesión 2: sección editorial de misión simplificada, con tipografía reducida, sin nota,
  texto central ni lista de principios. La tarjeta usaba una imagen local de ejemplo, visible
  sin capa transparente; el hero ya no muestra la franja
  inferior de estadísticas y su contenido queda centrado verticalmente.
- Ajuste de revisión: la misión usa Rubik y el bloque de texto tiene un fondo pastel de marca,
  con la misma altura y ancho 50/50 respecto a la tarjeta, con gap compacto; la tarjeta usa la foto
  de Unsplash descargada como original y `public/imagenes/*.webp`
  como salida servida. `npm run images:optimize -- --input assets/originales --w 2400 --q 80 --fmt webp`
  regenera las imágenes futuras con el mismo contrato.
- Revisión visual siguiente: el verde pastel gana saturación, el grid estira ambas tarjetas a la
  misma altura y el espacio entre columnas se reduce para mantener la composición compacta; el
  párrafo mantiene su tamaño de fuente con una versión de copy más breve.
- El sistema de negros se centraliza con una opacidad suave en `--colorTinta` y `--colorCarbon`,
  para que letras, bordes, botones y ornamentos no rendericen negro puro.
- El contenedor global se amplía moderadamente a 1280 px para dar más aire a la composición en
  escritorio, conservando los márgenes fluidos y los breakpoints móviles.
- La revisión tipográfica aligera títulos y etiquetas a peso 500, conserva el `h1` y el texto
  corrido, y añade 20 px de padding interno a las tarjetas para una lectura más aireada.
- Siguiente bloque: dos tarjetas 50/50 sin texto sobre la imagen; la primera usa la foto de manos
  unidas con jerseys de colores de Unsplash y la segunda continúa el mensaje de acompañamiento
  con texto en fondo pastel, manteniendo el mismo tamaño y ritmo visual de la misión.
- La separación entre sesiones comparte el mismo token que el `gap` interno de las tarjetas, para
  que el bloque nuevo quede pegado a la misión con un ritmo uniforme.

## Próximos pasos por sesión

1. Revisar y aprobar/corregir la sección Nuestra misión de la sesión 2.
2. Revisar el peso y el encuadre de la imagen cuando se confirme el recurso definitivo.
3. Construir la siguiente sección solo después de esa revisión.
4. Añadir dependencias según necesidad (router, react-query, clientes API…).
5. Conectar el backend (proxy ya configurado; backend local de referencia en
   `http://127.0.0.1:3010` con `PORT=3010 node scripts/run-with-db.mjs run`).
6. Decidir cuándo `frontend-v2` reemplaza a `frontend/` (rename + apuntar el launcher).
