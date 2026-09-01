import type { ReactNode } from 'react';
import './AlertaPanel.css';

/* Alerta reutilizable del panel administrativo. Dos variantes:
 *   - 'aviso': mensaje informativo de éxito (verde/amarillo del diseño).
 *   - 'error': mensaje de error de una operación (rojo del diseño).
 * Centraliza el marcado y los roles ARIA para que todas las vistas hablen
 * igual: los avisos usan role="status" y los errores role="alert". */
interface PropiedadesAlertaPanel {
  tipo: 'aviso' | 'error';
  children: ReactNode;
}

function AlertaPanel({ tipo, children }: PropiedadesAlertaPanel) {
  if (tipo === 'error') {
    return (
      <p className="avisoAlerta avisoAlerta--error" role="alert">
        {children}
      </p>
    );
  }
  return (
    <p className="avisoAlerta avisoAlerta--aviso" role="status">
      {children}
    </p>
  );
}

export default AlertaPanel;
