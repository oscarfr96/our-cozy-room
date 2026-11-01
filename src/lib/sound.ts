let audio: AudioContext | null = null;
export async function enableSound() { audio ??= new AudioContext(); await audio.resume(); }
export async function chime() {
  if (!audio) return;
  const context = audio;
  try {
    if (context.state === 'suspended') await context.resume();
  } catch { return; }
  if (context.state !== 'running') return;
  [659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + index * .13;
    oscillator.frequency.value = frequency; oscillator.type = 'sine'; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .03); gain.gain.exponentialRampToValueAtTime(.001, start + .5);
    oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + .55);
  });
}
