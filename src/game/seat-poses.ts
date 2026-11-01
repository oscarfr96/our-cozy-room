import type { SEATS } from '../../shared/model';

// Depth offset shared by the artwork, shadow, seat hit areas and seated avatars.
export const SOFA_OFFSET_Y = -0.35;

// Visual attachment points are separate from the existing approach tiles.
// Layout revision 2 migrates the saved approach tiles without changing seat IDs.
export const SEAT_POSES: Record<(typeof SEATS)[number]['id'], { x: number; y: number; z: number; direction: number; depth: number }> = {
  'desk-left': { x: 2.5, y: 4.5, z: 10, direction: 2, depth: 750 },
  'desk-right': { x: 8.5, y: 2.5, z: 10, direction: 3, depth: 1150 },
  sofa: { x: 5.78, y: 6.83 + SOFA_OFFSET_Y, z: 7, direction: 1, depth: 1305 + SOFA_OFFSET_Y * 100 },
  'sofa-right': { x: 7.20, y: 6.83 + SOFA_OFFSET_Y, z: 7, direction: 1, depth: 1435 + SOFA_OFFSET_Y * 100 },
};

export function seatPose(id: string | null) {
  return id && Object.hasOwn(SEAT_POSES, id) ? SEAT_POSES[id as keyof typeof SEAT_POSES] : null;
}
