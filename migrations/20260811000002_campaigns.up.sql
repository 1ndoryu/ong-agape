CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(160) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    goal_minor BIGINT NOT NULL CHECK (goal_minor > 0),
    currency CHAR(3) NOT NULL CHECK (currency IN ('USD', 'VES')),
    starts_on DATE NOT NULL,
    ends_on DATE,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX idx_campaigns_public ON campaigns(status, starts_on DESC) WHERE status IN ('active', 'completed');
