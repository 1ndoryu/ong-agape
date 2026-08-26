import { useEffect, type ReactNode } from 'react';
import SubirArchivo from '../../components/ui/SubirArchivo';
import type { CheckoutCreado, MetodoPagoPublico } from './donarApi';
import { formatearMonto } from './donarApi';
import './Donar.css';

/* Datos estructurados de una cuenta que el panel puede publicar. Cada campo
 * es opcional: el modal solo dibuja filas para los que existen. */
const CAMPOS_CUENTA: ReadonlyArray<{ clave: keyof MetodoPagoPublico['public_config']; etiqueta: string }> = [
  { clave: 'bank_name', etiqueta: 'Banco' },
  { clave: 'account_holder', etiqueta: 'Titular' },
  { clave: 'account_number', etiqueta: 'Número de cuenta' },
  { clave: 'account_phone', etiqueta: 'Teléfono' },
  { clave: 'account_document', etiqueta: 'Documento' },
];

/* Modos del modal:
 * - 'cerrado': no se renderiza nada.
 * - 'confirmar': se abre al pulsar "Donar". En métodos manuales operativos
 *   añade el comprobante opcional y el botón que registra la donación; en
 *   métodos no operativos muestra el aviso de simulación.
 * - 'simular': el checkout de un método automático se creó como simulado
 *   (proveedor aún no configurado); ofrece completar el pago de prueba. */
export type ModoModalPago = 'cerrado' | 'confirmar' | 'simular';

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="filaDatoPago">
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

/* Modal con los datos exactos para pagar por el método seleccionado. Los
 * valores vienen de la configuración pública editada desde el panel: si el
 * equipo cambia el banco o la cuenta, aquí se refleja sin tocar código.
 * El modal se adapta al método:
 * - Manuales operativos: comprobante opcional + confirmación.
 * - Automáticos listos: el pago ocurre en la pasarela (no pasa por aquí);
 *   este modal solo se ve en modo 'simular' si el proveedor aún no está
 *   configurado.
 * - No operativos: aviso de simulación y botón para elegir otro método. */
function ModalDatosPago({
  metodo,
  modo,
  monto,
  comprobante,
  error,
  checkout,
  alCambiarComprobante,
  alCerrar,
  alConfirmar,
  alCompletarSimulado,
  enviando,
}: {
  metodo: MetodoPagoPublico;
  modo: ModoModalPago;
  monto: number | null;
  comprobante: File | null;
  error?: string | null;
  checkout?: CheckoutCreado | null;
  alCambiarComprobante: (archivo: File | null) => void;
  alCerrar: () => void;
  alConfirmar: () => void;
  alCompletarSimulado: () => void;
  enviando: boolean;
}) {
  const config = metodo.public_config;
  /* Un método es operativo cuando está habilitado Y usable:
   * - Manual: habilitado (el backend registra la donación con o sin
   *   comprobante).
   * - Automático: habilitado Y listo (campos públicos + secretos del panel);
   *   el pago ocurre en la pasarela, no en este modal. */
  const esOperativo =
    metodo.status === 'enabled' &&
    (metodo.mode === 'manual' || metodo.ready === true);
  /* Checkout simulado de un automático habilitado pero aún sin configurar. */
  const esSimulacionPago = modo === 'simular' && checkout !== null;

  /* Cerrar con Escape; el clic fuera lo gestiona el overlay. */
  useEffect(() => {
    if (modo === 'cerrado') return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [modo, alCerrar]);

  if (modo === 'cerrado') return null;

  /* Solo se muestran los datos que realmente están publicados. */
  const contenido: ReactNode[] = [];
  if (config.instructions) {
    contenido.push(
      <div key="instrucciones" className="instruccionesModalPago">
        {config.instructions}
      </div>,
    );
  }
  for (const campo of CAMPOS_CUENTA) {
    const valor = config[campo.clave];
    if (valor) contenido.push(<FilaDato key={campo.clave} etiqueta={campo.etiqueta} valor={valor} />);
  }
  if (contenido.length === 0) {
    contenido.push(
      <p key="vacio" className="estadoDonar">
        Este método aún no tiene datos de pago publicados. Escríbenos a
        hola@elproyectoagape.org y coordinamos tu aporte.
      </p>,
    );
  }

  return (
    <div
      className="modalDatosPago"
      role="dialog"
      aria-modal="true"
      aria-label={`Datos para pagar con ${metodo.public_label}`}
      onClick={(evento) => {
        /* Clic fuera del contenido cierra el modal. */
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div className="modalDatosPagoContenido">
        <div className="modalDatosPagoCabecera">
          <h3>Datos de pago · {metodo.public_label}</h3>
          <button type="button" className="modalDatosPagoCerrar" onClick={alCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <dl className="datosPago">{contenido}</dl>

        {/* Aviso de simulación dentro del modal: el formulario ya no lo
         * muestra; aquí se ve al pulsar "Donar" (o "Ver datos de pago") con
         * un método aún no operativo. */}
        {!esOperativo && !esSimulacionPago && (
          <div className="simulacionModalPago" role="status">
            <p>
              Este método está en simulación: puedes ver los datos de pago, pero
              todavía no aceptamos aportes por él. Elige uno de los métodos
              habilitados.
            </p>
            <button type="button" className="botonSimulacionModal" onClick={alCerrar}>
              Elegir otro método
            </button>
          </div>
        )}

        {/* Pago de prueba de un método automático: el backend creó una orden
         * simulada porque el proveedor aún no está configurado. Se completa
         * con el mismo pipeline que un webhook. */}
        {esSimulacionPago && (
          <div className="simulacionModalPago" role="status">
            <p>
              Este método aún no está conectado a la pasarela, así que estás en
              modo de prueba. Al completar el pago de prueba se generará un
              recibo aprobado igual que con un pago real.
            </p>
            <button
              type="button"
              className="botonDonar botonPagoPrueba"
              onClick={alCompletarSimulado}
              disabled={enviando}
            >
              {enviando ? 'Completando…' : 'Completar pago de prueba'}
            </button>
          </div>
        )}

        {modo === 'confirmar' && esOperativo && metodo.mode === 'manual' && (
          <div className="comprobanteModalPago">
            <p className="textoComprobanteModalPago">
              ¿Quieres adjuntar la captura o el PDF de tu transferencia? Es opcional y
              ayuda al equipo a verificar tu aporte más rápido.
            </p>
            <SubirArchivo
              aceptar="image/jpeg,image/png,image/webp,application/pdf"
              archivo={comprobante}
              alCambiar={alCambiarComprobante}
              etiqueta="Adjuntar captura o PDF de la transferencia"
            />
          </div>
        )}

        {modo === 'confirmar' && esOperativo && metodo.mode === 'manual' && (
          <div className="confirmarModalPago">
            {error && (
              <p className="errorEnvioDonar" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="botonDonar botonDonarModal"
              onClick={alConfirmar}
              disabled={enviando || monto === null}
            >
              {enviando
                ? 'Enviando…'
                : `Confirmar donación ${monto !== null ? formatearMonto(monto, 'USD') : '—'}`}
            </button>
            <p className="notaDonar">
              Al confirmar, tu aporte se registra en nuestra rendición de cuentas pública.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModalDatosPago;

