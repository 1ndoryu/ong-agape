-- Revertir la migración 20260826000001: quitar donaciones nuevas, restaurar
-- estados y nombres originales, y restaurar la config de los métodos.
DELETE FROM payment_receipts
WHERE id IN (
    '00000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000008'
);

UPDATE payment_receipts SET donor_name = 'María Fernández'
    WHERE provider_reference = 'PAYPAL-2026-0001';
UPDATE payment_receipts SET donor_name = 'Ana Rodríguez'
    WHERE provider_reference = 'PAGOMOVIL-2026-0001';
UPDATE payment_receipts SET donor_name = 'Carlos Gómez', status = 'pending_verification'
    WHERE provider_reference = 'STRIPE-2026-0001';
UPDATE payment_receipts SET donor_name = 'Lucía Pérez', status = 'pending_verification'
    WHERE provider_reference = 'ZELLE-2026-0001';

UPDATE transparency_entries SET status = 'pending'
    WHERE payment_receipt_id = '00000000-0000-4000-8000-000000000005';

UPDATE payment_methods SET status = 'disabled' WHERE provider = 'zelle';

UPDATE payment_methods
SET public_config = '{}'::jsonb
WHERE provider IN ('pago_movil', 'transfer', 'zelle');

ALTER TABLE payment_receipts DROP COLUMN donor_email;
