import BotonEnlace from '../../components/ui/BotonEnlace';
import './HeroInicio.css';

function HeroInicio() {
  return (
    <section className="heroInicio contenedor" id="inicio">
      <p className="etiquetaHero">Amor en acción · Venezuela</p>

      <h1>
        Cuando nos unimos,
        <span className="lineaHero">
          el amor{' '}
          <img
            className="retratoHero retratoHero--imagen"
            src="/imagenes/Recurso 1.png"
            alt=""
            aria-hidden="true"
          />{' '}
          se convierte
        </span>
        <span className="lineaHero">
          en oportunidades{' '}
          <img
            className="retratoHero retratoHero--imagen"
            src="/imagenes/Recurso 2.png"
            alt=""
            aria-hidden="true"
          />
        </span>
      </h1>

      <p className="descripcionHero">
        Acompañamos a familias y comunidades para convertir la solidaridad en ayuda cercana,
        digna y transparente.
      </p>

      <div className="accionesHero">
        <BotonEnlace href="mailto:hola@elproyectoagape.org?subject=Quiero%20ser%20parte">
          Sé parte del cambio
        </BotonEnlace>
        <BotonEnlace href="/#nosotros" variante="contorno">
          Conoce nuestra misión
        </BotonEnlace>
      </div>
    </section>
  );
}

export default HeroInicio;
