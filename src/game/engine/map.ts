import type { BranchId, Season, SpotId } from '../types';
import type { Dir } from './drawMonster';
import { FACILITY_NAME, STORE_NAME } from '../data/branches';

export const TILE = 32;

/**
 * 맵 목록 (서로 문·길로 연결된 별도 장소)
 * - 야외 구역: outdoor(막사·연병장·농구장, 중심) ↔ messyard(병영식당 앞) ↔ recycle(분리수거장)
 *              outdoor ↔ pxyard(PX/BX 앞), outdoor ↔ depot(탄약고/격납고/부두 + 위병소)
 * - 막사 1층 hq1: 행정반·지휘통제실·정비실·화장실 / 1생활관·세탁실·현관, 계단
 * - 막사 2층 hq2: 휴게실·체단실·도서관·화장실 / 2생활관·싸지방·세탁실, 계단
 * - 병영식당 mess ↔ 조리실 kitchen, PX px
 */
export type MapId =
  | 'outdoor' | 'messyard' | 'recycle' | 'pxyard' | 'depot'
  | 'hq1' | 'hq2' | 'room1' | 'room2' | 'admin' | 'command' | 'lounge'
  | 'maint' | 'wc1' | 'wc2' | 'laundry1' | 'laundry2' | 'gymroom' | 'library' | 'cyber'
  | 'mess' | 'kitchen' | 'px';

export enum T {
  GRASS, ROAD, SAND, FLOOR, WALL, TREE, FENCE, BED, DESK, TABLE, LOCKER,
  WATER, PIER, RUNWAY, TARGET, COUNTER, PC, GYM, SANDBAG, SHIP, BOOTH, STAGE, DIRT, FLOWER, HANGAR,
  ROOF, DOOR, SHELF, TV, PLANT, BOARD, STAIRS, SOFA,
  COOLER, WASHER, TOILET, SINK, STOVE, COURT, HOOP, BIN, AMMO,
}

const SOLID = new Set<T>([
  T.WALL, T.TREE, T.FENCE, T.BED, T.DESK, T.TABLE, T.LOCKER, T.WATER, T.TARGET,
  T.COUNTER, T.PC, T.GYM, T.SANDBAG, T.SHIP, T.BOOTH, T.STAGE, T.HANGAR,
  T.ROOF, T.SHELF, T.TV, T.PLANT, T.BOARD, T.SOFA,
  T.COOLER, T.WASHER, T.TOILET, T.SINK, T.STOVE, T.HOOP, T.BIN, T.AMMO,
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

/** 문(계단·길 끝 포함): 해당 타일 쪽으로 걸어 들어가면 다른 맵으로 이동 */
export interface Door {
  tiles: [number, number][];
  to: MapId;
  /** 들어갈 때 눌러야 하는 방향 */
  enterDir: Dir;
  /** 도착 위치 (도착 맵 좌표, 타일 단위 실수) */
  arrive: { x: number; y: number; dir: Dir };
  /** 문 위에 띄우는 안내 (예: "2층 ↑", "병영식당 →") */
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

/** 기본 이름 (군별로 다른 이름은 getWorld에서 덮어쓴다 — 화면 표시는 world.maps[id].name 사용) */
export const MAP_NAMES: Record<MapId, string> = {
  outdoor: '막사·연병장', messyard: '병영식당 앞', recycle: '분리수거장', pxyard: 'PX 앞', depot: '탄약고·위병소',
  hq1: '막사 1층', hq2: '막사 2층',
  room1: '1생활관', room2: '2생활관',
  admin: '행정반', command: '지휘통제실', lounge: '휴게실',
  maint: '정비실', wc1: '1층 화장실', wc2: '2층 화장실', laundry1: '1층 세탁실', laundry2: '2층 세탁실',
  gymroom: '체단실', library: '도서관', cyber: '싸지방',
  mess: '병영식당', kitchen: '조리실', px: 'PX',
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

/** 두 맵의 문을 서로 연결한다 (야외 건물 문 · 실내 문 · 계단) */
function link(a: GameMap, aTiles: [number, number][], aDir: Dir, b: GameMap, bTiles: [number, number][], bDir: Dir, signs: [string?, string?] = []) {
  for (const [x, y] of aTiles) a.tiles[y][x] = !a.indoor ? T.DOOR : (a.tiles[y][x] === T.STAIRS ? T.STAIRS : T.DOOR);
  for (const [x, y] of bTiles) b.tiles[y][x] = b.tiles[y][x] === T.STAIRS ? T.STAIRS : T.DOOR;
  a.doors.push({ tiles: aTiles, to: b.id, enterDir: aDir, arrive: inFront(bTiles, bDir), sign: signs[0] });
  b.doors.push({ tiles: bTiles, to: a.id, enterDir: bDir, arrive: inFront(aTiles, aDir), sign: signs[1] });
}

/** 야외 구역끼리 길 끝으로 연결한다 (길 타일 그대로, 끝까지 걸어가면 다음 구역) */
function edgeLink(a: GameMap, aTiles: [number, number][], aDir: Dir, b: GameMap, bTiles: [number, number][], bDir: Dir, signs: [string, string]) {
  for (const [x, y] of aTiles) a.tiles[y][x] = T.ROAD;
  for (const [x, y] of bTiles) b.tiles[y][x] = T.ROAD;
  a.doors.push({ tiles: aTiles, to: b.id, enterDir: aDir, arrive: inFront(bTiles, bDir), sign: signs[0] });
  b.doors.push({ tiles: bTiles, to: a.id, enterDir: bDir, arrive: inFront(aTiles, aDir), sign: signs[1] });
}

/** 벽으로 둘러싼 실내 맵 */
function room(id: MapId, w: number, h: number, branch: BranchId) {
  const m = grid(w, h, T.FLOOR);
  const p = painter(m);
  p.fill(0, 0, w - 1, 0, T.WALL);
  p.fill(0, h - 1, w - 1, h - 1, T.WALL);
  p.fill(0, 0, 0, h - 1, T.WALL);
  p.fill(w - 1, 0, w - 1, h - 1, T.WALL);
  const map: GameMap = { id, name: MAP_NAMES[id], indoor: true, w, h, tiles: m, labels: [], doors: [], buildings: [], branch };
  return { map, p };
}

/** 울타리로 둘러싼 야외 구역 */
function yard(id: MapId, w: number, h: number, branch: BranchId) {
  const m = grid(w, h, T.GRASS);
  const p = painter(m);
  p.fill(0, 0, w - 1, 0, T.FENCE);
  p.fill(0, h - 1, w - 1, h - 1, T.FENCE);
  p.fill(0, 0, 0, h - 1, T.FENCE);
  p.fill(w - 1, 0, w - 1, h - 1, T.FENCE);
  const map: GameMap = { id, name: MAP_NAMES[id], indoor: false, w, h, tiles: m, labels: [], doors: [], buildings: [], branch };
  const trees = (pts: [number, number][]) => { for (const [x, y] of pts) p.set(x, y, T.TREE); };
  const flowers = (pts: [number, number][]) => { for (const [x, y] of pts) p.set(x, y, T.FLOWER); };
  /** 건물 외관 (지붕은 통과 불가, door는 아래쪽 줄) */
  const building = (bid: MapId, name: string, x0: number, y0: number, x1: number, y1: number, door: [number, number][], roof: string) => {
    p.fill(x0, y0, x1, y1, T.ROOF);
    map.buildings.push({ id: bid, name, x0, y0, x1, y1, roof, door });
  };
  return { map, p, trees, flowers, building };
}

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

/** 복도: 위·아래 벽에 방 문, 오른쪽 끝에 계단. 게시판(경계작전명령서·생일자 공지)과 정수기 */
function corridor(id: 'hq1' | 'hq2', branch: BranchId) {
  const { map, p } = room(id, 24, 7, branch);
  p.set(23, 2, T.STAIRS); p.set(23, 3, T.STAIRS);
  p.set(1, 1, T.PLANT); p.set(1, 5, T.PLANT);
  p.set(16, 1, T.BOARD); p.set(17, 1, T.BOARD);
  p.set(21, 1, T.COOLER);
  return map;
}

/** 세탁실 9x7 (문 위쪽): 세탁기·건조기 줄 */
function laundryRoom(id: 'laundry1' | 'laundry2', branch: BranchId) {
  const { map, p } = room(id, 9, 7, branch);
  p.fill(1, 5, 7, 5, T.WASHER);
  p.set(1, 2, T.SINK);
  p.set(7, 2, T.SHELF);
  return map;
}

/** 화장실 9x7 (문 아래쪽): 칸막이 변기 줄 + 세면대 */
function restroom(id: 'wc1' | 'wc2', branch: BranchId) {
  const { map, p } = room(id, 9, 7, branch);
  p.fill(1, 1, 4, 1, T.TOILET);
  p.fill(6, 1, 7, 1, T.SINK);
  p.set(7, 4, T.PLANT);
  return map;
}

function buildBarracks(branch: BranchId) {
  const hq1 = corridor('hq1', branch);
  const hq2 = corridor('hq2', branch);
  const room1 = barracksRoom('room1', branch);
  const room2 = barracksRoom('room2', branch);

  // 행정반 11x8 (출입문 아래쪽)
  const admin = room('admin', 11, 8, branch);
  admin.p.fill(1, 1, 9, 1, T.LOCKER);
  admin.p.set(4, 3, T.DESK); admin.p.set(5, 3, T.DESK); admin.p.set(6, 3, T.DESK);
  admin.p.set(1, 5, T.DESK); admin.p.set(2, 5, T.DESK);
  admin.p.set(8, 5, T.DESK); admin.p.set(9, 5, T.DESK);
  admin.p.set(9, 6, T.PLANT); admin.p.set(1, 6, T.PLANT);
  // 지휘통제실 11x8: 상황판·모니터·당직 책상
  const command = room('command', 11, 8, branch);
  command.p.fill(2, 1, 4, 1, T.BOARD);
  command.p.fill(6, 1, 8, 1, T.PC);
  command.p.fill(3, 3, 7, 3, T.DESK);
  command.p.set(1, 5, T.DESK); command.p.set(9, 5, T.DESK);
  // 정비실 11x8: 공구함·작업대
  const maint = room('maint', 11, 8, branch);
  maint.p.fill(1, 1, 9, 1, T.LOCKER);
  maint.p.fill(2, 3, 8, 3, T.DESK);
  maint.p.set(9, 5, T.SHELF); maint.p.set(1, 5, T.SHELF);
  // 휴게실 11x8: TV·소파·자판기
  const lounge = room('lounge', 11, 8, branch);
  lounge.p.set(5, 1, T.TV);
  lounge.p.fill(3, 4, 7, 4, T.SOFA);
  lounge.p.set(9, 1, T.SHELF); lounge.p.set(9, 2, T.SHELF);
  lounge.p.set(1, 1, T.PLANT);
  // 체단실 13x9: 운동 기구
  const gym = room('gymroom', 13, 9, branch);
  for (const [x, y] of [[2, 2], [4, 2], [8, 2], [10, 2], [2, 5], [10, 5]] as [number, number][]) gym.p.set(x, y, T.GYM);
  gym.p.set(6, 1, T.COOLER);
  // 도서관 11x8: 책장·열람 책상
  const library = room('library', 11, 8, branch);
  library.p.fill(1, 1, 9, 1, T.SHELF);
  library.p.set(1, 3, T.SHELF); library.p.set(1, 4, T.SHELF); library.p.set(9, 3, T.SHELF); library.p.set(9, 4, T.SHELF);
  library.p.fill(4, 3, 6, 3, T.DESK);
  // 싸지방 9x7 (문 위쪽): PC 줄
  const cyber = room('cyber', 9, 7, branch);
  cyber.p.fill(1, 5, 7, 5, T.PC);
  cyber.p.set(1, 2, T.PC); cyber.p.set(7, 2, T.PC);
  cyber.p.set(1, 1, T.PLANT);
  const wc1 = restroom('wc1', branch), wc2 = restroom('wc2', branch);
  const ld1 = laundryRoom('laundry1', branch), ld2 = laundryRoom('laundry2', branch);

  // 1층 복도: 위 = 행정반·지통실·정비실·화장실 / 아래 = 1생활관·세탁실·현관 / 오른쪽 = 계단
  link(hq1, [[4, 0]], 'up', admin.map, [[5, 7]], 'down', ['행정반', '복도']);
  link(hq1, [[9, 0]], 'up', command.map, [[5, 7]], 'down', ['지휘통제실', '복도']);
  link(hq1, [[14, 0]], 'up', maint.map, [[5, 7]], 'down', ['정비실', '복도']);
  link(hq1, [[19, 0]], 'up', wc1, [[4, 6]], 'down', ['화장실', '복도']);
  link(hq1, [[6, 6], [7, 6]], 'down', room1, [[6, 0], [7, 0]], 'up', ['1생활관', '복도']);
  link(hq1, [[12, 6]], 'down', ld1, [[4, 0]], 'up', ['세탁실', '복도']);
  link(hq1, [[23, 2], [23, 3]], 'right', hq2, [[23, 2], [23, 3]], 'right', ['2층 ↑', '1층 ↓']);
  // 2층 복도: 위 = 휴게실·체단실·도서관·화장실 / 아래 = 2생활관·싸지방·세탁실
  link(hq2, [[4, 0]], 'up', lounge.map, [[5, 7]], 'down', ['휴게실', '복도']);
  link(hq2, [[9, 0]], 'up', gym.map, [[6, 8]], 'down', ['체단실', '복도']);
  link(hq2, [[14, 0]], 'up', library.map, [[5, 7]], 'down', ['도서관', '복도']);
  link(hq2, [[19, 0]], 'up', wc2, [[4, 6]], 'down', ['화장실', '복도']);
  link(hq2, [[6, 6], [7, 6]], 'down', room2, [[6, 0], [7, 0]], 'up', ['2생활관', '복도']);
  link(hq2, [[12, 6]], 'down', cyber.map, [[4, 0]], 'up', ['싸지방', '복도']);
  link(hq2, [[17, 6]], 'down', ld2, [[4, 0]], 'up', ['세탁실', '복도']);

  return {
    maps: [hq1, hq2, room1, room2, admin.map, command.map, maint.map, lounge.map, gym.map, library.map, cyber.map, wc1, wc2, ld1, ld2] as GameMap[],
    entrance: { map: hq1, tiles: [[18, 6], [19, 6]] as [number, number][] },
    spots: [
      { id: 'bed', map: 'room1', x: 3, y: 4, label: '내 침상' },
      { id: 'barracks', map: 'room1', x: 7, y: 5, label: '1생활관' },
      { id: 'admin', map: 'admin', x: 5, y: 5, label: '행정반' },
      { id: 'command', map: 'command', x: 5, y: 5, label: '지휘통제실 상황판' },
      { id: 'maint', map: 'maint', x: 5, y: 4, label: '정비실 작업대' },
      { id: 'tv', map: 'lounge', x: 5, y: 3, label: '휴게실 TV' },
      { id: 'gym', map: 'gymroom', x: 6, y: 4, label: '체단실' },
      { id: 'library', map: 'library', x: 5, y: 5, label: '도서관' },
      { id: 'cyber', map: 'cyber', x: 4, y: 4, label: '싸지방 PC' },
      { id: 'wc1', map: 'wc1', x: 4, y: 3, label: '1층 화장실' },
      { id: 'wc2', map: 'wc2', x: 4, y: 3, label: '2층 화장실' },
      { id: 'laundry1', map: 'laundry1', x: 4, y: 4, label: '1층 세탁실' },
      { id: 'laundry2', map: 'laundry2', x: 4, y: 4, label: '2층 세탁실' },
      { id: 'water1', map: 'hq1', x: 21, y: 2, label: '1층 정수기' },
      { id: 'water2', map: 'hq2', x: 21, y: 2, label: '2층 정수기' },
      { id: 'board1', map: 'hq1', x: 16, y: 2, label: '1층 복도 게시판' },
      { id: 'board2', map: 'hq2', x: 16, y: 2, label: '2층 복도 게시판' },
    ] as SpotDef[],
  };
}

// ───────────── 병영식당 · 조리실 · PX ─────────────
function buildFacilities(branch: BranchId) {
  // 병영식당 13x13
  const mess = room('mess', 13, 13, branch);
  mess.p.fill(1, 1, 11, 1, T.COUNTER);
  // 식탁 3줄 (y=4·7·10). 자리는 각 식탁 바로 위 줄(y=3·6·9)에서 아래를 보고 앉고,
  // 식탁 사이에 통로(y=5·8)를 둬서 뒷줄 사람이 앞 식탁의 식판을 가리지 않게 한다
  for (const ty of [4, 7, 10]) { mess.p.fill(1, ty, 4, ty, T.TABLE); mess.p.fill(8, ty, 11, ty, T.TABLE); }
  // 조리실 11x8 (식당 오른쪽 벽 문으로 연결): 화구·싱크대·조리대
  const kitchen = room('kitchen', 11, 8, branch);
  kitchen.p.fill(2, 1, 6, 1, T.STOVE);
  kitchen.p.fill(8, 1, 9, 1, T.SINK);
  kitchen.p.fill(3, 4, 7, 4, T.COUNTER);
  kitchen.p.set(9, 6, T.SHELF);
  link(mess.map, [[12, 2]], 'right', kitchen.map, [[0, 3]], 'left', ['조리실', '식당']);
  // PX/BX 9x7
  const px = room('px', 9, 7, branch);
  px.map.name = STORE_NAME[branch];
  px.p.fill(1, 1, 7, 1, T.COUNTER);
  px.p.set(1, 3, T.SHELF); px.p.set(1, 4, T.SHELF); px.p.set(7, 3, T.SHELF); px.p.set(7, 4, T.SHELF);
  return {
    maps: [mess.map, kitchen.map, px.map],
    mess: mess.map, px: px.map,
    entrances: { mess: [[6, 12]] as [number, number][], px: [[4, 6]] as [number, number][] },
    spots: [
      { id: 'mess', map: 'mess', x: 6, y: 2, label: '식당 배식대' },
      { id: 'kitchen', map: 'kitchen', x: 5, y: 2, label: '조리실' },
      { id: 'px', map: 'px', x: 4, y: 2, label: `${STORE_NAME[branch]} 계산대` },
    ] as SpotDef[],
  };
}

// ───────────── 야외 구역 ─────────────
/** 중심 구역: 막사 · 연병장 · 농구장 (40x32) */
function buildHub(branch: BranchId) {
  const W = 40, H = 32;
  const z = yard('outdoor', W, H, branch);
  const { fill, set } = z.p;
  // 도로: 가로(좌·우 끝 = PX / 병영식당), 세로(아래 끝 = 위병소 방향), 연병장·농구장 둘레
  fill(1, 14, W - 2, 15, T.ROAD);
  fill(8, 12, 9, H - 2, T.ROAD);
  fill(10, 30, 29, 30, T.ROAD);
  fill(30, 16, 31, 28, T.ROAD);
  // 연병장 (구령대 y=17)
  fill(11, 17, 29, 29, T.SAND);
  fill(17, 17, 23, 17, T.STAGE);
  // 농구장 (골대 위·아래)
  fill(32, 17, 38, 27, T.COURT);
  set(35, 17, T.HOOP); set(35, 27, T.HOOP);
  z.trees([[28, 2], [31, 3], [34, 2], [37, 4], [29, 7], [33, 8], [37, 9], [30, 11], [36, 12], [1, 13], [12, 13], [24, 13],
    [2, 17], [4, 19], [2, 22], [5, 24], [3, 27], [6, 29], [33, 29], [37, 29]]);
  z.flowers([[18, 13], [19, 13], [20, 13], [26, 13], [27, 13], [3, 16], [4, 16], [5, 16]]);
  z.building('hq1', '막사', 2, 2, 26, 12, [[8, 12], [9, 12]], '#5a7a4a');
  z.map.labels.push({ text: '연병장', x: 20.5, y: 28.6 }, { text: '농구장', x: 35.5, y: 28.6 });
  const spots: SpotDef[] = [
    { id: 'parade', map: 'outdoor', x: 20, y: 22, label: '연병장' },
    { id: 'court', map: 'outdoor', x: 35, y: 22, label: '농구장' },
  ];
  return { map: z.map, spots, hqDoor: [[8, 12], [9, 12]] as [number, number][] };
}

/** 병영식당 앞 (26x20): 식당 건물, 아래로 분리수거장 */
function buildMessYard(branch: BranchId) {
  const z = yard('messyard', 26, 20, branch);
  const { fill } = z.p;
  fill(1, 14, 24, 15, T.ROAD);
  fill(12, 12, 13, 13, T.ROAD);
  fill(18, 16, 19, 18, T.ROAD);
  z.trees([[2, 2], [4, 5], [2, 9], [21, 3], [23, 6], [21, 10], [23, 12], [3, 17], [7, 17], [12, 17], [23, 17]]);
  z.flowers([[9, 12], [10, 12], [15, 12], [16, 12]]);
  const door: [number, number][] = [[12, 11], [13, 11]];
  z.building('mess', '병영식당', 7, 2, 18, 11, door, '#a0503a');
  return { map: z.map, door };
}

/** 분리수거장 (20x14) */
function buildRecycle(branch: BranchId) {
  const z = yard('recycle', 20, 14, branch);
  const { fill } = z.p;
  fill(9, 1, 10, 2, T.ROAD);
  fill(2, 3, 17, 10, T.ROAD);
  fill(4, 5, 15, 5, T.BIN);
  z.trees([[2, 1], [6, 1], [14, 1], [17, 1], [1, 12], [5, 12], [14, 12], [18, 12]]);
  z.map.labels.push({ text: '분리수거장', x: 10, y: 11.6 });
  return { map: z.map, spots: [{ id: 'recycle', map: 'recycle', x: 9, y: 6, label: '분리수거장' }] as SpotDef[] };
}

/** PX/BX 앞 (22x16) */
function buildPxYard(branch: BranchId) {
  const z = yard('pxyard', 22, 16, branch);
  z.map.name = `${STORE_NAME[branch]} 앞`;
  const { fill } = z.p;
  fill(1, 8, 20, 9, T.ROAD);
  fill(10, 7, 11, 7, T.ROAD);
  z.trees([[2, 2], [2, 6], [18, 2], [19, 5], [3, 12], [8, 13], [14, 12], [19, 13]]);
  z.flowers([[8, 7], [9, 7], [12, 7], [13, 7]]);
  const door: [number, number][] = [[10, 6], [11, 6]];
  z.building('px', STORE_NAME[branch], 6, 1, 15, 6, door, '#c08a3a');
  return { map: z.map, door };
}

/** 탄약고(육군)/격납고(공군)/함정 부두(해군) + 위병소·정문 + 훈련장 (44x30) */
function buildDepot(branch: BranchId, trainLabel: string) {
  const W = 44, H = 30;
  const z = yard('depot', W, H, branch);
  const { fill, set } = z.p;
  const facility = FACILITY_NAME[branch];
  z.map.name = `${facility}·위병소`;
  // 중앙 도로: 위 = 연병장 방향, 아래 = 위병소 정문
  fill(14, 1, 15, H - 2, T.ROAD);
  set(14, H - 1, T.ROAD); set(15, H - 1, T.ROAD);
  // 위병소 (정문 옆)
  fill(11, 25, 12, 26, T.BOOTH);
  let ammo: [number, number] = [7, 11];
  let train: [number, number] = [30, 24];
  if (branch === 'army') {
    // 탄약고: 철조망 울타리 안 흙더미 벙커
    fill(3, 4, 11, 12, T.DIRT);
    fill(2, 3, 12, 3, T.FENCE); fill(2, 3, 2, 13, T.FENCE); fill(12, 3, 12, 13, T.FENCE); fill(2, 13, 12, 13, T.FENCE);
    set(6, 13, T.ROAD); set(7, 13, T.ROAD);
    fill(6, 14, 13, 14, T.ROAD);
    fill(4, 5, 10, 8, T.AMMO);
    ammo = [7, 10];
    // 사격장
    fill(18, 2, 42, 27, T.DIRT);
    for (let x = 20; x <= 41; x += 3) set(x, 4, T.TARGET);
    for (let x = 19; x <= 41; x++) if (x % 3 !== 0) set(x, 22, T.SANDBAG);
    train = [30, 24];
    z.map.labels.push({ text: facility, x: 7.5, y: 2.6 }, { text: trainLabel, x: 30.5, y: 1.6 });
  } else if (branch === 'air') {
    // 격납고 + 계류장
    fill(2, 3, 12, 10, T.HANGAR);
    fill(2, 11, 13, 12, T.ROAD);
    ammo = [7, 11];
    fill(18, 8, 42, 15, T.RUNWAY);
    train = [30, 12];
    z.map.labels.push({ text: facility, x: 7.5, y: 2.6 }, { text: trainLabel, x: 30.5, y: 7.4 });
  } else {
    // 함정 부두: 바다 + 잔교 + 정박한 함정
    fill(16, 2, 42, 9, T.ROAD);
    fill(18, 10, 42, 27, T.WATER);
    fill(24, 10, 27, 25, T.PIER);
    fill(30, 13, 37, 23, T.SHIP);
    fill(18, 4, 20, 4, T.SANDBAG);
    ammo = [25, 9];
    train = [25, 14];
    fill(3, 5, 6, 5, T.SANDBAG);
    z.map.labels.push({ text: facility, x: 25.5, y: 1.6 });
  }
  z.trees([[2, 16], [4, 19], [2, 22], [6, 23], [3, 27], [8, 27], [9, 17]]);
  z.map.labels.push({ text: '위병소', x: 12, y: 24.4 });
  const spots: SpotDef[] = [
    { id: 'ammo', map: 'depot', x: ammo[0], y: ammo[1], label: facility },
    { id: 'train', map: 'depot', x: train[0], y: train[1], label: trainLabel },
    { id: 'post', map: 'depot', x: 13, y: 26, label: '위병소 초소' },
    { id: 'gate', map: 'depot', x: 15, y: 28, label: '위병소 정문' },
  ];
  return { map: z.map, spots };
}

const worldCache = new Map<string, WorldDef>();

/** 군별 월드(야외 구역들 + 막사 + 시설)를 만든다. 결과는 캐시된다. */
export function getWorld(branch: BranchId, trainLabel: string): WorldDef {
  const key = `${branch}:${trainLabel}`;
  const cached = worldCache.get(key);
  if (cached) return cached;
  const hub = buildHub(branch);
  const messYard = buildMessYard(branch);
  const recycle = buildRecycle(branch);
  const pxYard = buildPxYard(branch);
  const depot = buildDepot(branch, trainLabel);
  const hq = buildBarracks(branch);
  const fac = buildFacilities(branch);

  const maps = {} as Record<MapId, GameMap>;
  for (const m of [hub.map, messYard.map, recycle.map, pxYard.map, depot.map, ...hq.maps, ...fac.maps]) maps[m.id] = m;

  // 건물 정문 ↔ 실내
  link(hub.map, hub.hqDoor, 'up', hq.entrance.map, hq.entrance.tiles, 'down', [undefined, '밖으로']);
  link(messYard.map, messYard.door, 'up', fac.mess, fac.entrances.mess, 'down');
  link(pxYard.map, pxYard.door, 'up', fac.px, fac.entrances.px, 'down');

  // 야외 구역 사이 길 (끝까지 걸어가면 이동)
  const store = STORE_NAME[branch];
  edgeLink(hub.map, [[W(hub.map) - 1, 14], [W(hub.map) - 1, 15]], 'right', messYard.map, [[0, 14], [0, 15]], 'left', ['병영식당 →', '← 연병장']);
  edgeLink(hub.map, [[0, 14], [0, 15]], 'left', pxYard.map, [[21, 8], [21, 9]], 'right', [`← ${store}`, '연병장 →']);
  edgeLink(hub.map, [[8, 31], [9, 31]], 'down', depot.map, [[14, 0], [15, 0]], 'up', [`↓ ${FACILITY_NAME[branch]}·위병소`, '↑ 연병장']);
  edgeLink(messYard.map, [[18, 19], [19, 19]], 'down', recycle.map, [[9, 0], [10, 0]], 'up', ['↓ 분리수거장', '↑ 병영식당']);

  const spots = {} as Record<SpotId, SpotDef>;
  for (const s of [...hub.spots, ...recycle.spots, ...depot.spots, ...hq.spots, ...fac.spots]) spots[s.id] = s;
  const world = { maps, spots };
  worldCache.set(key, world);
  return world;
}

const W = (m: GameMap) => m.w;

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
  const Wd = map.w;
  const key = (x: number, y: number) => y * Wd + x;
  const prev = new Map<number, number>();
  const q: number[] = [key(sx, sy)];
  prev.set(key(sx, sy), -1);
  const goal = key(gx, gy);
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) break;
    const cx = cur % Wd, cy = Math.floor(cur / Wd);
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
    path.push([c % Wd, Math.floor(c / Wd)]);
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

const YARD: [string, string] = ['#e9d9b8', '#e2d0ac'];
const FLOOR_COLORS: Record<MapId, [string, string]> = {
  outdoor: YARD, messyard: YARD, recycle: YARD, pxyard: YARD, depot: YARD,
  hq1: ['#b8c0a8', '#b0b8a0'],
  hq2: ['#b8c0a8', '#b0b8a0'],
  room1: ['#d8c49a', '#cfba8e'],
  room2: ['#d8c49a', '#cfba8e'],
  admin: ['#c8ccd2', '#bec3ca'],
  command: ['#a8b0b8', '#a0a8b0'],
  lounge: ['#e0c8a0', '#d8c098'],
  maint: ['#a8a8a0', '#a0a098'],
  wc1: ['#e0e8ec', '#d6dee2'], wc2: ['#e0e8ec', '#d6dee2'],
  laundry1: ['#d0d8e0', '#c8d0d8'], laundry2: ['#d0d8e0', '#c8d0d8'],
  gymroom: ['#c8b890', '#c0b088'],
  library: ['#d8c8a8', '#cfbf9e'],
  cyber: ['#b8c4d0', '#aebac7'],
  mess: ['#e6e2d6', '#dcd8cb'],
  kitchen: ['#d8dcd8', '#ced2ce'],
  px: ['#e8dcc8', '#dfd2bc'],
};

const BIN_COLORS = ['#3a8a3a', '#e0b030', '#3a6ac8', '#8a8a8a', '#c87a3a', '#6a4a2a'];

/** 같은 종류 타일이 이어진 세로 범위 (활주로 중앙선·농구장 중앙선용) */
function runOf(map: GameMap, x: number, y: number, kinds: T[]): [number, number] {
  let a = y, b = y;
  while (kinds.includes(map.tiles[a - 1]?.[x])) a--;
  while (kinds.includes(map.tiles[b + 1]?.[x])) b++;
  return [a, b];
}

export function renderMapCanvas(map: GameMap, season: Season): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = map.w * TILE;
  c.height = map.h * TILE;
  const g = c.getContext('2d')!;
  const grass = season === 'winter' ? '#e6eef2' : season === 'autumn' ? '#b8a860' : season === 'spring' ? '#8cc46a' : '#6fae54';
  const grassDot = season === 'winter' ? '#cfdde4' : season === 'autumn' ? '#a08a48' : '#5a9a44';
  const [fa, fb] = FLOOR_COLORS[map.id];
  const road = season === 'winter' ? '#d8d4cc' : '#c9b38a';

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
        case T.ROAD: case T.BIN: base(road); if (r > 0.7) { g.fillStyle = '#b8a078'; g.fillRect(px + r * 26, py + 10, 3, 2); } break;
        case T.SAND: case T.STAGE: base(season === 'winter' ? '#e8e4dc' : '#dcc89c'); if (r > 0.6) { g.fillStyle = '#cbb488'; g.fillRect(px + r * 28, py + r * 20, 2, 2); } break;
        case T.DIRT: case T.TARGET: case T.SANDBAG: case T.AMMO:
          base(season === 'winter' ? '#dcd6cc' : '#b89a72'); if (r > 0.6) { g.fillStyle = '#a0845e'; g.fillRect(px + r * 26, py + r * 26, 3, 2); } break;
        case T.GYM:
          if (map.indoor) base((x + y) % 2 === 0 ? fa : fb);
          else base(season === 'winter' ? '#dcd6cc' : '#b89a72');
          break;
        case T.FLOOR: case T.BED: case T.DESK: case T.TABLE: case T.LOCKER: case T.COUNTER: case T.PC:
        case T.SHELF: case T.TV: case T.PLANT: case T.BOARD: case T.SOFA:
        case T.COOLER: case T.WASHER: case T.TOILET: case T.SINK: case T.STOVE:
          base((x + y) % 2 === 0 ? fa : fb);
          break;
        case T.COURT: case T.HOOP: {
          base('#c8703c');
          // 코트 바깥 선 + 중앙선
          g.fillStyle = '#f4ece0';
          const isC = (tx: number, ty: number) => [T.COURT, T.HOOP].includes(map.tiles[ty]?.[tx]);
          if (!isC(x - 1, y)) g.fillRect(px, py, 2, TILE);
          if (!isC(x + 1, y)) g.fillRect(px + TILE - 2, py, 2, TILE);
          if (!isC(x, y - 1)) g.fillRect(px, py, TILE, 2);
          if (!isC(x, y + 1)) g.fillRect(px, py + TILE - 2, TILE, 2);
          const [a, b] = runOf(map, x, y, [T.COURT, T.HOOP]);
          if (y === Math.floor((a + b) / 2)) g.fillRect(px, py + TILE / 2 - 1, TILE, 2);
          break;
        }
        case T.STAIRS:
          base('#6a6a72');
          for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#8a8a94' : '#a0a0aa'; g.fillRect(px + i * 8, py, 8, TILE); }
          g.fillStyle = '#4a4a52'; g.fillRect(px, py, TILE, 2);
          break;
        case T.WALL: base('#7a6a5a'); g.fillStyle = '#9a8a76'; g.fillRect(px, py, TILE, 6); g.fillStyle = '#5e5044'; g.fillRect(px, py + TILE - 3, TILE, 3); break;
        case T.FENCE: base(grass); g.fillStyle = '#6a6a6a'; g.fillRect(px, py + 12, TILE, 4); g.fillRect(px + 4, py + 4, 3, 24); g.fillRect(px + 22, py + 4, 3, 24); break;
        case T.WATER: case T.SHIP: base('#3a7ac0'); g.fillStyle = '#5a9ad8'; g.fillRect(px + ((r * 20 + y * 7) % 24), py + 8 + r * 12, 8, 2); break;
        case T.PIER: base('#a07850'); g.fillStyle = '#7a5838'; for (let i = 0; i < 4; i++) g.fillRect(px, py + i * 8 + 7, TILE, 1); break;
        case T.RUNWAY: {
          base('#5a5e64');
          const [a, b] = runOf(map, x, y, [T.RUNWAY]);
          g.fillStyle = '#e8d24a';
          if (y === a) g.fillRect(px, py, TILE, 3);
          if (y === b) g.fillRect(px, py + TILE - 3, TILE, 3);
          if (y === Math.floor((a + b) / 2) && x % 3 === 0) { g.fillStyle = '#f2f2f2'; g.fillRect(px + 4, py + TILE - 2, 22, 4); }
          break;
        }
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
        case T.BOARD: g.fillStyle = '#5a7a5a'; g.fillRect(px + 2, py + 4, TILE - 4, TILE - 10); g.fillStyle = '#f2f2ea'; g.fillRect(px + 6, py + 8, 8, 6); g.fillRect(px + 17, py + 10, 8, 6); g.fillStyle = '#e05a4a'; g.fillRect(px + 8, py + 7, 3, 2); break;
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
        case T.COOLER:
          g.fillStyle = '#e8eef4'; g.fillRect(px + 8, py + 10, 16, 20);
          g.fillStyle = '#7ab8e8'; g.fillRect(px + 10, py + 1, 12, 11);
          g.fillStyle = '#3a6aa8'; g.fillRect(px + 11, py + 16, 4, 3); g.fillStyle = '#d04a3a'; g.fillRect(px + 17, py + 16, 4, 3);
          break;
        case T.WASHER:
          g.fillStyle = '#f2f4f6'; g.fillRect(px + 2, py + 4, TILE - 4, TILE - 6);
          g.fillStyle = '#8a929a'; g.fillRect(px + 2, py + 4, TILE - 4, 5);
          g.fillStyle = '#3a4a5a'; g.beginPath(); g.arc(px + 16, py + 20, 8, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#7ab0d8'; g.beginPath(); g.arc(px + 16, py + 20, 5, 0, Math.PI * 2); g.fill();
          break;
        case T.TOILET:
          g.fillStyle = '#b8c0c8'; g.fillRect(px, py, 3, TILE); g.fillRect(px + TILE - 3, py, 3, TILE);
          g.fillStyle = '#ffffff'; g.fillRect(px + 10, py + 4, 12, 8);
          g.beginPath(); g.ellipse(px + 16, py + 20, 8, 7, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#c8d4dc'; g.beginPath(); g.ellipse(px + 16, py + 20, 5, 4, 0, 0, Math.PI * 2); g.fill();
          break;
        case T.SINK:
          g.fillStyle = '#9aa2aa'; g.fillRect(px + 1, py + 8, TILE - 2, 14);
          g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(px + 16, py + 15, 10, 5, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#6a7278'; g.fillRect(px + 15, py + 4, 3, 7);
          break;
        case T.STOVE:
          g.fillStyle = '#6a7078'; g.fillRect(px + 1, py + 6, TILE - 2, TILE - 8);
          g.fillStyle = '#2a2e34'; g.beginPath(); g.arc(px + 16, py + 17, 9, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#b8c0c8'; g.fillRect(px + 6, py + 2, 20, 10); g.fillStyle = '#e0e4e8'; g.fillRect(px + 6, py + 2, 20, 3);
          break;
        case T.HOOP:
          g.fillStyle = '#6a6a6a'; g.fillRect(px + 15, py + (y === runOf(map, x, y, [T.COURT, T.HOOP])[0] ? 0 : 16), 3, 16);
          g.fillStyle = '#ffffff'; g.fillRect(px + 6, py + 10, 20, 12);
          g.strokeStyle = '#d04a2a'; g.lineWidth = 2; g.strokeRect(px + 11, py + 14, 10, 6);
          break;
        case T.BIN: {
          const col = BIN_COLORS[x % BIN_COLORS.length];
          g.fillStyle = shade(col, -30); g.fillRect(px + 4, py + 6, TILE - 8, TILE - 8);
          g.fillStyle = col; g.fillRect(px + 5, py + 9, TILE - 10, TILE - 12);
          g.fillStyle = shade(col, 30); g.fillRect(px + 3, py + 4, TILE - 6, 5);
          break;
        }
        case T.AMMO: {
          // 흙을 덮은 벙커 + 가운데 아래쪽에 철문
          g.fillStyle = '#6a7a52'; g.fillRect(px, py, TILE, TILE);
          g.fillStyle = '#7a8a62'; if (r > 0.4) g.fillRect(px + r * 20, py + 6, 8, 3);
          const below = map.tiles[y + 1]?.[x] !== T.AMMO;
          const [a, b] = [x, x];
          let l = a, rr = b;
          while (map.tiles[y][l - 1] === T.AMMO) l--;
          while (map.tiles[y][rr + 1] === T.AMMO) rr++;
          if (below) {
            g.fillStyle = '#8a8e7a'; g.fillRect(px, py + TILE - 8, TILE, 8);
            if (x === Math.floor((l + rr) / 2)) { g.fillStyle = '#4a5058'; g.fillRect(px + 4, py + 6, TILE - 8, TILE - 6); g.fillStyle = '#e8c040'; g.fillRect(px + 6, py + 2, TILE - 12, 4); }
          }
          break;
        }
      }
    }
  }

  // 건물 외관 (지붕 + 정면 벽 + 문)
  for (const b of map.buildings) {
    const x0 = b.x0 * TILE, y0 = b.y0 * TILE, wpx = (b.x1 - b.x0 + 1) * TILE;
    const facadeTop = (b.y1 - 1) * TILE;
    const bottom = (b.y1 + 1) * TILE;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0 + 6, y0 + 8, wpx, bottom - y0);
    g.fillStyle = '#e8dcc0'; g.fillRect(x0, facadeTop, wpx, bottom - facadeTop);
    g.fillStyle = '#c8b898'; g.fillRect(x0, bottom - 4, wpx, 4);
    for (let x = b.x0; x <= b.x1; x++) {
      if (b.door.some(([dx]) => dx === x) || x === b.x0 || x === b.x1) continue;
      if ((x - b.x0) % 2 === 1) {
        g.fillStyle = '#5a7a9a'; g.fillRect(x * TILE + 6, facadeTop + 10, TILE - 12, 18);
        g.fillStyle = '#a8c8e8'; g.fillRect(x * TILE + 8, facadeTop + 12, TILE - 16, 6);
      }
    }
    const dx0 = Math.min(...b.door.map((d) => d[0])) * TILE;
    const dx1 = (Math.max(...b.door.map((d) => d[0])) + 1) * TILE;
    g.fillStyle = '#5a3e2a'; g.fillRect(dx0 + 3, facadeTop + 14, dx1 - dx0 - 6, bottom - facadeTop - 14);
    g.fillStyle = '#8a6040'; g.fillRect(dx0 + 6, facadeTop + 18, dx1 - dx0 - 12, bottom - facadeTop - 20);
    g.fillStyle = '#f2c230'; g.fillRect(dx1 - 12, facadeTop + 38, 3, 4);
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
    g.font = 'bold 15px "Galmuri11", sans-serif';
    g.textAlign = 'center';
    const tw = g.measureText(b.name).width + 18;
    const cx = x0 + wpx / 2, cy = (y0 + roofBottom) / 2;
    g.fillStyle = 'rgba(40,30,20,0.8)'; g.fillRect(cx - tw / 2, cy - 12, tw, 24);
    g.fillStyle = '#fff6dc'; g.fillText(b.name, cx, cy + 5);
  }

  // 함정 (해군 부두)
  if (map.id === 'depot' && map.branch === 'navy') {
    const sx = 30 * TILE, sy = 13 * TILE, sw = 8 * TILE, sh = 11 * TILE;
    g.fillStyle = '#7a8692';
    g.beginPath();
    g.moveTo(sx + sw / 2, sy - 12);
    g.lineTo(sx + sw, sy + 40);
    g.lineTo(sx + sw - 8, sy + sh);
    g.lineTo(sx + 8, sy + sh);
    g.lineTo(sx, sy + 40);
    g.closePath(); g.fill();
    g.fillStyle = '#a0aab4'; g.fillRect(sx + 50, sy + 80, sw - 100, 120);
    g.fillStyle = '#5a6670'; g.fillRect(sx + 74, sy + 104, sw - 148, 54);
    g.fillStyle = '#ffffff'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.fillText('PKG-999', sx + sw / 2, sy + 260);
  }
  // 위병소 지붕
  if (map.id === 'depot') { g.fillStyle = '#5a6a4a'; g.fillRect(11 * TILE - 4, 25 * TILE - 6, 2 * TILE + 8, 8); }
  // 분리수거장 지붕(차양)
  if (map.id === 'recycle') {
    g.fillStyle = '#5a7a8a'; g.fillRect(3 * TILE, 4 * TILE + 2, 14 * TILE, 8);
    g.fillStyle = '#3a5a6a'; g.fillRect(3 * TILE, 4 * TILE + 10, 14 * TILE, 3);
    g.font = 'bold 9px "Galmuri11", sans-serif'; g.textAlign = 'center';
    const kinds = ['일반', '플라', '캔', '유리', '종이', '음식'];
    for (let x = 4; x <= 15; x++) { g.fillStyle = '#ffffff'; g.fillText(kinds[x % kinds.length], (x + 0.5) * TILE, 5 * TILE + 22); }
  }

  // 문 · 계단 · 길 끝 안내판 ("행정반", "2층 ↑", "병영식당 →" 등)
  g.textAlign = 'center';
  for (const d of map.doors) {
    if (!d.sign) continue;
    g.font = map.indoor ? 'bold 11px "Galmuri11", sans-serif' : 'bold 13px "Galmuri11", sans-serif';
    const cx = (d.tiles.reduce((a, t) => a + t[0], 0) / d.tiles.length + 0.5) * TILE;
    const cyc = (d.tiles.reduce((a, t) => a + t[1], 0) / d.tiles.length + 0.5) * TILE;
    const inward = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[d.enterDir];
    const side = d.enterDir === 'left' || d.enterDir === 'right';
    let lx = cx, cy = cyc;
    if (side) {
      lx = cx + inward[0] * (map.indoor ? 1.1 : 2.2) * TILE;
      cy = Math.min(...d.tiles.map((t) => t[1])) * TILE - (map.indoor ? 6 : 10);
    } else {
      cy = cyc + inward[1] * (map.indoor ? 0.85 : 1.5) * TILE;
      if (!map.indoor) lx = cx + 2.2 * TILE;
    }
    const tw = g.measureText(d.sign).width + 12;
    g.fillStyle = map.indoor ? 'rgba(40,48,72,0.85)' : 'rgba(30,70,40,0.9)';
    g.fillRect(lx - tw / 2, cy - 10, tw, map.indoor ? 14 : 17);
    g.fillStyle = '#ffffff';
    g.fillText(d.sign, lx, cy + (map.indoor ? 2 : 3));
  }
  return c;
}
