use crate::models::{
    CheckoutIntent, CreateManualReceiptRequest, LiveDonation, NewPublicReceipt,
    PaymentMethodRecord, PaymentReceiptRecord, PublicDonationReceipt,
};
use sqlx::PgPool;
use uuid::Uuid;

/// Parámetros opcionales para actualizar un método de pago. Un campo en `None`
/// deja el valor actual intacto; la fusión de config/secretos se hace en el
/// handler para que el panel edite un campo sin pisar los demás.
pub struct UpdateMethodParams<'a> {
    pub id: Uuid,
    pub public_label: Option<&'a str>,
    pub public_config: Option<&'a serde_json::Value>,
    pub provider_config: Option<&'a serde_json::Value>,
    pub provider_secrets: Option<&'a serde_json::Value>,
    pub status: Option<&'a str>,
    pub display_order: Option<i32>,
}

/// Datos de un pago automático confirmado que se aplica en una sola transacción.
pub struct ApplyAutomaticPaymentParams<'a> {
    pub payment_method_id: Uuid,
    pub provider_event_id: &'a str,
    pub provider_reference: Option<&'a str>,
    pub reference: &'a str,
    pub amount_minor: i64,
    pub currency: &'a str,
    pub donor_name: &'a str,
    pub donor_email: Option<&'a str>,
}

pub struct PaymentRepository;

impl PaymentRepository {
    /// Donaciones aprobadas más recientes para el feed en vivo de la página de
    /// donar. Solo incluye las que tienen nombre de donante (obligatorio a
    /// partir de ahora) y acota el resultado para no exponer datos de más.
    pub async fn list_live_donations(pool: &PgPool) -> Result<Vec<LiveDonation>, sqlx::Error> {
        sqlx::query_as::<_, LiveDonation>(
            "SELECT donor_name, amount_minor, currency FROM payment_receipts \
             WHERE status = 'approved' AND donor_name IS NOT NULL \
             ORDER BY received_at DESC LIMIT 12",
        )
        .fetch_all(pool)
        .await
    }

    pub async fn list_methods(pool: &PgPool) -> Result<Vec<PaymentMethodRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentMethodRecord>(
            "SELECT id, provider, public_label, mode, status, \
             jsonb_build_object( \
               'instructions', public_config->>'instructions', \
               'bank_name', public_config->>'bank_name', \
               'account_holder', public_config->>'account_holder', \
               'account_number', public_config->>'account_number', \
               'account_phone', public_config->>'account_phone', \
               'account_document', public_config->>'account_document' \
             ) AS public_config, \
             provider_config, provider_secrets, \
             (provider_secrets <> '{}'::jsonb) AS has_secrets, \
             display_order, updated_at \
             FROM payment_methods ORDER BY display_order, public_label",
        )
        .fetch_all(pool)
        .await
    }

    /* Devuelve todos los métodos, habilitados o no, junto con su estado real.
     * El frontend de la página de donar usa ese estado para distinguir los
     * métodos operativos de los que se muestran como simulación. */
    pub async fn list_public_methods(
        pool: &PgPool,
    ) -> Result<Vec<PaymentMethodRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentMethodRecord>(
            "SELECT id, provider, public_label, mode, status, \
             jsonb_build_object( \
               'instructions', public_config->>'instructions', \
               'bank_name', public_config->>'bank_name', \
               'account_holder', public_config->>'account_holder', \
               'account_number', public_config->>'account_number', \
               'account_phone', public_config->>'account_phone', \
               'account_document', public_config->>'account_document' \
             ) AS public_config, \
             provider_config, provider_secrets, \
             (provider_secrets <> '{}'::jsonb) AS has_secrets, \
             display_order, updated_at FROM payment_methods \
             ORDER BY display_order, public_label",
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
             jsonb_build_object( \
               'instructions', public_config->>'instructions', \
               'bank_name', public_config->>'bank_name', \
               'account_holder', public_config->>'account_holder', \
               'account_number', public_config->>'account_number', \
               'account_phone', public_config->>'account_phone', \
               'account_document', public_config->>'account_document' \
             ) AS public_config, \
             provider_config, provider_secrets, \
             (provider_secrets <> '{}'::jsonb) AS has_secrets, \
             display_order, updated_at \
             FROM payment_methods WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /* Localiza el método automático de un proveedor para procesar webhooks:
     * el webhook no trae payment_method_id, así que se busca por provider. */
    pub async fn get_method_by_provider(
        pool: &PgPool,
        provider: &str,
    ) -> Result<Option<PaymentMethodRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentMethodRecord>(
            "SELECT id, provider, public_label, mode, status, \
             jsonb_build_object( \
               'instructions', public_config->>'instructions', \
               'bank_name', public_config->>'bank_name', \
               'account_holder', public_config->>'account_holder', \
               'account_number', public_config->>'account_number', \
               'account_phone', public_config->>'account_phone', \
               'account_document', public_config->>'account_document' \
             ) AS public_config, \
             provider_config, provider_secrets, \
             (provider_secrets <> '{}'::jsonb) AS has_secrets, \
             display_order, updated_at \
             FROM payment_methods WHERE provider = $1 AND mode = 'automatic'",
        )
        .bind(provider)
        .fetch_optional(pool)
        .await
    }

    pub async fn update_method(
        pool: &PgPool,
        params: &UpdateMethodParams<'_>,
    ) -> Result<Option<PaymentMethodRecord>, sqlx::Error> {
        let UpdateMethodParams {
            id,
            public_label,
            public_config,
            provider_config,
            provider_secrets,
            status,
            display_order,
        } = params;
        /* La configuración completa se fusiona en Rust (handler) y se guarda
         * como JSONB: así el panel edita un campo sin pisar los demás. */
        let config_texto = public_config.map(serde_json::Value::to_string);
        let provider_config_texto = provider_config.map(serde_json::Value::to_string);
        let provider_secrets_texto = provider_secrets.map(serde_json::Value::to_string);
        sqlx::query_as::<_, PaymentMethodRecord>(
            "UPDATE payment_methods SET \
             public_label = COALESCE($2, public_label), \
             public_config = CASE WHEN $3::TEXT IS NULL THEN public_config \
                 ELSE $3::jsonb END, \
             provider_config = CASE WHEN $4::TEXT IS NULL THEN provider_config \
                 ELSE $4::jsonb END, \
             provider_secrets = CASE WHEN $5::TEXT IS NULL THEN provider_secrets \
                 ELSE $5::jsonb END, \
             status = COALESCE($6, status), display_order = COALESCE($7, display_order), \
             updated_at = NOW() WHERE id = $1 \
             RETURNING id, provider, public_label, mode, status, \
             jsonb_build_object( \
               'instructions', public_config->>'instructions', \
               'bank_name', public_config->>'bank_name', \
               'account_holder', public_config->>'account_holder', \
               'account_number', public_config->>'account_number', \
               'account_phone', public_config->>'account_phone', \
               'account_document', public_config->>'account_document' \
             ) AS public_config, provider_config, provider_secrets, \
             (provider_secrets <> '{}'::jsonb) AS has_secrets, \
             display_order, updated_at",
        )
        .bind(id)
        .bind(public_label)
        .bind(config_texto.as_deref())
        .bind(provider_config_texto.as_deref())
        .bind(provider_secrets_texto.as_deref())
        .bind(status)
        .bind(display_order)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_receipts(
        pool: &PgPool,
        status: Option<&str>,
    ) -> Result<Vec<PaymentReceiptRecord>, sqlx::Error> {
        sqlx::query_as::<_, PaymentReceiptRecord>(
            "SELECT id, payment_method_id, provider_event_id, provider_reference, donor_name, \
             donor_email, amount_minor, currency, proof_url, status, received_at, reviewed_by, \
             reviewed_at, review_note \
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
             (payment_method_id, provider_reference, donor_name, donor_email, amount_minor, \
              currency, proof_url) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             RETURNING id, payment_method_id, provider_event_id, provider_reference, donor_name, \
             donor_email, amount_minor, currency, proof_url, status, received_at, reviewed_by, \
             reviewed_at, review_note",
        )
        .bind(request.payment_method_id)
        .bind(&request.provider_reference)
        .bind(&request.donor_name)
        .bind(&request.donor_email)
        .bind(request.amount_minor)
        .bind(request.currency.to_ascii_uppercase())
        .bind(&request.proof_url)
        .fetch_one(pool)
        .await
    }

    /* Crea un recibo desde la página pública de donar. El estado inicial es
     * pending_verification: el equipo revisa el comprobante antes de aprobar
     * el ingreso (entonces sí aparece en el feed en vivo y en el libro). */
    pub async fn create_public_receipt(
        pool: &PgPool,
        nuevo: &NewPublicReceipt,
    ) -> Result<PublicDonationReceipt, sqlx::Error> {
        sqlx::query_as::<_, PublicDonationReceipt>(
            "INSERT INTO payment_receipts \
             (payment_method_id, provider_reference, donor_name, donor_email, amount_minor, \
              currency, proof_url) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             RETURNING id, status, provider_reference",
        )
        .bind(nuevo.payment_method_id)
        .bind(&nuevo.provider_reference)
        .bind(&nuevo.donor_name)
        .bind(&nuevo.donor_email)
        .bind(nuevo.amount_minor)
        .bind(nuevo.currency.to_ascii_uppercase())
        .bind(&nuevo.proof_url)
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
             donor_email, amount_minor, currency, proof_url, status, received_at, reviewed_by, \
             reviewed_at, review_note",
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

    /* Crea el intento de checkout de un método automático. La referencia es
     * única y es la que el donante lleva a la pasarela (o al simulador). */
    pub async fn create_checkout_intent(
        pool: &PgPool,
        payment_method_id: Uuid,
        reference: &str,
        amount_minor: i64,
        currency: &str,
        donor_name: &str,
        donor_email: Option<&str>,
    ) -> Result<CheckoutIntent, sqlx::Error> {
        sqlx::query_as::<_, CheckoutIntent>(
            "INSERT INTO checkout_intents \
             (payment_method_id, reference, amount_minor, currency, donor_name, donor_email) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             RETURNING id, payment_method_id, reference, amount_minor, currency, donor_name, \
             donor_email, status, provider_reference, created_at, completed_at",
        )
        .bind(payment_method_id)
        .bind(reference)
        .bind(amount_minor)
        .bind(currency.to_ascii_uppercase())
        .bind(donor_name)
        .bind(donor_email)
        .fetch_one(pool)
        .await
    }

    pub async fn get_checkout_intent_by_reference(
        pool: &PgPool,
        reference: &str,
    ) -> Result<Option<CheckoutIntent>, sqlx::Error> {
        sqlx::query_as::<_, CheckoutIntent>(
            "SELECT id, payment_method_id, reference, amount_minor, currency, donor_name, \
             donor_email, status, provider_reference, created_at, completed_at \
             FROM checkout_intents WHERE reference = $1",
        )
        .bind(reference)
        .fetch_optional(pool)
        .await
    }

    /* Localiza el recibo que ya se creó para una referencia del proveedor.
     * Lo usa el endpoint de estado del checkout para enlazar el intento con
     * su recibo (approved) sin exponer datos sensibles. */
    pub async fn get_receipt_by_provider_reference(
        pool: &PgPool,
        provider_reference: Option<&str>,
    ) -> Result<Option<PaymentReceiptRecord>, sqlx::Error> {
        let Some(provider_reference) = provider_reference else {
            return Ok(None);
        };
        sqlx::query_as::<_, PaymentReceiptRecord>(
            "SELECT id, payment_method_id, provider_event_id, provider_reference, donor_name, \
             donor_email, amount_minor, currency, proof_url, status, received_at, reviewed_by, \
             reviewed_at, review_note \
             FROM payment_receipts WHERE provider_reference = $1 ORDER BY received_at DESC \
             LIMIT 1",
        )
        .bind(provider_reference)
        .fetch_optional(pool)
        .await
    }

    /* Completa el intento (transición created -> completed) y crea el recibo
     * ya aprobado + el ingreso verificado en el libro, en una sola transacción.
     * Idempotente por provider_event_id: si el evento ya se aplicó, no duplica. */
    pub async fn apply_automatic_payment(
        pool: &PgPool,
        params: &ApplyAutomaticPaymentParams<'_>,
    ) -> Result<Option<Uuid>, sqlx::Error> {
        let ApplyAutomaticPaymentParams {
            payment_method_id,
            provider_event_id,
            provider_reference,
            reference,
            amount_minor,
            currency,
            donor_name,
            donor_email,
        } = params;
        let mut transaction = pool.begin().await?;

        sqlx::query(
            "UPDATE checkout_intents SET status = 'completed', provider_reference = $2, \
             completed_at = NOW() WHERE reference = $1 AND status = 'created'",
        )
        .bind(reference)
        .bind(provider_reference)
        .execute(&mut *transaction)
        .await?;

        let receipt_id: Option<Uuid> = sqlx::query_scalar(
            "INSERT INTO payment_receipts \
             (payment_method_id, provider_event_id, provider_reference, donor_name, donor_email, \
              amount_minor, currency, status) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved') \
             ON CONFLICT (payment_method_id, provider_event_id) \
               WHERE provider_event_id IS NOT NULL DO NOTHING \
             RETURNING id",
        )
        .bind(payment_method_id)
        .bind(provider_event_id)
        .bind(provider_reference)
        .bind(donor_name)
        .bind(donor_email)
        .bind(amount_minor)
        .bind(currency.to_ascii_uppercase())
        .fetch_optional(&mut *transaction)
        .await?;

        if let Some(receipt_id) = receipt_id {
            sqlx::query(
                "INSERT INTO transparency_entries \
                 (entry_type, concept, amount_minor, currency, occurred_on, status, \
                  payment_method_id, payment_receipt_id) \
                 VALUES ('income', 'Donación recibida', $1, $2, NOW()::date, 'verified', $3, $4) \
                 ON CONFLICT DO NOTHING",
            )
            .bind(amount_minor)
            .bind(currency.to_ascii_uppercase())
            .bind(payment_method_id)
            .bind(receipt_id)
            .execute(&mut *transaction)
            .await?;
        }

        transaction.commit().await?;
        Ok(receipt_id)
    }
}
