import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  borrarCampana,
  cambiarEstadoCampana,
  crearCampana,
  guardarCampana,
  listarCampanas,
  type CampanaAdmin,
  type DatosCampana,
} from './apiAdmin';
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

const CAMPANA_VACIA: DatosCampana = {
  slug: '',
  name: '',
  goal_minor: 0,
  currency: 'USD',
  starts_on: new Date().toISOString().slice(0, 10),
  ends_on: null,
  description: '',
};

const ESTADO_CAMPANA_ETIQUETA: Record<CampanaAdmin['status'], string> = {
  draft: 'borrador',
  active: 'activa',
  completed: 'completada',
  archived: 'archivada',
};

/* La campaña activa define la meta de recaudación que se muestra en la página
 * de donar: `name` es el título de la meta y `goal_minor` el monto objetivo.
 * Activar/completar exige rol owner en el backend; el resto ManageContent. */
function VistaCampanas({ perfil, token }: { perfil: { role: RolAdmin }; token: string }) {
  const [campanas, setCampanas] = useState<CampanaAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<DatosCampana>(CAMPANA_VACIA);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirmar();

  const cargar = () => {
    listarCampanas(token)
      .then(setCampanas)
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar las campañas'),
      );
  };

  useEffect(cargar, [token]);

  /* Refresco automático: recarga la lista cada 30 s mientras la pestaña esté
   * visible, para reflejar cambios hechos por otros administradores sin
   * recargar la página. */
  useRefresco(cargar, 30_000);

  const cerrarModal = () => setModalAbierto(false);

  useEffect(() => {
    if (!modalAbierto) return;
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrarModal();
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [modalAbierto]);

  const empezarEditar = (campana: CampanaAdmin) => {
    setEditandoId(campana.id);
    setFormulario({
      slug: campana.slug,
      name: campana.name,
      goal_minor: campana.goal_minor,
      currency: campana.currency,
      starts_on: campana.starts_on,
      ends_on: campana.ends_on,
      description: campana.description,
    });
    setModalAbierto(true);
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    setFormulario(CAMPANA_VACIA);
    setModalAbierto(true);
  };

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    const datos: DatosCampana = {
      slug: formulario.slug.trim(),
      name: formulario.name.trim(),
      goal_minor: formulario.goal_minor,
      currency: formulario.currency.toUpperCase(),
      starts_on: formulario.starts_on,
      ends_on: formulario.ends_on || null,
      description: formulario.description.trim(),
    };
    try {
      if (editandoId) {
        await guardarCampana(token, editandoId, datos);
        mostrarToast('Campaña actualizada.');
      } else {
        await crearCampana(token, datos);
        mostrarToast('Campaña creada.');
      }
      setModalAbierto(false);
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo guardar la campaña');
    }
  };

  const cambiarEstado = async (campana: CampanaAdmin, estado: CampanaAdmin['status']) => {
    setError(null);
    try {
      await cambiarEstadoCampana(token, campana.id, estado);
      mostrarToast(`Campaña ${ESTADO_CAMPANA_ETIQUETA[estado]}.`);
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo cambiar el estado');
    }
  };

  /* Elimina una campaña. La confirmación evita borrados por accidente; el
   * backend audita el nombre. */
  const eliminar = async (campana: CampanaAdmin) => {
    setError(null);
    const aceptado = await confirmar({
      titulo: 'Eliminar campaña',
      mensaje: `¿Eliminar "${campana.name}"? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
    });
    if (!aceptado) return;
    try {
      await borrarCampana(token, campana.id);
      mostrarToast('Campaña eliminada.');
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo eliminar la campaña');
    }
  };

  /* La lista completa se pagina para no renderizar todas las campañas a la
   * vez. Si los datos aún no cargaron (null), se pagina sobre una lista vacía.
   * El hook se llama siempre (antes de los early returns) para respetar las
   * Reglas de los Hooks. */
  const { visibles: paginaVisibles, pagina, totalPaginas, irAPagina } = usePaginacion(campanas ?? []);

  if (!puede(perfil.role, 'ManageContent' satisfies CapacidadAdmin)) {
    return (
      <p className="panelEstado">
        Tu rol puede consultar el panel, pero no administrar las campañas.
      </p>
    );
  }

  if (campanas === null) {
    return <p className="panelEstado">{error ?? 'Cargando campañas…'}</p>;
  }

  const formatearMeta = (campana: CampanaAdmin) => {
    const simbolo = campana.currency === 'USD' ? 'US$' : 'Bs.';
    return `${simbolo} ${campana.goal_minor.toLocaleString('en-US')}`;
  };

  return (
    <div>
      <div className="panelCabeceraSeccion">
        <h2>Campañas</h2>
        <button type="button" onClick={abrirNuevo}>
          Nueva campaña
        </button>
      </div>
      <p className="panelDescripcionSeccion">
        La campaña en estado <strong>activa</strong> define la meta de recaudación de la página de
        donar: su nombre es el título de la meta y el monto objetivo el total a recaudar.
      </p>
      {error && <AlertaPanel tipo="error">{error}</AlertaPanel>}

      {campanas.length === 0 ? (
        <p className="panelEstado">Todavía no hay campañas.</p>
      ) : (
        <table className="panelTabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Meta</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginaVisibles.map((campana) => (
              <tr key={campana.id}>
                <td>{campana.name}</td>
                <td>{campana.slug}</td>
                <td>{formatearMeta(campana)}</td>
                <td>
                  <span className={`panelEstadoChip panelEstadoChip--${campana.status}`}>
                    {ESTADO_CAMPANA_ETIQUETA[campana.status]}
                  </span>
                </td>
                <td>
                  <div className="panelMetodosAcciones">
                    <button
                      type="button"
                      className="botonIcono"
                      aria-label={`Editar ${campana.name}`}
                      title="Editar"
                      onClick={() => empezarEditar(campana)}
                    >
                      <IconoAccion nombre="editar" />
                    </button>
                    {campana.status !== 'active' && (
                      <button
                        type="button"
                        className="botonIcono"
                        aria-label={`Activar ${campana.name}`}
                        title="Activar"
                        onClick={() => cambiarEstado(campana, 'active')}
                      >
                        <IconoAccion nombre="activar" />
                      </button>
                    )}
                    {campana.status === 'active' && (
                      <button
                        type="button"
                        className="botonIcono"
                        aria-label={`Completar ${campana.name}`}
                        title="Completar"
                        onClick={() => cambiarEstado(campana, 'completed')}
                      >
                        <IconoAccion nombre="completar" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="botonIcono botonIcono--peligro"
                      aria-label={`Eliminar ${campana.name}`}
                      title="Eliminar"
                      onClick={() => eliminar(campana)}
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

      {modalAbierto && (
        <div
          className="panelModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tituloModalCampana"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) cerrarModal();
          }}
        >
          <div className="panelModalContenido">
            <div className="panelModalCabecera">
              <h3 id="tituloModalCampana">{editandoId ? 'Editar campaña' : 'Nueva campaña'}</h3>
              <button
                type="button"
                className="panelModalCerrar"
                onClick={cerrarModal}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <form className="panelFormulario" onSubmit={guardar}>
              <label>
                Nombre (título de la meta)
                <input
                  type="text"
                  required
                  maxLength={160}
                  autoFocus
                  value={formulario.name}
                  onChange={(evento) =>
                    setFormulario({ ...formulario, name: evento.target.value })
                  }
                />
              </label>
              <div className="panelFormularioFila">
                <label>
                  Slug
                  <input
                    type="text"
                    required
                    maxLength={160}
                    pattern="[a-z0-9-]+"
                    title="Solo minúsculas, números y guiones"
                    value={formulario.slug}
                    onChange={(evento) =>
                      setFormulario({ ...formulario, slug: evento.target.value })
                    }
                  />
                </label>
                <label>
                  Moneda
                  <select
                    value={formulario.currency}
                    onChange={(evento) =>
                      setFormulario({ ...formulario, currency: evento.target.value })
                    }
                  >
                    <option value="USD">USD (US$)</option>
                    <option value="VES">VES (Bs.)</option>
                  </select>
                </label>
              </div>
              <div className="panelFormularioFila">
                <label>
                  Meta (monto objetivo)
                  <input
                    type="number"
                    required
                    min={1}
                    value={formulario.goal_minor}
                    onChange={(evento) =>
                      setFormulario({ ...formulario, goal_minor: Number(evento.target.value) })
                    }
                  />
                </label>
                <label>
                  Inicio
                  <input
                    type="date"
                    required
                    value={formulario.starts_on}
                    onChange={(evento) =>
                      setFormulario({ ...formulario, starts_on: evento.target.value })
                    }
                  />
                </label>
                <label>
                  Fin (opcional)
                  <input
                    type="date"
                    value={formulario.ends_on ?? ''}
                    onChange={(evento) =>
                      setFormulario({
                        ...formulario,
                        ends_on: evento.target.value || null,
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Descripción
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={formulario.description}
                  onChange={(evento) =>
                    setFormulario({ ...formulario, description: evento.target.value })
                  }
                />
              </label>
              <div className="panelMetodosAcciones">
                <button type="submit">{editandoId ? 'Guardar cambios' : 'Crear campaña'}</button>
                <button type="button" onClick={cerrarModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VistaCampanas;
