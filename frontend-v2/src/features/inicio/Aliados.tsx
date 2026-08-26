import { useCallback, useEffect, useRef, useState } from 'react';
import { cargarAliadosPublicos, type AliadoPublico } from './aliadosApi';
import './Aliados.css';

/* Sección de aliados con logos gestionados desde el panel. La pista se divide
 * en dos mitades idénticas (grupos) y cada mitad repite la lista de logos las
 * veces necesarias para que siempre cubra el ancho visible: así el carrusel
 * ocupa el ancho completo y el bucle de -50% no deja hueco aunque haya pocos
 * aliados. La segunda mitad es decorativa (aria-hidden) y con
 * prefers-reduced-motion solo se muestra una copia de la lista, sin animación. */
function Aliados() {
  const [aliados, setAliados] = useState<AliadoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  /* Copias de la lista por mitad de la pista: mínimo 2 para que el bucle
   * -50% sea viable aunque el contenido sea estrecho. */
  const [repeticiones, setRepeticiones] = useState(2);
  const cintaRef = useRef<HTMLDivElement>(null);
  /* Ref espejo de `repeticiones` para que medirCopias (estable) pueda leer el
   * valor actual sin depender del estado en su closure. */
  const repeticionesRef = useRef(2);
  /* Ref a la pista para reiniciar la animación explícitamente al montar en
   * navegación SPA (mismo patrón que CarruselDonaciones): garantiza que el
   * carrusel siempre arranque aunque el keyframe tardase en resolverse. */
  const pistaRef = useRef<HTMLDivElement>(null);
  /* Id del requestAnimationFrame pendiente para cancelarlo en el cleanup. */
  const rafRef = useRef(0);

  /* Mide cuántas copias de la lista hacen falta por mitad para que media
   * pista (un grupo completo con su padding final) cubra el ancho visible.
   * Se parte del ancho que aporta UNA copia (anchoGrupo / copias actuales) y
   * se calcula cuántas copias cubren el viewport; así, aunque haya pocos
   * aliados, media pista siempre es >= ancho visible y el bucle -50% no deja
   * hueco en blanco. */
  const medirCopias = useCallback(() => {
    const cinta = cintaRef.current;
    if (!cinta) return;
    const anchoVisible = cinta.clientWidth;
    const grupo = cinta.querySelector<HTMLElement>('.grupoPista');
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
    const controlador = new AbortController();
    cargarAliadosPublicos(controlador.signal)
      .then(setAliados)
      .catch((motivo: unknown) => {
        if (motivo instanceof DOMException && motivo.name === 'AbortError') return;
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar los aliados');
      });
    return () => controlador.abort();
  }, []);

  useEffect(() => {
    if (aliados.length === 0) return;
    /* La primera medición se difiere con doble requestAnimationFrame para
     * esperar al layout (y al keyframe inyectado por Vite) en navegación SPA. */
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        medirCopias();
        const pista = pistaRef.current;
        if (!pista) return;
        /* Re-trigger defensivo: solo si la animación no está corriendo (SPA
         * con keyframe no resuelto en el primer paint). Si ya rota, no se
         * toca para no producir saltos visuales. */
        const animaciones = pista.getAnimations();
        const animacionPista = animaciones.find(
          (animacion) =>
            (animacion as CSSAnimation).animationName === 'desplazarAliados',
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
  }, [aliados, medirCopias]);

  if (error || aliados.length === 0) return null;

  return (
    <section className="aliados" aria-label="Aliados">
      <p className="etiquetaAliados">Aliados</p>
      <p className="textoAliados">
        Gracias a las empresas, iglesias, organizaciones y personas que hacen
        posible cada entrega.
      </p>

      <div className="cintaAliados" ref={cintaRef}>
        <div className="pistaAliados" ref={pistaRef}>
          {[0, 1].map((mitad) => (
            <div
              key={mitad}
              className="grupoPista"
              aria-hidden={mitad === 1}
            >
              {Array.from({ length: repeticiones }).map((_, copia) => (
                /* display: contents para que los <img> sean hijos directos
                 * del grupo y el gap se aplique de forma uniforme entre
                 * copias; el contenedor solo agrupa lógicamente cada copia. */
                <div className="copiaPista" key={copia}>
                  {aliados.map((aliado) => (
                    <img
                      key={`${mitad}-${copia}-${aliado.id}`}
                      className="logoAliado"
                      src={aliado.logo_url}
                      alt={mitad === 0 && copia === 0 ? aliado.nombre : ''}
                      loading="lazy"
                      onLoad={medirCopias}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Aliados;
