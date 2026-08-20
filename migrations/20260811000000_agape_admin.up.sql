-- Roles y estado revocable para las cuentas que pueden usar el panel.
ALTER TABLE users
    ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('owner', 'finance_editor', 'auditor', 'viewer')),
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled'));

CREATE INDEX idx_users_role_status ON users(role, status);

-- Relaciona un ingreso/gasto con el método y el recibo que lo originaron.
ALTER TABLE transparency_entries
    ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    ADD COLUMN payment_receipt_id UUID REFERENCES payment_receipts(id) ON DELETE SET NULL,
    ADD COLUMN review_note TEXT;

CREATE UNIQUE INDEX idx_transparency_payment_receipt
    ON transparency_entries(payment_receipt_id)
    WHERE payment_receipt_id IS NOT NULL;

-- Blog público administrable con flujo explícito de borrador/publicación.
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(160) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    excerpt VARCHAR(500) NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_public_date
    ON blog_posts(published_at DESC)
    WHERE status = 'published';
