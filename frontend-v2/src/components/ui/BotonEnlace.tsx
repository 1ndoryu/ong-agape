import type { ReactNode } from 'react';
import './BotonEnlace.css';

interface PropiedadesBotonEnlace {
  children: ReactNode;
  href: string;
  variante?: 'principal' | 'contorno';
  className?: string;
}

function BotonEnlace({ children, href, variante = 'principal', className }: PropiedadesBotonEnlace) {
  return (
    <a className={`botonEnlace botonEnlace--${variante} ${className ?? ''}`.trim()} href={href}>
      {children}
    </a>
  );
}

export default BotonEnlace;
