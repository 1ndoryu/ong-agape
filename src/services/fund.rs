use sqlx::PgPool;

use crate::errors::AppError;
use crate::models::TransparencySummary;
use crate::repositories::FundRepository;

pub struct FundService;

impl FundService {
    pub async fn public_summary(
        pool: &PgPool,
        currency: &str,
    ) -> Result<TransparencySummary, AppError> {
        let normalized_currency = currency.to_ascii_uppercase();
        if !matches!(normalized_currency.as_str(), "USD" | "VES") {
            return Err(AppError::Validation(
                "Moneda no soportada para transparencia pública".into(),
            ));
        }

        let (total_received_minor, total_used_minor) =
            FundRepository::totals(pool, &normalized_currency).await?;
        let entries = FundRepository::list_published(pool, &normalized_currency, 100).await?;

        Ok(TransparencySummary {
            currency: normalized_currency,
            total_received_minor,
            total_used_minor,
            entries,
        })
    }
}
