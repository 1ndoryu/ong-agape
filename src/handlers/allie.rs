use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, put};
use axum::{Json, Router};
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::domain::permissions::AdminPermission;
use crate::errors::AppError;
use crate::middleware::AuthUser;
use crate::models::{Ally, AllyRequest, PublicAlly};
use crate::repositories::{AllyRepository, AuditRepository};
use crate::services::AdminService;
use crate::AppState;

/// Aliados visibles al público (carrusel de la portada).
#[utoipa::path(
    get,
    path = "/api/allies",
    responses((status = 200, description = "Aliados activos", body = [PublicAlly]))
)]
pub async fn list_public(
    State(state): State<AppState>,
) -> Result<Json<Vec<PublicAlly>>, AppError> {
    Ok(Json(
        AllyRepository::list_public(&state.pool)
            .await?
            .into_iter()
            .map(PublicAlly::from)
            .collect(),
    ))
}

/// Todos los aliados para el panel, incluidos los inactivos.
#[utoipa::path(
    get,
    path = "/api/admin/allies",
    responses((status = 200, body = [Ally]), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn list_admin(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Ally>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    Ok(Json(AllyRepository::list_admin(&state.pool).await?))
}

/// Crear un aliado.
#[utoipa::path(
    post,
    path = "/api/admin/allies",
    request_body = AllyRequest,
    responses((status = 201, body = Ally), (status = 422, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn create_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<AllyRequest>,
) -> Result<(StatusCode, Json<Ally>), AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let ally = AllyRepository::create(&state.pool, actor.id, &request).await?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "ally.created",
        "allies",
        Some(ally.id),
        json!({ "nombre": ally.nombre }),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(ally)))
}

/// Actualizar un aliado (nombre, logo, orden y visibilidad).
#[utoipa::path(
    put,
    path = "/api/admin/allies/{id}",
    params(("id" = Uuid, Path, description = "Aliado")),
    request_body = AllyRequest,
    responses((status = 200, body = Ally), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn update_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<AllyRequest>,
) -> Result<Json<Ally>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let ally = AllyRepository::update(&state.pool, id, actor.id, &request)
        .await?
        .ok_or_else(|| AppError::NotFound("Aliado no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "ally.updated",
        "allies",
        Some(id),
        json!({ "nombre": ally.nombre }),
    )
    .await?;
    Ok(Json(ally))
}

/// Eliminar un aliado.
#[utoipa::path(
    delete,
    path = "/api/admin/allies/{id}",
    params(("id" = Uuid, Path, description = "Aliado")),
    responses((status = 204, description = "Aliado eliminado"), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn delete_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let ally = AllyRepository::delete(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Aliado no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "ally.deleted",
        "allies",
        Some(id),
        json!({ "nombre": ally.nombre }),
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/allies", get(list_public))
        .route("/admin/allies", get(list_admin).post(create_admin))
        .route("/admin/allies/:id", put(update_admin).delete(delete_admin))
}
