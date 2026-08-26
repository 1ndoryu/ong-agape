-- Mensajes enviados desde la página pública de contacto. El formulario es
-- abierto (no requiere login), por eso se guarda solo el contenido: nombre,
-- correo y mensaje, más la marca de tiempo. El equipo los lee y responde desde
-- el panel administrativo; un mensaje eliminado se borra físicamente (no hay
-- estado intermedio: se responde por correo, no desde el panel).
CREATE TABLE contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(160) NOT NULL,
    email VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La lectura en el panel es siempre "los más recientes primero"; el índice
-- refuerza ese orden de consulta.
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
