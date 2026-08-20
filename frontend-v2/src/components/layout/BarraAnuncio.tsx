import './BarraAnuncio.css';

function BarraAnuncio() {
  return (
    <aside className="barraAnuncio" aria-label="Invitación a colaborar">
      <p>
        Una pequeña acción puede cambiar una historia.
        <a href="mailto:hola@elproyectoagape.org?subject=Quiero%20sumarme%20a%20%C3%81gape">
          Descubre cómo sumarte <span aria-hidden="true">↗</span>
        </a>
      </p>
    </aside>
  );
}

export default BarraAnuncio;
