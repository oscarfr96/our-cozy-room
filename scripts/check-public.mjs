import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const examples = new Set(['.env.example', '.dev.vars.example']);
const privateDirectories = new Set(['.local', '.wrangler', '.firebase', '.agents', '.codex', '.aws', '.secrets', 'secrets', 'node_modules', 'dist', 'coverage', 'test-results']);

export function privatePath(file) {
  const parts = file.replaceAll('\\', '/').split('/');
  const name = parts.at(-1);
  if (parts.some(part => privateDirectories.has(part))) return true;
  if (name === 'PLAN_MAESTRO.md' || name === '.npmrc') return true;
  if (/^\.env/i.test(name) || /^\.dev\.vars/i.test(name)) return !(parts.length === 1 && examples.has(name));
  return /\.(?:pem|key|p12|pfx|sqlite(?:3)?(?:-wal|-shm)?|db)$/i.test(name)
    || /service[-_]?account.*\.json$|firebase-adminsdk.*\.json$/i.test(name);
}

export function inspectText(text, privateValues = []) {
  const found = new Set();
  if (privateValues.some(value => value.length >= 6 && text.includes(value))) found.add('valor de configuración local');
  const patterns = [
    ['clave privada', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
    ['token GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
    ['clave de proveedor', /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{30,}|AIza[A-Za-z0-9_-]{35}|AKIA[A-Z0-9]{16})\b/],
    ['token JWT', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/],
    ['credencial literal', /(?:CLOUDFLARE_API_TOKEN|FIREBASE_PRIVATE_KEY|OPENAI_API_KEY|GITHUB_TOKEN|GH_TOKEN|AWS_SECRET_ACCESS_KEY|client_secret|private_key)\s*["']?\s*[:=]\s*["'][A-Za-z0-9_+\/=.-]{20,}["']/i],
    ['lista real de acceso', /\bALLOWED_EMAILS\s*=\s*["']?[^\r\n]*[A-Z0-9._%+-]+@(?!example\.(?:com|org|net)\b)[A-Z0-9.-]+\.[A-Z]{2,}/i],
    ['ruta personal absoluta', /(?:[A-Z]:[\\/]Users[\\/]|\/(?:Users|home)\/)[^\s<>"']+/i],
  ];
  for (const [label, pattern] of patterns) if (pattern.test(text)) found.add(label);
  return [...found];
}

function git(args, cwd, options = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options });
}

function localValues(cwd) {
  const values = [];
  for (const name of ['.env.local', '.dev.vars']) {
    const file = path.join(cwd, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!/^\s*[A-Z_]+\s*=/.test(line)) continue;
      const value = line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      values.push(...value.split(',').map(value => value.trim()).filter(value => value.length >= 6));
    }
  }
  return values;
}

function zipFiles(cwd, prefix = '') {
  return readdirSync(path.join(cwd, prefix), { withFileTypes: true }).flatMap(entry => {
    const file = prefix + entry.name;
    if (entry.name === '.git' || privatePath(file)) return [];
    return entry.isDirectory() ? zipFiles(cwd, file + '/') : [file];
  });
}

export function auditPublic(cwd, history = false) {
  const values = localValues(cwd), findings = [];
  const record = (file, reason, source = 'archivos') => findings.push({ file, reason, source });
  let inGit = false;
  try { inGit = path.resolve(git(['rev-parse', '--show-toplevel'], cwd).trim()) === path.resolve(cwd); }
  catch { if (existsSync(path.join(cwd, '.git'))) throw new Error('Git es necesario para revisar este historial.'); }
  const files = inGit
    ? [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd).split('\0').filter(file => file && existsSync(path.join(cwd, file))))]
    : zipFiles(cwd);
  for (const file of files) {
    if (privatePath(file)) record(file, 'archivo privado incluido');
    const location = path.join(cwd, file);
    if (lstatSync(location).isSymbolicLink()) { record(file, 'enlace simbólico: revisar el destino antes de publicar'); continue; }
    for (const reason of inspectText(readFileSync(location, 'utf8'), values)) record(file, reason);
    if (!file.endsWith('.md')) continue;
    const prose = readFileSync(location, 'utf8').replace(/```[\s\S]*?```/g, '');
    for (const match of prose.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].replace(/^<|>$/g, '').split(/[?#]/)[0];
      if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
      if (!files.includes(resolved)) record(file, 'enlace local ausente del conjunto público');
    }
  }
  if (inGit) {
    for (const name of ['.env.local', '.dev.vars', '.local/setup-status.md', '.wrangler/state/example.sqlite']) {
      try { git(['check-ignore', '-q', '--', name], cwd); } catch { record(name, 'falta protección en .gitignore'); }
    }
  }
  let blobs = 0;
  if (history && inGit) {
    let objects = [];
    try { objects = git(['rev-list', '--objects', '--all'], cwd).trim().split('\n').filter(Boolean); } catch { /* New repository without commits. */ }
    if (objects.length) {
      const types = git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], cwd, { input: objects.map(line => line.split(' ')[0]).join('\n') + '\n' }).trim().split('\n');
      for (let index = 0; index < objects.length; index++) {
        if (!types[index].endsWith(' blob')) continue;
        const separator = objects[index].indexOf(' '), file = objects[index].slice(separator + 1);
        blobs++;
        if (privatePath(file)) record(file, 'archivo privado en el historial', 'historial');
        for (const reason of inspectText(git(['cat-file', 'blob', objects[index].slice(0, separator)], cwd), values)) record(file, reason, 'historial');
      }
    }
  }
  const redact = value => values.reduce((result, secret) => result.replaceAll(secret, '[redactado]'), value);
  return { mode: inGit ? 'git' : 'zip', files: files.length, historyBlobs: blobs, findings: findings.map(item => ({ ...item, file: redact(item.file) })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const report = auditPublic(process.cwd(), process.argv.includes('--history'));
    console.log(`Revisión pública (${report.mode}): ${report.files} archivos; ${report.historyBlobs} objetos históricos.`);
    for (const finding of report.findings) console.error(`${finding.source}: ${finding.file} — ${finding.reason}`);
    if (report.findings.length) { console.error('Revisión detenida. Corrige los hallazgos antes de publicar. No se muestran valores.'); process.exitCode = 1; }
    else console.log('Sin coincidencias en las comprobaciones de archivos, patrones y valores locales. Esto no sustituye la revisión humana de capturas y datos.');
  } catch { console.error('No se pudo completar la revisión pública. Comprueba Git y los permisos de lectura.'); process.exitCode = 1; }
}
