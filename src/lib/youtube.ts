// Small typed boundary around the official IFrame Player API, loaded on demand.
export interface YouTubePlayer {
  destroy(): void; playVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void; unMute(): void;
}
type PlayerEvent = { target: YouTubePlayer; data?: number };
interface YouTubeAPI {
  Player: new (element: HTMLIFrameElement, options: { events: {
    onReady: (event: PlayerEvent) => void; onError: (event: PlayerEvent) => void;
    onAutoplayBlocked: () => void; onStateChange: (event: PlayerEvent) => void;
  } }) => YouTubePlayer;
}
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let loading: Promise<YouTubeAPI> | null = null;
export function loadYouTube(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previous = window.onYouTubeIframeAPIReady;
    const fail = () => {
      clearTimeout(timeout); script.remove(); loading = null;
      window.onYouTubeIframeAPIReady = previous;
      reject(new Error('No se pudo conectar con YouTube. Comprueba tu conexión y vuelve a intentar.'));
    };
    const timeout = setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout); window.onYouTubeIframeAPIReady = previous;
      if (window.YT?.Player) resolve(window.YT); else fail();
      previous?.();
    };
    script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
