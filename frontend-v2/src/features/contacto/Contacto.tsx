import { useState } from 'react';
import type { FormEvent } from 'react';
import { enviarMensajeContacto } from './contactoApi';
import './Contacto.css';

/* Página pública de contacto: un formulario sencillo (nombre, correo y
 * mensaje) que se guarda en el backend para que el equipo lo lea desde el
 * panel administrativo (pestaña "Mensajes"). No requiere login. */
function Contacto() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorEnvio(null);
    setEnviando(true);
    try {
      await enviarMensajeContacto({ name: nombre, email: correo, message: mensaje });
      setEnviado(true);
    } catch (motivo) {
      setErrorEnvio(motivo instanceof Error ? motivo.message : 'No se pudo enviar el mensaje');
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="contacto contenedor">
        <div className="contactoCabecera">
          <p className="etiquetaDonar">Contacto</p>
          <h1>¡Gracias por escribirnos!</h1>
          <p className="contactoDescripcion">
            Recibimos tu mensaje y te responderemos lo antes posible. Si es algo
            urgente, escríbenos también por nuestras redes sociales.
          </p>
        </div>
        <div className="contactoExito" role="status">
          <strong>Mensaje enviado</strong>
          <span>
            Hemos registrado tu mensaje. El equipo de El Proyecto Ágape te
            contactará pronto.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="contacto contenedor">
      <div className="contactoCabecera">
        <p className="etiquetaDonar">Contacto</p>
        <h1>Hablemos</h1>
        <p className="contactoDescripcion">
          ¿Tienes preguntas, quieres ser voluntario o colaborar con una causa?
          Escríbenos y te responderemos lo antes posible.
        </p>
      </div>

      <form className="contactoFormulario" onSubmit={manejarEnvio} noValidate>
        <div className="contactoCampos">
          <label>
            Nombre
            <input
              type="text"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              required
              maxLength={160}
              autoComplete="name"
            />
          </label>
          <label>
            Correo electrónico
            <input
              type="email"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              required
              maxLength={160}
              autoComplete="email"
            />
          </label>
          <label>
            Mensaje
            <textarea
              value={mensaje}
              onChange={(evento) => setMensaje(evento.target.value)}
              required
              maxLength={5000}
              rows={6}
            />
          </label>
        </div>

        {errorEnvio && (
          <p className="errorEnvioContacto" role="alert">{errorEnvio}</p>
        )}

        <div className="accionesContacto">
          <button
            type="submit"
            className="botonContacto"
            disabled={enviando}
          >
            {enviando ? 'Enviando…' : 'Enviar mensaje'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Contacto;
