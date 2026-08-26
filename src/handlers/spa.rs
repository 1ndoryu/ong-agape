/* [268A-4] Handler SPA para producción (un solo contenedor).
 *
 * Por qué existe: el backend sirve el frontend compilado bajo `/` cuando se
 * configura STATIC_DIR. `ServeDir::not_found_service` conserva el status 404
 * (está pensado para páginas de error), pero una SPA de react-router necesita
 * devolver `index.html` con 200 en recarga directa de rutas como /donar o
 * /acciones. Este handler:
 *   - sirve el archivo real si existe (content-type por extensión vía mime_guess);
 *   - si no existe, devuelve `index.html` con 200 (contrato SPA);
 *   - nunca toca /api, /uploads ni /swagger-ui porque se monta solo como
 *     fallback del router (se ejecuta únicamente cuando ninguna ruta matchea).
 *
 * Seguridad: el path se decodifica y se normaliza (sin `..`), y se comprueba
 * que quede dentro de `root` para evitar path traversal.
 */

use std::path::{Component, Path, PathBuf};

use axum::extract::{Request, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use percent_encoding::percent_decode_str;

use crate::AppState;

/// Fallback del router: sirve la SPA desde `AppState::static_dir`.
pub async fn spa_handler(State(state): State<AppState>, req: Request) -> Response {
    /* Extraemos método y path antes de cualquier await: el body de la request
     * contiene `dyn HttpBody` (no `Sync`), y retener `&req` cruzaría un await
     * haciendo el future no `Send`. */
    let method = req.method().clone();
    let uri_path = req.uri().path().to_string();

    /* Rutas de API/uploads/swagger no matcheadas deben dar 404, no la SPA:
     * conservamos el contrato de la API aunque el router esté en modo SPA. */
    if uri_path.starts_with("/api/")
        || uri_path.starts_with("/uploads")
        || uri_path.starts_with("/swagger-ui")
    {
        return (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "application/json")],
            r#"{"error":"not_found"}"#,
        )
            .into_response();
    }

    match &state.static_dir {
        Some(dir) => spa_serve(dir, &uri_path, method).await,
        /* Sin STATIC_DIR no debería montarse; 404 explícito por defensa. */
        None => (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
            "frontend no configurado",
        )
            .into_response(),
    }
}

async fn spa_serve(root: &str, uri_path: &str, method: axum::http::Method) -> Response {
    let root_path = PathBuf::from(root);
    /* Solo GET/HEAD: los demás métodos no tienen sentido para la SPA. */
    if method != axum::http::Method::GET && method != axum::http::Method::HEAD {
        return (
            StatusCode::METHOD_NOT_ALLOWED,
            [(header::ALLOW, "GET, HEAD")],
        )
            .into_response();
    }

    let path = match decode_and_normalize(uri_path, &root_path) {
        Some(p) => p,
        None => return spa_index(&root_path).await,
    };

    match tokio::fs::metadata(&path).await {
        Ok(meta) if meta.is_file() => serve_file(&path).await,
        /* Archivo o directorio inexistente: la SPA se encarga de la ruta. */
        _ => spa_index(&root_path).await,
    }
}

/// Decodifica el path de la URI y lo normaliza garantizando que quede dentro
/// de `root`. Devuelve `None` si no se puede decodificar.
fn decode_and_normalize(uri_path: &str, root: &Path) -> Option<PathBuf> {
    let decoded = percent_decode_str(uri_path).decode_utf8().ok()?;
    let mut candidate = root.to_path_buf();
    for component in Path::new(decoded.as_ref()).components() {
        match component {
            Component::Normal(part) => candidate.push(part),
            /* `..` y raíz: ignorados, nunca se sale de la raíz. */
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {}
            Component::CurDir => {}
        }
    }
    Some(candidate)
}

async fn serve_file(path: &Path) -> Response {
    match tokio::fs::read(path).await {
        Ok(bytes) => {
            let mime = mime_guess::from_path(path)
                .first_or_octet_stream()
                .to_string();
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, mime),
                    /* Los assets de Vite llevan hash; el resto puede recargar
                     * sin problema en producción. */
                    (header::CACHE_CONTROL, "public, max-age=3600".to_string()),
                ],
                bytes,
            )
                .into_response()
        }
        Err(err) => (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
            format!("archivo no encontrado: {err}"),
        )
            .into_response(),
    }
}

/// Devuelve `index.html` con 200 (SPA fallback de recarga directa).
async fn spa_index(root: &Path) -> Response {
    let index = root.join("index.html");
    match tokio::fs::read(&index).await {
        Ok(bytes) => (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (header::CACHE_CONTROL, "no-cache"),
            ],
            bytes,
        )
            .into_response(),
        /* Sin index.html (STATIC_DIR mal configurado): 404 explícito. */
        Err(err) => (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
            format!("index.html no encontrado: {err}"),
        )
            .into_response(),
    }
}
