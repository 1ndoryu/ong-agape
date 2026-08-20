use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::{AuthResponse, LoginRequest, RegisterRequest};
use crate::repositories::UserRepository;

/// Claims del JWT — `sub` es el `user_id`, `exp` la expiración Unix
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: usize,
}

pub struct AuthService;

impl AuthService {
    /// Registra un nuevo usuario: valida unicidad, hashea contraseña, genera JWT
    pub async fn register(
        pool: &PgPool,
        mut req: RegisterRequest,
        jwt_secret: &str,
        admin_emails: &[String],
    ) -> Result<AuthResponse, AppError> {
        req.email = req.email.trim().to_ascii_lowercase();
        if UserRepository::find_by_email(pool, &req.email)
            .await?
            .is_some()
        {
            return Err(AppError::Conflict("Email ya registrado".into()));
        }

        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(req.password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(format!("Error al hashear contraseña: {e}")))?
            .to_string();

        let mut user = UserRepository::create(pool, &req.email, &password_hash).await?;
        if admin_emails
            .iter()
            .any(|email| email == &req.email.to_ascii_lowercase())
        {
            UserRepository::set_role(pool, user.id, "owner").await?;
            user.role = "owner".to_string();
        }
        let token = Self::generate_token(user.id, jwt_secret)?;

        Ok(AuthResponse {
            token,
            user_id: user.id,
        })
    }

    /// Inicia sesión: verifica credenciales y genera JWT
    pub async fn login(
        pool: &PgPool,
        mut req: LoginRequest,
        jwt_secret: &str,
    ) -> Result<AuthResponse, AppError> {
        req.email = req.email.trim().to_ascii_lowercase();
        let user = UserRepository::find_by_email(pool, &req.email)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if user.status != "active" {
            return Err(AppError::Unauthorized);
        }

        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|e| AppError::Internal(format!("Hash almacenado inválido: {e}")))?;

        Argon2::default()
            .verify_password(req.password.as_bytes(), &parsed_hash)
            .map_err(|_| AppError::Unauthorized)?;

        let token = Self::generate_token(user.id, jwt_secret)?;

        Ok(AuthResponse {
            token,
            user_id: user.id,
        })
    }

    /// Genera un JWT con expiración de 24 horas
    pub fn generate_token(user_id: Uuid, secret: &str) -> Result<String, AppError> {
        let timestamp = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::hours(24))
            .ok_or_else(|| AppError::Internal("Error calculando expiración del token".into()))?
            .timestamp();
        let exp = usize::try_from(timestamp)
            .map_err(|_| AppError::Internal("Timestamp fuera de rango".into()))?;

        let claims = Claims { sub: user_id, exp };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .map_err(|e| AppError::Internal(format!("Error generando token: {e}")))
    }

    /// Verifica un JWT y retorna los claims
    pub fn verify_token(token: &str, secret: &str) -> Result<Claims, AppError> {
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|_| AppError::Unauthorized)
    }
}
