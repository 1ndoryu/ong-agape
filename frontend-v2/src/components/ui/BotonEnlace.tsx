import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './BotonEnlace.css';

interface PropiedadesBotonEnlace {
  children: ReactNode;
  href: string;
  variante?: 'principal' | 'contorno';
  className?: string;
  /* Acción extra al hacer clic (p. ej. cerrar el menú móvil en la navegación
   * principal). Se pasa igual al Link interno y al <a> externo. */
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  /* Cuando la acción es una ruta interna de la app se usa Link de
   * react-router para conservar la navegación SPA; si no, <a> normal. */
  interno?: boolean;
}

function BotonEnlace({ children, href, variante = 'principal', className, onClick, interno }: PropiedadesBotonEnlace) {
  const clases = `botonEnlace botonEnlace--${variante} ${className ?? ''}`.trim();
  if (interno) {
    return (
      <Link className={clases} to={href} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a className={clases} href={href} onClick={onClick}>
      {children}
    </a>
  );
}

export default BotonEnlace;
