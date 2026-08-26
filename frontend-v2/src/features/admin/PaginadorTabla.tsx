import './PanelAdmin.css';

/* Barra de paginación de las tablas del panel. Solo se muestra cuando hay
 * más de una página. Los botones "Anterior/Siguiente" se deshabilitan en los
 * extremos; el contador indica la página actual sobre el total. */
function PaginadorTabla({
  pagina,
  totalPaginas,
  alCambiar,
}: {
  pagina: number;
  totalPaginas: number;
  alCambiar: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  return (
    <nav className="paginadorTabla" aria-label="Paginación de la tabla">
      <button
        type="button"
        onClick={() => alCambiar(pagina - 1)}
        disabled={pagina <= 1}
        aria-label="Página anterior"
      >
        ← Anterior
      </button>
      <span className="paginadorTablaInfo">
        Página {pagina} de {totalPaginas}
      </span>
      <button
        type="button"
        onClick={() => alCambiar(pagina + 1)}
        disabled={pagina >= totalPaginas}
        aria-label="Página siguiente"
      >
        Siguiente →
      </button>
    </nav>
  );
}

export default PaginadorTabla;
