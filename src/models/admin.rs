use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminProfile {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub status: String,
}

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct AdminFundEntry {
    pub id: Uuid,
    pub entry_type: String,
    pub concept: String,
    pub campaign: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub occurred_on: NaiveDate,
    pub status: String,
    pub evidence_url: Option<String>,
    pub payment_method_id: Option<Uuid>,
    pub payment_receipt_id: Option<Uuid>,
    pub review_note: Option<String>,
    /* Narrativa e imágenes de la acción de transparencia. `images` es JSONB
     * en Postgres: llega como Value y el frontend lo consume como array. */
    pub description: Option<String>,
    #[serde(default)]
    pub images: serde_json::Value,
    pub created_by: Option<Uuid>,
    pub verified_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/* Edición de un movimiento desde el panel: solo los campos editables por
 * WriteLedger (concepto, campaña, montos, narrativa e imágenes). El tipo y
 * estado se gestionan por sus propias rutas. */
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateFundEntryRequest {
    #[validate(length(min = 1, max = 255))]
    pub concept: String,
    #[validate(length(max = 255))]
    pub campaign: Option<String>,
    #[validate(range(min = 1))]
    pub amount_minor: i64,
    #[validate(length(equal = 3))]
    pub currency: String,
    pub occurred_on: NaiveDate,
    #[validate(length(max = 5_000))]
    pub description: Option<String>,
    /* Hasta 3 imágenes de la acción. Se validan en el handler (por longitud y
     * prefijo de URL) igual que las de los contenidos. */
    #[serde(default)]
    pub images: Vec<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateFundEntryStatusRequest {
    #[validate(length(min = 1, max = 16))]
    pub status: String,
    #[validate(length(max = 500))]
    pub review_note: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct TransparencyContentRequest {
    #[validate(length(min = 1, max = 255))]
    pub title: String,
    #[validate(length(max = 10_000))]
    pub body: String,
    #[validate(length(max = 120))]
    pub cta_label: Option<String>,
    #[validate(url)]
    pub cta_url: Option<String>,
    /* Hasta 3 imágenes del bloque (p. ej. la galería de "Nuestra historia").
     * Se guardan en metadata como `images`; una URL vacía significa "sin
     * imagen" y se valida en el handler (por longitud y prefijo). */
    #[serde(default)]
    pub images: Vec<String>,
}

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct TransparencyContent {
    pub id: Uuid,
    pub content_key: String,
    pub locale: String,
    pub title: String,
    pub body: String,
    pub status: String,
    pub cta_label: Option<String>,
    pub cta_url: Option<String>,
    /* jsonb de Postgres: SQLx no lo decodifica directamente a Vec<String>,
     * así que llega como Value y se convierte al exponerlo. */
    pub images: serde_json::Value,
    pub updated_by: Option<Uuid>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PublicTransparencyContent {
    pub content_key: String,
    pub locale: String,
    pub title: String,
    pub body: String,
    pub cta_label: Option<String>,
    pub cta_url: Option<String>,
    pub images: Vec<String>,
}

impl From<TransparencyContent> for PublicTransparencyContent {
    fn from(content: TransparencyContent) -> Self {
        Self {
            content_key: content.content_key,
            locale: content.locale,
            title: content.title,
            body: content.body,
            cta_label: content.cta_label,
            cta_url: content.cta_url,
            images: serde_json::from_value(content.images).unwrap_or_default(),
        }
    }
}

/* Respuesta de la subida de imagen del panel: la URL pública relativa a
 * /uploads que el frontend guarda en el contenido. */
#[derive(Debug, Serialize, ToSchema)]
pub struct UploadImageResponse {
    pub url: String,
}

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct PaymentMethodRecord {
    pub id: Uuid,
    pub provider: String,
    pub public_label: String,
    pub mode: String,
    pub status: String,
    pub public_config: serde_json::Value,
    /* Configuración pública del proveedor automático (client_id/publishable_key,
     * environment, currency, account_label). Se devuelve al admin para
     * rellenar el formulario; nunca contiene secretos. */
    pub provider_config: serde_json::Value,
    /* Secretos del proveedor guardados en BD por el cliente (solo-escritura).
     * El backend los lee para checkout/webhooks, pero `skip_serializing`
     * garantiza que jamás viajan en una respuesta JSON. En producción las
     * env vars tienen prioridad. */
    #[serde(skip_serializing)]
    pub provider_secrets: serde_json::Value,
    /* Indica si el método ya tiene secretos guardados en BD (o por env var).
     * El admin lo usa para mostrar "configurado ✓" sin ver el valor. */
    pub has_secrets: bool,
    pub display_order: i32,
    pub updated_at: DateTime<Utc>,
}

/* Método de pago tal y como lo ve el panel admin. Igual que el registro
 * completo, pero añade `ready` para los automáticos (campos públicos +
 * secretos disponibles) para que la vista de métodos muestre "listo para
 * pagos" sin tener que adivinarlo. Nunca expone secretos. */
#[derive(Debug, Serialize, ToSchema)]
pub struct AdminPaymentMethod {
    pub id: Uuid,
    pub provider: String,
    pub public_label: String,
    pub mode: String,
    pub status: String,
    pub public_config: serde_json::Value,
    pub provider_config: serde_json::Value,
    pub has_secrets: bool,
    pub ready: bool,
    pub display_order: i32,
    pub updated_at: DateTime<Utc>,
}

impl From<PaymentMethodRecord> for AdminPaymentMethod {
    fn from(method: PaymentMethodRecord) -> Self {
        let ready = crate::services::PaymentService::automatic_provider_ready(&method);
        Self {
            id: method.id,
            provider: method.provider,
            public_label: method.public_label,
            mode: method.mode,
            status: method.status,
            public_config: method.public_config,
            provider_config: method.provider_config,
            has_secrets: method.has_secrets,
            ready,
            display_order: method.display_order,
            updated_at: method.updated_at,
        }
    }
}

/* Método de pago tal y como lo ve la página de donar. Incluye el estado real
 * (enabled/disabled/setup_required) y `ready` para los automáticos (true cuando
 * hay campos públicos configurados + secretos). Nunca expone provider_config
 * ni secretos. */
#[derive(Debug, Serialize, ToSchema)]
pub struct PublicPaymentMethod {
    pub id: Uuid,
    pub provider: String,
    pub public_label: String,
    pub mode: String,
    pub status: String,
    pub public_config: serde_json::Value,
    pub display_order: i32,
    pub ready: bool,
}

impl From<PaymentMethodRecord> for PublicPaymentMethod {
    fn from(method: PaymentMethodRecord) -> Self {
        let ready = crate::services::PaymentService::automatic_provider_ready(&method);
        Self {
            id: method.id,
            provider: method.provider,
            public_label: method.public_label,
            mode: method.mode,
            status: method.status,
            public_config: method.public_config,
            display_order: method.display_order,
            ready,
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdatePaymentMethodRequest {
    #[validate(length(min = 1, max = 120))]
    pub public_label: Option<String>,
    #[validate(length(max = 2_000))]
    pub instructions: Option<String>,
    /* Datos estructurados de los métodos manuales (pago móvil, transferencia,
     * zelle): viven en public_config y el público los ve en el modal de la
     * página de donar. Se admiten vacíos para limpiar un campo. */
    #[validate(length(max = 120))]
    pub bank_name: Option<String>,
    #[validate(length(max = 120))]
    pub account_holder: Option<String>,
    #[validate(length(max = 120))]
    pub account_number: Option<String>,
    #[validate(length(max = 120))]
    pub account_phone: Option<String>,
    #[validate(length(max = 120))]
    pub account_document: Option<String>,
    /* Configuración pública de proveedores automáticos (PayPal/Stripe). Solo
     * campos NO secretos: el identificador público, el entorno (sandbox/live),
     * la moneda y una etiqueta opcional de cuenta. */
    #[validate(length(max = 120))]
    pub client_id: Option<String>,
    #[validate(length(max = 120))]
    pub publishable_key: Option<String>,
    #[validate(length(max = 16))]
    pub environment: Option<String>,
    #[validate(length(equal = 3))]
    pub currency: Option<String>,
    #[validate(length(max = 120))]
    pub account_label: Option<String>,
    /* Secretos del proveedor: el cliente los escribe desde el panel y se
     * guardan en provider_secrets (solo-escritura). Un `Some` vacío limpia el
     * secreto. Nunca se devuelven al frontend. */
    #[validate(length(max = 200))]
    pub client_secret: Option<String>,
    #[validate(length(max = 200))]
    pub webhook_id: Option<String>,
    #[validate(length(max = 200))]
    pub secret_key: Option<String>,
    #[validate(length(max = 200))]
    pub webhook_secret: Option<String>,
    #[validate(length(max = 24))]
    pub status: Option<String>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct PaymentReceiptRecord {
    pub id: Uuid,
    pub payment_method_id: Uuid,
    pub provider_event_id: Option<String>,
    pub provider_reference: Option<String>,
    pub donor_name: Option<String>,
    pub donor_email: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub proof_url: Option<String>,
    pub status: String,
    pub received_at: DateTime<Utc>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_note: Option<String>,
}

/* Respuesta pública tras registrar una donación desde la página de donar:
 * incluye el id del recibo (referencia) y el estado inicial, que el equipo
 * revisa antes de publicar el ingreso. Nunca expone datos de contacto. */
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct PublicDonationReceipt {
    pub id: Uuid,
    pub status: String,
    pub provider_reference: Option<String>,
}

/* Datos que recibe el repositorio al crear un recibo desde la página pública
 * de donar. Se agrupan en un struct para mantener la firma del método corta. */
#[derive(Debug, Clone)]
pub struct NewPublicReceipt {
    pub payment_method_id: Uuid,
    pub provider_reference: Option<String>,
    pub donor_name: String,
    pub donor_email: Option<String>,
    pub amount_minor: i64,
    pub currency: String,
    pub proof_url: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateManualReceiptRequest {
    pub payment_method_id: Uuid,
    #[validate(length(max = 255))]
    pub provider_reference: Option<String>,
    #[validate(length(max = 255))]
    pub donor_name: Option<String>,
    #[validate(email)]
    pub donor_email: Option<String>,
    #[validate(range(min = 1))]
    pub amount_minor: i64,
    #[validate(length(equal = 3))]
    pub currency: String,
    #[validate(url)]
    pub proof_url: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ReviewReceiptRequest {
    #[validate(length(min = 1, max = 24))]
    pub status: String,
    #[validate(length(max = 500))]
    pub review_note: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct AuditEventRecord {
    pub id: Uuid,
    pub actor_id: Option<Uuid>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/* Intento de checkout de un método automático (PayPal/Stripe). `reference` es
 * la referencia que el proveedor (o el simulador local) usa para confirmar el
 * pago; `provider_reference` se rellena al completarse. Nunca guarda secretos. */
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct CheckoutIntent {
    pub id: Uuid,
    pub payment_method_id: Uuid,
    pub reference: String,
    pub amount_minor: i64,
    pub currency: String,
    pub donor_name: String,
    pub donor_email: Option<String>,
    pub status: String,
    pub provider_reference: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/* Petición del donante para iniciar un pago automático. Solo transporta datos
 * públicos del donante y la selección de método/monto; no lleva secretos. */
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateCheckoutRequest {
    pub payment_method_id: Uuid,
    #[validate(length(min = 1, max = 120))]
    pub donor_name: String,
    #[validate(email)]
    pub donor_email: Option<String>,
    #[validate(range(min = 1))]
    pub amount_minor: i64,
    #[validate(length(equal = 3))]
    pub currency: String,
}

/* Respuesta del checkout: `checkout_url` es a donde redirige el navegador (real
 * del proveedor o local de simulación). `simulated` indica que no hay
 * credenciales reales en el entorno y el pago se completará con el simulador. */
#[derive(Debug, Serialize, ToSchema)]
pub struct CheckoutResponse {
    pub reference: String,
    pub checkout_url: String,
    pub simulated: bool,
}

/* Estado de un checkout consultado por el donante al volver de la pasarela.
 * `receipt_id` y `status` del recibo se rellenan si el pago se completó. */
#[derive(Debug, Serialize, ToSchema)]
pub struct CheckoutStatus {
    pub reference: String,
    pub status: String,
    pub amount_minor: i64,
    pub currency: String,
    pub donor_name: String,
    pub receipt_id: Option<Uuid>,
    pub receipt_status: Option<String>,
    pub provider_reference: Option<String>,
}

