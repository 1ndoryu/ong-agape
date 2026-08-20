use crate::models::{
    CreateManualReceiptRequest, PaymentMethodRecord, PaymentReceiptRecord,
    UpdatePaymentMethodRequest,
};
use sqlx::PgPool;
use uuid::Uuid;

pub struct PaymentRepository;

impl PaymentRepository {
    pub async fn list_methods(pool: &PgPool) -> Result<Vec<PaymentMethodRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentMethodRecord>(
            "SELECT id, provider, public_label, mode, status, \
             jsonb_build_object('instructions', public_config->>'instructions') AS public_config, \
             display_order, updated_at \
             FROM payment_methods ORDER BY display_order, public_label",
        )
        .fetch_all(pool)
        .await
    }

    pub async fn list_public_methods(
        pool: &PgPool,
    ) -> Result<Vec<PaymentMethodRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentMethodRecord>(
            "SELECT id, provider, public_label, mode, status, \
             jsonb_build_object('instructions', public_config->>'instructions') AS public_config, \
             display_order, updated_at FROM payment_methods \
             WHERE status = 'enabled' ORDER BY display_order, public_label",
        )
        .fetch_all(pool)
        .await
    }

    pub async fn get_method(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<PaymentMethodRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentMethodRecord>(
            "SELECT id, provider, public_label, mode, status, \
             jsonb_build_object('instructions', public_config->>'instructions') AS public_config, \
             display_order, updated_at \
             FROM payment_methods WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn update_method(
        pool: &PgPool,
        id: Uuid,
        request: &UpdatePaymentMethodRequest,
    ) -> Result<Option<PaymentMethodRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentMethodRecord>(
            "UPDATE payment_methods SET \
             public_label = COALESCE($2, public_label), \
             public_config = CASE WHEN $3::TEXT IS NULL THEN public_config \
                 ELSE jsonb_set(public_config, '{instructions}', to_jsonb($3::TEXT), true) END, \
             status = COALESCE($4, status), display_order = COALESCE($5, display_order), \
             updated_at = NOW() WHERE id = $1 \
             RETURNING id, provider, public_label, mode, status, \
             jsonb_build_object('instructions', public_config->>'instructions') AS public_config, \
             display_order, updated_at",
        )
        .bind(id)
        .bind(request.public_label.as_deref())
        .bind(request.instructions.as_deref())
        .bind(request.status.as_deref())
        .bind(request.display_order)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_receipts(
        pool: &PgPool,
        status: Option<&str>,
    ) -> Result<Vec<PaymentReceiptRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentReceiptRecord>(
            "SELECT id, payment_method_id, provider_event_id, provider_reference, donor_name, \
             amount_minor, currency, proof_url, status, received_at, reviewed_by, reviewed_at, review_note \
             FROM payment_receipts WHERE ($1::TEXT IS NULL OR status = $1) \
             ORDER BY received_at DESC LIMIT 200",
        )
        .bind(status)
        .fetch_all(pool)
        .await
    }

    pub async fn create_manual_receipt(
        pool: &PgPool,
        request: &CreateManualReceiptRequest,
    ) -> Result<PaymentReceiptRecord, sqlx::Error> {
        sqlx::query_as::<_, PaymentReceiptRecord>(
            "INSERT INTO payment_receipts \
             (payment_method_id, provider_reference, donor_name, amount_minor, currency, proof_url) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             RETURNING id, payment_method_id, provider_event_id, provider_reference, donor_name, \
             amount_minor, currency, proof_url, status, received_at, reviewed_by, reviewed_at, review_note",
        )
        .bind(request.payment_method_id)
        .bind(&request.provider_reference)
        .bind(&request.donor_name)
        .bind(request.amount_minor)
        .bind(request.currency.to_ascii_uppercase())
        .bind(&request.proof_url)
        .fetch_one(pool)
        .await
    }

    pub async fn review_receipt(
        pool: &PgPool,
        id: Uuid,
        status: &str,
        review_note: Option<&str>,
        reviewer_id: Uuid,
    ) -> Result<Option<PaymentReceiptRecord>, sqlx::Error> {
        let mut transaction = pool.begin().await?;
        let receipt = sqlx::query_as::<_, PaymentReceiptRecord>(
            "UPDATE payment_receipts SET status = $2, review_note = $3, reviewed_by = $4, \
             reviewed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'pending_verification' \
             RETURNING id, payment_method_id, provider_event_id, provider_reference, donor_name, \
             amount_minor, currency, proof_url, status, received_at, reviewed_by, reviewed_at, review_note",
        )
        .bind(id)
        .bind(status)
        .bind(review_note)
        .bind(reviewer_id)
        .fetch_optional(&mut *transaction)
        .await?;

        let Some(receipt) = receipt else {
            transaction.rollback().await?;
            return Ok(None);
        };

        if receipt.status == "approved" {
            sqlx::query(
                "INSERT INTO transparency_entries \
                 (entry_type, concept, amount_minor, currency, occurred_on, status, evidence_url, \
                  payment_method_id, payment_receipt_id) \
                     VALUES ('income', 'Donación recibida', $1, $2, $3, 'verified', $4, $5, $6) \
                     ON CONFLICT DO NOTHING",
            )
            .bind(receipt.amount_minor)
            .bind(&receipt.currency)
            .bind(receipt.received_at.date_naive())
            .bind(&receipt.proof_url)
            .bind(receipt.payment_method_id)
            .bind(receipt.id)
            .execute(&mut *transaction)
            .await?;
        }

        transaction.commit().await?;
        Ok(Some(receipt))
    }
}
