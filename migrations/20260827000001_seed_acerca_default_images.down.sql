-- Revierte el seed de imágenes por defecto de "Nuestra historia": vuelve a
-- dejar la lista vacía como en el estado original.
UPDATE transparency_content
SET metadata = jsonb_set(metadata, '{images}', '[]'::jsonb)
WHERE content_key = 'acerca_de_nosotros' AND locale = 'es';
