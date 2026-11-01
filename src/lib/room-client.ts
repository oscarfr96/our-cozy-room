import { z } from 'zod';
import { applyAction, normalizeRoom, avatarSchema, emptyRoom, newMember, type Action, type RoomState, type Snapshot } from '../../shared/model';
import type { User } from 'firebase/auth';
import { petsSchema } from '../../shared/pets';
import { televisionSchema } from '../../shared/media';

export type Connection = 'local' | 'connecting' | 'online' | 'offline' | 'replaced' | 'denied';
export type RoomClient = { send: (action: Action) => boolean; close: () => void };
const storedSchema = z.object({
  version: z.literal(1), layoutRevision: z.number().optional(), pets: petsSchema.optional(), revision: z.number().int(),
  television: televisionSchema.nullable().default(null),
  members: z.record(z.string(), z.object({ id: z.string(), name: z.string().max(24), avatar: avatarSchema, position: z.object({ x: z.number().int().min(0).max(11), y: z.number().int().min(0).max(9) }), seat: z.string().nullable(),
    focus: z.object({ title: z.string().max(80), duration: z.number().positive(), remaining: z.number().nonnegative(), endsAt: z.number().nullable(), revision: z.number().int() }).nullable() })),
  messages: z.array(z.object({ id: z.string(), memberId: z.string(), text: z.string().max(180), at: z.number() })).max(50),
});
export function localClient(onSnapshot: (s: Snapshot) => void, onError: (s: string) => void): RoomClient {
  let state: RoomState = emptyRoom(); state.members.local = newMember('local');
  try {
    const saved = localStorage.getItem('cozy.preview.v1');
    if (saved) { const parsed = storedSchema.safeParse(JSON.parse(saved)); if (parsed.success && parsed.data.members.local) { state = normalizeRoom(parsed.data, Date.now()); localStorage.setItem('cozy.preview.v1', JSON.stringify(state)); } }
  } catch { onError('No se pudo recuperar la vista local. Puedes seguir explorando.'); }
  const publish = () => onSnapshot({ type: 'snapshot', state, online: ['local'], now: Date.now(), selfId: 'local' });
  publish();
  return {
    send(action) {
      try { state = applyAction(state, 'local', action, Date.now()); publish(); }
      catch (error) { onError(error instanceof Error ? error.message : 'No se pudo realizar la acción.'); return false; }
      try { localStorage.setItem('cozy.preview.v1', JSON.stringify(state)); }
      catch { onError('El navegador no permite guardar los cambios. Se conservarán solo en esta pestaña.'); }
      return true;
    }, close() {},
  };
}
export function remoteClient(user: User, onSnapshot: (s: Snapshot) => void, onStatus: (s: Connection) => void, onError: (s: string) => void): RoomClient {
  let socket: WebSocket | null = null, stopped = false, retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined, refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  const schedule = () => { if (!stopped) retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++) + Math.random() * 500); };
  async function connect() {
    if (stopped) return;
    onStatus('connecting'); controller = new AbortController();
    try {
      const token = await user.getIdToken(true);
      if (stopped) return;
      const response = await fetch('/api/connect', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const data = await response.json() as { ticket?: string; expiresAt?: number; error?: string };
      if (!response.ok || !data.ticket) {
        const denied = response.status === 401 || response.status === 403;
        onError(data.error ?? 'No se pudo abrir la casa.'); onStatus(denied ? 'denied' : 'offline');
        if (!denied) schedule();
        return;
      }
      if (stopped) return;
      const url = new URL('/api/room', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('ticket', data.ticket);
      socket = new WebSocket(url);
      socket.onopen = () => { retry = 0; onStatus('online'); refreshTimer = setTimeout(() => socket?.close(4000, 'Renovar sesión'), Math.max(1000, (data.expiresAt ?? Date.now() + 300000) - Date.now() - 60000)); };
      socket.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === 'snapshot') onSnapshot(message as Snapshot); else if (message.type === 'error') onError(message.message); } catch { onError('No se pudo leer la respuesta de la casa.'); } };
      socket.onclose = event => { clearTimeout(refreshTimer); if (stopped) return; if (event.code === 4001) { onStatus('replaced'); onError('La casa está abierta en otra pestaña. Recarga para volver aquí.'); return; } onStatus('offline'); schedule(); };
      socket.onerror = () => onStatus('offline');
    } catch { if (!stopped) { onStatus('offline'); onError('No hay conexión con la casa. Volveremos a intentarlo.'); schedule(); } }
  }
  void connect();
  return {
    send(action) { if (socket?.readyState !== WebSocket.OPEN) { onError('Espera a que vuelva la conexión para realizar cambios.'); return false; } socket.send(JSON.stringify(action)); return true; },
    close() { stopped = true; controller?.abort(); clearTimeout(retryTimer); clearTimeout(refreshTimer); socket?.close(1000, 'Hasta pronto'); },
  };
}
