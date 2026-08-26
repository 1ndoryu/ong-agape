-- Contenido inicial de la sección "Nuestra historia" de la portada. El panel
-- lo edita bajo /api/admin/transparency/content/acerca_de_nosotros y el público
-- lo consume desde /api/transparency/content/acerca_de_nosotros. Las tres
-- imágenes arrancan vacías: la portada usa sus fallbacks locales hasta que el
-- equipo suba imágenes desde el panel.
INSERT INTO transparency_content (content_key, locale, title, body, metadata, status)
VALUES (
    'acerca_de_nosotros',
    'es',
    'Nuestra historia',
    'El Proyecto Ágape es una organización que nace en Venezuela con un propósito claro:
transformar la solidaridad en ayuda cercana, digna y transparente. Acompañamos a
familias y comunidades, articulamos voluntades y creemos que cada encuentro abre
oportunidades para escuchar, acompañar y construir un futuro mejor.',
    '{"cta_label": null, "cta_url": null, "images": []}'::jsonb,
    'published'
)
ON CONFLICT (content_key, locale) DO NOTHING;
