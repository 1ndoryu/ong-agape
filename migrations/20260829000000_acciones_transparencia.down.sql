-- Revierte la sección de acciones de transparencia: elimina las columnas de
-- narrativa e imágenes. Las filas de ejemplo se borran primero (por su UUID
-- fijo) para no dejar movimientos sin sus columnas.

DELETE FROM transparency_entries
WHERE id IN (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000205',
    '00000000-0000-4000-8000-000000000206'
);

ALTER TABLE transparency_entries
    DROP COLUMN description,
    DROP COLUMN images;
