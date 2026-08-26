-- Donaciones desde la página de donar: se guarda el correo del donante para
-- confirmar la recepción sin exponerlo públicamente (el feed en vivo y la
-- transparencia solo muestran nombre y monto).
ALTER TABLE payment_receipts ADD COLUMN donor_email TEXT;

-- Configuración estructurada de los métodos manuales. El panel edita banco,
-- titular, cuenta, teléfono y documento; el público los ve en el modal de la
-- página de donar. Los datos de ejemplo permiten ver el modal sin configurar.
UPDATE payment_methods
SET public_config = jsonb_build_object(
    'instructions',
    CASE provider
        WHEN 'pago_movil' THEN
            '1. Haz el pago móvil desde tu banco.'
            || E'\n'
            || '2. En el comprobante, el número de referencia es opcional pero recomendado.'
            || E'\n'
            || '3. Adjunta el comprobante en este formulario o envíanoslo por WhatsApp.'
        WHEN 'transfer' THEN
            '1. Haz la transferencia bancaria desde tu banco.'
            || E'\n'
            || '2. Escribe tu nombre en la referencia para identificarte.'
            || E'\n'
            || '3. Adjunta el comprobante en este formulario.'
        WHEN 'zelle' THEN
            '1. Envía el pago por Zelle a la cuenta indicada.'
            || E'\n'
            || '2. Escribe tu nombre en el mensaje.'
            || E'\n'
            || '3. Adjunta el comprobante en este formulario.'
        ELSE 'Instrucciones del método.'
    END,
    'bank_name',
    CASE provider
        WHEN 'pago_movil' THEN 'Banesco'
        WHEN 'transfer' THEN 'Banesco'
        WHEN 'zelle' THEN 'M&T Bank'
        ELSE NULL
    END,
    'account_holder',
    CASE provider
        WHEN 'pago_movil' THEN 'El Proyecto Ágape'
        WHEN 'transfer' THEN 'El Proyecto Ágape'
        WHEN 'zelle' THEN 'El Proyecto Ágape'
        ELSE NULL
    END,
    'account_number',
    CASE provider
        WHEN 'pago_movil' THEN '0134-0000-00-0000000000'
        WHEN 'transfer' THEN '0134-0000-00-0000000000'
        WHEN 'zelle' THEN 'hola@elproyectoagape.org'
        ELSE NULL
    END,
    'account_phone',
    CASE provider
        WHEN 'pago_movil' THEN '+58 412 000 0000'
        ELSE NULL
    END,
    'account_document',
    CASE provider
        WHEN 'pago_movil' THEN 'J-00000000-0'
        WHEN 'transfer' THEN 'J-00000000-0'
        ELSE NULL
    END
)
WHERE provider IN ('pago_movil', 'transfer', 'zelle');

-- Zelle se habilita para que el usuario pueda previsualizar todos los métodos
-- en la página de donar (solicitud de la Fase C).
UPDATE payment_methods SET status = 'enabled' WHERE provider = 'zelle';

-- Feed en vivo: el usuario pidió ~6 donaciones con solo el nombre (sin
-- apellidos). Las tres aprobadas existentes (María, Ana y la de Lucía que
-- estaba pendiente) se reescriben con nombre simple y se añaden tres más.
UPDATE payment_receipts SET donor_name = 'María' WHERE provider_reference = 'PAYPAL-2026-0001';
UPDATE payment_receipts SET donor_name = 'Ana' WHERE provider_reference = 'PAGOMOVIL-2026-0001';
UPDATE payment_receipts SET donor_name = 'Carlos', status = 'approved'
    WHERE provider_reference = 'STRIPE-2026-0001' AND status = 'pending_verification';
UPDATE payment_receipts SET donor_name = 'Lucía', status = 'approved'
    WHERE provider_reference = 'ZELLE-2026-0001' AND status = 'pending_verification';

INSERT INTO payment_receipts
    (id, payment_method_id, provider_reference, donor_name, amount_minor, currency, status, received_at)
VALUES
    ('00000000-0000-4000-8000-000000000006',
     (SELECT id FROM payment_methods WHERE provider = 'pago_movil'),
     'PAGOMOVIL-2026-0002', 'Pedro', 7500, 'VES', 'approved', NOW() - INTERVAL '1 day'),
    ('00000000-0000-4000-8000-000000000007',
     (SELECT id FROM payment_methods WHERE provider = 'transfer'),
     'TRANSFER-2026-0002', 'Sofía', 3000, 'USD', 'approved', NOW() - INTERVAL '2 days'),
    ('00000000-0000-4000-8000-000000000008',
     (SELECT id FROM payment_methods WHERE provider = 'paypal'),
     'PAYPAL-2026-0002', 'Diego', 2500, 'USD', 'approved', NOW() - INTERVAL '3 days');

-- Al aprobarse el recibo de Zelle, su ingreso vinculado (que estaba pendiente
-- en el seed) pasa a verified para que recibo y libro cuenten la misma historia.
UPDATE transparency_entries SET status = 'verified'
    WHERE payment_receipt_id = '00000000-0000-4000-8000-000000000005';
