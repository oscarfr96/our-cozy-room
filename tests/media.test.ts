import { describe, expect, it } from 'vitest';
import { applyAction, emptyRoom, newMember } from '../shared/model';
import { televisionPosition, youtubeLink } from '../shared/media';

describe('TV privada compartida', () => {
  const id = 'M7lc1UVf-VE';
  it('acepta enlaces normales, cortos, directos y sus marcas de tiempo', () => {
    for (const url of [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}`, `https://m.youtube.com/shorts/${id}`, `https://www.youtube.com/live/${id}`]) expect(youtubeLink(url)).toEqual({ videoId: id, startSeconds: 0 });
    expect(youtubeLink(`https://youtu.be/${id}?t=1h2m3s`).startSeconds).toBe(3723);
    expect(youtubeLink(`https://www.youtube.com/watch?v=${id}&start=120`).startSeconds).toBe(120);
  });
  it('rechaza protocolos activos, credenciales, hosts parecidos e IDs inválidos', () => {
    for (const url of ['javascript:alert(1)', `https://youtube.com.evil.test/watch?v=${id}`, `https://youtube.com@evil.test/watch?v=${id}`, `https://user@youtube.com/watch?v=${id}`, `https://youtube.com:8080/watch?v=${id}`, 'https://youtube.com/watch?v=abc', `https://evil.test/${id}`]) expect(() => youtubeLink(url)).toThrow();
  });
  it('comparte el vídeo con tiempo del servidor, conserva al recargar y protege apagados antiguos', () => {
    const state = emptyRoom(); state.members.a = newMember('a'); state.members.b = newMember('b');
    const playing = applyAction(state, 'a', { type: 'tv-play', url: `https://youtu.be/${id}?t=30` }, 1000);
    const restored = JSON.parse(JSON.stringify(playing));
    expect(televisionPosition(restored.television, 6000)).toBe(35);
    expect(televisionPosition(restored.television, 0)).toBe(30);
    const replaced = applyAction(restored, 'b', { type: 'tv-play', url: `https://youtu.be/${id}` }, 7000);
    expect(() => applyAction(replaced, 'a', { type: 'tv-off', revision: playing.television!.revision }, 8000)).toThrow('cambiado');
    expect(applyAction(replaced, 'b', { type: 'tv-off', revision: replaced.television!.revision }, 9000).television).toBeNull();
    expect(state.television).toBeNull();
  });
  it('abre estados anteriores sin TV y rechaza a terceros', () => {
    const state = emptyRoom(); delete state.television; state.members.a = newMember('a');
    expect(applyAction(state, 'a', { type: 'tv-play', url: `https://youtu.be/${id}` }, 0).television?.videoId).toBe(id);
    expect(() => applyAction(state, 'stranger', { type: 'tv-play', url: `https://youtu.be/${id}` }, 0)).toThrow('perteneces');
  });
});

describe('Caminar y sentarse con un solo gesto', () => {
  it('libera el frente del sofá y bloquea el mueble de vinilos bajo la TV', () => {
    const state = emptyRoom(); state.members.a = newMember('a');
    expect(applyAction(state, 'a', { type: 'move', x: 6, y: 9 }, 0).members.a.position).toEqual({ x: 6, y: 9 });
    expect(() => applyAction(state, 'a', { type: 'move', x: 3, y: 1 }, 0)).toThrow('caminar');
  });
  it('reserva dos plazas distintas del sofá desde lejos sin colisionar y permite levantarse', () => {
    let state = emptyRoom(); state.members.a = newMember('a'); state.members.b = newMember('b');
    state = applyAction(state, 'a', { type: 'sit', seat: 'sofa' }, 0);
    state = applyAction(state, 'b', { type: 'sit', seat: 'sofa-right' }, 1);
    expect(state.members.a.seat).toBe('sofa'); expect(state.members.b.seat).toBe('sofa-right');
    expect(state.members.a.position).not.toEqual(state.members.b.position);
    expect(() => applyAction(state, 'b', { type: 'sit', seat: 'sofa' }, 2)).toThrow('ocupado');
    expect(applyAction(state, 'a', { type: 'move', x: 9, y: 6 }, 3).members.a.seat).toBeNull();
  });
});
