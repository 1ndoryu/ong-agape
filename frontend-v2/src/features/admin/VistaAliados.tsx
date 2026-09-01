import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  borrarAliado,
  crearAliado,
  guardarAliado,
  listarAliados,
  subirImagenContenido,
  type AliadoAdmin,
  type DatosAliado,
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

const ALIADO_VACIO: DatosAliado = {
  nombre: '',
  logo_url: '',
  display_order: 0,
  active: true,
};

/* Administración de los aliados del carrusel de la portada. El orden y la
 * visibilidad se controlan aquí; el público solo ve los activos (GET /api/allies). */
function VistaAliados({ perfil, token }: { perfil: { role: RolAdmin }; token: string }) {
  const [aliados, setAliados] = useState<AliadoAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<DatosAliado>(ALIADO_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  /* El logo se adjunta como archivo (igual que las evidencias de acciones):
   * se sube a /api/admin/content/image y la URL relativa resultante se guarda
   * con el aliado. `archivoNuevo` se limpia tras guardar o cancelar. */
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const entradaArchivoRef = useRef<HTMLInputElement | null>(null);
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirmar();

  const cargar = () => {
    listarAliados(token)
      .then(setAliados)
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar los aliados'),
      );
  };

  useEffect(cargar, [token]);

  /* Refresco automático: recarga la lista cada 30 s mientras la pestaña esté
   * visible, para reflejar cambios hechos por otros administradores sin
   * recargar la página. */
  useRefresco(cargar, 30_000);

  /* Igual que en el blog, cerrar el modal no descarta lo escrito: se conserva
   * al reabrir y solo se limpia tras guardar/borrar con éxito. */
  const cerrarModal = () => setModalAbierto(false);

  useEffect(() => {
    if (!modalAbierto) return;
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrarModal();
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [modalAbierto]);

  const empezarEditar = (aliado: AliadoAdmin) => {
    setEditandoId(aliado.id);
    setFormulario({
      nombre: aliado.nombre,
      logo_url: aliado.logo_url,
      display_order: aliado.display_order,
      active: aliado.active,
    });
    setArchivoNuevo(null);
    setVistaPrevia(null);
    setModalAbierto(true);
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    setFormulario(ALIADO_VACIO);
    setArchivoNuevo(null);
    setVistaPrevia(null);
    setModalAbierto(true);
  };

  /* Al elegir un archivo se muestra una vista previa local; la subida real se
   * hace al guardar para no dejar archivos huérfanos si se cancela. */
  const alElegirArchivo = (archivo: File | null) => {
    setArchivoNuevo(archivo);
    setVistaPrevia((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return archivo ? URL.createObjectURL(archivo) : null;
    });
  };

  const quitarArchivo = () => {
    alElegirArchivo(null);
    setFormulario((anterior) => ({ ...anterior, logo_url: '' }));
  };

  const abrirSelector = () => entradaArchivoRef.current?.click();

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    /* Si se adjuntó un logo nuevo, primero se sube el archivo y se usa la URL
     * relativa devuelta; si la subida falla no se persiste nada. */
    let logoUrl = formulario.logo_url.trim();
    if (archivoNuevo) {
      try {
        logoUrl = await subirImagenContenido(token, archivoNuevo);
      } catch (motivo) {
        setError(
          motivo instanceof Error
            ? `No se pudo subir el logo: ${motivo.message}`
            : 'No se pudo subir el logo',
        );
        return;
      }
    }
    if (!logoUrl) {
      setError('Adjunta una imagen para el logo o escribe una URL.');
      return;
    }
    const datos: DatosAliado = {
      nombre: formulario.nombre.trim(),
      logo_url: logoUrl,
      display_order: formulario.display_order,
      active: formulario.active,
    };
    try {
      if (editandoId) {
        await guardarAliado(token, editandoId, datos);
        mostrarToast('Aliado actualizado.');
      } else {
        await crearAliado(token, datos);
        mostrarToast('Aliado creado.');
      }
      setModalAbierto(false);
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo guardar el aliado');
    }
  };

  const eliminar = async (aliado: AliadoAdmin) => {
    setError(null);
    const aceptado = await confirmar({
      titulo: 'Eliminar aliado',
      mensaje: `¿Eliminar a "${aliado.nombre}"? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
    });
    if (!aceptado) return;
    try {
      await borrarAliado(token, aliado.id);
      mostrarToast('Aliado eliminado.');
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo eliminar el aliado');
    }
  };

  /* La lista completa se pagina para no renderizar todos los aliados a la
   * vez. Si los datos aún no cargaron (null), se pagina sobre una lista vacía.
   * El hook se llama siempre (antes de los early returns) para respetar las
   * Reglas de los Hooks. */
  const { visibles: paginaVisibles, pagina, totalPaginas, irAPagina } = usePaginacion(aliados ?? []);

  if (!puede(perfil.role, 'ManageContent' satisfies CapacidadAdmin)) {
    return (
      <p className="panelEstado">
        Tu rol puede consultar el panel, pero no administrar los aliados.
      </p>
    );
  }

  if (aliados === null) {
    return <p className="panelEstado">{error ?? 'Cargando aliados…'}</p>;
  }

  return (
    <div>
      <div className="panelCabeceraSeccion">
        <h2>Aliados</h2>
        <button type="button" onClick={abrirNuevo}>
          Nuevo aliado
        </button>
      </div>
      {error && <AlertaPanel tipo="error">{error}</AlertaPanel>}

      {aliados.length === 0 ? (
        <p className="panelEstado">Todavía no hay aliados.</p>
      ) : (
        <table className="panelTabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Logo</th>
              <th>Orden</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginaVisibles.map((aliado) => (
              <tr key={aliado.id}>
                <td>{aliado.nombre}</td>
                <td>
                  <img
                    className="panelLogoAliado"
                    src={aliado.logo_url}
                    alt=""
                    loading="lazy"
                    onError={(evento) => {
                      /* Si el logo no carga, se muestra un marcador en lugar de
                       * la imagen rota para que la fila no quede vacía. */
                      evento.currentTarget.style.display = 'none';
                    }}
                  />
                </td>
                <td>{aliado.display_order}</td>
                <td>
                  <span className={`panelEstadoChip panelEstadoChip--${aliado.active ? 'active' : 'archived'}`}>
                    {aliado.active ? 'activo' : 'inactivo'}
                  </span>
                </td>
                <td>
                  <div className="panelMetodosAcciones">
                    <button
                      type="button"
                      className="botonIcono"
                      aria-label={`Editar ${aliado.nombre}`}
                      title="Editar"
                      onClick={() => empezarEditar(aliado)}
                    >
                      <IconoAccion nombre="editar" />
                    </button>
                    <button
                      type="button"
                      className="botonIcono iconoPeligro"
                      aria-label={`Eliminar ${aliado.nombre}`}
                      title="Eliminar"
                      onClick={() => eliminar(aliado)}
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
          aria-labelledby="tituloModalAliado"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) cerrarModal();
          }}
        >
          <div className="panelModalContenido">
            <div className="panelModalCabecera">
              <h3 id="tituloModalAliado">{editandoId ? 'Editar aliado' : 'Nuevo aliado'}</h3>
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
                Nombre
                <input
                  type="text"
                  required
                  maxLength={160}
                  autoFocus
                  value={formulario.nombre}
                  onChange={(evento) =>
                    setFormulario({ ...formulario, nombre: evento.target.value })
                  }
                />
              </label>
              <label>
                Logo del aliado
                <div className="panelImagenesGrid">
                  <div className="panelImagenCuadro">
                    {(vistaPrevia ?? formulario.logo_url) ? (
                      <img
                        src={vistaPrevia ?? formulario.logo_url}
                        alt={`Logo de ${formulario.nombre || 'aliado'}`}
                      />
                    ) : (
                      <span className="panelImagenVacio">Sin logo</span>
                    )}
                    <div className="panelImagenAcciones">
                      <button type="button" onClick={abrirSelector}>
                        {formulario.logo_url || archivoNuevo ? 'Cambiar' : 'Subir'}
                      </button>
                      {(formulario.logo_url || archivoNuevo) && (
                        <button type="button" onClick={quitarArchivo}>
                          Quitar
                        </button>
                      )}
                    </div>
                    <input
                      ref={entradaArchivoRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(evento) =>
                        alElegirArchivo(evento.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                </div>
                <small className="panelAyudaCampo">
                  Adjunta una imagen (JPG, PNG o WebP, máx. 5 MB). También puedes escribir una URL
                  en el campo inferior si prefieres enlazar un logo externo.
                </small>
                <input
                  type="url"
                  maxLength={2000}
                  value={formulario.logo_url}
                  placeholder="https://ejemplo.com/logo.svg (opcional)"
                  onChange={(evento) =>
                    setFormulario({ ...formulario, logo_url: evento.target.value })
                  }
                />
              </label>
              <div className="panelFormularioFila">
                <label>
                  Orden (menor primero)
                  <input
                    type="number"
                    min={0}
                    value={formulario.display_order}
                    onChange={(evento) =>
                      setFormulario({
                        ...formulario,
                        display_order: Number(evento.target.value),
                      })
                    }
                  />
                </label>
                <label className="panelCheckbox">
                  <input
                    type="checkbox"
                    checked={formulario.active}
                    onChange={(evento) =>
                      setFormulario({ ...formulario, active: evento.target.checked })
                    }
                  />
                  Visible en la portada
                </label>
              </div>
              <div className="panelMetodosAcciones">
                <button type="submit">{editandoId ? 'Guardar cambios' : 'Crear aliado'}</button>
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

export default VistaAliados;
