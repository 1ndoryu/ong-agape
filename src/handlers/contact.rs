use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::domain::permissions::AdminPermission;
use crate::errors::AppError;
use crate::middleware::AuthUser;
use crate::models::{ContactMessage, ContactMessageRequest};
use crate::repositories::{AuditRepository, ContactRepository};
use crate::services::AdminService;
use crate::AppState;

/// Envía un mensaje desde la página pública de contacto. No requiere
/// autenticación; el formulario valida nombre, correo y mensaje.
#[utoipa::path(
    post,
    path = "/api/contact",
    request_body = ContactMessageRequest,
    responses(
        (status = 201, description = "Mensaje guardado", body = ContactMessage),
        (status = 422, description = "Datos inválidos", body = crate::errors::ErrorResponse)
    )
)]
pub async fn send_message(
    State(state): State<AppState>,
    Json(request): Json<ContactMessageRequest>,
) -> Result<(StatusCode, Json<ContactMessage>), AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    let message = ContactRepository::create(&state.pool, &request).await?;
    Ok((StatusCode::CREATED, Json(message)))
}

/// Lista los mensajes de contacto para el panel, los más recientes primero.
#[utoipa::path(
    get,
    path = "/api/admin/contact/messages",
    responses(
        (status = 200, body = [ContactMessage]),
        (status = 401, body = crate::errors::ErrorResponse)
    ),
    security(("bearer_auth" = []))
)]
pub async fn list_messages(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<ContactMessage>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    Ok(Json(ContactRepository::list(&state.pool).await?))
}

/// Elimina un mensaje de contacto. El borrado es físico y queda auditado.
#[utoipa::path(
    delete,
    path = "/api/admin/contact/messages/{id}",
    params(("id" = Uuid, Path, description = "Mensaje de contacto")),
    responses(
        (status = 204, description = "Mensaje eliminado"),
        (status = 404, body = crate::errors::ErrorResponse),
        (status = 401, body = crate::errors::ErrorResponse)
    ),
    security(("bearer_auth" = []))
)]
pub async fn delete_message(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let message = ContactRepository::delete(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Mensaje no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "contact_message.deleted",
        "contact_messages",
        Some(id),
        json!({ "email": message.email }),
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/contact", post(send_message))
        .route("/admin/contact/messages", get(list_messages))
        .route("/admin/contact/messages/:id", delete(delete_message))
}
