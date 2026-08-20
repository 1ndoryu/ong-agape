import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { EntradaBlog } from './blogCompartido';
import { formatearFecha } from './blogCompartido';
import './HistoriaDetalle.css';

type EstadoHistoria =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'cargada'; entrada: EntradaBlog };

async function cargarHistoria(slug: string, senal: AbortSignal): Promise<EntradaBlog> {
  const respuesta = await fetch(`/api/blog/${encodeURIComponent(slug)}`, { signal: senal });
  if (!respuesta.ok) throw new Error(`No se pudo cargar la historia (${respuesta.status})`);
  return (await respuesta.json()) as EntradaBlog;
}

/* Página individual de una historia, montada en la ruta real /blog/:slug.
 * Carga la entrada por slug desde la API pública, de modo que la URL directa
 * y la recarga de la página funcionan igual que la navegación desde la lista.
 * El cuerpo guardado en la base separa párrafos con doble salto de línea;
 * aquí se vuelven a dividir en <p> para una lectura cómoda. La fecha editorial
 * se muestra solo en este detalle: en las tarjetas de la lista va sin fecha
 * por decisión del cliente.
 *
 * Gotcha: las migraciones seed escribieron `\n\n` literal (backslash + n) y
 * Postgres lo guardó sin interpretar. Se normaliza la secuencia `\n` a salto
 * de línea real antes de dividir, de modo que funcione tanto con ese formato
 * como con saltos reales guardados desde el panel de administración. */
function HistoriaDetalle() {
  const { slug = '' } = useParams();
  const [estado, setEstado] = useState<EstadoHistoria>({ tipo: 'cargando' });

  useEffect(() => {
    const controlador = new AbortController();
    setEstado({ tipo: 'cargando' });
    cargarHistoria(slug, controlador.signal)
      .then((entrada) => setEstado({ tipo: 'cargada', entrada }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setEstado({ tipo: 'error' });
      });
    return () => controlador.abort();
  }, [slug]);

  if (estado.tipo === 'cargando') {
    return (
      <section className="historiaDetalle contenedor">
        <p className="estadoHistoria">Cargando historia…</p>
      </section>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <section className="historiaDetalle contenedor">
        <div className="estadoHistoria" role="status">
          <strong>No encontramos esta historia.</strong>
          <p>Puede que el enlace esté desactualizado o que la historia ya no esté publicada.</p>
          <Link className="volverHistoria" to="/">
            ← Volver a las historias
          </Link>
        </div>
      </section>
    );
  }

  const { entrada } = estado;
  const cuerpoNormalizado = entrada.body.replace(/\\n/g, '\n');
  const parrafos = cuerpoNormalizado
    .split(/\n\s*\n/)
    .map((parrafo) => parrafo.trim())
    .filter((parrafo) => parrafo !== '');
  const fecha = formatearFecha(entrada.published_at);

  return (
    <article className="historiaDetalle contenedor">
      <Link className="volverHistoria" to="/">
        ← Volver a las historias
      </Link>

      {entrada.cover_image_url && (
        <img className="portadaDetalle" src={entrada.cover_image_url} alt="" />
      )}

      <header className="cabeceraDetalle">
        <h2 className="tituloDetalle">{entrada.title}</h2>
        {fecha && <p className="fechaDetalle">{fecha}</p>}
      </header>

      <div className="cuerpoDetalle">
        {parrafos.map((parrafo, indice) => (
          <p key={indice}>{parrafo}</p>
        ))}
      </div>
    </article>
  );
}

export default HistoriaDetalle;
