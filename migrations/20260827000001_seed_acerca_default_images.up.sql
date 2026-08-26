-- Las tres fotografías por defecto de la sección "Nuestra historia" se
-- guardan como imágenes publicadas del contenido (antes la portada usaba
-- fallbacks locales). Así el panel las muestra "adjuntas" en el editor, tal
-- como aparecen en la portada, y el administrador puede cambiarlas con un
-- clic sin tocar código.
UPDATE transparency_content
SET metadata = jsonb_set(
    metadata,
    '{images}',
    '["/imagenes/01.webp", "/imagenes/02.webp", "/imagenes/03.webp"]'::jsonb
)
WHERE content_key = 'acerca_de_nosotros'
  AND locale = 'es'
  AND (
    (metadata -> 'images') IS NULL
    OR jsonb_array_length(metadata -> 'images') = 0
  );
