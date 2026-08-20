use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use utoipa::IntoParams;
use uuid::Uuid;
use validator::Validate;

use crate::domain::permissions::{AdminPermission, AdminRole};
use crate::errors::AppError;
use crate::middleware::AuthUser;
use crate::models::{
    AdminFundEntry, AdminProfile, AuditEventRecord, CreateFundEntryRequest,
    CreateManualReceiptRequest, PaymentMethodRecord, PaymentReceiptRecord, ReviewReceiptRequest,
    TransparencyContent, TransparencyContentRequest, UpdateFundEntryStatusRequest,
    UpdatePaymentMethodRequest,
};
use crate::repositories::{AuditRepository, ContentRepository, FundRepository, PaymentRepository};
use crate::services::{AdminService, PaymentService};
use crate::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct StatusFilter {
    pub status: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/admin/me",
    responses((status = 200, body = AdminProfile), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn me(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<AdminProfile>, AppError> {
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReadPanel).await?;
    Ok(Json(AdminProfile {
        id: actor.id,
        email: actor.email,
        role: format_role(actor.role),
        status: "active".to_string(),
    }))
}

#[utoipa::path(
    get,
    path = "/api/admin/transparency/entries",
    params(StatusFilter),
    responses((status = 200, body = [AdminFundEntry]), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn list_entries(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filter): Query<StatusFilter>,
) -> Result<Json<Vec<AdminFundEntry>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReadPanel).await?;
    Ok(Json(
        FundRepository::list_admin(&state.pool, filter.status.as_deref()).await?,
    ))
}

#[utoipa::path(
    post,
    path = "/api/admin/transparency/entries",
    request_body = CreateFundEntryRequest,
    responses((status = 201, body = AdminFundEntry), (status = 401, body = crate::errors::ErrorResponse), (status = 422, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn create_entry(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<CreateFundEntryRequest>,
) -> Result<(StatusCode, Json<AdminFundEntry>), AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    validate_entry(&request)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::WriteLedger).await?;
    let entry = FundRepository::create_pending(&state.pool, actor.id, &request).await?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "transparency_entry.created",
        "transparency_entry",
        Some(entry.id),
        json!({ "status": "pending" }),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(entry)))
}

#[utoipa::path(
    put,
    path = "/api/admin/transparency/entries/{id}/status",
    params(("id" = Uuid, Path, description = "Movimiento")),
    request_body = UpdateFundEntryStatusRequest,
    responses((status = 200, body = AdminFundEntry), (status = 401, body = crate::errors::ErrorResponse), (status = 403, body = crate::errors::ErrorResponse), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn update_entry_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateFundEntryStatusRequest>,
) -> Result<Json<AdminFundEntry>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    validate_entry_status(&request.status)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReviewLedger).await?;
    if request.status == "published" && actor.role != AdminRole::Owner {
        return Err(AppError::Forbidden);
    }
    let entry = FundRepository::update_status(
        &state.pool,
        id,
        &request.status,
        request.review_note.as_deref(),
        actor.id,
    )
    .await?
    .ok_or_else(|| AppError::NotFound("Movimiento no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "transparency_entry.status_changed",
        "transparency_entry",
        Some(id),
        json!({ "status": request.status }),
    )
    .await?;
    Ok(Json(entry))
}

#[utoipa::path(
    get,
    path = "/api/admin/transparency/content/{key}",
    params(("key" = String, Path, description = "Clave del bloque")),
    responses((status = 200, body = TransparencyContent), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn get_content(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(key): Path<String>,
) -> Result<Json<TransparencyContent>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let content = ContentRepository::get(&state.pool, &key, false)
        .await?
        .ok_or_else(|| AppError::NotFound("Contenido no encontrado".into()))?;
    Ok(Json(content))
}

#[utoipa::path(
    put,
    path = "/api/admin/transparency/content/{key}",
    params(("key" = String, Path, description = "Clave del bloque")),
    request_body = TransparencyContentRequest,
    responses((status = 200, body = TransparencyContent), (status = 422, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn upsert_content(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(key): Path<String>,
    Json(request): Json<TransparencyContentRequest>,
) -> Result<Json<TransparencyContent>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    validate_content_key(&key)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let content = ContentRepository::upsert_draft(&state.pool, &key, actor.id, &request).await?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "transparency_content.draft_saved",
        "transparency_content",
        Some(content.id),
        json!({ "key": key }),
    )
    .await?;
    Ok(Json(content))
}

#[utoipa::path(
    post,
    path = "/api/admin/transparency/content/{key}/publish",
    params(("key" = String, Path, description = "Clave del bloque")),
    responses((status = 200, body = TransparencyContent), (status = 403, body = crate::errors::ErrorResponse), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn publish_content(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(key): Path<String>,
) -> Result<Json<TransparencyContent>, AppError> {
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    if actor.role != AdminRole::Owner {
        return Err(AppError::Forbidden);
    }
    let content = ContentRepository::set_status(&state.pool, &key, "published", actor.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Contenido no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "transparency_content.published",
        "transparency_content",
        Some(content.id),
        json!({ "key": key }),
    )
    .await?;
    Ok(Json(content))
}

#[utoipa::path(
    get,
    path = "/api/admin/payment-methods",
    responses((status = 200, body = [PaymentMethodRecord]), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn list_payment_methods(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<PaymentMethodRecord>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReadPanel).await?;
    Ok(Json(PaymentRepository::list_methods(&state.pool).await?))
}

#[utoipa::path(
    put,
    path = "/api/admin/payment-methods/{id}",
    params(("id" = Uuid, Path, description = "Método de pago")),
    request_body = UpdatePaymentMethodRequest,
    responses((status = 200, body = PaymentMethodRecord), (status = 403, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn update_payment_method(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdatePaymentMethodRequest>,
) -> Result<Json<PaymentMethodRecord>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    if let Some(status) = request.status.as_deref() {
        validate_method_status(status)?;
    }
    let actor = AdminService::authorize(
        &state.pool,
        auth.user_id,
        AdminPermission::ManagePaymentMethods,
    )
    .await?;
    let current = PaymentRepository::get_method(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Método de pago no encontrado".into()))?;
    if request.status.as_deref() == Some("enabled")
        && (current.provider == "zelle"
            || (current.mode == "automatic"
                && !PaymentService::automatic_provider_ready(&current.provider)))
    {
        return Err(AppError::BadRequest(
            "Este proveedor necesita una cuenta y un adaptador verificado antes de activarse"
                .into(),
        ));
    }
    let method = PaymentRepository::update_method(&state.pool, id, &request)
        .await?
        .ok_or_else(|| AppError::NotFound("Método de pago no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "payment_method.updated",
        "payment_method",
        Some(id),
        json!({ "status": method.status }),
    )
    .await?;
    Ok(Json(method))
}

#[utoipa::path(
    get,
    path = "/api/admin/payment-receipts",
    params(StatusFilter),
    responses((status = 200, body = [PaymentReceiptRecord]), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn list_payment_receipts(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filter): Query<StatusFilter>,
) -> Result<Json<Vec<PaymentReceiptRecord>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReadPanel).await?;
    Ok(Json(
        PaymentRepository::list_receipts(&state.pool, filter.status.as_deref()).await?,
    ))
}

#[utoipa::path(
    post,
    path = "/api/admin/payment-receipts/manual",
    request_body = CreateManualReceiptRequest,
    responses((status = 201, body = PaymentReceiptRecord), (status = 422, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn create_manual_receipt(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<CreateManualReceiptRequest>,
) -> Result<(StatusCode, Json<PaymentReceiptRecord>), AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    validate_currency(&request.currency)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::WriteLedger).await?;
    let method = PaymentRepository::get_method(&state.pool, request.payment_method_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Método de pago no encontrado".into()))?;
    if method.mode != "manual" || method.status != "enabled" {
        return Err(AppError::BadRequest(
            "El método manual no está habilitado".into(),
        ));
    }
    let receipt = PaymentRepository::create_manual_receipt(&state.pool, &request).await?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "payment_receipt.created",
        "payment_receipt",
        Some(receipt.id),
        json!({ "status": receipt.status, "currency": receipt.currency }),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(receipt)))
}

#[utoipa::path(
    put,
    path = "/api/admin/payment-receipts/{id}/review",
    params(("id" = Uuid, Path, description = "Recibo")),
    request_body = ReviewReceiptRequest,
    responses((status = 200, body = PaymentReceiptRecord), (status = 403, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn review_payment_receipt(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<ReviewReceiptRequest>,
) -> Result<Json<PaymentReceiptRecord>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    validate_receipt_status(&request.status)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReviewLedger).await?;
    let receipt = PaymentRepository::review_receipt(
        &state.pool,
        id,
        &request.status,
        request.review_note.as_deref(),
        actor.id,
    )
    .await?
    .ok_or_else(|| AppError::NotFound("Recibo no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "payment_receipt.reviewed",
        "payment_receipt",
        Some(id),
        json!({ "status": receipt.status }),
    )
    .await?;
    Ok(Json(receipt))
}

#[utoipa::path(
    get,
    path = "/api/admin/audit-events",
    responses((status = 200, body = [AuditEventRecord]), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn list_audit_events(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<AuditEventRecord>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReadAudit).await?;
    Ok(Json(AuditRepository::list(&state.pool).await?))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin/me", get(me))
        .route(
            "/admin/transparency/entries",
            get(list_entries).post(create_entry),
        )
        .route(
            "/admin/transparency/entries/:id/status",
            put(update_entry_status),
        )
        .route(
            "/admin/transparency/content/:key",
            get(get_content).put(upsert_content),
        )
        .route(
            "/admin/transparency/content/:key/publish",
            post(publish_content),
        )
        .route("/admin/payment-methods", get(list_payment_methods))
        .route("/admin/payment-methods/:id", put(update_payment_method))
        .route("/admin/payment-receipts", get(list_payment_receipts))
        .route(
            "/admin/payment-receipts/manual",
            post(create_manual_receipt),
        )
        .route(
            "/admin/payment-receipts/:id/review",
            put(review_payment_receipt),
        )
        .route("/admin/audit-events", get(list_audit_events))
}

fn format_role(role: AdminRole) -> String {
    match role {
        AdminRole::Owner => "owner",
        AdminRole::FinanceEditor => "finance_editor",
        AdminRole::Auditor => "auditor",
        AdminRole::Viewer => "viewer",
    }
    .to_string()
}

fn validate_entry(request: &CreateFundEntryRequest) -> Result<(), AppError> {
    if !matches!(request.entry_type.as_str(), "income" | "expense") {
        return Err(AppError::Validation("Tipo de movimiento inválido".into()));
    }
    validate_currency(&request.currency)
}

fn validate_entry_status(status: &str) -> Result<(), AppError> {
    if matches!(
        status,
        "draft" | "pending" | "verified" | "rejected" | "published"
    ) {
        Ok(())
    } else {
        Err(AppError::Validation("Estado de movimiento inválido".into()))
    }
}

fn validate_receipt_status(status: &str) -> Result<(), AppError> {
    if matches!(status, "approved" | "rejected") {
        Ok(())
    } else {
        Err(AppError::Validation("Estado de recibo inválido".into()))
    }
}

fn validate_method_status(status: &str) -> Result<(), AppError> {
    if matches!(status, "enabled" | "disabled" | "setup_required") {
        Ok(())
    } else {
        Err(AppError::Validation("Estado de método inválido".into()))
    }
}

fn validate_currency(currency: &str) -> Result<(), AppError> {
    if matches!(currency.to_ascii_uppercase().as_str(), "USD" | "VES") {
        Ok(())
    } else {
        Err(AppError::Validation("Moneda no soportada".into()))
    }
}

fn validate_content_key(key: &str) -> Result<(), AppError> {
    if key.is_empty()
        || key.len() > 64
        || !key.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
    {
        return Err(AppError::Validation("Clave de contenido inválida".into()));
    }
    Ok(())
}
