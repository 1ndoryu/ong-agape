use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// Mensaje enviado desde la página pública de contacto. Se guarda con la
/// marca de tiempo y se lee desde el panel; el borrado es físico.
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct ContactMessage {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub message: String,
    pub created_at: DateTime<Utc>,
}

/// Formulario público de contacto. Validación de longitud y formato de
/// correo; el backend también recorta los espacios en blanco.
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ContactMessageRequest {
    #[validate(length(min = 1, max = 160, message = "El nombre debe tener entre 1 y 160 caracteres"))]
    pub name: String,
    #[validate(
        length(min = 1, max = 160, message = "El correo debe tener entre 1 y 160 caracteres"),
        email(message = "Correo inválido")
    )]
    pub email: String,
    #[validate(length(min = 1, max = 5000, message = "El mensaje debe tener entre 1 y 5000 caracteres"))]
    pub message: String,
}
