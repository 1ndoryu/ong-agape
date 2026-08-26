-- Reversión: se eliminan los métodos simulados y se restaura el CHECK original.

DELETE FROM payment_methods WHERE provider IN ('binance', 'airtm', 'usdt');

ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_provider_check;
ALTER TABLE payment_methods
    ADD CONSTRAINT payment_methods_provider_check
    CHECK (provider IN ('paypal', 'stripe', 'pago_movil', 'transfer', 'zelle'));
