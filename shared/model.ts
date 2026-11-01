import { z } from 'zod';
import { pathBetween, walkable, type Point } from './room-layout';
import { petPosition, defaultPets, type Pets } from './pets';
import { youtubeLink, type Television } from './media';

export const COLORS = {
  skin: ['#f2c69f', '#dcaa80', '#bc8058', '#8a563d', '#593a30'],
  hair: ['#392b29', '#714b34', '#b87c42', '#dbc083', '#9c4d38', '#d5d0bd'],
  beard: ['#392b29', '#714b34', '#b87c42', '#dbc083', '#9c4d38', '#d5d0bd'],
  shirt: ['#4c7165', '#bf7054', '#7385a1', '#c49c55', '#c9b3c9', '#e5dac5', '#353c46', '#8b4350'],
  trousers: ['#394954', '#605347', '#7c8562', '#a4a2a0'],
  shoes: ['#eee4d0', '#423935', '#b16d48', '#64745a'],
} as const;
export const avatarSchema = z.object({
  skin: z.enum(COLORS.skin), hair: z.enum(COLORS.hair), shirt: z.enum(COLORS.shirt),
  trousers: z.enum(COLORS.trousers), style: z.enum(['short', 'bob', 'long', 'curly', 'bun', 'buzz', 'slick']), glasses: z.boolean(),
  beard: z.enum(COLORS.beard).optional(),
  facialHair: z.enum(['none', 'moustache', 'goatee', 'beard']).default('none'),
  frames: z.enum(['round', 'square']).default('round'),
  outfit: z.enum(['knit', 'hoodie', 'cardigan', 'shirt', 'tee']).default('knit'),
  bottoms: z.enum(['jeans', 'chinos', 'shorts', 'skirt']).default('jeans'),
  shoes: z.enum(COLORS.shoes).default(COLORS.shoes[0]),
}).transform(a => ({ ...a, beard: a.beard ?? a.hair }));
export type Avatar = z.infer<typeof avatarSchema>;
export const DEFAULT_AVATAR: Avatar = avatarSchema.parse({ skin: COLORS.skin[0], hair: COLORS.hair[0], shirt: COLORS.shirt[0], trousers: COLORS.trousers[0], style: 'short', glasses: false });
export type { Point } from './room-layout';
export { BLOCKS, pathBetween, walkable } from './room-layout';
export const SEATS = [
  { id: 'desk-left', name: 'Escritorio junto a la ventana', x: 2, y: 4 },
  { id: 'desk-right', name: 'Escritorio de la librería', x: 8, y: 2 },
  { id: 'sofa', name: 'Sofá · izquierda', x: 5, y: 8 },
  { id: 'sofa-right', name: 'Sofá · derecha', x: 7, y: 8 },
] as const;
export type Focus = { title: string; duration: number; remaining: number; endsAt: number | null; revision: number };
export type Member = { id: string; name: string; avatar: Avatar; position: Point; seat: string | null; focus: Focus | null };
export type ChatMessage = { id: string; memberId: string; text: string; at: number };
export type RoomState = { version: 1; layoutRevision?: number; pets?: Pets; members: Record<string, Member>; messages: ChatMessage[]; revision: number; television?: Television | null };
export const emptyRoom = (): RoomState => ({ version: 1, layoutRevision: 3, pets: defaultPets(), members: {}, messages: [], revision: 0, television: null });
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), x: z.number().int().min(0).max(11), y: z.number().int().min(0).max(9) }),
  z.object({ type: z.literal('sit'), seat: z.enum(['desk-left', 'desk-right', 'sofa', 'sofa-right']) }),
  z.object({ type: z.literal('tv-play'), url: z.string().max(500) }),
  z.object({ type: z.literal('tv-off'), revision: z.number().int().nonnegative() }),
  z.object({ type: z.literal('pet'), pet: z.enum(['cat', 'dog']) }),
  z.object({ type: z.literal('profile'), name: z.string().trim().min(1).max(24), avatar: avatarSchema }),
  z.object({ type: z.literal('chat'), id: z.string().uuid(), text: z.string().trim().min(1).max(180) }),
  z.object({ type: z.literal('focus-start'), title: z.string().trim().min(1).max(80), minutes: z.number().int().min(1).max(240) }),
  z.object({ type: z.literal('focus-control'), operation: z.enum(['pause', 'resume', 'finish']), revision: z.number().int() }),
  z.object({ type: z.literal('hug'), id: z.string().uuid(), target: z.string().max(128) }),
]);
export type Action = z.infer<typeof actionSchema>;
export type Snapshot = { type: 'snapshot'; state: RoomState; online: string[]; now: number; selfId?: string };

export const focusRemaining = (focus: Focus | null, now: number): number => !focus ? 0 : Math.max(0, focus.endsAt === null ? focus.remaining : focus.endsAt - now);
export function applyAction(state: RoomState, memberId: string, raw: unknown, now: number): RoomState {
  const action = actionSchema.parse(raw); const next = structuredClone(state); const member = next.members[memberId];
  if (!member) throw new Error('No perteneces a esta casa.');
  switch (action.type) {
    case 'move': {
      const occupied = Object.values(next.members).filter(m => m.id !== memberId && m.seat).map(m => m.position);
      if (!pathBetween(member.position, action, occupied).length) throw new Error('No puedes caminar hasta ahí.');
      member.position = { x: action.x, y: action.y }; member.seat = null; break;
    }
    case 'sit': {
      const seat = SEATS.find(s => s.id === action.seat)!;
      if (Object.values(next.members).some(m => m.id !== memberId && m.seat === seat.id)) throw new Error('Ese asiento está ocupado.');
      const occupied = Object.values(next.members).filter(m => m.id !== memberId && m.seat).map(m => m.position);
      if (!pathBetween(member.position, seat, occupied).length) throw new Error('No puedes llegar a ese asiento.');
      member.position = { x: seat.x, y: seat.y }; member.seat = seat.id; break;
    }
    case 'tv-play':
      next.television = { ...youtubeLink(action.url), startedAt: now, revision: state.revision + 1 }; break;
    case 'tv-off':
      if (!next.television || next.television.revision !== action.revision) throw new Error('La TV ha cambiado. Prueba otra vez.');
      next.television = null; break;
    case 'pet': {
      const pets=next.pets??defaultPets();const pet=petPosition(action.pet,pets[action.pet],now);
      if(member.seat || Math.hypot(member.position.x-pet.x,member.position.y-pet.y)>1.9)throw new Error('Acércate un poquito más para acariciarlo.');
      if(now-pets[action.pet].pettedAt<1800)throw new Error('Dale un instante para disfrutar de la caricia.');
      pets[action.pet]={epoch:now,origin:{x:Math.round(pet.x),y:Math.round(pet.y)},pettedAt:now,pettedBy:memberId};next.pets=pets;break;
    }
    case 'profile': member.avatar = action.avatar; member.name = action.name; break;
    case 'chat':
      if (next.messages.some(m => m.id === action.id)) return state;
      next.messages.push({ id: action.id, memberId, text: action.text, at: now }); break;
    case 'hug': {
      const target = next.members[action.target];
      if (!target || target.id === memberId || Math.abs(member.position.x - target.position.x) + Math.abs(member.position.y - target.position.y) > 2) throw new Error('Acércate a tu pareja para darle un abrazo.');
      if (next.messages.some(m => m.id === action.id)) return state;
      next.messages.push({ id: action.id, memberId, text: `Un abrazo para ${target.name} ♡`, at: now }); break;
    }
    case 'focus-start':
      if (member.focus && focusRemaining(member.focus, now) > 0) throw new Error('Termina tu sesión actual antes de empezar otra.');
      member.focus = { title: action.title, duration: action.minutes * 60000, remaining: action.minutes * 60000, endsAt: now + action.minutes * 60000, revision: state.revision + 1 }; break;
    case 'focus-control': {
      const focus = member.focus;
      if (!focus || focus.revision !== action.revision) throw new Error('La sesión ha cambiado. Vuelve a intentarlo.');
      if (action.operation === 'finish') { member.focus = null; break; }
      const remaining = focusRemaining(focus, now);
      if (remaining <= 0) throw new Error('Esta sesión ya ha terminado.');
      if (action.operation === 'pause' && focus.endsAt === null) throw new Error('La sesión ya está pausada.');
      if (action.operation === 'resume' && focus.endsAt !== null) throw new Error('La sesión ya está en marcha.');
      member.focus = { ...focus, remaining, endsAt: action.operation === 'pause' ? null : now + remaining, revision: focus.revision + 1 }; break;
    }
  }
  next.messages = next.messages.filter(m => now - m.at < 24 * 60 * 60 * 1000).slice(-10);
  next.revision++; return next;
}
export function newMember(id: string, name = 'Tú'): Member {
  return { id, name, avatar: { ...DEFAULT_AVATAR }, position: { x: 5, y: 4 }, seat: null, focus: null };
}

// Explicit, idempotent layout migration. Keep profiles, tasks and seat IDs intact.
export function normalizeRoom(input: RoomState, now: number): RoomState {
  const room=structuredClone(input);
  room.messages=room.messages.filter(m=>now-m.at<86400000).slice(-10);
  room.pets??=defaultPets();
  if(room.layoutRevision!==3){
    const nearestFree=(point:Point)=>{
      const candidates:Point[]=[];for(let x=0;x<12;x++)for(let y=0;y<10;y++)if(walkable({x,y}))candidates.push({x,y});
      candidates.sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y));
      return candidates[0];
    };
    for(const member of Object.values(room.members)){
      const seat=SEATS.find(s=>s.id===member.seat);
      if(seat)member.position={x:seat.x,y:seat.y};
      else if(!walkable(member.position)){
        member.position=nearestFree(member.position);member.seat=null;
      }
    }
    for(const pet of Object.values(room.pets))if(!walkable(pet.origin))pet.origin=nearestFree(pet.origin);
    room.layoutRevision=3;
  }
  return room;
}
