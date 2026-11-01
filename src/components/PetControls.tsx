import { Cat, Dog } from 'lucide-react';
import { PET_IDS, defaultPets, petPosition } from '../../shared/pets';
import type { Action, Member, RoomState } from '../../shared/model';
export function PetControls({room,member,now,available,send}:{room:RoomState;member:Member|undefined;now:number;available:boolean;send:(action:Action)=>boolean}){
  const pets=room.pets??defaultPets();
  return <div className="pet-controls" aria-label="Vuestros pequeños compañeros">{PET_IDS.map(id=>{
    const p=petPosition(id,pets[id],now),near=!!member&&!member.seat&&Math.hypot(member.position.x-p.x,member.position.y-p.y)<=1.9,name=id==='cat'?'gato':'perro';
    return <button key={id} disabled={!member||!available} title={p.sleeping?'Está durmiendo en su camita':near?'Una caricia para tu compañero':'Acércate para acariciarlo'} aria-label={`${near?'Acariciar':'Acercarme al'} ${name}`} onClick={()=>send(near?{type:'pet',pet:id}:{type:'move',x:Math.round(p.x),y:Math.round(p.y)})}>{id==='cat'?<Cat size={16}/>:<Dog size={16}/>}<span>{near?'Acariciar':id==='cat'?'Gatito':'Perrito'}</span>{p.sleeping?<small>zzz</small>:null}</button>;
  })}</div>;
}
