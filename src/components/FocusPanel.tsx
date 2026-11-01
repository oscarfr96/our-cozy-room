import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Coffee, Pause, Play, Sprout } from 'lucide-react';
import { focusRemaining, type Action, type Member } from '../../shared/model';
export const durationText = (ms: number) => { const seconds = Math.ceil(ms / 1000); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; };
export function FocusPanel({ member, now, send, onComplete }: { member: Member; now: number; send: (action: Action) => void; onComplete: () => void }) {
  const [title, setTitle] = useState(''), [minutes, setMinutes] = useState(25), notified = useRef<number | null>(null);
  const focus = member.focus, remaining = focusRemaining(focus, now), finished = !!focus && remaining <= 0;
  useEffect(() => { if (finished && focus && notified.current !== focus.endsAt) { notified.current = focus.endsAt; onComplete(); } }, [finished, focus, onComplete]);
  const progress = focus ? 1 - remaining / focus.duration : 0;
  return <section className="focus-card" aria-labelledby="focus-title">
    <div className="card-title"><span className="icon-tile"><Sprout size={20} /></span><div><span className="eyebrow">A TU RITMO</span><h2 id="focus-title">Tu momento de foco</h2></div></div><p className="card-description">Un pequeño paso también es avanzar.</p>
    {!focus ? <form onSubmit={e => { e.preventDefault(); send({ type: 'focus-start', title, minutes }); }}>
      <label className="field-label">¿En qué vas a trabajar?<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ese proyecto que te ilusiona…" maxLength={80} required /></label>
      <div className="timer-preview" aria-hidden="true">{String(minutes).padStart(2, '0')}<span>:</span>00</div>
      <fieldset><legend className="sr-only">Duración de la sesión</legend><div className="duration-options">{[25, 50, 90].map(n => <button key={n} type="button" aria-pressed={minutes === n} className={minutes === n ? 'selected' : ''} onClick={() => setMinutes(n)}>{n} min</button>)}<label className="custom-duration"><span className="sr-only">Minutos personalizados</span><input aria-label="Minutos personalizados" type="number" min="1" max="240" value={minutes} onChange={e => setMinutes(Math.min(240, Math.max(1, Number(e.target.value))))} /></label></div></fieldset>
      <button className="button primary wide" disabled={!title.trim()}><Play size={15} fill="currentColor" /> Empezar mi momento</button>
    </form> : <div>
      <p className="active-task">{focus.title}</p><div className="timer-preview" aria-label={`Tiempo restante: ${durationText(remaining)}`}>{durationText(remaining)}</div>
      <div className="progress-track" role="progressbar" aria-label="Sesión de concentración" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${progress * 100}%` }} /></div>
      <p className="timer-state">{finished ? 'Lo has hecho. Regálate una pausa.' : focus.endsAt === null ? 'En pausa. Respira un poquito.' : `Concentración · ${focus.duration / 60000} minutos`}</p>
      <button className="button primary wide" onClick={() => send({ type: 'focus-control', operation: finished ? 'finish' : focus.endsAt === null ? 'resume' : 'pause', revision: focus.revision })}>{finished ? <Check size={17} /> : focus.endsAt === null ? <Play size={16} /> : <Pause size={16} />}{finished ? 'Cerrar sesión de foco' : focus.endsAt === null ? 'Continuar' : 'Hacer una pausa'}</button>
      {!finished ? <button className="text-button finish-button" onClick={() => send({ type: 'focus-control', operation: 'finish', revision: focus.revision })}>Terminar este momento <ArrowRight size={13} /></button> : null}
    </div>}
    <div className="focus-footnote"><Coffee size={16} /><span>Aquí también hay sitio para descansar.</span></div>
  </section>;
}
