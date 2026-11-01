import { z } from 'zod';

export const televisionSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/),
  startedAt: z.number().finite(), startSeconds: z.number().int().min(0).max(86400),
  revision: z.number().int().nonnegative(),
});
export type Television = z.infer<typeof televisionSchema>;

export function youtubeLink(input: string): { videoId: string; startSeconds: number } {
  const invalid = () => new Error('Pega un enlace válido de un vídeo de YouTube.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw invalid(); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw invalid();
  const host = url.hostname.toLowerCase(), path = url.pathname.split('/').filter(Boolean);
  let videoId: string | null = null;
  if (host === 'youtu.be' && path.length === 1) videoId = path[0];
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    else if (path.length === 2 && ['shorts', 'embed', 'live'].includes(path[0])) videoId = path[1];
  }
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) throw invalid();
  const time = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '0';
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);
  const seconds = /^\d+$/.test(time) ? Number(time) : parts ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0) : 0;
  return { videoId, startSeconds: Math.min(86400, seconds) };
}

export const televisionPosition = (tv: Television, now: number) => tv.startSeconds + Math.max(0, (now - tv.startedAt) / 1000);
