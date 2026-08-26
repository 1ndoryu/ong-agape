import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  guardarContenido,
  obtenerContenido,
  publicarContenido,
  subirImagenContenido,
  type ContenidoAdmin,
} from './apiAdmin';
import { puede, type CapacidadAdmin } from './permisos';
import type { RolAdmin } from './apiAdmin';
import AlertaPanel from '../../components/ui/AlertaPanel';
import { useToast } from '../../components/ui/Toast';
import { useConfirmar } from '../../components/ui/Confirmar';
import './PanelAdmin.css';

const CLAVE_HISTORIA = 'acerca_de_nosotros';
const NUMERO_IMAGENES = 3;

/* Libera las object URLs de las vistas previas locales. Se llama al
 * reemplazar un archivo, al recargar el contenido y al desmontar, para no
 * filtrar memoria. */
function revocarVistasPrevias(vistas: (string | null)[]): void {
  for (const url of vistas) {
    if (url) URL.revokeObjectURL(url);
  }
}

/* Editor de la sección "Nuestra historia" de la portada. El texto se guarda en
 * title/body del contenido y las imágenes (hasta 3) en images. Como el bloque
 * es uno solo, se edita en un formulario directo (no en un modal): se carga al
 * abrir la pestaña, se guarda como borrador y se publica para que la portada lo
 * muestre. Las fotografías se muestran en cuadros iguales a los de la portada
 * y un clic (o soltar un archivo encima) las reemplaza; solo se suben al
 * servidor al pulsar Guardar. */
function VistaHistoria({ perfil, token }: { perfil: { role: RolAdmin }; token: string }) {
  const [contenido, setContenido] = useState<ContenidoAdmin | null>(null);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [urlsImagen, setUrlsImagen] = useState<string[]>(Array(NUMERO_IMAGENES).fill(''));
  const [archivosNuevos, setArchivosNuevos] = useState<(File | null)[]>(
    Array(NUMERO_IMAGENES).fill(null),
  );
  /* Vista previa local de un archivo recién elegido (object URL), para mostrar
   * la foto nueva antes de subirla. Se revoca al reemplazarla o al desmontar. */
  const [vistasPrevias, setVistasPrevias] = useState<(string | null)[]>(
    Array(NUMERO_IMAGENES).fill(null),
  );
  const vistasPreviasRef = useRef(vistasPrevias);
  const entradasRef = useRef<Array<HTMLInputElement | null>>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirmar();

  const cargar = () => {
    obtenerContenido(token, CLAVE_HISTORIA)
      .then((datos) => {
        setContenido(datos);
        setTitulo(datos.title);
        setTexto(datos.body);
        const imagenes = Array(NUMERO_IMAGENES)
          .fill('')
          .map((_, indice) => datos.images[indice] ?? '');
        setUrlsImagen(imagenes);
        setArchivosNuevos(Array(NUMERO_IMAGENES).fill(null));
        revocarVistasPrevias(vistasPreviasRef.current);
        setVistasPrevias(Array(NUMERO_IMAGENES).fill(null));
      })
      .catch((motivo: unknown) =>
        setError(motivo instanceof Error ? motivo.message : 'No se pudo cargar la sección'),
      );
  };

  useEffect(cargar, [token]);

  /* Mantiene la última lista de vistas previas en un ref para poder liberarlas
   * todas al desmontar, aunque el estado haya cambiado. */
  useEffect(() => {
    vistasPreviasRef.current = vistasPrevias;
  }, [vistasPrevias]);

  useEffect(() => () => revocarVistasPrevias(vistasPreviasRef.current), []);

  /* Asocia un archivo elegido (o soltado) a su cuadro: guarda el archivo para
   * subirlo después y muestra una vista previa local inmediata. */
  const alElegirArchivo = (indice: number) => (archivo: File | null) => {
    setArchivosNuevos((previos) => previos.map((anterior, i) => (i === indice ? archivo : anterior)));
    setVistasPrevias((previas) => {
      const nuevas = [...previas];
      if (nuevas[indice]) URL.revokeObjectURL(nuevas[indice]);
      nuevas[indice] = archivo ? URL.createObjectURL(archivo) : null;
      return nuevas;
    });
  };

  /* Vacía una fotografía: quita el archivo elegido (y su vista previa) y la
   * URL guardada, para que el siguiente guardado la deje sin imagen. */
  const quitarImagen = (indice: number) => {
    alElegirArchivo(indice)(null);
    setUrlsImagen((previas) => previas.map((anterior, i) => (i === indice ? '' : anterior)));
  };

  const abrirSelector = (indice: number) => entradasRef.current[indice]?.click();

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    if (texto.trim().length === 0) {
      setError('El texto de la sección no puede estar vacío.');
      return;
    }
    setGuardando(true);
    try {
      /* Primero se suben los archivos nuevos y luego se guarda el contenido
       * con todas las URLs. Si una subida falla, nada se persiste. */
      const urlsFinales = [...urlsImagen];
      for (let indice = 0; indice < NUMERO_IMAGENES; indice += 1) {
        const archivo = archivosNuevos[indice];
        if (archivo) {
          urlsFinales[indice] = await subirImagenContenido(token, archivo);
        }
      }
      await guardarContenido(token, CLAVE_HISTORIA, {
        title: titulo.trim() || 'Nuestra historia',
        body: texto.trim(),
        cta_label: null,
        cta_url: null,
        images: urlsFinales,
      });
      mostrarToast('Borrador guardado. Públicalo para que se vea en la portada.');
      setArchivosNuevos(Array(NUMERO_IMAGENES).fill(null));
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo guardar la sección');
    } finally {
      setGuardando(false);
    }
  };

  const publicar = async () => {
    setError(null);
    const aceptado = await confirmar({
      titulo: 'Publicar sección',
      mensaje: '¿Publicar la sección "Nuestra historia"? Se verá en la portada.',
      textoConfirmar: 'Publicar',
    });
    if (!aceptado) return;
    setPublicando(true);
    try {
      await publicarContenido(token, CLAVE_HISTORIA);
      mostrarToast('Sección publicada. Ya se ve en la portada.');
      cargar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo publicar la sección');
    } finally {
      setPublicando(false);
    }
  };

  if (!puede(perfil.role, 'ManageContent' satisfies CapacidadAdmin)) {
    return (
      <p className="panelEstado">
        Tu rol puede consultar el panel, pero no administrar la sección.
      </p>
    );
  }

  if (contenido === null && !error) {
    return <p className="panelEstado">Cargando sección…</p>;
  }

  return (
    <div>
      <div className="panelCabeceraSeccion">
        <h2>Nuestra historia</h2>
        <div className="panelMetodosAcciones">
          <button type="button" onClick={publicar} disabled={publicando}>
            {publicando ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
      <p className="panelDescripcionSeccion">
        Texto y fotografías de la sección de la portada. Guarda un borrador y
        luego publícalo para que los visitantes lo vean.
      </p>
      {error && <AlertaPanel tipo="error">{error}</AlertaPanel>}

      <form className="panelFormulario" onSubmit={guardar}>
        <h3>Contenido</h3>
        <label>
          Título de la sección
          <input
            type="text"
            required
            maxLength={255}
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
          />
        </label>
        <label>
          Texto de la historia
          <textarea
            required
            maxLength={10_000}
            rows={7}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />
        </label>

        <h3>Fotografías (hasta 3)</h3>
        <p className="panelHistoriaAyuda">
          Haz clic en una fotografía para cambiarla o arrastra una imagen encima.
          Las guardadas se muestran tal como aparecen en la portada.
        </p>
        <div className="panelHistoriaGaleria">
          {urlsImagen.map((url, indice) => {
            const origen = vistasPrevias[indice] ?? url;
            const tieneImagen = origen.trim().length > 0;
            return (
              <div
                key={indice}
                className={`panelHistoriaCuadro panelHistoriaCuadro--color${indice + 1}${
                  tieneImagen ? '' : ' panelHistoriaCuadro--vacia'
                }`}
                role="button"
                tabIndex={0}
                onClick={() => abrirSelector(indice)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' || evento.key === ' ') {
                    evento.preventDefault();
                    abrirSelector(indice);
                  }
                }}
                onDragOver={(evento) => evento.preventDefault()}
                onDrop={(evento) => {
                  evento.preventDefault();
                  const archivo = evento.dataTransfer.files?.[0] ?? null;
                  if (archivo) alElegirArchivo(indice)(archivo);
                }}
              >
                {tieneImagen ? (
                  <img src={origen} alt={`Fotografía ${indice + 1} de la sección`} />
                ) : (
                  <span className="panelHistoriaCuadroVacia">
                    {/* Icono de subida: invita a añadir la fotografía. */}
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 16V4" />
                      <path d="M6 10l6-6 6 6" />
                      <path d="M4 20h16" />
                    </svg>
                    Añadir fotografía
                  </span>
                )}
                <input
                  ref={(elemento) => {
                    entradasRef.current[indice] = elemento;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(evento) => {
                    alElegirArchivo(indice)(evento.target.files?.[0] ?? null);
                    evento.target.value = '';
                  }}
                  aria-label={`Cambiar fotografía ${indice + 1}`}
                />
                <span className="panelHistoriaCuadroAccion" aria-hidden="true">
                  {tieneImagen ? 'Cambiar' : 'Añadir'}
                </span>
                {tieneImagen && (
                  <button
                    type="button"
                    className="panelHistoriaCuadroQuitar"
                    onClick={(evento) => {
                      evento.stopPropagation();
                      quitarImagen(indice);
                    }}
                    aria-label={`Quitar fotografía ${indice + 1}`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="panelModalAcciones">
          <button type="submit" className="panelModalGuardar" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default VistaHistoria;
