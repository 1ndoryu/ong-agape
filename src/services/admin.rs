use crate::domain::permissions::{AdminActor, AdminPermission, AdminRole};
use crate::errors::AppError;
use crate::repositories::UserRepository;
use sqlx::PgPool;
use uuid::Uuid;

pub struct AdminService;

impl AdminService {
    pub async fn authorize(
        pool: &PgPool,
        user_id: Uuid,
        permission: AdminPermission,
    ) -> Result<AdminActor, AppError> {
        let user = UserRepository::find_by_id(pool, user_id)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if user.status != "active" {
            return Err(AppError::Unauthorized);
        }

        let role = AdminRole::parse(&user.role).ok_or(AppError::Unauthorized)?;
        if !permission.is_allowed(role) {
            return Err(AppError::Forbidden);
        }

        Ok(AdminActor {
            id: user.id,
            email: user.email,
            role,
        })
    }
}
