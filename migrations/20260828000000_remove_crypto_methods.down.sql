-- Reversión: se vuelven a insertar los métodos cripto simulados y se amplía
-- el CHECK de provider para admitirlos (estado previo a la limpieza).

ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_provider_check;
ALTER TABLE payment_methods
    ADD CONSTRAINT payment_methods_provider_check
    CHECK (provider IN (
        'paypal', 'stripe', 'pago_movil', 'transfer', 'zelle',
        'binance', 'airtm', 'usdt'
    ));

INSERT INTO payment_methods (provider, public_label, mode, status, public_config, display_order)
VALUES
    ('binance', 'Binance Pay', 'manual', 'setup_required',
     jsonb_build_object(
         'instructions', '1. Escanea o copia el código de pago de Binance Pay.' || E'\n' ||
                         '2. Escribe tu nombre en el concepto para identificarte.' || E'\n' ||
                         '3. Adjunta la captura de la transferencia en este formulario.',
         'bank_name', 'Binance',
         'account_holder', 'El Proyecto Ágape',
         'account_number', 'ID de usuario: 000000000',
         'account_phone', NULL,
         'account_document', NULL
     ),
     60),
    ('airtm', 'Airtm', 'manual', 'setup_required',
     jsonb_build_object(
         'instructions', '1. Envía el pago por Airtm al usuario indicado.' || E'\n' ||
                         '2. Escribe tu nombre en el mensaje.' || E'\n' ||
                         '3. Adjunta la captura del envío en este formulario.',
         'bank_name', 'Airtm',
         'account_holder', 'El Proyecto Ágape',
         'account_number', '@elproyectoagape',
         'account_phone', NULL,
         'account_document', NULL
     ),
     70),
    ('usdt', 'USDT (TRC-20)', 'manual', 'setup_required',
     jsonb_build_object(
         'instructions', '1. Envía USDT por la red TRC-20 a la dirección indicada.' || E'\n' ||
                         '2. Verifica que la red sea TRC-20 para no perder el envío.' || E'\n' ||
                         '3. Adjunta el hash o captura de la transacción en este formulario.',
         'bank_name', 'TRON (TRC-20)',
         'account_holder', 'El Proyecto Ágape',
         'account_number', 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
         'account_phone', NULL,
         'account_document', NULL
     ),
     80)
ON CONFLICT (provider) DO NOTHING;
