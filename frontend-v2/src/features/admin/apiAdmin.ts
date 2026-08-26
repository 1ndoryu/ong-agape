/* Cliente del panel administrativo en frontend-v2. Los contratos replican la
 * API del backend (handlers/auth.rs, handlers/admin.rs) y los tipos de
 * frontend/src/api/admin.ts (v1), para que ambas UIs hablen el mismo idioma. */

export type RolAdmin = 'owner' | 'finance_editor' | 'auditor' | 'viewer';

export type PerfilAdmin = {
  id: string;
  email: string;
  role: RolAdmin;
  status: string;
};

export type RespuestaLogin = { token: string; user_id: string };

const CLAVE_TOKEN = 'agape_admin_token';

export function leerToken(): string | null {
  return sessionStorage.getItem(CLAVE_TOKEN);
}

export function guardarToken(token: string): void {
  sessionStorage.setItem(CLAVE_TOKEN, token);
}

export function borrarToken(): void {
  sessionStorage.removeItem(CLAVE_TOKEN);
}

/* Credenciales de auto-login SOLO para desarrollo local (vite dev). Se leen
 * de .env (VITE_DEV_EMAIL / VITE_DEV_PASSWORD, archivo gitignored) para no
 * tener que teclear la contraseña a cada rato. En build de producción
 * import.meta.env.DEV es false y esto devuelve null: la ruta queda muerta. */
export function credencialesDesarrollo(): { correo: string; clave: string } | null {
  if (!import.meta.env.DEV) return null;
  const correo = import.meta.env.VITE_DEV_EMAIL as string | undefined;
  const clave = import.meta.env.VITE_DEV_PASSWORD as string | undefined;
  if (!correo || !clave) return null;
  return { correo, clave };
}

async function peticion<T>(ruta: string, opciones: RequestInit & { token?: string }): Promise<T> {
  const cabeceras: Record<string, string> = {};
  if (opciones.body !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (opciones.token) cabeceras['Authorization'] = `Bearer ${opciones.token}`;
  const respuesta = await fetch(ruta, {
    ...opciones,
    headers: { ...cabeceras, ...(opciones.headers as Record<string, string> | undefined) },
  });
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | (T & { message?: string; error?: string })
    | null;
  if (!respuesta.ok) {
    throw new Error(cuerpo?.message ?? cuerpo?.error ?? `Error ${respuesta.status} en ${ruta}`);
  }
  return cuerpo as T;
}

export async function iniciarSesion(correo: string, clave: string): Promise<RespuestaLogin> {
  return peticion<RespuestaLogin>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: correo, password: clave }),
  });
}

export async function obtenerPerfil(token: string): Promise<PerfilAdmin> {
  return peticion<PerfilAdmin>('/api/admin/me', { token });
}

export async function adminGet<T>(ruta: string, token: string): Promise<T> {
  return peticion<T>(`/api/admin${ruta}`, { token });
}

export async function adminEscribir<T>(
  ruta: string,
  token: string,
  metodo: 'POST' | 'PUT',
  cuerpo?: unknown,
): Promise<T> {
  return peticion<T>(`/api/admin${ruta}`, {
    method: metodo,
    token,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

/* Las rutas de transparencia viven bajo /admin/transparency/entries (handlers/admin.rs)
 * y el cambio de estado es PUT, no POST. Es un toggle: publicar cuando la
 * entrada está oculta y volver a borrador (draft) cuando está publicada.
 * El backend valida que publicar solo lo acepte el owner. */
export async function publicarEntrada(
  token: string,
  id: string,
  publicar: boolean,
): Promise<void> {
  await peticion(`/api/admin/transparency/entries/${id}/status`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ status: publicar ? 'published' : 'draft' }),
  });
}

/* Edición de una entrada del libro (gasto o ingreso) para la rendición de
 * cuentas: concepto, campaña, monto, fecha y la narrativa + imágenes de la
 * acción de transparencia. El backend valida el rol (WriteLedger) y las URLs
 * de las imágenes antes de persistir. */
export type DatosEntradaFondo = {
  concept: string;
  campaign: string | null;
  amount_minor: number;
  currency: string;
  occurred_on: string;
  description: string | null;
  images: string[];
};

/* Entrada del libro tal como la devuelve GET /api/admin/transparency/entries:
 * incluye la narrativa y las imágenes para la gestión de acciones. */
export type EntradaFondoAdmin = {
  id: string;
  entry_type: 'income' | 'expense';
  concept: string;
  campaign: string | null;
  amount_minor: number;
  currency: string;
  status: 'draft' | 'pending' | 'verified' | 'published' | 'rejected';
  occurred_on: string;
  description: string | null;
  images: string[];
};

export async function guardarEntradaFondo(
  token: string,
  id: string,
  datos: DatosEntradaFondo,
): Promise<unknown> {
  return adminEscribir(`/transparency/entries/${id}`, token, 'PUT', datos);
}

/* Contratos de /api/admin/blog/posts (handlers/blog.rs): crear y editar son
 * borradores completos; publicar/archivar va por la subruta de estado. */
export type ArticuloAdmin = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DatosArticulo = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
};

export function listarArticulos(token: string, estado?: ArticuloAdmin['status']): Promise<ArticuloAdmin[]> {
  const consulta = estado ? `?status=${estado}` : '';
  return adminGet<ArticuloAdmin[]>(`/blog/posts${consulta}`, token);
}

export function crearArticulo(token: string, datos: DatosArticulo): Promise<ArticuloAdmin> {
  return adminEscribir<ArticuloAdmin>('/blog/posts', token, 'POST', datos);
}

export function guardarArticulo(
  token: string,
  id: string,
  datos: DatosArticulo,
): Promise<ArticuloAdmin> {
  return adminEscribir<ArticuloAdmin>(`/blog/posts/${id}`, token, 'PUT', datos);
}

export function cambiarEstadoArticulo(
  token: string,
  id: string,
  estado: ArticuloAdmin['status'],
): Promise<ArticuloAdmin> {
  return adminEscribir<ArticuloAdmin>(`/blog/posts/${id}/status`, token, 'PUT', {
    status: estado,
  });
}

/* Contratos de /api/admin/allies (handlers/allie.rs): CRUD completo de aliados
 * del carrusel de la portada. El público los consume desde /api/allies. */
export type AliadoAdmin = {
  id: string;
  nombre: string;
  logo_url: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DatosAliado = {
  nombre: string;
  logo_url: string;
  display_order: number;
  active: boolean;
};

export function listarAliados(token: string): Promise<AliadoAdmin[]> {
  return adminGet<AliadoAdmin[]>('/allies', token);
}

export function crearAliado(token: string, datos: DatosAliado): Promise<AliadoAdmin> {
  return adminEscribir<AliadoAdmin>('/allies', token, 'POST', datos);
}

export function guardarAliado(
  token: string,
  id: string,
  datos: DatosAliado,
): Promise<AliadoAdmin> {
  return adminEscribir<AliadoAdmin>(`/allies/${id}`, token, 'PUT', datos);
}

export function borrarAliado(token: string, id: string): Promise<void> {
  return peticion(`/api/admin/allies/${id}`, { method: 'DELETE', token });
}

/* Borrado de una entrada del libro (acción de transparencia incluida). El
 * backend responde 204 sin cuerpo y registra la auditoría; el comprobante
 * asociado se conserva. Mismo patrón que borrarAliado. */
export function borrarEntradaFondo(token: string, id: string): Promise<void> {
  return peticion(`/api/admin/transparency/entries/${id}`, { method: 'DELETE', token });
}

/* Borrado de un artículo del blog (borrador, publicado o archivado). El
 * backend responde 204 sin cuerpo y registra la auditoría. */
export function borrarArticulo(token: string, id: string): Promise<void> {
  return peticion(`/api/admin/blog/posts/${id}`, { method: 'DELETE', token });
}

/* Contratos de /api/admin/contact/messages (handlers/contact.rs): el equipo
 * lee los mensajes enviados desde la página pública /contacto y puede
 * borrarlos (borrado físico, sin papelera). El alta es público (POST
 * /api/contact), sin token. */
export type MensajeContacto = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export function listarMensajes(token: string): Promise<MensajeContacto[]> {
  return adminGet<MensajeContacto[]>('/contact/messages', token);
}

export function borrarMensaje(token: string, id: string): Promise<void> {
  return peticion(`/api/admin/contact/messages/${id}`, { method: 'DELETE', token });
}

/* Borrado de una campaña. El backend responde 204 sin cuerpo y registra la
 * auditoría. */
export function borrarCampana(token: string, id: string): Promise<void> {
  return peticion(`/api/admin/campaigns/${id}`, { method: 'DELETE', token });
}

/* Contratos de /api/admin/campaigns (handlers/campaign.rs). El objetivo de
 * recaudación de la página de donar usa la campaña activa: el "título de la
 * meta" es el campo `name` de la campaña y la meta monetaria `goal_minor`. */
export type CampanaAdmin = {
  id: string;
  slug: string;
  name: string;
  goal_minor: number;
  currency: string;
  starts_on: string;
  ends_on: string | null;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
};

export type DatosCampana = {
  slug: string;
  name: string;
  goal_minor: number;
  currency: string;
  starts_on: string;
  ends_on: string | null;
  description: string;
};

export function listarCampanas(token: string): Promise<CampanaAdmin[]> {
  return adminGet<CampanaAdmin[]>('/campaigns', token);
}

export function crearCampana(token: string, datos: DatosCampana): Promise<CampanaAdmin> {
  return adminEscribir<CampanaAdmin>('/campaigns', token, 'POST', datos);
}

export function guardarCampana(
  token: string,
  id: string,
  datos: DatosCampana,
): Promise<CampanaAdmin> {
  return adminEscribir<CampanaAdmin>(`/campaigns/${id}`, token, 'PUT', datos);
}

export function cambiarEstadoCampana(
  token: string,
  id: string,
  estado: CampanaAdmin['status'],
): Promise<CampanaAdmin> {
  return adminEscribir<CampanaAdmin>(`/campaigns/${id}/status`, token, 'PUT', {
    status: estado,
  });
}

/* Contratos de /api/admin/transparency/content/{key} (handlers/admin.rs). Se
 * reutiliza para la sección "Nuestra historia" (key 'acerca_de_nosotros'):
 * el texto en title/body y las imágenes en images (hasta 3). Guardar crea un
 * borrador; publicar lo convierte en visible para el público. */
export type ContenidoAdmin = {
  id: string;
  content_key: string;
  locale: string;
  title: string;
  body: string;
  status: 'draft' | 'published';
  cta_label: string | null;
  cta_url: string | null;
  images: string[];
  updated_by: string | null;
  updated_at: string;
};

export type DatosContenido = {
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  images: string[];
};

export function obtenerContenido(token: string, clave: string): Promise<ContenidoAdmin> {
  return adminGet<ContenidoAdmin>(`/transparency/content/${clave}`, token);
}

export function guardarContenido(
  token: string,
  clave: string,
  datos: DatosContenido,
): Promise<ContenidoAdmin> {
  return adminEscribir<ContenidoAdmin>(`/transparency/content/${clave}`, token, 'PUT', datos);
}

export function publicarContenido(token: string, clave: string): Promise<ContenidoAdmin> {
  return adminEscribir<ContenidoAdmin>(
    `/transparency/content/${clave}/publish`,
    token,
    'POST',
    undefined,
  );
}

/* Sube una imagen del panel (multipart, campo "image") y devuelve su URL
 * pública. El backend la sirve desde /uploads. */
export async function subirImagenContenido(token: string, archivo: File): Promise<string> {
  const formulario = new FormData();
  formulario.append('image', archivo);
  const respuesta = await fetch('/api/admin/content/image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formulario,
  });
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | ({ url?: string } & { message?: string; error?: string })
    | null;
  if (!respuesta.ok) {
    throw new Error(cuerpo?.message ?? cuerpo?.error ?? `Error ${respuesta.status} al subir la imagen`);
  }
  if (!cuerpo?.url) {
    throw new Error('La subida no devolvió una URL');
  }
  return cuerpo.url;
}
