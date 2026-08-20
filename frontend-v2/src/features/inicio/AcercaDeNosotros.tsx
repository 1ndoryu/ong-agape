import { useState } from 'react';
import ModalImagen from '../../components/ui/ModalImagen';
import './AcercaDeNosotros.css';

const FOTOS_ACERCA = [
  { src: '/imagenes/01.webp', alt: 'Fotografía de una actividad de El Proyecto Ágape' },
  { src: '/imagenes/02.webp', alt: 'Fotografía de una actividad de El Proyecto Ágape' },
  { src: '/imagenes/03.webp', alt: 'Fotografía de una actividad de El Proyecto Ágape' },
];

function AcercaDeNosotros() {
  const [imagenActiva, setImagenActiva] = useState<(typeof FOTOS_ACERCA)[number] | null>(null);

  return (
    <section className="acercaDeNosotros contenedor" id="nosotros">
      <p className="etiquetaAcerca">Nuestra historia</p>
      <p className="textoAcerca">
        El Proyecto Ágape es una organización que nace en Venezuela con un propósito claro:
        transformar la solidaridad en ayuda cercana, digna y transparente. Acompañamos a
        familias y comunidades, articulamos voluntades y creemos que cada encuentro abre
        oportunidades para escuchar, acompañar y construir un futuro mejor.
      </p>

      <div className="galeriaAcerca">
        {FOTOS_ACERCA.map((foto, indice) => (
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
