-- Aliados del carrusel público, administrados desde el panel. El orden y la
-- visibilidad los controla el admin; el público solo ve los activos ordenados.
CREATE TABLE allies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(160) NOT NULL,
    logo_url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_allies_public ON allies(active, display_order) WHERE active = TRUE;
