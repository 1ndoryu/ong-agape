-- Reversa del seed de "Nuestra historia": solo retira el contenido que este
-- seed creó y que nadie haya modificado después (el ON CONFLICT del up no
-- toca filas existentes; aquí se borra solo la fila original del seed).
DELETE FROM transparency_content
WHERE content_key = 'acerca_de_nosotros'
  AND locale = 'es'
  AND title = 'Nuestra historia'
  AND status = 'published'
  AND updated_by IS NULL;
