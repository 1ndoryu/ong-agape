use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use utoipa::IntoParams;
use uuid::Uuid;
use validator::Validate;

use crate::domain::permissions::{AdminPermission, AdminRole};
use crate::errors::AppError;
use crate::middleware::AuthUser;
use crate::models::{BlogPost, BlogPostRequest, BlogPostStatusRequest, PublicBlogPost};
use crate::repositories::{AuditRepository, BlogRepository};
use crate::services::AdminService;
use crate::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct BlogFilter {
    pub status: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/blog",
    responses((status = 200, description = "Artículos publicados", body = [PublicBlogPost]))
)]
pub async fn list_public(
    State(state): State<AppState>,
) -> Result<Json<Vec<PublicBlogPost>>, AppError> {
    Ok(Json(
        BlogRepository::list_public(&state.pool)
            .await?
            .into_iter()
            .map(PublicBlogPost::from)
            .collect(),
    ))
}

#[utoipa::path(
    get,
    path = "/api/blog/{slug}",
    params(("slug" = String, Path, description = "Slug del artículo")),
    responses((status = 200, body = PublicBlogPost), (status = 404, body = crate::errors::ErrorResponse))
)]
pub async fn get_public(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<PublicBlogPost>, AppError> {
    let post = BlogRepository::get_public(&state.pool, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("Artículo no encontrado".into()))?;
    Ok(Json(PublicBlogPost::from(post)))
}

#[utoipa::path(
    get,
    path = "/api/admin/blog/posts",
    params(BlogFilter),
    responses((status = 200, body = [BlogPost]), (status = 401, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn list_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filter): Query<BlogFilter>,
) -> Result<Json<Vec<BlogPost>>, AppError> {
    AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    Ok(Json(
        BlogRepository::list_admin(&state.pool, filter.status.as_deref()).await?,
    ))
}

#[utoipa::path(
    post,
    path = "/api/admin/blog/posts",
    request_body = BlogPostRequest,
    responses((status = 201, body = BlogPost), (status = 422, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn create_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<BlogPostRequest>,
) -> Result<(StatusCode, Json<BlogPost>), AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    validate_slug(&request.slug)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let post = BlogRepository::create_draft(&state.pool, actor.id, &request).await?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "blog_post.created",
        "blog_post",
        Some(post.id),
        json!({ "status": "draft", "slug": post.slug }),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(post)))
}

#[utoipa::path(
    put,
    path = "/api/admin/blog/posts/{id}",
    params(("id" = Uuid, Path, description = "Artículo")),
    request_body = BlogPostRequest,
    responses((status = 200, body = BlogPost), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn update_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<BlogPostRequest>,
) -> Result<Json<BlogPost>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    validate_slug(&request.slug)?;
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let post = BlogRepository::update_draft(&state.pool, id, actor.id, &request)
        .await?
        .ok_or_else(|| AppError::NotFound("Artículo no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "blog_post.draft_saved",
        "blog_post",
        Some(id),
        json!({ "status": "draft", "slug": post.slug }),
    )
    .await?;
    Ok(Json(post))
}

#[utoipa::path(
    put,
    path = "/api/admin/blog/posts/{id}/status",
    params(("id" = Uuid, Path, description = "Artículo")),
    request_body = BlogPostStatusRequest,
    responses((status = 200, body = BlogPost), (status = 403, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn update_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<BlogPostStatusRequest>,
) -> Result<Json<BlogPost>, AppError> {
    request
        .validate()
        .map_err(|error| AppError::Validation(error.to_string()))?;
    if !matches!(request.status.as_str(), "draft" | "published" | "archived") {
        return Err(AppError::Validation("Estado de artículo inválido".into()));
    }
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ReviewLedger).await?;
    if request.status == "published" && actor.role != AdminRole::Owner {
        return Err(AppError::Forbidden);
    }
    let post = BlogRepository::set_status(&state.pool, id, actor.id, &request.status)
        .await?
        .ok_or_else(|| AppError::NotFound("Artículo no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "blog_post.status_changed",
        "blog_post",
        Some(id),
        json!({ "status": post.status }),
    )
    .await?;
    Ok(Json(post))
}

/* Elimina un artículo del blog (borrador, publicado o archivado). Requiere
 * ManageContent y devuelve 204 sin cuerpo; la auditoría conserva el título. */
#[utoipa::path(
    delete,
    path = "/api/admin/blog/posts/{id}",
    params(("id" = Uuid, Path, description = "Artículo")),
    responses((status = 204, description = "Artículo eliminado"), (status = 401, body = crate::errors::ErrorResponse), (status = 403, body = crate::errors::ErrorResponse), (status = 404, body = crate::errors::ErrorResponse)),
    security(("bearer_auth" = []))
)]
pub async fn delete_admin(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let actor =
        AdminService::authorize(&state.pool, auth.user_id, AdminPermission::ManageContent).await?;
    let post = BlogRepository::delete(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Artículo no encontrado".into()))?;
    AuditRepository::record(
        &state.pool,
        actor.id,
        "blog_post.deleted",
        "blog_post",
        Some(id),
        json!({ "title": post.title, "slug": post.slug }),
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/blog", get(list_public))
        .route("/blog/:slug", get(get_public))
        .route("/admin/blog/posts", get(list_admin).post(create_admin))
        .route("/admin/blog/posts/:id", put(update_admin).delete(delete_admin))
        .route("/admin/blog/posts/:id/status", put(update_status))
}

fn validate_slug(slug: &str) -> Result<(), AppError> {
    if slug.is_empty()
        || slug.len() > 160
        || !slug.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
    {
        return Err(AppError::Validation(
            "El slug debe usar minúsculas, números y guiones".into(),
        ));
    }
    Ok(())
}
