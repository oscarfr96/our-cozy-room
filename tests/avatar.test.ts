import { describe, expect, it } from 'vitest';
import { applyAction, avatarSchema, COLORS, DEFAULT_AVATAR, emptyRoom, newMember } from '../shared/model';
import { avatarPixels } from '../shared/avatar';

describe('Armario ampliado y perfiles anteriores', () => {
  const legacy = { skin: '#f2c69f', hair: '#392b29', shirt: '#4c7165', trousers: '#394954', style: 'short', glasses: true };
  it('abre un avatar anterior con valores compatibles sin perder sus colores ni gafas', () => {
    const restored = avatarSchema.parse(legacy);
    expect(restored).toMatchObject({ ...legacy, facialHair: 'none', outfit: 'knit', frames: 'round', bottoms: 'jeans' });
    expect(avatarPixels(legacy as typeof restored)).toEqual(avatarPixels(restored));
  });
  it('conserva barba, montura y prendas en una acción validada y serializada', () => {
    const room = emptyRoom(); room.members.a = newMember('a');
    const avatar = { ...DEFAULT_AVATAR, facialHair: 'beard', glasses: true, frames: 'square', outfit: 'cardigan', bottoms: 'chinos', style: 'curly' };
    const saved = applyAction(room, 'a', { type: 'profile', name: 'Alex', avatar }, 1000);
    expect(JSON.parse(JSON.stringify(saved)).members.a.avatar).toEqual(avatar);
    expect(() => avatarSchema.parse({ ...avatar, facialHair: 'unknown' })).toThrow();
  });
  it('separa el color de la barba y conserva el color del pelo en perfiles anteriores', () => {
    expect(avatarSchema.parse(legacy).beard).toBe(legacy.hair);
    const changed = avatarSchema.parse({ ...legacy, hair: '#dbc083', beard: '#392b29', facialHair: 'beard' });
    const state = emptyRoom(); state.members.a = newMember('a');
    const saved = applyAction(state, 'a', { type: 'profile', name: 'Alex', avatar: changed }, 0);
    expect(JSON.parse(JSON.stringify(saved)).members.a.avatar).toMatchObject({ hair: '#dbc083', beard: '#392b29' });
    expect(avatarPixels(changed).some(p => p.y >= 17 && p.color === '#392b29')).toBe(true);
  });
  it('mantiene la barbilla del tono de piel al elegir sin barba', () => {
    for (const skin of COLORS.skin) for (const style of ['bob', 'long', 'bun']) {
      const avatar = avatarSchema.parse({ ...DEFAULT_AVATAR, skin, style, facialHair: 'none' });
      for (const direction of [0, 1]) for (const seated of [false, true]) {
        const pixels = avatarPixels(avatar, direction, seated);
        for (let x = 14; x <= 19; x++) for (const y of [20, 21]) {
          expect(pixels.find(p => p.x === x && p.y === y)?.color).toBe(skin);
        }
      }
    }
  });
  it('dibuja cada combinación dentro de su plantilla en todas las poses', () => {
    for (const style of ['short', 'bob', 'long', 'curly', 'bun', 'buzz', 'slick']) for (const outfit of ['knit', 'hoodie', 'cardigan', 'shirt', 'tee']) for (const facialHair of ['none', 'moustache', 'goatee', 'beard']) {
      const avatar = avatarSchema.parse({ ...DEFAULT_AVATAR, style, outfit, facialHair, glasses: true });
      for (let direction = 0; direction < 4; direction++) for (const seated of [false, true]) {
        const pixels = avatarPixels(avatar, direction, seated, 1);
        expect(pixels.length).toBeGreaterThan(300);
        expect(pixels.every(p => p.x >= 0 && p.x < 32 && p.y >= 0 && p.y < 48 && /^#[0-9a-f]{6}$/i.test(p.color))).toBe(true);
      }
    }
  });
});
