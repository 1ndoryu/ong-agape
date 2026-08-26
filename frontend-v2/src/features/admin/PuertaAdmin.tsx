import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  borrarToken,
  credencialesDesarrollo,
  guardarToken,
  iniciarSesion,
  leerToken,
  obtenerPerfil,
  type PerfilAdmin,
} from './apiAdmin';
import AlertaPanel from '../../components/ui/AlertaPanel';
import './PanelAdmin.css';

/* Puerta de acceso del panel: valida el token de sessionStorage contra
 * /api/admin/me y ofrece el formulario de login. Patrón render-prop igual que
 * AdminAuthGate en la v1, para que cada pestaña reciba perfil+token listos. */
function PuertaAdmin({ children }: { children: (perfil: PerfilAdmin, token: string) => ReactNode }) {
  const [estado, setEstado] = useState<
    { tipo: 'verificando' } | { tipo: 'login' } | { tipo: 'listo'; perfil: PerfilAdmin; token: string }
  >({ tipo: 'verificando' });
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  /* En desarrollo (vite dev) la sesión se abre sola con las credenciales de
   * .env para no teclear la contraseña a cada rato; si no hay configuración
   * o falla, se cae al formulario de login. En producción este camino no
   * existe (credencialesDesarrollo devuelve null). */
  async function autoEntrar() {
    const credenciales = credencialesDesarrollo();
    if (!credenciales) {
      setEstado({ tipo: 'login' });
      return;
    }
    try {
      const respuesta = await iniciarSesion(credenciales.correo, credenciales.clave);
      guardarToken(respuesta.token);
      const perfil = await obtenerPerfil(respuesta.token);
      setEstado({ tipo: 'listo', perfil, token: respuesta.token });
    } catch {
      setEstado({ tipo: 'login' });
    }
  }

  useEffect(() => {
    const token = leerToken();
    if (!token) {
      autoEntrar();
      return;
    }
    obtenerPerfil(token)
      .then((perfil) => setEstado({ tipo: 'listo', perfil, token }))
      .catch(() => {
        borrarToken();
        autoEntrar();
      });
  }, []);

  const entrar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await iniciarSesion(correo.trim(), clave);
      guardarToken(respuesta.token);
      const perfil = await obtenerPerfil(respuesta.token);
      setEstado({ tipo: 'listo', perfil, token: respuesta.token });
    } catch (errorLogin) {
      setError(errorLogin instanceof Error ? errorLogin.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  };

  if (estado.tipo === 'verificando') {
    return <p className="panelEstado">Verificando sesión…</p>;
  }

  if (estado.tipo === 'login') {
    return (
      <form className="panelLogin" onSubmit={entrar}>
        <p className="etiquetaDonar">Acceso restringido</p>
        <label>
          Correo
          <input
            type="email"
            required
            autoComplete="username"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            required
            autoComplete="current-password"
            value={clave}
            onChange={(evento) => setClave(evento.target.value)}
          />
        </label>
        {error && (
          <AlertaPanel tipo="error">
            {error}
          </AlertaPanel>
        )}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    );
  }

  return <>{children(estado.perfil, estado.token)}</>;
}

export default PuertaAdmin;
