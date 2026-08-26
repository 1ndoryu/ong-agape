use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use utoipa::IntoParams;
use uuid::Uuid;
use validator::Validate;

use crate::domain::permissions::{AdminPermission, AdminRole};
use crate::errors::AppError;
use crate::middleware::AuthUser;
use crate::models::{Campaign, CampaignRequest, CampaignStatusRequest, PublicCampaign};
use crate::repositories::{AuditRepository, CampaignRepository};
use crate::services::AdminService;
use crate::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct CampaignFilter {
    pub status: Option<String>,
}

#[utoipa::path(get, path = "/api/campaigns", responses((status = 200, body = [PublicCampaign])))]
pub async fn list_public(
    State(state): State<AppState>,
) -> Result<Json<Vec<PublicCampaign>>, AppError> {
    Ok(Json(
        CampaignRepository::list_public(&state.pool)
            .await?
            .into_iter()
            .map(PublicCampaign::from)
            .collect(),
    ))
}

#[utoipa::path(get, path = "/api/admin/campaigns", params(CampaignFilter), responses((status = 200, body = [Campaign])), security(("bearer_auth" = [])))]
pub async fn list_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filter): Query<CampaignFilter>,
) -> Result<Json<Vec<Campaign>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    Ok(Json(
        CampaignRepository::list_admin(&state.pool, filter.status.as_deref()).await?,
    ))
}

#[utoipa::path(post, path = "/api/admin/campaigns", request_body = CampaignRequest, responses((status = 201, body = Campaign)), security(("bearer_auth" = [])))]
pub async fn create_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<CampaignRequest>,
) -> Result<(StatusCode, Json<Campaign>), AppError> {
    validate_request(&request)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let campaign = CampaignRepository::create(&state.pool, actor.id, &request).await?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "campaign.created",
        "campaign",
        Some(campaign.id),
        json!({"slug": campaign.slug}),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(campaign)))
}

#[utoipa::path(put, path = "/api/admin/campaigns/{id}", params(("id" = Uuid, Path, description = "Campaña")), request_body = CampaignRequest, responses((status = 200, body = Campaign)), security(("bearer_auth" = [])))]
pub async fn update_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<CampaignRequest>,
) -> Result<Json<Campaign>, AppError> {
    validate_request(&request)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let campaign = CampaignRepository::update(&state.pool, id, actor.id, &request)
        .await?
        .ok_or_else(|| AppError::NotFound("Campaña no encontrada".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "campaign.updated",
        "campaign",
        Some(id),
        json!({"slug": campaign.slug}),
    )
    .await?;
    Ok(Json(campaign))
}

#[utoipa::path(put, path = "/api/admin/campaigns/{id}/status", params(("id" = Uuid, Path, description = "Campaña")), request_body = CampaignStatusRequest, responses((status = 200, body = Campaign)), security(("bearer_auth" = [])))]
pub async fn update_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<CampaignStatusRequest>,
) -> Result<Json<Campaign>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    if !matches!(
        request.status.as_str(),
        "draft" | "active" | "completed" | "archived"
    ) {
        return Err(AppError::Validation("Estado de campaña inválido".into()));
    }
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    if matches!(request.status.as_str(), "active" | "completed") && actor.role != AdminRole::Owner {
        return Err(AppError::Forbidden);
    }
    let campaign = CampaignRepository::set_status(&state.pool, id, actor.id, &request.status)
        .await?
        .ok_or_else(|| AppError::NotFound("Campaña no encontrada".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "campaign.status_changed",
        "campaign",
        Some(id),
        json!({"status": campaign.status}),
    )
    .await?;
    Ok(Json(campaign))
}

/* Elimina una campaña. Requiere ManageContent y devuelve 204 sin cuerpo; la
 * auditoría conserva el nombre para trazabilidad. */
#[utoipa::path(
    delete,
    path = "/api/admin/campaigns/{id}",
    params(("id" = Uuid, Path, description = "Campaña")),
    responses((status = 204, description = "Campaña eliminada"), (status = 401, body = crate::errors::ErrorResponse), (status = 403, body = crate::errors::ErrorResponse), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn delete_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let campaign = CampaignRepository::delete(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Campaña no encontrada".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "campaign.deleted",
        "campaign",
        Some(id),
        json!({"name": campaign.name, "slug": campaign.slug}),
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/campaigns", get(list_public))
        .route("/admin/campaigns", get(list_admin).post(create_admin))
        .route("/admin/campaigns/:id", put(update_admin).delete(delete_admin))
        .route("/admin/campaigns/:id/status", put(update_status))
}

fn validate_request(request: &CampaignRequest) -> Result<(), AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    if !request.slug.chars().all(|character| {
        character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
    }) {
        return Err(AppError::Validation(
            "El slug debe usar minúsculas, números y guiones".into(),
        ));
    }
    if let Some(ends_on) = request.ends_on {
        if ends_on < request.starts_on {
            return Err(AppError::Validation(
                "La fecha final no puede ser anterior a la inicial".into(),
            ));
        }
    }
    if !matches!(
        request.currency.to_ascii_uppercase().as_str(),
        "USD" | "VES"
    ) {
        return Err(AppError::Validation("Moneda no soportada".into()));
    }
    Ok(())
}
