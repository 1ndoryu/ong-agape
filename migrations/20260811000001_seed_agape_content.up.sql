INSERT INTO payment_methods (provider, public_label, mode, status, public_config, display_order)
VALUES
    ('paypal', 'PayPal', 'automatic', 'setup_required', '{}'::jsonb, 10),
    ('stripe', 'Stripe', 'automatic', 'setup_required', '{}'::jsonb, 20),
    ('pago_movil', 'Pago móvil', 'manual', 'disabled', '{}'::jsonb, 30),
    ('transfer', 'Transferencia bancaria', 'manual', 'disabled', '{}'::jsonb, 40),
    ('zelle', 'Zelle', 'manual', 'disabled', '{}'::jsonb, 50)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO transparency_content (content_key, locale, title, body, status)
VALUES (
    'transparency_overview',
    'es',
    'Fondos utilizados',
    'Aquí publicaremos cuánto se recauda y cómo se utiliza cada aporte.',
    'draft'
)
ON CONFLICT (content_key, locale) DO NOTHING;
