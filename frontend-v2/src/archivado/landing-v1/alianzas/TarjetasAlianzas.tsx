import './TarjetasAlianzas.css';
import TarjetaAgape from '../TarjetaAgape';

function TarjetasAlianzas() {
  return (
    <section className="tarjetasAlianzas" aria-label="Comunidad y colaboración">
      <div className="contenedor tarjetasAlianzasGrid">
        <TarjetaAgape tipo="texto" tono="azul" etiqueta="02 / nuestra forma de acompañar" titulo="Cuando sumamos," tituloSegundaLinea="llegamos más lejos." texto="Conectamos personas, recursos y voluntades para acompañar a cada comunidad con presencia, escucha y acciones que abren nuevas oportunidades." />
        <TarjetaAgape tipo="imagen" imagen="/imagenes/manos-colores.webp" descripcion="Personas uniendo sus manos con jerseys de colores" />
      </div>
    </section>
  );
}

export default TarjetasAlianzas;
