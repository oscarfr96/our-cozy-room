// One wall plane shared by the Phaser frame, pointer hit area and DOM video.
// The iframe retains a 360 × 202 viewport; CSS projects it onto this plane.
export const TV_WALL = { x: .55, y: .08, z: 214, width: 3.9, height: 86 };
export const TV_VIEWPORT = { width: 360, height: 202 };
export const TV_SCREEN = {
  x: 470 + (TV_WALL.x - TV_WALL.y) * 42,
  y: 240 + (TV_WALL.x + TV_WALL.y) * 17 - TV_WALL.z,
  width: TV_WALL.width * 42, slope: TV_WALL.width * 17, height: TV_WALL.height,
};
export function insideTelevision(x: number, y: number) {
  const u = (x - TV_SCREEN.x) / TV_SCREEN.width;
  const v = y - TV_SCREEN.y - u * TV_SCREEN.slope;
  return u >= 0 && u <= 1 && v >= 0 && v <= TV_SCREEN.height;
}
