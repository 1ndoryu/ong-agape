/* Cliente de la API pública de contenido de la portada. La sección "Nuestra
 * historia" (acerca_de_nosotros) vive en transparency_content: el texto en
 * title/body y las imágenes en metadata.images. Si el backend aún no tiene
 * contenido publicado, cargarContenidoAcerca devuelve null y la sección usa
 * sus valores por defecto. */

export type ContenidoAcerca = {
  content_key: string;
  locale: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  images: string[];
};

export async function cargarContenidoAcerca(senal?: AbortSignal): Promise<ContenidoAcerca | null> {
  const respuesta = await fetch('/api/transparency/content/acerca_de_nosotros', { signal: senal });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar la sección (${respuesta.status})`);
  }
  return (await respuesta.json()) as ContenidoAcerca;
}
