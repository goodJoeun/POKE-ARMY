import type { SpotId } from '../types';
import type { WorldDef } from './map';

/** 집합 장소 "구역" 반경(타일). 실내 장소는 그 방 전체가 구역 */
export const EVENT_AREA_R: Partial<Record<SpotId, number>> = { parade: 7, train: 7, post: 3.5, gate: 3.5, gym: 4 };

/** 플레이어가 집합 장소 구역 안에 있는지 */
export function inEventArea(world: WorldDef, spot: SpotId, p: { map: string; x: number; y: number }): boolean {
  const sp = world.spots[spot];
  if (!sp || sp.map !== p.map) return false;
  if (world.maps[sp.map].indoor) return true;
  return Math.hypot(p.x - (sp.x + 0.5), p.y - (sp.y + 0.5)) <= (EVENT_AREA_R[spot] ?? 4);
}
