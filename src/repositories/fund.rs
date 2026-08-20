use sqlx::PgPool;

use crate::models::{AdminFundEntry, CreateFundEntryRequest, PublicFundEntry};
use uuid::Uuid;

pub struct FundRepository;

impl FundRepository {
    pub async fn list_admin(
        pool: &PgPool,
        status: Option<&str>,
    ) -> Result<Vec<AdminFundEntry>, sqlx::Error> {
        sqlx::query_as::<_, AdminFundEntry>(
            "SELECT id, entry_type, concept, campaign, amount_minor, currency, occurred_on, \
             status, evidence_url, payment_method_id, payment_receipt_id, review_note, \
             created_by, verified_by, created_at, updated_at \
             FROM transparency_entries \
             WHERE ($1::TEXT IS NULL OR status = $1) \
             ORDER BY occurred_on DESC, created_at DESC \
             LIMIT 200",
        )
        .bind(status)
        .fetch_all(pool)
        .await
    }

    pub async fn create_pending(
        pool: &PgPool,
        actor_id: Uuid,
        request: &CreateFundEntryRequest,
    ) -> Result<AdminFundEntry, sqlx::Error> {
        sqlx::query_as::<_, AdminFundEntry>(
            "INSERT INTO transparency_entries \
             (entry_type, concept, campaign, amount_minor, currency, occurred_on, status, evidence_url, created_by) \
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8) \
             RETURNING id, entry_type, concept, campaign, amount_minor, currency, occurred_on, \
             status, evidence_url, payment_method_id, payment_receipt_id, review_note, \
             created_by, verified_by, created_at, updated_at",
        )
        .bind(&request.entry_type)
        .bind(&request.concept)
        .bind(&request.campaign)
        .bind(request.amount_minor)
        .bind(request.currency.to_ascii_uppercase())
        .bind(request.occurred_on)
        .bind(&request.evidence_url)
        .bind(actor_id)
        .fetch_one(pool)
        .await
    }

    pub async fn update_status(
        pool: &PgPool,
        id: Uuid,
        status: &str,
        review_note: Option<&str>,
        reviewer_id: Uuid,
    ) -> Result<Option<AdminFundEntry>, sqlx::Error> {
        sqlx::query_as::<_, AdminFundEntry>(
            "UPDATE transparency_entries \
             SET status = $2, review_note = $3, verified_by = $4, updated_at = NOW() \
             WHERE id = $1 \
             RETURNING id, entry_type, concept, campaign, amount_minor, currency, occurred_on, \
             status, evidence_url, payment_method_id, payment_receipt_id, review_note, \
             created_by, verified_by, created_at, updated_at",
        )
        .bind(id)
        .bind(status)
        .bind(review_note)
        .bind(reviewer_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_published(
        pool: &PgPool,
        currency: &str,
        limit: i64,
    ) -> Result<Vec<PublicFundEntry>, sqlx::Error> {
        sqlx::query_as::<_, PublicFundEntry>(
            "SELECT id, entry_type, concept, campaign, amount_minor, currency, occurred_on \
             FROM transparency_entries \
             WHERE status = 'published' AND currency = $1 \
             ORDER BY occurred_on DESC, created_at DESC \
             LIMIT $2",
        )
        .bind(currency)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn totals(pool: &PgPool, currency: &str) -> Result<(i64, i64), sqlx::Error> {
        sqlx::query_as::<_, (i64, i64)>(
            "SELECT \
                COALESCE(SUM(amount_minor) FILTER (WHERE entry_type = 'income'), 0)::BIGINT, \
                COALESCE(SUM(amount_minor) FILTER (WHERE entry_type = 'expense'), 0)::BIGINT \
             FROM transparency_entries \
             WHERE status = 'published' AND currency = $1",
        )
        .bind(currency)
        .fetch_one(pool)
        .await
    }
}
