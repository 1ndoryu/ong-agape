import { useEffect, useState } from 'react';

/* Paginación en cliente para las tablas del panel. Recibe la lista ya
 * filtrada y devuelve solo los elementos de la página actual: así no se
 * renderizan todas las filas de golpe (miles de recibos/movimientos), sino
 * únicamente la página visible. Si la lista cambia (filtros o recarga) y la
 * página queda fuera de rango, se reajusta automáticamente. */
export function usePaginacion<T>(items: readonly T[], porPagina = 8) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const paginaSegura = Math.min(Math.max(1, pagina), totalPaginas);

  /* Si los datos se reducen (p. ej. un filtro deja 1 página), no dejar la
   * página actual apuntando a un rango vacío. */
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const inicio = (paginaSegura - 1) * porPagina;
  const visibles = items.slice(inicio, inicio + porPagina);

  return { visibles, pagina: paginaSegura, totalPaginas, irAPagina: setPagina };
}
