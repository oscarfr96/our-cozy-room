import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Power, X } from 'lucide-react';
import { televisionPosition, youtubeLink, type Television as TV } from '../../shared/media';
import type { Action } from '../../shared/model';
import { loadYouTube, type YouTubePlayer } from '../lib/youtube';

export function Television({ television, editing, onClose, onEdit, send, now, available, screenHost, remoteVisible, onHide }: {
  remoteVisible: boolean; onHide: () => void; television: TV | null; editing: boolean; onClose: () => void; onEdit: () => void;
  send: (action: Action) => boolean; now: number; available: boolean; screenHost: HTMLDivElement | null;
}) {
  const [volume, setVolume] = useState(30), [error, setError] = useState('');
  const [status, setStatus] = useState('Conectando con YouTube…'), [retry, setRetry] = useState(0);
  const host = useRef<HTMLDivElement>(null), player = useRef<YouTubePlayer | null>(null);
  const latest = useRef({ television, now, volume }); latest.current = { television, now, volume };
  useEffect(() => {
    if (!television || !host.current) return;
    let disposed = false, created: YouTubePlayer | null = null;
    const container = host.current;
    setError(''); setStatus('Conectando con YouTube…');
    void loadYouTube().then(api => {
      if (disposed) return;
      const frame = document.createElement('iframe');
      frame.title = 'TV compartida · YouTube';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      const url = new URL(`https://www.youtube-nocookie.com/embed/${television.videoId}`);
      url.search = new URLSearchParams({ enablejsapi: '1', origin: location.origin, playsinline: '1', autoplay: '1', start: String(Math.floor(televisionPosition(television, latest.current.now))) }).toString();
      frame.src = url.href; container.append(frame);
      created = new api.Player(frame, { events: {
        onReady: ({ target }) => {
          if (disposed) return;
          player.current = target; target.setVolume(latest.current.volume);
          target.playVideo(); setStatus('Pulsa «Escuchar aquí» si no empieza.');
        },
        onAutoplayBlocked: () => { if (!disposed) setStatus('Tu navegador pide un clic para activar la TV.'); },
        onStateChange: ({ data }) => {
          if (disposed) return;
          if (data === 1) setStatus('Reproduciendo · volumen solo para ti');
          if (data === 2) setStatus('En pausa en tu navegador');
          if (data === 0) setStatus('El vídeo ha terminado');
        },
        onError: ({ data }) => {
          if (disposed) return;
          setError(data === 100 ? 'Este vídeo ya no está disponible o es privado.' : data === 101 || data === 150 ? 'Su autor no permite reproducir este vídeo fuera de YouTube. Prueba otro enlace.' : data === 153 ? 'YouTube no ha podido identificar esta web. Prueba abrirla en tu navegador habitual.' : 'YouTube no ha podido reproducir el vídeo. Prueba otro enlace.');
        },
      } });
    }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : 'No se pudo cargar YouTube.'); });
    return () => { disposed = true; player.current = null; created?.destroy(); container.replaceChildren(); };
  }, [television?.videoId, television?.revision, retry, screenHost]);
  const listen = () => {
    const tv = latest.current.television;
    if (!player.current || !tv) return;
    player.current.seekTo(televisionPosition(tv, latest.current.now), true);
    player.current.setVolume(volume); player.current.unMute(); player.current.playVideo();
  };
  return <>
    {television && screenHost ? createPortal(<div ref={host} className="youtube-screen" />, screenHost) : null}
    {television && remoteVisible ? <section id="tv-remote" className="television-dock pixel-remote" aria-label="TV y mando personal">
      <div className="remote-top"><span className="remote-brand">COZY / TV</span><button className="remote-hide" aria-label="Guardar mando" onClick={onHide}><X size={14} /></button></div>
      <div className="remote-lcd"><span className="remote-signal" aria-hidden="true">▂▄▆</span><strong>CANAL · JUNTOS</strong><p role={error ? 'alert' : 'status'}>{error || status}</p><output aria-live="off">VOL {String(volume).padStart(2, '0')}</output></div>
      <div className="tv-remote">
        <div className="remote-volume"><button aria-label="Bajar volumen de la TV" onClick={() => { const v=Math.max(0,volume-10);setVolume(v);player.current?.setVolume(v); }}>−</button><label><span>VOLUMEN</span><input aria-label="Mi volumen de la TV" type="range" min="0" max="100" value={volume} onChange={e => { const v=Number(e.target.value);setVolume(v);player.current?.setVolume(v); }} /></label><button aria-label="Subir volumen de la TV" onClick={() => { const v=Math.min(100,volume+10);setVolume(v);player.current?.setVolume(v); }}>+</button></div>
        <button className="remote-listen" onClick={listen}>▶ Escuchar aquí</button>
        <div className="tv-remote-actions"><button onClick={onEdit} disabled={!available}>↗ Cambiar vídeo</button><button className="remote-power" aria-label="Apagar TV para ambos" onClick={() => send({ type: 'tv-off', revision: television.revision })} disabled={!available}><Power size={15} /> Apagar</button></div>
        {error ? <div className="tv-error-actions"><button onClick={() => setRetry(v => v + 1)}>Reintentar</button><a href={`https://www.youtube.com/watch?v=${television.videoId}`} target="_blank" rel="noreferrer">Abrir en YouTube</a></div> : null}
      </div>
      <div className="remote-grip" aria-hidden="true" /><small className="remote-footnote">TU VOLUMEN · VUESTRA TV</small>
    </section> : null}
    {editing ? <TelevisionEditor onClose={onClose} television={television} send={send} available={available} /> : null}
  </>;
}

function TelevisionEditor({ onClose, television, send, available }: { onClose: () => void; television: TV | null; send: (action: Action) => boolean; available: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState(television ? `https://www.youtube.com/watch?v=${television.videoId}` : ''), [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="editor-dialog tv-editor" aria-labelledby="tv-title" onCancel={onClose}>
    <div className="editor-head"><span className="eyebrow">UN RATITO EN EL SOFÁ</span><button className="icon-button" aria-label="Cerrar televisión" onClick={onClose}><X size={20} /></button></div>
    <h2 id="tv-title">¿Qué vemos juntos?</h2><p>El mismo vídeo para los dos. Cada uno decide su volumen.</p>
    <form onSubmit={event => { event.preventDefault(); try { youtubeLink(url); if (send({ type: 'tv-play', url })) onClose(); } catch (reason) { setError((reason as Error).message); } }}>
      <label className="field-label">Enlace de YouTube<input autoFocus type="url" required maxLength={500} value={url} onChange={event => { setUrl(event.target.value); setError(''); }} placeholder="https://www.youtube.com/watch?v=…" /></label>
      <p className="muted">Se abrirá el reproductor de YouTube. Algunos vídeos no permiten reproducción externa; tu navegador puede pedirte pulsar para escuchar.</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Ahora no</button><button className="button primary" disabled={!available || !url.trim()}>Encender TV</button></div>
    </form>
  </dialog>;
}
