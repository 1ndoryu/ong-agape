import { useEffect, useState } from 'react';
import { adminGet, adminEscribir, type PerfilAdmin } from './apiAdmin';
import { puede } from './permisos';
import ModalEditarMetodo, { type MetodoPagoAdmin } from './ModalEditarMetodo';
import AlertaPanel from '../../components/ui/AlertaPanel';
import { useToast } from '../../components/ui/Toast';
import { useRefresco } from './useRefresco';
import './PanelAdmin.css';

/* Etiquetas legibles para cada estado; el valor crudo (setup_required, etc.)
 * no es amigable para quien administra la ONG. */
const ETIQUETAS_ESTADO: Record<MetodoPagoAdmin['status'], string> = {
  enabled: 'Habilitado',
  disabled: 'Deshabilitado',
  setup_required: 'Configuración pendiente',
};

/* Gestión de métodos de pago. El backend bloquea habilitar Zelle y proveedores
 * automáticos sin credenciales; la UI refleja ese estado con setup_required y
 * solo el rol owner puede cambiar el estado (ManagePaymentMethods). El botón
 * "Editar" abre el modal para ajustar la etiqueta, el estado y los datos de
 * pago que el donante ve en la página de donar. */
function VistaMetodos({ perfil, token }: { perfil: PerfilAdmin; token: string }) {
  const [metodos, setMetodos] = useState<MetodoPagoAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<MetodoPagoAdmin | null>(null);
  const { mostrarToast } = useToast();

  const cargar = () => {
    adminGet<MetodoPagoAdmin[]>('/payment-methods', token)
      .then(setMetodos)
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar los métodos'),
      );
  };

  useEffect(cargar, [token]);

  /* Refresco automático: recarga la lista cada 30 s mientras la pestaña esté
   * visible, para reflejar cambios hechos por otros administradores sin
   * recargar la página. */
  useRefresco(cargar, 30_000);

  const cambiarEstado = async (metodo: MetodoPagoAdmin, estado: MetodoPagoAdmin['status']) => {
    setError(null);
    try {
      await adminEscribir(`/payment-methods/${metodo.id}`, token, 'PUT', { status: estado });
      mostrarToast(`Método ${metodo.public_label} actualizado.`);
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo actualizar el método');
    }
  };

  if (error) return <AlertaPanel tipo="error">{error}</AlertaPanel>;
  if (!metodos) return <p className="panelEstado">Cargando métodos…</p>;

  const editable = puede(perfil.role, 'ManagePaymentMethods');

  return (
    <div>
      <h2>Métodos de pago</h2>
      {!editable && (
        <p className="panelEstado">Solo el rol propietario puede modificar los métodos.</p>
      )}
      <ul className="panelMetodos">
        {metodos.map((metodo) => {
          /* Detalle del adaptador automático: entorno (sandbox/live) y si está
           * listo para pagos reales (campos públicos + secretos). */
          const automatico = metodo.mode === 'automatic';
          const entorno = metodo.provider_config?.environment;
          const detalleAdaptador = automatico
            ? `${entorno === 'live' ? 'Producción' : 'Sandbox'} · ${
                metodo.ready ? 'listo para pagos' : 'falta configurar'
              }`
            : null;
          return (
            <li key={metodo.id}>
              <div>
                <div className="panelMetodosFila">
                  <strong>{metodo.public_label}</strong>
                  <span className={`panelEstadoChip panelEstadoChip--${metodo.status}`}>
                    {ETIQUETAS_ESTADO[metodo.status]}
                  </span>
                </div>
                <span className="detalleMetodo">
                  {metodo.mode === 'manual' ? 'Manual' : 'Automático'} · {metodo.provider}
                  {detalleAdaptador ? ` · ${detalleAdaptador}` : ''}
                </span>
              </div>
              {editable && (
                <div className="panelMetodosAcciones">
                  <button type="button" onClick={() => setEditando(metodo)}>
                    {automatico ? 'Configurar' : 'Editar'}
                  </button>
                  {metodo.status === 'enabled' && (
                    <button type="button" onClick={() => cambiarEstado(metodo, 'disabled')}>
                      Deshabilitar
                    </button>
                  )}
                  {metodo.status === 'disabled' && (
                    <button type="button" onClick={() => cambiarEstado(metodo, 'enabled')}>
                      Habilitar
                    </button>
                  )}
                  {metodo.status === 'setup_required' && (
                    <button type="button" onClick={() => cambiarEstado(metodo, 'disabled')}>
                      Deshabilitar
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {metodos.some(
        (metodo) => metodo.mode === 'automatic' && metodo.status === 'setup_required',
      ) && (
        <p className="panelEstado">
          Los métodos automáticos necesitan credenciales del proveedor antes de habilitarse.
        </p>
      )}
      {editando && (
        <ModalEditarMetodo
          metodo={editando}
          token={token}
          alGuardar={() => {
            mostrarToast(`Método ${editando.public_label} guardado.`);
            setEditando(null);
            cargar();
          }}
          alCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

export default VistaMetodos;
