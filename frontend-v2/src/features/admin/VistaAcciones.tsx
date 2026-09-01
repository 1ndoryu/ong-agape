import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  adminGet,
  borrarEntradaFondo,
  guardarEntradaFondo,
  publicarEntrada,
  subirImagenContenido,
  type EntradaFondoAdmin,
} from './apiAdmin';
import { puede, type CapacidadAdmin } from './permisos';
import type { RolAdmin } from './apiAdmin';
import AlertaPanel from '../../components/ui/AlertaPanel';
import IconoAccion from '../../components/ui/IconoAccion';
import { useToast } from '../../components/ui/Toast';
import { useConfirmar } from '../../components/ui/Confirmar';
import { useRefresco } from './useRefresco';
import './PanelAdmin.css';

/* Número máximo de imágenes por acción de transparencia (igual que la
 * sección "Nuestra historia"). El backend valida la lista de URLs. */
const NUMERO_IMAGENES = 3;

/* Libera las object URLs de las vistas previas locales. Se llama al
 * reemplazar un archivo, al reabrir el modal y al desmontar, para no
 * filtrar memoria. */
function revocarVistasPrevias(vistas: (string | null)[]): void {
  for (const url of vistas) {
    if (url) URL.revokeObjectURL(url);
  }
}

/* Gestión de la rendición de cuentas pública: cada gasto publicado puede
 * llevar una narrativa ("qué se hizo con el dinero") y hasta 3 imágenes de
 * evidencia. Se edita desde el modal: primero se suben los archivos nuevos y
 * luego se guarda la entrada con todas las URLs; si una subida falla, nada
 * se persiste. Publicar/despublicar la entrada controla si la acción
 * aparece en la página pública /acciones y en la sección de /donar. */
function VistaAcciones({ perfil, token }: { perfil: { role: RolAdmin }; token: string }) {
  const [entradas, setEntradas] = useState<EntradaFondoAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<EntradaFondoAdmin | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  /* Campos del formulario del modal. */
  const [concept, setConcept] = useState('');
  const [campaign, setCampaign] = useState('');
  const [amountMinor, setAmountMinor] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [occurredOn, setOccurredOn] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urlsImagen, setUrlsImagen] = useState<string[]>(Array(NUMERO_IMAGENES).fill(''));
  const [archivosNuevos, setArchivosNuevos] = useState<(File | null)[]>(
    Array(NUMERO_IMAGENES).fill(null),
  );
  const [vistasPrevias, setVistasPrevias] = useState<(string | null)[]>(
    Array(NUMERO_IMAGENES).fill(null),
  );
  const vistasPreviasRef = useRef(vistasPrevias);
  const entradasRef = useRef<Array<HTMLInputElement | null>>([]);
  const [guardando, setGuardando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirmar();

  const cargar = () => {
    adminGet<EntradaFondoAdmin[]>('/transparency/entries', token)
      .then(setEntradas)
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar las entradas'),
      );
  };

  useEffect(cargar, [token]);

  /* Refresco automático: recarga la lista cada 30 s mientras la pestaña esté
   * visible, para reflejar cambios hechos por otros administradores sin
   * recargar la página. Los errores silenciosos del refresco no ensucian la
   * vista si el primer fetch ya cargó. */
  useRefresco(cargar, 30_000);

  /* Mantiene la última lista de vistas previas en un ref para poder liberarlas
   * todas al desmontar, aunque el estado haya cambiado. */
  useEffect(() => {
    vistasPreviasRef.current = vistasPrevias;
  }, [vistasPrevias]);

  useEffect(() => () => revocarVistasPrevias(vistasPreviasRef.current), []);

  useEffect(() => {
    if (!modalAbierto) return;
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setModalAbierto(false);
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [modalAbierto]);

  const abrirEditar = (entrada: EntradaFondoAdmin) => {
    setEditando(entrada);
    setConcept(entrada.concept);
    setCampaign(entrada.campaign ?? '');
    setAmountMinor(String((entrada.amount_minor / 100).toFixed(2)));
    setCurrency(entrada.currency);
    setOccurredOn(entrada.occurred_on);
    setDescripcion(entrada.description ?? '');
    const imagenes = Array(NUMERO_IMAGENES)
      .fill('')
      .map((_, indice) => (entrada.images[indice] ?? ''));
    setUrlsImagen(imagenes);
    setArchivosNuevos(Array(NUMERO_IMAGENES).fill(null));
    revocarVistasPrevias(vistasPreviasRef.current);
    setVistasPrevias(Array(NUMERO_IMAGENES).fill(null));
    setModalAbierto(true);
  };

  const alElegirArchivo = (indice: number) => (archivo: File | null) => {
    setArchivosNuevos((previos) => previos.map((anterior, i) => (i === indice ? archivo : anterior)));
    setVistasPrevias((previas) => {
      const nuevas = [...previas];
      if (nuevas[indice]) URL.revokeObjectURL(nuevas[indice]);
      nuevas[indice] = archivo ? URL.createObjectURL(archivo) : null;
      return nuevas;
    });
  };

  const quitarImagen = (indice: number) => {
    alElegirArchivo(indice)(null);
    setUrlsImagen((previas) => previas.map((anterior, i) => (i === indice ? '' : anterior)));
  };

  const abrirSelector = (indice: number) => entradasRef.current[indice]?.click();

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!editando) return;
    setError(null);
    const monto = Number(amountMinor);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('El monto debe ser un número mayor que cero.');
      return;
    }
    setGuardando(true);
    try {
      /* Primero se suben los archivos nuevos y luego se guarda la entrada con
       * todas las URLs. Si una subida falla, nada se persiste. */
      const urlsFinales = [...urlsImagen];
      for (let indice = 0; indice < NUMERO_IMAGENES; indice += 1) {
        const archivo = archivosNuevos[indice];
        if (archivo) {
          urlsFinales[indice] = await subirImagenContenido(token, archivo);
        }
      }
      await guardarEntradaFondo(token, editando.id, {
        concept: concept.trim(),
        campaign: campaign.trim() || null,
        amount_minor: Math.round(monto * 100),
        currency: currency.trim(),
        occurred_on: occurredOn,
        description: descripcion.trim() || null,
        images: urlsFinales.filter((url) => url.length > 0),
      });
      mostrarToast('Acción guardada.');
      setModalAbierto(false);
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo guardar la acción');
    } finally {
      setGuardando(false);
    }
  };

  const publicar = async (entrada: EntradaFondoAdmin) => {
    setError(null);
    const publicada = entrada.status === 'published';
    const confirmacion = publicada
      ? '¿Dejar de mostrar esta acción en la página pública?'
      : '¿Publicar esta acción? Aparecerá en /acciones y en /donar.';
    const aceptado = await confirmar({
      titulo: publicada ? 'Ocultar acción' : 'Publicar acción',
      mensaje: confirmacion,
      textoConfirmar: publicada ? 'Ocultar' : 'Publicar',
    });
    if (!aceptado) return;
    setPublicando(true);
    try {
      await publicarEntrada(token, entrada.id, !publicada);
      mostrarToast(publicada ? 'Acción oculta de la página pública.' : 'Acción publicada.');
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo cambiar el estado');
    } finally {
      setPublicando(false);
    }
  };

  /* Elimina una entrada del libro (acción de transparencia). La confirmación
   * evita borrados por accidente; el backend audita el concepto eliminado. */
  const eliminar = async (entrada: EntradaFondoAdmin) => {
    setError(null);
    const aceptado = await confirmar({
      titulo: 'Eliminar acción',
      mensaje: `¿Eliminar "${entrada.concept}"? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
    });
    if (!aceptado) return;
    try {
      await borrarEntradaFondo(token, entrada.id);
      mostrarToast('Acción eliminada.');
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo eliminar la acción');
    }
  };

  if (!puede(perfil.role, 'WriteLedger' satisfies CapacidadAdmin)) {
    return (
      <p className="panelEstado">
        Tu rol puede consultar el panel, pero no administrar la rendición de cuentas.
      </p>
    );
  }

  if (entradas === null && !error) {
    return <p className="panelEstado">Cargando acciones…</p>;
  }

  const gastos = (entradas ?? []).filter((entrada) => entrada.entry_type === 'expense');

  return (
    <div>
      <div className="panelCabeceraSeccion">
        <h2>Acciones de transparencia</h2>
      </div>
      <p className="panelDescripcionSeccion">
        Cada gasto publicado puede contar qué se hizo con el dinero y mostrar
        evidencias. Edita la entrada para añadir su narrativa e imágenes, y
        publícala para que aparezca en /acciones y en /donar.
      </p>
      {error && <AlertaPanel tipo="error">{error}</AlertaPanel>}

      {gastos.length === 0 ? (
        <p className="panelEstado">No hay gastos registrados todavía.</p>
      ) : (
        <table className="panelTabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((entrada) => (
              <tr key={entrada.id}>
                <td>{entrada.occurred_on}</td>
                <td>
                  {entrada.concept}
                  {entrada.description ? (
                    <span className="panelFilaDetalle">Con narrativa e imágenes</span>
                  ) : (
                    <span className="panelFilaDetalle">Sin narrativa aún</span>
                  )}
                </td>
                <td>
                  {(entrada.amount_minor / 100).toLocaleString('en-US', {
                    style: 'currency',
                    currency: entrada.currency,
                  })}
                </td>
                <td>
                  <span className={`panelEstadoChip panelEstadoChip--${entrada.status}`}>
                    {entrada.status === 'published' ? 'Publicado' : 'Borrador'}
                  </span>
                </td>
                <td>
                  <div className="panelFilaAcciones">
                    <button
                      type="button"
                      className="botonIcono"
                      aria-label={`Editar ${entrada.concept}`}
                      title="Editar"
                      onClick={() => abrirEditar(entrada)}
                      disabled={publicando}
                    >
                      <IconoAccion nombre="editar" />
                    </button>
                    <button
                      type="button"
                      className="botonIcono"
                      aria-label={entrada.status === 'published' ? `Ocultar ${entrada.concept}` : `Publicar ${entrada.concept}`}
                      title={entrada.status === 'published' ? 'Ocultar' : 'Publicar'}
                      onClick={() => publicar(entrada)}
                      disabled={publicando}
                    >
                      <IconoAccion nombre={entrada.status === 'published' ? 'ocultar' : 'publicar'} />
                    </button>
                    <button
                      type="button"
                      className="botonIcono iconoPeligro"
                      aria-label={`Eliminar ${entrada.concept}`}
                      title="Eliminar"
                      onClick={() => eliminar(entrada)}
                      disabled={publicando}
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

      {modalAbierto && editando && (
        <div
          className="panelModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tituloModalAccion"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setModalAbierto(false);
          }}
        >
          <div className="panelModalContenido">
            <div className="panelModalCabecera">
              <h3 id="tituloModalAccion">Editar acción</h3>
              <button
                type="button"
                className="panelModalCerrar"
                aria-label="Cerrar"
                onClick={() => setModalAbierto(false)}
              >
                ×
              </button>
            </div>
            <form className="panelFormulario" onSubmit={guardar}>
              <label>
                Concepto
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={concept}
                  onChange={(evento) => setConcept(evento.target.value)}
                />
              </label>
              <label>
                Campaña (opcional)
                <input
                  type="text"
                  maxLength={255}
                  value={campaign}
                  onChange={(evento) => setCampaign(evento.target.value)}
                />
              </label>
              <div className="panelFormularioFila">
                <label>
                  Monto
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amountMinor}
                    onChange={(evento) => setAmountMinor(evento.target.value)}
                  />
                </label>
                <label>
                  Moneda
                  <select
                    value={currency}
                    onChange={(evento) => setCurrency(evento.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="VES">VES</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>
              <label>
                Fecha
                <input
                  type="date"
                  required
                  value={occurredOn}
                  onChange={(evento) => setOccurredOn(evento.target.value)}
                />
              </label>
              <label>
                Narrativa (qué se hizo con el dinero)
                <textarea
                  maxLength={5000}
                  rows={4}
                  value={descripcion}
                  onChange={(evento) => setDescripcion(evento.target.value)}
                  placeholder="Ej.: Con esta donación cubrimos la comida de la sopa comunitaria de la semana…"
                />
              </label>

              <h3>Evidencias (hasta {NUMERO_IMAGENES})</h3>
              <div className="panelImagenesGrid">
                {Array.from({ length: NUMERO_IMAGENES }, (_, indice) => (
                  <div key={indice} className="panelImagenCuadro">
                    {(vistasPrevias[indice] ?? urlsImagen[indice]) ? (
                      <img
                        src={vistasPrevias[indice] ?? urlsImagen[indice]}
                        alt={`Evidencia ${indice + 1}`}
                      />
                    ) : (
                      <span className="panelImagenVacio">Sin imagen</span>
                    )}
                    <div className="panelImagenAcciones">
                      <button
                        type="button"
                        onClick={() => abrirSelector(indice)}
                      >
                        {urlsImagen[indice] || archivosNuevos[indice] ? 'Cambiar' : 'Subir'}
                      </button>
                      {(urlsImagen[indice] || archivosNuevos[indice]) && (
                        <button type="button" onClick={() => quitarImagen(indice)}>
                          Quitar
                        </button>
                      )}
                    </div>
                    <input
                      ref={(elemento) => {
                        entradasRef.current[indice] = elemento;
                      }}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(evento) => alElegirArchivo(indice)(evento.target.files?.[0] ?? null)}
                    />
                  </div>
                ))}
              </div>

              <div className="panelModalAcciones">
                <button type="button" className="panelModalCancelar" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="panelModalGuardar" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VistaAcciones;
