use axum::extract::multipart::Field;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use std::path::PathBuf;
use utoipa::IntoParams;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::{
    LiveDonation, NewPublicReceipt, PublicAction, PublicDonationReceipt, PublicPaymentMethod,
    PublicTransparencyContent, TransparencySummary,
};
use crate::repositories::{ContentRepository, PaymentRepository};
use crate::services::FundService;
use crate::AppState;

/* Tipos de archivo aceptados como comprobante de pago. */
const COMPROBANTE_MIMES: [&str; 4] = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
/* Límite de tamaño del comprobante: 5 MB. */
const COMPROBANTE_MAX_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Deserialize, IntoParams)]
pub struct TransparencyQuery {
    /// Moneda del resumen. Solo USD y VES se exponen en esta primera versión.
    #[serde(default = "default_currency")]
    pub currency: String,
}

/* Consulta del listado público de acciones. `limit` acota cuántas devolver
 * (la página /acciones pide más que la sección de /donar); el servicio lo
 * acota entre 1 y 100. */
#[derive(Debug, Deserialize, IntoParams)]
pub struct ActionsQuery {
    #[serde(default = "default_currency")]
    pub currency: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    100
}

fn default_currency() -> String {
    "USD".to_string()
}

/// Devuelve exclusivamente movimientos verificados y publicados.
#[utoipa::path(
    get,
    path = "/api/transparency/summary",
    params(TransparencyQuery),
    responses(
        (status = 200, description = "Resumen público de transparencia", body = TransparencySummary),
        (status = 422, description = "Moneda no soportada", body = crate::errors::ErrorResponse)
    )
)]
pub async fn get_summary(
    State(state): State<AppState>,
    Query(query): Query<TransparencyQuery>,
) -> Result<Json<TransparencySummary>, AppError> {
    Ok(Json(
        FundService::public_summary(&state.pool, &query.currency).await?,
    ))
}

/// Acciones publicadas: gastos verificados con narrativa e imágenes.
#[utoipa::path(
    get,
    path = "/api/transparency/actions",
    params(ActionsQuery),
    responses(
        (status = 200, description = "Acciones publicadas de transparencia", body = [PublicAction]),
        (status = 422, description = "Moneda no soportada", body = crate::errors::ErrorResponse)
    )
)]
pub async fn get_actions(
    State(state): State<AppState>,
    Query(query): Query<ActionsQuery>,
) -> Result<Json<Vec<PublicAction>>, AppError> {
    Ok(Json(
        FundService::public_actions(&state.pool, &query.currency, query.limit).await?,
    ))
}

#[utoipa::path(
    get,
    path = "/api/transparency/content/{key}",
    params(("key" = String, Path, description = "Clave pública de contenido")),
    responses(
        (status = 200, description = "Contenido publicado", body = TransparencyContent),
        (status = 404, description = "Contenido no encontrado", body = crate::errors::ErrorResponse)
    )
)]
pub async fn get_content(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> Result<Json<PublicTransparencyContent>, AppError> {
    let content = ContentRepository::get(&state.pool, &key, true)
        .await?
        .ok_or_else(|| AppError::NotFound("Contenido no encontrado".into()))?;
    Ok(Json(PublicTransparencyContent::from(content)))
}

#[utoipa::path(
    get,
    path = "/api/payment-methods",
    responses((status = 200, description = "Métodos públicos habilitados", body = [PublicPaymentMethod]))
)]
pub async fn list_public_payment_methods(
    State(state): State<AppState>,
) -> Result<Json<Vec<PublicPaymentMethod>>, AppError> {
    /* Devuelve todos los métodos con su estado: el frontend decide cuáles son
     * operativos (enabled) y cuáles se muestran como simulación. */
    Ok(Json(
        PaymentRepository::list_public_methods(&state.pool)
            .await?
            .into_iter()
            .map(PublicPaymentMethod::from)
            .collect(),
    ))
}

/// Donaciones aprobadas recientes para el feed "en vivo" de la página de donar.
#[utoipa::path(
    get,
    path = "/api/donations/live",
    responses(
        (status = 200, description = "Donaciones aprobadas recientes", body = [LiveDonation])
    )
)]
pub async fn list_live_donations(
    State(state): State<AppState>,
) -> Result<Json<Vec<LiveDonation>>, AppError> {
    Ok(Json(
        PaymentRepository::list_live_donations(&state.pool).await?,
    ))
}

/* Lee el texto de un campo de texto del formulario multipart. */
async fn texto_campo(campo: Field<'_>) -> Result<String, AppError> {
    campo
        .text()
        .await
        .map_err(|error| AppError::BadRequest(format!("Campo inválido: {error}")))
}

/* Valida y guarda el comprobante adjunto. El nombre en disco es un UUID
 * aleatorio: nunca se confía en el nombre enviado por el cliente. */
async fn guardar_comprobante(
    campo: Field<'_>,
    upload_dir: &str,
) -> Result<PathBuf, AppError> {
    let nombre_original = campo.file_name().unwrap_or_default().to_string();
    let tipo = campo.content_type().unwrap_or_default().to_string();
    if !COMPROBANTE_MIMES.contains(&tipo.as_str()) {
        return Err(AppError::BadRequest(
            "El comprobante debe ser una imagen (JPG, PNG, WebP) o PDF".into(),
        ));
    }
    let datos = campo.bytes().await.map_err(|error| {
        AppError::BadRequest(format!("No se pudo leer el comprobante: {error}"))
    })?;
    if datos.is_empty() || datos.len() > COMPROBANTE_MAX_BYTES {
        return Err(AppError::BadRequest(
            "El comprobante está vacío o supera los 5 MB".into(),
        ));
    }
    let extension = nombre_original
        .rsplit('.')
        .next()
        .map(str::to_ascii_lowercase)
        .filter(|extension| matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "webp" | "pdf"))
        .unwrap_or_else(|| {
            /* Si no hay extensión confiable se usa la del tipo MIME. */
            match tipo.as_str() {
                "image/png" => "png".to_string(),
                "image/webp" => "webp".to_string(),
                "application/pdf" => "pdf".to_string(),
                _ => "jpg".to_string(),
            }
        });
    let nombre_archivo = format!("{}.{}", Uuid::new_v4(), extension);
    let ruta = PathBuf::from(upload_dir).join(nombre_archivo);
    std::fs::write(&ruta, &datos)
        .map_err(|error| AppError::Internal(format!("No se pudo guardar el comprobante: {error}")))?;
    Ok(ruta)
}

/* Si la operación falla tras guardar el archivo, no dejar el comprobante
 * huérfano en disco. */
fn eliminar_comprobante(archivo: Option<&PathBuf>) {
    if let Some(ruta) = archivo {
        let _ = std::fs::remove_file(ruta);
    }
}

/* Registra una donación manual desde la página de donar. El formulario envía
 * los datos del donante y el comprobante (multipart/form-data). El archivo se
 * guarda en el directorio de subidas con un nombre aleatorio y el recibo nace
 * en pending_verification; el equipo lo revisa desde el panel antes de que el
 * ingreso aparezca en el feed en vivo y en el libro de transparencia.
 *
 * El parseo de campos es deliberadamente secuencial y explícito (siete campos
 * con validación propia); se permite la longitud para no fragmentar la lógica. */
#[allow(clippy::too_many_lines)]
#[utoipa::path(
    post,
    path = "/api/donations",
    request_body = String,
    responses(
        (status = 201, description = "Donación registrada pendiente de verificación", body = PublicDonationReceipt),
        (status = 400, description = "Datos o archivo inválidos", body = crate::errors::ErrorResponse)
    )
)]
pub async fn create_donation(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<PublicDonationReceipt>), AppError> {
    let mut metodo_id: Option<Uuid> = None;
    let mut nombre: Option<String> = None;
    let mut correo: Option<String> = None;
    let mut monto_minor: Option<i64> = None;
    let mut moneda: Option<String> = None;
    let mut referencia: Option<String> = None;
    let mut archivo_guardado: Option<PathBuf> = None;

    while let Some(campo) = multipart.next_field().await.map_err(|error| {
        AppError::BadRequest(format!("No se pudo leer el formulario: {error}"))
    })? {
        match campo.name().unwrap_or_default() {
            "payment_method_id" => {
                let texto = texto_campo(campo).await?;
                metodo_id = Some(
                    texto
                        .trim()
                        .parse()
                        .map_err(|_| AppError::BadRequest("Método de pago inválido".into()))?,
                );
            }
            "donor_name" => {
                let texto = texto_campo(campo).await?;
                let texto = texto.trim().to_string();
                if texto.is_empty() || texto.chars().count() > 120 {
                    return Err(AppError::BadRequest(
                        "El nombre es obligatorio (máx. 120 caracteres)".into(),
                    ));
                }
                nombre = Some(texto);
            }
            "donor_email" => {
                let texto = texto_campo(campo).await?;
                let texto = texto.trim().to_string();
                if !texto.is_empty() {
                    if texto.chars().count() > 160 || !texto.contains('@') {
                        return Err(AppError::BadRequest("Correo inválido".into()));
                    }
                    correo = Some(texto);
                }
            }
            "amount_minor" => {
                let texto = texto_campo(campo).await?;
                let valor: i64 = texto.trim().parse().map_err(|_| {
                    AppError::BadRequest("El monto debe ser un número entero de centavos".into())
                })?;
                if valor < 1 {
                    return Err(AppError::BadRequest("El monto debe ser mayor a cero".into()));
                }
                monto_minor = Some(valor);
            }
            "currency" => {
                let texto = texto_campo(campo).await?;
                let texto = texto.trim().to_ascii_uppercase();
                if texto.len() != 3 {
                    return Err(AppError::BadRequest("Moneda inválida".into()));
                }
                moneda = Some(texto);
            }
            "provider_reference" => {
                let texto = texto_campo(campo).await?;
                let texto = texto.trim().to_string();
                referencia = (!texto.is_empty() && texto.chars().count() <= 255).then_some(texto);
            }
            "proof" => {
                /* El comprobante es opcional; si viene, se valida y guarda. */
                archivo_guardado = Some(guardar_comprobante(campo, &state.upload_dir).await?);
            }
            _ => {
                /* Campos desconocidos se ignoran; el formulario controla qué
                 * envía. El campo se drena igual para no bloquear la petición. */
                let _ = campo.bytes().await;
            }
        }
    }

    let metodo_id = metodo_id
        .ok_or_else(|| AppError::BadRequest("Falta el método de pago".into()))?;
    let nombre = nombre.ok_or_else(|| AppError::BadRequest("Falta el nombre del donante".into()))?;
    let monto_minor = monto_minor
        .ok_or_else(|| AppError::BadRequest("Falta el monto".into()))?;
    let moneda = moneda.ok_or_else(|| AppError::BadRequest("Falta la moneda".into()))?;

    /* El método debe existir, ser manual y estar habilitado: así no se puede
     * registrar una donación contra un proveedor automático no operativo. */
    let metodo = PaymentRepository::get_method(&state.pool, metodo_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Método de pago no encontrado".into()))?;
    if metodo.mode != "manual" || metodo.status != "enabled" {
        eliminar_comprobante(archivo_guardado.as_ref());
        return Err(AppError::BadRequest(
            "El método de pago no está habilitado".into(),
        ));
    }

    /* La URL pública del comprobante es relativa a /uploads, que el backend
     * sirve como estático. Si no se adjuntó archivo, queda null. */
    let url_publica = archivo_guardado
        .as_ref()
        .and_then(|ruta| ruta.file_name())
        .and_then(|nombre| nombre.to_str())
        .map(|nombre| format!("/uploads/{nombre}"));
    let referencia_borrable = referencia.filter(|referencia| !referencia.trim().is_empty());

    let recibo = PaymentRepository::create_public_receipt(
        &state.pool,
        &NewPublicReceipt {
            payment_method_id: metodo_id,
            provider_reference: referencia_borrable,
            donor_name: nombre,
            donor_email: correo,
            amount_minor: monto_minor,
            currency: moneda,
            proof_url: url_publica,
        },
    )
    .await
    .inspect_err(|_| eliminar_comprobante(archivo_guardado.as_ref()))?;

    Ok((StatusCode::CREATED, Json(recibo)))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/transparency/summary", get(get_summary))
        .route("/transparency/actions", get(get_actions))
        .route("/transparency/content/:key", get(get_content))
        .route("/payment-methods", get(list_public_payment_methods))
        .route("/donations/live", get(list_live_donations))
        .route("/donations", post(create_donation))
}
