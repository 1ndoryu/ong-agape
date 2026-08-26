import BotonEnlace from '../ui/BotonEnlace';
import './PiePagina.css';
import { Link } from 'react-router-dom';

function PiePagina() {
  return (
    <footer className="piePagina">
      <div className="piePaginaContenido contenedor">
        <div className="piePaginaMarca">
          <Link className="piePaginaMarcaEnlace" to="/#inicio" aria-label="El Proyecto Ágape, inicio">
            <img className="logoAgapePie" src="/imagenes/Logo%20Agape.svg" alt="El Proyecto Ágape" />
          </Link>
          <p className="piePaginaDescripcion">
            Acompañamos a familias y comunidades para convertir la solidaridad en ayuda cercana,
            digna y transparente.
          </p>
        </div>

        <nav className="piePaginaNavegacion" aria-label="Navegación del pie">
          <p className="piePaginaTitulo">Explora</p>
          <Link to="/#inicio">Inicio</Link>
          <Link to="/#nosotros">Nuestra misión</Link>
          <Link to="/#blog">Blog</Link>
          <Link to="/contacto">Contacto</Link>
        </nav>

        <div className="piePaginaContacto">
          <p className="piePaginaTitulo">Suma tu ayuda</p>
          <p className="piePaginaTextoContacto">
            Cada acción abre oportunidades para escuchar y acompañar a más familias.
          </p>
          <BotonEnlace href="/donar" interno>
            Quiero ayudar
          </BotonEnlace>
        </div>
      </div>

      <div className="piePaginaInferior">
        <div className="piePaginaInferiorContenido contenedor">
          <p>© {new Date().getFullYear()} El Proyecto Ágape · Amor en acción</p>
          <p>Venezuela</p>
        </div>
      </div>
    </footer>
  );
}

export default PiePagina;
