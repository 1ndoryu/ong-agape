#!/usr/bin/env node
/* [118A-1] Adaptador de la etapa `sentinel-analyze` del gate ong-agame.
 *
 * `sentinel check --stages` sustituye {reportPath} por la ruta absoluta del
 * reporte dentro de reportRoot (.quality-reports/check/<task-id>/). Este
 * wrapper deriva reportRoot desde esa ruta y limita el análisis al alcance
 * del gate (changed-files.txt) cuando existe; si no, analiza el workspace
 * completo. La decisión la toma el gate con los findings: exit 0 siempre,
 * los severity "error" hacen FAIL.
 *
 * Uso: node scripts/stage-analyze.mjs <reportPath>
 */
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

/* En Windows `sentinel` es un shim .cmd que execFile no lanza. El shim
 * llama a `node <runtime>/current.js`, así que se ejecuta directamente ese
 * entrypoint (más robusto y portable que depender del shim). En Unix se
 * usa el binario `sentinel`. */
async function resolveSentinel() {
  if (process.platform !== 'win32') return { bin: 'sentinel', prefix: [] };
  const candidate = 'C:/Users/Owner/AppData/Local/GlorySentinel/current.js';
  if (await exists(candidate)) return { bin: process.execPath, prefix: [candidate] };
  return { bin: 'sentinel', prefix: [] };
}

async function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    process.stderr.write('[stage-analyze] uso: node scripts/stage-analyze.mjs <reportPath>\n');
    process.exit(2);
  }
  const reportRoot = path.dirname(reportPath);
  const changedFiles = path.join(reportRoot, 'changed-files.txt');
  const scopeFile = await exists(changedFiles) ? changedFiles : null;
  const { bin, prefix } = await resolveSentinel();

  const args = [...prefix, 'analyze', '--workspace', '.', '--format', 'json', '--output', reportPath];
  if (scopeFile) args.push('--files-from', scopeFile);

  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 170_000,
    });
    process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    process.exit(0);
  } catch (error) {
    /* analyze escribe el reporte con --output; un error de lanzamiento
     * real (no findings) se propaga como setup error (exit 2). */
    process.stderr.write(`[stage-analyze] error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`[stage-analyze] SETUP ERROR — ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
