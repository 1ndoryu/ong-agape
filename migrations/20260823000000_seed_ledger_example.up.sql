-- Datos de ejemplo para el panel administrativo: movimientos del libro y
-- recibos de pago de los cinco métodos (PayPal, Stripe, Pago móvil,
-- Transferencia bancaria y Zelle). Son contenido demostrativo, editable o
-- revisable desde el panel; created_by/verified_by/reviewed_by quedan NULL
-- porque aún no existen cuentas de usuario con identidad de auditor. Los
-- proof_url/evidence_url quedan NULL porque no existen comprobantes reales.
--
-- Los recibos aprobados tienen su ingreso correspondiente en el libro con el
-- mismo concepto que genera el backend al revisar ("Donación recibida"), para
-- que el resumen y la lista de recibos cuenten la misma historia.

-- Recibos de ejemplo: uno por método, con estados variados.
INSERT INTO payment_receipts (
    id, payment_method_id, provider_reference, donor_name, amount_minor, currency,
    proof_url, status, received_at, review_note
)
VALUES
    (
        '00000000-0000-4000-8000-000000000001',
        (SELECT id FROM payment_methods WHERE provider = 'paypal'),
        'PAYPAL-2026-0001',
        'María Fernández',
        2500, 'USD',
        NULL,
        'approved',
        '2026-08-20T14:30:00Z',
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000000002',
        (SELECT id FROM payment_methods WHERE provider = 'stripe'),
        'STRIPE-2026-0001',
        'Carlos Gómez',
        4000, 'USD',
        NULL,
        'pending_verification',
        '2026-08-21T10:15:00Z',
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000000003',
        (SELECT id FROM payment_methods WHERE provider = 'pago_movil'),
        'PAGOMOVIL-2026-0001',
        'Ana Rodríguez',
        5000000, 'VES',
        NULL,
        'approved',
        '2026-08-19T16:45:00Z',
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000000004',
        (SELECT id FROM payment_methods WHERE provider = 'transfer'),
        'TRANSFER-2026-0001',
        'Pedro Martínez',
        3000, 'USD',
        NULL,
        'rejected',
        '2026-08-18T09:00:00Z',
        'La referencia no coincide con el comprobante del banco.'
    ),
    (
        '00000000-0000-4000-8000-000000000005',
        (SELECT id FROM payment_methods WHERE provider = 'zelle'),
        'ZELLE-2026-0001',
        'Lucía Pérez',
        1500, 'USD',
        NULL,
        'pending_verification',
        '2026-08-22T12:20:00Z',
        NULL
    )
ON CONFLICT (id) DO NOTHING;

-- Movimientos del libro: ingresos vinculados a recibos aprobados, aportes
-- directos y un gasto, con estados variados.
INSERT INTO transparency_entries (
    id, entry_type, concept, campaign, amount_minor, currency, occurred_on,
    status, evidence_url, payment_method_id, payment_receipt_id
)
VALUES
    (
        '00000000-0000-4000-8000-000000000101',
        'income', 'Donación recibida', 'Sopa comunitaria', 2500, 'USD',
        '2026-08-20', 'verified', NULL,
        (SELECT id FROM payment_methods WHERE provider = 'paypal'),
        '00000000-0000-4000-8000-000000000001'
    ),
    (
        '00000000-0000-4000-8000-000000000102',
        'income', 'Donación recibida', 'Sopa comunitaria', 5000000, 'VES',
        '2026-08-19', 'verified', NULL,
        (SELECT id FROM payment_methods WHERE provider = 'pago_movil'),
        '00000000-0000-4000-8000-000000000003'
    ),
    (
        '00000000-0000-4000-8000-000000000103',
        'income', 'Aporte mensual de aliados', NULL, 12000, 'USD',
        '2026-08-15', 'published', NULL,
        (SELECT id FROM payment_methods WHERE provider = 'transfer'),
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000000104',
        'expense', 'Alimentos para sopa comunitaria', 'Sopa comunitaria', 3500, 'USD',
        '2026-08-16', 'published', NULL,
        NULL, NULL
    ),
    (
        '00000000-0000-4000-8000-000000000105',
        'expense', 'Medicinas para familias', 'Acompañamiento familiar', 2000000, 'VES',
        '2026-08-21', 'pending', NULL,
        NULL, NULL
    ),
    (
        '00000000-0000-4000-8000-000000000106',
        'income', 'Donación recibida', 'Acompañamiento familiar', 1500, 'USD',
        '2026-08-22', 'pending', NULL,
        (SELECT id FROM payment_methods WHERE provider = 'zelle'),
        '00000000-0000-4000-8000-000000000005'
    ),
    (
        '00000000-0000-4000-8000-000000000107',
        'income', 'Donación recibida', NULL, 4000, 'USD',
        '2026-08-21', 'pending', NULL,
        (SELECT id FROM payment_methods WHERE provider = 'stripe'),
        '00000000-0000-4000-8000-000000000002'
    ),
    (
        '00000000-0000-4000-8000-000000000108',
        'income', 'Donación en efectivo', NULL, 800, 'USD',
        '2026-08-14', 'published', NULL,
        NULL, NULL
    )
ON CONFLICT (id) DO NOTHING;
