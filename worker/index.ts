import { DurableObject } from 'cloudflare:workers';
import { applyAction, normalizeRoom, emptyRoom, newMember, type RoomState } from '../shared/model';
import { allowedEmails, authenticate, type Identity } from './auth';

interface Env { ROOM: DurableObjectNamespace<CozyRoom>; ASSETS: Fetcher; FIREBASE_PROJECT_ID?: string; ALLOWED_EMAILS?: string }
type Attachment = Identity & { windowStart: number; count: number };
type Ticket = { value: string; expiresAt: number; identity: Identity };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health') return json({ status: 'ok', configured: !!env.FIREBASE_PROJECT_ID && !!env.ALLOWED_EMAILS });
    let emails: string[];
    try { emails = allowedEmails(env.ALLOWED_EMAILS); if (!env.FIREBASE_PROJECT_ID) throw new Error(); }
    catch { return json({ error: 'La casa todavía no tiene configurado el acceso privado.' }, 503); }
    // Both API calls and browser WebSocket handshakes must originate at this installation.
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'Origen no autorizado.' }, 403);
    const room = env.ROOM.get(env.ROOM.idFromName('home'));
    if (url.pathname === '/api/connect' && request.method === 'POST') {
      try {
        const identity = await authenticate(request, env.FIREBASE_PROJECT_ID!, emails);
        return json(await room.issueTicket(identity));
      } catch { return json({ error: 'No puedes entrar. Comprueba que tu correo está verificado y autorizado para esta casa.' }, 403); }
    }
    if (url.pathname === '/api/room' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return room.fetch(request);
    return json({ error: 'Ruta no disponible.' }, 404);
  },
} satisfies ExportedHandler<Env>;

export class CozyRoom extends DurableObject<Env> {
  private room: RoomState = emptyRoom();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { const saved=await ctx.storage.get<RoomState>('state');this.room=normalizeRoom(saved??emptyRoom(),Date.now());if(saved&&JSON.stringify(saved)!==JSON.stringify(this.room))await ctx.storage.put('state',this.room); });
  }
  async issueTicket(identity: Identity) {
    if (!allowedEmails(this.env.ALLOWED_EMAILS).includes(identity.email) || identity.expiresAt <= Date.now()) throw new Error('Unauthorized');
    if (!this.room.members[identity.id]) {
      if (Object.keys(this.room.members).length >= 2) throw new Error('House full');
      const next = structuredClone(this.room);
      next.members[identity.id] = newMember(identity.id, Object.keys(next.members).length ? 'Mi compañía' : 'Mi rincón');
      next.revision++;
      await this.ctx.storage.put('state', next); this.room = next;
    }
    const tickets = (await this.ctx.storage.get<Ticket[]>('tickets') ?? []).filter(t => t.expiresAt > Date.now() && t.identity.id !== identity.id);
    const ticket = { value: crypto.randomUUID(), expiresAt: Date.now() + 30000, identity };
    tickets.push(ticket); await this.ctx.storage.put('tickets', tickets);
    return { ticket: ticket.value, expiresAt: identity.expiresAt };
  }
  async fetch(request: Request) {
    const value = new URL(request.url).searchParams.get('ticket');
    const tickets = await this.ctx.storage.get<Ticket[]>('tickets') ?? [];
    const ticket = tickets.find(t => t.value === value && t.expiresAt > Date.now() && t.identity.expiresAt > Date.now());
    if (!ticket || !allowedEmails(this.env.ALLOWED_EMAILS).includes(ticket.identity.email)) return json({ error: 'Acceso caducado.' }, 403);
    await this.ctx.storage.put('tickets', tickets.filter(t => t.value !== value && t.expiresAt > Date.now()));
    for (const socket of this.ctx.getWebSockets(ticket.identity.id)) socket.close(4001, 'Abierto en otra pestaña.');
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [ticket.identity.id]);
    server.serializeAttachment({ ...ticket.identity, windowStart: Date.now(), count: 0 } satisfies Attachment);
    server.send(JSON.stringify(this.snapshot(ticket.identity.id)));
    this.broadcast();
    await this.scheduleExpiry();
    return new Response(null, { status: 101, webSocket: client });
  }
  private snapshot(selfId?: string) {
    const now = Date.now();
    return { type: 'snapshot', state: { ...this.room, messages: this.room.messages.filter(m => now - m.at < 86400000).slice(-10) }, online: this.online(), now, selfId };
  }
  private online(): string[] {
    return [...new Set(this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN).map(ws => ws.deserializeAttachment() as Attachment).filter(a => a.expiresAt > Date.now() && allowedEmails(this.env.ALLOWED_EMAILS).includes(a.email)).map(a => a.id))];
  }
  private broadcast() {
    const data = JSON.stringify(this.snapshot());
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment;
      if (attachment.expiresAt <= Date.now() || !allowedEmails(this.env.ALLOWED_EMAILS).includes(attachment.email)) { ws.close(4003, 'Vuelve a iniciar sesión.'); continue; }
      try { ws.send(data); } catch { ws.close(1011, 'Reconectando.'); }
    }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const attachment = ws.deserializeAttachment() as Attachment; const now = Date.now();
    if (attachment.expiresAt <= now || !allowedEmails(this.env.ALLOWED_EMAILS).includes(attachment.email)) { ws.close(4003, 'Acceso caducado.'); return; }
    if (typeof message !== 'string' || message.length > 2048) { ws.close(1009, 'Mensaje demasiado grande.'); return; }
    if (now - attachment.windowStart > 10000) { attachment.count = 0; attachment.windowStart = now; }
    attachment.count++; ws.serializeAttachment(attachment);
    if (attachment.count > 30) { ws.send(JSON.stringify({ type: 'error', message: 'Un poquito más despacio…' })); return; }
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'hug' && !this.online().includes(parsed.target)) throw new Error('Tu pareja no está conectada.');
      const next = applyAction(this.room, attachment.id, parsed, now);
      await this.ctx.storage.put('state', next); this.room = next; this.broadcast();
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error instanceof Error && error.name !== 'ZodError' ? error.message : 'No se pudo realizar esa acción.' }));
    }
  }
  async webSocketClose(ws: WebSocket, code: number, reason: string) { ws.close(code, reason); this.broadcast(); }
  async webSocketError(ws: WebSocket) { ws.close(1011, 'Conexión interrumpida.'); this.broadcast(); }
  private async scheduleExpiry() {
    const expiries = this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN).map(ws => (ws.deserializeAttachment() as Attachment).expiresAt);
    if (expiries.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, Math.min(...expiries)));
  }
  async alarm() { this.broadcast(); await this.scheduleExpiry(); }
}
