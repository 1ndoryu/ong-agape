import BotonEnlace from '../ui/BotonEnlace';
import './NavegacionPrincipal.css';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function NavegacionPrincipal() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = () => setMenuAbierto(false);
  const { pathname, hash } = useLocation();

  /* El menú móvil es un overlay a pantalla completa: al navegar debe cerrarse
   * siempre, incluidos los enlaces que no llevan onClick propio (p. ej. el
   * botón "Quiero ayudar", que es un BotonEnlace). Escuchar el cambio de ruta
   * cubre todos los casos, incluida la navegación programática. */
  useEffect(() => {
    cerrarMenu();
  }, [pathname, hash]);

  return (
    <header className="encabezadoPrincipal">
      <nav className={`navegacionPrincipal contenedor ${menuAbierto ? 'navegacionPrincipal--abierta' : ''}`} aria-label="Navegación principal">
        <Link className="marcaAgape" to="/#inicio" aria-label="El Proyecto Ágape, inicio" onClick={cerrarMenu}>
          <img className="logoAgape" src="/imagenes/Logo%20Agape.svg" alt="El Proyecto Ágape" />
        </Link>

        <button
          className="menuMovil"
          type="button"
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          aria-controls="menuPrincipal"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div className="enlacesNavegacion" id="menuPrincipal">
          <Link to="/#inicio" onClick={cerrarMenu}>Inicio</Link>
          <Link to="/#nosotros" onClick={cerrarMenu}>Nuestra misión</Link>
          <Link to="/#blog" onClick={cerrarMenu}>Blog</Link>
          <Link to="/acciones" onClick={cerrarMenu}>Transparencia</Link>
          <Link to="/contacto" onClick={cerrarMenu}>Contacto</Link>
          <BotonEnlace href="/donar" interno variante="contorno" onClick={cerrarMenu}>
            Quiero ayudar
          </BotonEnlace>
        </div>

        <BotonEnlace href="/donar" interno variante="contorno" className="botonAyudaPrincipal">
          Quiero ayudar
        </BotonEnlace>
      </nav>
    </header>
  );
}

export default NavegacionPrincipal;
