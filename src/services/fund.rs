use sqlx::PgPool;

use crate::errors::AppError;
use crate::models::{PublicAction, TransparencySummary};
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

    /* Acciones publicadas (gastos con narrativa) para la sección pública.
     * Valida la moneda igual que el resumen y devuelve hasta `limit` acciones. */
    pub async fn public_actions(
        pool: &PgPool,
        currency: &str,
        limit: i64,
    ) -> Result<Vec<PublicAction>, AppError> {
        let normalized_currency = currency.to_ascii_uppercase();
        if !matches!(normalized_currency.as_str(), "USD" | "VES") {
            return Err(AppError::Validation(
                "Moneda no soportada para transparencia pública".into(),
            ));
        }
        let limit = limit.clamp(1, 100);
        Ok(FundRepository::list_published_actions(pool, &normalized_currency, limit).await?)
    }
}
