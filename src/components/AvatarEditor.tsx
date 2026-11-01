import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, RotateCw, Shirt, X } from 'lucide-react';
import { avatarSchema, COLORS, type Avatar, type Member } from '../../shared/model';
import { AvatarPreview } from './AvatarPreview';
function Choices({ label, value, options, change }: { label: string; value: string; options: readonly (readonly [string, string])[]; change: (value: string) => void }) {
  return <fieldset><legend>{label}</legend><div className="wardrobe-choices">{options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} className={value === key ? 'selected' : ''} onClick={() => change(key)}>{text}</button>)}</div></fieldset>;
}
const colorLabels = { skin: 'Piel', hair: 'Pelo', beard: 'Barba y bigote', shirt: 'Prenda', trousers: 'Parte de abajo', shoes: 'Calzado' };
export function AvatarEditor({ member, onSave, onClose }: { member: Member; onSave: (name: string, avatar: Avatar) => void; onClose: () => void }) {
  const [avatar, setAvatar] = useState<Avatar>(() => avatarSchema.parse(member.avatar)), [name, setName] = useState(member.name);
  const [section, setSection] = useState('Rostro'), [direction, setDirection] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const choose = (key: keyof Avatar) => (value: string) => setAvatar(a => avatarSchema.parse({ ...a, [key]: value }));
  return <dialog ref={dialog} className="editor-dialog wardrobe-v2" onCancel={onClose} aria-labelledby="editor-title">
    <div className="editor-head"><span className="eyebrow"><Shirt size={14} /> TU ARMARIO · PEQUEÑOS DETALLES, MUCHO DE TI</span><button className="icon-button" onClick={onClose} aria-label="Cerrar armario"><X size={21} /></button></div>
    <h2 id="editor-title">Un poquito más tú.</h2><p className="muted">Tu jersey de siempre. Ese peinado. Tu manera de estar en casa.</p>
    <form onSubmit={event => { event.preventDefault(); onSave(name.trim(), avatar); }}>
      <div className="editor-grid"><div className="avatar-stage"><span className="eyebrow">ASÍ TE VERÁS EN CASA</span><div className="avatar-pedestal"><AvatarPreview avatar={avatar} size={144} direction={direction} /></div><strong>{name || 'Tu personaje'}</strong><div className="avatar-turn"><button type="button" aria-label="Girar a la izquierda" onClick={() => setDirection(v => (v + 3) % 4)}><RotateCcw size={16} /></button><small>Vista {direction + 1} / 4</small><button type="button" aria-label="Girar a la derecha" onClick={() => setDirection(v => (v + 1) % 4)}><RotateCw size={16} /></button></div><p>Cada detalle se guarda<br />también en vuestra sala.</p></div>
      <div className="editor-options"><label className="field-label">¿Cómo te llamas?<input value={name} onChange={e => setName(e.target.value)} required maxLength={24} placeholder="Tu nombre" /></label>
      <nav className="wardrobe-tabs" aria-label="Secciones del armario">{['Rostro', 'Pelo', 'Ropa', 'Colores'].map(tab => <button key={tab} type="button" aria-pressed={section === tab} onClick={() => setSection(tab)}>{tab}</button>)}</nav>
      <div className="wardrobe-section">
      {section === 'Rostro' ? <><Choices label="Barba y bigote" value={avatar.facialHair} options={[["none", "Sin barba"], ["moustache", "Bigote"], ["goatee", "Perilla"], ["beard", "Barba completa"]]} change={choose('facialHair')} /><label className="checkbox-label"><input type="checkbox" checked={avatar.glasses} onChange={e => setAvatar({ ...avatar, glasses: e.target.checked })} /> Llevo gafas</label>{avatar.glasses ? <Choices label="Montura de las gafas" value={avatar.frames} options={[["round", "Redondas"], ["square", "Rectangulares"]]} change={choose('frames')} /> : null}<p className="wardrobe-hint">El pelo y la barba tienen colores independientes. Elígelos en Colores.</p></> : null}
      {section === 'Pelo' ? <Choices label="Tu peinado" value={avatar.style} options={[["short", "Corto"], ["curly", "Rizado"], ["bob", "Media melena"], ["long", "Largo"], ["bun", "Moño"], ["buzz", "Rapado"], ["slick", "Hacia atrás · degradado"]]} change={choose('style')} /> : null}
      {section === 'Ropa' ? <><Choices label="Para estar a gusto" value={avatar.outfit} options={[["knit", "Jersey de punto"], ["hoodie", "Sudadera"], ["cardigan", "Cárdigan"], ["shirt", "Camisa"], ["tee", "Camiseta"]]} change={choose('outfit')} /><Choices label="Parte de abajo" value={avatar.bottoms} options={[["jeans", "Vaqueros"], ["chinos", "Chinos"], ["shorts", "Pantalón corto"], ["skirt", "Falda"]]} change={choose('bottoms')} /></> : null}
      {section === 'Colores' ? (Object.keys(COLORS) as (keyof typeof COLORS)[]).map(key => <fieldset key={key}><legend>{colorLabels[key]}</legend><div className="swatches">{COLORS[key].map((color, i) => <button type="button" key={color} style={{ background: color }} aria-label={`${colorLabels[key]}: tono ${i + 1}`} aria-pressed={avatar[key] === color} className={avatar[key] === color ? 'swatch selected' : 'swatch'} onClick={() => setAvatar({ ...avatar, [key]: color })}>{avatar[key] === color ? <Check size={15} /> : null}</button>)}</div></fieldset>) : null}
      </div></div></div>
      <div className="dialog-actions"><span className="wardrobe-hint">Hecho a tu gusto, sin necesidad de IA.</span><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={!name.trim()}><Check size={16} /> Así soy yo</button></div>
    </form>
  </dialog>;
}
