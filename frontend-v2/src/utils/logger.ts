/* Logger central del frontend-v2.
 * Toda salida a consola en código de producción pasa por aquí (boundary
 * `portableBoundaries.loggerModules` en sentinel.config.json). Permite
 * centralizar nivel/suprimir ruido en producción sin borrar logs útiles. */

export function error(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error(...args);
}

export function warn(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.warn(...args);
}

export function info(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.info(...args);
}
