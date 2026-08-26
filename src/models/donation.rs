use serde::Serialize;
use sqlx::FromRow;
use utoipa::ToSchema;

/// Donación aprobada para el feed "en vivo" de la página de donar. Solo se
/// exponen donantes que autorizaron su nombre (`donor_name` no nulo).
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct LiveDonation {
    pub donor_name: String,
    pub amount_minor: i64,
    pub currency: String,
}
