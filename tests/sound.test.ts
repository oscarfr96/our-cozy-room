import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('no crea audio hasta que la persona activa los avisos', async () => {
  const AudioContext = vi.fn();
  vi.stubGlobal('AudioContext', AudioContext);
  const { chime } = await import('../src/lib/sound');
  await chime();
  expect(AudioContext).not.toHaveBeenCalled();
});

it('recupera el contexto suspendido antes de emitir el aviso y tolera un bloqueo', async () => {
  const start = vi.fn();
  const oscillator = { frequency: { value: 0 }, type: '', connect: vi.fn(), start, stop: vi.fn() };
  const gain = {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  oscillator.connect.mockReturnValue(gain);
  const context = {
    state: 'suspended', currentTime: 0, destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }),
    createOscillator: vi.fn(() => oscillator), createGain: vi.fn(() => gain),
  };
  vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  const { chime, enableSound } = await import('../src/lib/sound');
  await enableSound();
  context.state = 'suspended';
  await chime();
  expect(context.resume).toHaveBeenCalledTimes(2);
  expect(start).toHaveBeenCalledTimes(2);
  context.state = 'suspended';
  context.resume.mockRejectedValueOnce(new Error('Audio bloqueado'));
  await expect(chime()).resolves.toBeUndefined();
  expect(start).toHaveBeenCalledTimes(2);
});
