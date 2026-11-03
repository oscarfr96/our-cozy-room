let audio: AudioContext | null = null;
const preferenceKey = 'cozy.sound.v1';
let preference = true;

export function soundEnabled() {
  try {
    const saved = localStorage.getItem(preferenceKey);
    if (saved === 'on' || saved === 'off') preference = saved === 'on';
  } catch { /* Keep the preference in memory when storage is unavailable. */ }
  return preference;
}

export function saveSoundPreference(enabled: boolean) {
  preference = enabled;
  try { localStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch { /* Session-only preference. */ }
}

export async function enableSound() {
  audio ??= new AudioContext();
  if (audio.state !== 'running') await audio.resume();
}

// Install before authentication so signing in also unlocks notification audio.
// Retry on interaction: autoplay rejection must never silently turn the preference off.
export function prepareSound() {
  const activate = () => { if (soundEnabled()) void enableSound().catch(() => {}); };
  const options = { capture: true, passive: true };
  activate();
  document.addEventListener('click', activate, options);
  document.addEventListener('keydown', activate, options);
  return () => {
    document.removeEventListener('click', activate, options);
    document.removeEventListener('keydown', activate, options);
  };
}

export async function chime() {
  if (!audio || !soundEnabled()) return;
  const context = audio;
  try {
    if (context.state === 'suspended') await context.resume();
  } catch { return; }
  if (context.state !== 'running' || !soundEnabled()) return;
  [659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + index * .13;
    oscillator.frequency.value = frequency; oscillator.type = 'sine'; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .03); gain.gain.exponentialRampToValueAtTime(.001, start + .5);
    oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + .55);
  });
}
