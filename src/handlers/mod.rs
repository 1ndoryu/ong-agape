#![allow(clippy::needless_for_each)] // Generado por utoipa OpenApi derive

mod admin;
mod allie;
mod auth;
mod blog;
mod campaign;
mod contact;
mod health;
mod notes;
mod payments;
mod transparency;

use axum::http::HeaderValue;
use axum::Router;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::AppState;

/// Define el esquema de seguridad Bearer para Swagger UI
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        /* components existe porque el derive ya registra schemas */
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                utoipa::openapi::security::SecurityScheme::Http(
                    utoipa::openapi::security::Http::new(
                        utoipa::openapi::security::HttpAuthScheme::Bearer,
                    ),
                ),
            );
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        health::health_check,
        auth::register,
        auth::login,
        admin::me,
        admin::list_entries,
        admin::create_entry,
        admin::update_entry_status,
        admin::delete_entry,
        admin::get_content,
        admin::upsert_content,
        admin::publish_content,
        admin::upload_content_image,
        admin::list_payment_methods,
        admin::update_payment_method,
        admin::list_payment_receipts,
        admin::create_manual_receipt,
        admin::review_payment_receipt,
        admin::list_audit_events,
        blog::list_public,
        blog::get_public,
        blog::list_admin,
        blog::create_admin,
        blog::update_admin,
        blog::delete_admin,
        blog::update_status,
        allie::list_public,
        allie::list_admin,
        allie::create_admin,
        allie::update_admin,
        allie::delete_admin,
        campaign::list_public,
        campaign::list_admin,
        campaign::create_admin,
        campaign::update_admin,
        campaign::delete_admin,
        campaign::update_status,
        contact::send_message,
        contact::list_messages,
        contact::delete_message,
        notes::create_note,
        notes::get_note,
        notes::list_notes,
        notes::update_note,
        notes::delete_note,
        transparency::get_summary,
        transparency::get_actions,
        transparency::get_content,
        transparency::list_public_payment_methods,
        transparency::list_live_donations,
        transparency::create_donation,
        payments::create_checkout,
        payments::receive_webhook,
        payments::simulate_payment,
        payments::checkout_status,
    ),
    components(schemas(
        health::HealthResponse,
        crate::models::RegisterRequest,
        crate::models::LoginRequest,
        crate::models::AuthResponse,
        crate::models::Note,
        crate::models::CreateNoteRequest,
        crate::models::UpdateNoteRequest,
        crate::models::PaginatedNotes,
        crate::models::PublicFundEntry,
        crate::models::PublicAction,
        crate::models::TransparencySummary,
        crate::models::AdminProfile,
        crate::models::AdminFundEntry,
        crate::models::TransparencyContent,
        crate::models::PublicTransparencyContent,
        crate::models::PaymentMethodRecord,
        crate::models::PublicPaymentMethod,
        crate::models::PaymentReceiptRecord,
        crate::models::AuditEventRecord,
        crate::models::CreateFundEntryRequest,
        crate::models::UpdateFundEntryRequest,
        crate::models::UpdateFundEntryStatusRequest,
        crate::models::TransparencyContentRequest,
        crate::models::UploadImageResponse,
        crate::models::UpdatePaymentMethodRequest,
        crate::models::CreateManualReceiptRequest,
        crate::models::ReviewReceiptRequest,
        crate::models::BlogPost,
        crate::models::PublicBlogPost,
        crate::models::BlogPostRequest,
        crate::models::BlogPostStatusRequest,
        crate::models::Campaign,
        crate::models::CampaignRequest,
        crate::models::CampaignStatusRequest,
        crate::models::PublicCampaign,
        crate::models::ContactMessage,
        crate::models::ContactMessageRequest,
        crate::models::Ally,
        crate::models::AllyRequest,
        crate::models::PublicAlly,
        crate::models::LiveDonation,
        crate::models::PublicDonationReceipt,
        crate::models::CreateCheckoutRequest,
        crate::models::CheckoutResponse,
        crate::models::CheckoutStatus,
        crate::errors::ErrorResponse,
    )),
    modifiers(&SecurityAddon),
    info(
        title = "Glory RS API",
        version = "0.1.0",
        description = "Template API — Rust + Axum + OpenAPI"
    )
)]
#[allow(clippy::needless_for_each)]
pub struct ApiDoc;

/// Crea el router principal con CORS, tracing, Swagger UI y todas las rutas.
/// Devuelve error solo si no se puede preparar el directorio de subidas.
pub fn create_router(
    pool: sqlx::PgPool,
    config: crate::config::AppConfig,
) -> Result<Router, std::io::Error> {
    let cors_origins = if config.cors_origins.is_empty() {
        vec![
            HeaderValue::from_static("http://localhost:5173"),
            HeaderValue::from_static("http://localhost:5174"),
            HeaderValue::from_static("http://localhost:5175"),
            HeaderValue::from_static("http://127.0.0.1:5173"),
            HeaderValue::from_static("http://127.0.0.1:5174"),
            HeaderValue::from_static("http://127.0.0.1:5175"),
        ]
    } else {
        config
            .cors_origins
            .iter()
            .filter_map(|origin| origin.parse::<HeaderValue>().ok())
            .collect()
    };

    /* El directorio de comprobantes se crea al arrancar para que la subida y
     * el servicio estático no dependan de un paso manual. */
    std::fs::create_dir_all(&config.upload_dir).map_err(|error| {
        tracing::error!("No se pudo crear el directorio de subidas: {error}");
        std::io::Error::other(format!("No se pudo crear el directorio de subidas: {error}"))
    })?;

    let state = AppState {
        pool,
        jwt_secret: config.jwt_secret,
        admin_emails: config.admin_emails,
        upload_dir: config.upload_dir.clone(),
    };

    /* CORS: lista explícita; no se acepta cualquier origen. */
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(cors_origins))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
        ]);

    Ok(Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .nest("/api", api_routes())
        /* Los comprobantes subidos desde la página de donar se sirven como
         * archivos estáticos bajo /uploads (ruta relativa a la raíz del repo).
         * La capa de CORS solo se aplica a la API, no a estos archivos. */
        .nest_service("/uploads", ServeDir::new(state.upload_dir.clone()))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state))
}

fn api_routes() -> Router<AppState> {
    Router::new()
        .merge(health::routes())
        .merge(auth::routes())
        .merge(admin::routes())
        .merge(allie::routes())
        .merge(blog::routes())
        .merge(campaign::routes())
        .merge(contact::routes())
        .merge(notes::routes())
        .merge(transparency::routes())
        .merge(payments::routes())
}
