import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adminEscribir } from './apiAdmin';
import AlertaPanel from '../../components/ui/AlertaPanel';
import './PanelAdmin.css';

/* Datos editables de un método de pago desde el panel. La configuración
 * pública estructurada (instrucciones + datos de cuenta) es lo que el público
 * ve en el modal de la página de donar. Los métodos automáticos (PayPal/
 * Stripe) añaden provider_config (datos públicos del proveedor) y has_secrets
 * (si el cliente ya guardó secretos; el backend nunca devuelve el valor). */
export type MetodoPagoAdmin = {
  id: string;
  provider: string;
  public_label: string;
  mode: 'automatic' | 'manual';
  status: 'enabled' | 'disabled' | 'setup_required';
  public_config: {
    instructions?: string | null;
    bank_name?: string | null;
    account_holder?: string | null;
    account_number?: string | null;
    account_phone?: string | null;
    account_document?: string | null;
  };
  provider_config?: {
    client_id?: string | null;
    publishable_key?: string | null;
    environment?: string | null;
    currency?: string | null;
    account_label?: string | null;
  };
  has_secrets?: boolean;
  ready?: boolean;
  display_order: number;
};

type DatosFormulario = {
  public_label: string;
  instructions: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_phone: string;
  account_document: string;
  status: MetodoPagoAdmin['status'];
  display_order: string;
  /* Configuración pública del proveedor automático. */
  client_id: string;
  publishable_key: string;
  environment: 'sandbox' | 'live' | '';
  currency: string;
  account_label: string;
  /* Secretos del proveedor: se escriben una vez y el backend jamás los
   * devuelve (solo expone has_secrets). Vacío = no se toca; se puede limpiar
   * enviando un marcador especial que el backend interpreta como borrado. */
  client_secret: string;
  webhook_id: string;
  secret_key: string;
  webhook_secret: string;
};

/* Convierte el método en los valores iniciales del formulario. Los campos
 * vacíos o ausentes se dejan como string vacío para poder limpiarlos. */
function iniciales(metodo: MetodoPagoAdmin): DatosFormulario {
  return {
    public_label: metodo.public_label,
    instructions: metodo.public_config.instructions ?? '',
    bank_name: metodo.public_config.bank_name ?? '',
    account_holder: metodo.public_config.account_holder ?? '',
    account_number: metodo.public_config.account_number ?? '',
    account_phone: metodo.public_config.account_phone ?? '',
    account_document: metodo.public_config.account_document ?? '',
    status: metodo.status,
    display_order: String(metodo.display_order),
    client_id: metodo.provider_config?.client_id ?? '',
    publishable_key: metodo.provider_config?.publishable_key ?? '',
    /* Entorno y moneda con valor por defecto para automáticos: el backend los
     * exige para marcar el método como listo, y así el panel queda usable
     * sin que el cliente tenga que recordar que debe elegirlos. */
    environment: (metodo.provider_config?.environment as 'sandbox' | 'live' | undefined) ?? 'sandbox',
    currency: metodo.provider_config?.currency ?? 'USD',
    account_label: metodo.provider_config?.account_label ?? '',
    client_secret: '',
    webhook_id: '',
    secret_key: '',
    webhook_secret: '',
  };
}

/* Solo los campos con texto se envían: el backend fusiona sobre la config
 * actual y admite vacíos para limpiar. El status se envía siempre. Los
 * secretos se envían solo si el usuario escribió algo (vacío = no tocar). */
function cuerpoPeticion(datos: DatosFormulario, automatico: boolean) {
  const campos = {
    public_label: datos.public_label,
    instructions: datos.instructions,
    bank_name: datos.bank_name,
    account_holder: datos.account_holder,
    account_number: datos.account_number,
    account_phone: datos.account_phone,
    account_document: datos.account_document,
    status: datos.status,
    display_order: Number(datos.display_order),
  };
  const cuerpo: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(campos)) {
    if (clave === 'status' || clave === 'display_order') {
      cuerpo[clave] = valor;
    } else if (typeof valor === 'string' && valor.trim() !== '') {
      cuerpo[clave] = valor.trim();
    }
  }
  /* Configuración del proveedor (solo automáticos). El entorno y la moneda
   * se envían siempre con su valor por defecto (sandbox / USD): el backend
   * los exige para marcar el método como listo. La moneda solo se envía si
   * tiene 3 letras. */
  if (automatico) {
    cuerpo.environment = datos.environment || 'sandbox';
    if (datos.currency.trim()) cuerpo.currency = datos.currency.trim().toUpperCase();
    if (datos.account_label.trim()) cuerpo.account_label = datos.account_label.trim();
    if (datos.client_id.trim()) cuerpo.client_id = datos.client_id.trim();
    if (datos.publishable_key.trim()) cuerpo.publishable_key = datos.publishable_key.trim();
    /* Secretos: solo se envían si el usuario los escribió. El backend acepta
     * strings vacíos para limpiar un secreto guardado. */
    if (datos.client_secret) cuerpo.client_secret = datos.client_secret;
    if (datos.webhook_id) cuerpo.webhook_id = datos.webhook_id;
    if (datos.secret_key) cuerpo.secret_key = datos.secret_key;
    if (datos.webhook_secret) cuerpo.webhook_secret = datos.webhook_secret;
  }
  return cuerpo;
}

/* Modal de edición de un método de pago: permite cambiar la etiqueta pública,
 * el estado, el orden y los datos estructurados que se muestran al donante
 * (instrucciones, banco, titular, cuenta, teléfono, documento). */
function ModalEditarMetodo({
  metodo,
  token,
  alGuardar,
  alCerrar,
}: {
  metodo: MetodoPagoAdmin;
  token: string;
  alGuardar: () => void;
  alCerrar: () => void;
}) {
  const [datos, setDatos] = useState<DatosFormulario>(() => iniciales(metodo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [alCerrar]);

  const cambiar = (clave: keyof DatosFormulario, valor: string) => {
    setDatos((previos) => ({ ...previos, [clave]: valor }));
  };

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!datos.public_label.trim()) {
      setError('La etiqueta pública es obligatoria.');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await adminEscribir(
        `/payment-methods/${metodo.id}`,
        token,
        'PUT',
        cuerpoPeticion(datos, metodo.mode === 'automatic'),
      );
      alGuardar();
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : 'No se pudo guardar el método');
      setGuardando(false);
    }
  };

  return (
    <div
      className="panelModal"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${metodo.public_label}`}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div className="panelModalContenido">
        <div className="panelModalCabecera">
          <h3>Editar método · {metodo.provider}</h3>
          <button
            type="button"
            className="panelModalCerrar"
            onClick={alCerrar}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <form className="panelFormulario" onSubmit={guardar}>
          {error && (
            <AlertaPanel tipo="error">
              {error}
            </AlertaPanel>
          )}
          <label>
            Etiqueta pública
            <input
              value={datos.public_label}
              onChange={(evento) => cambiar('public_label', evento.target.value)}
              maxLength={120}
            />
          </label>

          <label>
            Instrucciones de pago (pasos que ve el donante)
            <textarea
              value={datos.instructions}
              onChange={(evento) => cambiar('instructions', evento.target.value)}
              maxLength={2000}
              rows={4}
            />
          </label>

          {/* Configuración del proveedor: solo para métodos automáticos
           * (PayPal/Stripe). El cliente la rellena desde el panel sin tocar
           * el servidor. Los campos públicos se muestran de nuevo (son
           * visibles); los secretos solo tienen un indicador "configurado"
           * porque el backend nunca los devuelve. */}
          {metodo.mode === 'automatic' && (
            <fieldset className="panelSeccionProveedor">
              <legend>Configuración del proveedor ({metodo.provider})</legend>
              <p className="panelAyudaProveedor">
                Guarda aquí los datos de tu cuenta en {metodo.provider === 'paypal' ? 'PayPal' : 'Stripe'}.
                Con esto el método queda listo para aceptar pagos reales; los valores
                secretos no se vuelven a mostrar por seguridad.
              </p>

              {metodo.provider === 'paypal' && (
                <label>
                  Client ID
                  <input
                    value={datos.client_id}
                    onChange={(evento) => cambiar('client_id', evento.target.value)}
                    maxLength={120}
                    autoComplete="off"
                  />
                  <span className="panelAyudaCampo">
                    Lo encuentras en el dashboard de PayPal → Apps &amp; Credentials.
                  </span>
                </label>
              )}
              {metodo.provider === 'stripe' && (
                <label>
                  Publishable key
                  <input
                    value={datos.publishable_key}
                    onChange={(evento) => cambiar('publishable_key', evento.target.value)}
                    maxLength={120}
                    autoComplete="off"
                  />
                  <span className="panelAyudaCampo">
                    Clave pública (pk_…) del dashboard de Stripe.
                  </span>
                </label>
              )}

              <div className="panelFormularioFila">
                <label>
                  Entorno
                  <select
                    value={datos.environment}
                    onChange={(evento) => cambiar('environment', evento.target.value)}
                  >
                    <option value="">Sandbox (pruebas)</option>
                    <option value="live">Producción (pagos reales)</option>
                  </select>
                  <span className="panelAyudaCampo">
                    Usa Sandbox para probar sin cobrar; cambia a Producción cuando
                    estés listo.
                  </span>
                </label>
                <label>
                  Moneda
                  <input
                    value={datos.currency}
                    onChange={(evento) => cambiar('currency', evento.target.value)}
                    maxLength={3}
                    placeholder="USD"
                    autoComplete="off"
                  />
                  <span className="panelAyudaCampo">Código de 3 letras (USD, EUR…).</span>
                </label>
              </div>

              <label>
                Nombre de la cuenta (opcional, se muestra al donante)
                <input
                  value={datos.account_label}
                  onChange={(evento) => cambiar('account_label', evento.target.value)}
                  maxLength={120}
                />
              </label>

              {/* Secretos: solo-escritura. Si ya están guardados se muestra un
               * indicador verde; escribir un valor lo reemplaza. */}
              {metodo.provider === 'paypal' && (
                <>
                  <div className="panelSecretosProveedor">
                    <span className="panelSecretoTitulo">Client Secret</span>
                    <span className={`panelEstadoChip ${metodo.has_secrets ? 'panelEstadoChip--enabled' : ''}`}>
                      {metodo.has_secrets ? 'Configurado ✓' : 'Pendiente'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={datos.client_secret}
                    onChange={(evento) => cambiar('client_secret', evento.target.value)}
                    placeholder="Escribe aquí el secreto (no se muestra de nuevo)"
                    maxLength={200}
                    autoComplete="new-password"
                  />
                  <div className="panelSecretosProveedor">
                    <span className="panelSecretoTitulo">Webhook ID</span>
                    <span className={`panelEstadoChip ${metodo.has_secrets ? 'panelEstadoChip--enabled' : ''}`}>
                      {metodo.has_secrets ? 'Configurado ✓' : 'Pendiente'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={datos.webhook_id}
                    onChange={(evento) => cambiar('webhook_id', evento.target.value)}
                    placeholder="Escribe aquí el webhook ID (no se muestra de nuevo)"
                    maxLength={200}
                    autoComplete="new-password"
                  />
                </>
              )}
              {metodo.provider === 'stripe' && (
                <>
                  <div className="panelSecretosProveedor">
                    <span className="panelSecretoTitulo">Secret key</span>
                    <span className={`panelEstadoChip ${metodo.has_secrets ? 'panelEstadoChip--enabled' : ''}`}>
                      {metodo.has_secrets ? 'Configurado ✓' : 'Pendiente'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={datos.secret_key}
                    onChange={(evento) => cambiar('secret_key', evento.target.value)}
                    placeholder="Escribe aquí el secreto (no se muestra de nuevo)"
                    maxLength={200}
                    autoComplete="new-password"
                  />
                  <div className="panelSecretosProveedor">
                    <span className="panelSecretoTitulo">Webhook secret</span>
                    <span className={`panelEstadoChip ${metodo.has_secrets ? 'panelEstadoChip--enabled' : ''}`}>
                      {metodo.has_secrets ? 'Configurado ✓' : 'Pendiente'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={datos.webhook_secret}
                    onChange={(evento) => cambiar('webhook_secret', evento.target.value)}
                    placeholder="Escribe aquí el webhook secret (no se muestra de nuevo)"
                    maxLength={200}
                    autoComplete="new-password"
                  />
                </>
              )}
            </fieldset>
          )}

          <div className="panelFormularioFila">
            <label>
              Banco
              <input
                value={datos.bank_name}
                onChange={(evento) => cambiar('bank_name', evento.target.value)}
                maxLength={120}
              />
            </label>
            <label>
              Titular
              <input
                value={datos.account_holder}
                onChange={(evento) => cambiar('account_holder', evento.target.value)}
                maxLength={120}
              />
            </label>
          </div>

          <div className="panelFormularioFila">
            <label>
              Número de cuenta
              <input
                value={datos.account_number}
                onChange={(evento) => cambiar('account_number', evento.target.value)}
                maxLength={120}
              />
            </label>
            <label>
              Teléfono
              <input
                value={datos.account_phone}
                onChange={(evento) => cambiar('account_phone', evento.target.value)}
                maxLength={120}
              />
            </label>
          </div>

          <div className="panelFormularioFila">
            <label>
              Documento / RIF
              <input
                value={datos.account_document}
                onChange={(evento) => cambiar('account_document', evento.target.value)}
                maxLength={120}
              />
            </label>
            <label>
              Orden de visualización
              <input
                type="number"
                value={datos.display_order}
                onChange={(evento) => cambiar('display_order', evento.target.value)}
                min={0}
                step={1}
              />
            </label>
          </div>

          <label>
            Estado
            <select
              value={datos.status}
              onChange={(evento) => cambiar('status', evento.target.value)}
            >
              <option value="enabled">Habilitado</option>
              <option value="disabled">Deshabilitado</option>
              <option value="setup_required">Configuración pendiente</option>
            </select>
          </label>

          <div className="panelModalAcciones">
            <button type="button" className="panelModalCancelar" onClick={alCerrar}>
              Cancelar
            </button>
            <button type="submit" className="panelModalGuardar" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ModalEditarMetodo;
