use crate::models::{TransparencyContent, TransparencyContentRequest};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ContentRepository;

const CONTENT_COLUMNS: &str = "id, content_key, locale, title, body, status, \
    metadata->>'cta_label' AS cta_label, metadata->>'cta_url' AS cta_url, \
    updated_by, updated_at";

impl ContentRepository {
    pub async fn get(
        pool: &PgPool,
        content_key: &str,
        published_only: bool,
    ) -> Result<Option<TransparencyContent>, sqlx::Error> {
        let status_clause = if published_only {
            "AND status = 'published'"
        } else {
            ""
        };
        let query = format!(
            "SELECT {CONTENT_COLUMNS} FROM transparency_content \
             WHERE content_key = $1 AND locale = 'es' {status_clause}"
        );
        sqlx::query_as::<_, TransparencyContent>(&query)
            .bind(content_key)
            .fetch_optional(pool)
            .await
    }

    pub async fn upsert_draft(
        pool: &PgPool,
        content_key: &str,
        actor_id: Uuid,
        request: &TransparencyContentRequest,
    ) -> Result<TransparencyContent, sqlx::Error> {
        let metadata = json!({
            "cta_label": request.cta_label,
            "cta_url": request.cta_url,
        });
        let query = format!(
            "INSERT INTO transparency_content \
             (content_key, locale, title, body, metadata, status, updated_by) \
             VALUES ($1, 'es', $2, $3, $4, 'draft', $5) \
             ON CONFLICT (content_key, locale) DO UPDATE SET \
             title = EXCLUDED.title, body = EXCLUDED.body, metadata = EXCLUDED.metadata, \
             status = 'draft', updated_by = EXCLUDED.updated_by, updated_at = NOW() \
             RETURNING {CONTENT_COLUMNS}"
        );
        sqlx::query_as::<_, TransparencyContent>(&query)
            .bind(content_key)
            .bind(&request.title)
            .bind(&request.body)
            .bind(metadata)
            .bind(actor_id)
            .fetch_one(pool)
            .await
    }

    pub async fn set_status(
        pool: &PgPool,
        content_key: &str,
        status: &str,
        actor_id: Uuid,
    ) -> Result<Option<TransparencyContent>, sqlx::Error> {
        let query = format!(
            "UPDATE transparency_content SET status = $2, updated_by = $3, updated_at = NOW() \
             WHERE content_key = $1 AND locale = 'es' RETURNING {CONTENT_COLUMNS}"
        );
        sqlx::query_as::<_, TransparencyContent>(&query)
            .bind(content_key)
            .bind(status)
            .bind(actor_id)
            .fetch_optional(pool)
            .await
    }
}
