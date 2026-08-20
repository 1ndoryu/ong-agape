use crate::models::AuditEventRecord;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

pub struct AuditRepository;

impl AuditRepository {
    pub async fn record(
        pool: &PgPool,
        actor_id: Uuid,
        action: &str,
        entity_type: &str,
        entity_id: Option<Uuid>,
        metadata: Value,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO audit_events (actor_id, action, entity_type, entity_id, metadata) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(actor_id)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(metadata)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn list(pool: &PgPool) -> Result<Vec<AuditEventRecord>, sqlx::Error> {
        sqlx::query_as::<_, AuditEventRecord>(
            "SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at \
             FROM audit_events ORDER BY created_at DESC LIMIT 200",
        )
        .fetch_all(pool)
        .await
    }
}
