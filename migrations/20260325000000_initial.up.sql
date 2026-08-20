-- Migración inicial: usuarios y notas
-- Índices incluidos para las queries principales

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE transparency_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_type VARCHAR(16) NOT NULL CHECK (entry_type IN ('income', 'expense')),
    concept VARCHAR(255) NOT NULL,
    campaign VARCHAR(255),
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'VES')),
    occurred_on DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'verified', 'published', 'rejected')),
    evidence_url TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transparency_public_currency_date
    ON transparency_entries(currency, occurred_on DESC)
    WHERE status = 'published';

-- Métodos visibles para la comunidad. Las credenciales viven fuera de la base de datos.
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(32) NOT NULL UNIQUE
        CHECK (provider IN ('paypal', 'stripe', 'pago_movil', 'transfer', 'zelle')),
    public_label VARCHAR(120) NOT NULL,
    mode VARCHAR(16) NOT NULL CHECK (mode IN ('automatic', 'manual')),
    status VARCHAR(24) NOT NULL DEFAULT 'setup_required'
        CHECK (status IN ('enabled', 'disabled', 'setup_required')),
    public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un recibo no entra al ledger público hasta pasar la revisión requerida.
CREATE TABLE payment_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    provider_event_id VARCHAR(255),
    provider_reference VARCHAR(255),
    donor_name VARCHAR(255),
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'VES')),
    proof_url TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'pending_verification'
        CHECK (status IN ('pending_verification', 'approved', 'rejected')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_receipts_review_queue
    ON payment_receipts(status, received_at DESC);

CREATE UNIQUE INDEX idx_payment_receipts_provider_event
    ON payment_receipts(payment_method_id, provider_event_id)
    WHERE provider_event_id IS NOT NULL;

-- Contenido editable de la sección pública, separado del ledger y versionable en una fase posterior.
CREATE TABLE transparency_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_key VARCHAR(64) NOT NULL,
    locale VARCHAR(10) NOT NULL DEFAULT 'es',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (content_key, locale)
);

-- Solo registra acciones sensibles; no guarda secretos ni payloads completos de proveedores.
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);
