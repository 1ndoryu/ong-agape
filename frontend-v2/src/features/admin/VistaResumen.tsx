import { useEffect, useState } from 'react';
import { adminGet } from './apiAdmin';
import PaginadorTabla from './PaginadorTabla';
import { usePaginacion } from './usePaginacion';
import AlertaPanel from '../../components/ui/AlertaPanel';
import { useRefresco } from './useRefresco';
import './PanelAdmin.css';

export type EntradaFondo = {
  id: string;
  entry_type: 'income' | 'expense';
  concept: string;
  campaign: string | null;
  amount_minor: number;
  currency: string;
  status: 'draft' | 'pending' | 'verified' | 'published' | 'rejected';
  occurred_on: string;
};

/* Nombre legible para cada estado del libro; el valor crudo no es amigable
 * para quien administra la ONG. */
const ETIQUETAS_ESTADO: Record<EntradaFondo['status'], string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  verified: 'Verificado',
  published: 'Publicado',
  rejected: 'Rechazado',
};

/* Resumen inicial del panel: totales del libro y últimos movimientos con su
 * estado. Es la vista de solo lectura disponible para todos los roles.
 * Los filtros (tipo y estado) se aplican en el cliente sobre la lista
 * cargada, sin pedir más datos al backend. */
function VistaResumen({ token }: { token: string }) {
  const [entradas, setEntradas] = useState<EntradaFondo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | EntradaFondo['entry_type']>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EntradaFondo['status']>('todos');

  const cargar = () => {
    adminGet<EntradaFondo[]>('/transparency/entries', token)
      .then(setEntradas)
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudo cargar el resumen'),
      );
  };

  /* Carga inicial y refresco automático cada 30 s mientras la pestaña esté
   * visible: los movimientos pueden cambiar por donaciones o por la revisión
   * de recibos en otra sesión. */
  useEffect(cargar, [token]);
  useRefresco(cargar, 30_000);

  /* Los filtros se combinan (tipo Y estado); con "todos" se omite esa
   * condición. Así el admin afina la lista sin recargar datos. Si los datos
   * aún no cargaron (null), se pagina sobre una lista vacía. El hook se llama
   * siempre (antes de los early returns) para respetar las Reglas de los Hooks. */
  const visibles = (entradas ?? []).filter(
    (entrada) =>
      (filtroTipo === 'todos' || entrada.entry_type === filtroTipo) &&
      (filtroEstado === 'todos' || entrada.status === filtroEstado),
  );

  /* Paginación en cliente sobre la lista ya filtrada: solo se renderizan los
   * movimientos de la página actual. */
  const { visibles: paginaVisibles, pagina, totalPaginas, irAPagina } = usePaginacion(visibles);

  if (error) return <AlertaPanel tipo="error">{error}</AlertaPanel>;
  if (!entradas) return <p className="panelEstado">Cargando movimientos…</p>;

  return (
    <div>
      <h2>Últimos movimientos</h2>
      <div className="panelFiltros" role="group" aria-label="Filtros de movimientos">
        <label>
          Tipo
          <select
            value={filtroTipo}
            onChange={(evento) => setFiltroTipo(evento.target.value as typeof filtroTipo)}
          >
            <option value="todos">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
          </select>
        </label>
        <label>
          Estado
          <select
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value as typeof filtroEstado)}
          >
            <option value="todos">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO) as EntradaFondo['status'][]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO[estado]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {paginaVisibles.length === 0 ? (
        <p className="panelEstado">No hay movimientos que coincidan con los filtros.</p>
      ) : (
        <table className="panelTabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Tipo</th>
              <th>Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {paginaVisibles.map((entrada) => (
              <tr key={entrada.id}>
                <td>{entrada.occurred_on}</td>
                <td>{entrada.concept}</td>
                <td>{entrada.entry_type === 'income' ? 'Ingreso' : 'Gasto'}</td>
                <td>
                  {(entrada.amount_minor / 100).toLocaleString('en-US', { style: 'currency', currency: entrada.currency })}
                </td>
                <td>
                  <span className={`panelEstadoChip panelEstadoChip--${entrada.status}`}>
                    {ETIQUETAS_ESTADO[entrada.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <PaginadorTabla pagina={pagina} totalPaginas={totalPaginas} alCambiar={irAPagina} />
    </div>
  );
}

export default VistaResumen;
