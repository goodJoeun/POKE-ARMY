import type { Dir } from './drawMonster';

/** React 렌더 사이클 밖에서 매 프레임 갱신되는 월드 상태 */
export const runtime = {
  player: { x: 5.5, y: 6.5, dir: 'down' as Dir, moving: false },
  /** 예약된 순간이동 (스팟 id) — 월드가 다음 프레임에 처리 */
  teleportTo: null as null | { x: number; y: number },
};

export function teleport(x: number, y: number) {
  runtime.player.x = x;
  runtime.player.y = y;
  runtime.teleportTo = { x, y };
}
