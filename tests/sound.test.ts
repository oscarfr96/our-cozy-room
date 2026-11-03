import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('no crea audio solo por recibir un aviso antes de preparar la página', async () => {
  const AudioContext = vi.fn();
  vi.stubGlobal('AudioContext', AudioContext);
  const { chime } = await import('../src/lib/sound');
  await chime();
  expect(AudioContext).not.toHaveBeenCalled();
});

it('activa los avisos por defecto y recuerda solo una decisión explícita de silenciar', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  const { soundEnabled, saveSoundPreference } = await import('../src/lib/sound');
  expect(soundEnabled()).toBe(true);
  saveSoundPreference(false);
  vi.resetModules();
  const reloaded = await import('../src/lib/sound');
  expect(reloaded.soundEnabled()).toBe(false);
  reloaded.saveSoundPreference(true);
  expect(reloaded.soundEnabled()).toBe(true);
});

it('mantiene el silencio durante la sesión aunque el navegador no permita guardar preferencias', async () => {
  vi.stubGlobal('localStorage', { getItem() { throw new Error('Bloqueado'); }, setItem() { throw new Error('Bloqueado'); } });
  const { soundEnabled, saveSoundPreference } = await import('../src/lib/sound');
  expect(soundEnabled()).toBe(true);
  saveSoundPreference(false);
  expect(soundEnabled()).toBe(false);
});

it('reintenta el audio tras interacción si el autoplay está bloqueado, respeta silencio y retira listeners', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  const page = new EventTarget();
  vi.stubGlobal('document', page);
  const context = { state: 'suspended', resume: vi.fn().mockRejectedValueOnce(new Error('Autoplay bloqueado')).mockResolvedValue(undefined) };
  const constructor = vi.fn(function () { return context; });
  vi.stubGlobal('AudioContext', constructor);
  const { prepareSound, saveSoundPreference, soundEnabled } = await import('../src/lib/sound');
  const dispose = prepareSound();
  await Promise.resolve();
  expect(soundEnabled()).toBe(true);
  page.dispatchEvent(new Event('click'));
  expect(context.resume).toHaveBeenCalledTimes(2);
  saveSoundPreference(false);
  page.dispatchEvent(new Event('keydown'));
  expect(context.resume).toHaveBeenCalledTimes(2);
  saveSoundPreference(true);
  page.dispatchEvent(new Event('keydown'));
  expect(context.resume).toHaveBeenCalledTimes(3);
  expect(constructor).toHaveBeenCalledTimes(1);
  dispose();
  page.dispatchEvent(new Event('click'));
  page.dispatchEvent(new Event('keydown'));
  expect(context.resume).toHaveBeenCalledTimes(3);
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
  const { chime, enableSound, saveSoundPreference } = await import('../src/lib/sound');
  await enableSound();
  context.state = 'suspended';
  await chime();
  expect(context.resume).toHaveBeenCalledTimes(2);
  expect(start).toHaveBeenCalledTimes(2);
  saveSoundPreference(false);
  await chime();
  expect(start).toHaveBeenCalledTimes(2);
  saveSoundPreference(true);
  context.state = 'suspended';
  context.resume.mockRejectedValueOnce(new Error('Audio bloqueado'));
  await expect(chime()).resolves.toBeUndefined();
  expect(start).toHaveBeenCalledTimes(2);
});
