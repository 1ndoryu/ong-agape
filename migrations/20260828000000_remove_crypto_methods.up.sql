-- Elimina los métodos de pago cripto simulados (Binance Pay, Airtm, USDT)
-- que no son necesarios para la ONG. Fueron insertados como simulación en
-- 20260826000002; el cliente confirmó que no los usará, así que se borran y
-- se restringe el CHECK de provider al conjunto operativo real.

DELETE FROM payment_methods WHERE provider IN ('binance', 'airtm', 'usdt');

ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_provider_check;
ALTER TABLE payment_methods
    ADD CONSTRAINT payment_methods_provider_check
    CHECK (provider IN ('paypal', 'stripe', 'pago_movil', 'transfer', 'zelle'));
