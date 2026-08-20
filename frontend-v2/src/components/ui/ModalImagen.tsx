import { useEffect } from 'react';
import './ModalImagen.css';

interface ImagenModal {
  src: string;
  alt: string;
}

interface Props {
  imagen: ImagenModal | null;
  alCerrar: () => void;
}

function ModalImagen({ imagen, alCerrar }: Props) {
  useEffect(() => {
    if (!imagen) return;

    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alPresionarTecla);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      document.body.style.overflow = '';
    };
  }, [imagen, alCerrar]);

  if (!imagen) return null;

  return (
    <div
      className="modalImagen"
      role="dialog"
      aria-modal="true"
      aria-label={imagen.alt}
      onClick={alCerrar}
    >
      <div
        className="modalImagenContenido"
        onClick={(evento) => evento.stopPropagation()}
      >
        <button
          type="button"
          className="modalImagenCerrar"
          onClick={alCerrar}
          aria-label="Cerrar imagen"
        >
          ×
        </button>
        <img src={imagen.src} alt={imagen.alt} />
      </div>
    </div>
  );
}

export default ModalImagen;
