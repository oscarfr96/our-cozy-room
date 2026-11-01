import { describe, expect, it } from 'vitest';
import { daylightAt } from '../src/game/daylight';

describe('Ciclo de luz artístico según la hora local', () => {
  it('mantiene continuidad al cruzar medianoche y al normalizar horas', () => {
    expect(daylightAt(0)).toEqual(daylightAt(24));
    expect(daylightAt(-1)).toEqual(daylightAt(23));
    expect(daylightAt(23.999)).toEqual(daylightAt(0));
    expect(daylightAt(Number.NaN)).toEqual(daylightAt(12));
  });
  it('amanece gradualmente y vuelve a encender el ambiente nocturno', () => {
    expect(daylightAt(6).night).toBeGreaterThan(daylightAt(7).night);
    expect(daylightAt(7).night).toBeGreaterThan(daylightAt(9).night);
    expect(daylightAt(12).night).toBe(0);
    expect(daylightAt(18).night).toBeLessThan(daylightAt(20).night);
    expect(daylightAt(23).night).toBe(1);
    // No abrupt jumps at any minute, including former 07:00 / 20:00 switches.
    for (let minute = 1; minute <= 1440; minute++) {
      const previous = daylightAt((minute - 1) / 60), next = daylightAt(minute / 60);
      expect(Math.abs(next.night - previous.night)).toBeLessThan(.02);
      for (const channel of [0, 8, 16]) for (const color of ['top', 'bottom'] as const) {
        expect(Math.abs(((next[color] >> channel) & 255) - ((previous[color] >> channel) & 255))).toBeLessThan(4);
      }
    }
  });
});
