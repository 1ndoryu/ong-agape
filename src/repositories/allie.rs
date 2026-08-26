use crate::models::{Ally, AllyRequest};
use sqlx::PgPool;
use uuid::Uuid;

pub struct AllyRepository;

impl AllyRepository {
    /// Aliados visibles al público, en orden de presentación.
    pub async fn list_public(pool: &PgPool) -> Result<Vec<Ally>, sqlx::Error> {
        sqlx::query_as::<_, Ally>(
            "SELECT id, nombre, logo_url, display_order, active, created_by, updated_by, \
             created_at, updated_at FROM allies WHERE active = TRUE \
             ORDER BY display_order ASC, nombre ASC",
        )
        .fetch_all(pool)
        .await
    }

    /// Todos los aliados para el panel (incluye inactivos para poder reactivar).
    pub async fn list_admin(pool: &PgPool) -> Result<Vec<Ally>, sqlx::Error> {
        sqlx::query_as::<_, Ally>(
            "SELECT id, nombre, logo_url, display_order, active, created_by, updated_by, \
             created_at, updated_at FROM allies ORDER BY active DESC, display_order ASC, nombre ASC",
        )
        .fetch_all(pool)
        .await
    }

    pub async fn get(pool: &PgPool, id: Uuid) -> Result<Option<Ally>, sqlx::Error> {
        sqlx::query_as::<_, Ally>(
            "SELECT id, nombre, logo_url, display_order, active, created_by, updated_by, \
             created_at, updated_at FROM allies WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn create(
        pool: &PgPool,
        actor_id: Uuid,
        request: &AllyRequest,
    ) -> Result<Ally, sqlx::Error> {
        sqlx::query_as::<_, Ally>(
            "INSERT INTO allies (nombre, logo_url, display_order, active, created_by, updated_by) \
             VALUES ($1, $2, $3, $4, $5, $5) \
             RETURNING id, nombre, logo_url, display_order, active, created_by, updated_by, \
             created_at, updated_at",
        )
        .bind(&request.nombre)
        .bind(&request.logo_url)
        .bind(request.display_order.unwrap_or(0))
        .bind(request.active.unwrap_or(true))
        .bind(actor_id)
        .fetch_one(pool)
        .await
    }

    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        actor_id: Uuid,
        request: &AllyRequest,
    ) -> Result<Option<Ally>, sqlx::Error> {
        sqlx::query_as::<_, Ally>(
            "UPDATE allies SET nombre = $2, logo_url = $3, display_order = $4, active = $5, \
             updated_by = $6, updated_at = NOW() WHERE id = $1 \
             RETURNING id, nombre, logo_url, display_order, active, created_by, updated_by, \
             created_at, updated_at",
        )
        .bind(id)
        .bind(&request.nombre)
        .bind(&request.logo_url)
        .bind(request.display_order.unwrap_or(0))
        .bind(request.active.unwrap_or(true))
        .bind(actor_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<Option<Ally>, sqlx::Error> {
        sqlx::query_as::<_, Ally>(
            "DELETE FROM allies WHERE id = $1 \
             RETURNING id, nombre, logo_url, display_order, active, created_by, updated_by, \
             created_at, updated_at",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }
}
