#!/usr/bin/env node
/* [118A-1] Adaptador de etapas del gate para ong-agame.
 *
 * Ejecuta un comando del stack (cargo check, clippy, type-check) y escribe
 * el contrato JSON que `sentinel check --stages` consume:
 *   { schemaVersion: "1", entries: [ { findings: [ { ruleId, severity, message } ] } ] }
 *
 * El proceso SIEMPRE sale con 0: los findings con severity "error" hacen
 * FAIL (exit 1 del gate). Un exit != 0 sería tool-error (SETUP ERROR) y no
 * distinguiría un fallo real del stack de un error de lanzamiento; por eso
 * solo se sale con 2 cuando el comando no puede lanzarse (setup real).
 *
 * Uso: node scripts/stage-report.mjs <reportPath> -- <cmd> [args...]
 */
import { execFile, spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const MAX_TAIL = 8000;

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

function parseArgs(argv) {
  const sep = argv.indexOf('--');
  if (sep < 1 || sep === argv.length - 1) return null;
  return { reportPath: argv[0], cmd: argv[sep + 1], cmdArgs: argv.slice(sep + 2) };
}

/* En Windows, npm y otros scripts son .cmd/.bat y no se lanzan con spawn sin
 * shell. Para node se usa process.execPath (el binario real que ejecuta este
 * script, inmune a shims). Para npm se usa `node <npm-cli.js>`. Para el
 * resto, where.exe resuelve la ruta real desde PATH, EXCLUYENDO los shims
 * interceptores de GlorySentinel (que no son el binario real y fallan con
 * EINVAL) y prefiriendo .exe/.cmd. En Unix el comando se usa tal cual. */
const SENTINEL_SHIMS = /GlorySentinel[\\/]shims[\\/]/i;

async function resolveExecutable(cmd) {
  if (process.platform !== 'win32') return { bin: cmd, prefix: [] };
  if (cmd === 'node') return { bin: process.execPath, prefix: [] };
  if (cmd === 'npm') {
    const npmCli = 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js';
    if (await exists(npmCli)) return { bin: process.execPath, prefix: [npmCli] };
    return { bin: 'npm.cmd', prefix: [] };
  }
  if (path.extname(cmd)) return { bin: cmd, prefix: [] };
  try {
    const { stdout } = await execFileAsync('where.exe', [cmd], { windowsHide: true });
    const candidates = stdout.split(/\r?\n/).map((s) => s.trim())
      .filter((s) => s && !SENTINEL_SHIMS.test(s));
    const hit = candidates.find((s) => /\.exe$/i.test(s))
      || candidates.find((s) => /\.cmd$/i.test(s))
      || candidates[0];
    return { bin: hit || cmd, prefix: [] };
  } catch {
    return { bin: cmd, prefix: [] };
  }
}

function tail(text) {
  if (text.length <= MAX_TAIL) return text;
  return `…(${text.length - MAX_TAIL} bytes omitidos)\n${text.slice(-MAX_TAIL)}`;
}

async function writeReport(reportPath, entries) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  const report = { schemaVersion: '1', entries };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    process.stderr.write('[stage-report] uso: node scripts/stage-report.mjs <reportPath> -- <cmd> [args...]\n');
    process.exit(2);
  }
  const { reportPath, cmd, cmdArgs } = parsed;
  const stage = path.basename(reportPath, '.json');
  const { bin: executable, prefix } = await resolveExecutable(cmd);

  const result = await new Promise((resolve) => {
    const child = spawn(executable, [...prefix, ...cmdArgs], {
      shell: false,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; if (stdout.length > MAX_TAIL) stdout = stdout.slice(-MAX_TAIL); });
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > MAX_TAIL) stderr = stderr.slice(-MAX_TAIL); });
    child.on('error', (err) => resolve({ code: null, error: err, stdout, stderr }));
    child.on('exit', (code) => resolve({ code, error: null, stdout, stderr }));
  });

  if (result.error) {
    process.stderr.write(`[stage-report] no se pudo lanzar ${cmd}: ${result.error.message}\n`);
    process.exit(2);
  }

  if (result.code === 0) {
    await writeReport(reportPath, []);
    process.stdout.write(`[stage-report] ${stage}: OK\n`);
    process.exit(0);
  }

  const detail = tail(`${result.stderr}\n${result.stdout}`).trim();
  const entries = [{
    findings: [{
      ruleId: `${stage}-failed`,
      severity: 'error',
      message: `${cmd} ${cmdArgs.join(' ')} terminó con código ${result.code}${detail ? `\n${detail}` : ''}`,
    }],
  }];
  await writeReport(reportPath, entries);
  process.stdout.write(`[stage-report] ${stage}: FALLÓ (código ${result.code})\n`);
  process.exit(0);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`[stage-report] SETUP ERROR — ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
