import { useRef, useState, type DragEvent } from 'react';
import './SubirArchivo.css';

/* Selector de archivo atómico y reutilizable: una zona de arrastre con
 * aspecto de tarjeta que, al pulsarla o soltar un archivo encima, abre el
 * selector nativo. Cuando hay archivo elegido muestra su nombre y tamaño y
 * permite quitarlo. El input real queda oculto pero accesible (aria-label y
 * apertura por teclado desde el botón). */
function SubirArchivo({
  aceptar,
  archivo,
  alCambiar,
  etiqueta,
}: {
  aceptar: string;
  archivo: File | null;
  alCambiar: (archivo: File | null) => void;
  etiqueta: string;
}) {
  const entradaRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const formatearTamano = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const alSoltar = (evento: DragEvent<HTMLDivElement>) => {
    evento.preventDefault();
    setArrastrando(false);
    const archivoSoltado = evento.dataTransfer.files?.[0] ?? null;
    if (archivoSoltado) alCambiar(archivoSoltado);
  };

  const quitarArchivo = () => {
    alCambiar(null);
    if (entradaRef.current) entradaRef.current.value = '';
  };

  return (
    <div
      className={`subirArchivo${arrastrando ? ' subirArchivo--arrastrando' : ''}`}
      onDragOver={(evento) => {
        evento.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={alSoltar}
    >
      <input
        ref={entradaRef}
        type="file"
        className="subirArchivoEntrada"
        accept={aceptar}
        onChange={(evento) => {
          alCambiar(evento.target.files?.[0] ?? null);
          /* Permite volver a seleccionar el mismo archivo tras quitarlo. */
          evento.target.value = '';
        }}
        aria-label={etiqueta}
      />
      {archivo ? (
        <div className="subirArchivoArchivo" role="status">
          <span className="subirArchivoIcono" aria-hidden="true">
            {/* Icono de documento: el archivo ya está adjuntado. */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          </span>
          <span className="subirArchivoDatos">
            <strong>{archivo.name}</strong>
            <small>{formatearTamano(archivo.size)}</small>
          </span>
          <button
            type="button"
            className="subirArchivoQuitar"
            onClick={quitarArchivo}
            aria-label="Quitar archivo adjuntado"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="subirArchivoZona"
          onClick={() => entradaRef.current?.click()}
        >
          <span className="subirArchivoIcono" aria-hidden="true">
            {/* Icono de subida: invita a adjuntar la captura o el PDF. */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16V4" />
              <path d="M6 10l6-6 6 6" />
              <path d="M4 20h16" />
            </svg>
          </span>
          <strong>Adjunta tu comprobante</strong>
          <span>Haz clic o arrastra la captura o el PDF aquí</span>
        </button>
      )}
    </div>
  );
}

export default SubirArchivo;
