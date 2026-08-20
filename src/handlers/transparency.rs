use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use utoipa::IntoParams;

use crate::errors::AppError;
use crate::models::{PublicPaymentMethod, PublicTransparencyContent, TransparencySummary};
use crate::repositories::{ContentRepository, PaymentRepository};
use crate::services::{FundService, PaymentService};
use crate::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct TransparencyQuery {
    /// Moneda del resumen. Solo USD y VES se exponen en esta primera versión.
    #[serde(default = "default_currency")]
    pub currency: String,
}

fn default_currency() -> String {
    "USD".to_string()
}

/// Devuelve exclusivamente movimientos verificados y publicados.
#[utoipa::path(
    get,
    path = "/api/transparency/summary",
    params(TransparencyQuery),
    responses(
        (status = 200, description = "Resumen público de transparencia", body = TransparencySummary),
        (status = 422, description = "Moneda no soportada", body = crate::errors::ErrorResponse)
    )
)]
pub async fn get_summary(
    State(state): State<AppState>,
    Query(query): Query<TransparencyQuery>,
) -> Result<Json<TransparencySummary>, AppError> {
    Ok(Json(
        FundService::public_summary(&state.pool, &query.currency).await?,
    ))
}

#[utoipa::path(
    get,
    path = "/api/transparency/content/{key}",
    params(("key" = String, Path, description = "Clave pública de contenido")),
    responses(
        (status = 200, description = "Contenido publicado", body = TransparencyContent),
        (status = 404, description = "Contenido no encontrado", body = crate::errors::ErrorResponse)
    )
)]
pub async fn get_content(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> Result<Json<PublicTransparencyContent>, AppError> {
    let content = ContentRepository::get(&state.pool, &key, true)
        .await?
        .ok_or_else(|| AppError::NotFound("Contenido no encontrado".into()))?;
    Ok(Json(PublicTransparencyContent::from(content)))
}

#[utoipa::path(
    get,
    path = "/api/payment-methods",
    responses((status = 200, description = "Métodos públicos habilitados", body = [PublicPaymentMethod]))
)]
pub async fn list_public_payment_methods(
    State(state): State<AppState>,
) -> Result<Json<Vec<PublicPaymentMethod>>, AppError> {
    Ok(Json(
        PaymentRepository::list_public_methods(&state.pool)
            .await?
            .into_iter()
            .filter(|method| {
                method.mode != "automatic"
                    || PaymentService::automatic_provider_ready(&method.provider)
            })
            .map(PublicPaymentMethod::from)
            .collect(),
    ))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/transparency/summary", get(get_summary))
        .route("/transparency/content/:key", get(get_content))
        .route("/payment-methods", get(list_public_payment_methods))
}
