use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Variable de entorno requerida no encontrada: {0}")]
    MissingEnvVar(String),
    #[error("Puerto inválido: {0}")]
    InvalidPort(#[from] std::num::ParseIntError),
    #[error("JWT_SECRET debe tener al menos 32 caracteres")]
    WeakJwtSecret,
}

/// Configuración de la aplicación cargada desde variables de entorno
#[derive(Debug, Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub host: String,
    pub port: u16,
    pub admin_emails: Vec<String>,
    pub cors_origins: Vec<String>,
}

impl AppConfig {
    /// Carga la configuración desde variables de entorno.
    /// Requiere `DATABASE_URL` y `JWT_SECRET`. `HOST` y `PORT` son opcionales.
    pub fn from_env() -> Result<Self, ConfigError> {
        let jwt_secret = std::env::var("JWT_SECRET")
            .map_err(|_| ConfigError::MissingEnvVar("JWT_SECRET".into()))?;
        if jwt_secret.chars().count() < 32 {
            return Err(ConfigError::WeakJwtSecret);
        }

        let admin_emails = std::env::var("ADMIN_EMAILS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|email| !email.is_empty())
            .map(str::to_ascii_lowercase)
            .collect();

        let cors_origins = std::env::var("CORS_ALLOWED_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|origin| !origin.is_empty())
            .map(str::to_string)
            .collect();

        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .map_err(|_| ConfigError::MissingEnvVar("DATABASE_URL".into()))?,
            jwt_secret,
            host: std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()?,
            admin_emails,
            cors_origins,
        })
    }
}
