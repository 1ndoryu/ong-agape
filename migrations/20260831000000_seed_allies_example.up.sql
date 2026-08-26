-- Aliados de ejemplo para el carrusel público, basados en los SVG de
-- demostración incluidos en frontend-v2/public/imagenes/aliados/.
-- Son contenido demostrativo editable desde el panel de administración.
-- created_by/updated_by quedan NULL porque aún no existen cuentas de usuario
-- con identidad de auditor para seeds.
-- Las rutas son relativas (/imagenes/...) porque el backend sirve el dist de
-- la SPA: esos recursos viven en el propio contenedor.
INSERT INTO allies (nombre, logo_url, display_order, active)
SELECT nombre, logo_url, display_order, active
FROM (VALUES
    ('Fundación Manos Abiertas', '/imagenes/aliados/fundacion-manos-abiertas.svg', 1, TRUE),
    ('Distribuidora Oriente', '/imagenes/aliados/distribuidora-oriente.svg', 2, TRUE),
    ('Farmacias La Salud', '/imagenes/aliados/farmacias-la-salud.svg', 3, TRUE),
    ('Voluntarios Barcelona', '/imagenes/aliados/voluntarios-barcelona.svg', 4, TRUE)
) AS semilla(nombre, logo_url, display_order, active)
WHERE NOT EXISTS (
    SELECT 1 FROM allies a WHERE a.nombre = semilla.nombre
);
