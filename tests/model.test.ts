import { describe, expect, it } from 'vitest';
import { applyAction, emptyRoom, focusRemaining, newMember, pathBetween, SEATS, walkable } from '../shared/model';
import { allowedEmails, identityFromClaims } from '../worker/auth';

function room() { const state = emptyRoom(); state.members.a = newMember('a'); state.members.b = newMember('b'); return state; }
describe('La sala valida las acciones en el servidor', () => {
  it('encuentra caminos transitables hacia todos los asientos', () => {
    for (const seat of SEATS) { const path = pathBetween({ x: 5, y: 4 }, seat); expect(path.length).toBeGreaterThan(1); expect(path.every(walkable)).toBe(true); for (let i = 1; i < path.length; i++) expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBe(1); }
  });
  it('rechaza muebles, límites y posiciones no enteras', () => {
    for (const position of [{ x: 0, y: 0 }, { x: -1, y: 4 }, { x: 12, y: 2 }, { x: 2.5, y: 4 }]) expect(() => applyAction(room(), 'a', { type: 'move', ...position }, 1000)).toThrow();
  });
  it('reserva un asiento para una sola persona y lo libera al caminar', () => {
    let state = room(); state.members.a.position = { x: 2, y: 4 }; state.members.b.position = { x: 2, y: 5 };
    state = applyAction(state, 'a', { type: 'sit', seat: 'desk-left' }, 0);
    expect(() => applyAction(state, 'b', { type: 'sit', seat: 'desk-left' }, 0)).toThrow('ocupado');
    state = applyAction(state, 'a', { type: 'move', x: 3, y: 4 }, 1);
    expect(applyAction(state, 'b', { type: 'sit', seat: 'desk-left' }, 2).members.b.seat).toBe('desk-left');
  });
  it('impide editar como un tercero y valida el catálogo', () => {
    expect(() => applyAction(room(), 'stranger', { type: 'move', x: 3, y: 4 }, 0)).toThrow('perteneces');
    expect(() => applyAction(room(), 'a', { type: 'profile', name: 'Test', avatar: { ...newMember('a').avatar, shirt: '<script>' } }, 0)).toThrow();
  });
  it('deduplica mensajes y conserva texto literal sin interpretarlo como HTML', () => {
    const action = { type: 'chat', id: '550e8400-e29b-41d4-a716-446655440000', text: '<img src=x onerror=alert(1)>' };
    const first = applyAction(room(), 'a', action, 0), second = applyAction(first, 'a', action, 1);
    expect(second.messages).toHaveLength(1); expect(second.messages[0].text).toBe(action.text);
  });
  it('rechaza abrazos sin proximidad', () => {
    const state = room(); state.members.b.position = { x: 11, y: 5 };
    expect(() => applyAction(state, 'a', { type: 'hug', target: 'b', id: '550e8400-e29b-41d4-a716-446655440000' }, 0)).toThrow('Acércate');
  });
});
describe('Pomodoro basado en fechas y transiciones con revisión', () => {
  it('sobrevive a serialización, pausa, reanudación y suspensión de pestaña', () => {
    let state = applyAction(room(), 'a', { type: 'focus-start', title: 'Estudiar', minutes: 25 }, 1000);
    state = JSON.parse(JSON.stringify(state)); expect(focusRemaining(state.members.a.focus, 61000)).toBe(24 * 60000);
    const revision = state.members.a.focus!.revision;
    state = applyAction(state, 'a', { type: 'focus-control', operation: 'pause', revision }, 61000);
    expect(focusRemaining(state.members.a.focus, 9000000)).toBe(24 * 60000);
    expect(() => applyAction(state, 'a', { type: 'focus-control', operation: 'pause', revision }, 62000)).toThrow('cambiado');
    state = applyAction(state, 'a', { type: 'focus-control', operation: 'resume', revision: state.members.a.focus!.revision }, 10000000);
    expect(focusRemaining(state.members.a.focus, 10000000 + 24 * 60000)).toBe(0);
    expect(state.members.b.focus).toBeNull();
  });
  it('una orden antigua no puede modificar una sesión nueva', () => {
    let state = applyAction(room(), 'a', { type: 'focus-start', title: 'Uno', minutes: 1 }, 0);
    const oldRevision = state.members.a.focus!.revision;
    state = applyAction(state, 'a', { type: 'focus-control', operation: 'finish', revision: oldRevision }, 1);
    state = applyAction(state, 'a', { type: 'focus-start', title: 'Dos', minutes: 1 }, 2);
    expect(() => applyAction(state, 'a', { type: 'focus-control', operation: 'pause', revision: oldRevision }, 3)).toThrow('cambiado');
  });
});
describe('Autorización después de verificar la firma JWT', () => {
  const claims = { sub: 'user-a', email: 'a@example.com', email_verified: true, iat: 100, auth_time: 90, exp: 200 };
  it('requiere exactamente dos correos distintos', () => { expect(allowedEmails(' A@example.com, b@example.com ')).toEqual(['a@example.com', 'b@example.com']); expect(() => allowedEmails('')).toThrow(); expect(() => allowedEmails('a@example.com,a@example.com')).toThrow(); });
  it('rechaza no verificados, terceros y tokens caducados o emitidos en el futuro', () => {
    for (const changed of [{ email_verified: false }, { email: 'intruder@example.com' }, { exp: 140 }, { auth_time: 999 }, { iat: 999 }, { sub: '' }]) expect(() => identityFromClaims({ ...claims, ...changed }, ['a@example.com', 'b@example.com'], 150000)).toThrow();
  });
  it('acepta el correo autorizado verificado', () => { expect(identityFromClaims(claims, ['a@example.com', 'b@example.com'], 150000).id).toBe('user-a'); });
});
