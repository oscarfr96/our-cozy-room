import { z } from 'zod';
import { pathBetween, type Point } from './room-layout';
export const PET_IDS = ['cat','dog'] as const;
export type PetId = typeof PET_IDS[number];
export const PET_BEDS:Record<PetId,Point>={cat:{x:11,y:2},dog:{x:1,y:7}};
const pointSchema=z.object({x:z.number().int().min(0).max(11),y:z.number().int().min(0).max(9)});
const petSchema=z.object({epoch:z.number().finite(),origin:pointSchema,pettedAt:z.number().finite(),pettedBy:z.string().nullable()});
export const petsSchema=z.object({cat:petSchema,dog:petSchema});
export type Pets=z.infer<typeof petsSchema>;
export function defaultPets():Pets {return {cat:{epoch:0,origin:{...PET_BEDS.cat},pettedAt:0,pettedBy:null},dog:{epoch:0,origin:{...PET_BEDS.dog},pettedAt:0,pettedBy:null}};}
const STOPS:Point[]=[{x:3,y:7},{x:8,y:5},{x:9,y:8},{x:4,y:3},{x:6,y:4},{x:2,y:6}];
const paths=new Map<string,Point[]>();
function route(a:Point,b:Point){const key=`${a.x},${a.y}:${b.x},${b.y}`;let path=paths.get(key);if(!path){path=pathBetween(a,b);if(paths.size>128)paths.clear();paths.set(key,path);}return path.length?path:[a];}
function stop(id:PetId,cycle:number):Point {
  if(cycle%4===3)return PET_BEDS[id];
  const seed=(Math.imul(cycle+1,1103515245)+(id==='cat'?12345:67891))>>>0;
  return STOPS[seed%STOPS.length];
}
// Stateless clock-based wandering keeps both browsers in sync while the DO hibernates.
export function petPosition(id:PetId,state:Pets[PetId],now:number){
  const elapsed=Math.max(0,now-state.epoch),cycle=Math.floor(elapsed/40000),phase=elapsed%40000;
  const from=cycle===0?state.origin:stop(id,cycle-1),to=stop(id,cycle);
  const path=route(from,to),walkDuration=Math.max(1,(path.length-1)*700);
  const wait=state.pettedAt>0&&cycle===0?2200:3000;
  const progress=Math.max(0,Math.min(path.length-1,(phase-wait)/700));
  const index=Math.floor(progress),a=path[index],b=path[Math.min(index+1,path.length-1)],fraction=progress-index;
  const moving=phase>=wait&&phase<wait+walkDuration&&path.length>1;
  const home=to.x===PET_BEDS[id].x&&to.y===PET_BEDS[id].y;
  return {x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,moving,sleeping:home&&phase>wait+walkDuration+3000,
    resting:!moving&&phase>wait+walkDuration+3000,direction:b.x-a.x+b.y-a.y>=0?1:-1,affection:state.pettedAt>0&&now-state.pettedAt<2200};
}
