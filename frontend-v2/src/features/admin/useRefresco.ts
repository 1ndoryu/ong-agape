import { useEffect, useRef } from 'react';

/* Refresco periódico de una vista del panel. Repite `refrescar` cada
 * intervaloMs mientras la pestaña esté visible (document.visibilityState) y
 * vuelve a cargar al recuperar la visibilidad, para que los cambios hechos por
 * otros administradores o por donaciones externas aparezcan sin recargar la
 * página. La función se guarda en un ref para que el intervalo llame siempre a
 * la última versión sin recrearse en cada render. */
export function useRefresco(refrescar: () => void, intervaloMs: number): void {
  const refrescarRef = useRef(refrescar);
  refrescarRef.current = refrescar;

  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') refrescarRef.current();
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') refrescarRef.current();
    }, intervaloMs);
    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.clearInterval(intervalo);
    };
  }, [intervaloMs]);
}
