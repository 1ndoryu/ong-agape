-- Configuración de proveedores automáticos (PayPal/Stripe). El panel edita los
-- campos públicos (identificador, entorno sandbox/live, moneda, etiqueta) y los
-- secretos (client_secret, webhook_id, secret_key, webhook_secret). La columna es
-- JSONB para que cada proveedor guarde su forma sin migraciones por campo.
--
-- provider_config:  campos NO secretos; se devuelven al admin.
-- provider_secrets: campos SECRETOS; solo-escritura. El backend jamás los
--                   serializa al frontend (skip_serializing en el modelo); en
--                   producción las variables de entorno tienen prioridad.
ALTER TABLE payment_methods
    ADD COLUMN provider_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN provider_secrets JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Intentos de checkout de métodos automáticos. La referencia es el id que el
-- proveedor (o el simulador local) usa para confirmar el pago; al completarse
-- se crea el recibo aprobado y el ingreso en el ledger. Nunca guarda secretos.
CREATE TABLE checkout_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    reference VARCHAR(255) NOT NULL UNIQUE,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'VES')),
    donor_name VARCHAR(120) NOT NULL,
    donor_email TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'completed', 'expired')),
    provider_reference VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_checkout_intents_method
    ON checkout_intents(payment_method_id, created_at DESC);
