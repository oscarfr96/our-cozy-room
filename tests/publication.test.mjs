import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { auditPublic, inspectText, privatePath } from '../scripts/check-public.mjs';
import { parseVariables, validateSetup } from '../scripts/check-setup.mjs';

const gitAvailable = (() => { try { execFileSync('git', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; } })();

describe('Protección del repositorio público', () => {
  it('rechaza configuración, estado y credenciales incluso si se fuerzan a Git', () => {
    for (const file of ['.env.local', 'sub/.env.example', '.env.backup', '.dev.vars.old', '.wrangler/state/main.sqlite', '.local/setup-status.md', 'account-service-account.json', 'identity.pfx', '.npmrc', 'PLAN_MAESTRO.md']) expect(privatePath(file)).toBe(true);
    for (const file of ['AGENTS.md', '.env.example', '.dev.vars.example', 'docs/AI_SETUP.md', 'src/App.tsx']) expect(privatePath(file)).toBe(false);
  });

  it('detecta tokens y valores locales sin devolver el contenido sensible', () => {
    const token = 'ghp_' + 'a'.repeat(36);
    const finding = inspectText(token);
    expect(finding).toContain('token GitHub');
    expect(JSON.stringify(finding)).not.toContain(token);
    expect(inspectText('prefijo valor-de-prueba sufijo', ['valor-de-prueba'])).toContain('valor de configuración local');
    expect(inspectText(['-----BEGIN', 'PRIVATE KEY-----'].join(' '))).toContain('clave privada');
    expect(inspectText('ALLOWED_EMAILS=person-a@example.com,person-b@example.com')).toEqual([]);
  });

  it.skipIf(!gitAvailable)('detecta una clave eliminada del árbol actual que sigue en un commit antiguo', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'cozy-public-'));
    const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    try {
      git(['init', '-q']);
      writeFileSync(path.join(directory, '.gitignore'), '.env*\n.dev.vars*\n.local/\n.wrangler/\n');
      writeFileSync(path.join(directory, '.env.backup'), 'ghp_' + 'b'.repeat(36));
      git(['add', '.gitignore']);
      git(['add', '-f', '.env.backup']);
      writeFileSync(path.join(directory, '.dev.vars'), 'ALLOWED_EMAILS=test@example.com,other@example.com\n');
      const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com'];
      git([...identity, 'commit', '-qm', 'Fixture with an unsafe historical file']);
      unlinkSync(path.join(directory, '.env.backup'));
      git(['add', '-u']);
      git([...identity, 'commit', '-qm', 'Remove file from the current tree']);
      expect(auditPublic(directory).findings).toEqual([]);
      expect(auditPublic(directory, true).findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ file: '.env.backup', source: 'historial', reason: 'archivo privado en el historial' }),
        expect.objectContaining({ reason: 'token GitHub', source: 'historial' }),
        expect.objectContaining({ reason: 'valor de configuración local', source: 'metadatos del commit' }),
      ]));
    } finally {
      // Verify the exact temporary test root before a recursive removal on Windows.
      if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('cozy-public-')) throw new Error('Unexpected test directory');
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('Comprobación de instalación sin mostrar valores', () => {
  const frontend = { VITE_FIREBASE_API_KEY: 'AIza' + 'a'.repeat(35), VITE_FIREBASE_AUTH_DOMAIN: 'cozy-fixture.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'cozy-fixture' };
  const backend = { FIREBASE_PROJECT_ID: 'cozy-fixture', ALLOWED_EMAILS: 'first@fixture.test,second@fixture.test' };
  it('lee variables entre comillas e ignora comentarios', () => {
    expect(parseVariables('# Example\nFIREBASE_PROJECT_ID="cozy-fixture"\n')).toEqual({ FIREBASE_PROJECT_ID: 'cozy-fixture' });
    expect(validateSetup(frontend, backend)).toEqual([]);
  });
  it('rechaza proyectos distintos, direcciones repetidas, datos de ejemplo y variables privadas en VITE_', () => {
    expect(validateSetup({ ...frontend, VITE_ALLOWED_EMAILS: 'private' }, { ...backend, FIREBASE_PROJECT_ID: 'other-project' })).toHaveLength(2);
    expect(validateSetup(frontend, { ...backend, ALLOWED_EMAILS: 'same@fixture.test,SAME@fixture.test' })).not.toEqual([]);
    expect(validateSetup(frontend, { ...backend, ALLOWED_EMAILS: 'a@example.com,b@example.com' })).not.toEqual([]);
    expect(validateSetup({ ...frontend, VITE_FIREBASE_AUTH_DOMAIN: 'https://cozy-fixture.firebaseapp.com' }, backend)).not.toEqual([]);
  });
});
