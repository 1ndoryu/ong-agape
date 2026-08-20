import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as EventoPuntero } from 'react';
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
 * muestra un estado vacío en lugar de contenido falso. */
function BlogInicio() {
  const [estado, setEstado] = useState<EstadoBlog>({ tipo: 'cargando' });
  const listaRef = useRef<HTMLDivElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const arrastreRef = useRef({ inicioScroll: 0, inicioX: 0, activo: false });

  /* Arrastre con puntero (ratón y táctil): mueve el scroll horizontal de la lista.
   * El scroll nativo con scroll-snap sigue disponible para arrastrar en táctil;
   * con el ratón, arrastrar la lista desplaza el carrusel en lugar de seleccionar. */
  function iniciarArrastre(evento: EventoPuntero<HTMLDivElement>) {
    const lista = listaRef.current;
    if (!lista) return;
    if (evento.pointerType === 'mouse' && evento.button !== 0) return;
    arrastreRef.current = {
      inicioScroll: lista.scrollLeft,
      inicioX: evento.clientX,
      activo: true,
    };
    setArrastrando(true);
    lista.setPointerCapture(evento.pointerId);
  }

  function moverArrastre(evento: EventoPuntero<HTMLDivElement>) {
    const lista = listaRef.current;
    if (!lista || !arrastreRef.current.activo) return;
    lista.scrollLeft =
      arrastreRef.current.inicioScroll - (evento.clientX - arrastreRef.current.inicioX);
  }

  function terminarArrastre(evento: EventoPuntero<HTMLDivElement>) {
    const lista = listaRef.current;
    if (!lista || !arrastreRef.current.activo) return;
    arrastreRef.current.activo = false;
    setArrastrando(false);
    if (lista.hasPointerCapture(evento.pointerId)) {
      lista.releasePointerCapture(evento.pointerId);
    }
  }

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
      <p className="textoBlog">
        Compartimos avances, aprendizajes y las historias de una comunidad que se
        organiza para cuidar.
      </p>

      {estado.tipo === 'cargando' && <p className="estadoBlog">Cargando historias…</p>}

      {estado.tipo === 'error' && (
        <div className="estadoBlog" role="status">
          <strong>El blog está en actualización.</strong>
          <p>Pronto volverán a estar disponibles nuestras historias.</p>
        </div>
      )}

      {estado.tipo === 'vacio' && (
        <div className="estadoBlog" role="status">
          <strong>Pronto habrá nuevas historias.</strong>
          <p>
            El equipo de Ágape podrá compartir aquí actividades, avances y aprendizajes
            con transparencia.
          </p>
        </div>
      )}

      {estado.tipo === 'lista' && (
        <div
          ref={listaRef}
          className={`listaBlog${arrastrando ? ' arrastrando' : ''}`}
          onPointerDown={iniciarArrastre}
          onPointerMove={moverArrastre}
          onPointerUp={terminarArrastre}
          onPointerCancel={terminarArrastre}
        >
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
                  Leer historia
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default BlogInicio;
