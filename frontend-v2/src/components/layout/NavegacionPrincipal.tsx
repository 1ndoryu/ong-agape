import BotonEnlace from '../ui/BotonEnlace';
import './NavegacionPrincipal.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';

function NavegacionPrincipal() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <header className="encabezadoPrincipal">
      <nav className={`navegacionPrincipal contenedor ${menuAbierto ? 'navegacionPrincipal--abierta' : ''}`} aria-label="Navegación principal">
        <Link className="marcaAgape" to="/#inicio" aria-label="El Proyecto Ágape, inicio" onClick={cerrarMenu}>
          <img className="logoAgape" src="/imagenes/Logo%20Agape.svg" alt="El Proyecto Ágape" />
        </Link>

        <button
          className="botonMenu"
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
          <a href="mailto:hola@elproyectoagape.org" onClick={cerrarMenu}>Contacto</a>
          <BotonEnlace href="mailto:hola@elproyectoagape.org?subject=Quiero%20ayudar" variante="contorno">
            Quiero ayudar
          </BotonEnlace>
        </div>

        <BotonEnlace href="mailto:hola@elproyectoagape.org?subject=Quiero%20ayudar" variante="contorno" className="botonAyudaPrincipal">
          Quiero ayudar
        </BotonEnlace>
      </nav>
    </header>
  );
}

export default NavegacionPrincipal;
