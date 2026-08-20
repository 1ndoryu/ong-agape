import { useEffect, useState } from 'react';
import './BlogInicio.css';

type EntradaBlog = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  published_at: string | null;
};

type EstadoBlog =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'vacio' }
  | { tipo: 'lista'; entradas: EntradaBlog[] };

async function cargarEntradasBlog(senal: AbortSignal): Promise<EntradaBlog[]> {
  const respuesta = await fetch('/api/blog', { signal: senal });
  if (!respuesta.ok) throw new Error(`No se pudo cargar el blog (${respuesta.status})`);
  return (await respuesta.json()) as EntradaBlog[];
}

function formatearFecha(valor: string | null): string {
  if (!valor) return 'Historia reciente';
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'long' }).format(new Date(valor));
}

/* El blog consume la API pública del backend; si aún no hay entradas publicadas,
 * muestra un estado vacío con CTA a Instagram en lugar de contenido falso. */
function BlogInicio() {
  const [estado, setEstado] = useState<EstadoBlog>({ tipo: 'cargando' });

  useEffect(() => {
    const controlador = new AbortController();
    cargarEntradasBlog(controlador.signal)
      .then((entradas) => {
        setEstado(
          entradas.length > 0 ? { tipo: 'lista', entradas } : { tipo: 'vacio' },
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setEstado({ tipo: 'error' });
      });
    return () => controlador.abort();
  }, []);

  return (
    <section className="blogInicio contenedor" id="blog">
      <p className="etiquetaBlog">Nuestras historias</p>
      <h2 className="tituloBlog">Noticias desde Ágape</h2>
      <p className="textoBlog">
        Compartimos avances, aprendizajes y las historias de una comunidad que se
        organiza para cuidar.
      </p>

      {estado.tipo === 'cargando' && <p className="estadoBlog">Cargando historias…</p>}

      {estado.tipo === 'error' && (
        <div className="estadoBlog" role="status">
          <strong>El blog está en actualización.</strong>
          <p>
            Mientras tanto, síguenos en Instagram para ver la actividad más reciente.
          </p>
          <a
            className="enlaceInstagram"
            href="https://www.instagram.com/elproyectoagape/"
            target="_blank"
            rel="noreferrer"
          >
            Ver en Instagram ↗
          </a>
        </div>
      )}

      {estado.tipo === 'vacio' && (
        <div className="estadoBlog" role="status">
          <strong>Pronto habrá nuevas historias.</strong>
          <p>
            El equipo de Ágape podrá compartir aquí actividades, avances y aprendizajes
            con transparencia.
          </p>
          <a
            className="enlaceInstagram"
            href="https://www.instagram.com/elproyectoagape/"
            target="_blank"
            rel="noreferrer"
          >
            Ver en Instagram ↗
          </a>
        </div>
      )}

      {estado.tipo === 'lista' && (
        <>
          <div className="cuadriculaBlog">
            {estado.entradas.slice(0, 3).map((entrada) => (
              <article className="tarjetaBlog" key={entrada.slug}>
                {entrada.cover_image_url && (
                  <img
                    className="portadaBlog"
                    src={entrada.cover_image_url}
                    alt=""
                    loading="lazy"
                  />
                )}
                <div className="contenidoBlog">
                  <p className="fechaBlog">{formatearFecha(entrada.published_at)}</p>
                  <h3 className="tituloTarjetaBlog">{entrada.title}</h3>
                  <p className="extractoBlog">{entrada.excerpt}</p>
                  <a className="enlaceLeer" href={`/blog/${entrada.slug}`}>
                    Leer historia ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
          <a
            className="enlaceInstagram"
            href="https://www.instagram.com/elproyectoagape/"
            target="_blank"
            rel="noreferrer"
          >
            Ver más en Instagram ↗
          </a>
        </>
      )}
    </section>
  );
}

export default BlogInicio;
