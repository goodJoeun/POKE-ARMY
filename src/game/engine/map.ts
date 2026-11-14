import type { BranchId, Season, SpotId } from '../types';
import type { Dir } from './drawMonster';

export const TILE = 32;

/**
 * 맵 목록
 * - outdoor: 부대 야외
 * - 막사: hq1(1층 복도) → room1(1생활관)·admin(행정반)·command(지휘통제실), 계단 → hq2(2층 복도) → room2(2생활관)·lounge(휴게실)
 * - 별도 건물: mess(식당)·px(PX)·cyber(싸지방)
 */
export type MapId =
  | 'outdoor'
  | 'hq1' | 'hq2' | 'room1' | 'room2' | 'admin' | 'command' | 'lounge'
  | 'mess' | 'px' | 'cyber';

export enum T {
  GRASS, ROAD, SAND, FLOOR, WALL, TREE, FENCE, BED, DESK, TABLE, LOCKER,
  WATER, PIER, RUNWAY, TARGET, COUNTER, PC, GYM, SANDBAG, SHIP, BOOTH, STAGE, DIRT, FLOWER, HANGAR,
  ROOF, DOOR, SHELF, TV, PLANT, BOARD, STAIRS, SOFA,
}

const SOLID = new Set<T>([
  T.WALL, T.TREE, T.FENCE, T.BED, T.DESK, T.TABLE, T.LOCKER, T.WATER, T.TARGET,
  T.COUNTER, T.PC, T.GYM, T.SANDBAG, T.SHIP, T.BOOTH, T.STAGE, T.HANGAR,
  T.ROOF, T.SHELF, T.TV, T.PLANT, T.BOARD, T.SOFA,
]);

export interface SpotDef {
  id: SpotId;
  map: MapId;
  x: number;
  y: number;
  label: string;
}

export interface Label {
  text: string;
  x: number;
  y: number;
}

/** 문(계단 포함): 해당 타일 쪽으로 걸어 들어가면 다른 맵으로 이동 */
export interface Door {
  tiles: [number, number][];
  to: MapId;
  /** 들어갈 때 눌러야 하는 방향 */
  enterDir: Dir;
  /** 도착 위치 (도착 맵 좌표, 타일 단위 실수) */
  arrive: { x: number; y: number; dir: Dir };
  /** 문 위에 띄우는 안내 (예: "2층 ↑") */
  sign?: string;
}

/** 야외 맵에 그려지는 건물 외관 */
export interface Building {
  id: MapId;
  name: string;
  x0: number; y0: number; x1: number; y1: number;
  roof: string;
  door: [number, number][];
}

export interface GameMap {
  id: MapId;
  name: string;
  indoor: boolean;
  w: number;
  h: number;
  tiles: T[][];
  labels: Label[];
  doors: Door[];
  buildings: Building[];
  branch: BranchId;
}

export interface WorldDef {
  maps: Record<MapId, GameMap>;
  spots: Record<SpotId, SpotDef>;
}

export const MAP_NAMES: Record<MapId, string> = {
  outdoor: '부대 야외',
  hq1: '막사 1층', hq2: '막사 2층',
  room1: '1생활관', room2: '2생활관',
  admin: '행정반', command: '지휘통제실', lounge: '휴게실',
  mess: '식당', px: 'PX', cyber: '싸지방',
};

function grid(w: number, h: number, t: T): T[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => t));
}

function painter(m: T[][]) {
  const fill = (x0: number, y0: number, x1: number, y1: number, t: T) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m[y] && m[y][x] !== undefined) m[y][x] = t;
  };
  const set = (x: number, y: number, t: T) => { if (m[y] && m[y][x] !== undefined) m[y][x] = t; };
  return { fill, set };
}

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** 문 바로 안쪽(문을 등지고 선) 위치 */
function inFront(tiles: [number, number][], enterDir: Dir) {
  const cx = tiles.reduce((a, t) => a + t[0], 0) / tiles.length + 0.5;
  const cy = tiles.reduce((a, t) => a + t[1], 0) / tiles.length + 0.5;
  const d = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[enterDir];
  return { x: cx + d[0], y: cy + d[1], dir: OPPOSITE[enterDir] };
}

/** 두 맵의 문을 서로 연결한다 */
function link(a: GameMap, aTiles: [number, number][], aDir: Dir, b: GameMap, bTiles: [number, number][], bDir: Dir, signs: [string?, string?] = []) {
  for (const [x, y] of aTiles) a.tiles[y][x] = a.id === 'outdoor' ? T.DOOR : (a.tiles[y][x] === T.STAIRS ? T.STAIRS : T.DOOR);
  for (const [x, y] of bTiles) b.tiles[y][x] = b.tiles[y][x] === T.STAIRS ? T.STAIRS : T.DOOR;
  a.doors.push({ tiles: aTiles, to: b.id, enterDir: aDir, arrive: inFront(bTiles, bDir), sign: signs[0] });
  b.doors.push({ tiles: bTiles, to: a.id, enterDir: bDir, arrive: inFront(aTiles, aDir), sign: signs[1] });
}

/** 벽으로 둘러싼 실내 맵 */
function room(id: Exclude<MapId, 'outdoor'>, w: number, h: number, branch: BranchId) {
  const m = grid(w, h, T.FLOOR);
  const p = painter(m);
  p.fill(0, 0, w - 1, 0, T.WALL);
  p.fill(0, h - 1, w - 1, h - 1, T.WALL);
  p.fill(0, 0, 0, h - 1, T.WALL);
  p.fill(w - 1, 0, w - 1, h - 1, T.WALL);
  const map: GameMap = { id, name: MAP_NAMES[id], indoor: true, w, h, tiles: m, labels: [], doors: [], buildings: [], branch };
  return { map, p };
}

// ───────────── 건물 외관 (야외 기준 좌표) ─────────────
interface BuildingSpec {
  /** 정문으로 들어가면 도착하는 맵 */
  id: 'hq1' | 'mess' | 'px' | 'cyber';
  sign: string;
  x0: number; y0: number; x1: number; y1: number;
  door: [number, number][];
  roof: string;
}

const BUILDINGS: BuildingSpec[] = [
  { id: 'hq1', sign: '막사', x0: 2, y0: 2, x1: 26, y1: 12, door: [[8, 12], [9, 12]], roof: '#5a7a4a' },
  { id: 'mess', sign: '식당', x0: 33, y0: 2, x1: 41, y1: 10, door: [[36, 10], [37, 10]], roof: '#a0503a' },
  { id: 'px', sign: 'PX', x0: 43, y0: 2, x1: 48, y1: 8, door: [[45, 8]], roof: '#c08a3a' },
  { id: 'cyber', sign: '싸지방', x0: 2, y0: 17, x1: 7, y1: 22, door: [[4, 22], [5, 22]], roof: '#6a6a7a' },
];

// ───────────── 막사 내부 ─────────────
/** 생활관: 침상 6개 x 2열. 출입문이 위쪽(복도가 위) */
function barracksRoom(id: 'room1' | 'room2', branch: BranchId) {
  const { map, p } = room(id, 15, 11, branch);
  for (const x of [1, 3, 5, 9, 11, 13]) {
    p.set(x, 1, T.LOCKER);
    p.set(x, 2, T.BED); p.set(x, 3, T.BED);
    p.set(x, 7, T.BED); p.set(x, 8, T.BED);
    p.set(x, 9, T.LOCKER);
  }
  p.set(7, 9, T.TV);
  p.set(8, 9, T.BOARD);
  return map;
}

/** 복도: 위·아래 벽에 방 문, 오른쪽 끝에 계단 */
function corridor(id: 'hq1' | 'hq2', branch: BranchId) {
  const { map, p } = room(id, 24, 7, branch);
  // 계단 (오른쪽 벽)
  p.set(23, 2, T.STAIRS); p.set(23, 3, T.STAIRS);
  // 복도 소품: 게시판·화분·소화기 대용
  p.set(1, 1, T.PLANT); p.set(1, 5, T.PLANT);
  p.set(16, 1, T.BOARD); p.set(17, 1, T.BOARD);
  return map;
}

function buildBarracks(branch: BranchId) {
  const hq1 = corridor('hq1', branch);
  const hq2 = corridor('hq2', branch);
  const room1 = barracksRoom('room1', branch);
  const room2 = barracksRoom('room2', branch);

  // 행정반 11x8 (출입문 아래쪽)
  const admin = room('admin', 11, 8, branch);
  {
    const p = admin.p;
    p.fill(1, 1, 9, 1, T.LOCKER);
    p.set(4, 3, T.DESK); p.set(5, 3, T.DESK); p.set(6, 3, T.DESK);
    p.set(1, 5, T.DESK); p.set(2, 5, T.DESK);
    p.set(8, 5, T.DESK); p.set(9, 5, T.DESK);
    p.set(9, 6, T.PLANT); p.set(1, 6, T.PLANT);
  }
  // 지휘통제실 11x8: 상황판·모니터·당직 책상
  const command = room('command', 11, 8, branch);
  {
    const p = command.p;
    p.fill(2, 1, 4, 1, T.BOARD);
    p.fill(6, 1, 8, 1, T.PC);
    p.fill(3, 3, 7, 3, T.DESK);
    p.set(1, 5, T.DESK); p.set(9, 5, T.DESK);
  }
  // 휴게실 11x8: TV·소파·자판기
  const lounge = room('lounge', 11, 8, branch);
  {
    const p = lounge.p;
    p.set(5, 1, T.TV);
    p.fill(3, 4, 7, 4, T.SOFA);
    p.set(9, 1, T.SHELF); p.set(9, 2, T.SHELF);
    p.set(1, 1, T.PLANT);
  }

  // 1층 복도: 위쪽 = 행정반·지통실, 아래쪽 = 1생활관·현관, 오른쪽 = 계단
  link(hq1, [[5, 0]], 'up', admin.map, [[5, 7]], 'down', ['행정반', '복도']);
  link(hq1, [[12, 0]], 'up', command.map, [[5, 7]], 'down', ['지휘통제실', '복도']);
  link(hq1, [[6, 6], [7, 6]], 'down', room1, [[6, 0], [7, 0]], 'up', ['1생활관', '복도']);
  link(hq1, [[23, 2], [23, 3]], 'right', hq2, [[23, 2], [23, 3]], 'right', ['2층 ↑', '1층 ↓']);
  // 2층 복도: 위쪽 = 휴게실, 아래쪽 = 2생활관
  link(hq2, [[6, 0]], 'up', lounge.map, [[5, 7]], 'down', ['휴게실', '복도']);
  link(hq2, [[9, 6], [10, 6]], 'down', room2, [[6, 0], [7, 0]], 'up', ['2생활관', '복도']);

  return {
    maps: [hq1, hq2, room1, room2, admin.map, command.map, lounge.map] as GameMap[],
    entrance: { map: hq1, tiles: [[18, 6], [19, 6]] as [number, number][] },
    spots: [
      { id: 'bed', map: 'room1', x: 3, y: 4, label: '내 침상' },
      { id: 'barracks', map: 'room1', x: 7, y: 5, label: '1생활관' },
      { id: 'admin', map: 'admin', x: 5, y: 5, label: '행정반' },
      { id: 'command', map: 'command', x: 5, y: 5, label: '지휘통제실 상황판' },
      { id: 'tv', map: 'lounge', x: 5, y: 3, label: '휴게실 TV' },
    ] as SpotDef[],
  };
}

// ───────────── 별도 건물 내부 ─────────────
function buildFacilities(branch: BranchId) {
  // 식당 13x10
  const mess = room('mess', 13, 10, branch);
  mess.p.fill(1, 1, 11, 1, T.COUNTER);
  mess.p.fill(2, 4, 4, 4, T.TABLE); mess.p.fill(8, 4, 10, 4, T.TABLE);
  mess.p.fill(2, 7, 4, 7, T.TABLE); mess.p.fill(8, 7, 10, 7, T.TABLE);
  // PX 9x7
  const px = room('px', 9, 7, branch);
  px.p.fill(1, 1, 7, 1, T.COUNTER);
  px.p.set(1, 3, T.SHELF); px.p.set(1, 4, T.SHELF); px.p.set(7, 3, T.SHELF); px.p.set(7, 4, T.SHELF);
  // 싸지방 9x7
  const cyber = room('cyber', 9, 7, branch);
  cyber.p.fill(1, 1, 7, 1, T.PC);
  cyber.p.set(1, 4, T.PC); cyber.p.set(7, 4, T.PC);
  cyber.p.set(1, 5, T.PLANT);
  return {
    maps: { mess: mess.map, px: px.map, cyber: cyber.map },
    entrances: {
      mess: [[6, 9]] as [number, number][],
      px: [[4, 6]] as [number, number][],
      cyber: [[4, 6]] as [number, number][],
    },
    spots: [
      { id: 'mess', map: 'mess', x: 6, y: 2, label: '식당 배식대' },
      { id: 'px', map: 'px', x: 4, y: 2, label: 'PX 계산대' },
      { id: 'cyber', map: 'cyber', x: 4, y: 2, label: '싸지방 PC' },
    ] as SpotDef[],
  };
}

// ───────────── 야외 ─────────────
function buildOutdoor(branch: BranchId, trainLabel: string): { map: GameMap; spots: SpotDef[] } {
  const W = 50, H = 36;
  const m = grid(W, H, T.GRASS);
  const { fill, set } = painter(m);

  fill(0, 0, W - 1, 0, T.FENCE);
  fill(0, H - 1, W - 1, H - 1, T.FENCE);
  fill(0, 0, 0, H - 1, T.FENCE);
  fill(W - 1, 0, W - 1, H - 1, T.FENCE);

  // 도로
  fill(1, 14, W - 2, 15, T.ROAD);
  fill(8, 12, 9, H - 1, T.ROAD);
  fill(30, 1, 31, H - 2, T.ROAD);
  fill(36, 11, 37, 13, T.ROAD);
  fill(45, 9, 45, 13, T.ROAD);
  fill(10, 30, 29, 30, T.ROAD);
  fill(4, 23, 7, 23, T.ROAD);

  // 체력단련장 (야외)
  fill(2, 24, 7, 28, T.DIRT);
  set(3, 25, T.GYM); set(6, 25, T.GYM); set(3, 27, T.GYM); set(6, 27, T.GYM);

  // 연병장
  fill(11, 17, 29, 29, T.SAND);
  fill(17, 17, 23, 17, T.STAGE);

  // 위병소
  set(5, 31, T.BOOTH); set(6, 31, T.BOOTH); set(5, 32, T.BOOTH); set(6, 32, T.BOOTH);
  set(8, H - 1, T.ROAD); set(9, H - 1, T.ROAD);

  // 나무 / 꽃
  const trees: [number, number][] = [
    [1, 1], [27, 1], [28, 3], [27, 6], [1, 13], [12, 13], [24, 13],
    [11, 32], [14, 33], [18, 32], [22, 33], [26, 32], [29, 33], [12, 34], [20, 34], [3, 34], [1, 30],
    [42, 11], [48, 11], [39, 12], [32, 12], [10, 16], [1, 16],
  ];
  for (const [x, y] of trees) set(x, y, T.TREE);
  const flowers: [number, number][] = [[18, 13], [19, 13], [20, 13], [26, 13], [27, 13], [14, 31], [15, 31], [23, 31], [24, 31], [3, 30], [4, 30]];
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

  // 건물 외관: 지붕(통과 불가)
  const buildings: Building[] = [];
  for (const b of BUILDINGS) {
    fill(b.x0, b.y0, b.x1, b.y1, T.ROOF);
    buildings.push({ id: b.id, name: b.sign, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, roof: b.roof, door: b.door });
  }

  const labels: Label[] = [
    { text: '체력단련장', x: 5, y: 29.4 },
    { text: '연병장', x: 20.5, y: 28.6 },
    { text: '위병소', x: 6, y: 30.4 },
    { text: trainLabel, x: 41, y: 16.6 },
  ];

  const map: GameMap = { id: 'outdoor', name: MAP_NAMES.outdoor, indoor: false, w: W, h: H, tiles: m, labels, doors: [], buildings, branch };
  const spots: SpotDef[] = [
    { id: 'gym', map: 'outdoor', x: 4, y: 26, label: '체력단련장' },
    { id: 'parade', map: 'outdoor', x: 20, y: 22, label: '연병장' },
    { id: 'train', map: 'outdoor', x: trainSpot[0], y: trainSpot[1], label: trainLabel },
    { id: 'post', map: 'outdoor', x: 7, y: 32, label: '위병소 초소' },
    { id: 'gate', map: 'outdoor', x: 9, y: 34, label: '위병소 정문' },
  ];
  return { map, spots };
}

const worldCache = new Map<string, WorldDef>();

/** 군별 월드(야외 + 막사 + 시설)를 만든다. 결과는 캐시된다. */
export function getWorld(branch: BranchId, trainLabel: string): WorldDef {
  const key = `${branch}:${trainLabel}`;
  const cached = worldCache.get(key);
  if (cached) return cached;
  const outdoor = buildOutdoor(branch, trainLabel);
  const hq = buildBarracks(branch);
  const fac = buildFacilities(branch);

  const maps = { outdoor: outdoor.map } as Record<MapId, GameMap>;
  for (const m of hq.maps) maps[m.id] = m;
  for (const m of Object.values(fac.maps)) maps[m.id] = m;

  // 야외 정문 ↔ 건물 입구
  const hqSpec = BUILDINGS.find((b) => b.id === 'hq1')!;
  link(outdoor.map, hqSpec.door, 'up', hq.entrance.map, hq.entrance.tiles, 'down', [undefined, '밖으로']);
  for (const id of ['mess', 'px', 'cyber'] as const) {
    const spec = BUILDINGS.find((b) => b.id === id)!;
    link(outdoor.map, spec.door, 'up', fac.maps[id], fac.entrances[id], 'down');
  }

  const spots = {} as Record<SpotId, SpotDef>;
  for (const s of [...outdoor.spots, ...hq.spots, ...fac.spots]) spots[s.id] = s;
  const world = { maps, spots };
  worldCache.set(key, world);
  return world;
}

/** from 맵에서 to 맵으로 가려면 먼저 통과해야 할 문 (맵 그래프 BFS) */
export function doorToward(world: WorldDef, from: MapId, to: MapId): Door | null {
  if (from === to) return null;
  const firstDoor = new Map<MapId, Door>();
  const q: MapId[] = [from];
  const seen = new Set<MapId>([from]);
  while (q.length) {
    const cur = q.shift()!;
    for (const d of world.maps[cur].doors) {
      if (seen.has(d.to)) continue;
      seen.add(d.to);
      firstDoor.set(d.to, cur === from ? d : firstDoor.get(cur)!);
      if (d.to === to) return firstDoor.get(to)!;
      q.push(d.to);
    }
  }
  return null;
}

export function doorCenter(d: Door): { x: number; y: number } {
  const x = d.tiles.reduce((a, t) => a + t[0], 0) / d.tiles.length + 0.5;
  const y = d.tiles[0][1] + 0.5;
  return { x, y };
}

export function isSolid(map: GameMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
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
  const W = map.w;
  const key = (x: number, y: number) => y * W + x;
  const prev = new Map<number, number>();
  const q: number[] = [key(sx, sy)];
  prev.set(key(sx, sy), -1);
  const goal = key(gx, gy);
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) break;
    const cx = cur % W, cy = Math.floor(cur / W);
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
    path.push([c % W, Math.floor(c / W)]);
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

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `#${((c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
}

const FLOOR_COLORS: Record<MapId, [string, string]> = {
  outdoor: ['#e9d9b8', '#e2d0ac'],
  hq1: ['#b8c0a8', '#b0b8a0'],
  hq2: ['#b8c0a8', '#b0b8a0'],
  room1: ['#d8c49a', '#cfba8e'],
  room2: ['#d8c49a', '#cfba8e'],
  admin: ['#c8ccd2', '#bec3ca'],
  command: ['#a8b0b8', '#a0a8b0'],
  lounge: ['#e0c8a0', '#d8c098'],
  mess: ['#e6e2d6', '#dcd8cb'],
  px: ['#e8dcc8', '#dfd2bc'],
  cyber: ['#b8c4d0', '#aebac7'],
};

export function renderMapCanvas(map: GameMap, season: Season): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = map.w * TILE;
  c.height = map.h * TILE;
  const g = c.getContext('2d')!;
  const grass = season === 'winter' ? '#e6eef2' : season === 'autumn' ? '#b8a860' : season === 'spring' ? '#8cc46a' : '#6fae54';
  const grassDot = season === 'winter' ? '#cfdde4' : season === 'autumn' ? '#a08a48' : '#5a9a44';
  const [fa, fb] = FLOOR_COLORS[map.id];

  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
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
        case T.SHELF: case T.TV: case T.PLANT: case T.BOARD: case T.SOFA:
          base((x + y) % 2 === 0 ? fa : fb);
          break;
        case T.STAIRS:
          base('#6a6a72');
          for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#8a8a94' : '#a0a0aa'; g.fillRect(px + i * 8, py, 8, TILE); }
          g.fillStyle = '#4a4a52'; g.fillRect(px, py, TILE, 2);
          break;
        case T.WALL: base('#7a6a5a'); g.fillStyle = '#9a8a76'; g.fillRect(px, py, TILE, 6); g.fillStyle = '#5e5044'; g.fillRect(px, py + TILE - 3, TILE, 3); break;
        case T.FENCE: base(grass); g.fillStyle = '#6a6a6a'; g.fillRect(px, py + 12, TILE, 4); g.fillRect(px + 4, py + 4, 3, 24); g.fillRect(px + 22, py + 4, 3, 24); break;
        case T.WATER: case T.SHIP: base('#3a7ac0'); g.fillStyle = '#5a9ad8'; g.fillRect(px + ((r * 20 + y * 7) % 24), py + 8 + r * 12, 8, 2); break;
        case T.PIER: base('#a07850'); g.fillStyle = '#7a5838'; for (let i = 0; i < 4; i++) g.fillRect(px, py + i * 8 + 7, TILE, 1); break;
        case T.RUNWAY: base('#5a5e64'); if (y === 24 && x % 3 === 0) { g.fillStyle = '#f2f2f2'; g.fillRect(px + 4, py + 14, 22, 4); } if (y === 21 || y === 28) { g.fillStyle = '#e8d24a'; g.fillRect(px, y === 21 ? py : py + TILE - 3, TILE, 3); } break;
        case T.BOOTH: case T.HANGAR: base('#c9b38a'); break;
        case T.DOOR:
          if (map.indoor) {
            base('#3a3026');
            g.fillStyle = '#8a6a4a'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 6);
            g.fillStyle = '#c8a878'; g.fillRect(px + 4, py + TILE - 8, TILE - 8, 4);
          }
          break;
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
          g.fillStyle = '#5a7a4a'; g.fillRect(px + 3, py + (top ? 3 : 0), TILE - 6, TILE - 3);
          if (top) { g.fillStyle = '#f2f2ea'; g.fillRect(px + 6, py + 5, TILE - 12, 8); }
          g.fillStyle = '#4a6a3a'; g.fillRect(px + 3, py + TILE - 4, TILE - 6, 2);
          break;
        }
        case T.LOCKER: g.fillStyle = '#8a7050'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); g.fillStyle = '#6a5038'; g.fillRect(px + 15, py + 4, 2, TILE - 8); break;
        case T.DESK: case T.TABLE: g.fillStyle = t === T.DESK ? '#8a6a4a' : '#b08a5a'; g.fillRect(px + 1, py + 6, TILE - 2, TILE - 10); g.fillStyle = '#6a4a2a'; g.fillRect(px + 1, py + TILE - 6, TILE - 2, 2); break;
        case T.COUNTER: g.fillStyle = '#a0a8b0'; g.fillRect(px, py + 4, TILE, TILE - 8); g.fillStyle = '#c8d0d8'; g.fillRect(px, py + 4, TILE, 5); break;
        case T.PC: g.fillStyle = '#8a6a4a'; g.fillRect(px + 1, py + 14, TILE - 2, 14); g.fillStyle = '#2a2e38'; g.fillRect(px + 7, py + 3, 18, 13); g.fillStyle = '#5ac0f2'; g.fillRect(px + 9, py + 5, 14, 9); break;
        case T.SHELF: {
          g.fillStyle = '#7a5a3a'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          const cols = ['#e04a4a', '#f2c230', '#4a90d8', '#5ab04a', '#f28a3a'];
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.fillStyle = cols[(i * 3 + j + x) % cols.length]; g.fillRect(px + 5 + j * 8, py + 5 + i * 8, 6, 6); }
          break;
        }
        case T.TV: g.fillStyle = '#2a2a30'; g.fillRect(px + 2, py + 4, TILE - 4, TILE - 12); g.fillStyle = '#6ab0e0'; g.fillRect(px + 5, py + 7, TILE - 10, TILE - 18); break;
        case T.BOARD: g.fillStyle = '#5a7a5a'; g.fillRect(px + 2, py + 4, TILE - 4, TILE - 10); g.fillStyle = '#f2f2ea'; g.fillRect(px + 6, py + 8, 8, 6); g.fillRect(px + 17, py + 10, 8, 6); break;
        case T.SOFA:
          g.fillStyle = '#7a4a5a'; g.fillRect(px + 1, py + 6, TILE - 2, TILE - 10);
          g.fillStyle = '#9a6a7a'; g.fillRect(px + 1, py + 6, TILE - 2, 8);
          break;
        case T.PLANT: g.fillStyle = '#8a5a3a'; g.fillRect(px + 10, py + 18, 12, 11); g.fillStyle = '#3f9a4a'; g.beginPath(); g.arc(px + 16, py + 13, 10, 0, Math.PI * 2); g.fill(); break;
        case T.GYM: g.fillStyle = '#4a4a52'; g.fillRect(px + 4, py + 14, 24, 4); g.fillRect(px + 2, py + 8, 6, 16); g.fillRect(px + 24, py + 8, 6, 16); break;
        case T.TARGET: g.fillStyle = '#6a4a2a'; g.fillRect(px + 15, py + 18, 3, 12); g.fillStyle = '#f2f2ea'; g.beginPath(); g.arc(px + 16, py + 13, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d03a3a'; g.beginPath(); g.arc(px + 16, py + 13, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f2f2ea'; g.beginPath(); g.arc(px + 16, py + 13, 2.5, 0, Math.PI * 2); g.fill(); break;
        case T.SANDBAG: g.fillStyle = '#a89a6a'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.ellipse(px + 8 + j * 16 - (i % 2) * 4, py + 12 + i * 10, 8, 5, 0, 0, Math.PI * 2); g.fill(); } break;
        case T.STAGE: g.fillStyle = '#9a8a76'; g.fillRect(px, py + 4, TILE, TILE - 6); g.fillStyle = '#b8a890'; g.fillRect(px, py + 4, TILE, 4); break;
        case T.BOOTH: { g.fillStyle = '#7a8a6a'; g.fillRect(px, py, TILE, TILE); g.fillStyle = '#a0b090'; g.fillRect(px + 4, py + 4, TILE - 8, 8); break; }
        case T.HANGAR: { g.fillStyle = '#8a929a'; g.fillRect(px, py, TILE, TILE); g.fillStyle = '#a8b0b8'; g.fillRect(px, py + (x % 2) * 16, TILE, 3); break; }
      }
    }
  }

  // 건물 외관 (지붕 + 정면 벽 + 문)
  for (const b of map.buildings) {
    const x0 = b.x0 * TILE, y0 = b.y0 * TILE, wpx = (b.x1 - b.x0 + 1) * TILE;
    const facadeTop = (b.y1 - 1) * TILE;
    const bottom = (b.y1 + 1) * TILE;
    // 그림자
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0 + 6, y0 + 8, wpx, bottom - y0);
    // 정면 벽
    g.fillStyle = '#e8dcc0'; g.fillRect(x0, facadeTop, wpx, bottom - facadeTop);
    g.fillStyle = '#c8b898'; g.fillRect(x0, bottom - 4, wpx, 4);
    for (let x = b.x0; x <= b.x1; x++) {
      if (b.door.some(([dx]) => dx === x) || x === b.x0 || x === b.x1) continue;
      if ((x - b.x0) % 2 === 1) {
        g.fillStyle = '#5a7a9a'; g.fillRect(x * TILE + 6, facadeTop + 10, TILE - 12, 18);
        g.fillStyle = '#a8c8e8'; g.fillRect(x * TILE + 8, facadeTop + 12, TILE - 16, 6);
      }
    }
    // 문
    const dx0 = Math.min(...b.door.map((d) => d[0])) * TILE;
    const dx1 = (Math.max(...b.door.map((d) => d[0])) + 1) * TILE;
    g.fillStyle = '#5a3e2a'; g.fillRect(dx0 + 3, facadeTop + 14, dx1 - dx0 - 6, bottom - facadeTop - 14);
    g.fillStyle = '#8a6040'; g.fillRect(dx0 + 6, facadeTop + 18, dx1 - dx0 - 12, bottom - facadeTop - 20);
    g.fillStyle = '#f2c230'; g.fillRect(dx1 - 12, facadeTop + 38, 3, 4);
    // 지붕
    const roofBottom = facadeTop + 4;
    g.fillStyle = b.roof; g.fillRect(x0 - 4, y0, wpx + 8, roofBottom - y0);
    g.fillStyle = shade(b.roof, -25);
    for (let y = y0 + 10; y < roofBottom - 4; y += 12) g.fillRect(x0 - 4, y, wpx + 8, 2);
    g.fillStyle = shade(b.roof, -45); g.fillRect(x0 - 4, roofBottom - 6, wpx + 8, 6);
    if (season === 'winter') {
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x0 - 4, y0, wpx + 8, Math.min(26, (roofBottom - y0) * 0.4));
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (let x = x0; x < x0 + wpx; x += 18) g.fillRect(x, y0 + 24, 10, 6);
    }
    // 간판
    g.font = 'bold 15px "Galmuri11", sans-serif';
    g.textAlign = 'center';
    const tw = g.measureText(b.name).width + 18;
    const cx = x0 + wpx / 2, cy = (y0 + roofBottom) / 2;
    g.fillStyle = 'rgba(40,30,20,0.8)'; g.fillRect(cx - tw / 2, cy - 12, tw, 24);
    g.fillStyle = '#fff6dc'; g.fillText(b.name, cx, cy + 5);
  }

  // 실내 문 위 안내판 ("행정반", "2층 ↑" 등)
  if (map.indoor) {
    g.font = 'bold 11px "Galmuri11", sans-serif';
    g.textAlign = 'center';
    for (const d of map.doors) {
      if (!d.sign) continue;
      const cx = (d.tiles.reduce((a, t) => a + t[0], 0) / d.tiles.length + 0.5) * TILE;
      const ty = d.tiles[0][1];
      let cy = ty === 0 ? TILE * 1.35 : ty === map.h - 1 ? (map.h - 1) * TILE - 6 : (ty + 0.5) * TILE;
      let lx = cx;
      if (d.enterDir === 'right') { lx = (d.tiles[0][0] - 0.6) * TILE; cy = (d.tiles[0][1] - 0.2) * TILE; }
      const tw = g.measureText(d.sign).width + 10;
      g.fillStyle = 'rgba(40,48,72,0.85)';
      g.fillRect(lx - tw / 2, cy - 9, tw, 14);
      g.fillStyle = '#ffffff';
      g.fillText(d.sign, lx, cy + 2);
    }
  }

  // 함정 (해군)
  if (map.id === 'outdoor' && map.branch === 'navy') {
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
  if (map.id === 'outdoor') {
    // 위병소 지붕
    g.fillStyle = '#5a6a4a'; g.fillRect(5 * TILE - 4, 31 * TILE - 6, 2 * TILE + 8, 8);
  }
  return c;
}
