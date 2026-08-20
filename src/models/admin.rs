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
    pub created_by: Option<Uuid>,
    pub verified_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct PaymentMethodRecord {
    pub id: Uuid,
    pub provider: String,
    pub public_label: String,
    pub mode: String,
    pub status: String,
    pub public_config: serde_json::Value,
    pub display_order: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PublicPaymentMethod {
    pub id: Uuid,
    pub provider: String,
    pub public_label: String,
    pub mode: String,
    pub public_config: serde_json::Value,
    pub display_order: i32,
}

impl From<PaymentMethodRecord> for PublicPaymentMethod {
    fn from(method: PaymentMethodRecord) -> Self {
        Self {
            id: method.id,
            provider: method.provider,
            public_label: method.public_label,
            mode: method.mode,
            public_config: method.public_config,
            display_order: method.display_order,
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdatePaymentMethodRequest {
    #[validate(length(min = 1, max = 120))]
    pub public_label: Option<String>,
    #[validate(length(max = 2_000))]
    pub instructions: Option<String>,
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
    pub amount_minor: i64,
    pub currency: String,
    pub proof_url: Option<String>,
    pub status: String,
    pub received_at: DateTime<Utc>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_note: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateManualReceiptRequest {
    pub payment_method_id: Uuid,
    #[validate(length(max = 255))]
    pub provider_reference: Option<String>,
    #[validate(length(max = 255))]
    pub donor_name: Option<String>,
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
