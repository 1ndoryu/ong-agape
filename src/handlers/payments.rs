//! Endpoints públicos del flujo de pago automático (PayPal/Stripe).
//!
//! Flujo coherente con la donación manual:
//! 1. `POST /api/payments/checkout` crea un intento (`checkout_intents`) y una
//!    orden real en el proveedor (si está configurado) o simulada (si no).
//! 2. El donante completa el pago en la pasarela (o en el simulador local).
//! 3. `POST /api/payments/webhooks/:provider` verifica la firma y aplica el
//!    mismo pipeline que una donación manual aprobada: recibo `approved` +
//!    ingreso `verified` al libro de transparencia.
//! 4. `GET /api/payments/checkout/:reference` deja consultar el estado.

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use uuid::Uuid;
use validator::Validate;

use crate::errors::AppError;
use crate::models::{CheckoutResponse, CheckoutStatus, CreateCheckoutRequest};
use crate::repositories::{ApplyAutomaticPaymentParams, PaymentRepository};
use crate::services::PaymentService;
use crate::AppState;

#[utoipa::path(
    post,
    path = "/api/payments/checkout",
    request_body = CreateCheckoutRequest,
    responses(
        (status = 201, description = "Orden creada (real o simulada)", body = CheckoutResponse),
        (status = 400, description = "Datos inválidos o método no operativo", body = crate::errors::ErrorResponse),
        (status = 404, description = "Método no encontrado", body = crate::errors::ErrorResponse)
    )
)]
pub async fn create_checkout(
    State(state): State<AppState>,
    Json(request): Json<CreateCheckoutRequest>,
) -> Result<(StatusCode, Json<CheckoutResponse>), AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;

    let method = PaymentRepository::get_method(&state.pool, request.payment_method_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Método de pago no encontrado".into()))?;
    if method.mode != "automatic" || method.status != "enabled" {
        return Err(AppError::BadRequest(
            "El método de pago no está habilitado para pago automático".into(),
        ));
    }

    let currency = request.currency.trim().to_ascii_uppercase();
    let intent = PaymentRepository::create_checkout_intent(
        &state.pool,
        method.id,
        &format!("CK-{}", Uuid::new_v4()),
        request.amount_minor,
        &currency,
        request.donor_name.trim(),
        request.donor_email.as_deref().map(str::trim).filter(|value| !value.is_empty()),
    )
    .await?;

    /* El checkout consulta al proveedor (si está listo) o devuelve una orden
     * simulada. La referencia del intento NO es la referencia del proveedor:
     * la pasarela/el simulador resuelve el pago y el webhook aplica el evento
     * al intento por su `reference`. */
    let order = PaymentService::create_checkout(
        &method,
        intent.amount_minor,
        &intent.currency,
        &intent.donor_name,
        intent.donor_email.as_deref(),
        None,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(CheckoutResponse {
            reference: intent.reference,
            checkout_url: order.checkout_url,
            simulated: order.simulated,
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/payments/webhooks/{provider}",
    params(("provider" = String, Path, description = "paypal | stripe")),
    responses(
        (status = 200, description = "Evento recibido (idempotente)"),
        (status = 400, description = "Firma inválida o proveedor no soportado", body = crate::errors::ErrorResponse)
    )
)]
pub async fn receive_webhook(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, AppError> {
    if provider != "paypal" && provider != "stripe" {
        return Err(AppError::BadRequest(
            "Proveedor de webhook no soportado".into(),
        ));
    }
    /* El webhook no trae el id del método: se localiza por proveedor. */
    let method = PaymentRepository::get_method_by_provider(&state.pool, &provider)
        .await?
        .ok_or_else(|| AppError::NotFound("Método automático no encontrado".into()))?;

    let headers_vec: Vec<(String, String)> = headers
        .iter()
        .map(|(name, value)| {
            (
                name.as_str().to_string(),
                value.to_str().unwrap_or_default().to_string(),
            )
        })
        .collect();

    let event = PaymentService::verify_webhook(&method, &provider, &headers_vec, &body)?;
    /* Eventos irrelevantes (amount 0) se confirman con 200 sin aplicar nada. */
    if event.amount_minor > 0 {
        let _ = PaymentRepository::apply_automatic_payment(
            &state.pool,
            &ApplyAutomaticPaymentParams {
                payment_method_id: method.id,
                provider_event_id: &event.provider_event_id,
                provider_reference: event.provider_reference.as_deref(),
                reference: &event.intent_reference,
                amount_minor: event.amount_minor,
                currency: &event.currency,
                donor_name: "Donación online",
                donor_email: None,
            },
        )
        .await?;
    }
    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/api/payments/simulate/{reference}",
    params(("reference" = String, Path, description = "Referencia del intento (CK-...)")),
    responses(
        (status = 200, description = "Pago simulado aplicado"),
        (status = 400, description = "El método está configurado para pago real o la referencia no es simulada", body = crate::errors::ErrorResponse)
    )
)]
pub async fn simulate_payment(
    State(state): State<AppState>,
    Path(reference): Path<String>,
) -> Result<StatusCode, AppError> {
    let intent = PaymentRepository::get_checkout_intent_by_reference(&state.pool, &reference)
        .await?
        .ok_or_else(|| AppError::NotFound("Intento de pago no encontrado".into()))?;
    let method = PaymentRepository::get_method(&state.pool, intent.payment_method_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Método de pago no encontrado".into()))?;

    let event = PaymentService::simulate_payment(
        &method,
        &intent.reference,
        intent.amount_minor,
        &intent.currency,
    )?;

    let _ = PaymentRepository::apply_automatic_payment(
        &state.pool,
        &ApplyAutomaticPaymentParams {
            payment_method_id: method.id,
            provider_event_id: &event.provider_event_id,
            provider_reference: event.provider_reference.as_deref(),
            reference: &event.intent_reference,
            amount_minor: event.amount_minor,
            currency: &event.currency,
            donor_name: &intent.donor_name,
            donor_email: intent.donor_email.as_deref(),
        },
    )
    .await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/api/payments/checkout/{reference}",
    params(("reference" = String, Path, description = "Referencia del intento")),
    responses(
        (status = 200, description = "Estado del intento y recibo", body = CheckoutStatus),
        (status = 404, description = "Intento no encontrado", body = crate::errors::ErrorResponse)
    )
)]
pub async fn checkout_status(
    State(state): State<AppState>,
    Path(reference): Path<String>,
) -> Result<Json<CheckoutStatus>, AppError> {
    let intent = PaymentRepository::get_checkout_intent_by_reference(&state.pool, &reference)
        .await?
        .ok_or_else(|| AppError::NotFound("Intento de pago no encontrado".into()))?;

    /* El recibo aprobado ligado al intento se busca por la referencia del
     * proveedor: apply_automatic_payment guarda esa misma referencia tanto en
     * el intento como en el recibo. */
    let (receipt_id, receipt_status) =
        match PaymentRepository::get_receipt_by_provider_reference(
            &state.pool,
            intent.provider_reference.as_deref(),
        )
        .await?
        {
            Some(recibo) => (Some(recibo.id), Some(recibo.status)),
            None => (None, None),
        };

    Ok(Json(CheckoutStatus {
        reference: intent.reference,
        status: intent.status,
        amount_minor: intent.amount_minor,
        currency: intent.currency,
        donor_name: intent.donor_name,
        receipt_id,
        receipt_status,
        provider_reference: intent.provider_reference,
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/payments/checkout", post(create_checkout))
        .route("/payments/webhooks/:provider", post(receive_webhook))
        .route("/payments/simulate/:reference", post(simulate_payment))
        .route("/payments/checkout/:reference", get(checkout_status))
}
