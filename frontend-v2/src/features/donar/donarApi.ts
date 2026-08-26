/* Contratos de la API pública que consume la página de donación. El backend
 * devuelve TODOS los métodos (habilitados o no) con su estado real y la
 * configuración pública estructurada (instrucciones + datos de cuenta) para
 * el modal de la página de donar. */

/* Datos de cuenta y pasos editables desde el panel para cada método manual.
 * Son opcionales: un método recién creado puede no tenerlos aún. */
export type ConfigMetodoPublico = {
  instructions?: string | null;
  bank_name?: string | null;
  account_holder?: string | null;
  account_number?: string | null;
  account_phone?: string | null;
  account_document?: string | null;
};

export type MetodoPagoPublico = {
  id: string;
  provider: string;
  public_label: string;
  mode: 'automatic' | 'manual';
  /* Estado real del método: el frontend marca como simulación los que no
   * están habilitados (setup_required/disabled). */
  status: 'enabled' | 'disabled' | 'setup_required';
  public_config: ConfigMetodoPublico;
  display_order: number;
  /* Solo para métodos automáticos (PayPal/Stripe): true cuando el cliente ya
   * configuró los campos públicos y los secretos (desde el panel). Sin esto,
   * el método se muestra pero el pago sería simulado. */
  ready: boolean;
};

/* Checkout creado para un método automático. `checkout_url` es la URL de la
 * pasarela (PayPal/Stripe) cuando el método está configurado; si no, el pago
 * es simulado (`simulated: true`) y se completa con el simulador local. */
export type CheckoutCreado = {
  reference: string;
  checkout_url: string;
  simulated: boolean;
};

/* Estado de un checkout consultado por referencia: status es el del intento
 * (created/completed/expired) y receipt_status el del recibo, si ya existe. */
export type EstadoCheckout = {
  reference: string;
  status: 'created' | 'completed' | 'expired';
  amount_minor: number;
  currency: string;
  donor_name: string;
  receipt_id: string | null;
  receipt_status: string | null;
  provider_reference: string | null;
};

/* Crea el intento de pago automático. El backend valida que el método esté
 * habilitado y en modo automático, y devuelve la URL de la pasarela o una
 * orden simulada. */
export async function crearCheckout(datos: {
  payment_method_id: string;
  donor_name: string;
  donor_email?: string;
  amount_minor: number;
  currency: string;
}): Promise<CheckoutCreado> {
  const respuesta = await fetch('/api/payments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | (CheckoutCreado & { message?: string; error?: string })
    | null;
  if (!respuesta.ok) {
    throw new Error(cuerpo?.message ?? cuerpo?.error ?? `Error ${respuesta.status} al iniciar el pago`);
  }
  return cuerpo as CheckoutCreado;
}

/* Completa un pago simulado (solo válido cuando el método no está listo para
 * pago real; el backend lo valida y rechaza la simulación si ya hay secretos
 * configurados). Dispara el mismo pipeline que un webhook: recibo aprobado +
 * ingreso verificado. La referencia es la del intento (`CK-*`). */
export async function simularPago(reference: string): Promise<void> {
  const respuesta = await fetch(`/api/payments/simulate/${encodeURIComponent(reference)}`, {
    method: 'POST',
  });
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    throw new Error(
      cuerpo?.message ?? cuerpo?.error ?? `Error ${respuesta.status} al simular el pago`,
    );
  }
}

/* Consulta el estado de un checkout para saber si el pago se completó. */
export async function consultarCheckout(reference: string): Promise<EstadoCheckout> {
  const respuesta = await fetch(
    `/api/payments/checkout/${encodeURIComponent(reference)}`,
  );
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    throw new Error(
      cuerpo?.message ?? cuerpo?.error ?? `Error ${respuesta.status} al consultar el pago`,
    );
  }
  return (await respuesta.json()) as EstadoCheckout;
}

export type ResumenTransparencia = {
  currency: string;
  total_received_minor: number;
  total_used_minor: number;
  entries: unknown[];
};

export async function cargarMetodosPago(senal?: AbortSignal): Promise<MetodoPagoPublico[]> {
  const respuesta = await fetch('/api/payment-methods', { signal: senal });
  if (!respuesta.ok) {
    throw new Error(`No se pudieron cargar los métodos de pago (${respuesta.status})`);
  }
  return (await respuesta.json()) as MetodoPagoPublico[];
}

export async function cargarResumenTransparencia(
  senal?: AbortSignal,
): Promise<ResumenTransparencia> {
  const respuesta = await fetch('/api/transparency/summary?currency=USD', { signal: senal });
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar el resumen (${respuesta.status})`);
  }
  return (await respuesta.json()) as ResumenTransparencia;
}

/* Acción publicada de transparencia: un gasto verificado con su narrativa e
 * imágenes. La sección "Así se está usando tu ayuda" de /donar muestra las
 * últimas y la página /acciones las lista todas. El backend solo devuelve
 * gastos publicados con descripción no vacía. */
export type AccionTransparencia = {
  id: string;
  entry_type: 'income' | 'expense';
  concept: string;
  campaign: string | null;
  amount_minor: number;
  currency: string;
  occurred_on: string;
  description: string;
  images: string[];
};

export async function cargarAccionesTransparencia(
  limite = 100,
  senal?: AbortSignal,
): Promise<AccionTransparencia[]> {
  const respuesta = await fetch(
    `/api/transparency/actions?currency=USD&limit=${limite}`,
    { signal: senal },
  );
  if (!respuesta.ok) {
    throw new Error(`No se pudieron cargar las acciones (${respuesta.status})`);
  }
  return (await respuesta.json()) as AccionTransparencia[];
}

/* Campañas públicas (activas/completadas). La activa define la meta de la
 * página de donar: `name` es el título de la meta y `goal_minor` el monto. */
export type CampanaPublica = {
  slug: string;
  name: string;
  goal_minor: number;
  currency: string;
  starts_on: string;
  ends_on: string | null;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
};

export async function cargarCampanasPublicas(senal?: AbortSignal): Promise<CampanaPublica[]> {
  const respuesta = await fetch('/api/campaigns', { signal: senal });
  if (!respuesta.ok) {
    throw new Error(`No se pudieron cargar las campañas (${respuesta.status})`);
  }
  return (await respuesta.json()) as CampanaPublica[];
}

/* Donaciones aprobadas recientes para el feed "en vivo". El nombre no es
 * opcional: el backend solo devuelve recibos con donante identificado. */
export type DonacionViva = {
  donor_name: string;
  amount_minor: number;
  currency: string;
};

export async function cargarDonacionesEnVivo(senal?: AbortSignal): Promise<DonacionViva[]> {
  const respuesta = await fetch('/api/donations/live', { signal: senal });
  if (!respuesta.ok) {
    throw new Error(`No se pudieron cargar las donaciones (${respuesta.status})`);
  }
  return (await respuesta.json()) as DonacionViva[];
}

export function formatearMonto(montoMinor: number, moneda: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: moneda === 'USD' ? 0 : 2,
  }).format(montoMinor / 100);
}

/* Datos del formulario de donación. El comprobante es opcional: el equipo lo
 * puede revisar también por otros medios, pero si se adjunta nace con
 * pending_verification y aparece en la bandeja del panel. */
export type DatosDonacion = {
  paymentMethodId: string;
  donorName: string;
  donorEmail?: string;
  amountMinor: number;
  currency: string;
  providerReference?: string;
  proof?: File | null;
};

export type DonacionCreada = {
  id: string;
  status: 'pending_verification';
  provider_reference: string | null;
};

/* Envía la donación con su comprobante como multipart/form-data. El navegador
 * fija el boundary y el Content-Type automáticamente: por eso NO se pasa un
 * header Content-Type manual (rompería el multipart). */
export async function enviarDonacion(datos: DatosDonacion): Promise<DonacionCreada> {
  const formulario = new FormData();
  formulario.append('payment_method_id', datos.paymentMethodId);
  formulario.append('donor_name', datos.donorName);
  if (datos.donorEmail) formulario.append('donor_email', datos.donorEmail);
  formulario.append('amount_minor', String(datos.amountMinor));
  formulario.append('currency', datos.currency);
  if (datos.providerReference) formulario.append('provider_reference', datos.providerReference);
  if (datos.proof) formulario.append('proof', datos.proof);

  const respuesta = await fetch('/api/donations', { method: 'POST', body: formulario });
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | (DonacionCreada & { message?: string; error?: string })
    | null;
  if (!respuesta.ok) {
    throw new Error(cuerpo?.message ?? cuerpo?.error ?? `Error ${respuesta.status} al donar`);
  }
  return cuerpo as DonacionCreada;
}

/* Subtítulo descriptivo por proveedor de método de pago, para que la tarjeta
 * comunique cómo se paga (patrón de dona.yummyrides.com). El panel controla
 * public_label; este texto es un complemento fijo por proveedor. */
const SUBTITULO_METODO: Record<string, string> = {
  pago_movil: 'Pago móvil · transferencia verificada manualmente',
  transfer: 'Transferencia bancaria · verificación manual',
  zelle: 'Zelle · verificación manual',
  paypal: 'Pago en línea internacional',
  stripe: 'Tarjeta de débito o crédito',
};

export function subtituloMetodo(metodo: MetodoPagoPublico): string {
  return (
    SUBTITULO_METODO[metodo.provider] ??
    (metodo.mode === 'automatic' ? 'Pago en línea' : 'Verificación manual')
  );
}
