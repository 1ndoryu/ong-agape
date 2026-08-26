import { useEffect, useState } from 'react';
import ModalImagen from '../../components/ui/ModalImagen';
import { cargarContenidoAcerca, type ContenidoAcerca } from './acercaApi';
import './AcercaDeNosotros.css';

/* Fallbacks usados mientras el panel no haya publicado contenido de "Nuestra
 * historia": el texto original y las tres fotos locales de la portada. */
const TEXTO_POR_DEFECTO =
  'El Proyecto Ágape es una organización que nace en Venezuela con un propósito claro: ' +
  'transformar la solidaridad en ayuda cercana, digna y transparente. Acompañamos a ' +
  'familias y comunidades, articulamos voluntades y creemos que cada encuentro abre ' +
  'oportunidades para escuchar, acompañar y construir un futuro mejor.';

const FOTOS_POR_DEFECTO = [
  { src: '/imagenes/01.webp', alt: 'Fotografía de una actividad de El Proyecto Ágape' },
  { src: '/imagenes/02.webp', alt: 'Fotografía de una actividad de El Proyecto Ágape' },
  { src: '/imagenes/03.webp', alt: 'Fotografía de una actividad de El Proyecto Ágape' },
];

/* Las imágenes publicadas desde el panel ocupan los 3 cuadros en orden; si el
 * contenido trae menos de 3, los huecos se rellenan con las fotos locales
 * para que la galería nunca quede vacía. */
function fotosDe(contenido: ContenidoAcerca | null) {
  const publicadas = (contenido?.images ?? [])
    .filter((url) => url.trim().length > 0)
    .map((src) => ({ src, alt: 'Fotografía de una actividad de El Proyecto Ágape' }));
  return [...publicadas, ...FOTOS_POR_DEFECTO].slice(0, 3);
}

function AcercaDeNosotros() {
  const [contenido, setContenido] = useState<ContenidoAcerca | null>(null);
  const [fotos, setFotos] = useState(FOTOS_POR_DEFECTO);
  const [imagenActiva, setImagenActiva] = useState<(typeof fotos)[number] | null>(null);

  useEffect(() => {
    const control = new AbortController();
    cargarContenidoAcerca(control.signal)
      .then((datos) => {
        if (!datos) return;
        setContenido(datos);
        setFotos(fotosDe(datos));
      })
      .catch((motivo: unknown) => {
        /* Si el contenido no carga (red, backend caído) se mantienen los
         * fallbacks; la sección no debe romper la portada. */
        if (motivo instanceof Error && motivo.name === 'AbortError') return;
        console.error('No se pudo cargar "Nuestra historia":', motivo);
      });
    return () => control.abort();
  }, []);

  const texto = contenido?.body.trim() || TEXTO_POR_DEFECTO;

  return (
    <section className="acercaDeNosotros contenedor" id="nosotros">
      <p className="etiquetaAcerca">{contenido?.title.trim() || 'Nuestra historia'}</p>
      <p className="textoAcerca">{texto}</p>

      <div className="galeriaAcerca">
        {fotos.map((foto, indice) => (
          <figure
            key={foto.src}
            className={`cuadroAcerca cuadroAcerca--color${indice + 1}`}
            onClick={() => setImagenActiva(foto)}
          >
            <img src={foto.src} alt={foto.alt} loading="lazy" />
          </figure>
        ))}
      </div>

      <ModalImagen imagen={imagenActiva} alCerrar={() => setImagenActiva(null)} />
    </section>
  );
}

export default AcercaDeNosotros;
