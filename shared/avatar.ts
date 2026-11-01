import { DEFAULT_AVATAR, type Avatar } from './model';
export type Pixel = { x: number; y: number; color: string };
const cache = new Map<string, Pixel[]>();
const shade = (hex: string, delta: number) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) + delta)).toString(16).padStart(2, '0')).join('');

// Original 32 × 48 layered artwork. Cached geometry is shared by preview and scene.
export function avatarPixels(input: Avatar, direction = 0, seated = false, step = 0): Pixel[] {
  const a = { ...DEFAULT_AVATAR, ...input, beard: input.beard ?? input.hair }, key = JSON.stringify([a, direction, seated, step]);
  const saved = cache.get(key); if (saved) return saved;
  const pixels = new Map<string, Pixel>();
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let px = x; px < x + w; px++) for (let py = y; py < y + h; py++) pixels.set(`${px},${py}`, { x: px, y: py, color });
  };
  const border = '#352d2c', skinShadow = shade(a.skin, -25), hairShadow = shade(a.hair, -18), beardShadow = shade(a.beard, -18), fabricShadow = shade(a.shirt, -24), fabricLight = shade(a.shirt, 19);
  const back = direction >= 2, shift = direction === 1 || direction === 2 ? -1 : 1;
  if (a.style === 'long') { rect(7, 9, 18, 22, hairShadow); rect(8, 11, 16, 20, a.hair); }
  const length = seated ? 7 : 11;
  rect(10, 32, 6, length + step, shade(a.trousers, -17)); rect(18, 32, 5, length - step, a.trousers); rect(11, 34, 2, length - 2, shade(a.trousers, 12));
  if (a.bottoms === 'jeans') { rect(14, 33, 1, 6, shade(a.trousers, 26)); rect(19, 33, 3, 1, shade(a.trousers, 25)); }
  if (a.bottoms === 'chinos') { rect(12, 34, 1, length - 1, shade(a.trousers, -30)); rect(20, 34, 1, length - 1, shade(a.trousers, -30)); }
  if (a.bottoms === 'shorts') { rect(10, 38, 6, length - 5 + step, skinShadow); rect(18, 38, 5, length - 5 - step, a.skin); }
  if (a.bottoms === 'skirt') { rect(9, 32, 15, 7, a.trousers); rect(8, 37, 17, 3, a.trousers); rect(12, 33, 1, 7, shade(a.trousers, 20)); rect(20, 33, 1, 7, shade(a.trousers, -25)); }
  for (const [x, y] of [[9, 32 + length + step], [18, 32 + length - step]]) { rect(x, y, 7, 3, shade(a.shoes, -22)); rect(x + 1, y, 5, 2, a.shoes); rect(x, y + 3, 7, 1, border); rect(x + 2, y, 2, 1, '#f7e8ce'); }
  if (seated && !back) {
    // Thighs project toward the front-left of the cushion; shins hang to the floor.
    for (const [key,pixel] of pixels) if (pixel.y>=32) pixels.delete(key);
    const pants=shade(a.trousers,-17), lower=a.bottoms==='shorts'||a.bottoms==='skirt';
    rect(9,32,7,7,a.trousers);rect(17,32,7,6,a.trousers);
    rect(7,36,8,4,a.trousers);rect(15,35,8,4,a.trousers);
    rect(8,36,6,1,shade(a.trousers,22));rect(16,35,6,1,shade(a.trousers,22));
    rect(7,39,5,5,lower?skinShadow:pants);rect(16,38,5,5,lower?a.skin:a.trousers);
    if(a.bottoms==='skirt'){rect(9,32,15,5,a.trousers);rect(7,36,16,3,a.trousers);}
    for(const [x,y] of [[4,43],[13,42]]){rect(x,y,8,3,shade(a.shoes,-22));rect(x+1,y,6,2,a.shoes);rect(x,y+3,8,1,border);}
  }
  rect(12, 20, 8, 5, skinShadow); rect(13, 20, 6, 4, a.skin);
  rect(9, 24, 15, 10, fabricShadow); rect(10, 24, 12, 9, a.shirt); rect(6, 25, 4, 10, fabricShadow); rect(23, 25, 4, 10, a.shirt);
  rect(6, 35, 4, 3, skinShadow); rect(24, 35, 3, 3, a.skin); rect(10, 32, 13, 2, fabricShadow);
  if (a.outfit === 'tee') { rect(6, 29, 4, 8, skinShadow); rect(24, 29, 3, 8, a.skin); rect(13, 24, 7, 1, fabricShadow); }
  if (a.outfit === 'knit') {
    for (let x = 11; x < 22; x += 3) for (let y = 26; y < 32; y += 3) { rect(x, y, 1, 2, fabricLight); rect(x + 1, y + 1, 1, 1, fabricShadow); }
    rect(12, 23, 8, 2, fabricLight); rect(6, 33, 4, 2, fabricLight); rect(23, 33, 4, 2, fabricLight);
  }
  if (a.outfit === 'hoodie') { rect(11, 22, 11, 3, fabricShadow); rect(12, 22, 9, 2, fabricLight); if (!back) { rect(13, 25, 1, 4, '#e8dec8'); rect(20, 25, 1, 4, '#e8dec8'); rect(13, 30, 8, 2, fabricShadow); } }
  if (a.outfit === 'cardigan') { rect(14, 24, 5, 9, '#e7dac0'); rect(12, 24, 2, 9, fabricLight); rect(19, 24, 2, 9, fabricShadow); for (let y = 26; y < 33; y += 3) rect(19, y, 1, 1, '#e0bb77'); }
  if (a.outfit === 'shirt') { rect(15, 24, 1, 9, fabricLight); if (!back) { rect(12, 23, 3, 2, '#ebdfca'); rect(17, 23, 3, 2, '#ebdfca'); for (let y = 26; y < 33; y += 3) rect(16, y, 1, 1, border); rect(19, 27, 3, 3, fabricShadow); } }
  if (seated && !back) {
    for (const x of [6, 24]) for (let y = 34; y < 38; y++) for (let dx = 0; dx < 4; dx++) pixels.delete(`${x + dx},${y}`);
    rect(6, 32, 7, 3, a.outfit === 'tee' ? skinShadow : fabricShadow);
    rect(21, 32, 6, 3, a.outfit === 'tee' ? a.skin : a.shirt);
    rect(11, 33, 4, 3, a.skin); rect(19, 33, 4, 3, a.skin);
  }
  // The jaw tapers in skin tones. Facial hair is added separately below.
  rect(8, 6, 16, 13, skinShadow); rect(9, 5, 14, 14, a.skin);
  rect(10, 19, 12, 2, a.skin); rect(12, 21, 8, 1, a.skin);
  rect(7, 12, 2, 5, skinShadow); rect(23, 12, 2, 5, a.skin); rect(9, 9, 1, 8, shade(a.skin, 15));
  if (!back) {
    rect(11 + shift, 12, 2, 2, border); rect(19 + shift, 12, 2, 2, border); rect(16 + shift, 14, 2, 2, skinShadow); rect(15 + shift, 19, 4, 1, '#a46c59');
    if (a.facialHair === 'beard') { rect(10, 17, 2, 4, beardShadow); rect(21, 17, 2, 4, beardShadow); rect(11, 20, 11, 2, beardShadow); rect(13, 21, 7, 2, a.beard); }
    if (a.facialHair === 'goatee') { rect(14, 20, 6, 3, a.beard); rect(15, 22, 4, 1, beardShadow); }
    if (a.facialHair !== 'none') { rect(13 + shift, 17, 3, 1, a.beard); rect(17 + shift, 17, 3, 1, a.beard); rect(12 + shift, 18, 4, 1, beardShadow); rect(17 + shift, 18, 4, 1, beardShadow); }
    if (a.glasses) {
      const frame = '#50443c';
      for (const x of [9 + shift, 18 + shift]) { const inset = a.frames === 'round' ? 1 : 0; rect(x + inset, 10, 7 - inset * 2, 1, frame); rect(x + inset, 15, 7 - inset * 2, 1, frame); rect(x, 11, 1, 4, frame); rect(x + 6, 11, 1, 4, frame); rect(x + 1, 11, 2, 1, '#ecdcc5'); }
      rect(16 + shift, 12, 2, 1, frame); rect(7, 11, 3, 1, frame);
    }
  }
  // Hairline stays above eyebrows; side locks frame the cheeks instead of masking them.
  const hairLight=shade(a.hair,20);
  if(a.style!=='buzz'){rect(9,3,14,6,a.hair);rect(8,5,16,3,a.hair);}
  if(a.style==='buzz'){rect(10,4,12,3,a.hair);rect(9,6,2,3,hairShadow);rect(22,6,2,3,hairShadow);rect(12,4,7,1,hairLight);}
  if(a.style==='short'){
    rect(9,4,14,3,a.hair);rect(11,2,10,3,a.hair);rect(8,6,3,4,hairShadow);rect(22,6,2,5,hairShadow);
    rect(10,6,7,2,a.hair);rect(10,7,4,2,a.hair);rect(12,3,6,1,hairLight);rect(18,4,4,1,hairLight);
  }
  if(a.style==='bob'||a.style==='long'){
    const bottom=a.style==='long'?27:20;
    rect(10,3,12,3,a.hair);rect(8,5,16,2,a.hair);rect(7,7,3,bottom-7,hairShadow);rect(23,7,3,bottom-7,hairShadow);
    rect(8,8,1,bottom-10,hairLight);rect(23,8,1,bottom-9,a.hair);rect(10,6,5,2,a.hair);rect(18,6,5,2,a.hair);rect(12,4,5,1,hairLight);
  }
  if(a.style==='curly'){
    for(const [x,y] of [[8,4],[11,2],[15,1],[19,2],[22,4],[7,7],[23,7]]){rect(x,y,4,3,a.hair);rect(x+1,y,2,1,hairLight);rect(x,y+2,3,1,hairShadow);}
    rect(10,5,12,2,a.hair);rect(8,8,2,2,hairShadow);rect(23,8,2,2,hairShadow);
  }
  if(a.style==='slick'){
    rect(10,1,12,6,a.hair);rect(9,3,15,4,a.hair);rect(10,1,9,1,hairLight);
    for(let row=0;row<3;row++){rect(12+row,2+row*2,8,1,shade(a.hair,10));}
    rect(8,7,2,5,hairShadow);rect(23,6,2,6,hairShadow);rect(8,10,1,2,skinShadow);rect(24,10,1,2,skinShadow);
  }
  if(a.style==='bun'){
    rect(12,0,8,4,hairShadow);rect(13,0,6,3,a.hair);rect(14,0,3,1,hairLight);
    rect(10,4,12,3,a.hair);rect(8,6,3,3,hairShadow);rect(22,6,2,4,hairShadow);rect(12,4,7,1,hairLight);
  }
  if (back) { rect(9, 8, 14, 11, a.hair); rect(10, 9, 3, 8, shade(a.hair, 12)); rect(21, 9, 2, 10, hairShadow); }
  const result = [...pixels.values()]; if (cache.size > 512) cache.clear(); cache.set(key, result); return result;
}
