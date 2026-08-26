import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './Toast.css';

/* Notificaciones breves del panel administrativo. Un proveedor global (montado
 * en PanelAdmin) mantiene la lista de toasts y el hook useToast los lanza desde
 * cualquier vista. Los toasts se auto-descartan a los 4 s (o con la ×) y
 * sustituyen al aviso inline para el feedback de éxito, que no necesita
 * permanecer en pantalla. */
type TipoToast = 'exito' | 'error' | 'info';

type ToastDato = {
  id: number;
  mensaje: string;
  tipo: TipoToast;
};

type ContextoToast = {
  mostrarToast: (mensaje: string, tipo?: TipoToast) => void;
};

const ContextoToast = createContext<ContextoToast | null>(null);

/* Ids correlativos de módulo: cada toast recibe uno distinto aunque se lance
 * desde otra vista, para que React los distinga como claves. */
let siguienteIdToast = 1;

const DURACION_TOAST_MS = 4000;

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastDato[]>([]);
  /* Temporizadores vivos para limpiarlos al desmontar y no filtrar timers. */
  const temporizadoresRef = useRef<Set<number>>(new Set());

  const descartar = useCallback((id: number) => {
    setToasts((previos) => previos.filter((toast) => toast.id !== id));
  }, []);

  const mostrarToast = useCallback(
    (mensaje: string, tipo: TipoToast = 'exito') => {
      const id = siguienteIdToast;
      siguienteIdToast += 1;
      setToasts((previos) => [...previos, { id, mensaje, tipo }]);
      const temporizador = window.setTimeout(() => {
        temporizadoresRef.current.delete(temporizador);
        descartar(id);
      }, DURACION_TOAST_MS);
      temporizadoresRef.current.add(temporizador);
    },
    [descartar],
  );

  useEffect(() => {
    const pendientes = temporizadoresRef.current;
    return () => {
      for (const id of pendientes) window.clearTimeout(id);
    };
  }, []);

  return (
    <ContextoToast.Provider value={{ mostrarToast }}>
      {children}
      <div className="toastContenedor" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.tipo}`}
            role={toast.tipo === 'error' ? 'alert' : 'status'}
          >
            <span className="toastMensaje">{toast.mensaje}</span>
            <button
              type="button"
              className="toastCerrar"
              aria-label="Cerrar notificación"
              onClick={() => descartar(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ContextoToast.Provider>
  );
}

export function useToast(): ContextoToast {
  const contexto = useContext(ContextoToast);
  if (!contexto) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>');
  }
  return contexto;
}

export default ToastProvider;
