use crate::models::{ContactMessage, ContactMessageRequest};
use sqlx::PgPool;
use uuid::Uuid;

pub struct ContactRepository;

impl ContactRepository {
    /// Mensajes de contacto para el panel, los más recientes primero.
    pub async fn list(pool: &PgPool) -> Result<Vec<ContactMessage>, sqlx::Error> {
        sqlx::query_as::<_, ContactMessage>(
            "SELECT id, name, email, message, created_at \
             FROM contact_messages ORDER BY created_at DESC, id DESC LIMIT 200",
        )
        .fetch_all(pool)
        .await
    }

    /// Guarda un mensaje enviado desde la página pública de contacto.
    pub async fn create(
        pool: &PgPool,
        request: &ContactMessageRequest,
    ) -> Result<ContactMessage, sqlx::Error> {
        sqlx::query_as::<_, ContactMessage>(
            "INSERT INTO contact_messages (name, email, message) \
             VALUES ($1, $2, $3) \
             RETURNING id, name, email, message, created_at",
        )
        .bind(request.name.trim())
        .bind(request.email.trim())
        .bind(request.message.trim())
        .fetch_one(pool)
        .await
    }

    /// Elimina físicamente un mensaje. Devuelve el registro borrado (None si
    /// no existía) para distinguir 404 de 204 en el handler.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<Option<ContactMessage>, sqlx::Error> {
        sqlx::query_as::<_, ContactMessage>(
            "DELETE FROM contact_messages WHERE id = $1 \
             RETURNING id, name, email, message, created_at",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }
}
