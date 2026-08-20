import { readdir, mkdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import sharp from 'sharp';

const argumentos = new Map();
for (let indice = 2; indice < process.argv.length; indice += 2) {
  const clave = process.argv[indice]?.replace(/^--/, '');
  const valor = process.argv[indice + 1];
  if (clave && valor) argumentos.set(clave, valor);
}

const directorioEntrada = resolve(argumentos.get('input') ?? 'assets/originales');
const directorioSalida = resolve(argumentos.get('output') ?? 'public/imagenes');
const ancho = Number(argumentos.get('w') ?? 2400);
const calidad = Number(argumentos.get('q') ?? 80);
const formato = argumentos.get('fmt') ?? 'webp';

if (!Number.isInteger(ancho) || ancho < 320) {
  throw new Error('El ancho debe ser un entero mayor o igual a 320.');
}

if (!Number.isInteger(calidad) || calidad < 1 || calidad > 100) {
  throw new Error('La calidad debe ser un entero entre 1 y 100.');
}

if (formato !== 'webp') {
  throw new Error('El optimizador de Ágape solo permite formato webp.');
}

await mkdir(directorioSalida, { recursive: true });
const archivos = await readdir(directorioEntrada, { withFileTypes: true });
const fuentes = archivos.filter((archivo) => /\.(avif|jpeg|jpg|png)$/i.test(archivo.name));

if (fuentes.length === 0) {
  throw new Error(`No se encontraron imágenes compatibles en ${directorioEntrada}.`);
}

for (const fuente of fuentes) {
  const nombre = basename(fuente.name, extname(fuente.name));
  const destino = join(directorioSalida, `${nombre}.webp`);

  await sharp(join(directorioEntrada, fuente.name))
    .resize({ width: ancho, withoutEnlargement: true })
    .webp({ quality: calidad })
    .toFile(destino);

  console.log(`${fuente.name} -> ${destino} (w=${ancho}, q=${calidad}, fmt=${formato})`);
}
