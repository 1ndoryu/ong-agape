import { useState } from 'react';
import { Link } from 'react-router-dom';
import PuertaAdmin from './PuertaAdmin';
import { borrarToken } from './apiAdmin';
import { ETIQUETAS_ROL } from './permisos';
import ToastProvider from '../../components/ui/Toast';
import ConfirmarProvider from '../../components/ui/Confirmar';
import VistaResumen from './VistaResumen';
import VistaMetodos from './VistaMetodos';
import VistaRecibos from './VistaRecibos';
import VistaBlog from './VistaBlog';
import VistaAliados from './VistaAliados';
import VistaCampanas from './VistaCampanas';
import VistaHistoria from './VistaHistoria';
import VistaAcciones from './VistaAcciones';
import VistaMensajes from './VistaMensajes';
import './PanelAdmin.css';

type PestanaId = 'resumen' | 'recibos' | 'metodos' | 'blog' | 'aliados' | 'campanas' | 'historia' | 'acciones' | 'mensajes';

const PESTANAS: { id: PestanaId; etiqueta: string }[] = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'recibos', etiqueta: 'Recibos de pago' },
  { id: 'metodos', etiqueta: 'Métodos de pago' },
  { id: 'blog', etiqueta: 'Blog' },
  { id: 'aliados', etiqueta: 'Aliados' },
  { id: 'campanas', etiqueta: 'Campañas' },
  { id: 'historia', etiqueta: 'Nuestra historia' },
  { id: 'acciones', etiqueta: 'Acciones' },
  { id: 'mensajes', etiqueta: 'Mensajes' },
];

/* Contenedor del panel administrativo v2. Cada pestaña es un componente
 * independiente; este archivo solo decide cuál renderizar según el rol y
 * mantiene la navegación y la sesión. */
function PanelAdmin() {
  const [pestana, setPestana] = useState<PestanaId>('resumen');

  return (
    <PuertaAdmin>
      {(perfil, token) => (
        <ToastProvider>
          <ConfirmarProvider>
            <div className="panelAdmin contenedor">
              <header className="panelCabecera">
                <div>
                  <h1>Panel del Proyecto Ágape</h1>
                </div>
                <div className="panelSesion">
                  <span>{perfil.email} · {ETIQUETAS_ROL[perfil.role]}</span>
                  <button
                    type="button"
                    onClick={() => {
                      borrarToken();
                      window.location.reload();
                    }}
                  >
                    Salir
                  </button>
                </div>
              </header>

              <nav className="panelPestanas" aria-label="Secciones del panel">
                {PESTANAS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={pestana === item.id ? 'page' : undefined}
                    onClick={() => setPestana(item.id)}
                  >
                    {item.etiqueta}
                  </button>
                ))}
                <Link to="/">Ver sitio público</Link>
              </nav>

              <section className="panelContenido">
                {pestana === 'resumen' && <VistaResumen token={token} />}
                {pestana === 'recibos' && <VistaRecibos perfil={perfil} token={token} />}
                {pestana === 'metodos' && <VistaMetodos perfil={perfil} token={token} />}
                {pestana === 'blog' && <VistaBlog perfil={perfil} token={token} />}
                {pestana === 'aliados' && <VistaAliados perfil={perfil} token={token} />}
                {pestana === 'campanas' && <VistaCampanas perfil={perfil} token={token} />}
                {pestana === 'historia' && <VistaHistoria perfil={perfil} token={token} />}
                {pestana === 'acciones' && <VistaAcciones perfil={perfil} token={token} />}
                {pestana === 'mensajes' && <VistaMensajes perfil={perfil} token={token} />}
              </section>
            </div>
          </ConfirmarProvider>
        </ToastProvider>
      )}
    </PuertaAdmin>
  );
}

export default PanelAdmin;
