// Uses only local workerd and a fixture JWKS. No real Firebase users or network calls.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createServer } from 'vite';

// Load the same shared TS rules used by the browser; no duplicated pet simulation.
const modules = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let petPosition;
try { ({petPosition} = await modules.ssrLoadModule('/shared/pets.ts')); }
finally { await modules.close(); }

const { privateKey, publicKey } = await generateKeyPair('RS256');
const publicJwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
const storage = resolve('.wrangler', `integration-${randomUUID()}`);
const options = {
  modules: true, scriptPath: resolve('.wrangler/test-bundle/index.js'), compatibilityDate: '2026-10-01',
  bindings: { FIREBASE_PROJECT_ID: 'cozy-test', ALLOWED_EMAILS: 'a@example.com,b@example.com' },
  durableObjects: { ROOM: { className: 'CozyRoom', useSQLite: true } },
  resourcePersistencePath: storage,
  outboundService: async request => {
    assert.equal(new URL(request.url).hostname, 'www.googleapis.com');
    return Response.json({ keys: [publicJwk] }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  },
};
let mf = new Miniflare(convertV4MiniflareOptions(options));
const origin = 'http://cozy.local';
async function token(id, email, verified = true, key = privateKey, project = 'cozy-test') {
  return new SignJWT({ email, email_verified: verified, auth_time: Math.floor(Date.now() / 1000) - 5 })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setSubject(id).setIssuedAt().setExpirationTime('5m')
    .setAudience(project).setIssuer(`https://securetoken.google.com/${project}`).sign(key);
}
async function connectTicket(jwt, requestOrigin = origin) {
  return mf.dispatchFetch(`${origin}/api/connect`, { method: 'POST', headers: { Origin: requestOrigin, Authorization: `Bearer ${jwt}` } });
}
function inbox(ws) {
  const queue = [], waiters = [];
  ws.addEventListener('message', event => {
    const value = JSON.parse(event.data);
    queue.push(value);
    for (const waiter of [...waiters]) {
      const index = queue.findIndex(waiter.predicate);
      if (index >= 0) { waiters.splice(waiters.indexOf(waiter), 1); clearTimeout(waiter.timer); waiter.resolve(queue.splice(index, 1)[0]); }
    }
  });
  ws.accept();
  return predicate => {
    const index = queue.findIndex(predicate);
    if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
    return new Promise((resolveValue, reject) => { const waiter = { predicate, resolve: resolveValue, timer: null }; waiter.timer = setTimeout(() => reject(new Error('WebSocket event timed out')), 5000); waiters.push(waiter); });
  };
}
async function join(jwt) {
  const response = await connectTicket(jwt); assert.equal(response.status, 200, await response.clone().text());
  const { ticket } = await response.json();
  const upgrade = await mf.dispatchFetch(`${origin}/api/room?ticket=${ticket}`, { headers: { Origin: origin, Upgrade: 'websocket' } });
  assert.equal(upgrade.status, 101);
  const ws = upgrade.webSocket; assert.ok(ws);
  const next = inbox(ws); const initial = await next(v => v.type === 'snapshot' && v.selfId);
  return { ws, next, initial, ticket };
}
try {
  assert.equal((await mf.dispatchFetch(`${origin}/api/health`)).status, 200);
  assert.equal((await connectTicket('forged')).status, 403);
  assert.equal((await connectTicket(await token('a', 'a@example.com'), 'http://evil.local')).status, 403);
  assert.equal((await connectTicket(await token('stranger', 'stranger@example.com'))).status, 403);
  assert.equal((await connectTicket(await token('a', 'a@example.com', false))).status, 403);
  const invalidKey = await generateKeyPair('RS256');
  assert.equal((await connectTicket(await token('a', 'a@example.com', true, invalidKey.privateKey))).status, 403);
  assert.equal((await connectTicket(await token('a', 'a@example.com', true, privateKey, 'another-project'))).status, 403);
  console.log('PASS: origin, signature, email verification and membership rejection');
  const a = await join(await token('a', 'a@example.com')), b = await join(await token('b', 'b@example.com'));
  assert.equal(b.initial.state.version, 1);
  assert.equal((await connectTicket(await token('third-uid', 'a@example.com'))).status, 403);
  await a.next(v => v.type === 'snapshot' && v.online.includes('b'));
  assert.equal((await mf.dispatchFetch(`${origin}/api/room?ticket=${a.ticket}`, { headers: { Origin: origin, Upgrade: 'websocket' } })).status, 403);
  console.log('PASS: two authenticated clients, presence and single-use tickets');
  const avatar = { ...a.initial.state.members.a.avatar, facialHair: 'beard', beard: '#714b34', hair: '#dbc083', glasses: true, frames: 'square', outfit: 'hoodie', style: 'curly', bottoms: 'chinos' };
  a.ws.send(JSON.stringify({ type: 'profile', name: 'Alex', avatar }));
  const changed = await b.next(v => v.type === 'snapshot' && v.state.members.a.avatar.facialHair === 'beard');
  assert.equal(changed.state.members.a.avatar.outfit, 'hoodie');
  assert.equal(changed.state.members.a.avatar.frames, 'square');
  const id = randomUUID(); a.ws.send(JSON.stringify({ type: 'chat', id, text: 'Hola desde la prueba local' }));
  await b.next(v => v.type === 'snapshot' && v.state.messages.some(m => m.id === id));
  a.ws.send(JSON.stringify({ type: 'focus-start', title: 'Prueba persistente', minutes: 25 }));
  const focused = await b.next(v => v.type === 'snapshot' && v.state.members.a.focus);
  assert.equal(focused.state.members.b.focus, null);
  const end = focused.state.members.a.focus.endsAt;
  a.ws.send(JSON.stringify({ type: 'move', x: 0, y: 0 }));
  await a.next(v => v.type === 'error');
  console.log('PASS: realtime chat, independent pomodoro and server-side collision rejection');
  a.ws.send(JSON.stringify({ type: 'move', x: 2, y: 4 }));
  await a.next(v => v.type === 'snapshot' && v.state.members.a.position.x === 2 && v.state.members.a.position.y === 4);
  b.ws.send(JSON.stringify({ type: 'move', x: 2, y: 4 }));
  await b.next(v => v.type === 'snapshot' && v.state.members.b.position.x === 2 && v.state.members.b.position.y === 4);
  a.ws.send(JSON.stringify({ type: 'sit', seat: 'desk-left' }));
  b.ws.send(JSON.stringify({ type: 'sit', seat: 'desk-left' }));
  const seated = await a.next(v => v.type === 'snapshot' && Object.values(v.state.members).some(m => m.seat === 'desk-left'));
  assert.equal(Object.values(seated.state.members).filter(m => m.seat === 'desk-left').length, 1);
  const loser = seated.state.members.a.seat ? b : a;
  await loser.next(v => v.type === 'error' && v.message.includes('ocupado'));
  console.log('PASS: simultaneous seat claims admit exactly one member');
  a.ws.send(JSON.stringify({ type: 'sit', seat: 'sofa' }));
  await b.next(v => v.type === 'snapshot' && v.state.members.a.seat === 'sofa');
  b.ws.send(JSON.stringify({ type: 'sit', seat: 'sofa-right' }));
  const sofa = await a.next(v => v.type === 'snapshot' && v.state.members.b?.seat === 'sofa-right');
  assert.equal(sofa.state.members.a.seat, 'sofa');
  a.ws.send(JSON.stringify({ type: 'tv-play', url: 'https://youtu.be/M7lc1UVf-VE?t=30' }));
  const tv = await b.next(v => v.type === 'snapshot' && v.state.television?.videoId === 'M7lc1UVf-VE');
  assert.equal(tv.state.television.startSeconds, 30);
  b.ws.send(JSON.stringify({ type: 'tv-off', revision: tv.state.television.revision }));
  await a.next(v => v.type === 'snapshot' && v.state.revision > tv.state.revision && v.state.television === null);
  b.ws.send(JSON.stringify({ type: 'tv-play', url: 'https://youtu.be/M7lc1UVf-VE' }));
  const replay = await a.next(v => v.type === 'snapshot' && v.state.television?.revision > tv.state.television.revision);
  a.ws.send(JSON.stringify({ type: 'tv-off', revision: tv.state.television.revision }));
  await a.next(v => v.type === 'error' && v.message.includes('cambiado'));
  console.log('PASS: two sofa seats, shared TV start/stop and stale remote rejection');
  const cat=petPosition('cat',replay.state.pets.cat,Date.now());
  a.ws.send(JSON.stringify({type:'move',x:Math.round(cat.x),y:Math.round(cat.y)}));
  await a.next(v=>v.type==='snapshot'&&v.state.members.a.seat===null&&v.state.revision>replay.state.revision);
  a.ws.send(JSON.stringify({type:'pet',pet:'cat'}));
  const petted=await b.next(v=>v.type==='snapshot'&&v.state.pets?.cat.pettedBy==='a');
  assert.ok(petted.state.pets.cat.pettedAt>0);
  a.ws.send(JSON.stringify({type:'sit',seat:'sofa'}));
  await b.next(v=>v.type==='snapshot'&&v.state.members.a.seat==='sofa'&&v.state.revision>petted.state.revision);
  const recentIds=[];
  for(let i=0;i<11;i++){
    const messageId=randomUUID();recentIds.push(messageId);
    b.ws.send(JSON.stringify({type:'chat',id:messageId,text:`Retención ${i}`}));
    await a.next(v=>v.type==='snapshot'&&v.state.messages.some(m=>m.id===messageId));
  }
  console.log('PASS: petting reaches the other client and chat is capped at ten');
  a.ws.close(); b.ws.close(); await mf.dispose(); mf = new Miniflare(convertV4MiniflareOptions(options));
  const restored = await join(await token('a', 'a@example.com'));
  assert.equal(restored.initial.state.members.a.focus.endsAt, end);
  assert.equal(restored.initial.state.members.a.avatar.facialHair, 'beard');
  assert.equal(restored.initial.state.members.a.avatar.beard, '#714b34');
  assert.equal(restored.initial.state.members.a.avatar.hair, '#dbc083');
  assert.equal(restored.initial.state.members.a.avatar.outfit, 'hoodie');
  assert.deepEqual(restored.initial.state.television, replay.state.television);
  assert.equal(restored.initial.state.members.a.seat, 'sofa');
  assert.equal(restored.initial.state.members.b.seat, 'sofa-right');
  assert.deepEqual(restored.initial.state.messages.map(m=>m.id),recentIds.slice(-10));
  assert.deepEqual(restored.initial.state.pets,petted.state.pets);
  assert.deepEqual(restored.initial.online, ['a']); restored.ws.close();
  console.log('PASS: data survives full runtime restart; disconnected partner is not shown online');
} finally { await mf.dispose(); }
