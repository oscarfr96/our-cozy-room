// Artistic cycle in local device time. This is not an astronomical or weather API.
const stops = [
  { hour: 0, top: 0x26334f, bottom: 0x6e687f, night: 1 },
  { hour: 6, top: 0x343b60, bottom: 0x9b7e91, night: .9 },
  { hour: 7, top: 0x9b91b5, bottom: 0xf1bd99, night: .35 },
  { hour: 9, top: 0x80b6c9, bottom: 0xe3d4ad, night: 0 },
  { hour: 16, top: 0x80b6c9, bottom: 0xe3d4ad, night: 0 },
  { hour: 18, top: 0x817baf, bottom: 0xf2b07f, night: .2 },
  { hour: 20, top: 0x454366, bottom: 0xac7e8a, night: .8 },
  { hour: 22, top: 0x26334f, bottom: 0x6e687f, night: 1 },
  { hour: 24, top: 0x26334f, bottom: 0x6e687f, night: 1 },
];

export function mixColor(from: number, to: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const channel = (shift: number) => Math.round(((from >> shift) & 255) * (1 - t) + ((to >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function daylightAt(hour: number) {
  const localHour = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 12;
  const end = stops.findIndex(stop => stop.hour > localHour);
  const a = stops[end - 1], b = stops[end];
  const progress = (localHour - a.hour) / (b.hour - a.hour);
  const t = progress * progress * (3 - 2 * progress);
  return {
    top: mixColor(a.top, b.top, t), bottom: mixColor(a.bottom, b.bottom, t),
    night: a.night + (b.night - a.night) * t,
  };
}
