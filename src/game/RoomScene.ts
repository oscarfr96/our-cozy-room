import Phaser from 'phaser';
import { PET_IDS, PET_BEDS, defaultPets, petPosition, type PetId } from '../../shared/pets';
import { avatarPixels } from '../../shared/avatar';
import { daylightAt, mixColor } from './daylight';
import { seatPose, SOFA_OFFSET_Y } from './seat-poses';
import { insideTelevision, TV_WALL } from './television-layout';
import { pathBetween, SEATS, walkable, type Action, type Member, type Point, type RoomState } from '../../shared/model';

const W = 84, H = 34, OX = 470, OY = 240;
// The rear corners of the console sit vertically below the TV frame corners.
const TV_SIDE_BEZEL = .12;
const CONSOLE = { x: TV_WALL.x - TV_SIDE_BEZEL, y: TV_WALL.y, width: TV_WALL.width + 2 * TV_SIDE_BEZEL, depth: .78 };
export const project = (x: number, y: number, z = 0) => ({ x: OX + (x - y) * W / 2, y: OY + (x + y) * H / 2 - z });
export const unproject = (x: number, y: number): Point => ({ x: Math.floor((x - OX) / W + (y - OY) / H), y: Math.floor((y - OY) / H - (x - OX) / W) });
type Figure = { member: Member; graphic: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; point: Point; route: Point[]; direction: number; display?: { x: number; y: number }; sitBlend?: number; paintKey?: string; bubble?: Phaser.GameObjects.Container; bubbleStartedAt?: number; lastMessage?: string };

export class RoomScene extends Phaser.Scene {
  private figures = new Map<string, Figure>();
  private marker!: Phaser.GameObjects.Graphics;
  private room: RoomState | null = null;
  private selfId = '';
  private online: string[] = [];
  private emit: (action: Action) => void;
  private announce: (message: string) => void;
  private active = false;
  private sky!: Phaser.GameObjects.Graphics;
  private skyMinute = -1;
  private visualHour: number | null = null;
  private roomShade!: Phaser.GameObjects.Graphics;
  private ambient!: Phaser.GameObjects.Graphics;
  private windowMotion!: Phaser.GameObjects.Graphics;
  private lastAmbientFrame = -1;
  private lastPetFrame = -1;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private televisionGraphic!: Phaser.GameObjects.Graphics;
  private televisionOn = false;
  private onTelevision: () => void;
  private serverOffset=0;
  private animals=new Map<PetId,Phaser.GameObjects.Graphics>();
  setServerOffset(offset:number){this.serverOffset=offset;}
  private serverNow(){return Date.now()+this.serverOffset;}

  constructor(emit: (action: Action) => void, announce: (message: string) => void, onTelevision: () => void) {
    super('room'); this.emit = emit; this.announce = announce; this.onTelevision = onTelevision;
  }
  setVisualHour(hour: number | null) {
    this.visualHour = hour; this.skyMinute = -1; this.lastAmbientFrame = -1;
  }
  private light() {
    const now = new Date();
    return daylightAt(this.visualHour ?? now.getHours() + now.getMinutes() / 60);
  }
  private seatAt(x: number, y: number) {
    return [...SEATS].sort((a, b) => {
      const pa = seatPose(a.id)!, pb = seatPose(b.id)!;
      const ca = project(pa.x, pa.y, 33), cb = project(pb.x, pb.y, 33);
      return Math.hypot(x - ca.x, y - ca.y) - Math.hypot(x - cb.x, y - cb.y);
    }).find(seat => {
      const pose = seatPose(seat.id)!;
      const sofa = seat.id.startsWith('sofa'), center = project(pose.x, pose.y, sofa ? 33 : 30);
      return Math.abs(x - center.x) / (sofa ? 42 : 32) + Math.abs(y - center.y) / (sofa ? 28 : 22) <= 1;
    });
  }
  private televisionAt(x: number, y: number) {
    return insideTelevision(x, y);
  }
  create() {
    this.buildRoom();
    this.petBeds();
    for(const id of PET_IDS)this.animals.set(id,this.add.graphics());
    this.roomShade = this.add.graphics().setDepth(9980);
    this.ambient = this.add.graphics().setDepth(9990);
    this.windowMotion = this.add.graphics().setDepth(-7.5);
    const windowMask = this.make.graphics({ x: 0, y: 0 });
    this.poly(windowMask, [[0,2.05,56],[0,6.8,56],[0,6.8,203],[0,2.05,203]], 0xffffff);
    this.windowMotion.setMask(windowMask.createGeometryMask());
    this.marker = this.add.graphics().setDepth(2);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const p = unproject(pointer.x, pointer.y); this.marker.clear();
      if(this.petAt(pointer.x,pointer.y)){this.game.canvas.style.cursor='pointer';return;}
      if (this.televisionAt(pointer.x, pointer.y)) { this.game.canvas.style.cursor = 'pointer'; return; }
      const seat = this.seatAt(pointer.x, pointer.y);
      if (seat) {
        const pose = seatPose(seat.id)!, center = project(pose.x, pose.y, seat.id.startsWith('sofa') ? 33 : 30);
        this.marker.setDepth(9991).lineStyle(2, 0xffe5a7, .8).strokeEllipse(center.x, center.y, 42, 16);
        this.game.canvas.style.cursor = 'pointer';
      } else if (walkable(p)) {
        this.marker.setDepth(2);
        this.poly(this.marker, [[p.x, p.y], [p.x + 1, p.y], [p.x + 1, p.y + 1], [p.x, p.y + 1]], 0xfbf1c9, .17, 0xfbf1c9);
        this.game.canvas.style.cursor = 'pointer';
      } else this.game.canvas.style.cursor = 'default';
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.selfId || !this.room) return;
      if (this.televisionAt(pointer.x, pointer.y)) { this.onTelevision(); return; }
      const pet=this.petAt(pointer.x,pointer.y);
      if(pet){const p=petPosition(pet,(this.room.pets??defaultPets())[pet],this.serverNow()),member=this.room.members[this.selfId];
        if(!member.seat&&Math.hypot(member.position.x-p.x,member.position.y-p.y)<=1.9)this.emit({type:'pet',pet});
        else {this.emit({type:'move',x:Math.round(p.x),y:Math.round(p.y)});this.announce('Acércate y pulsa de nuevo para acariciarlo.');}return;}
      const destination = unproject(pointer.x, pointer.y);
      const seat = this.seatAt(pointer.x, pointer.y) ?? SEATS.find(s => s.x === destination.x && s.y === destination.y);
      if (seat) this.emit({ type: 'sit', seat: seat.id });
      else if (walkable(destination)) this.emit({ type: 'move', ...destination });
      else this.announce('Elige una baldosa libre para caminar.');
    });
    this.active = true;
    if (this.room) this.sync(this.room, this.selfId, this.online);
    this.events.once('shutdown', () => { this.active = false; this.figures.clear(); this.animals.clear(); windowMask.destroy(); });
  }
  private poly(g: Phaser.GameObjects.Graphics, points: number[][], fill: number, alpha = 1, stroke?: number) {
    const p = points.map(([x, y, z]) => project(x, y, z ?? 0));
    g.fillStyle(fill, alpha).fillPoints(p, true);
    if (stroke !== undefined) g.lineStyle(1.2, stroke, .8).strokePoints(p, true);
  }
  private box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, d: number, h: number, top: number, left: number, right: number, base = 0) {
    this.poly(g, [[x, y + d, base], [x + w, y + d, base], [x + w, y + d, base + h], [x, y + d, base + h]], left, 1, 0x554132);
    this.poly(g, [[x + w, y, base], [x + w, y + d, base], [x + w, y + d, base + h], [x + w, y, base + h]], right, 1, 0x554132);
    this.poly(g, [[x, y, base + h], [x + w, y, base + h], [x + w, y + d, base + h], [x, y + d, base + h]], top, 1, 0x554132);
  }
  private buildRoom() {
    const floor = this.add.graphics().setDepth(-10);
    floor.fillStyle(0x172f28, .16).fillEllipse(510, 593, 820, 60);
    this.box(floor, 0, 0, 12, 10, 18, 0xb98b61, 0x805b42, 0x644b39, -18);
    for (let x = 0; x < 12; x++) for (let y = 0; y < 10; y++) {
      const shades = [0xb88453, 0xbd8c59, 0xc39765, 0xc99964];
      this.poly(floor, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], shades[(x * 7 + y * 3) % 4], 1, 0xac8058);
      const a = project(x + .16, y + .38), b = project(x + .82, y + .38);
      floor.lineStyle(1, 0x92653e, .18).lineBetween(a.x, a.y, b.x, b.y);
      for (let n = 0; n < 5; n++) {
        const grain = project(x + .08, y + .12 + n * .17), end = project(x + .88, y + .12 + n * .17);
        floor.lineStyle(1, n % 2 ? 0xe0b57c : 0x745136, .24).lineBetween(grain.x, grain.y, end.x, end.y);
      }
      const nail = project(x + .12, y + .12); floor.fillStyle(0x65472e, .4).fillRect(nail.x, nail.y, 1, 1);
    }
    const walls = this.add.graphics().setDepth(-9);
    this.poly(walls, [[0, 0], [0, 10], [0, 10, 224], [0, 0, 224]], 0xd5bd91, 1, 0x4c4032);
    this.poly(walls, [[0, 0], [12, 0], [12, 0, 224], [0, 0, 224]], 0xe2ccaa, 1, 0x4c4032);
    for (let n = 1; n < 20; n++) {
      const a = project(0, n / 2), b = project(0, n / 2, 224);
      walls.lineStyle(1, 0x8e7656, .2).lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let n = 1; n < 24; n++) {
      const a = project(n / 2, 0), b = project(n / 2, 0, 224);
      walls.lineStyle(1, 0xad8b63, .16).lineBetween(a.x, a.y, b.x, b.y);
      for (let k = 0; k < 6; k++) { const p = project(n / 2 + .07, .01, 25 + k * 29); walls.lineStyle(1, 0x9d7750, .14).lineBetween(p.x, p.y, p.x, p.y - 15); }
    }
    this.poly(walls, [[0, 0, 224], [0, 10, 224], [-.18, 10, 231], [-.18, 0, 231]], 0x775338, 1, 0x4c4032);
    this.poly(walls, [[0, 0, 224], [12, 0, 224], [12, -.18, 231], [0, -.18, 231]], 0x956a46, 1, 0x4c4032);
    this.poly(walls, [[0, 0], [0, 10], [0, 10, 12], [0, 0, 12]], 0x98744f);
    this.poly(walls, [[0, 0], [12, 0], [12, 0, 12], [0, 0, 12]], 0xb0875b);
    this.sky = this.add.graphics().setDepth(-8); this.drawSky();
    const decor = this.add.graphics().setDepth(-7);
    // Deep timber frame with three panes overlooking a procedurally drawn sky.
    for (const y of [2, 3.6, 5.2, 6.8]) this.poly(decor, [[.04, y, 55], [.04, y + .12, 55], [.04, y + .12, 203], [.04, y, 203]], 0x6b5140);
    this.poly(decor, [[0, 2, 203], [0, 6.92, 203], [0, 6.92, 212], [0, 2, 212]], 0x79583e);
    this.box(decor, 0, 1.95, .32, 5.05, 7, 0xd3ad73, 0x916b46, 0x77553d, 51);
    // A curved garland. Each warm bulb has a restrained halo.
    const lights = Array.from({ length: 13 }, (_, i) => project(i * .88 + .65, .12, 198 - Math.sin(i / 12 * Math.PI) * 31));
    decor.lineStyle(2, 0x6b5a40).strokePoints(lights);
    lights.forEach(p => { decor.fillStyle(0xffd788, .12).fillCircle(p.x, p.y + 8, 15); decor.fillStyle(0xffd788, .22).fillCircle(p.x, p.y + 8, 8); decor.lineStyle(1, 0x66533c).lineBetween(p.x, p.y, p.x, p.y + 5); decor.fillStyle(0xffdda1).fillRoundedRect(p.x - 3, p.y + 4, 6, 9, 3); });
    // Woven rug with a repeated original motif.
    const rug = this.add.graphics().setDepth(-1);
    this.poly(rug, [[3.3, 4.7], [9.6, 4.7], [9.6, 9], [3.3, 9]], 0x536b55, 1, 0x405441);
    this.poly(rug, [[3.5, 4.9], [9.4, 4.9], [9.4, 8.8], [3.5, 8.8]], 0xe3cda5);
    this.poly(rug, [[3.8, 5.2], [9.1, 5.2], [9.1, 8.5], [3.8, 8.5]], 0x9baf86);
    for (let x = 4; x < 9.2; x += .7) for (let y = 5.4; y < 8.7; y += .7) {
      const p = project(x, y); rug.fillStyle(0xe7d8b1).fillEllipse(p.x, p.y, 10, 5); rug.fillStyle(0xac7252).fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    this.bookshelf(7.65, .12);
    this.desk(.2, 3.3, false); this.desk(7.1, .3, true);
    this.sofa(); this.musicConsole(); this.televisionGraphic = this.add.graphics().setDepth(-3); this.drawTelevision();
    this.plant(.25,8.05,1.1,'fern');this.plant(10.6,7.65,1.15,'monstera');this.plant(11.33,.12,.75,'snake');
    this.plant(.25,9.25,.65,'flowers');
    this.roomDetails();
    this.albumArt();
    for (const seat of SEATS) {
      if (seat.id.startsWith('sofa')) continue;
      const chair = this.add.graphics().setDepth((seat.x + seat.y + .8) * 100);
      this.box(chair, seat.x + .1, seat.y + .12, .8, .8, 8, 0x74816b, 0x50604d, 0x465541, 22);
      const p = project(seat.x + .5, seat.y + .5);
      chair.lineStyle(3, 0x4b4438).lineBetween(p.x, p.y - 20, p.x, p.y + 2);
      chair.lineBetween(p.x - 13, p.y + 4, p.x + 13, p.y - 3);
      // The near backrest sits in front of a seated person's lower torso.
      const backrest = this.add.graphics().setDepth((seat.x + seat.y + 1.7) * 100);
      if(seat.id==='desk-left') this.box(backrest,seat.x+.78,seat.y+.1,.14,.8,27,0x8c9c7b,0x607558,0x455b46,26);
      else this.box(backrest,seat.x+.1,seat.y+.78,.8,.14,27,0x8c9c7b,0x607558,0x455b46,26);
    }

  }
  private roomDetails() {
    const walls = this.add.graphics().setDepth(-6);
    // Hanging pothos: woven baskets, suspension cords and individual trailing leaves.
    for (const [x,y] of [[.12,7.2],[7.3,.1],[11.6,.15]]) {
      const p=project(x,y,175);
      walls.lineStyle(1,0x574d32).lineBetween(p.x,p.y-43,p.x-10,p.y).lineBetween(p.x,p.y-43,p.x+10,p.y);
      walls.fillStyle(0x9a7042).fillRoundedRect(p.x-13,p.y,26,19,6);
      for(let n=0;n<4;n++)walls.lineStyle(1,0xd2b177,.8).lineBetween(p.x-11,p.y+4+n*4,p.x+11,p.y+4+n*4);
      for(let n=0;n<6;n++) {
        const origin=p.x-13+n*5, length=20+(n*13%43);
        walls.lineStyle(2,0x3f6036).lineBetween(origin,p.y+2,origin+Math.sin(n)*8,p.y+length);
        for(let j=0;j<length;j+=7){const xx=origin+Math.sin(n+j*.15)*6, yy=p.y+j;walls.fillStyle([0x577738,0x7d923e,0x345b36][(n+j)%3]).fillEllipse(xx+(j%2?4:-4),yy,10,7);walls.fillStyle(0xb3b85b,.65).fillRect(xx,yy,2,2);}
      }
    }
    // Cork board with postcards, tape, a small calendar and pressed flowers.
    this.poly(walls,[[4.2,.03,53],[5.9,.03,53],[5.9,.03,111],[4.2,.03,111]],0x755437,1,0x4b3929);
    this.poly(walls,[[4.3,.04,57],[5.8,.04,57],[5.8,.04,107],[4.3,.04,107]],0xb18c59);
    for(let i=0;i<6;i++) {
      const x=4.38+(i%3)*.45,z=65+Math.floor(i/3)*23;
      this.poly(walls,[[x,.05,z],[x+.34,.05,z],[x+.34,.05,z+17],[x,.05,z+17]],i%2?0xe8dbc0:0x94aba0);
      const p=project(x+.17,.06,z+18);walls.fillStyle(0xcf9b71).fillRect(p.x-3,p.y-2,6,3);
    }
    // Window glow on floor and a small woven mat by the bookshelf.
    const light=this.add.graphics().setDepth(-2);
    this.poly(light,[[.1,2.2],[.1,6.7],[4.7,9],[4.7,4.5]],0xf1d58f,.065);
    const mat=this.add.graphics().setDepth(-.5);
    this.poly(mat,[[.7,6.1],[2.7,6.1],[2.7,7.6],[.7,7.6]],0xdcc6a0,1,0x786d4b);
    for(let x=.8;x<2.7;x+=.15)for(let y=6.2;y<7.6;y+=.17){const p=project(x,y);mat.fillStyle((Math.round(x*10)+Math.round(y*10))%3?0x87966d:0xbd9867,.8).fillRect(p.x,p.y,3,2);}
    // Embroidered flowers and tassels on the large rug.
    for(let x=3.45;x<9.5;x+=.22){const a=project(x,4.7),b=project(x,4.56);mat.lineStyle(1,0xe6d1a7,.9).lineBetween(a.x,a.y,b.x,b.y);}
    for(let x=3.9;x<9.2;x+=.66)for(let y=5.25;y<8.7;y+=.65){const p=project(x,y);mat.lineStyle(1,0x536c4a,.7).lineBetween(p.x,p.y,p.x+7,p.y+3);mat.fillStyle(0xb06c4c).fillRect(p.x-2,p.y-3,4,6).fillRect(p.x-4,p.y-1,8,2);mat.fillStyle(0xe9c586).fillRect(p.x-1,p.y-1,2,2);}
    const shadows=this.add.graphics().setDepth(-.3);
    for(const [x,y,w,d] of [[CONSOLE.x,CONSOLE.y,CONSOLE.width,CONSOLE.depth],[.2,3.3,1.7,2.4],[7.1,.3,2.8,1.5],[4.95,6 + SOFA_OFFSET_Y,3.1,1.14],[9.96,.12,1.34,.59]])this.poly(shadows,[[x,y+d],[x+w,y+d],[x+w+.45,y+d+.45],[x+.2,y+d+.45]],0x3b3525,.15);
  }
  private albumArt() {
    const g = this.add.graphics().setDepth(-5);
    // Original pixel illustration inspired by the green-haired, quiet portrait of Blonde.
    // No downloaded album cover or photograph is included in the open-source assets.
    const art = (u: number, v: number, w: number, h: number, color: number) =>
      this.poly(g, [[4.8+u*.043,.06,116+v*2],[4.8+(u+w)*.043,.06,116+v*2],[4.8+(u+w)*.043,.06,116+(v+h)*2],[4.8+u*.043,.06,116+(v+h)*2]],color);
    art(-2,-2,36,43,0x4e4037); art(0,0,32,39,0xe7e5d9);
    art(4,0,24,13,0xb8b9af); art(9,9,15,22,0x898e86); art(11,12,12,19,0xb6b8ac);
    art(11,29,12,5,0x82915e); art(9,27,15,5,0x728653); art(13,32,8,2,0xa0a878);
    art(9,16,8,6,0xd3d1bf); art(6,8,5,13,0xc5c5b7); art(11,18,8,2,0xd5d2c0);
    art(20,17,3,2,0x737b71); art(17,10,4,2,0x6b7269);
    const title=project(4.9,.08,188);
    this.add.text(title.x,title.y,'blond', {fontFamily:'Georgia',fontStyle:'italic',fontSize:'13px',color:'#474d3e'}).setAngle(22).setDepth(-4);
    // Companion print and a wall-mounted shelf of displayed record sleeves.
    this.poly(g,[[6.35,.06,125],[7.5,.06,125],[7.5,.06,183],[6.35,.06,183]],0x5e4938);
    this.poly(g,[[6.45,.07,130],[7.4,.07,130],[7.4,.07,178],[6.45,.07,178]],0x273b48);
    const moon=project(6.95,.08,161);g.fillStyle(0xd8c197).fillCircle(moon.x,moon.y,10);
    for(let i=0;i<8;i++){const p=project(6.51+(i*.17% .8),.09,136+(i*13%35));g.fillStyle(0xe8cba0).fillRect(p.x,p.y,1.5,1.5);}
    this.box(g,4.8,.05,2.5,.25,4,0xae895e,0x846342,0x6c5138,102);
    for(let i=0;i<4;i++)this.poly(g,[[4.95+i*.57,.1,106],[5.43+i*.57,.1,106],[5.43+i*.57,.1,128],[4.95+i*.57,.1,128]],[0x9f785c,0x4d716e,0xc6ae7d,0x9b6970][i]);
    const lamp=this.add.graphics().setDepth(1520), p=project(8.65,6.3);
    lamp.fillStyle(0x3d3c31,.2).fillEllipse(p.x,p.y,43,15);
    lamp.fillStyle(0x66533b).fillEllipse(p.x,p.y-2,30,10);
    lamp.lineStyle(4,0x957341).lineBetween(p.x,p.y-5,p.x,p.y-121);
    lamp.fillStyle(0xf2d6a1).fillTriangle(p.x,p.y-147,p.x-28,p.y-112,p.x+28,p.y-112);
    lamp.fillStyle(0xffe3ae).fillEllipse(p.x,p.y-112,56,12);
    for(let n=-20;n<=20;n+=5)lamp.lineStyle(1,0xae915e,.6).lineBetween(p.x+n*.4,p.y-139,p.x+n,p.y-113);
    for(let r=65;r>8;r-=10)lamp.fillStyle(0xffd892,.025).fillCircle(p.x,p.y-114,r);
  }
  private musicConsole() {
    const { x, y, width, depth } = CONSOLE;
    const middle = x + width / 2, front = y + depth;
    const g = this.add.graphics().setDepth((x + width + front) * 100);
    for (const leg of [x+.18, x+width-.34]) {
      this.box(g,leg,y+.1,.16,depth-.2,10,0x715036,0x543f30,0x4d3a2c);
    }
    this.box(g,x+.04,y+.03,width-.08,depth-.06,41,0x9b714b,0x72553e,0x654934,9);
    this.poly(g,[[x+.16,front,13],[x+width-.16,front,13],[x+width-.16,front,45],[x+.16,front,45]],0x392f2b);
    const sleeves = [0xc3aa82,0x8e5447,0x5c8076,0x748298,0xd2be92];
    for (let i=0; i<30; i++) {
      const spine = x+.2+i*(width-.48)/30, h = 24+i%4;
      this.poly(g,[[spine,front,14],[spine+.085,front,14],[spine+.085,front,14+h],[spine,front,14+h]],sleeves[i%sleeves.length]);
      const p=project(spine+.04,front,19);g.fillStyle(0xe6dabd,.65).fillRect(p.x,p.y,1,3);
    }
    for (const divider of [x+width/3,x+2*width/3]) this.box(g,divider,front-.06,.06,.07,33,0xa88259,0x9a734b,0x765638,12);
    this.box(g,x,y,width,depth,5,0xc19767,0x987148,0x7c583d,50);
    this.box(g,middle-.80,y+.06,1.6,.66,6,0x8d6d50,0x594735,0x453b30,55);
    const disc=project(middle,y+depth/2,62);
    g.fillStyle(0x202b2b).fillEllipse(disc.x,disc.y,49,22);
    for(const w of [43,35,27])g.lineStyle(.7,0x7b8070,.65).strokeEllipse(disc.x,disc.y,w,w*.44);
    g.fillStyle(0xc8805d).fillEllipse(disc.x,disc.y,12,6);g.fillStyle(0xe6d9b2).fillRect(disc.x-1,disc.y-1,2,2);
    g.lineStyle(2,0xe1cc9f).lineBetween(disc.x+34,disc.y-12,disc.x+24,disc.y+8).lineBetween(disc.x+24,disc.y+8,disc.x+14,disc.y+6);
    g.fillStyle(0x292e29).fillRect(disc.x+11,disc.y+4,7,4);
    this.poly(g,[[middle-.8,y+.06,61],[middle+.8,y+.06,61],[middle+.8,y+.06,90],[middle-.8,y+.06,90]],0xc8dbce,.20,0xc5cfb4);
    for (const speaker of [x+.22,x+width-.60]) {
      this.box(g,speaker,y+.1,.38,.55,32,0x4e463c,0x403d35,0x292e2a,55);
      const p=project(speaker+.19,y+.66,71);g.fillStyle(0x202623).fillEllipse(p.x,p.y,13,17);g.lineStyle(1,0xb39b70,.7).strokeEllipse(p.x,p.y,13,17);g.fillStyle(0x877553).fillCircle(p.x,p.y,3);
      g.fillStyle(0xc0ac82).fillCircle(p.x,p.y-13,3);
    }
    const sleeve=project(x+width-.93,y+.08,80);g.fillStyle(0xc5b191).fillRect(sleeve.x-10,sleeve.y-17,23,25);g.fillStyle(0x678074).fillCircle(sleeve.x+1,sleeve.y-5,8);
  }
  private drawTelevision() {
    const g=this.televisionGraphic;g.clear();
    const {x,y,z,width,height}=TV_WALL;
    this.poly(g,[[x-TV_SIDE_BEZEL,y,z+5],[x+width+TV_SIDE_BEZEL,y,z+5],[x+width+TV_SIDE_BEZEL,y,z-height-6],[x-TV_SIDE_BEZEL,y,z-height-6]],0x252c29,1,0x141f20);
    this.poly(g,[[x,y,z],[x+width,y,z],[x+width,y,z-height],[x,y,z-height]],this.televisionOn?0x304b4a:0x263b3d);
    const p=project(x+width*.5,y,z-height*.5);
    g.fillStyle(0xe6e6ca,.4).fillTriangle(p.x-5,p.y-9,p.x-5,p.y+8,p.x+9,p.y);
    const led=project(x+width-.15,y,z-height-3);g.fillStyle(this.televisionOn?0xb9d7a0:0xb87c58).fillCircle(led.x,led.y,1.5);
  }
  private animateAmbience(time: number) {
    const g=this.ambient;g.clear();this.windowMotion.clear();
    const t=this.reducedMotion?0:time/1000;
    const { night } = this.light();
    for(const [x,y] of [[.45,3.7],[7.35,.7]]){const p=project(x,y,85);for(let r=64;r>8;r-=8)g.fillStyle(0xffc667,.009+night*.02).fillCircle(p.x,p.y,r);}
    // Slow cloud silhouettes stay clipped to the glass, never crossing the room.
    for(let i=0;i<3;i++) {
      const y=2+((t*.022+i*1.65)%5.1),z=148+i*14;
      this.poly(this.windowMotion,[[0,y,z],[0,y+.3,z+4],[0,y+.7,z+2],[0,y+1.1,z+3],[0,y+.95,z-1],[0,y+.1,z-2]],0xe8d9c1,.4);
    }
    if (night < .65 && !this.reducedMotion) {
      const travel=(t*.055)%7;
      for(let i=0;i<3;i++){const p=project(0,1.3+travel-i*.13,161-i*5),wing=Math.sin(t*3+i)*2;this.windowMotion.lineStyle(1,0x455763,.75).lineBetween(p.x-4,p.y-wing,p.x,p.y+1).lineBetween(p.x,p.y+1,p.x+4,p.y-wing);}
    }
    if(!this.reducedMotion){
      const plane=t%72;
      if(plane<25){const p=project(0,1.2+plane*.29,176),w=this.windowMotion;
        w.lineStyle(1,0x8b7961).lineBetween(p.x+13,p.y,p.x+35,p.y+3);w.fillStyle(0xe8d6af).fillRect(p.x+35,p.y-3,30,13);
        w.fillStyle(0xb87568).fillRect(p.x+45,p.y,3,3).fillRect(p.x+50,p.y,3,3).fillTriangle(p.x+44,p.y+2,p.x+54,p.y+2,p.x+49,p.y+8);
        w.fillStyle(0x59746c).fillRect(p.x-14,p.y-2,28,4).fillTriangle(p.x-2,p.y-10,p.x+4,p.y+8,p.x+8,p.y+8);w.fillStyle(0xe1c797).fillRect(p.x-10,p.y-4,9,3);
      }
      const floating=(t+12)%116;
      if(floating<34){const p=project(0,4.8+Math.sin(t*.08)*.2,75+floating*4.4),w=this.windowMotion;
        w.fillStyle(0xd9b781).fillRect(p.x-6,p.y,13,14);w.fillStyle(0x9b7869).fillTriangle(p.x-9,p.y,p.x,p.y-9,p.x+9,p.y);w.fillStyle(0x739995).fillRect(p.x-3,p.y+4,4,5);
        for(let i=0;i<9;i++){const bx=p.x+(i%3-1)*8,by=p.y-29-Math.floor(i/3)*7;w.lineStyle(.7,0xc4c4a5,.7).lineBetween(p.x,p.y-5,bx,by);w.fillStyle([0xc88879,0xd9bd79,0x83a598,0xa698b3][i%4]).fillEllipse(bx,by,9,12);}
      }
      const birds=(t*.09+2)%8;for(let i=0;i<4;i++){const p=project(0,birds-i*.18,129+i*4),wing=Math.sin(t*4+i)*2;this.windowMotion.lineStyle(1,0x5c6870,.65).lineBetween(p.x-3,p.y-wing,p.x,p.y+1).lineBetween(p.x,p.y+1,p.x+3,p.y-wing);}
    }
    // Steam curls from the two mugs; no busy particle loop.
    for(const [x,y] of [[1.5,3.55],[9.5,1.5]]) {
      const p=project(x,y,73);
      for(let i=0;i<3;i++){const phase=(t*.16+i/3)%1;g.lineStyle(1,0xf3e2c3,(1-phase)*.3).lineBetween(p.x+Math.sin(t+i)*2,p.y-phase*24,p.x+Math.sin(t+i+.8)*3,p.y-phase*24-6);}
    }
    if(!this.reducedMotion)for(let i=0;i<9;i++){const x=260+(i*73)%530+Math.sin(t*.13+i)*12,y=170+(i*47)%250-Math.sin(t*.19+i)*9;g.fillStyle(0xfde4a3,.10+Math.sin(t*.4+i)*.04).fillRect(x,y,1.3,1.3);}
  }
  private petAt(x:number,y:number):PetId|null {
    const pets=this.room?.pets??defaultPets();
    return PET_IDS.find(id=>{const animal=petPosition(id,pets[id],this.serverNow()),p=project(animal.x+.5,animal.y+.5);return Math.abs(p.x-x)<23&&Math.abs(p.y-12-y)<21;})??null;
  }
  private petBeds(){
    for(const id of PET_IDS){const bed=PET_BEDS[id],p=project(bed.x+.5,bed.y+.5),g=this.add.graphics().setDepth((bed.x+bed.y+.4)*100);
      g.fillStyle(0x344437,.15).fillEllipse(p.x,p.y+4,55,24);g.fillStyle(id==='cat'?0x839b8b:0xb88c6c).fillEllipse(p.x,p.y-2,55,28);
      g.lineStyle(4,id==='cat'?0xa4b6a0:0xd2ad86).strokeEllipse(p.x,p.y-4,49,23);g.fillStyle(id==='cat'?0xc6cfb2:0xe1c8a0).fillEllipse(p.x,p.y-4,39,16);
      for(let i=0;i<3;i++)g.fillStyle(0xf0dfba,.6).fillRect(p.x-9+i*8,p.y-6,3,3);
    }
  }
  private drawPets(time:number){
    const pets=this.room?.pets??defaultPets(),now=this.serverNow();
    for(const id of PET_IDS){const animal=petPosition(id,pets[id],now),p=project(animal.x+.5,animal.y+.5),g=this.animals.get(id)!;g.clear();g.setPosition(p.x,p.y).setDepth((animal.x+animal.y+1.4)*100);
      const step=animal.moving&&!this.reducedMotion?Math.floor(time/180)%2:0;
      g.fillStyle(0x283d32,.2).fillEllipse(0,1,31,12);
      const body=id==='cat'?0x9a9fa5:0xb78046,shade=id==='cat'?0x717d87:0x795337,light=id==='cat'?0xc4c9c6:0xd9aa69;
      if(animal.resting){g.fillStyle(shade).fillRoundedRect(-15,-13,29,13,6);g.fillStyle(body).fillRoundedRect(-12,-15,23,12,5);g.fillStyle(light).fillRect(-8,-6,12,3);g.fillStyle(shade).fillRect(-16,-12,6,5);
        g.fillStyle(body).fillRect(1,-20,14,12);
        if(id==='cat'){
          g.fillStyle(shade).fillTriangle(0,-19,2,-26,6,-19).fillTriangle(10,-19,14,-26,16,-18);
          g.fillStyle(0xd7ada0).fillRect(7,-12,2,2);
          g.lineStyle(1,0xd3d4c8).lineBetween(-2,-11,4,-10).lineBetween(12,-10,18,-11);
        }else{
          g.fillStyle(0x694936).fillRect(-1,-20,4,12).fillRect(13,-20,4,12);
          g.fillStyle(light).fillRect(4,-12,9,4);g.fillStyle(0x342f29).fillRect(7,-12,3,2);
        }
        if(animal.sleeping)g.lineStyle(1,0x35483c).lineBetween(3,-15,6,-15).lineBetween(10,-15,13,-15);
        else {g.fillStyle(id==='cat'?0x82b86c:0x342f29).fillRect(3,-16,3,2).fillRect(10,-16,3,2);}
        if(animal.sleeping){g.lineStyle(1.5,0xefe4c3,.8).lineBetween(17,-22,22,-22).lineBetween(22,-22,17,-17).lineBetween(17,-17,22,-17);}
      }else{
        const face=animal.direction;g.fillStyle(body).fillRect(-10,-16,21,12);g.fillStyle(light).fillRect(-7,-7,16,3);
        for(const [x,dy] of [[-8,step*2],[6,-step*2]]){g.fillStyle(shade).fillRect(x,-5+dy,4,6);g.fillStyle(light).fillRect(x-1,dy,6,2);}
        g.fillStyle(shade).fillRect(-face*14,-19,5,12);g.fillStyle(body).fillRect(face*7-7,-23,14,13);
        if(id==='cat'){g.fillStyle(shade).fillTriangle(face*7-8,-22,face*7-6,-30,face*7-1,-23).fillTriangle(face*7+2,-23,face*7+6,-30,face*7+8,-21);g.fillStyle(0xd7ada0).fillRect(face*7-5,-26,2,3).fillRect(face*7+4,-26,2,3);g.fillStyle(0x82b86c).fillRect(face*7-5,-19,4,3).fillRect(face*7+2,-19,4,3);g.fillStyle(0x304537).fillRect(face*7-3,-19,1,3).fillRect(face*7+3,-19,1,3);g.lineStyle(1,0xd3d4c8).lineBetween(face*7-9,-15,face*7-3,-14).lineBetween(face*7+3,-14,face*7+10,-15);
        }else{g.fillStyle(0x694936).fillRect(face*7-9,-24,5,13).fillRect(face*7+5,-24,5,12);g.fillStyle(0xdfb77d).fillRect(face*7-4,-15,9,5);g.fillStyle(0x342f29).fillRect(face*7-4,-20,2,2).fillRect(face*7+3,-20,2,2).fillRect(face*7,-15,3,2);}
      }
      if(animal.affection){const heartY=-38-(this.reducedMotion?0:Math.sin(time/140)*2);g.fillStyle(0xd29185).fillCircle(-3,heartY,4).fillCircle(3,heartY,4).fillTriangle(-7,heartY,7,heartY,0,heartY+8);}
    }
  }
  private drawSky() {
    if (!this.sky) return;
    const light = this.light(), night = light.night;
    this.sky.clear();
    for (let z = 56; z < 203; z += 3) {
      this.poly(this.sky, [[0, 2.05, z], [0, 6.8, z], [0, 6.8, Math.min(203, z + 3)], [0, 2.05, Math.min(203, z + 3)]], mixColor(light.bottom, light.top, (z - 56) / 147));
    }
    for (let n = 0; n < 30; n++) {
      const y = 2.3 + (n * .71 % 4.2); const z = 72 + (n * 31 % 114); const p = project(0, y, z);
      this.sky.fillStyle(0xf9eccb, (.3 + (n % 4) * .15) * night * night).fillRect(p.x, p.y, n % 3 ? 2 : 3, 2);
    }
    const sun = project(0, 5.9, 151), moon = project(0, 3.15, 163);
    this.sky.fillStyle(0xffe8b2, 1 - night).fillCircle(sun.x, sun.y, 12);
    // Crescent polygon fades into the actual gradient without a painted dark disc.
    this.sky.fillStyle(0xf6e8b7, night).fillPoints([
      { x: moon.x + 4, y: moon.y - 12 }, { x: moon.x - 7, y: moon.y - 9 },
      { x: moon.x - 12, y: moon.y }, { x: moon.x - 7, y: moon.y + 10 },
      { x: moon.x + 4, y: moon.y + 12 }, { x: moon.x + 11, y: moon.y + 5 },
      { x: moon.x + 1, y: moon.y + 5 }, { x: moon.x - 3, y: moon.y - 2 },
    ], true);
    this.poly(this.sky, [[0, 2.05, 56], [0, 2.05, 82], [0, 3.1, 105], [0, 4.1, 79], [0, 5.0, 109], [0, 6.8, 80], [0, 6.8, 56]], mixColor(0x87a68a, 0x3b555b, night));
    this.poly(this.sky, [[0, 2.05, 56], [0, 2.05, 68], [0, 3.6, 82], [0, 5.0, 65], [0, 6.8, 90], [0, 6.8, 56]], mixColor(0x5f8b78, 0x2c4648, night));
    // Distant village: individual roofs, chimneys and warm windows.
    for (let n = 0; n < 18; n++) {
      const y = 2.12 + n * .25, roof = 76 + n * 13 % 26;
      this.poly(this.sky, [[0,y,56],[0,y+.19,56],[0,y+.19,roof],[0,y,roof]], n % 2 ? 0x425362 : 0x53666c);
      this.poly(this.sky, [[0,y-.02,roof],[0,y+.1,roof+8],[0,y+.22,roof]], 0x594c56);
      for (let z = 62; z < roof - 2; z += 8) { const p = project(0,y+.07,z); this.sky.fillStyle(mixColor(0xb4c2b1, 0xf5c779, night), .9).fillRect(p.x,p.y,2,3); }
    }
    // Reflections and nearby tree silhouettes stay inside the window.
    for (let n=0;n<22;n++){ const p=project(0,2.15+n*.2,58+(n%3)*2);this.sky.fillStyle(0xf3c384,.5).fillRect(p.x,p.y,5+n%4,1); }
    if (this.roomShade) {
      this.roomShade.clear();
      // One silhouette prevents double-darkening at wall/floor boundaries.
      this.poly(this.roomShade, [[0,10],[0,10,224],[0,0,224],[12,0,224],[12,0],[12,10]], 0x26334f, night * .17);
    }
  }
  private plant(x:number,y:number,scale:number,kind:'fern'|'monstera'|'snake'|'flowers') {
    const g=this.add.graphics().setDepth((x+y+1)*100),p=project(x+.4,y+.4);
    const pot=kind==='snake'?0xd5c6a1:kind==='flowers'?0xa87964:0x987b54;
    g.fillStyle(0x354333,.17).fillEllipse(p.x,p.y+3,34*scale,15*scale);
    g.fillStyle(pot).fillPoints([{x:p.x-16*scale,y:p.y-24*scale},{x:p.x+16*scale,y:p.y-24*scale},{x:p.x+11*scale,y:p.y},{x:p.x-11*scale,y:p.y}],true);
    g.fillStyle(0x514839).fillEllipse(p.x,p.y-24*scale,31*scale,10*scale);
    if(kind==='snake')for(let i=0;i<7;i++){const dx=(i-3)*4*scale,h=(42+(i*17%26))*scale;g.fillStyle(i%2?0x506e42:0x78904f).fillTriangle(p.x+dx-5,p.y-23*scale,p.x+dx+2,p.y-24*scale-h,p.x+dx+5,p.y-23*scale);g.lineStyle(1,0xb9be70).lineBetween(p.x+dx,p.y-25*scale,p.x+dx+2,p.y-20*scale-h);}
    if(kind==='monstera')for(let i=0;i<6;i++){const dx=(i%2?1:-1)*(15+i%3*8)*scale,yy=p.y-(40+i*6)*scale;g.lineStyle(2,0x526549).lineBetween(p.x,p.y-23*scale,p.x+dx,yy);g.fillStyle(i%2?0x5c7f53:0x416b47).fillEllipse(p.x+dx,yy,25*scale,19*scale);for(let j=-1;j<2;j++)g.lineStyle(2,0x9aa66b,.7).lineBetween(p.x+dx+j*5,yy-5,p.x+dx+j*5+4,yy+3);}
    if(kind==='fern')for(let i=0;i<9;i++){const dx=(i-4)*7*scale,tip=p.y-(42+Math.sin(i/8*Math.PI)*27)*scale;g.lineStyle(1,0x537342).lineBetween(p.x,p.y-23*scale,p.x+dx,tip);for(let j=1;j<6;j++){const t=j/6,xx=p.x+dx*t,yy=p.y-23*scale+(tip-p.y+23*scale)*t;g.fillStyle(j%2?0x819c5e:0x557e48).fillEllipse(xx-4,yy,13*scale,4*scale).fillEllipse(xx+4,yy-3,12*scale,4*scale);}}
    if(kind==='flowers')for(let i=0;i<6;i++){const dx=(i-2.5)*6,yy=p.y-28*scale-(i%3)*9;g.lineStyle(1,0x5e7c4e).lineBetween(p.x,p.y-18*scale,p.x+dx,yy);g.fillStyle(i%2?0xe1b1a1:0xe9d5a4).fillCircle(p.x+dx,yy,4);g.fillStyle(0xc6945f).fillCircle(p.x+dx,yy,1.5);}
  }
  private bookshelf(x: number, y: number) {
    const width = 3.65, towerWidth = 1.34, depth = .59, side = .09;
    const towerX = x + width - towerWidth, top = 208;
    const oak = 0xc5a474, edge = 0xa47d53, endGrain = 0x816041;
    const covers = [0x899779, 0xb77555, 0x637d86, 0xd4b889, 0x985f58, 0x70837c];

    // Each bay is painted from its back panel out to its front edge. The tall
    // side at the join supports both bays and passes in front of the desk.
    const bays = [
      { left: x, span: width - towerWidth, bottom: 116, levels: [116, 146, 176], layer: -4 },
      { left: towerX, span: towerWidth, bottom: 0, levels: [0, 29, 58, 87, 116, 146, 176], layer: (x + width + y + depth) * 100 },
    ];
    for (const [bayIndex, bay] of bays.entries()) {
      const g = this.add.graphics().setDepth(bay.layer);
      const right = bay.left + bay.span;
      const innerLeft = bay.left + side;
      const innerRight = bayIndex === 0 ? right : right - side;
      this.box(g, bay.left, y, bay.span, .06, top - bay.bottom, oak, 0x61503c, endGrain, bay.bottom);
      this.box(g, bay.left, y, side, depth, top - bay.bottom, oak, edge, endGrain, bay.bottom);

      for (const [row, base] of bay.levels.entries()) {
        this.box(g, innerLeft, y + .06, innerRight - innerLeft, depth - .09, 4, oak, edge, endGrain, base);
        const shelfTop = base + 4;
        const count = bayIndex === 0 ? 8 : 4;
        let spine = innerLeft + .07;
        for (let book = 0; book < count; book++) {
          const index = book + row * 3 + bayIndex;
          const thickness = .14 + (index % 3) * .025;
          const height = 15 + (index * 5) % 9;
          this.box(g, spine, y + .12, thickness, .32, height, 0xd8c6a2, covers[index % covers.length], 0x695643, shelfTop);
          const a = project(spine + .025, y + .44, shelfTop + height - 4);
          const b = project(spine + thickness - .025, y + .44, shelfTop + height - 4);
          g.lineStyle(1, 0xe4cea0, .85).lineBetween(a.x, a.y, b.x, b.y);
          spine += thickness + .018;
        }
        if ((row + bayIndex) % 2 === 0) {
          const stack = innerRight - .44;
          this.box(g, stack, y + .12, .36, .30, 4, 0x809380, 0xcbbb98, 0x69785d, shelfTop);
          this.box(g, stack + .03, y + .14, .32, .27, 3, 0xb77659, 0xddc8a1, 0x956348, shelfTop + 4);
        }
      }
      if (bayIndex === 1) this.box(g, innerRight, y, side, depth, top - bay.bottom, oak, edge, endGrain, bay.bottom);
      this.box(g, bay.left, y, bay.span, depth, 4, oak, edge, endGrain, top - 4);
    }
  }
  private desk(x: number, y: number, right: boolean) {
    const g=this.add.graphics().setDepth((x+y+2.4)*100);
    const length=right?2.7:2.4, depth=right?1.45:1.55;
    // u runs along the desk, v toward the chair. Rotate every object together.
    const uv=(u:number,v:number,z=0):number[]=>right?[x+u,y+v,z]:[x+v,y+length-u,z];
    const slab=(u:number,v:number,w:number,d:number,h:number,base:number,top:number,front:number,side:number)=>{
      if(right)this.box(g,x+u,y+v,w,d,h,top,front,side,base);
      else this.box(g,x+v,y+length-u-w,d,w,h,top,front,side,base);
    };
    for(const u of [.12,length-.37])slab(u,.12,.25,depth-.22,47,0,0xba915e,0x926943,0x775535);
    slab(.18,.13,length-.36,.15,8,32,0xb48b5d,0x987047,0x795635);
    slab(0,0,length,depth,7,48,0xd0aa75,0xad8054,0x8b6543);
    for(let n=0;n<7;n++){const a=uv(.08,.12+n*.19,55.2),b=uv(length-.08,.12+n*.19,55.2);const pa=project(a[0],a[1],a[2]),pb=project(b[0],b[1],b[2]);g.lineStyle(.7,0x936c43,.22).lineBetween(pa.x,pa.y,pb.x,pb.y);}
    const middle=length*.5;
    // Monitor, stand and keyboard share the desk's isometric axes.
    slab(middle-.22,.48,.44,.32,3,55,0x6c7166,0x4f594f,0x414b43);
    slab(middle-.06,.49,.12,.1,14,58,0x7c8175,0x596257,0x424c43);
    this.poly(g,[uv(middle-.61,.5,71),uv(middle+.61,.5,71),uv(middle+.61,.5,111),uv(middle-.61,.5,111)],0x414b43,1,0x303c35);
    this.poly(g,[uv(middle-.53,.51,77),uv(middle+.53,.51,77),uv(middle+.53,.51,105),uv(middle-.53,.51,105)],0xb5cbc2);
    this.poly(g,[uv(middle-.46,.52,80),uv(middle+.12,.52,80),uv(middle+.12,.52,102),uv(middle-.46,.52,102)],0xeee9d2);
    for(let row=0;row<4;row++)this.poly(g,[uv(middle-.39,.53,84+row*4),uv(middle-.04+(row%2)*.09,.53,84+row*4),uv(middle-.04+(row%2)*.09,.53,85+row*4),uv(middle-.39,.53,85+row*4)],0x7f998a);
    slab(middle-.53,.93,1.06,.3,3,55,0xe5d8bb,0xbeac89,0xa39376);
    for(let row=0;row<3;row++)for(let col=0;col<9;col++)this.poly(g,[uv(middle-.47+col*.105,.96+row*.075,58.2),uv(middle-.4+col*.105,.96+row*.075,58.2),uv(middle-.4+col*.105,1.01+row*.075,58.2),uv(middle-.47+col*.105,1.01+row*.075,58.2)],0x8e947f);
    slab(length-.58,.53,.42,.36,3,55,0x7d977e,0x526f5c,0xd7cbb0);
    const lamp=uv(.22,.25),mug=uv(length-.25,depth-.25);
    this.lamp(g,lamp[0],lamp[1],56);this.mug(g,mug[0],mug[1],58);
    const mouse=uv(middle+.68,1.03,58),mp=project(mouse[0],mouse[1],mouse[2]);g.fillStyle(0xd7ceaf).fillEllipse(mp.x,mp.y,8,10);
  }
  private lamp(g: Phaser.GameObjects.Graphics, x: number, y: number, z: number) {
    const p = project(x, y, z); g.fillStyle(0xffd082, .08).fillCircle(p.x, p.y - 25, 45);
    g.fillStyle(0x73553b).fillEllipse(p.x, p.y, 19, 8); g.fillRect(p.x - 2, p.y - 34, 4, 34);
    g.fillStyle(0xf5cf88).fillTriangle(p.x, p.y - 52, p.x - 16, p.y - 25, p.x + 16, p.y - 25);
    for(let n=-12;n<=12;n+=4)g.lineStyle(1,n%8?0xc69a57:0xffe8ab,.8).lineBetween(p.x+n*.25,p.y-49,p.x+n,p.y-26);
    g.lineStyle(1,0xa9874c).lineBetween(p.x-16,p.y-25,p.x+16,p.y-25);
    g.fillStyle(0xffe9b1).fillEllipse(p.x, p.y - 25, 32, 8);
  }
  private mug(g: Phaser.GameObjects.Graphics, x: number, y: number, z: number) {
    const p = project(x, y, z); g.lineStyle(2, 0xeae0bf).strokeCircle(p.x + 6, p.y - 5, 4);
    g.fillStyle(0xeee5ce).fillRoundedRect(p.x - 5, p.y - 12, 10, 12, 3); g.fillStyle(0x725244).fillEllipse(p.x, p.y - 11, 8, 3);
  }
  private sofa() {
    const offset = project(0, SOFA_OFFSET_Y);
    const frame = this.add.graphics().setPosition(offset.x - OX, offset.y - OY).setDepth(1285 + SOFA_OFFSET_Y * 100);
    const frontArm = this.add.graphics().setPosition(offset.x - OX, offset.y - OY).setDepth(1465 + SOFA_OFFSET_Y * 100);
    const walnut = [0xc79968, 0x95603e, 0x714832] as const;
    const leftEdge = 4.91, rightEdge = 7.98;
    const arm = (layer: Phaser.GameObjects.Graphics, x: number) => {
      // An open timber rail, supported at both ends outside the upholstery.
      for (const y of [6.10, 7.07]) {
        this.box(layer, x + .02, y, .10, .12, 35, ...walnut, 0);
      }
      this.box(layer, x, 6.04, .15, 1.22, 5, ...walnut, 35);
    };

    // Draw the window-side rail before the cushions so it recedes behind them.
    arm(frame, leftEdge);
    this.box(frame, 5.03, 6.12, 2.95, 1.09, 8, ...walnut, 9);
    this.box(frame, 5.08, 6.14, 2.83, 1.05, 6, 0xaf725a, 0x975d48, 0x814c3c, 17);

    for (const x of [5.08, 6.51]) {
      const width = 1.39;
      // A sloping, clipped-corner back pad. The light piping follows its silhouette.
      this.poly(frame, [
        [x,6.24,29], [x,6.05,55], [x+.09,6.00,60],
        [x+width-.10,6.00,60], [x+width,6.05,55], [x+width,6.24,29],
      ], 0xc58063, 1, 0x915b45);
      this.poly(frame, [
        [x+.04,6.24,30], [x+.04,6.08,54], [x+.12,6.05,57],
        [x+width-.12,6.05,57], [x+width-.04,6.08,54], [x+width-.04,6.24,30],
      ], 0xd99a75, 1, 0xe9b38a);
      for (const inset of [.42, .96]) {
        const tuft = project(x+inset, 6.16, 44);
        frame.fillStyle(0xaf765b).fillRect(tuft.x-1,tuft.y-1,3,2);
        frame.fillStyle(0xeac19a).fillRect(tuft.x,tuft.y+1,2,1);
      }

      // The cushion nose has thickness, a bevel and a narrow welt along the seam.
      this.poly(frame, [
        [x,6.30,30], [x+width,6.30,30], [x+width,7.09,30],
        [x+width-.08,7.19,29], [x+.08,7.19,29], [x,7.09,30],
      ], 0xe4ad83, 1, 0xb77f61);
      this.poly(frame, [
        [x,7.09,30], [x+.08,7.19,29], [x+width-.08,7.19,29],
        [x+width,7.09,30], [x+width,7.09,24], [x+width-.08,7.19,22],
        [x+.08,7.19,22], [x,7.09,24],
      ], 0xc18a69, 1, 0x9e6950);
      const start = project(x+.10,7.19,28), end = project(x+width-.10,7.19,28);
      frame.lineStyle(1,0xf4c59d).lineBetween(start.x,start.y,end.x,end.y);
    }
    arm(frontArm, rightEdge);
  }
  sync(state: RoomState, selfId: string, online: string[]) {
    this.room = state; this.selfId = selfId; this.online = online;
    if (!this.active) return;
    if (this.televisionOn !== !!state.television) { this.televisionOn = !!state.television; this.drawTelevision(); }
    const visible = new Set(online.concat(selfId));
    for (const [id, figure] of this.figures) if (!visible.has(id)) { figure.graphic.destroy(); figure.label.destroy(); figure.bubble?.destroy(); this.figures.delete(id); }
    for (const member of Object.values(state.members).filter(m => visible.has(m.id))) {
      let figure = this.figures.get(member.id);
      if (!figure) {
        figure = { member, graphic: this.add.graphics(), label: this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '12px', color: '#fff6dc', backgroundColor: '#425b4d', padding: { x: 9, y: 5 } }).setOrigin(.5, 1), point: { ...member.position }, route: [], direction: 0 };
        const attachment=seatPose(member.seat);
        if(attachment&&member.seat?.startsWith('sofa'))figure.point={x:Math.floor(attachment.x),y:8};
        this.figures.set(member.id, figure);
      }
      if (figure.member.position.x !== member.position.x || figure.member.position.y !== member.position.y || figure.member.seat !== member.seat) {
        const start = { x: Math.round(figure.point.x), y: Math.round(figure.point.y) };
        const seat=seatPose(member.seat);
        const destination=seat&&member.seat?.startsWith('sofa')?{x:Math.floor(seat.x),y:8}:member.position;
        figure.route = pathBetween(start, destination, Object.values(state.members).filter(other => other.id !== member.id && other.seat).map(other => other.position)).slice(1);
        if (!figure.route.length) figure.point = { ...destination };
      }
      figure.member = member; figure.label.setText(member.id === selfId ? `${member.name} · tú` : member.name);
      const message = [...state.messages].reverse().find(m => m.memberId === member.id && Date.now() - m.at < 8000);
      if (message && figure.lastMessage !== message.id) { figure.lastMessage = message.id; this.bubble(figure, message.text); }
    }
  }
  private bubble(figure: Figure, message: string) {
    figure.bubble?.destroy();
    const text = this.add.text(0, 0, message, { fontFamily: 'Arial', fontSize: '14px', color: '#493e33', wordWrap: { width: 220 }, align: 'center', padding: { x: 15, y: 10 }, backgroundColor: '#fff8e7' }).setOrigin(.5, 1);
    figure.bubble = this.add.container(0, 0, [text]).setDepth(10000);
    figure.bubbleStartedAt = this.time.now;
    const bubble = figure.bubble;
    this.tweens.add({ targets: bubble, alpha: 0, delay: 4500, duration: 1500, onComplete: () => { bubble.destroy(); if (figure.bubble === bubble) figure.bubble = undefined; } });
  }
  update(time: number, delta: number) {
    const ambientFrame=this.reducedMotion?Math.floor(Date.now()/60000):Math.floor(time/100);if(this.lastAmbientFrame!==ambientFrame){this.lastAmbientFrame=ambientFrame;this.animateAmbience(time);}
    const petFrame=Math.floor(time/100);if(this.lastPetFrame!==petFrame){this.lastPetFrame=petFrame;this.drawPets(time);}
    const minute = Math.floor(Date.now() / 60000); if (this.skyMinute !== minute) { this.skyMinute = minute; this.drawSky(); }
    for (const figure of this.figures.values()) {
      const moving = figure.route.length > 0;
      if (moving) {
        const goal = figure.route[0]; const dx = goal.x - figure.point.x, dy = goal.y - figure.point.y;
        const distance = Math.hypot(dx, dy), speed = Math.min(delta, 80) / 180;
        figure.direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 0 : 2 : dy > 0 ? 1 : 3;
        if (distance <= speed || this.reducedMotion) { figure.point = { ...goal }; figure.route.shift(); }
        else { figure.point.x += dx / distance * speed; figure.point.y += dy / distance * speed; }
      }
      const pose = !moving ? seatPose(figure.member.seat) : null;
      const seated = !!pose;
      figure.sitBlend=this.reducedMotion?Number(seated):Phaser.Math.Clamp((figure.sitBlend??Number(seated))+(seated?1:-1)*delta/320,0,1);
      if (pose) figure.direction = pose.direction;
      const target = pose ? project(pose.x, pose.y, pose.z) : project(figure.point.x + .5, figure.point.y + .5);
      const weight=this.reducedMotion?1:1-Math.exp(-Math.min(delta,80)/85);
      figure.display??={...target};
      figure.display.x+=(target.x-figure.display.x)*weight;figure.display.y+=(target.y-figure.display.y)*weight;
      const p=figure.display;
      const g = figure.graphic; g.setPosition(p.x, p.y); g.setDepth(pose?.depth ?? (figure.point.x + figure.point.y + 1.5) * 100);
      const step = moving && !this.reducedMotion ? Math.floor(time / 130) % 2 : 0;
      const settle=Math.round(figure.sitBlend*6)/6;
      const seed=Array.from(figure.member.id).reduce((sum,c)=>sum+c.charCodeAt(0),0),clock=this.serverNow();
      const idlePhase=(clock+seed*971)%17000;
      const idle=seated&&!this.reducedMotion&&idlePhase<2300;
      const headShift=idle?(idlePhase<900?-2:idlePhase<1500?1:0):0;
      const typing=idle&&figure.member.seat?.startsWith('desk')?Math.floor(idlePhase/220)%2:0;
      const petting=Object.values(this.room?.pets??defaultPets()).some(p=>p.pettedBy===figure.member.id&&clock-p.pettedAt<2200);
      const stroke=petting&&!this.reducedMotion?Math.floor(clock/180)%2:0;
      const paintKey = JSON.stringify([figure.member.avatar, figure.direction, seated, step, moving,settle,headShift,typing,petting,stroke]);
      if (figure.paintKey !== paintKey) {
        figure.paintKey = paintKey; g.clear();
        if (!seated) {
          g.fillStyle(0x263c31, .22).fillEllipse(0, 1, 35, 14);
          if (figure.member.id === this.selfId) g.lineStyle(1, 0xf9e8b9, .65).strokeEllipse(0, 1, 39, 17);
        }
        avatarPixels(figure.member.avatar, figure.direction, seated, step).forEach(px => g.fillStyle(Phaser.Display.Color.HexStringToColor(px.color).color).fillRect(px.x*2-32+(px.y<23?headShift:petting&&px.y>=25&&px.x>=23?5+stroke*2:0),px.y*2-(96-12*settle)+(moving?step:0)+(petting&&px.y<23?3:0)+(px.y>=30&&px.y<37?typing:0),2,2));
      }
      figure.label.setPosition(p.x, p.y - 104).setDepth(9998);
      const rise = this.reducedMotion ? 0 : Math.min(36, (this.time.now - (figure.bubbleStartedAt ?? this.time.now)) / 6000 * 36);
      figure.bubble?.setPosition(p.x, p.y - 120 - rise);
    }
  }
}
