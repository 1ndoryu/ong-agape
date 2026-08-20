DELETE FROM transparency_content WHERE content_key = 'transparency_overview' AND locale = 'es';
DELETE FROM payment_methods WHERE provider IN ('paypal', 'stripe', 'pago_movil', 'transfer', 'zelle');
