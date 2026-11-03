import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Armchair, ArrowUpRight, Check, ChevronDown, Coffee, Heart, House, Leaf, LogOut, MessageCircle, Moon, MousePointer2, Send, Shirt, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { emptyRoom, focusRemaining, SEATS, type Action, type Snapshot } from '../shared/model';
import { auth, firebaseConfigured } from './lib/firebase';
import { localClient, remoteClient, type Connection, type RoomClient } from './lib/room-client';
import { chime, enableSound, prepareSound, saveSoundPreference, soundEnabled } from './lib/sound';
import { createMessageNotifications } from './lib/message-notifications';
import { AvatarPreview } from './components/AvatarPreview';
import { FocusPanel } from './components/FocusPanel';
import { AvatarEditor } from './components/AvatarEditor';
import { AuthGate } from './components/AuthGate';
import { daylightAt } from './game/daylight';
import { PetControls } from './components/PetControls';
import { MusicPlayer } from './components/MusicPlayer';
import { Television } from './components/Television';
const RoomCanvas = lazy(() => import('./components/RoomCanvas'));
const phrases = ['Qué bonito coincidir contigo.', 'A tu lado, hasta los lunes tienen algo bonito.', 'No hace falta hacer lo mismo para estar juntos.', 'Hoy también estamos haciendo lo mejor que podemos.'];
const preview = new URLSearchParams(location.search).get('demo') === '1' || (import.meta.env.DEV && !firebaseConfigured);

export default function App() {
  const [user, setUser] = useState<User | null>(null), [ready, setReady] = useState(!auth), [, refresh] = useState(0);
  useEffect(prepareSound, []);
  useEffect(() => { if (!auth) return; return onAuthStateChanged(auth, next => { setUser(next); setReady(true); }); }, []);
  if (!preview && !firebaseConfigured) return <main className="welcome"><section className="welcome-card"><Leaf size={32} /><h1>Tu casa está por empezar.</h1><p>Esta instalación todavía no tiene configuradas las cuentas. Sigue la guía de despliegue incluida en el repositorio.</p><a className="button primary" href="?demo=1">Explorar la vista local <ArrowUpRight size={17} /></a><p className="muted">La vista local no conecta con otras personas.</p></section></main>;
  if (!ready) return <main className="welcome"><p>Preparando vuestra casa…</p></main>;
  if (!preview && (!user || !user.emailVerified)) return <AuthGate user={user} onVerified={() => refresh(v => v + 1)} />;
  return <Home key={preview ? 'preview' : user!.uid} user={preview ? null : user} />;
}

function Home({ user }: { user: User | null }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ type: 'snapshot', state: emptyRoom(), online: [], now: Date.now() });
  const [connection, setConnection] = useState<Connection>(user ? 'connecting' : 'local');
  const [connectionError, setConnectionError] = useState('');
  const [ambientView, setAmbientView] = useState(false);
  const [tvEditing, setTvEditing] = useState(false);
  const [remoteVisible, setRemoteVisible] = useState(true);
  useEffect(() => { setRemoteVisible(true); }, [!!snapshot.state.television]);
  const [tvScreenHost, setTvScreenHost] = useState<HTMLDivElement | null>(null);
  const openTelevision = useCallback(() => setTvEditing(true), []);
  const [visualHour, setVisualHour] = useState<number | null>(null);
  const [toast, setToast] = useState(''), [editor, setEditor] = useState(false), [message, setMessage] = useState(''), [history, setHistory] = useState(false);
  const [sound, setSound] = useState(soundEnabled), [time, setTime] = useState(Date.now());
  const client = useRef<RoomClient | null>(null), offset = useRef(0), soundRef = useRef(sound);
  soundRef.current = sound;
  const announce = useCallback((text: string) => setToast(text), []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const notify = () => {
      if (soundRef.current) void chime();
    };
    const notifications = createMessageNotifications(user?.uid ?? 'local', notify, () => {
      announce('Tu persona acaba de entrar. Ya estáis en casa. ♡');
      notify();
    });
    const receive = (next: Snapshot) => {
      offset.current = next.now - Date.now();
      setSnapshot(previous => ({ ...next, selfId: next.selfId ?? previous.selfId }));
      notifications.receive(next.state.messages);
      notifications.receivePresence(next.online);
    };
    client.current = user ? remoteClient(user, receive, status => { setConnection(status); if (status === 'online') setConnectionError(''); else notifications.resetPresence(); }, error => { setConnectionError(error); announce(error); }) : localClient(receive, announce);
    return () => { client.current?.close(); notifications.dispose(); };
  }, [user, announce]);
  useEffect(() => { const timer = setInterval(() => setTime(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (connection === 'offline' || connection === 'replaced') setSnapshot(s => ({ ...s, online: [] })); }, [connection]);
  const send = useCallback((action: Action) => client.current?.send(action) ?? false, []);
  const complete = useCallback(() => { announce('Tu momento de foco ha terminado. Es hora de estirarte un poquito.'); if (soundRef.current) chime(); }, [announce]);
  const toggleSound = () => {
    const enabled = !sound;
    soundRef.current = enabled;
    setSound(enabled);
    saveSoundPreference(enabled);
    if (enabled) void enableSound().then(() => chime()).catch(() => announce('El navegador no permite activar el sonido. Revisa los permisos de esta página.'));
  };
  const selfId = snapshot.selfId ?? user?.uid ?? 'local', member = snapshot.state.members[selfId];
  const partner = Object.values(snapshot.state.members).find(m => m.id !== selfId), partnerHere = !!partner && snapshot.online.includes(partner.id);
  const partnerFocus = partnerHere ? partner?.focus : null;
  const date = new Date(time), night = daylightAt(date.getHours() + date.getMinutes() / 60).night >= .65, now = time + offset.current;
  const partnerRemaining = focusRemaining(partnerFocus ?? null, now);
  const sceneNight = visualHour === null ? night : daylightAt(visualHour).night >= .65;
  const available = connection === 'online' || connection === 'local';
  const closeEnough = !!member && !!partner && Math.abs(member.position.x - partner.position.x) + Math.abs(member.position.y - partner.position.y) <= 2;
  const sendText = (text: string) => send({ type: 'chat', id: crypto.randomUUID(), text });
  if (user && (connection === 'denied' || !member)) return <main className="welcome"><section className="welcome-card"><Leaf size={32} /><h1>{connection === 'denied' ? 'No hemos podido abrir la casa.' : 'Abriendo vuestra casa…'}</h1><p role={connection === 'denied' ? 'alert' : 'status'}>{connectionError || 'Conectando con la sala privada.'}</p>{connection === 'denied' ? <p>Revisa que esta cuenta esté verificada y autorizada para vuestra casa. Después vuelve a intentarlo o entra con otra cuenta.</p> : null}<button className="button primary wide" onClick={() => location.reload()}>Volver a intentar</button><button className="text-button" onClick={() => void signOut(auth!).catch(() => setConnectionError('No se pudo cerrar sesión. Vuelve a intentarlo.'))}>Usar otra cuenta</button></section></main>;
  return <div className={`app ${sceneNight ? 'night' : ''} ${ambientView ? 'ambient-view' : ''}`}>
    <header className="topbar"><a className="brand" href={preview ? '?demo=1' : '/'} aria-label="Our Cozy Room, inicio"><span className="brand-house"><House size={23} strokeWidth={1.8} /></span><div>our cozy room<span>UN LUGAR PARA LOS DOS</span></div><Leaf size={18} className="brand-leaf" /></a>
      <div className="clock"><time dateTime={date.toISOString()}>{date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time><span>{date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <nav className="header-actions" aria-label="Preferencias"><button className="ambient-toggle" aria-pressed={ambientView} onClick={() => setAmbientView(v => !v)}>{ambientView ? 'Ver mis tareas' : 'Modo ambiente'}</button><span className="time-of-day">{night ? <Moon size={15} /> : <Sun size={17} />}{night ? 'Buenas noches' : 'Un día bonito'}</span><button className="icon-button" title={sound ? "Avisos suaves de llegada, mensajes y fin de foco" : "Activa el sonido para escuchar los mensajes, también en otra pestaña"} aria-label={sound ? 'Desactivar avisos sonoros' : 'Activar avisos sonoros'} aria-pressed={sound} onClick={toggleSound}>{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>{user ? <button className="icon-button" aria-label="Cerrar sesión" onClick={() => void signOut(auth!).catch(() => announce('No se pudo cerrar sesión. Vuelve a intentarlo.'))}><LogOut size={19} /></button> : null}</nav>
    </header>
    <main className="workspace">
      <section className="room-area" aria-label="Vuestra habitación">
        <div className="room-topline"><span className="room-location"><span className="live-dot" /> Nuestro pequeño refugio</span><span className="local-label">{connection === 'local' ? 'VISTA LOCAL' : connection === 'online' ? 'EN CASA' : connection === 'replaced' ? 'OTRA PESTAÑA' : 'CONECTANDO'}</span></div>
        <div className="quote-banner"><Heart size={15} /><p>{phrases[Math.floor(time / 60000) % phrases.length]}</p><span>✧</span></div>
        <div className="scene-wrap"><Suspense fallback={<div className="scene-loading"><Leaf size={25} /><p>Preparando un rincón acogedor…</p></div>}><RoomCanvas serverOffset={offset.current} room={snapshot.state} selfId={selfId} online={snapshot.online} send={send} announce={announce} visualHour={visualHour} onTelevision={openTelevision} onScreenHost={setTvScreenHost} /></Suspense></div>
        <div className="room-bottomline"><p><MousePointer2 size={14} /> Haz clic en el suelo para caminar</p>{preview ? <label className="light-preview">Luz de prueba<select aria-label="Luz de prueba de la habitación" value={visualHour ?? 'real'} onChange={e => setVisualHour(e.target.value === 'real' ? null : Number(e.target.value))}><option value="real">Hora de tu equipo</option><option value="7">Amanecer</option><option value="12">Día</option><option value="18">Atardecer</option><option value="23">Noche</option></select></label> : <span>{night ? <Moon size={13} /> : <Sun size={13} />} Hora de tu equipo</span>}</div>
        <div className="room-tools"><div className="places" aria-label="Ir a un lugar">{SEATS.map(seat => <button key={seat.id} disabled={!member || !available} aria-pressed={member?.seat === seat.id} onClick={() => send({ type: 'sit', seat: seat.id })} title={seat.name}><Armchair size={15} />{seat.id === 'desk-left' ? 'Ventana' : seat.id === 'desk-right' ? 'Librería' : seat.id === 'sofa' ? 'Sofá 1' : 'Sofá 2'}</button>)}<button onClick={openTelevision}>TV</button></div><PetControls room={snapshot.state} member={member} now={now} available={available} send={send}/><button className="wardrobe-button" disabled={!member} onClick={() => setEditor(true)}><Shirt size={17} /> Mi personaje</button></div>
      </section>
      <aside className="sidebar">
        <div className="sidebar-intro"><span className="eyebrow">SIN PRISA, CONTIGO</span><h1>Estamos en casa.</h1></div>
        {member ? <FocusPanel member={member} now={now} send={send} onComplete={complete} /> : <section className="focus-card"><Leaf size={24} /><h2>Abriendo vuestra casa…</h2><p>Conectando con la sala privada.</p></section>}
        <section className="company-card"><div className="section-heading"><h2>Al otro lado</h2><Heart size={16} /></div>
          <div className="company-person"><div className={`portrait ${partnerHere ? '' : 'empty'}`}>{partner ? <AvatarPreview avatar={partner.avatar} size={34} /> : <Coffee size={26} />}<span className={partnerHere ? 'status-dot online' : 'status-dot'} /></div><div><strong>{partner?.name ?? 'Un sitio para tu persona'}</strong><p>{partnerHere ? 'Aquí, contigo' : preview ? 'La compañía llegará al conectar la casa' : 'Todavía no está en casa'}</p></div></div>
          {partnerFocus && partnerRemaining > 0 && (
            <div className={`partner-focus ${partnerFocus.endsAt === null ? 'paused' : ''}`} aria-label="Foco de tu pareja">
              <span>{partnerFocus.endsAt === null ? 'Ⅱ EN PAUSA' : '● EN FOCO'}</span>
              <strong>{partnerFocus.title}</strong>
              <small>{partnerFocus.duration / 60000} min en total · {Math.ceil(partnerRemaining / 60000)} min restantes</small>
              <progress aria-label="Progreso del foco de tu pareja" max={partnerFocus.duration} value={partnerFocus.duration - partnerRemaining}/>
            </div>
          )}
          <div className="company-actions"><button disabled={!partnerHere || !closeEnough || !available} title={!closeEnough ? 'Acércate a tu pareja para abrazarla' : 'Dar un abrazo'} onClick={() => partner && send({ type: 'hug', id: crypto.randomUUID(), target: partner.id })}><Heart size={17} /> Abrazar</button><button disabled={!partnerHere || !available} onClick={() => sendText('¡Ánimo, mi amor! ♡')}><Send size={16} /> Dar ánimos</button></div>
        </section>
        <div className="little-note"><span>una cosita antes de seguir</span><p>No tienes que poder con todo.<br />Solo con un poquito, hoy.</p><Leaf size={21} /></div>
      </aside>
    </main>
    <footer className="bottom-bar"><div className="presence"><span className={`live-dot ${available ? '' : 'disconnected'}`} /><div><strong>{preview ? 'Tu rincón de prueba' : partnerHere ? 'Los dos en casa' : 'La casa te esperaba'}</strong><span>{preview ? 'Guardado solo en este navegador' : available ? 'Sala privada · conexión activa' : 'Sin conexión · reintentando'}</span></div></div>
      <form className="chat-form" onSubmit={e => { e.preventDefault(); if (sendText(message.trim())) setMessage(''); }}><label className="sr-only" htmlFor="chat">Mensaje para tu pareja</label><input id="chat" value={message} onChange={e => setMessage(e.target.value)} maxLength={180} placeholder={preview ? 'Prueba un bocadillo bonito…' : 'Escribe algo bonito…'} disabled={!available} /><button type="button" className="icon-button history-button" aria-label="Ver mensajes recientes" aria-expanded={history} onClick={() => setHistory(!history)}><MessageCircle size={19} /></button><button className="send-button" aria-label="Enviar mensaje" disabled={!message.trim() || !available}><Send size={18} /></button></form>
      {snapshot.state.television ? <button className="remote-toggle" aria-label={remoteVisible ? 'Ocultar mando de la TV' : 'Mostrar mando de la TV'} aria-expanded={remoteVisible} aria-controls="tv-remote" onClick={() => setRemoteVisible(v => !v)}><span className="pixel-remote-icon" aria-hidden="true" /><span>Mando</span><i aria-hidden="true" /></button> : null}
      <MusicPlayer onOpen={() => setRemoteVisible(false)} />
    </footer>
    <Television remoteVisible={remoteVisible} onHide={() => setRemoteVisible(false)} screenHost={tvScreenHost} television={snapshot.state.television ?? null} editing={tvEditing} onClose={() => setTvEditing(false)} onEdit={openTelevision} send={send} now={now} available={available} />
    {history ? <section className="history-panel" aria-label="Mensajes recientes"><div className="section-heading"><h2>Pequeñas palabras</h2><button className="icon-button" onClick={() => setHistory(false)} aria-label="Cerrar mensajes"><X size={17} /></button></div><div className="history-messages">{snapshot.state.messages.length ? snapshot.state.messages.slice(-10).map(m => <p key={m.id}><strong>{snapshot.state.members[m.memberId]?.name ?? 'Compañía'}</strong><span>{m.text}</span><time>{new Date(m.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time></p>) : <p className="empty-history">Aquí irán quedando vuestras palabras bonitas.</p>}</div><small>{preview ? 'Últimos 10 mensajes de esta vista local.' : 'Solo se conservan los últimos 10 mensajes, durante un máximo de 24 horas.'}</small></section> : null}
    {toast ? <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => setToast('')}><X size={15} /></button></div> : null}
    {editor && member ? <AvatarEditor member={member} onClose={() => setEditor(false)} onSave={(name, avatar) => { if (send({ type: 'profile', name, avatar })) { setEditor(false); announce(preview ? 'Tu personaje está guardado en este navegador.' : 'Cambio enviado a la casa.'); } }} /> : null}
  </div>;
}
