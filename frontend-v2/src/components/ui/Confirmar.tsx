import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import './Confirmar.css';

/* Confirmación personalizada del panel en lugar de window.confirm. Reutiliza
 * el lenguaje visual de .panelModal (PanelAdmin.css, importado por el panel)
 * para que el diálogo se sienta parte del panel, y devuelve una promesa: las
 * vistas hacen `if (!(await confirmar({...}))) return;` sin cambiar su flujo.
 * El proveedor se monta una vez en PanelAdmin. */
export type OpcionesConfirmacion = {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
};

type PeticionConfirmacion = {
  opciones: OpcionesConfirmacion;
  resolver: (aceptado: boolean) => void;
};

type ContextoConfirmar = {
  confirmar: (opciones: OpcionesConfirmacion) => Promise<boolean>;
};

const ContextoConfirmar = createContext<ContextoConfirmar | null>(null);

function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [peticion, setPeticion] = useState<PeticionConfirmacion | null>(null);

  const confirmar = useCallback((opciones: OpcionesConfirmacion) => {
    return new Promise<boolean>((resolver) => {
      setPeticion({ opciones, resolver });
    });
  }, []);

  /* Cierra el diálogo resolviendo la promesa con el resultado. Se usa el
   * estado funcional para leer el resolver sin que la función quede obsoleta
   * entre renders. */
  const cerrar = useCallback((aceptado: boolean) => {
    setPeticion((actual) => {
      if (actual) actual.resolver(aceptado);
      return null;
    });
  }, []);

  /* ESC cancela igual que la X o el clic fuera. */
  useEffect(() => {
    if (!peticion) return;
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrar(false);
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [peticion, cerrar]);

  return (
    <ContextoConfirmar.Provider value={{ confirmar }}>
      {children}
      {peticion && (
        <div
          className="panelModal confirmarModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tituloConfirmar"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) cerrar(false);
          }}
        >
          <div className="panelModalContenido">
            <div className="panelModalCabecera">
              <h3 id="tituloConfirmar">{peticion.opciones.titulo}</h3>
              <button
                type="button"
                className="panelModalCerrar"
                aria-label="Cerrar"
                onClick={() => cerrar(false)}
              >
                ×
              </button>
            </div>
            <p className="confirmarMensaje">{peticion.opciones.mensaje}</p>
            <div className="panelModalAcciones">
              <button type="button" className="panelModalCancelar" onClick={() => cerrar(false)}>
                {peticion.opciones.textoCancelar ?? 'Cancelar'}
              </button>
              <button
                type="button"
                className="panelModalGuardar"
                onClick={() => cerrar(true)}
                autoFocus
              >
                {peticion.opciones.textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ContextoConfirmar.Provider>
  );
}

export function useConfirmar(): ContextoConfirmar {
  const contexto = useContext(ContextoConfirmar);
  if (!contexto) {
    throw new Error('useConfirmar debe usarse dentro de <ConfirmarProvider>');
  }
  return contexto;
}

export default ConfirmarProvider;
