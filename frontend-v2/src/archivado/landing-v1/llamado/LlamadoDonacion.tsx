import TarjetaAgape from '../TarjetaAgape';
import '../TarjetaAgape.css';

/* Llamado a donación de la landing previa (sesión de diseño archivada el 2026-08-19).
 * Se recuperó del App.tsx original porque este bloque solo vivía inline allí.
 * La clase .llamadoDonacion vive en TarjetaAgape.css (archivado). */
function LlamadoDonacion() {
  return (
    <section className="llamadoDonacion contenedor" aria-label="Donaciones">
      <TarjetaAgape
        tipo="llamado"
        tono="amarillo"
        etiqueta="03 / apoyo directo"
        titulo="Tu ayuda se convierte en oportunidades."
        texto="Cada donación nos permite acompañar a más familias y comunidades con presencia, escucha y acciones concretas."
        botonTexto="Quiero donar"
        botonHref="mailto:hola@elproyectoagape.org?subject=Quiero%20donar"
      />
    </section>
  );
}

export default LlamadoDonacion;
