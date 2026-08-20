import type { EntradaBlog } from './blogCompartido';
import { formatearFecha } from './blogCompartido';
import './HistoriaDetalle.css';

type PropsHistoriaDetalle = {
  entrada: EntradaBlog;
  alVolver: () => void;
};

/* Página individual de una historia (/blog/:slug). El cuerpo guardado en la
 * base separa párrafos con doble salto de línea; aquí se vuelven a dividir en
 * <p> para una lectura cómoda. La fecha editorial se muestra solo en este
 * detalle: en las tarjetas de la lista va sin fecha por decisión del cliente.
 *
 * Gotcha: las migraciones seed escribieron `\n\n` literal (backslash + n) y
 * Postgres lo guardó sin interpretar. Se normaliza la secuencia `\n` a salto
 * de línea real antes de dividir, de modo que funcione tanto con ese formato
 * como con saltos reales guardados desde el panel de administración. */
function HistoriaDetalle({ entrada, alVolver }: PropsHistoriaDetalle) {
  const cuerpoNormalizado = entrada.body.replace(/\\n/g, '\n');
  const parrafos = cuerpoNormalizado
    .split(/\n\s*\n/)
    .map((parrafo) => parrafo.trim())
    .filter((parrafo) => parrafo !== '');
  const fecha = formatearFecha(entrada.published_at);

  return (
    <article className="historiaDetalle">
      <button type="button" className="volverHistoria" onClick={alVolver}>
        ← Volver a las historias
      </button>

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
