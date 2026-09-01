import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  borrarArticulo,
  cambiarEstadoArticulo,
  crearArticulo,
  guardarArticulo,
  listarArticulos,
  type ArticuloAdmin,
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

type Borrador = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string;
};

const BORRADOR_VACIO: Borrador = {
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  cover_image_url: '',
};

const ESTADO_ETIQUETA: Record<ArticuloAdmin['status'], string> = {
  draft: 'borrador',
  published: 'publicado',
  archived: 'archivado',
};

/* Administración del blog para el cliente: listar, crear/editar borradores y
 * publicar. El cuerpo usa doble salto de línea para separar párrafos, igual
 * que el detalle público (HistoriaDetalle). Publicar exige rol owner en el
 * backend; editar borradores alcanza con ManageContent (owner/finance_editor). */
function VistaBlog({ perfil, token }: { perfil: { role: RolAdmin }; token: string }) {
  const [articulos, setArticulos] = useState<ArticuloAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  /* El modal se cierra sin descartar el borrador: así no se pierde lo
   * escrito si se cierra por error (X, ESC o clic fuera). */
  const [modalAbierto, setModalAbierto] = useState(false);
  /* Filtro por estado aplicado en el cliente sobre la lista ya cargada. */
  const [filtroEstado, setFiltroEstado] = useState<'todos' | ArticuloAdmin['status']>('todos');
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirmar();

  const cargar = () => {
    listarArticulos(token)
      .then(setArticulos)
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar los artículos'),
      );
  };

  useEffect(cargar, [token]);

  /* Refresco automático: recarga la lista cada 30 s mientras la pestaña esté
   * visible, para reflejar cambios hechos por otros administradores sin
   * recargar la página. */
  useRefresco(cargar, 30_000);

  /* Cerrar el modal no toca el borrador ni el modo edición: al reabrir se
   * conserva lo escrito. */
  const cerrarModal = () => {
    setModalAbierto(false);
  };

  /* ESC cierra el modal sin perder el borrador (mismo comportamiento que la X). */
  useEffect(() => {
    if (!modalAbierto) return;
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrarModal();
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [modalAbierto]);

  const empezarEditar = (articulo: ArticuloAdmin) => {
    setEditandoId(articulo.id);
    setBorrador({
      slug: articulo.slug,
      title: articulo.title,
      excerpt: articulo.excerpt,
      body: articulo.body.replace(/\\n/g, '\n'),
      cover_image_url: articulo.cover_image_url ?? '',
    });
    setModalAbierto(true);
  };

  /* "Nuevo artículo" solo abre el modal sin tocar el borrador: cerrar y
   * reabrir conserva lo escrito, que es el comportamiento pedido. El borrador
   * se descarta únicamente al guardar con éxito. */
  const abrirNuevo = () => {
    setEditandoId(null);
    setModalAbierto(true);
  };

  const cancelar = () => {
    setEditandoId(null);
    setBorrador(BORRADOR_VACIO);
  };

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    const datos = {
      slug: borrador.slug.trim(),
      title: borrador.title.trim(),
      excerpt: borrador.excerpt.trim(),
      body: borrador.body,
      cover_image_url: borrador.cover_image_url.trim() || null,
    };
    try {
      if (editandoId) {
        await guardarArticulo(token, editandoId, datos);
        mostrarToast('Borrador guardado.');
      } else {
        await crearArticulo(token, datos);
        mostrarToast('Artículo creado como borrador.');
      }
      cancelar();
      setModalAbierto(false);
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo guardar el artículo');
    }
  };

  /* Publicar directo desde el modal: primero se crea/guarda el borrador y, si
   * el rol lo permite (owner en el backend), se cambia el estado a published
   * en la misma acción. Así el cliente no tiene que crear y luego publicar. */
  const guardarYPublicar = async () => {
    setError(null);
    const datos = {
      slug: borrador.slug.trim(),
      title: borrador.title.trim(),
      excerpt: borrador.excerpt.trim(),
      body: borrador.body,
      cover_image_url: borrador.cover_image_url.trim() || null,
    };
    try {
      const articulo = editandoId
        ? await guardarArticulo(token, editandoId, datos)
        : await crearArticulo(token, datos);
      await cambiarEstadoArticulo(token, articulo.id, 'published');
      mostrarToast('Artículo publicado.');
      cancelar();
      setModalAbierto(false);
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo publicar el artículo');
    }
  };

  const cambiarEstado = async (articulo: ArticuloAdmin, estado: ArticuloAdmin['status']) => {
    setError(null);
    try {
      await cambiarEstadoArticulo(token, articulo.id, estado);
      mostrarToast(`Artículo ${ESTADO_ETIQUETA[estado]}.`);
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo cambiar el estado');
    }
  };

  /* Elimina un artículo del blog (borrador, publicado o archivado). La
   * confirmación evita borrados por accidente; el backend audita el título. */
  const eliminar = async (articulo: ArticuloAdmin) => {
    setError(null);
    const aceptado = await confirmar({
      titulo: 'Eliminar artículo',
      mensaje: `¿Eliminar "${articulo.title}"? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
    });
    if (!aceptado) return;
    try {
      await borrarArticulo(token, articulo.id);
      mostrarToast('Artículo eliminado.');
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo eliminar el artículo');
    }
  };

  /* Filtro por estado aplicado en el cliente; luego la lista filtrada se
   * pagina para no renderizar todos los artículos de golpe. Si los datos aún
   * no cargaron (null), se pagina sobre una lista vacía. El hook se llama
   * siempre (antes de los early returns) para respetar las Reglas de los Hooks. */
  const filtrados = (articulos ?? []).filter(
    (articulo) => filtroEstado === 'todos' || articulo.status === filtroEstado,
  );
  const { visibles: paginaVisibles, pagina, totalPaginas, irAPagina } = usePaginacion(filtrados);

  if (!puede(perfil.role, 'ManageContent' satisfies CapacidadAdmin)) {
    return (
      <p className="panelEstado">
        Tu rol puede consultar el panel, pero no administrar el blog.
      </p>
    );
  }

  if (articulos === null) {
    return <p className="panelEstado">{error ?? 'Cargando artículos…'}</p>;
  }

  return (
    <div>
      {/* El título y la acción quedan en la misma fila: h2 a la izquierda,
       * botón anclado al final de la derecha. */}
      <div className="panelCabeceraSeccion">
        <h2>Blog</h2>
        <button type="button" onClick={abrirNuevo}>
          Nuevo artículo
        </button>
      </div>
      {error && <AlertaPanel tipo="error">{error}</AlertaPanel>}

      <div className="panelFiltros" role="group" aria-label="Filtros de artículos">
        <label>
          Estado
          <select
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value as typeof filtroEstado)}
          >
            <option value="todos">Todos</option>
            {(Object.keys(ESTADO_ETIQUETA) as ArticuloAdmin['status'][]).map((estado) => (
              <option key={estado} value={estado}>
                {ESTADO_ETIQUETA[estado]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtrados.length === 0 ? (
        <p className="panelEstado">Todavía no hay artículos.</p>
      ) : (
        <table className="panelTabla">
          <thead>
            <tr>
              <th>Título</th>
              <th>Slug</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginaVisibles.map((articulo) => (
              <tr key={articulo.id}>
                <td>{articulo.title}</td>
                <td>
                  {articulo.status === 'published' ? (
                    <Link to={`/blog/${articulo.slug}`}>{articulo.slug}</Link>
                  ) : (
                    articulo.slug
                  )}
                </td>
                <td>
                  <span className={`panelEstadoChip panelEstadoChip--${articulo.status}`}>
                    {ESTADO_ETIQUETA[articulo.status]}
                  </span>
                </td>
                <td>
                  <div className="panelMetodosAcciones">
                    <button
                      type="button"
                      className="botonIcono"
                      aria-label={`Editar ${articulo.title}`}
                      title="Editar"
                      onClick={() => empezarEditar(articulo)}
                    >
                      <IconoAccion nombre="editar" />
                    </button>
                    {articulo.status !== 'published' && (
                      <button
                        type="button"
                        className="botonIcono"
                        aria-label={`Publicar ${articulo.title}`}
                        title="Publicar"
                        onClick={() => cambiarEstado(articulo, 'published')}
                      >
                        <IconoAccion nombre="publicar" />
                      </button>
                    )}
                    {articulo.status === 'published' && (
                      <button
                        type="button"
                        className="botonIcono"
                        aria-label={`Archivar ${articulo.title}`}
                        title="Archivar"
                        onClick={() => cambiarEstado(articulo, 'archived')}
                      >
                        <IconoAccion nombre="archivar" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="botonIcono iconoPeligro"
                      aria-label={`Eliminar ${articulo.title}`}
                      title="Eliminar"
                      onClick={() => eliminar(articulo)}
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
          aria-labelledby="tituloModalBlog"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) cerrarModal();
          }}
        >
          <div className="panelModalContenido">
            <div className="panelModalCabecera">
              <h3 id="tituloModalBlog">{editandoId ? 'Editar artículo' : 'Nuevo artículo'}</h3>
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
              <div className="panelFormularioFila">
                <label>
                  Título
                  <input
                    type="text"
                    required
                    maxLength={255}
                    autoFocus
                    value={borrador.title}
                    onChange={(evento) => setBorrador({ ...borrador, title: evento.target.value })}
                  />
                </label>
                <label>
                  Slug
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={borrador.slug}
                    onChange={(evento) => setBorrador({ ...borrador, slug: evento.target.value })}
                  />
                </label>
              </div>
              <label>
                Resumen
                <textarea
                  rows={2}
                  maxLength={500}
                  value={borrador.excerpt}
                  onChange={(evento) => setBorrador({ ...borrador, excerpt: evento.target.value })}
                />
              </label>
              <label>
                Contenido
                <textarea
                  rows={8}
                  maxLength={50_000}
                  placeholder="Separa los párrafos con una línea en blanco."
                  value={borrador.body}
                  onChange={(evento) => setBorrador({ ...borrador, body: evento.target.value })}
                />
              </label>
              <label>
                Imagen de portada (URL) <span className="panelOpcional">(opcional)</span>
                <input
                  type="url"
                  value={borrador.cover_image_url}
                  onChange={(evento) =>
                    setBorrador({ ...borrador, cover_image_url: evento.target.value })
                  }
                />
              </label>
              <div className="panelMetodosAcciones">
                <button type="submit">{editandoId ? 'Guardar borrador' : 'Crear borrador'}</button>
                {puede(perfil.role, 'ManageContent') && (
                  <button type="button" onClick={guardarYPublicar}>
                    Guardar y publicar
                  </button>
                )}
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

export default VistaBlog;
