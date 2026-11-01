import { describe, expect, it } from 'vitest';
import { applyAction, emptyRoom, newMember, normalizeRoom, SEATS, walkable } from '../shared/model';
import { defaultPets, PET_BEDS, PET_IDS, petPosition } from '../shared/pets';

describe('Mascotas compartidas sin temporizador de servidor', () => {
  it('mantiene recorridos transitables y reproducibles tras serializar durante un día', () => {
    const pets=defaultPets(), restored=JSON.parse(JSON.stringify(pets));
    for(const id of PET_IDS) for(let now=0;now<86400000;now+=1700){
      const position=petPosition(id,pets[id],now);
      expect(walkable({x:Math.round(position.x),y:Math.round(position.y)})).toBe(true);
      expect(petPosition(id,restored[id],now)).toEqual(position);
    }
  });
  it('duerme en su cama, despierta con caricias y vuelve a caminar', () => {
    for(const id of PET_IDS){
      const now=159000; let room=emptyRoom(); room.members.a=newMember('a');
      const sleeping=petPosition(id,room.pets![id],now);
      expect(sleeping.sleeping).toBe(true); expect({x:sleeping.x,y:sleeping.y}).toEqual(PET_BEDS[id]);
      room.members.a.position={...PET_BEDS[id]};
      room=applyAction(room,'a',{type:'pet',pet:id},now);
      expect(petPosition(id,room.pets![id],now).sleeping).toBe(false);
      expect(petPosition(id,room.pets![id],now).affection).toBe(true);
      expect(petPosition(id,room.pets![id],now+3000).moving).toBe(true);
      expect(JSON.parse(JSON.stringify(room)).pets[id].pettedBy).toBe('a');
      expect(()=>applyAction(room,'a',{type:'pet',pet:id},now+500)).toThrow('instante');
    }
  });
  it('rechaza caricias desde lejos, desde un asiento y de terceros', () => {
    const room=emptyRoom(); room.members.a=newMember('a');
    room.members.a.position={x:11,y:9};
    expect(()=>applyAction(room,'a',{type:'pet',pet:'cat'},159000)).toThrow('Acércate');
    room.members.a.position={...PET_BEDS.cat}; room.members.a.seat='sofa';
    expect(()=>applyAction(room,'a',{type:'pet',pet:'cat'},159000)).toThrow('Acércate');
    expect(()=>applyAction(room,'outsider',{type:'pet',pet:'cat'},159000)).toThrow('perteneces');
  });
});

describe('Actualización de casas guardadas y retención limitada', () => {
  it('conserva perfiles y tareas, recoloca asientos/obstáculos y es idempotente', () => {
    const old=emptyRoom(); delete old.layoutRevision; delete old.pets;
    old.members.a=newMember('a'); old.members.a.seat='sofa'; old.members.a.position={x:4,y:6};
    old.members.a.focus={title:'Leer',duration:60000,remaining:60000,endsAt:null,revision:2};
    old.members.b=newMember('b'); old.members.b.position={x:6,y:7};
    const migrated=normalizeRoom(old,200000);
    expect(migrated.members.a.position).toEqual({x:SEATS[2].x,y:SEATS[2].y});
    expect(migrated.members.a.avatar).toEqual(old.members.a.avatar);
    expect(migrated.members.a.focus).toEqual(old.members.a.focus);
    expect(walkable(migrated.members.b.position)).toBe(true);
    expect(migrated.pets).toEqual(defaultPets());
    expect(normalizeRoom(migrated,200000)).toEqual(migrated);
    expect(old.members.a.position).toEqual({x:4,y:6});
  });
  it('guarda solo los diez últimos mensajes y elimina los de más de 24 horas', () => {
    let room=emptyRoom(); room.members.a=newMember('a');
    for(let i=0;i<15;i++)room=applyAction(room,'a',{type:'chat',id:crypto.randomUUID(),text:`Mensaje ${i}`},100000+i);
    expect(room.messages).toHaveLength(10); expect(room.messages[0].text).toBe('Mensaje 5');
    const old={...room,messages:Array.from({length:50},(_,i)=>({id:String(i),memberId:'a',text:'Anterior',at:100000+i}))};
    expect(normalizeRoom(old,200000).messages.map(m=>m.id)).toEqual(Array.from({length:10},(_,i)=>String(40+i)));
    expect(normalizeRoom(old,86500050).messages).toHaveLength(0);
  });
});
