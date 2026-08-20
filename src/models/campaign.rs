use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Campaign {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub goal_minor: i64,
    pub currency: String,
    pub starts_on: NaiveDate,
    pub ends_on: Option<NaiveDate>,
    pub description: String,
    pub status: String,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CampaignRequest {
    #[validate(length(min = 3, max = 160))]
    pub slug: String,
    #[validate(length(min = 1, max = 160))]
    pub name: String,
    #[validate(range(min = 1))]
    pub goal_minor: i64,
    #[validate(length(equal = 3))]
    pub currency: String,
    pub starts_on: NaiveDate,
    pub ends_on: Option<NaiveDate>,
    #[validate(length(max = 10_000))]
    pub description: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CampaignStatusRequest {
    #[validate(length(min = 1, max = 16))]
    pub status: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PublicCampaign {
    pub slug: String,
    pub name: String,
    pub goal_minor: i64,
    pub currency: String,
    pub starts_on: NaiveDate,
    pub ends_on: Option<NaiveDate>,
    pub description: String,
    pub status: String,
}

impl From<Campaign> for PublicCampaign {
    fn from(campaign: Campaign) -> Self {
        Self {
            slug: campaign.slug,
            name: campaign.name,
            goal_minor: campaign.goal_minor,
            currency: campaign.currency,
            starts_on: campaign.starts_on,
            ends_on: campaign.ends_on,
            description: campaign.description,
            status: campaign.status,
        }
    }
}
