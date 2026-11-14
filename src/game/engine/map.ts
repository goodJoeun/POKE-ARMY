import type { BranchId, SpotId } from '../types';

export const TILE = 32;
export const MAP_W = 50;
export const MAP_H = 36;

export enum T {
  GRASS, ROAD, SAND, FLOOR, WALL, TREE, FENCE, BED, DESK, TABLE, LOCKER,
  WATER, PIER, RUNWAY, TARGET, COUNTER, PC, GYM, SANDBAG, SHIP, BOOTH, STAGE, DIRT, FLOWER, HANGAR,
}

const SOLID = new Set<T>([
  T.WALL, T.TREE, T.FENCE, T.BED, T.DESK, T.TABLE, T.LOCKER, T.WATER, T.TARGET,
  T.COUNTER, T.PC, T.GYM, T.SANDBAG, T.SHIP, T.BOOTH, T.STAGE, T.HANGAR,
]);

export interface SpotDef {
  id: SpotId;
  x: number;
  y: number;
  label: string;
}

export interface Label {
  text: string;
  x: number;
  y: number;
}

export interface GameMap {
  tiles: T[][];
  spots: Record<SpotId, SpotDef>;
  labels: Label[];
  branch: BranchId;
}

function make(): T[][] {
  return Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => T.GRASS));
}

export function buildMap(branch: BranchId, trainLabel: string): GameMap {
  const m = make();
  const fill = (x0: number, y0: number, x1: number, y1: number, t: T) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m[y] && m[y][x] !== undefined) m[y][x] = t;
  };
  const set = (x: number, y: number, t: T) => { if (m[y] && m[y][x] !== undefined) m[y][x] = t; };
  const room = (x0: number, y0: number, x1: number, y1: number, doors: [number, number][]) => {
    fill(x0, y0, x1, y1, T.WALL);
    fill(x0 + 1, y0 + 1, x1 - 1, y1 - 1, T.FLOOR);
    for (const [dx, dy] of doors) set(dx, dy, T.FLOOR);
  };

  // 펜스 & 외곽 나무
  fill(0, 0, MAP_W - 1, 0, T.FENCE);
  fill(0, MAP_H - 1, MAP_W - 1, MAP_H - 1, T.FENCE);
  fill(0, 0, 0, MAP_H - 1, T.FENCE);
  fill(MAP_W - 1, 0, MAP_W - 1, MAP_H - 1, T.FENCE);

  // 도로
  fill(1, 14, MAP_W - 2, 15, T.ROAD);
  fill(8, 12, 9, MAP_H - 1, T.ROAD);
  fill(30, 1, 31, MAP_H - 2, T.ROAD);
  fill(22, 9, 22, 13, T.ROAD);
  fill(36, 11, 37, 13, T.ROAD);
  fill(45, 9, 45, 13, T.ROAD);
  fill(10, 30, 29, 30, T.ROAD);

  // 생활관
  room(2, 2, 16, 12, [[8, 12], [9, 12]]);
  for (const x of [3, 5, 7, 11, 13, 15]) {
    set(x, 3, T.LOCKER);
    set(x, 4, T.BED); set(x, 5, T.BED);
    set(x, 9, T.BED); set(x, 10, T.BED);
    set(x, 11, T.LOCKER);
  }

  // 행정반
  room(18, 2, 26, 8, [[22, 8]]);
  fill(19, 3, 25, 3, T.LOCKER);
  set(20, 5, T.DESK); set(21, 5, T.DESK);
  set(24, 5, T.DESK); set(25, 5, T.DESK);
  set(22, 4, T.DESK);

  // 식당
  room(33, 2, 41, 10, [[36, 10], [37, 10]]);
  fill(34, 3, 40, 3, T.COUNTER);
  fill(34, 6, 35, 6, T.TABLE); fill(38, 6, 40, 6, T.TABLE);
  fill(34, 8, 35, 8, T.TABLE); fill(38, 8, 40, 8, T.TABLE);

  // PX
  room(43, 2, 48, 8, [[45, 8]]);
  fill(44, 3, 47, 3, T.COUNTER);
  set(47, 5, T.LOCKER); set(47, 6, T.LOCKER);

  // 싸지방
  room(2, 17, 7, 22, [[7, 19], [7, 20]]);
  fill(3, 18, 6, 18, T.PC);

  // 체력단련장 (야외)
  fill(2, 24, 7, 28, T.DIRT);
  set(3, 25, T.GYM); set(6, 25, T.GYM); set(3, 27, T.GYM); set(6, 27, T.GYM);

  // 연병장
  fill(11, 17, 29, 29, T.SAND);
  fill(17, 17, 23, 17, T.STAGE);

  // 위병소
  set(5, 31, T.BOOTH); set(6, 31, T.BOOTH); set(5, 32, T.BOOTH); set(6, 32, T.BOOTH);
  set(8, MAP_H - 1, T.ROAD); set(9, MAP_H - 1, T.ROAD);

  // 나무 / 꽃
  const trees: [number, number][] = [
    [1, 1], [17, 1], [27, 1], [28, 3], [27, 6], [17, 10], [1, 13], [12, 13], [24, 11],
    [11, 32], [14, 33], [18, 32], [22, 33], [26, 32], [29, 33], [12, 34], [20, 34], [3, 34], [1, 30],
    [42, 11], [48, 11], [39, 12], [32, 12], [10, 16], [1, 16],
  ];
  for (const [x, y] of trees) set(x, y, T.TREE);
  const flowers: [number, number][] = [[18, 12], [19, 12], [20, 12], [26, 12], [27, 12], [14, 31], [15, 31], [23, 31], [24, 31], [3, 30], [4, 30]];
  for (const [x, y] of flowers) set(x, y, T.FLOWER);

  // 훈련 구역 (군별)
  let trainSpot: [number, number] = [41, 31];
  if (branch === 'army') {
    fill(33, 17, 48, 34, T.DIRT);
    for (let x = 35; x <= 47; x += 3) set(x, 19, T.TARGET);
    for (let x = 34; x <= 47; x++) if (x % 3 !== 0) set(x, 30, T.SANDBAG);
    trainSpot = [41, 32];
  } else if (branch === 'navy') {
    fill(33, 17, 48, 22, T.ROAD);
    fill(33, 23, 48, 34, T.WATER);
    fill(37, 23, 40, 32, T.PIER);
    fill(42, 25, 47, 31, T.SHIP);
    fill(34, 18, 36, 18, T.SANDBAG);
    trainSpot = [39, 26];
  } else {
    fill(33, 17, 48, 34, T.GRASS);
    fill(33, 21, 48, 28, T.RUNWAY);
    fill(36, 30, 43, 34, T.HANGAR);
    set(39, 30, T.ROAD); set(40, 30, T.ROAD);
    trainSpot = [40, 24];
  }

  const spots: Record<SpotId, SpotDef> = {
    bed: { id: 'bed', x: 5, y: 6, label: '내 침상' },
    barracks: { id: 'barracks', x: 9, y: 7, label: '생활관' },
    mess: { id: 'mess', x: 37, y: 4, label: '식당 배식대' },
    px: { id: 'px', x: 45, y: 4, label: 'PX 계산대' },
    admin: { id: 'admin', x: 22, y: 6, label: '행정반' },
    cyber: { id: 'cyber', x: 4, y: 19, label: '싸지방 PC' },
    gym: { id: 'gym', x: 4, y: 26, label: '체력단련장' },
    parade: { id: 'parade', x: 20, y: 22, label: '연병장' },
    train: { id: 'train', x: trainSpot[0], y: trainSpot[1], label: trainLabel },
    post: { id: 'post', x: 7, y: 32, label: '위병소 초소' },
    gate: { id: 'gate', x: 9, y: 34, label: '위병소 정문' },
  };

  const labels: Label[] = [
    { text: '생활관', x: 9.5, y: 1.6 },
    { text: '행정반', x: 22.5, y: 1.6 },
    { text: '식당', x: 37.5, y: 1.6 },
    { text: 'PX', x: 46, y: 1.6 },
    { text: '싸지방', x: 5, y: 16.6 },
    { text: '체력단련장', x: 5, y: 23.6 },
    { text: '연병장', x: 20.5, y: 28.6 },
    { text: '위병소', x: 6, y: 30.4 },
    { text: trainLabel, x: 41, y: 16.6 },
  ];

  return { tiles: m, spots, labels, branch };
}

export function isSolid(map: GameMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return SOLID.has(map.tiles[ty][tx]);
}

export function collides(map: GameMap, x: number, y: number, r = 0.3): boolean {
  const pts: [number, number][] = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
  return pts.some(([px, py]) => isSolid(map, Math.floor(px), Math.floor(py)));
}

/** BFS 경로 탐색 (타일 좌표). 시작/목표 포함 경로 반환 */
export function findPath(map: GameMap, sx: number, sy: number, gx: number, gy: number): [number, number][] {
  if (isSolid(map, gx, gy)) {
    const near = nearestWalkable(map, gx, gy);
    if (!near) return [];
    [gx, gy] = near;
  }
  if (isSolid(map, sx, sy)) {
    const near = nearestWalkable(map, sx, sy);
    if (!near) return [];
    [sx, sy] = near;
  }
  const key = (x: number, y: number) => y * MAP_W + x;
  const prev = new Map<number, number>();
  const q: number[] = [key(sx, sy)];
  prev.set(key(sx, sy), -1);
  const goal = key(gx, gy);
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) break;
    const cx = cur % MAP_W, cy = Math.floor(cur / MAP_W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (isSolid(map, nx, ny)) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, cur);
      q.push(k);
    }
  }
  if (!prev.has(goal)) return [];
  const path: [number, number][] = [];
  let c = goal;
  while (c !== -1) {
    path.push([c % MAP_W, Math.floor(c / MAP_W)]);
    c = prev.get(c)!;
  }
  return path.reverse();
}

export function nearestWalkable(map: GameMap, x: number, y: number): [number, number] | null {
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!isSolid(map, x + dx, y + dy)) return [x + dx, y + dy];
    }
  }
  return null;
}

// ────────────── 렌더링 ──────────────

function hash(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function renderMapCanvas(map: GameMap, season: 'winter' | 'spring' | 'summer' | 'autumn'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = MAP_W * TILE;
  c.height = MAP_H * TILE;
  const g = c.getContext('2d')!;
  const grass = season === 'winter' ? '#e6eef2' : season === 'autumn' ? '#b8a860' : season === 'spring' ? '#8cc46a' : '#6fae54';
  const grassDot = season === 'winter' ? '#cfdde4' : season === 'autumn' ? '#a08a48' : '#5a9a44';

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = map.tiles[y][x];
      const px = x * TILE, py = y * TILE;
      const r = hash(x, y);
      const base = (col: string) => { g.fillStyle = col; g.fillRect(px, py, TILE, TILE); };
      switch (t) {
        case T.GRASS:
        case T.TREE:
        case T.FLOWER:
          base(grass);
          g.fillStyle = grassDot;
          if (r > 0.5) g.fillRect(px + r * 24, py + (1 - r) * 24, 3, 3);
          if (r > 0.8) g.fillRect(px + 8, py + 20, 2, 4);
          break;
        case T.ROAD: base(season === 'winter' ? '#d8d4cc' : '#c9b38a'); if (r > 0.7) { g.fillStyle = '#b8a078'; g.fillRect(px + r * 26, py + 10, 3, 2); } break;
        case T.SAND: case T.STAGE: base(season === 'winter' ? '#e8e4dc' : '#dcc89c'); if (r > 0.6) { g.fillStyle = '#cbb488'; g.fillRect(px + r * 28, py + r * 20, 2, 2); } break;
        case T.DIRT: case T.TARGET: case T.SANDBAG: case T.GYM: base(season === 'winter' ? '#dcd6cc' : '#b89a72'); if (r > 0.6) { g.fillStyle = '#a0845e'; g.fillRect(px + r * 26, py + r * 26, 3, 2); } break;
        case T.FLOOR: case T.BED: case T.DESK: case T.TABLE: case T.LOCKER: case T.COUNTER: case T.PC:
          base((x + y) % 2 === 0 ? '#e9d9b8' : '#e2d0ac');
          break;
        case T.WALL: base('#7a6a5a'); g.fillStyle = '#9a8a76'; g.fillRect(px, py, TILE, 6); g.fillStyle = '#5e5044'; g.fillRect(px, py + TILE - 3, TILE, 3); break;
        case T.FENCE: base(grass); g.fillStyle = '#6a6a6a'; g.fillRect(px, py + 12, TILE, 4); g.fillRect(px + 4, py + 4, 3, 24); g.fillRect(px + 22, py + 4, 3, 24); break;
        case T.WATER: case T.SHIP: base('#3a7ac0'); g.fillStyle = '#5a9ad8'; g.fillRect(px + ((r * 20 + y * 7) % 24), py + 8 + r * 12, 8, 2); break;
        case T.PIER: base('#a07850'); g.fillStyle = '#7a5838'; for (let i = 0; i < 4; i++) g.fillRect(px, py + i * 8 + 7, TILE, 1); break;
        case T.RUNWAY: base('#5a5e64'); if (y === 24 && x % 3 === 0) { g.fillStyle = '#f2f2f2'; g.fillRect(px + 4, py + 14, 22, 4); } if (y === 21 || y === 28) { g.fillStyle = '#e8d24a'; g.fillRect(px, y === 21 ? py : py + TILE - 3, TILE, 3); } break;
        case T.BOOTH: case T.HANGAR: base('#c9b38a'); break;
      }
      // 오브젝트
      switch (t) {
        case T.TREE: {
          g.fillStyle = '#6a4a2a'; g.fillRect(px + 13, py + 18, 6, 12);
          g.fillStyle = season === 'winter' ? '#d8e6e0' : season === 'autumn' ? '#d0782a' : '#2f7a3a';
          g.beginPath(); g.arc(px + 16, py + 14, 13, 0, Math.PI * 2); g.fill();
          g.fillStyle = season === 'winter' ? '#ffffff' : season === 'autumn' ? '#e8a040' : '#3f9a4a';
          g.beginPath(); g.arc(px + 12, py + 10, 6, 0, Math.PI * 2); g.fill();
          break;
        }
        case T.FLOWER: {
          const cols = ['#f25a7a', '#f2d24a', '#ffffff', '#c47af2'];
          for (let i = 0; i < 3; i++) {
            g.fillStyle = cols[(x + y + i) % cols.length];
            g.beginPath(); g.arc(px + 7 + i * 9, py + 12 + ((i * 7 + x) % 10), 3, 0, Math.PI * 2); g.fill();
          }
          break;
        }
        case T.BED: {
          const top = map.tiles[y - 1]?.[x] !== T.BED;
          g.fillStyle = '#5a7a4a'; g.fillRect(px + 3, py + (top ? 3 : 0), TILE - 6, TILE - (top ? 3 : 3));
          if (top) { g.fillStyle = '#f2f2ea'; g.fillRect(px + 6, py + 5, TILE - 12, 8); }
          g.fillStyle = '#4a6a3a'; g.fillRect(px + 3, py + TILE - 4, TILE - 6, 2);
          break;
        }
        case T.LOCKER: g.fillStyle = '#8a7050'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); g.fillStyle = '#6a5038'; g.fillRect(px + 15, py + 4, 2, TILE - 8); break;
        case T.DESK: case T.TABLE: g.fillStyle = t === T.DESK ? '#8a6a4a' : '#b08a5a'; g.fillRect(px + 1, py + 6, TILE - 2, TILE - 10); g.fillStyle = '#6a4a2a'; g.fillRect(px + 1, py + TILE - 6, TILE - 2, 2); break;
        case T.COUNTER: g.fillStyle = '#a0a8b0'; g.fillRect(px, py + 4, TILE, TILE - 8); g.fillStyle = '#c8d0d8'; g.fillRect(px, py + 4, TILE, 5); break;
        case T.PC: g.fillStyle = '#8a6a4a'; g.fillRect(px + 1, py + 14, TILE - 2, 14); g.fillStyle = '#2a2e38'; g.fillRect(px + 7, py + 3, 18, 13); g.fillStyle = '#5ac0f2'; g.fillRect(px + 9, py + 5, 14, 9); break;
        case T.GYM: g.fillStyle = '#4a4a52'; g.fillRect(px + 4, py + 14, 24, 4); g.fillRect(px + 2, py + 8, 6, 16); g.fillRect(px + 24, py + 8, 6, 16); break;
        case T.TARGET: g.fillStyle = '#6a4a2a'; g.fillRect(px + 15, py + 18, 3, 12); g.fillStyle = '#f2f2ea'; g.beginPath(); g.arc(px + 16, py + 13, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d03a3a'; g.beginPath(); g.arc(px + 16, py + 13, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f2f2ea'; g.beginPath(); g.arc(px + 16, py + 13, 2.5, 0, Math.PI * 2); g.fill(); break;
        case T.SANDBAG: g.fillStyle = '#a89a6a'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.ellipse(px + 8 + j * 16 - (i % 2) * 4, py + 12 + i * 10, 8, 5, 0, 0, Math.PI * 2); g.fill(); } break;
        case T.STAGE: g.fillStyle = '#9a8a76'; g.fillRect(px, py + 4, TILE, TILE - 6); g.fillStyle = '#b8a890'; g.fillRect(px, py + 4, TILE, 4); break;
        case T.BOOTH: { g.fillStyle = '#7a8a6a'; g.fillRect(px, py, TILE, TILE); g.fillStyle = '#a0b090'; g.fillRect(px + 4, py + 4, TILE - 8, 8); break; }
        case T.HANGAR: { g.fillStyle = '#8a929a'; g.fillRect(px, py, TILE, TILE); g.fillStyle = '#a8b0b8'; g.fillRect(px, py + (x % 2) * 16, TILE, 3); break; }
      }
    }
  }
  // 함정 (해군)
  if (map.branch === 'navy') {
    const sx = 42 * TILE, sy = 25 * TILE, sw = 6 * TILE, sh = 7 * TILE;
    g.fillStyle = '#7a8692';
    g.beginPath();
    g.moveTo(sx + sw / 2, sy - 10);
    g.lineTo(sx + sw, sy + 30);
    g.lineTo(sx + sw - 6, sy + sh);
    g.lineTo(sx + 6, sy + sh);
    g.lineTo(sx, sy + 30);
    g.closePath(); g.fill();
    g.fillStyle = '#a0aab4'; g.fillRect(sx + 40, sy + 60, sw - 80, 90);
    g.fillStyle = '#5a6670'; g.fillRect(sx + 60, sy + 80, sw - 120, 40);
    g.fillStyle = '#ffffff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('PKG-999', sx + sw / 2, sy + 190);
  }
  // 위병소 지붕
  g.fillStyle = '#5a6a4a'; g.fillRect(5 * TILE - 4, 31 * TILE - 6, 2 * TILE + 8, 8);
  return c;
}
