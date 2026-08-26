/* Iconos de acción del panel administrativo (lápiz, papelera, ojo, etc.)
 * centralizados aquí para que las tablas usen iconos en vez de texto y el
 * marcado SVG no se repita en cada vista. Cada icono es un SVG inline con
 * stroke actual heredado (currentColor) para que el color lo decida el CSS
 * del contenedor. La etiqueta accesible la pone cada botón con aria-label. */
import type { ReactNode, SVGProps } from 'react';

type NombreIcono =
  | 'editar'
  | 'eliminar'
  | 'ver'
  | 'publicar'
  | 'ocultar'
  | 'archivar'
  | 'aprobar'
  | 'rechazar'
  | 'activar'
  | 'completar'
  | 'habilitar'
  | 'deshabilitar';

interface PropiedadesIconoAccion {
  nombre: NombreIcono;
  tamano?: number;
}

const TRAZO: SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

/* Cada icono usa trazos simples de 24x24 (estilo feather/lucide). */
const TRAZOS: Record<NombreIcono, ReactNode> = {
  editar: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  eliminar: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  ver: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  publicar: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ocultar: (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </>
  ),
  archivar: (
    <>
      <path d="M22 7v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7" />
      <path d="M21 7H3l1.5-4h15Z" />
      <path d="M12 11v4" />
      <path d="M9.5 15h5" />
    </>
  ),
  aprobar: <path d="M20 6 9 17l-5-5" />,
  rechazar: (
    <>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  activar: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  completar: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  habilitar: (
    <>
      <rect x="1" y="5" width="22" height="14" rx="7" />
      <circle cx="16" cy="12" r="3" />
    </>
  ),
  deshabilitar: (
    <>
      <rect x="1" y="5" width="22" height="14" rx="7" />
      <circle cx="8" cy="12" r="3" />
    </>
  ),
};

function IconoAccion({ nombre, tamano }: PropiedadesIconoAccion) {
  return (
    <svg {...TRAZO} width={tamano ?? 18} height={tamano ?? 18}>
      {TRAZOS[nombre]}
    </svg>
  );
}

export default IconoAccion;
