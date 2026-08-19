import './TarjetaAgape.css';
import BotonEnlace from '../../components/ui/BotonEnlace';

type TarjetaAgapeProps =
  | { tipo: 'texto'; tono?: 'crema' | 'azul'; etiqueta: string; titulo: string; tituloSegundaLinea: string; texto: string; className?: string }
  | { tipo: 'imagen'; imagen: string; descripcion: string; className?: string }
  | { tipo: 'llamado'; tono?: 'crema' | 'azul' | 'amarillo'; etiqueta: string; titulo: string; texto: string; botonTexto: string; botonHref: string; className?: string };

function TarjetaAgape(props: TarjetaAgapeProps) {
  if (props.tipo === 'imagen') {
    return (
      <article className={`tarjetaAgape tarjetaAgape--imagen ${props.className ?? ''}`.trim()}>
        <img src={props.imagen} alt={props.descripcion} />
      </article>
    );
  }

  if (props.tipo === 'llamado') {
    return (
      <article className={`tarjetaAgape tarjetaAgape--llamado tarjetaAgape--${props.tono ?? 'amarillo'} ${props.className ?? ''}`.trim()}>
        <p className="etiquetaSeccion">{props.etiqueta}</p>
        <h2>{props.titulo}</h2>
        <p className="tarjetaAgapeTexto">{props.texto}</p>
        <BotonEnlace href={props.botonHref}>{props.botonTexto}</BotonEnlace>
      </article>
    );
  }

  return (
    <article className={`tarjetaAgape tarjetaAgape--texto tarjetaAgape--${props.tono ?? 'crema'} ${props.className ?? ''}`.trim()}>
      <p className="etiquetaSeccion">{props.etiqueta}</p>
      <h2>{props.titulo}<span>{props.tituloSegundaLinea}</span></h2>
      <p className="tarjetaAgapeTexto">{props.texto}</p>
    </article>
  );
}

export default TarjetaAgape;
