use crate::models::{Campaign, CampaignRequest};
use sqlx::PgPool;
use uuid::Uuid;

pub struct CampaignRepository;

const COLUMNS: &str =
    "id, slug, name, goal_minor, currency, starts_on, ends_on, description, status, \
    created_by, updated_by, created_at, updated_at";

impl CampaignRepository {
    pub async fn list_public(pool: &PgPool) -> Result<Vec<Campaign>, sqlx::Error> {
        let query = format!("SELECT {COLUMNS} FROM campaigns WHERE status IN ('active', 'completed') ORDER BY starts_on DESC, name");
        sqlx::query_as::<_, Campaign>(&query).fetch_all(pool).await
    }

    pub async fn list_admin(
        pool: &PgPool,
        status: Option<&str>,
    ) -> Result<Vec<Campaign>, sqlx::Error> {
        let query = format!("SELECT {COLUMNS} FROM campaigns WHERE ($1::TEXT IS NULL OR status = $1) ORDER BY starts_on DESC, created_at DESC");
        sqlx::query_as::<_, Campaign>(&query)
            .bind(status)
            .fetch_all(pool)
            .await
    }

    pub async fn create(
        pool: &PgPool,
        actor_id: Uuid,
        request: &CampaignRequest,
    ) -> Result<Campaign, sqlx::Error> {
        let query = format!("INSERT INTO campaigns (slug, name, goal_minor, currency, starts_on, ends_on, description, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING {COLUMNS}");
        sqlx::query_as::<_, Campaign>(&query)
            .bind(&request.slug)
            .bind(&request.name)
            .bind(request.goal_minor)
            .bind(request.currency.to_ascii_uppercase())
            .bind(request.starts_on)
            .bind(request.ends_on)
            .bind(&request.description)
            .bind(actor_id)
            .fetch_one(pool)
            .await
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        actor_id: Uuid,
        request: &CampaignRequest,
    ) -> Result<Option<Campaign>, sqlx::Error> {
        let query = format!("UPDATE campaigns SET slug = $2, name = $3, goal_minor = $4, currency = $5, starts_on = $6, ends_on = $7, description = $8, updated_by = $9, updated_at = NOW() WHERE id = $1 RETURNING {COLUMNS}");
        sqlx::query_as::<_, Campaign>(&query)
            .bind(id)
            .bind(&request.slug)
            .bind(&request.name)
            .bind(request.goal_minor)
            .bind(request.currency.to_ascii_uppercase())
            .bind(request.starts_on)
            .bind(request.ends_on)
            .bind(&request.description)
            .bind(actor_id)
            .fetch_optional(pool)
            .await
    }

    pub async fn set_status(
        pool: &PgPool,
        id: Uuid,
        actor_id: Uuid,
        status: &str,
    ) -> Result<Option<Campaign>, sqlx::Error> {
        let query = format!("UPDATE campaigns SET status = $2, updated_by = $3, updated_at = NOW() WHERE id = $1 RETURNING {COLUMNS}");
        sqlx::query_as::<_, Campaign>(&query)
            .bind(id)
            .bind(status)
            .bind(actor_id)
            .fetch_optional(pool)
            .await
    }

    /* Elimina una campaña. Ninguna tabla tiene FK apuntando a campaigns, así
     * que el borrado no rompe referencias. Devuelve la fila borrada para
     * auditar el nombre. */
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<Option<Campaign>, sqlx::Error> {
        let query = format!("DELETE FROM campaigns WHERE id = $1 RETURNING {COLUMNS}");
        sqlx::query_as::<_, Campaign>(&query)
            .bind(id)
            .fetch_optional(pool)
            .await
    }
}
