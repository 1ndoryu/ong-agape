import { useEffect, useState } from 'react';
import { borrarMensaje, listarMensajes, type MensajeContacto } from './apiAdmin';
import { puede, type CapacidadAdmin } from './permisos';
import type { RolAdmin } from './apiAdmin';
import PaginadorTabla from './PaginadorTabla';
import { usePaginacion } from './usePaginacion';
import AlertaPanel from '../../components/ui/AlertaPanel';
import IconoAccion from '../../components/ui/IconoAccion';
import { useToast } from '../../components/ui/Toast';
import { useConfirmar } from '../../components/ui/Confirmar';
import { useRefresco } from './useRefresco';
import './PanelAdmin.css';

/* Formatea la fecha del backend (ISO 8601 en UTC) a fecha + hora local y
 * legible. Mismo criterio que el resto del panel: "12/03/2026, 14:30". */
function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* Bandeja de mensajes de la página /contacto. El equipo los lee aquí y puede
 * borrarlos (borrado físico); no hay edición ni estados, el correo del
 * remitente se usa para responder desde el cliente de correo. */
function VistaMensajes({ perfil, token }: { perfil: { role: RolAdmin }; token: string }) {
  const [mensajes, setMensajes] = useState<MensajeContacto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Mensaje abierto en el modal de lectura. En la tabla solo se muestra un
   * resumen truncado; el modal es la única forma de leerlo entero (el title
   * del navegador no funciona en táctil). */
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState<MensajeContacto | null>(null);
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirmar();

  /* ESC cierra el modal de lectura, igual que la X o el clic fuera. */
  useEffect(() => {
    if (!mensajeSeleccionado) return;
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMensajeSeleccionado(null);
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [mensajeSeleccionado]);

  const cargar = () => {
    listarMensajes(token)
      .then(setMensajes)
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar los mensajes'),
      );
  };

  useEffect(cargar, [token]);

  /* Refresco automático: recarga la lista cada 30 s mientras la pestaña esté
   * visible, para reflejar mensajes nuevos sin recargar la página. */
  useRefresco(cargar, 30_000);

  const eliminar = async (mensaje: MensajeContacto) => {
    setError(null);
    const aceptado = await confirmar({
      titulo: 'Eliminar mensaje',
      mensaje: `¿Eliminar el mensaje de ${mensaje.name}? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
    });
    if (!aceptado) return;
    try {
      await borrarMensaje(token, mensaje.id);
      mostrarToast('Mensaje eliminado.');
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo eliminar el mensaje');
    }
  };

  /* La lista completa se pagina para no renderizar todos los mensajes a la
   * vez. Si los datos aún no cargaron (null), se pagina sobre una lista vacía.
   * El hook se llama siempre (antes de los early returns) para respetar las
   * Reglas de los Hooks. */
  const { visibles: paginaVisibles, pagina, totalPaginas, irAPagina } = usePaginacion(mensajes ?? []);

  if (!puede(perfil.role, 'ManageContent' satisfies CapacidadAdmin)) {
    return (
      <p className="panelEstado">
        Tu rol puede consultar el panel, pero no administrar los mensajes.
      </p>
    );
  }

  if (mensajes === null) {
    return <p className="panelEstado">{error ?? 'Cargando mensajes…'}</p>;
  }

  return (
    <div>
      <div className="panelCabeceraSeccion">
        <h2>Mensajes</h2>
      </div>
      {error && <AlertaPanel tipo="error">{error}</AlertaPanel>}

      {mensajes.length === 0 ? (
        <p className="panelEstado">Todavía no hay mensajes de contacto.</p>
      ) : (
        <table className="panelTabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Mensaje</th>
              <th>Recibido</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginaVisibles.map((mensaje) => (
              <tr key={mensaje.id}>
                <td>{mensaje.name}</td>
                <td>
                  <a href={`mailto:${mensaje.email}`}>{mensaje.email}</a>
                </td>
                <td>
                  <div className="panelMensajeCelda" title={mensaje.message}>
                    <span className="panelMensajeTexto">{mensaje.message}</span>
                    <button
                      type="button"
                      className="panelVerMensaje"
                      onClick={() => setMensajeSeleccionado(mensaje)}
                    >
                      Ver completo
                    </button>
                  </div>
                </td>
                <td>{formatearFecha(mensaje.created_at)}</td>
                <td>
                  <div className="panelMetodosAcciones">
                    <button
                      type="button"
                      className="botonIcono botonIcono--peligro"
                      aria-label={`Eliminar mensaje de ${mensaje.name}`}
                      title="Eliminar"
                      onClick={() => eliminar(mensaje)}
                    >
                      <IconoAccion nombre="eliminar" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <PaginadorTabla pagina={pagina} totalPaginas={totalPaginas} alCambiar={irAPagina} />

      {/* Modal de lectura del mensaje completo. Reutiliza el lenguaje visual
       * de .panelModal para que se sienta parte del panel. */}
      {mensajeSeleccionado && (
        <div
          className="panelModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tituloMensaje"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setMensajeSeleccionado(null);
          }}
        >
          <div className="panelModalContenido">
            <div className="panelModalCabecera">
              <h3 id="tituloMensaje">Mensaje de {mensajeSeleccionado.name}</h3>
              <button
                type="button"
                className="panelModalCerrar"
                aria-label="Cerrar"
                onClick={() => setMensajeSeleccionado(null)}
              >
                ×
              </button>
            </div>
            <div className="panelModalMensajeDatos">
              <a href={`mailto:${mensajeSeleccionado.email}`}>{mensajeSeleccionado.email}</a>
              <span>{formatearFecha(mensajeSeleccionado.created_at)}</span>
            </div>
            <p className="panelModalMensajeCuerpo">{mensajeSeleccionado.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default VistaMensajes;
