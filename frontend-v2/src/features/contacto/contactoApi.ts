/* Cliente de la API pública de contacto. El formulario de la página /contacto
 * envía nombre, correo y mensaje; el backend los valida y los guarda en
 * contact_messages. El equipo los lee desde el panel administrativo. */

export type DatosContacto = {
  name: string;
  email: string;
  message: string;
};

export type MensajeContactoGuardado = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export async function enviarMensajeContacto(datos: DatosContacto): Promise<MensajeContactoGuardado> {
  const respuesta = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | (MensajeContactoGuardado & { message?: string; error?: string })
    | null;
  if (!respuesta.ok) {
    throw new Error(cuerpo?.message ?? cuerpo?.error ?? `Error ${respuesta.status} al enviar el mensaje`);
  }
  return cuerpo as MensajeContactoGuardado;
}
