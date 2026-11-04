import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseVariables(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*([A-Z_][A-Z\d_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]];
  }));
}

export function validateSetup(frontend, backend) {
  const errors = [];
  const allowed = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'];
  if (Object.keys(frontend).some(key => key.startsWith('VITE_') && !allowed.includes(key))) errors.push('Variable VITE_ no prevista: revisa que no exponga datos del servidor.');
  if (!/^AIza[A-Za-z0-9_-]{35}$/.test(frontend.VITE_FIREBASE_API_KEY ?? '')) errors.push('Falta una apiKey web Firebase con formato válido.');
  if (!/^[a-z][a-z\d-]{4,28}[a-z\d]$/.test(frontend.VITE_FIREBASE_PROJECT_ID ?? '')) errors.push('Revisa el projectId de Firebase.');
  if (!/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}$/i.test(frontend.VITE_FIREBASE_AUTH_DOMAIN ?? '')) errors.push('authDomain debe ser un hostname, sin protocolo, puerto ni ruta.');
  if (!backend.FIREBASE_PROJECT_ID || backend.FIREBASE_PROJECT_ID !== frontend.VITE_FIREBASE_PROJECT_ID) errors.push('El proyecto Firebase del frontend y el backend debe coincidir.');
  const emails = (backend.ALLOWED_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase());
  if (emails.length !== 2 || new Set(emails).size !== 2 || emails.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /@example\.(com|org|net)$/i.test(value))) errors.push('ALLOWED_EMAILS debe contener exactamente dos correos reales y distintos.');
  if (Object.keys(backend).some(key => !['FIREBASE_PROJECT_ID', 'ALLOWED_EMAILS'].includes(key))) errors.push('La configuración del backend contiene variables no necesarias para esta instalación.');
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const errors = validateSetup(parseVariables(readFileSync('.env.local', 'utf8')), parseVariables(readFileSync('.dev.vars', 'utf8')));
    errors.forEach(error => console.error(error));
    if (errors.length) process.exitCode = 1;
    else console.log('Configuración local coherente: Firebase web, proyecto coincidente y dos correos distintos. No se muestran valores. Falta validar los servicios y el acceso real.');
  } catch { console.error('Faltan .env.local o .dev.vars, o no se pueden leer. Sigue docs/AI_SETUP.md.'); process.exitCode = 1; }
}
