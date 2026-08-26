import { useEffect } from 'react';
import type { AccionTransparencia } from './donarApi';

/* Modal de una acción de transparencia: muestra el título (concepto), la
 * descripción completa y las imágenes de la acción. Es el mismo detalle que
 * se ve en la página /acciones y en la sección de /donar, para que el clic
 * siempre abra el mismo contenido. */
function ModalAccion({
  accion,
  alCerrar,
}: {
  accion: AccionTransparencia;
  alCerrar: () => void;
}) {
  /* Cierra con Escape y bloquea el scroll del fondo mientras está abierto. */
  useEffect(() => {
    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alTecla);
    const cuerpo = document.body;
    const anterior = cuerpo.style.overflow;
    cuerpo.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTecla);
      cuerpo.style.overflow = anterior;
    };
  }, [alCerrar]);

  return (
    <div
      className="modalAccionFondo"
      role="presentation"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div className="modalAccion" role="dialog" aria-modal="true" aria-labelledby="modalAccionTitulo">
        <button
          type="button"
          className="modalAccionCerrar"
          aria-label="Cerrar"
          onClick={alCerrar}
        >
          ×
        </button>
        <h2 id="modalAccionTitulo">{accion.concept}</h2>
        <p className="modalAccionMeta">
          {accion.campaign ? `${accion.campaign} · ` : ''}
          {accion.occurred_on}
        </p>
        {accion.description && <p className="modalAccionDescripcion">{accion.description}</p>}
        {accion.images.length > 0 && (
          <div className="modalAccionImagenes">
            {accion.images.map((url) => (
              <img key={url} src={url} alt={accion.concept} loading="lazy" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ModalAccion;
