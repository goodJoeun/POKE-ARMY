import type { Dir } from './drawMonster';
import type { MapId } from './map';

/** React 렌더 사이클 밖에서 매 프레임 갱신되는 월드 상태 */
export const runtime = {
  player: { map: 'room1' as MapId, x: 3.5, y: 4.5, dir: 'down' as Dir, moving: false },
  /** 주요 NPC가 지금 있는 맵과 향하는 맵 (퀘스트 창·지도에서 예상 위치 표시) */
  npcLoc: {} as Record<string, { map: MapId; dest: MapId }>,
};

export function teleport(map: MapId, x: number, y: number, dir?: Dir) {
  runtime.player.map = map;
  runtime.player.x = x;
  runtime.player.y = y;
  if (dir) runtime.player.dir = dir;
}
