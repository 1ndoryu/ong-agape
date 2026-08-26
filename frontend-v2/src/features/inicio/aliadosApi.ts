/* Cliente de la API pública de aliados. Solo expone aliados activos (los que
 * el panel marcó como visibles), en el orden definido por el admin. */

export type AliadoPublico = {
  id: string;
  nombre: string;
  logo_url: string;
};

export async function cargarAliadosPublicos(senal?: AbortSignal): Promise<AliadoPublico[]> {
  const respuesta = await fetch('/api/allies', { signal: senal });
  if (!respuesta.ok) {
    throw new Error(`No se pudieron cargar los aliados (${respuesta.status})`);
  }
  return (await respuesta.json()) as AliadoPublico[];
}
