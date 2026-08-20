use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct BlogPost {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub excerpt: String,
    pub body: String,
    pub cover_image_url: Option<String>,
    pub status: String,
    pub published_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PublicBlogPost {
    pub slug: String,
    pub title: String,
    pub excerpt: String,
    pub body: String,
    pub cover_image_url: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
}

impl From<BlogPost> for PublicBlogPost {
    fn from(post: BlogPost) -> Self {
        Self {
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            body: post.body,
            cover_image_url: post.cover_image_url,
            published_at: post.published_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct BlogPostRequest {
    #[validate(length(min = 3, max = 160))]
    pub slug: String,
    #[validate(length(min = 1, max = 255))]
    pub title: String,
    #[validate(length(max = 500))]
    pub excerpt: String,
    #[validate(length(max = 50_000))]
    pub body: String,
    #[validate(url)]
    pub cover_image_url: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct BlogPostStatusRequest {
    #[validate(length(min = 1, max = 16))]
    pub status: String,
}
