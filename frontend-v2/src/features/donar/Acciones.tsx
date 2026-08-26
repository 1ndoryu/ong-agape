import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ModalAccion from './ModalAccion';
import {
  cargarAccionesTransparencia,
  formatearMonto,
  type AccionTransparencia,
} from './donarApi';
import './Acciones.css';

type EstadoAcciones =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'lista'; acciones: AccionTransparencia[] };

/* Página pública de todas las acciones de transparencia: cada tarjeta es un
 * gasto publicado con narrativa e imágenes. Un clic abre el mismo modal que
 * la sección de /donar. El botón "Donar" mantiene el llamado a la acción. */
function Acciones() {
  const [estado, setEstado] = useState<EstadoAcciones>({ tipo: 'cargando' });
  const [seleccionada, setSeleccionada] = useState<AccionTransparencia | null>(null);

  useEffect(() => {
    const controlador = new AbortController();
    cargarAccionesTransparencia(100, controlador.signal)
      .then((acciones) => setEstado({ tipo: 'lista', acciones }))
      .catch((motivo: unknown) => {
        if (motivo instanceof DOMException && motivo.name === 'AbortError') return;
        setEstado({
          tipo: 'error',
          mensaje: motivo instanceof Error ? motivo.message : 'No se pudieron cargar las acciones',
        });
      });
    return () => controlador.abort();
  }, []);

  return (
    <div className="acciones contenedor">
      <div className="accionesCabecera">
        <p className="etiquetaDonar">Transparencia</p>
        <h1>Así se está usando tu ayuda</h1>
        <p className="accionesDescripcion">
          Publicamos cada acción con lo que se hizo con el dinero: qué se compró,
          en qué fecha y con qué evidencias. Toda la rendición de cuentas está
          disponible para que la consultes.
        </p>
      </div>

      {estado.tipo === 'cargando' && <p className="accionesEstado">Cargando acciones…</p>}
      {estado.tipo === 'error' && (
        <p className="accionesEstado" role="alert">{estado.mensaje}</p>
      )}
      {estado.tipo === 'lista' && (
        <>
          {estado.acciones.length === 0 ? (
            <p className="accionesEstado">Aún no hay acciones publicadas.</p>
          ) : (
            <div className="accionesGrid">
              {estado.acciones.map((accion) => (
                <button
                  key={accion.id}
                  type="button"
                  className="tarjetaAccion"
                  onClick={() => setSeleccionada(accion)}
                >
                  {accion.images.length > 0 && (
                    <img
                      className="tarjetaAccionImagen"
                      src={accion.images[0]}
                      alt={accion.concept}
                      loading="lazy"
                    />
                  )}
                  <span className="tarjetaAccionCuerpo">
                    <span className="tarjetaAccionMeta">
                      {accion.campaign ? `${accion.campaign} · ` : ''}
                      {accion.occurred_on}
                    </span>
                    <strong className="tarjetaAccionTitulo">{accion.concept}</strong>
                    <span className="tarjetaAccionMonto">
                      {formatearMonto(accion.amount_minor, accion.currency)}
                    </span>
                    {accion.description && (
                      <span className="tarjetaAccionResumen">
                        {accion.description.length > 90
                          ? `${accion.description.slice(0, 90)}…`
                          : accion.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="accionesPie">
            <Link className="botonDonar accionesDonar" to="/donar">
              Quiero donar
            </Link>
          </div>
        </>
      )}

      {seleccionada && (
        <ModalAccion accion={seleccionada} alCerrar={() => setSeleccionada(null)} />
      )}
    </div>
  );
}

export default Acciones;
