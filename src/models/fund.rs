use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// Movimiento publicado en la transparencia pública, sin datos personales ni referencias privadas.
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct PublicFundEntry {
    pub id: Uuid,
    pub entry_type: String,
    pub concept: String,
    pub campaign: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub occurred_on: NaiveDate,
}

/* Acción publicada de transparencia: un gasto verificado con su narrativa e
 * imágenes. `images` llega como JSONB de Postgres y SQLx no lo decodifica a
 * Vec<String> directamente, así que se expone como Value (serializa igual a
 * un array de strings en la API). La sección pública solo muestra acciones
 * con description no vacía. */
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct PublicAction {
    pub id: Uuid,
    pub entry_type: String,
    pub concept: String,
    pub campaign: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub occurred_on: NaiveDate,
    pub description: Option<String>,
    #[serde(default)]
    pub images: serde_json::Value,
}

/// Resumen público reproducible desde los movimientos publicados.
#[derive(Debug, Serialize, ToSchema)]
pub struct TransparencySummary {
    pub currency: String,
    pub total_received_minor: i64,
    pub total_used_minor: i64,
    pub entries: Vec<PublicFundEntry>,
}

/// Contrato inicial para registrar un movimiento desde el futuro panel administrativo.
/// La ruta administrativa todavía no se expone hasta cerrar roles y flujo de revisión.
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateFundEntryRequest {
    #[validate(length(min = 1, max = 16))]
    pub entry_type: String,
    #[validate(length(min = 1, max = 255))]
    pub concept: String,
    #[validate(length(max = 255))]
    pub campaign: Option<String>,
    #[validate(range(min = 1))]
    pub amount_minor: i64,
    #[validate(length(equal = 3))]
    pub currency: String,
    pub occurred_on: NaiveDate,
    #[validate(url)]
    pub evidence_url: Option<String>,
}
