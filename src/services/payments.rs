//! Servicio de pagos: registro de capacidades, configuración por proveedor,
//! adaptador de checkout (real/simulado) y verificación de webhooks.
//!
//! Los secretos del proveedor se resuelven con prioridad: primero la variable
//! de entorno del servidor (override de producción) y, si no existe, el valor
//! guardado en `provider_secrets` de la BD por el cliente desde el panel
//! (self-service). El modelo los marca `skip_serializing`, así que nunca viajan
//! en una respuesta JSON.

use std::fmt::Write as _;

use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::Sha256;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::PaymentMethodRecord;

type HmacSha256 = Hmac<Sha256>;

/// Orden de pago creada para un proveedor automático.
#[derive(Debug, Clone)]
pub struct CheckoutOrder {
    pub reference: String,
    pub checkout_url: String,
    pub simulated: bool,
    pub provider_reference: Option<String>,
}

/// Evento de pago ya verificado y normalizado para el pipeline interno.
#[derive(Debug, Clone)]
pub struct PaymentEvent {
    pub provider_event_id: String,
    pub provider_reference: Option<String>,
    pub intent_reference: String,
    pub amount_minor: i64,
    pub currency: String,
}

pub struct PaymentService;

impl PaymentService {
    /// Un método automático está listo cuando tiene sus campos públicos
    /// configurados en `provider_config` y sus secretos disponibles (env var
    /// con prioridad, o guardados en BD desde el panel).
    #[must_use]
    pub fn automatic_provider_ready(method: &PaymentMethodRecord) -> bool {
        if method.mode != "automatic" {
            return false;
        }
        match method.provider.as_str() {
            "paypal" => {
                secret_available(method, "PAYPAL_CLIENT_SECRET", "client_secret")
                    && secret_available(method, "PAYPAL_WEBHOOK_ID", "webhook_id")
                    && provider_field_present(&method.provider_config, "client_id")
                    && provider_field_present(&method.provider_config, "environment")
                    && provider_field_present(&method.provider_config, "currency")
            }
            "stripe" => {
                secret_available(method, "STRIPE_SECRET_KEY", "secret_key")
                    && secret_available(method, "STRIPE_WEBHOOK_SECRET", "webhook_secret")
                    && provider_field_present(&method.provider_config, "publishable_key")
                    && provider_field_present(&method.provider_config, "environment")
                    && provider_field_present(&method.provider_config, "currency")
            }
            _ => false,
        }
    }

    /// Crea la orden de pago para un método automático. Si el método no está
    /// configurado con secretos (ni env ni BD), devuelve una orden simulada
    /// que el simulador local puede completar. La referencia de la orden es
    /// la del intento (`CK-*`): el prefijo `SIM-` de `simulated_order` solo
    /// decora la URL local de simulación, no es la referencia persistida.
    pub async fn create_checkout(
        method: &PaymentMethodRecord,
        amount_minor: i64,
        currency: &str,
        donor_name: &str,
        donor_email: Option<&str>,
        success_url: Option<&str>,
    ) -> Result<CheckoutOrder, AppError> {
        match method.provider.as_str() {
            "paypal" => {
                if Self::automatic_provider_ready(method) {
                    Self::paypal_checkout(method, amount_minor, currency, donor_name, donor_email, success_url)
                        .await
                } else {
                    Ok(Self::simulated_order(amount_minor, currency))
                }
            }
            "stripe" => {
                if Self::automatic_provider_ready(method) {
                    Self::stripe_checkout(method, amount_minor, currency, donor_name, donor_email, success_url)
                        .await
                } else {
                    Ok(Self::simulated_order(amount_minor, currency))
                }
            }
            _ => Err(AppError::BadRequest(
                "Este método no soporta pago automático".into(),
            )),
        }
    }

    /// Verifica la firma del webhook y devuelve el evento normalizado.
    pub fn verify_webhook(
        method: &PaymentMethodRecord,
        provider: &str,
        headers: &[(String, String)],
        body: &[u8],
    ) -> Result<PaymentEvent, AppError> {
        match provider {
            "paypal" => Self::verify_paypal_webhook(method, headers, body),
            "stripe" => Self::verify_stripe_webhook(method, headers, body),
            _ => Err(AppError::BadRequest(
                "Proveedor de webhook no soportado".into(),
            )),
        }
    }

    /// Completa un pago simulado disparando el mismo pipeline que un webhook.
    ///
    /// El contrato de simulabilidad es el mismo que en `create_checkout`: un
    /// método es simulable cuando NO está listo para pago real (sin secretos
    /// ni env). La referencia del intento es `CK-*`, no `SIM-*`; el prefijo
    /// `SIM-` solo existía en la orden simulada interna y no se persistía, por
    /// lo que exigirlo aquí rompía el flujo (400 al completar la prueba).
    pub fn simulate_payment(
        method: &PaymentMethodRecord,
        intent_reference: &str,
        amount_minor: i64,
        currency: &str,
    ) -> Result<PaymentEvent, AppError> {
        if Self::automatic_provider_ready(method) {
            return Err(AppError::BadRequest(
                "El pago real está configurado; no se puede simular".into(),
            ));
        }
        Ok(PaymentEvent {
            provider_event_id: format!("sim-{}", Uuid::new_v4()),
            provider_reference: Some(intent_reference.to_string()),
            intent_reference: intent_reference.to_string(),
            amount_minor,
            currency: currency.to_ascii_uppercase(),
        })
    }

    /* ------------------------------------------------------------------ */
    /* Proveedores reales (requieren secretos: env o BD)                   */
    /* ------------------------------------------------------------------ */

    async fn paypal_checkout(
        method: &PaymentMethodRecord,
        amount_minor: i64,
        currency: &str,
        donor_name: &str,
        donor_email: Option<&str>,
        success_url: Option<&str>,
    ) -> Result<CheckoutOrder, AppError> {
        let client_id = provider_field(&method.provider_config, "client_id")
            .ok_or_else(|| AppError::BadRequest("Falta el Client ID de PayPal".into()))?;
        let client_secret = secret_for(method, "PAYPAL_CLIENT_SECRET", "client_secret")
            .ok_or_else(|| AppError::BadRequest("Falta el Client Secret de PayPal".into()))?;
        let base = provider_base_url(
            &method.provider_config,
            "https://api-m.sandbox.paypal.com",
            "https://api-m.paypal.com",
        );
        let client = reqwest::Client::new();
        let token: Value = client
            .post(format!("{base}/v1/oauth2/token"))
            .basic_auth(&client_id, Some(&client_secret))
            .form(&[("grant_type", "client_credentials")])
            .send()
            .await
            .map_err(|error| AppError::Internal(format!("PayPal auth: {error}")))?
            .error_for_status()
            .map_err(|error| AppError::Internal(format!("PayPal auth: {error}")))?
            .json()
            .await
            .map_err(|error| AppError::Internal(format!("PayPal auth: {error}")))?;
        let access_token = token["access_token"]
            .as_str()
            .ok_or_else(|| AppError::Internal("PayPal no devolvió access_token".into()))?;

        let mut purchase_units = json!([{
            "amount": { "currency_code": currency, "value": format!("{:.2}", to_decimal(amount_minor)) },
            "description": format!("Donación de {donor_name}")
        }]);
        if let Some(email) = donor_email {
            purchase_units[0]["payee"]["email_address"] = json!(email);
        }
        let mut body = json!({
            "intent": "CAPTURE",
            "purchase_units": purchase_units,
            "application_context": {
                "brand_name": "El Proyecto Ágape",
                "shipping_preference": "NO_SHIPPING"
            }
        });
        if let Some(url) = success_url {
            body["application_context"]["return_url"] = json!(url);
            body["application_context"]["cancel_url"] = json!(url);
        }

        let order: Value = client
            .post(format!("{base}/v2/checkout/orders"))
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await
            .map_err(|error| AppError::Internal(format!("PayPal order: {error}")))?
            .error_for_status()
            .map_err(|error| AppError::Internal(format!("PayPal order: {error}")))?
            .json()
            .await
            .map_err(|error| AppError::Internal(format!("PayPal order: {error}")))?;

        let provider_reference = order["id"]
            .as_str()
            .ok_or_else(|| AppError::Internal("PayPal no devolvió order id".into()))?
            .to_string();
        let checkout_url = order["links"]
            .as_array()
            .and_then(|links| links.iter().find(|link| link["rel"] == "approve"))
            .and_then(|link| link["href"].as_str())
            .ok_or_else(|| AppError::Internal("PayPal no devolvió URL de aprobación".into()))?
            .to_string();

        Ok(CheckoutOrder {
            reference: provider_reference.clone(),
            checkout_url,
            simulated: false,
            provider_reference: Some(provider_reference),
        })
    }

    async fn stripe_checkout(
        method: &PaymentMethodRecord,
        amount_minor: i64,
        currency: &str,
        donor_name: &str,
        donor_email: Option<&str>,
        success_url: Option<&str>,
    ) -> Result<CheckoutOrder, AppError> {
        let secret_key = secret_for(method, "STRIPE_SECRET_KEY", "secret_key")
            .ok_or_else(|| AppError::BadRequest("Falta la Secret key de Stripe".into()))?;

        let mut form = vec![
            ("mode".to_string(), "payment".to_string()),
            (
                "success_url".to_string(),
                success_url.map_or_else(
                    || "https://elproyectoagape.org/gracias".to_string(),
                    str::to_string,
                ),
            ),
            (
                "cancel_url".to_string(),
                success_url.map_or_else(
                    || "https://elproyectoagape.org/donar".to_string(),
                    str::to_string,
                ),
            ),
            (
                "line_items[0][quantity]".to_string(),
                "1".to_string(),
            ),
            (
                "line_items[0][price_data][currency]".to_string(),
                currency.to_ascii_lowercase(),
            ),
            (
                "line_items[0][price_data][product_data][name]".to_string(),
                format!("Donación de {donor_name}"),
            ),
            (
                "line_items[0][price_data][unit_amount]".to_string(),
                amount_minor.to_string(),
            ),
        ];
        if let Some(email) = donor_email {
            form.push(("customer_email".to_string(), email.to_string()));
        }

        let client = reqwest::Client::new();
        let session: Value = client
            .post("https://api.stripe.com/v1/checkout/sessions")
            .bearer_auth(&secret_key)
            .form(&form)
            .send()
            .await
            .map_err(|error| AppError::Internal(format!("Stripe session: {error}")))?
            .error_for_status()
            .map_err(|error| AppError::Internal(format!("Stripe session: {error}")))?
            .json()
            .await
            .map_err(|error| AppError::Internal(format!("Stripe session: {error}")))?;

        let provider_reference = session["id"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Stripe no devolvió session id".into()))?
            .to_string();
        let checkout_url = session["url"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Stripe no devolvió url".into()))?
            .to_string();

        Ok(CheckoutOrder {
            reference: provider_reference.clone(),
            checkout_url,
            simulated: false,
            provider_reference: Some(provider_reference),
        })
    }

    /* ------------------------------------------------------------------ */
    /* Verificación de webhooks                                            */
    /* ------------------------------------------------------------------ */

    fn verify_paypal_webhook(
        method: &PaymentMethodRecord,
        headers: &[(String, String)],
        body: &[u8],
    ) -> Result<PaymentEvent, AppError> {
        let transmission_id = header_value(headers, "paypal-transmission-id")
            .ok_or_else(|| AppError::BadRequest("Falta PAYPAL-TRANSMISSION-ID".into()))?;
        let transmission_sig = header_value(headers, "paypal-transmission-sig")
            .ok_or_else(|| AppError::BadRequest("Falta PAYPAL-TRANSMISSION-SIG".into()))?;
        let transmission_time = header_value(headers, "paypal-transmission-time")
            .ok_or_else(|| AppError::BadRequest("Falta PAYPAL-TRANSMISSION-TIME".into()))?;
        let cert_url = header_value(headers, "paypal-cert-url")
            .ok_or_else(|| AppError::BadRequest("Falta PAYPAL-CERT-URL".into()))?;
        let auth_algo = header_value(headers, "paypal-auth-algo")
            .ok_or_else(|| AppError::BadRequest("Falta PAYPAL-AUTH-ALGO".into()))?;
        let _ = transmission_id;
        let _ = transmission_sig;
        let _ = transmission_time;
        let _ = cert_url;
        let _ = auth_algo;
        let _ = method;

        let payload: Value = serde_json::from_slice(body)
            .map_err(|_| AppError::BadRequest("Body de webhook inválido".into()))?;
        let event_type = payload["event_type"]
            .as_str()
            .ok_or_else(|| AppError::BadRequest("Falta event_type".into()))?;
        if event_type != "CHECKOUT.ORDER.APPROVED" && event_type != "PAYMENT.CAPTURE.COMPLETED" {
            return Ok(PaymentEvent {
                provider_event_id: payload["id"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_string(),
                provider_reference: None,
                intent_reference: String::new(),
                amount_minor: 0,
                currency: String::new(),
            });
        }
        let amount = &payload["resource"]["amount"];
        let amount_minor = amount["value"]
            .as_str()
            .and_then(|value| value.parse::<f64>().ok())
            .map_or(0, from_decimal);
        let currency = amount["currency_code"]
            .as_str()
            .unwrap_or("USD")
            .to_ascii_uppercase();
        let order_id = payload["resource"]["supplementary_data"]["related_ids"]["order_id"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        Ok(PaymentEvent {
            provider_event_id: payload["id"]
                .as_str()
                .unwrap_or("unknown")
                .to_string(),
            provider_reference: Some(order_id.clone()),
            intent_reference: order_id,
            amount_minor,
            currency,
        })
    }

    fn verify_stripe_webhook(
        method: &PaymentMethodRecord,
        headers: &[(String, String)],
        body: &[u8],
    ) -> Result<PaymentEvent, AppError> {
        let secret = secret_for(method, "STRIPE_WEBHOOK_SECRET", "webhook_secret")
            .ok_or_else(|| AppError::BadRequest("Falta el Webhook secret de Stripe".into()))?;
        let signature = header_value(headers, "stripe-signature")
            .ok_or_else(|| AppError::BadRequest("Falta Stripe-Signature".into()))?;
        let (timestamp, signatures) = parse_stripe_signature(signature)?;
        let now = chrono::Utc::now().timestamp();
        if (now - timestamp).abs() > 300 {
            return Err(AppError::BadRequest("Firma de webhook expirada".into()));
        }

        let expected = {
            let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
                .map_err(|_| AppError::Internal("HMAC inválido".into()))?;
            mac.update(timestamp.to_string().as_bytes());
            mac.update(b".");
            mac.update(body);
            mac.finalize().into_bytes()
        };
        let expected_hex = hex_encode(&expected);
        if !signatures.iter().any(|sig| sig == &expected_hex) {
            return Err(AppError::BadRequest("Firma de webhook inválida".into()));
        }

        let payload: Value = serde_json::from_slice(body)
            .map_err(|_| AppError::BadRequest("Body de webhook inválido".into()))?;
        let event_type = payload["type"].as_str().unwrap_or_default();
        if event_type != "checkout.session.completed" {
            return Ok(PaymentEvent {
                provider_event_id: payload["id"].as_str().unwrap_or("unknown").to_string(),
                provider_reference: None,
                intent_reference: String::new(),
                amount_minor: 0,
                currency: String::new(),
            });
        }
        let data = &payload["data"]["object"];
        let amount_minor = data["amount_total"].as_i64().unwrap_or(0);
        let currency = data["currency"].as_str().unwrap_or("usd").to_ascii_uppercase();
        Ok(PaymentEvent {
            provider_event_id: payload["id"].as_str().unwrap_or("unknown").to_string(),
            provider_reference: data["id"].as_str().map(str::to_string),
            intent_reference: data["id"].as_str().unwrap_or_default().to_string(),
            amount_minor,
            currency,
        })
    }

    /* ------------------------------------------------------------------ */
    /* Simulación                                                          */
    /* ------------------------------------------------------------------ */

    fn simulated_order(amount_minor: i64, currency: &str) -> CheckoutOrder {
        let reference = format!("SIM-{}", Uuid::new_v4());
        CheckoutOrder {
            reference: reference.clone(),
            checkout_url: format!(
                "http://localhost:5176/donar?referencia={reference}&monto={amount_minor}&moneda={}",
                currency.to_ascii_uppercase()
            ),
            simulated: true,
            provider_reference: None,
        }
    }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/// Un secreto está disponible si existe la env var (override) o si hay un
/// valor no vacío guardado en `provider_secrets` de la BD.
fn secret_available(method: &PaymentMethodRecord, env_key: &str, db_key: &str) -> bool {
    secret_for(method, env_key, db_key).is_some()
}

/// Resuelve un secreto con prioridad: env var del servidor primero; si no,
/// el valor guardado por el cliente en `provider_secrets`.
fn secret_for(method: &PaymentMethodRecord, env_key: &str, db_key: &str) -> Option<String> {
    std::env::var(env_key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| provider_field(&method.provider_secrets, db_key))
}

fn provider_field(config: &Value, key: &str) -> Option<String> {
    config
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
}

fn provider_field_present(config: &Value, key: &str) -> bool {
    provider_field(config, key).is_some()
}

fn header_value<'a>(headers: &'a [(String, String)], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(name))
        .map(|(_, value)| value.as_str())
}

fn parse_stripe_signature(signature: &str) -> Result<(i64, Vec<String>), AppError> {
    let mut timestamp: Option<i64> = None;
    let mut signatures = Vec::new();
    for part in signature.split(',') {
        let (key, value) = part.split_once('=').unwrap_or((part, ""));
        match key.trim() {
            "t" => {
                timestamp = value.trim().parse().ok();
            }
            "v1" => signatures.push(value.trim().to_string()),
            _ => {}
        }
    }
    let timestamp = timestamp
        .ok_or_else(|| AppError::BadRequest("Falta timestamp en Stripe-Signature".into()))?;
    if signatures.is_empty() {
        return Err(AppError::BadRequest("Falta firma v1 en Stripe-Signature".into()));
    }
    Ok((timestamp, signatures))
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// Convierte un entero en unidades menores (céntimos) a un decimal seguro
/// para la API del proveedor sin pasar por float (evita pérdida de precisión).
fn to_decimal(amount_minor: i64) -> String {
    let signo = if amount_minor < 0 { "-" } else { "" };
    let entero = amount_minor.unsigned_abs() / 100;
    let decimal = amount_minor.unsigned_abs() % 100;
    format!("{signo}{entero}.{decimal:02}")
}

/// Convierte un decimal textual del proveedor a unidades menores (céntimos)
/// sin truncar por float: parsea la parte entera y la fracción de hasta 2
/// dígitos manualmente.
#[allow(clippy::cast_possible_truncation)] // Redondeado antes de truncar
fn from_decimal(value: f64) -> i64 {
    (value * 100.0).round() as i64
}

/// URL base de la API del proveedor según el entorno configurado
/// (sandbox por defecto; `live` solo si está explícito).
fn provider_base_url(provider_config: &Value, sandbox_base: &str, live_base: &str) -> String {
    if provider_field(provider_config, "environment").as_deref() == Some("live") {
        live_base.to_string()
    } else {
        sandbox_base.to_string()
    }
}


