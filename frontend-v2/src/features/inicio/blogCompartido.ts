/* Tipos y utilidades compartidas entre la lista del blog y la página
 * individual; viven aquí para evitar dependencias circulares entre
 * BlogInicio e HistoriaDetalle. */

export type EntradaBlog = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  published_at: string | null;
};

export function formatearFecha(valor: string | null): string {
  if (!valor) return '';
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'long' }).format(
    new Date(valor),
  );
}
