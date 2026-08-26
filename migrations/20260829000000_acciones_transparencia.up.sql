-- Acciones de transparencia: descripción e imágenes para cada movimiento
-- publicado. El público ve las últimas acciones (gastos publicados) con su
-- historia: qué se hizo con el dinero, en qué fecha y con qué evidencias.
--
-- description: texto breve (markdown plano) que explica la acción.
-- images:      array JSONB de URLs públicas (hasta 3) que ilustran la acción;
--              pueden venir de /imagenes (estáticas) o de /uploads (panel).
--
-- Las columnas son opcionales para los movimientos antiguos: un gasto puede
-- publicarse sin narrativa, pero la sección de acciones lo muestra solo
-- cuando description e imágenes existen.

ALTER TABLE transparency_entries
    ADD COLUMN description TEXT,
    ADD COLUMN images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Acciones de ejemplo para la sección pública de transparencia (dona
-- .yummyrides.com/transparency): seis gastos publicados con su narrativa y
-- fotografías de las imágenes estáticas ya presentes en el frontend. Son
-- contenido demostrativo que el cliente edita o reemplaza desde el panel.
-- created_by/verified_by quedan NULL (no hay identidad de auditor de seed).
INSERT INTO transparency_entries (
    id, entry_type, concept, campaign, amount_minor, currency, occurred_on,
    status, description, images
)
VALUES
    (
        '00000000-0000-4000-8000-000000000201',
        'expense', 'Alimentos para la sopa comunitaria', 'Sopa comunitaria',
        3500, 'USD', '2026-08-16', 'published',
        'Compramos granos, verduras, arroz y aceite para servir la sopa '
        'comunitaria dos días por semana durante un mes. Cada tanda alcanza '
        'para unas 90 raciones, incluyendo las familias con niños pequeños '
        'que llegan primero.',
        '["/imagenes/01.webp", "/imagenes/02.webp"]'
    ),
    (
        '00000000-0000-4000-8000-000000000202',
        'expense', 'Medicinas para 12 familias', 'Acompañamiento familiar',
        2800, 'USD', '2026-08-10', 'published',
        'Cubrimos la compra de medicinas recetadas para doce familias: '
        'antibióticos, antihipertensivos e insulina para adultos mayores. '
        'Las entregas se coordinaron con la farmacia local y se registró '
        'cada receta para rendir cuentas.',
        '["/imagenes/03.webp", "/imagenes/manos-colores.webp"]'
    ),
    (
        '00000000-0000-4000-8000-000000000203',
        'expense', 'Útiles escolares para la comunidad', NULL,
        1500, 'USD', '2026-08-05', 'published',
        'Entregamos cuadernos, lápices, morrales y uniformes a niños de la '
        'comunidad antes del inicio de clases. Participaron voluntarios en '
        'el armado de los kits y la lista se publicó para que cada familia '
        'recibiera lo suyo.',
        '["/imagenes/mision-comunidad-oceano.webp"]'
    ),
    (
        '00000000-0000-4000-8000-000000000204',
        'expense', 'Pañales y leche para bebés', 'Acompañamiento familiar',
        2200, 'USD', '2026-07-28', 'published',
        'Compramos pañales y leche de fórmula para ocho bebés de familias '
        'en situación vulnerable. La entrega mensual se hace en sus hogares '
        'y el reparto se documenta con fotografía de cada kit.',
        '["/imagenes/manos-colores.webp", "/imagenes/mision-agape-unsplash.webp"]'
    ),
    (
        '00000000-0000-4000-8000-000000000205',
        'expense', 'Acompañamiento psicológico a familias', NULL,
        1800, 'USD', '2026-07-20', 'published',
        'Financiamos sesiones de contención emocional y orientación familiar '
        'con una psicóloga comunitaria durante seis semanas. Las sesiones '
        'grupales se realizan en el salón comunitario y están abiertas a '
        'todas las familias del programa.',
        '["/imagenes/mision-agape-unsplash.webp"]'
    ),
    (
        '00000000-0000-4000-8000-000000000206',
        'expense', 'Transporte de entregas a comunidades', NULL,
        950, 'USD', '2026-07-12', 'published',
        'Cubrimos el transporte de alimentos y medicinas hacia las '
        'comunidades más alejadas de la sede. El vehículo contratado permite '
        'llevar más volumen en un solo viaje y reduce el costo por entrega.',
        '["/imagenes/03.webp"]'
    )
ON CONFLICT (id) DO NOTHING;
