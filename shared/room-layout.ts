export type Point = { x: number; y: number };
// Shared with the renderer: furniture footprints are the source of collision data.
export const BLOCKS = [
  { x: 0, y: 0, w: 5, h: 2 }, { x: 0, y: 3, w: 2, h: 3 },
  { x: 7, y: 0, w: 3, h: 2 }, { x: 10, y: 0, w: 2, h: 2 },
  { x: 0, y: 8, w: 1, h: 2 }, { x: 5, y: 6, w: 3, h: 2 }, { x: 8, y: 6, w: 1, h: 1 },
  { x: 10, y: 7, w: 2, h: 2 },
];
export function walkable(p: Point): boolean {
  return p.x >= 0 && p.x < 12 && p.y >= 0 && p.y < 10 && Number.isInteger(p.x) && Number.isInteger(p.y)
    && !BLOCKS.some(b => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h);
}
export function pathBetween(start: Point, end: Point, occupied: Point[] = []): Point[] {
  if (!walkable(end) || occupied.some(p => p.x === end.x && p.y === end.y)) return [];
  const key = (p: Point) => `${p.x},${p.y}`;
  const queue = [start]; const previous = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (key(current) === key(end)) {
      const result: Point[] = []; let p: Point | null = current;
      while (p) { result.unshift(p); p = previous.get(key(p)) ?? null; }
      return result;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!previous.has(key(next)) && walkable(next) && !occupied.some(p => key(p) === key(next))) {
        previous.set(key(next), current); queue.push(next);
      }
    }
  }
  return [];
}
