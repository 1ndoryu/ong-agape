use axum::extract::multipart::Field;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use std::path::PathBuf;
use utoipa::IntoParams;
use uuid::Uuid;
use validator::Validate;

use crate::domain::permissions::{AdminPermission, AdminRole};
use crate::errors::AppError;
use crate::middleware::AuthUser;
use crate::models::{
    AdminFundEntry, AdminPaymentMethod, AdminProfile, AuditEventRecord, CreateFundEntryRequest,
    CreateManualReceiptRequest, PaymentReceiptRecord, ReviewReceiptRequest,
    TransparencyContent, TransparencyContentRequest, UpdateFundEntryRequest,
    UpdateFundEntryStatusRequest, UpdatePaymentMethodRequest, UploadImageResponse,
};
use crate::repositories::{AuditRepository, ContentRepository, FundRepository, PaymentRepository, UpdateMethodParams};
use crate::services::{AdminService, PaymentService};
use crate::AppState;

/* Tipos de imagen aceptados en el panel para la galería de "Nuestra
 * historia". Replica el patrón de los comprobantes, pero solo imágenes. */
const IMAGEN_MIMES: [&str; 3] = ["image/jpeg", "image/png", "image/webp"];
/* Límite de tamaño de cada imagen del panel: 5 MB, igual que los
 * comprobantes. */
const IMAGEN_MAX_BYTES: usize = 5 * 1024 * 1024;

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

/* Valida las imágenes de una acción de transparencia. Son opcionales y hasta
 * 3; una entrada vacía significa "sin imagen". El resto debe ser una URL de
 * /uploads, una ruta estática relativa del sitio (p. ej. /imagenes/...) o
 * http(s) razonable. Replica el criterio de los contenidos. */
fn validate_action_images(images: &[String]) -> Result<(), AppError> {
    if images.len() > 3 {
        return Err(AppError::Validation(
            "La acción admite como máximo 3 imágenes".into(),
        ));
    }
    for url in images {
        if url.is_empty() {
            continue;
        }
        if url.len() > 2000 {
            return Err(AppError::Validation("URL de imagen demasiado larga".into()));
        }
        if !(url.starts_with('/') || url.starts_with("http://") || url.starts_with("https://")) {
            return Err(AppError::Validation(
                "URL de imagen inválida (debe ser /uploads/, una ruta del sitio o http(s)".into(),
            ));
        }
    }
    Ok(())
}

#[utoipa::path(
    put,
    path = "/api/admin/transparency/entries/{id}",
    params(("id" = Uuid, Path, description = "Movimiento")),
    request_body = UpdateFundEntryRequest,
    responses((status = 200, body = AdminFundEntry), (status = 401, body = crate::errors::ErrorResponse), (status = 403, body = crate::errors::ErrorResponse), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn update_entry(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateFundEntryRequest>,
) -> Result<Json<AdminFundEntry>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    validate_currency(&request.currency)?;
    validate_action_images(&request.images)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::WriteLedger).await?;
    let entry = FundRepository::update_entry(&state.pool, id, &request, actor.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Movimiento no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "transparency_entry.updated",
        "transparency_entry",
        Some(id),
        json!({ "concept": request.concept }),
    )
    .await?;
    Ok(Json(entry))
}

/* Elimina una entrada del libro (acción de transparencia incluida). Requiere
 * WriteLedger igual que la edición y devuelve 204 sin cuerpo. La auditoría
 * conserva el concepto para trazabilidad posterior al borrado. */
#[utoipa::path(
    delete,
    path = "/api/admin/transparency/entries/{id}",
    params(("id" = Uuid, Path, description = "Movimiento")),
    responses((status = 204, description = "Movimiento eliminado"), (status = 401, body = crate::errors::ErrorResponse), (status = 403, body = crate::errors::ErrorResponse), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn delete_entry(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::WriteLedger).await?;
    let entry = FundRepository::delete(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Movimiento no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "transparency_entry.deleted",
        "transparency_entry",
        Some(id),
        json!({ "concept": entry.concept, "entry_type": entry.entry_type }),
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
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
    /* Las imágenes del bloque son opcionales y hasta 3; una entrada vacía
     * significa "sin imagen". El resto debe ser una URL de /uploads, una ruta
     * estática relativa del sitio (p. ej. /imagenes/... para las fotografías
     * por defecto) o http(s) razonable. */
    if request.images.len() > 3 {
        return Err(AppError::Validation(
            "El bloque admite como máximo 3 imágenes".into(),
        ));
    }
    for url in &request.images {
        if url.is_empty() {
            continue;
        }
        if url.len() > 2000 {
            return Err(AppError::Validation("URL de imagen demasiado larga".into()));
        }
        if !(url.starts_with('/')
            || url.starts_with("http://")
            || url.starts_with("https://"))
        {
            return Err(AppError::Validation(
                "URL de imagen inválida (debe ser /uploads/, una ruta del sitio o http(s)".into(),
            ));
        }
    }
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
    responses((status = 200, body = [AdminPaymentMethod]), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn list_payment_methods(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<AdminPaymentMethod>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReadPanel).await?;
    let metodos = PaymentRepository::list_methods(&state.pool).await?;
    Ok(Json(metodos.into_iter().map(Into::into).collect()))
}

#[utoipa::path(
    put,
    path = "/api/admin/payment-methods/{id}",
    params(("id" = Uuid, Path, description = "Método de pago")),
    request_body = UpdatePaymentMethodRequest,
    responses((status = 200, body = AdminPaymentMethod), (status = 403, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn update_payment_method(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdatePaymentMethodRequest>,
) -> Result<Json<AdminPaymentMethod>, AppError> {
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
                && !PaymentService::automatic_provider_ready(&current)))
    {
        return Err(AppError::BadRequest(
            "Este proveedor necesita una cuenta y un adaptador verificado antes de activarse"
                .into(),
        ));
    }
    /* Cada bloque de fusión parte de la config actual y aplica solo los campos
     * presentes en la petición: así el panel edita un dato sin pisar los
     * demás. Los secretos son solo-escritura (un Some vacío los limpia). */
    let nueva_config = fusionar_config_publica(&current.public_config, &request);
    let nueva_provider_config = fusionar_provider_config(&current.provider_config, &request)?;
    let nueva_provider_secrets = fusionar_provider_secrets(&current.provider_secrets, &request);

    let method = PaymentRepository::update_method(
        &state.pool,
        &UpdateMethodParams {
            id,
            public_label: request.public_label.as_deref(),
            public_config: nueva_config.as_ref(),
            provider_config: nueva_provider_config.as_ref(),
            provider_secrets: nueva_provider_secrets.as_ref(),
            status: request.status.as_deref(),
            display_order: request.display_order,
        },
    )
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
    Ok(Json(method.into()))
}

/* Fusión de la configuración pública (instrucciones y datos bancarios).
 * Devuelve `None` si no cambió ningún campo. */
fn fusionar_config_publica(
    actual: &serde_json::Value,
    request: &UpdatePaymentMethodRequest,
) -> Option<serde_json::Value> {
    let mut config = actual.clone();
    let mut hubo_cambio = false;
    for (clave, valor) in [
        ("instructions", request.instructions.as_deref()),
        ("bank_name", request.bank_name.as_deref()),
        ("account_holder", request.account_holder.as_deref()),
        ("account_number", request.account_number.as_deref()),
        ("account_phone", request.account_phone.as_deref()),
        ("account_document", request.account_document.as_deref()),
    ] {
        if let Some(valor) = valor {
            config[clave] = json!(valor);
            hubo_cambio = true;
        }
    }
    hubo_cambio.then_some(config)
}

/* Fusión de la configuración del proveedor automático (solo campos no
 * secretos). El entorno se restringe a sandbox/live y la moneda a 3 letras
 * mayúsculas: ambos vienen validados también por el modelo. */
fn fusionar_provider_config(
    actual: &serde_json::Value,
    request: &UpdatePaymentMethodRequest,
) -> Result<Option<serde_json::Value>, AppError> {
    let mut config = actual.clone();
    let mut hubo_cambio = false;
    if let Some(valor) = request.client_id.as_deref() {
        config["client_id"] = json!(valor);
        hubo_cambio = true;
    }
    if let Some(valor) = request.publishable_key.as_deref() {
        config["publishable_key"] = json!(valor);
        hubo_cambio = true;
    }
    if let Some(valor) = request.environment.as_deref() {
        if valor != "sandbox" && valor != "live" {
            return Err(AppError::BadRequest(
                "El entorno del proveedor debe ser 'sandbox' o 'live'".into(),
            ));
        }
        config["environment"] = json!(valor);
        hubo_cambio = true;
    }
    if let Some(valor) = request.currency.as_deref() {
        let normalizado = valor.trim().to_ascii_uppercase();
        if normalizado.len() != 3 {
            return Err(AppError::BadRequest(
                "La moneda debe ser un código de 3 letras (p. ej. USD)".into(),
            ));
        }
        config["currency"] = json!(normalizado);
        hubo_cambio = true;
    }
    if let Some(valor) = request.account_label.as_deref() {
        config["account_label"] = json!(valor);
        hubo_cambio = true;
    }
    Ok(hubo_cambio.then_some(config))
}

/* Fusión de secretos del proveedor (solo-escritura): se guardan en
 * `provider_secrets` y nunca se devuelven en las respuestas. Un Some vacío
 * elimina el secreto guardado. */
fn fusionar_provider_secrets(
    actual: &serde_json::Value,
    request: &UpdatePaymentMethodRequest,
) -> Option<serde_json::Value> {
    let mut secretos = actual.clone();
    let mut hubo_cambio = false;
    for (clave, valor) in [
        ("client_secret", request.client_secret.as_deref()),
        ("webhook_id", request.webhook_id.as_deref()),
        ("secret_key", request.secret_key.as_deref()),
        ("webhook_secret", request.webhook_secret.as_deref()),
    ] {
        if let Some(valor) = valor {
            if valor.is_empty() {
                secretos.as_object_mut().map(|map| map.remove(clave));
            } else {
                secretos[clave] = json!(valor);
            }
            hubo_cambio = true;
        }
    }
    hubo_cambio.then_some(secretos)
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

/* Valida y guarda la imagen subida desde el panel. El nombre en disco es un
 * UUID aleatorio; nunca se confía en el nombre enviado por el cliente. */
async fn guardar_imagen(campo: Field<'_>, upload_dir: &str) -> Result<PathBuf, AppError> {
    let nombre_original = campo.file_name().unwrap_or_default().to_string();
    let tipo = campo.content_type().unwrap_or_default().to_string();
    if !IMAGEN_MIMES.contains(&tipo.as_str()) {
        return Err(AppError::BadRequest(
            "La imagen debe ser JPG, PNG o WebP".into(),
        ));
    }
    let datos = campo.bytes().await.map_err(|error| {
        AppError::BadRequest(format!("No se pudo leer la imagen: {error}"))
    })?;
    if datos.is_empty() || datos.len() > IMAGEN_MAX_BYTES {
        return Err(AppError::BadRequest(
            "La imagen está vacía o supera los 5 MB".into(),
        ));
    }
    let extension = nombre_original
        .rsplit('.')
        .next()
        .map(str::to_ascii_lowercase)
        .filter(|extension| matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "webp"))
        .unwrap_or_else(|| {
            /* Si no hay extensión confiable se usa la del tipo MIME. */
            match tipo.as_str() {
                "image/png" => "png".to_string(),
                "image/webp" => "webp".to_string(),
                _ => "jpg".to_string(),
            }
        });
    let nombre_archivo = format!("{}.{}", Uuid::new_v4(), extension);
    let ruta = PathBuf::from(upload_dir).join(nombre_archivo);
    std::fs::write(&ruta, &datos)
        .map_err(|error| AppError::Internal(format!("No se pudo guardar la imagen: {error}")))?;
    Ok(ruta)
}

/* Sube una imagen (multipart, campo "image") y devuelve su URL pública
 * relativa a /uploads. El panel la guarda después en el contenido. */
#[utoipa::path(
    post,
    path = "/api/admin/content/image",
    request_body = String,
    responses(
        (status = 200, description = "Imagen subida", body = UploadImageResponse),
        (status = 400, description = "Imagen inválida", body = crate::errors::ErrorResponse),
        (status = 401, description = "No autorizado", body = crate::errors::ErrorResponse)
    ),
    security(("bearer_auth" = []))
)]
pub async fn upload_content_image(
    State(state): State<AppState>,
    auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<UploadImageResponse>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let mut archivo_guardado: Option<PathBuf> = None;
    while let Some(campo) = multipart.next_field().await.map_err(|error| {
        AppError::BadRequest(format!("No se pudo leer el formulario: {error}"))
    })? {
        if campo.name().unwrap_or_default() == "image" {
            archivo_guardado = Some(guardar_imagen(campo, &state.upload_dir).await?);
        } else {
            /* Campos desconocidos se drenan para no bloquear la petición. */
            let _ = campo.bytes().await;
        }
    }
    let ruta = archivo_guardado
        .ok_or_else(|| AppError::BadRequest("Falta el campo de imagen".into()))?;
    let url = ruta
        .file_name()
        .and_then(|nombre| nombre.to_str())
        .map(|nombre| format!("/uploads/{nombre}"))
        .ok_or_else(|| AppError::Internal("No se pudo generar la URL de la imagen".into()))?;
    Ok(Json(UploadImageResponse { url }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin/me", get(me))
        .route(
            "/admin/transparency/entries",
            get(list_entries).post(create_entry),
        )
        .route(
            "/admin/transparency/entries/:id",
            put(update_entry).delete(delete_entry),
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
        .route("/admin/content/image", post(upload_content_image))
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
