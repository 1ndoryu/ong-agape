import { useEffect, useState } from 'react';
import { adminGet, adminEscribir, type PerfilAdmin } from './apiAdmin';
import { puede } from './permisos';
import PaginadorTabla from './PaginadorTabla';
import { usePaginacion } from './usePaginacion';
import ModalImagen from '../../components/ui/ModalImagen';
import AlertaPanel from '../../components/ui/AlertaPanel';
import IconoAccion from '../../components/ui/IconoAccion';
import { useToast } from '../../components/ui/Toast';
import { useRefresco } from './useRefresco';
import './PanelAdmin.css';

type ReciboPago = {
  id: string;
  amount_minor: number;
  currency: string;
  donor_name: string | null;
  /* El backend serializa la referencia como provider_reference (models/admin.rs),
   * no como reference; el cliente usa el mismo nombre del contrato. */
  provider_reference: string | null;
  proof_url: string | null;
  status: 'pending_verification' | 'approved' | 'rejected';
  payment_method_id: string;
};

/* Método mínimo necesario para traducir el UUID del recibo a una etiqueta. */
type MetodoReferencia = {
  id: string;
  provider: string;
  public_label: string;
};

/* Nombre legible para cada estado del recibo; el valor crudo no es amigable
 * para quien administra la ONG. */
const ETIQUETAS_ESTADO: Record<ReciboPago['status'], string> = {
  pending_verification: 'Por verificar',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

/* Revisión de recibos de aportes manuales. Verificar (approve) inserta el
 * ingreso en el libro de forma transaccional en el backend; publicar después
 * es un paso separado desde Movimientos y solo lo hace el owner. */
function VistaRecibos({ perfil, token }: { perfil: PerfilAdmin; token: string }) {
  const [recibos, setRecibos] = useState<ReciboPago[] | null>(null);
  const [metodos, setMetodos] = useState<MetodoReferencia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | ReciboPago['status']>('todos');
  const [filtroMetodo, setFiltroMetodo] = useState<string>('todos');
  /* Imagen del comprobante activa en el modal; null = modal cerrado. */
  const [imagenActiva, setImagenActiva] = useState<{ src: string; alt: string } | null>(null);
  const { mostrarToast } = useToast();

  const cargar = () => {
    /* Los recibos traen payment_method_id (UUID); la lista de métodos permite
     * mostrar el nombre legible en la tabla. Ambas lecturas son independientes. */
    adminGet<ReciboPago[]>('/payment-receipts', token)
      .then(setRecibos)
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar los recibos'),
      );
    adminGet<MetodoReferencia[]>('/payment-methods', token)
      .then(setMetodos)
      .catch(() => {
        /* Si falla la lista de métodos, la tabla aún funciona sin esa columna
         * legible; el error principal se muestra por el fetch de recibos. */
      });
  };

  useEffect(cargar, [token]);

  /* Refresco automático: los recibos llegan de donaciones externas en
   * cualquier momento, así que esta vista se recarga cada 20 s mientras la
   * pestaña esté visible para que aparezcan sin recargar la página. */
  useRefresco(cargar, 20_000);

  const revisar = async (recibo: ReciboPago, estado: ReciboPago['status']) => {
    setError(null);
    try {
      /* La revisión es PUT /admin/payment-receipts/:id/review (handlers/admin.rs).
       * Aprobar registra el ingreso pendiente en el libro; publicarlo después
       * se hace desde Resumen/Movimientos con el rol owner. */
      await adminEscribir(`/payment-receipts/${recibo.id}/review`, token, 'PUT', {
        status: estado,
      });
      mostrarToast(
        estado === 'approved' ? 'Recibo aprobado e ingreso registrado.' : 'Recibo rechazado.',
      );
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo actualizar el recibo');
    }
  };

  /* Filtros combinados (estado Y método) aplicados en el cliente sobre la
   * lista ya cargada; "todos" omite esa condición. Si los datos aún no
   * cargaron (null), se pagina sobre una lista vacía. */
  const visibles = (recibos ?? []).filter(
    (recibo) =>
      (filtroEstado === 'todos' || recibo.status === filtroEstado) &&
      (filtroMetodo === 'todos' || recibo.payment_method_id === filtroMetodo),
  );

  /* Paginación en cliente sobre la lista ya filtrada: solo se renderizan los
   * recibos de la página actual. El hook se llama siempre (antes de los early
   * returns) para respetar las Reglas de los Hooks. */
  const { visibles: paginaVisibles, pagina, totalPaginas, irAPagina } = usePaginacion(visibles);

  if (error) return <AlertaPanel tipo="error">{error}</AlertaPanel>;
  if (!recibos) return <p className="panelEstado">Cargando recibos…</p>;

  const puedeRevisar = puede(perfil.role, 'ReviewLedger');

  /* Traduce el UUID del método a su etiqueta pública; si la lista aún no cargó
   * o no lo contiene, se muestra el provider como respaldo. */
  const nombreMetodo = (id: string) =>
    metodos?.find((metodo) => metodo.id === id)?.public_label ?? 'Método';

  return (
    <div>
      <h2>Recibos de pago</h2>
      {!puedeRevisar && (
        <p className="panelEstado">Tu rol puede consultar, pero no revisar recibos.</p>
      )}
      <div className="panelFiltros" role="group" aria-label="Filtros de recibos">
        <label>
          Estado
          <select
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value as typeof filtroEstado)}
          >
            <option value="todos">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO) as ReciboPago['status'][]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO[estado]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Método
          <select
            value={filtroMetodo}
            onChange={(evento) => setFiltroMetodo(evento.target.value)}
          >
            <option value="todos">Todos</option>
            {metodos?.map((metodo) => (
              <option key={metodo.id} value={metodo.id}>
                {metodo.public_label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {paginaVisibles.length === 0 ? (
        <p className="panelEstado">No hay recibos que coincidan con los filtros.</p>
      ) : (
        <table className="panelTabla">
          <thead>
            <tr>
              <th>Donante</th>
              <th>Método</th>
              <th>Referencia</th>
              <th>Comprobante</th>
              <th>Monto</th>
              <th>Estado</th>
              {puedeRevisar && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {paginaVisibles.map((recibo) => (
              <tr key={recibo.id}>
                <td>{recibo.donor_name ?? '—'}</td>
                <td>{nombreMetodo(recibo.payment_method_id)}</td>
                <td>{recibo.provider_reference ?? '—'}</td>
                <td>
                  {recibo.proof_url ? (
                    /* proof_url es relativa (/uploads/...); el proxy de Vite la
                     * resuelve contra el backend en desarrollo y en producción
                     * ambos se sirven desde el mismo origen. */
                    <button
                      type="button"
                      className="botonVerComprobante"
                      aria-label="Ver comprobante"
                      title="Ver comprobante"
                      onClick={() =>
                        setImagenActiva({
                          src: recibo.proof_url as string,
                          alt: `Comprobante de ${recibo.donor_name ?? 'la donación'}`,
                        })
                      }
                    >
                      Ver
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {(recibo.amount_minor / 100).toLocaleString('en-US', {
                    style: 'currency',
                    currency: recibo.currency,
                  })}
                </td>
                <td>
                  <span className={`panelEstadoChip panelEstadoChip--${recibo.status}`}>
                    {ETIQUETAS_ESTADO[recibo.status]}
                  </span>
                </td>
                {puedeRevisar && (
                  <td>
                    {recibo.status === 'pending_verification' && (
                      <div className="panelMetodosAcciones">
                        <button
                          type="button"
                          className="botonIcono"
                          aria-label="Aprobar recibo"
                          title="Aprobar"
                          onClick={() => revisar(recibo, 'approved')}
                        >
                          <IconoAccion nombre="aprobar" />
                        </button>
                        <button
                          type="button"
                          className="botonIcono botonIcono--peligro"
                          aria-label="Rechazar recibo"
                          title="Rechazar"
                          onClick={() => revisar(recibo, 'rejected')}
                        >
                          <IconoAccion nombre="rechazar" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <PaginadorTabla pagina={pagina} totalPaginas={totalPaginas} alCambiar={irAPagina} />
      <ModalImagen imagen={imagenActiva} alCerrar={() => setImagenActiva(null)} />
    </div>
  );
}

export default VistaRecibos;
