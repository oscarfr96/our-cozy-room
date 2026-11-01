import { useEffect, useRef, useState } from 'react';
import { Music2, Pause, Play, X } from 'lucide-react';
const tracks = [
  { id:'satie1',title:'Una tarde lenta',detail:'Satie · Gymnopédie n.º 1',file:'/audio/amclassical_satie_gymnopedie_no_1.mp3' },
  { id:'satie3',title:'Entre nubes',detail:'Satie · Gymnopédie n.º 3',file:'/audio/amclassical_satie_gymnopedie_no_3.mp3' },
  { id:'bach',title:'Un poquito de calma',detail:'Bach · Preludio en do mayor, BWV 846a',file:'/audio/amclassical_prelude_in_c_major_bwv_846a.mp3' },
];
export function MusicPlayer({onOpen}:{onOpen:()=>void}) {
  const [open,setOpen]=useState(false),[track,setTrack]=useState(tracks[0]),[playing,setPlaying]=useState(false),[volume,setVolume]=useState(20),[error,setError]=useState('');
  const audio=useRef<HTMLAudioElement>(null),intent=useRef(false),request=useRef(0);
  useEffect(()=>{const element=audio.current;return()=>{request.current++;intent.current=false;element?.pause();};},[]);
  const play=async()=>{
    const element=audio.current;if(!element)return;
    const current=++request.current;intent.current=true;setError('');element.volume=volume/100;
    try { await element.play();if(current===request.current&&!intent.current)element.pause(); }
    catch {if(current===request.current){intent.current=false;setPlaying(false);setError('No se pudo reproducir. Vuelve a pulsar Escuchar.');}}
  };
  const toggle=()=>{if(intent.current){intent.current=false;request.current++;audio.current?.pause();}else{if(audio.current&&!audio.current.getAttribute('src'))audio.current.src=track.file;void play();}};
  const choose=(next:typeof track)=>{if(next.id===track.id)return;const resume=intent.current;request.current++;audio.current?.pause();setTrack(next);setError('');if(audio.current)audio.current.src=next.file;if(resume)void play();};
  return <>
    <audio ref={audio} loop preload="none" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>{intent.current=false;setPlaying(false);setError('No se ha podido cargar esta grabación.');}} />
    <button className={`ambient-button ${playing?'playing':''}`} aria-label="Música de ambiente" aria-expanded={open} aria-controls="music-panel" onClick={()=>{if(!open)onOpen();setOpen(v=>!v);}}><span className="vinyl"><span /></span><span><strong>{playing?track.title:'Música de ambiente'}</strong><small>{playing?'SONANDO PARA TI':'ELIGE TU RINCÓN SONORO'}</small></span><Music2 size={17}/></button>
    {open?<section className="music-panel" id="music-panel" aria-label="Música de ambiente"><div className="section-heading"><h2>Un disco para este ratito</h2><button aria-label="Cerrar música" onClick={()=>setOpen(false)}><X size={16}/></button></div><p>Piano tranquilo. Solo suena para ti.</p><div className="music-tracks">{tracks.map(item=><button key={item.id} aria-pressed={track.id===item.id} onClick={()=>choose(item)}><span aria-hidden="true">{track.id===item.id?'●':'○'}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>)}</div><label className="music-volume">Volumen<input type="range" aria-label="Volumen de la música" min="0" max="100" value={volume} onChange={e=>{const v=Number(e.target.value);setVolume(v);if(audio.current)audio.current.volume=v/100;}}/><output>{volume}%</output></label><button className="button primary music-play" onClick={toggle}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pausar':'Escuchar'}</button>{error?<p role="alert">{error}</p>:null}<small className="music-credit">Grabaciones: <a href="https://amclassical.com/piano/" target="_blank" rel="noreferrer">A-M Classical</a> · <a href="https://creativecommons.org/licenses/by/3.0/us/" target="_blank" rel="noreferrer">CC BY 3.0 US</a>. Archivos originales, sin modificaciones.</small></section>:null}
  </>;
}
