import './MisionAgape.css';
import TarjetaAgape from '../TarjetaAgape';

function MisionAgape() {
  return (
    <section className="misionAgape" id="mision">
      <div className="contenedor misionAgapeGrid">
        <TarjetaAgape tipo="texto" tono="crema" etiqueta="01 / nuestra misión" titulo="El amor también" tituloSegundaLinea="se organiza." texto="Ágape nace de una forma de amar que se demuestra con hechos. Acompañamos a comunidades, articulamos voluntades y convertimos la solidaridad en acciones que se pueden sentir. Cada encuentro abre oportunidades para escuchar y acompañar." />
        <TarjetaAgape tipo="imagen" imagen="/imagenes/mision-agape-unsplash.webp" descripcion="Niño sonriente con camiseta blanca, fotografía de Unsplash" />
      </div>
    </section>
  );
}

export default MisionAgape;
