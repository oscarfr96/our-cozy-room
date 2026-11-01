import { avatarPixels } from '../../shared/avatar';
import type { Avatar } from '../../shared/model';
export function AvatarPreview({ avatar, size = 72, direction = 0 }: { avatar: Avatar; size?: number; direction?: number }) {
  return <svg role="img" aria-label="Tu personaje" width={size} height={size * 1.5} viewBox="0 0 32 48" shapeRendering="crispEdges">{avatarPixels(avatar, direction).map(p => <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width="1" height="1" fill={p.color} />)}</svg>;
}
