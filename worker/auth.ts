import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export type Identity = { id: string; email: string; expiresAt: number };
export function allowedEmails(value?: string): string[] {
  const emails = (value ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (emails.length !== 2 || new Set(emails).size !== 2 || emails.some(s => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) throw new Error('Configura los dos correos de la casa.');
  return emails;
}
export function identityFromClaims(payload: JWTPayload, allowlist: string[], now = Date.now()): Identity {
  const seconds = now / 1000;
  if (!payload.sub || payload.sub.length > 128 || !payload.exp || payload.exp <= seconds || !payload.iat || payload.iat > seconds + 30
    || typeof payload.auth_time !== 'number' || payload.auth_time > seconds + 30 || payload.auth_time <= 0
    || typeof payload.email !== 'string' || payload.email_verified !== true
    || !allowlist.includes(payload.email.toLowerCase())) throw new Error('Acceso no autorizado.');
  return { id: payload.sub, email: payload.email.toLowerCase(), expiresAt: payload.exp * 1000 };
}
export async function authenticate(request: Request, projectId: string, allowlist: string[]): Promise<Identity> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ') || header.length > 10000) throw new Error('Inicia sesión para entrar.');
  const { payload } = await jwtVerify(header.slice(7), googleKeys, { algorithms: ['RS256'], issuer: `https://securetoken.google.com/${projectId}`, audience: projectId, requiredClaims: ['sub', 'exp', 'iat', 'auth_time'] });
  return identityFromClaims(payload, allowlist);
}
