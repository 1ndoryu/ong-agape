use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Ally {
    pub id: Uuid,
    pub nombre: String,
    pub logo_url: String,
    pub display_order: i32,
    pub active: bool,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct AllyRequest {
    #[validate(length(min = 1, max = 160))]
    pub nombre: String,
    /* El logo puede ser una URL absoluta (http/https) o una ruta relativa
     * del sitio: /uploads/... (imagen subida desde el panel) o /imagenes/...
     * (recursos del frontend). Replica el criterio de contenidos y acciones. */
    pub logo_url: String,
    pub display_order: Option<i32>,
    pub active: Option<bool>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PublicAlly {
    pub id: Uuid,
    pub nombre: String,
    pub logo_url: String,
}

impl From<Ally> for PublicAlly {
    fn from(ally: Ally) -> Self {
        Self {
            id: ally.id,
            nombre: ally.nombre,
            logo_url: ally.logo_url,
        }
    }
}
