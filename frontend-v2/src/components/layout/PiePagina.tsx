import BotonEnlace from '../ui/BotonEnlace';
import './PiePagina.css';

function PiePagina() {
  return (
    <footer className="piePagina">
      <div className="piePaginaContenido contenedor">
        <div className="piePaginaMarca">
          <a className="piePaginaMarcaEnlace" href="#inicio" aria-label="El Proyecto Ágape, inicio">
            <img className="logoAgapePie" src="/imagenes/Logo%20Agape.svg" alt="El Proyecto Ágape" />
          </a>
          <p className="piePaginaDescripcion">
            Acompañamos a familias y comunidades para convertir la solidaridad en ayuda cercana,
            digna y transparente.
          </p>
        </div>

        <nav className="piePaginaNavegacion" aria-label="Navegación del pie">
          <p className="piePaginaTitulo">Explora</p>
          <a href="#inicio">Inicio</a>
          <a href="#mision">Nuestra misión</a>
          <a href="#blog">Blog</a>
          <a href="mailto:hola@elproyectoagape.org">Contacto</a>
        </nav>

        <div className="piePaginaContacto">
          <p className="piePaginaTitulo">Suma tu ayuda</p>
          <p className="piePaginaTextoContacto">
            Cada acción abre oportunidades para escuchar y acompañar a más familias.
          </p>
          <BotonEnlace href="mailto:hola@elproyectoagape.org?subject=Quiero%20ayudar">
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
