import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import CarruselDonaciones from './CarruselDonaciones';
import ModalAccion from './ModalAccion';
import ModalDatosPago from './ModalDatosPago';
import {
  cargarAccionesTransparencia,
  cargarCampanasPublicas,
  cargarDonacionesEnVivo,
  cargarMetodosPago,
  cargarResumenTransparencia,
  consultarCheckout,
  crearCheckout,
  enviarDonacion,
  formatearMonto,
  simularPago,
  subtituloMetodo,
  type AccionTransparencia,
  type CampanaPublica,
  type CheckoutCreado,
  type DonacionViva,
  type EstadoCheckout,
  type MetodoPagoPublico,
  type ResumenTransparencia,
} from './donarApi';
import './Donar.css';

/* Montos sugeridos del cliente (referencia dona.yummyrides.com). El monto
 * "otro" se escribe en dólares y se convierte a centavos al enviar. */
const MONTOS_SUGERIDOS = [10, 20, 50, 100];

/* Logotipo por proveedor de método de pago. Los manuales (pago móvil,
 * transferencia) usan un pictograma de línea en el azul de marca; las
 * pasarelas internacionales muestran su marca. Si un proveedor nuevo no
 * tiene logo, el botón se dibuja sin imagen (solo texto). */
const LOGO_METODO: Record<string, string> = {
  paypal: '/imagenes/metodos-pago/paypal.svg',
  stripe: '/imagenes/metodos-pago/stripe.svg',
  pago_movil: '/imagenes/metodos-pago/pago-movil.svg',
  transfer: '/imagenes/metodos-pago/transferencia.svg',
  zelle: '/imagenes/metodos-pago/zelle.svg',
};

type EstadoMetodos =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'lista'; metodos: MetodoPagoPublico[] };

/* Página pública de donación: elige monto, datos del donante y método de
 * aporte. Los métodos manuales habilitados (pago móvil/transferencia/zelle)
 * registran la donación directamente: al pulsar "Donar" se abre un modal con
 * los datos de pago donde el donante adjunta su comprobante (opcional) y
 * confirma; el recibo nace pendiente de verificación para que el equipo lo
 * revise desde el panel. Los métodos no habilitados o automáticos
 * (PayPal/Stripe) se muestran como simulación para previsualizar cómo se
 * verán cuando se activen. */
function Donar() {
  const [estadoMetodos, setEstadoMetodos] = useState<EstadoMetodos>({ tipo: 'cargando' });
  const [resumen, setResumen] = useState<ResumenTransparencia | null>(null);
  const [campanaActiva, setCampanaActiva] = useState<CampanaPublica | null>(null);
  const [donacionesVivas, setDonacionesVivas] = useState<DonacionViva[]>([]);
  /* Las 3 acciones más recientes de transparencia ("Así se está usando tu
   * ayuda"), debajo de la meta. Un clic abre el mismo modal que la página
   * /acciones. Si el backend no responde la sección se oculta en silencio. */
  const [accionesRecientes, setAccionesRecientes] = useState<AccionTransparencia[]>([]);
  const [accionSeleccionada, setAccionSeleccionada] = useState<AccionTransparencia | null>(null);
  const [montoSeleccionado, setMontoSeleccionado] = useState<number>(20);
  const [montoOtro, setMontoOtro] = useState('');
  const [usarOtro, setUsarOtro] = useState(false);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [metodoId, setMetodoId] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  /* El modal de pago se abre al pulsar "Donar" ('confirmar'): muestra los
   * datos de pago del método seleccionado y, en métodos manuales operativos,
   * el comprobante opcional + botón de confirmación. Para métodos automáticos
   * 'simular' ocurre cuando el checkout creado es simulado (proveedor aún no
   * listo): se ofrece completar el pago de prueba. */
  const [modalPago, setModalPago] = useState<'cerrado' | 'confirmar' | 'simular'>('cerrado');
  /* Checkout creado para un método automático: si `simulated` es true, el
   * modal pasa a modo 'simular' y se puede completar con el simulador; si es
   * false, se redirige a la pasarela (checkout_url). */
  const [checkout, setCheckout] = useState<CheckoutCreado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();
    cargarMetodosPago(controlador.signal)
      .then((metodos) => {
        setEstadoMetodos({ tipo: 'lista', metodos });
        const primero = metodos[0];
        if (primero) setMetodoId(primero.id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setEstadoMetodos({ tipo: 'error' });
      });
    cargarResumenTransparencia(controlador.signal)
      .then(setResumen)
      .catch(() => setResumen(null));
    cargarCampanasPublicas(controlador.signal)
      .then((campanas) => {
        const activa = campanas.find((c) => c.status === 'active');
        setCampanaActiva(activa ?? null);
      })
      .catch(() => setCampanaActiva(null));
    cargarDonacionesEnVivo(controlador.signal)
      .then(setDonacionesVivas)
      .catch(() => setDonacionesVivas([]));
    cargarAccionesTransparencia(3, controlador.signal)
      .then(setAccionesRecientes)
      .catch(() => setAccionesRecientes([]));
    return () => controlador.abort();
  }, []);

  const metodos = estadoMetodos.tipo === 'lista' ? estadoMetodos.metodos : [];
  const metodoActivo = metodos.find((metodo) => metodo.id === metodoId) ?? null;
  /* Un método es operativo cuando está habilitado Y usable:
   * - Manual: siempre que esté habilitado (el backend registra la donación
   *   con comprobante o sin él).
   * - Automático: habilitado Y listo (campos públicos + secretos del panel).
   *   Si no está listo, el backend crea un checkout simulado y se muestra el
   *   simulador local en vez de la pasarela real. */
  const metodoOperativo =
    metodoActivo?.status === 'enabled' &&
    (metodoActivo.mode === 'manual' || metodoActivo.ready === true);
  const esAutomatico = metodoActivo?.mode === 'automatic' && metodoActivo.status === 'enabled';
  const montoFinal = usarOtro ? Number(montoOtro) : montoSeleccionado;
  const montoValido = Number.isFinite(montoFinal) && montoFinal > 0;

  /* Apertura del modal de confirmación desde el propio form (submit): captura
   * también el Enter en los campos y evita el envío directo sin pasar por el
   * modal con los datos de pago y el comprobante. En métodos automáticos, en
   * vez de abrir el modal se crea el checkout directamente (pasarela o
   * simulador). Con un método simulado (no operativo) el modal igual se
   * abre: muestra el aviso de simulación en vez del botón de confirmación. */
  const abrirConfirmacion = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!montoValido || !metodoActivo) return;
    if (esAutomatico) {
      void iniciarPagoAutomatico();
      return;
    }
    setModalPago('confirmar');
  };

  /* Para métodos automáticos, "Donar" crea el checkout en el backend: si el
   * proveedor está configurado, devuelve la URL de la pasarela y se redirige;
   * si no, devuelve una orden simulada y el modal ofrece el simulador. */
  const iniciarPagoAutomatico = async () => {
    if (!montoValido || !metodoActivo || !esAutomatico || !nombre.trim()) return;
    setErrorEnvio(null);
    setEnviando(true);
    try {
      const orden = await crearCheckout({
        payment_method_id: metodoActivo.id,
        donor_name: nombre.trim(),
        donor_email: correo.trim() || undefined,
        amount_minor: Math.round(montoFinal * 100),
        currency: 'USD',
      });
      setCheckout(orden);
      if (orden.simulated) {
        /* Proveedor aún sin configurar (simulación): se ofrece completar el
         * pago de prueba dentro del modal. */
        setModalPago('simular');
      } else {
        /* Pasarela real: se abre en la misma pestaña (PayPal/Stripe redirige
         * de vuelta al success_url). */
        window.location.assign(orden.checkout_url);
      }
    } catch (motivo) {
      setErrorEnvio(motivo instanceof Error ? motivo.message : 'No se pudo iniciar el pago');
    } finally {
      setEnviando(false);
    }
  };

  /* Completa un pago simulado (método automático aún sin conectar) y consulta
   * el estado del intento para confirmar el recibo aprobado. Mismo pipeline
   * que un webhook real: recibo approved + ingreso verificado. */
  const completarPagoSimulado = async () => {
    if (!checkout) return;
    setErrorEnvio(null);
    setEnviando(true);
    try {
      await simularPago(checkout.reference);
      const estado: EstadoCheckout = await consultarCheckout(checkout.reference);
      if (estado.receipt_status === 'approved' || estado.status === 'completed') {
        setEnviado(true);
        setModalPago('cerrado');
      } else {
        setErrorEnvio('El pago de prueba no se completó. Inténtalo de nuevo.');
      }
    } catch (motivo) {
      setErrorEnvio(motivo instanceof Error ? motivo.message : 'No se pudo completar el pago');
    } finally {
      setEnviando(false);
    }
  };

  /* El envío real ocurre desde el modal de confirmación (alConfirmar), no
   * desde el formulario: así el donante ve primero los datos de pago y puede
   * adjuntar el comprobante (opcional) antes de confirmar. Solo aplica a
   * métodos manuales operativos; los automáticos usan iniciarPagoAutomatico. */
  const enviar = async () => {
    if (
      !montoValido ||
      !metodoActivo ||
      !metodoOperativo ||
      metodoActivo.mode === 'automatic' ||
      !nombre.trim()
    )
      return;
    setErrorEnvio(null);
    setEnviando(true);
    try {
      /* El comprobante se adjunta en el envío (multipart): el recibo nace
       * pendiente de verificación y el equipo lo revisa desde el panel. No se
       * envía nada por correo. */
      await enviarDonacion({
        paymentMethodId: metodoActivo.id,
        donorName: nombre.trim(),
        donorEmail: correo.trim() || undefined,
        amountMinor: Math.round(montoFinal * 100),
        currency: metodoActivo.provider === 'pago_movil' ? 'VES' : 'USD',
        proof: comprobante,
      });
      setEnviado(true);
      setModalPago('cerrado');
    } catch (motivo) {
      setErrorEnvio(motivo instanceof Error ? motivo.message : 'No se pudo registrar la donación');
    } finally {
      setEnviando(false);
    }
  };

  /* Validación y asignación del comprobante. El archivo vive en el estado del
   * formulario aunque se suba desde el modal: así no se pierde si el donante
   * cierra y reabre el modal antes de confirmar. */
  const cambiarComprobante = (archivo: File | null) => {
    if (archivo && archivo.size > 5 * 1024 * 1024) {
      setErrorEnvio('El comprobante supera los 5 MB. Usa una imagen o PDF más liviano.');
      setComprobante(null);
      return;
    }
    setErrorEnvio(null);
    setComprobante(archivo);
  };

  const totalRecaudado = resumen ? formatearMonto(resumen.total_received_minor, resumen.currency) : null;

  /* Meta de la campaña activa: nombre como título y monto objetivo. El
   * progreso se calcula contra lo recaudado (resumen de transparencia). */
  const metaMinima = campanaActiva?.goal_minor ?? 0;
  const recaudadoMinor = resumen?.total_received_minor ?? 0;
  const progresoMeta = metaMinima > 0 ? Math.min(100, Math.round((recaudadoMinor / metaMinima) * 100)) : 0;

  return (
    <div className="donar">
      <section className="donarHero contenedor">
        <p className="etiquetaDonar">Quiero ayudar</p>
        <h1>
          Tu aporte se convierte
          <span className="lineaDonar"> en ayuda cercana</span>
        </h1>
        <p className="descripcionDonar">
          Cada contribución financia entregas de alimentos, medicinas y
          acompañamiento a familias. Publicamos cada movimiento en nuestra
          sección de transparencia.
        </p>
        {campanaActiva && (
          <div className="metaDonar" role="status">
            <div className="metaDonarCabecera">
              <strong>{campanaActiva.name}</strong>
              {totalRecaudado && (
                <span>
                  {totalRecaudado} de {formatearMonto(metaMinima, campanaActiva.currency)}
                </span>
              )}
            </div>
            {/* La anchura de la barra es un valor dinámico de datos (progreso),
             * no una especificación de diseño. */}
            <div className="barraMetaDonar" aria-hidden="true">
              <span style={{ width: `${progresoMeta}%` }} />
            </div>
            <p className="porcentajeMetaDonar">{progresoMeta}% recaudado</p>
          </div>
        )}

        {donacionesVivas.length > 0 && <CarruselDonaciones donaciones={donacionesVivas} />}
      </section>

      <section className="donarFormulario contenedor" aria-label="Formulario de donación">
        {enviado ? (
          <div className="confirmacionDonar" role="status">
            <strong>¡Gracias por sumarte!</strong>
            <p>
              Registramos tu aporte de {formatearMonto(Math.round(montoFinal * 100), 'USD')} vía{' '}
              {metodoActivo?.public_label ?? 'el método seleccionado'}.{' '}
              {metodoActivo?.mode === 'automatic'
                ? 'Tu pago se procesó y quedó aprobado automáticamente: ya aparece en el feed de donaciones en vivo y en la rendición de cuentas pública.'
                : comprobante
                  ? 'Tu comprobante quedó adjunto a la donación y nuestro equipo lo verificará para que aparezca en el feed de donaciones en vivo y en la rendición de cuentas pública.'
                  : 'Si aún no enviaste tu transferencia, usa los datos de pago que viste en el modal y escríbenos el comprobante a hola@elproyectoagape.org para verificar tu aporte. Cuando lo verifiquemos, aparecerá en el feed de donaciones en vivo y en la rendición de cuentas pública.'}
            </p>
            <Link className="volverDonar" to="/">
              ← Volver al inicio
            </Link>
          </div>
        ) : (
          <form onSubmit={abrirConfirmacion}>
            <fieldset className="bloqueDonar">
              <legend>Elige tu aporte</legend>
              <div className="montosDonar" role="group" aria-label="Montos sugeridos">
                {MONTOS_SUGERIDOS.map((monto) => (
                  <button
                    key={monto}
                    type="button"
                    className={`montoDonar${!usarOtro && montoSeleccionado === monto ? ' montoDonar--activo' : ''}`}
                    aria-pressed={!usarOtro && montoSeleccionado === monto}
                    onClick={() => {
                      setUsarOtro(false);
                      setMontoSeleccionado(monto);
                    }}
                  >
                    US$ {monto}
                  </button>
                ))}
                <label className={`montoOtro${usarOtro ? ' montoDonar--activo' : ''}`}>
                  <span>Otro</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="$"
                    value={montoOtro}
                    onFocus={() => setUsarOtro(true)}
                    onChange={(evento) => {
                      setUsarOtro(true);
                      setMontoOtro(evento.target.value);
                    }}
                    aria-label="Monto personalizado en dólares"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="bloqueDonar">
              <legend>Tus datos</legend>
              <div className="datosDonar">
                <label>
                  Nombre
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(evento) => setNombre(evento.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    placeholder="Tu nombre (aparecerá en las donaciones en vivo)"
                  />
                </label>
                <label>
                  Correo
                  {/* El correo es opcional: solo se usa para avisar al donante
                   * si el comprobante no se puede verificar. No bloqueamos el
                   * envío por no tenerlo. */}
                  <input
                    type="email"
                    value={correo}
                    onChange={(evento) => setCorreo(evento.target.value)}
                    autoComplete="email"
                    maxLength={160}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="bloqueDonar">
              <legend>¿Cómo quieres pagar?</legend>
              {estadoMetodos.tipo === 'cargando' && <p className="estadoDonar">Cargando métodos…</p>}
              {estadoMetodos.tipo === 'error' && (
                <p className="estadoDonar" role="status">
                  Los métodos de pago no están disponibles en este momento. Escríbenos
                  directamente a hola@elproyectoagape.org.
                </p>
              )}
              {estadoMetodos.tipo === 'lista' && metodos.length === 0 && (
                <p className="estadoDonar" role="status">
                  Estamos configurando los métodos de aporte. Mientras tanto escríbenos
                  a hola@elproyectoagape.org y coordinamos tu donación.
                </p>
              )}
              {metodos.length > 0 && (
                <div className="metodosDonar" role="group" aria-label="Métodos de pago">
                  {metodos.map((metodo) => {
                    /* Los métodos no operativos se muestran como simulación:
                     * manuales deshabilitados/setup_required y automáticos
                     * que aún no están listos (ready false). Los automáticos
                     * listos son completamente operativos. */
                    const operativo =
                      metodo.status === 'enabled' &&
                      (metodo.mode === 'manual' || metodo.ready === true);
                    const simulado = !operativo;
                    const logo = LOGO_METODO[metodo.provider];
                    return (
                      <button
                        key={metodo.id}
                        type="button"
                        className={`metodoDonar${metodoId === metodo.id ? ' metodoDonar--activo' : ''}${simulado ? ' metodoDonar--simulado' : ''}`}
                        aria-pressed={metodoId === metodo.id}
                        onClick={() => setMetodoId(metodo.id)}
                      >
                        {logo && (
                          <img
                            className="logoMetodoDonar"
                            src={logo}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <span className="textoMetodoDonar">
                          <strong>{metodo.public_label}</strong>
                          <span>
                            {subtituloMetodo(metodo)}
                            {simulado && ' · Próximamente'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <div className="accionesDonar">
              <button
                className="accionDonar"
                type="submit"
                disabled={!montoValido || !metodoActivo || enviando}
              >
                {enviando
                  ? 'Enviando…'
                  : `Donar ${montoValido ? formatearMonto(Math.round(montoFinal * 100), 'USD') : '—'}`}
              </button>
              {errorEnvio && (
                <p className="errorEnvioDonar" role="alert">
                  {errorEnvio}
                </p>
              )}
              <p className="notaDonar">
                Al continuar aceptas que tu aporte se registre en nuestra rendición de
                cuentas pública.
              </p>
            </div>
          </form>
        )}
      </section>

      {/* Rendición de cuentas en la propia página de donación: las 3 acciones
       * más recientes con narrativa. Cada tarjeta abre el modal de detalle y
       * "Ver todas" lleva a la página completa /acciones. */}
      {accionesRecientes.length > 0 && (
        <section className="accionesRecientes contenedor" aria-label="Así se está usando tu ayuda">
          <div className="accionesRecientesCabecera">
            <p className="etiquetaDonar">Transparencia</p>
            <h2>Así se está usando tu ayuda</h2>
            <p className="accionesRecientesDescripcion">
              Cada acción muestra qué se hizo con el dinero y sus evidencias.
            </p>
          </div>
          <div className="accionesRecientesGrid">
            {accionesRecientes.map((accion) => (
              <button
                key={accion.id}
                type="button"
                className="tarjetaAccion"
                onClick={() => setAccionSeleccionada(accion)}
              >
                {accion.images.length > 0 && (
                  <img
                    className="tarjetaAccionImagen"
                    src={accion.images[0]}
                    alt={accion.concept}
                    loading="lazy"
                  />
                )}
                <span className="tarjetaAccionCuerpo">
                  <span className="tarjetaAccionMeta">
                    {accion.campaign ? `${accion.campaign} · ` : ''}
                    {accion.occurred_on}
                  </span>
                  <strong className="tarjetaAccionTitulo">{accion.concept}</strong>
                  <span className="tarjetaAccionMonto">
                    {formatearMonto(accion.amount_minor, accion.currency)}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="accionesRecientesPie">
            <Link className="accionDonar accionesRecientesBoton" to="/acciones">
              Ver todas
            </Link>
          </div>
        </section>
      )}

      {metodoActivo && (
        <ModalDatosPago
          metodo={metodoActivo}
          modo={modalPago}
          monto={montoValido ? Math.round(montoFinal * 100) : null}
          comprobante={comprobante}
          error={errorEnvio}
          checkout={checkout}
          alCambiarComprobante={cambiarComprobante}
          alCerrar={() => {
            setModalPago('cerrado');
            setCheckout(null);
          }}
          alConfirmar={enviar}
          alCompletarSimulado={completarPagoSimulado}
          enviando={enviando}
        />
      )}

      {accionSeleccionada && (
        <ModalAccion accion={accionSeleccionada} alCerrar={() => setAccionSeleccionada(null)} />
      )}
    </div>
  );
}

export default Donar;
