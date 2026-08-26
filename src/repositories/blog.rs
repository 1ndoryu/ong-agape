use crate::models::{BlogPost, BlogPostRequest};
use sqlx::PgPool;
use uuid::Uuid;

pub struct BlogRepository;

impl BlogRepository {
    pub async fn list_public(pool: &PgPool) -> Result<Vec<BlogPost>, sqlx::Error> {
        sqlx::query_as::<_, BlogPost>(
            "SELECT id, slug, title, excerpt, body, cover_image_url, status, published_at, \
             created_by, updated_by, created_at, updated_at FROM blog_posts \
             WHERE status = 'published' ORDER BY published_at DESC LIMIT 50",
        )
        .fetch_all(pool)
        .await
    }

    pub async fn get_public(pool: &PgPool, slug: &str) -> Result<Option<BlogPost>, sqlx::Error> {
        sqlx::query_as::<_, BlogPost>(
            "SELECT id, slug, title, excerpt, body, cover_image_url, status, published_at, \
             created_by, updated_by, created_at, updated_at FROM blog_posts \
             WHERE slug = $1 AND status = 'published'",
        )
        .bind(slug)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_admin(
        pool: &PgPool,
        status: Option<&str>,
    ) -> Result<Vec<BlogPost>, sqlx::Error> {
        sqlx::query_as::<_, BlogPost>(
            "SELECT id, slug, title, excerpt, body, cover_image_url, status, published_at, \
             created_by, updated_by, created_at, updated_at FROM blog_posts \
             WHERE ($1::TEXT IS NULL OR status = $1) ORDER BY updated_at DESC LIMIT 200",
        )
        .bind(status)
        .fetch_all(pool)
        .await
    }

    pub async fn create_draft(
        pool: &PgPool,
        actor_id: Uuid,
        request: &BlogPostRequest,
    ) -> Result<BlogPost, sqlx::Error> {
        sqlx::query_as::<_, BlogPost>(
            "INSERT INTO blog_posts (slug, title, excerpt, body, cover_image_url, created_by, updated_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $6) \
             RETURNING id, slug, title, excerpt, body, cover_image_url, status, published_at, \
             created_by, updated_by, created_at, updated_at",
        )
        .bind(&request.slug)
        .bind(&request.title)
        .bind(&request.excerpt)
        .bind(&request.body)
        .bind(&request.cover_image_url)
        .bind(actor_id)
        .fetch_one(pool)
        .await
    }

    pub async fn update_draft(
        pool: &PgPool,
        id: Uuid,
        actor_id: Uuid,
        request: &BlogPostRequest,
    ) -> Result<Option<BlogPost>, sqlx::Error> {
        sqlx::query_as::<_, BlogPost>(
            "UPDATE blog_posts SET slug = $2, title = $3, excerpt = $4, body = $5, \
             cover_image_url = $6, status = 'draft', updated_by = $7, updated_at = NOW() \
             WHERE id = $1 RETURNING id, slug, title, excerpt, body, cover_image_url, status, published_at, \
             created_by, updated_by, created_at, updated_at",
        )
        .bind(id)
        .bind(&request.slug)
        .bind(&request.title)
        .bind(&request.excerpt)
        .bind(&request.body)
        .bind(&request.cover_image_url)
        .bind(actor_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn set_status(
        pool: &PgPool,
        id: Uuid,
        actor_id: Uuid,
        status: &str,
    ) -> Result<Option<BlogPost>, sqlx::Error> {
        sqlx::query_as::<_, BlogPost>(
            "UPDATE blog_posts SET status = $2, published_at = CASE WHEN $2 = 'published' \
             THEN COALESCE(published_at, NOW()) ELSE published_at END, updated_by = $3, updated_at = NOW() \
             WHERE id = $1 RETURNING id, slug, title, excerpt, body, cover_image_url, status, published_at, \
             created_by, updated_by, created_at, updated_at",
        )
        .bind(id)
        .bind(status)
        .bind(actor_id)
        .fetch_optional(pool)
        .await
    }

    /* Elimina un artículo del blog. No hay FK que apunten a blog_posts, así
     * que el borrado es directo; la portada en disco se conserva. Devuelve la
     * fila borrada para auditar el título. */
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<Option<BlogPost>, sqlx::Error> {
        sqlx::query_as::<_, BlogPost>(
            "DELETE FROM blog_posts WHERE id = $1 \
             RETURNING id, slug, title, excerpt, body, cover_image_url, status, published_at, \
             created_by, updated_by, created_at, updated_at",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }
}
