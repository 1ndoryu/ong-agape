import { useCallback, useEffect, useRef, useState } from 'react';
import { formatearMonto, type DonacionViva } from './donarApi';
import './Donar.css';

/* Carrusel infinito de donaciones en vivo. Reutiliza el patrón de Aliados:
 * la pista se divide en dos grupos idénticos y cada grupo repite la lista las
 * veces necesarias para cubrir el ancho visible; el bucle de -50% es invisible.
 * Solo se muestra el nombre de pila del donante (sin apellido), que es el dato
 * que la ONG considera público para el feed. */
/* El feed solo muestra el nombre de pila: los apellidos del donante no son
 * públicos. El backend ya devuelve nombres simplificados, pero se recorta
 * aquí por robustez ante un nombre completo. */
function primerNombre(nombre: string): string {
  return nombre.split(' ')[0] || nombre;
}

function CarruselDonaciones({ donaciones }: { donaciones: DonacionViva[] }) {
  /* Copias de la lista por mitad de la pista: mínimo 2 para que el bucle
   * -50% sea viable aunque el contenido sea estrecho. */
  const [repeticiones, setRepeticiones] = useState(2);
  const cintaRef = useRef<HTMLDivElement>(null);
  /* Ref espejo de `repeticiones` para que medirCopias (estable) pueda leer el
   * valor actual sin depender del estado en su closure. */
  const repeticionesRef = useRef(2);
  /* Ref a la pista para poder reiniciar la animación de forma explícita al
   * montar (navegación SPA): si el keyframe no estaba resuelto en el primer
   * paint o el navegador no reanuda la animación, forzar el reinicio la pone
   * en marcha. */
  const pistaRef = useRef<HTMLDivElement>(null);
  /* Id del requestAnimationFrame pendiente para cancelarlo en el cleanup y no
   * llamar a medirCopias/forzar reflow sobre un componente desmontado. */
  const rafRef = useRef(0);

  const medirCopias = useCallback(() => {
    const cinta = cintaRef.current;
    if (!cinta) return;
    const anchoVisible = cinta.clientWidth;
    const grupo = cinta.querySelector<HTMLElement>('.grupoDonaciones');
    if (!grupo) return;
    const anchoGrupo = grupo.offsetWidth;
    const actuales = repeticionesRef.current;
    if (anchoGrupo <= 0 || actuales <= 0) return;
    const anchoPorCopia = anchoGrupo / actuales;
    if (anchoPorCopia <= 0) return;
    const copias = Math.max(2, Math.ceil(anchoVisible / anchoPorCopia));
    repeticionesRef.current = copias;
    setRepeticiones(copias);
  }, []);

  useEffect(() => {
    if (donaciones.length === 0) return;
    /* La primera medición se difiere con doble requestAnimationFrame: en una
     * navegación SPA la pista puede montarse antes de que el layout (y el
     * keyframe inyectado por Vite) estén listos; medir antes de eso daría
     * clientWidth 0 y el carrusel quedaría mal dimensionado. */
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        medirCopias();
        const pista = pistaRef.current;
        if (!pista) return;
        /* Re-trigger defensivo: si la animación CSS no está corriendo (p. ej.
         * el keyframe no estaba resuelto en el primer paint al navegar en
         * SPA, o el navegador quedó con la animación en idle), se fuerza el
         * reinicio. Si ya rota no se toca nada: evita saltos visuales. */
        const animaciones = pista.getAnimations();
        const animacionPista = animaciones.find(
          (animacion) =>
            (animacion as CSSAnimation).animationName === 'desplazarDonaciones',
        );
        if (
          !animacionPista ||
          animacionPista.playState === 'idle' ||
          animacionPista.playState === 'paused'
        ) {
          pista.style.animation = 'none';
          void pista.offsetWidth;
          pista.style.animation = '';
        }
      });
      rafRef.current = raf2;
    });
    rafRef.current = raf1;
    window.addEventListener('resize', medirCopias);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', medirCopias);
    };
  }, [donaciones, medirCopias]);

  if (donaciones.length === 0) return null;

  return (
    <div className="cintaDonaciones" ref={cintaRef} aria-label="Donaciones en vivo">
      <div className="pistaDonaciones" ref={pistaRef}>
        {[0, 1].map((mitad) => (
          <div key={mitad} className="grupoDonaciones" aria-hidden={mitad === 1}>
            {Array.from({ length: repeticiones }).map((_, copia) => (
              /* display: contents para que las tarjetas sean hijos directos
               * del grupo y el gap se aplique de forma uniforme entre copias. */
              <div className="copiaDonaciones" key={copia}>
                {donaciones.map((donacion, indice) => {
                  const nombreVisible = primerNombre(donacion.donor_name);
                  return (
                    <div
                      className="vivaDonar"
                      key={`${mitad}-${copia}-${donacion.donor_name}-${indice}`}
                    >
                      <span className="avatarVivoDonar" aria-hidden="true">
                        {nombreVisible.charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <strong>{nombreVisible}</strong> donó{' '}
                        {formatearMonto(donacion.amount_minor, donacion.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CarruselDonaciones;
