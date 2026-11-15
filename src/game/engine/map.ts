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
// 도트 화풍: 논리 해상도는 타일 16px(화면 2배 확대). 검은 외곽선, 윗면/앞면 2면 명암,
// 바닥에 떨어지는 그림자 — 오프닝 방(pixelArt.ts)·사람 캐릭터와 같은 문법이다.

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

type FloorKind = 'wood' | 'tile' | 'lino' | 'concrete';
const YARD: [string, string] = ['#e9d9b8', '#e2d0ac'];
const FLOOR_COLORS: Record<MapId, [string, string]> = {
  outdoor: YARD, messyard: YARD, recycle: YARD, pxyard: YARD, depot: YARD,
  hq1: ['#b8c0a8', '#b0b8a0'],
  hq2: ['#b8c0a8', '#b0b8a0'],
  room1: ['#d8b47a', '#c9a268'],
  room2: ['#d8b47a', '#c9a268'],
  admin: ['#c8ccd2', '#bec3ca'],
  command: ['#a8b0b8', '#a0a8b0'],
  lounge: ['#e0bc84', '#d2ac72'],
  maint: ['#a8a8a0', '#a0a098'],
  wc1: ['#e0e8ec', '#d0dbe2'], wc2: ['#e0e8ec', '#d0dbe2'],
  laundry1: ['#d0d8e0', '#c2ccd6'], laundry2: ['#d0d8e0', '#c2ccd6'],
  gymroom: ['#d0b078', '#c2a068'],
  library: ['#d8b888', '#c8a674'],
  cyber: ['#b8c4d0', '#aebac7'],
  mess: ['#e6e2d6', '#d6d1c2'],
  kitchen: ['#d8dcd8', '#c8cec8'],
  px: ['#e8dcc8', '#dacbb0'],
};
const FLOOR_KIND: Record<MapId, FloorKind> = {
  outdoor: 'concrete', messyard: 'concrete', recycle: 'concrete', pxyard: 'concrete', depot: 'concrete',
  hq1: 'lino', hq2: 'lino', room1: 'wood', room2: 'wood', admin: 'lino', command: 'lino', lounge: 'wood',
  maint: 'concrete', wc1: 'tile', wc2: 'tile', laundry1: 'tile', laundry2: 'tile', gymroom: 'wood',
  library: 'wood', cyber: 'lino', mess: 'tile', kitchen: 'tile', px: 'tile',
};

const BIN_COLORS = ['#3a8a3a', '#e0b030', '#3a6ac8', '#8a8a8a', '#c87a3a', '#6a4a2a'];
const OUT = '#181018';
const SHADE = 'rgba(30,20,30,0.22)';

/** 같은 종류 타일이 이어진 세로 범위 (활주로 중앙선·농구장 중앙선용) */
function runOf(map: GameMap, x: number, y: number, kinds: T[]): [number, number] {
  let a = y, b = y;
  while (kinds.includes(map.tiles[a - 1]?.[x])) a--;
  while (kinds.includes(map.tiles[b + 1]?.[x])) b++;
  return [a, b];
}

/** 바닥이 깔리는 타일 (가구 밑에도 바닥이 있다) */
const ON_FLOOR = new Set<T>([
  T.FLOOR, T.BED, T.DESK, T.TABLE, T.LOCKER, T.COUNTER, T.PC, T.SHELF, T.TV, T.PLANT, T.BOARD, T.SOFA,
  T.COOLER, T.WASHER, T.TOILET, T.SINK, T.STOVE,
]);

export function renderMapCanvas(map: GameMap, season: Season): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = map.w * TILE;
  c.height = map.h * TILE;
  const g = c.getContext('2d')!;
  const P = TILE / 16; // 논리 픽셀 1칸의 실제 크기
  const winter = season === 'winter';
  const grass = winter ? '#e6eef2' : season === 'autumn' ? '#b8a860' : season === 'spring' ? '#8cc46a' : '#6fae54';
  const grassDot = winter ? '#cfdde4' : season === 'autumn' ? '#a08a48' : season === 'spring' ? '#6aa850' : '#5a9a44';
  const grassHi = winter ? '#f6fafc' : season === 'autumn' ? '#ccbc74' : season === 'spring' ? '#a4d684' : '#86c26a';
  const [fa, fb] = FLOOR_COLORS[map.id];
  const kind = FLOOR_KIND[map.id];
  const road = winter ? '#d8d4cc' : '#c9b38a';
  const dirt = winter ? '#dcd6cc' : '#b89a72';
  const sand = winter ? '#e8e4dc' : '#dcc89c';

  // 타일 원점 기준 논리 픽셀 사각형
  let ox = 0, oy = 0;
  const R = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(ox + x * P, oy + y * P, w * P, h * P); };
  const box = (x: number, y: number, w: number, h: number, fill: string, out = OUT) => { R(x, y, w, h, out); R(x + 1, y + 1, w - 2, h - 2, fill); };
  /** 윗면 + 앞면이 보이는 덩어리 (가구) */
  const block = (x: number, y: number, w: number, h: number, topH: number, top: string, front: string) => {
    R(x + 1, y + h, w - 1, 1, SHADE);
    R(x, y, w, h, OUT);
    R(x + 1, y + 1, w - 2, topH - 1, top); R(x + 1, y + 1, w - 2, 1, shade(top, 26));
    R(x + 1, y + topH, w - 2, h - topH - 1, front); R(x + 1, y + topH, w - 2, 1, shade(front, -28));
  };
  const at = (tx: number, ty: number): T | undefined => map.tiles[ty]?.[tx];
  const walkable = (tx: number, ty: number) => { const v = at(tx, ty); return v !== undefined && v !== T.WALL; };

  // ── 1) 바닥 ──
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.tiles[y][x];
    ox = x * TILE; oy = y * TILE;
    const r = hash(x, y), r2 = hash(x + 91, y + 37);
    const base = (col: string) => R(0, 0, 16, 16, col);
    const speck = (col: string, n = 1) => { for (let i = 0; i < n; i++) R(Math.floor(hash(x + i * 7, y + i * 3) * 13) + 1, Math.floor(hash(x + i * 5, y + i * 11) * 13) + 1, 2, 1, col); };
    const floor = () => {
      if (kind === 'wood') {
        base(fa);
        R(0, 0, 16, 1, shade(fa, 14)); R(0, 8, 16, 1, shade(fa, 14));
        R(0, 7, 16, 1, shade(fb, -22)); R(0, 15, 16, 1, shade(fb, -22));
        R(((x * 5 + y * 3) % 11) + 2, 1, 1, 6, fb); R(((x * 7 + y * 5) % 11) + 2, 9, 1, 6, fb);
        if (r > 0.7) R(5, 3, 4, 1, fb);
      } else if (kind === 'tile') {
        base((x + y) % 2 === 0 ? fa : fb);
        R(0, 0, 16, 1, shade(fa, 16)); R(0, 0, 1, 16, shade(fa, 16));
        R(0, 15, 16, 1, shade(fb, -18)); R(15, 0, 1, 16, shade(fb, -18));
      } else if (kind === 'lino') {
        base(fa);
        if (r > 0.45) speck(fb, 2);
        if (r2 > 0.6) speck(shade(fa, 12), 1);
        if (y % 2 === 0) R(0, 15, 16, 1, fb);
      } else {
        base(fa); if (r > 0.5) speck(fb, 2);
      }
    };
    const grassTile = () => {
      base(grass);
      if (r > 0.35) { const a = Math.floor(r * 11) + 1, b = Math.floor(r2 * 10) + 2; R(a, b, 1, 2, grassDot); R(a + 1, b + 1, 1, 1, grassDot); R(a + 2, b, 1, 2, grassDot); }
      if (r2 > 0.55) { const a = Math.floor(r2 * 12) + 1, b = Math.floor(r * 11) + 2; R(a, b, 2, 1, grassHi); }
      if (r > 0.85) R(11, 12, 1, 2, grassDot);
    };
    switch (t) {
      case T.GRASS: case T.TREE: case T.FLOWER: case T.FENCE: grassTile(); break;
      case T.ROAD: case T.BIN: case T.BOOTH: case T.HANGAR:
        base(road); if (r > 0.5) speck(shade(road, -22), 2); if (r2 > 0.6) speck(shade(road, 16), 1);
        break;
      case T.SAND: case T.STAGE: base(sand); if (r > 0.45) speck(shade(sand, -20), 2); if (r2 > 0.7) speck(shade(sand, 14), 1); break;
      case T.DIRT: case T.TARGET: case T.SANDBAG: case T.AMMO:
        base(dirt); if (r > 0.45) speck(shade(dirt, -24), 2); if (r2 > 0.6) R(Math.floor(r2 * 12) + 1, Math.floor(r * 12) + 2, 1, 1, shade(dirt, 22));
        break;
      case T.GYM:
        if (map.indoor) floor(); else { base(dirt); if (r > 0.45) speck(shade(dirt, -24), 2); }
        break;
      case T.COURT: case T.HOOP: {
        base('#c8703c'); if (r > 0.5) speck('#b86432', 2);
        const isC = (tx: number, ty: number) => { const v = at(tx, ty); return v === T.COURT || v === T.HOOP; };
        const line = '#f4ece0';
        if (!isC(x - 1, y)) R(0, 0, 1, 16, line);
        if (!isC(x + 1, y)) R(15, 0, 1, 16, line);
        if (!isC(x, y - 1)) R(0, 0, 16, 1, line);
        if (!isC(x, y + 1)) R(0, 15, 16, 1, line);
        const [a, b] = runOf(map, x, y, [T.COURT, T.HOOP]);
        if (y === Math.floor((a + b) / 2)) R(0, 7, 16, 1, line);
        break;
      }
      case T.STAIRS:
        for (let i = 0; i < 4; i++) { R(i * 4, 0, 4, 16, i % 2 ? '#8a8a94' : '#a0a0aa'); R(i * 4, 0, 1, 16, '#c0c0ca'); R(i * 4 + 3, 0, 1, 16, '#5c5c66'); }
        R(0, 0, 16, 1, OUT); R(0, 15, 16, 1, OUT);
        for (let i = 0; i < 4; i++) R(i * 4 + 1, 2, 2, 1, '#e8d24a');
        break;
      case T.WATER: case T.SHIP:
        base('#3a7ac0'); R(0, 0, 16, 16, (x + y) % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,40,0.04)');
        R(Math.floor(r * 9) + 1, Math.floor(r2 * 5) + 2, 4, 1, '#6aa8e0'); R(Math.floor(r2 * 9) + 2, Math.floor(r * 5) + 9, 3, 1, '#5a9ad8');
        if (r > 0.7) R(Math.floor(r * 9) + 3, Math.floor(r2 * 5) + 3, 2, 1, '#a8d0f0');
        break;
      case T.PIER:
        base('#a07850');
        for (let i = 0; i < 4; i++) { R(0, i * 4, 16, 1, '#b88a60'); R(0, i * 4 + 3, 16, 1, '#7a5838'); }
        R(((x * 5 + y) % 9) + 3, 1, 1, 2, '#7a5838'); R(((x * 3 + y * 7) % 9) + 3, 9, 1, 2, '#7a5838');
        break;
      case T.RUNWAY: {
        base('#5a5e64'); if (r > 0.4) speck('#4e5258', 2); if (r2 > 0.6) speck('#686c72', 1);
        const [a, b] = runOf(map, x, y, [T.RUNWAY]);
        if (y === a) R(0, 0, 16, 2, '#e8d24a');
        if (y === b) R(0, 14, 16, 2, '#e8d24a');
        if (y === Math.floor((a + b) / 2) && x % 3 === 0) R(2, 14, 12, 2, '#f2f2f2');
        break;
      }
      case T.WALL: {
        if (map.indoor && walkable(x, y + 1) && !(at(x, y + 1) === T.DOOR && (x === 0 || x === map.w - 1))) {
          // 정면으로 보이는 벽: 회벽 + 국방색 허리띠 + 걸레받이
          base('#ece6d4');
          R(0, 0, 16, 1, OUT); R(0, 1, 16, 1, '#8a7a66'); R(0, 2, 16, 1, '#d6cdb6');
          if (x % 2 === 0) R(7, 4, 1, 1, '#dcd4bf');
          R(0, 8, 16, 1, '#56684c'); R(0, 9, 16, 5, '#7d9070'); R(0, 9, 16, 1, '#94a886');
          R(0, 14, 16, 2, '#4a4038'); R(0, 14, 16, 1, '#6a5c50');
        } else if (map.indoor) {
          // 위에서 내려다본 벽 윗면
          base('#3b3442');
          if (walkable(x + 1, y)) { R(13, 0, 2, 16, '#544a5e'); R(15, 0, 1, 16, OUT); }
          if (walkable(x - 1, y)) { R(1, 0, 2, 16, '#544a5e'); R(0, 0, 1, 16, OUT); }
          if (walkable(x, y - 1)) { R(0, 1, 16, 2, '#544a5e'); R(0, 0, 16, 1, OUT); }
        } else {
          base('#8a8478');
          R(0, 0, 16, 1, OUT); R(0, 1, 16, 2, '#aaa496');
          for (let i = 0; i < 2; i++) { R(0, 7 + i * 5, 16, 1, '#6c665c'); R(((i + x) % 2) * 8 + 3, 3 + i * 5, 1, 4, '#6c665c'); }
          R(0, 14, 16, 2, '#5c564e');
        }
        break;
      }
      case T.DOOR:
        if (!map.indoor) break;
        if (walkable(x, y + 1) && !walkable(x, y - 1)) {
          // 위쪽 벽에 난 문: 문짝이 정면으로 보인다
          R(0, 0, 16, 16, OUT);
          R(1, 1, 14, 15, '#6e4826'); R(2, 2, 12, 14, '#a9733f'); R(2, 2, 12, 1, '#cf9a62');
          box(3, 4, 10, 5, '#b88048', '#6e4826'); box(3, 10, 10, 5, '#b88048', '#6e4826');
          R(11, 9, 2, 2, '#f0d060'); R(11, 9, 1, 1, '#fff2a8');
        } else {
          // 아래·옆 벽에 난 문: 문턱과 발매트
          floor();
          const bottomDoor = walkable(x, y - 1) && !walkable(x, y + 1);
          if (bottomDoor) { box(1, 3, 14, 10, '#b04a44', '#5a2424'); R(3, 5, 10, 6, '#d0685c'); R(5, 5, 1, 6, '#b04a44'); R(10, 5, 1, 6, '#b04a44'); }
          else { box(3, 1, 10, 14, '#b04a44', '#5a2424'); R(5, 3, 6, 10, '#d0685c'); R(5, 5, 6, 1, '#b04a44'); R(5, 10, 6, 1, '#b04a44'); }
        }
        break;
      default:
        if (ON_FLOOR.has(t)) floor();
        break;
    }
    // 벽이 바닥에 드리우는 그림자
    if (map.indoor && t !== T.WALL && at(x, y - 1) === T.WALL) R(0, 0, 16, 2, 'rgba(40,24,30,0.2)');
  }

  // ── 2) 물건 (위쪽 타일로 조금 솟아오를 수 있어 바닥을 다 깐 뒤에 그린다) ──
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.tiles[y][x];
    ox = x * TILE; oy = y * TILE;
    const r = hash(x, y);
    const same = (dx: number, dy: number) => at(x + dx, y + dy) === t;
    /** 옆으로 이어 붙는 상판 가구 (책상·식탁·조리대) */
    const slab = (top: string, front: string) => {
      const L = !same(-1, 0), Rt = !same(1, 0), U = !same(0, -1), D = !same(0, 1);
      const y0 = U ? 2 : 0, yb = D ? 15 : 16;
      R(0, y0, 16, yb - y0, top);
      if (U) { R(0, y0, 16, 1, OUT); R(0, y0 + 1, 16, 1, shade(top, 26)); }
      if (D) { R(0, 10, 16, 5, front); R(0, 10, 16, 1, shade(front, -28)); R(0, 14, 16, 1, OUT); R(1, 15, 15, 1, SHADE); }
      if (L) R(0, y0, 1, yb - y0, OUT);
      if (Rt) R(15, y0, 1, yb - y0, OUT);
      if (D && L) R(1, 11, 1, 3, shade(front, -28));
      if (D && Rt) R(14, 11, 1, 3, shade(front, -28));
    };
    switch (t) {
      case T.TREE: {
        const leaf = winter ? '#d8e6e0' : season === 'autumn' ? '#d0782a' : '#2f8a3e';
        const leafHi = winter ? '#ffffff' : season === 'autumn' ? '#eaa648' : '#56b85c';
        const leafLo = winter ? '#a8c0c4' : season === 'autumn' ? '#a4541c' : '#1f6630';
        R(3, 13, 10, 2, SHADE); R(5, 12, 6, 1, SHADE);
        box(6, 7, 4, 8, '#7a5230'); R(7, 8, 1, 6, '#946840');
        const ws = [6, 10, 12, 14, 14, 16, 16, 16, 14, 14, 12, 8];
        ws.forEach((w, i) => R(8 - w / 2, -5 + i, w, 1, OUT));
        ws.forEach((w, i) => { if (i > 0 && i < ws.length - 1) R(9 - w / 2, -5 + i, w - 2, 1, leaf); });
        R(4, -3, 4, 1, leafHi); R(3, -2, 5, 2, leafHi); R(3, 0, 3, 1, leafHi); R(9, -2, 2, 1, leafHi);
        R(9, 3, 5, 2, leafLo); R(6, 4, 7, 1, leafLo); R(11, 1, 3, 2, leafLo); R(3, 3, 2, 1, leafLo);
        break;
      }
      case T.FLOWER: {
        const cols = ['#f25a7a', '#f2d24a', '#ffffff', '#c47af2'];
        for (let i = 0; i < 3; i++) {
          const fx = 2 + i * 5, fy = 3 + ((i * 7 + x * 3 + y) % 8), col = cols[(x + y + i) % cols.length];
          R(fx + 1, fy + 2, 1, 3, '#3f8a44');
          R(fx, fy, 3, 3, OUT); R(fx + 1, fy - 1, 1, 5, OUT); R(fx - 1, fy + 1, 5, 1, OUT);
          R(fx, fy, 3, 3, col); R(fx + 1, fy + 1, 1, 1, '#f0b030');
        }
        break;
      }
      case T.FENCE: {
        const hz = at(x - 1, y) === T.FENCE || at(x + 1, y) === T.FENCE;
        const vt = at(x, y - 1) === T.FENCE || at(x, y + 1) === T.FENCE;
        const m = '#9aa0aa', hi = '#c4cad4', lo = '#5c626c';
        if (hz) { for (const ry of [5, 10]) { R(0, ry - 1, 16, 3, OUT); R(0, ry, 16, 1, hi); } R(0, 6, 16, 4, 'rgba(90,96,108,0.25)'); }
        if (vt) { R(6, 0, 4, 16, OUT); R(7, 0, 2, 16, m); R(7, 0, 1, 16, hi); }
        box(6, 2, 4, 13, m); R(7, 3, 1, 11, hi); R(8, 13, 1, 1, lo); R(6, 1, 4, 1, OUT); R(7, 15, 3, 1, SHADE);
        break;
      }
      case T.BED: {
        const head = !same(0, -1), foot = !same(0, 1);
        // 침상 틀
        R(1, head ? 1 : 0, 14, head || foot ? 15 : 16, OUT);
        if (foot) R(2, 15, 13, 1, SHADE);
        const y0 = head ? 2 : 0, y1 = foot ? 14 : 16;
        R(2, y0, 12, y1 - y0, '#5f7a4c'); // 국방색 모포
        R(2, y0, 1, y1 - y0, '#7a9664'); R(13, y0, 1, y1 - y0, '#44593a');
        if (head) {
          R(2, 2, 12, 2, '#8a8f98'); R(2, 2, 12, 1, '#c4cad4'); // 머리맡 철제 틀
          R(2, 4, 12, 7, '#f4f2ea'); box(3, 5, 10, 5, '#ffffff', '#b4b6c8'); R(4, 8, 8, 1, '#dcdde8'); // 매트리스 + 베개
          R(2, 11, 12, 1, '#e8eada'); R(2, 12, 12, 1, '#44593a');
        } else {
          R(4, 3, 8, 1, '#6e8a58'); R(4, 9, 8, 1, '#44593a');
          if (foot) { R(2, 11, 12, 1, '#44593a'); R(2, 12, 12, 2, '#8a8f98'); R(2, 12, 12, 1, '#c4cad4'); }
        }
        break;
      }
      case T.LOCKER:
        // 관물대: 윗면 + 두 짝 문
        block(1, -3, 14, 18, 5, '#a8865c', '#8a6a44');
        R(8, 3, 1, 11, '#5e4428'); R(2, 3, 1, 11, '#9c7a52'); R(9, 3, 1, 11, '#9c7a52');
        R(6, 8, 1, 2, '#f0d060'); R(10, 8, 1, 2, '#f0d060');
        R(3, 4, 4, 1, '#74583a'); R(10, 4, 4, 1, '#74583a');
        break;
      case T.DESK: {
        slab('#b88a58', '#8e6238');
        if (r > 0.55) { box(3, 4, 6, 5, '#fbfaf4', '#8a8690'); R(4, 6, 4, 1, '#a9abbd'); }
        else if (r > 0.25) { box(9, 4, 4, 5, '#4f7ac8', '#283c6c'); R(10, 5, 2, 1, '#9cb8ec'); }
        if (!same(0, 1)) R(7, 12, 2, 1, '#f0d060');
        break;
      }
      case T.TABLE: {
        slab('#d6b078', '#a8804c');
        if (r > 0.6) { box(4, 4, 8, 5, '#c9ccd8', '#6c7080'); R(5, 5, 2, 2, '#f4f2ea'); R(8, 5, 3, 1, '#e08a4a'); R(8, 7, 2, 1, '#58b058'); }
        break;
      }
      case T.COUNTER:
        slab('#c8d0d8', '#8f98a2');
        if (!same(0, -1)) R(0, 4, 16, 1, '#e6ecf2');
        break;
      case T.PC:
        slab('#b88a58', '#8e6238');
        R(6, 5, 4, 2, '#3a4250'); R(4, 7, 8, 1, OUT);
        box(2, -3, 12, 9, '#525c6e'); R(3, -2, 10, 6, '#5ac0f2'); R(4, -1, 5, 1, '#d8f2ff'); R(4, 1, 7, 1, '#3a98d0');
        box(3, 8, 10, 3, '#e4e6ee', '#6c7080');
        break;
      case T.SHELF: {
        block(1, -4, 14, 19, 4, '#a97448', '#5e3a20');
        const cols = ['#de4a4a', '#f0b030', '#4f7ac8', '#58b058', '#f08838', '#9858d0'];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 4; j++) { const bh = 3 + ((i + j + x) % 2); R(2 + j * 3, 5 + i * 5 - bh, 2, bh, cols[(i * 4 + j + x) % cols.length]); }
          R(2, 5 + i * 5, 12, 1, '#c48e5c');
        }
        R(2, 0, 12, 1, '#3e2614');
        break;
      }
      case T.TV:
        block(1, 6, 14, 9, 4, '#a97448', '#855430');
        R(7, 4, 2, 2, OUT); R(5, 6, 6, 1, OUT);
        box(1, -5, 14, 10, '#3a3a46'); R(2, -4, 12, 8, '#3a78c8'); R(2, -4, 12, 3, '#5a9ae0'); R(3, -3, 4, 1, '#c8e4ff'); R(2, 2, 12, 2, '#2c5c9c'); R(12, 3, 1, 1, '#68f0a0');
        break;
      case T.BOARD:
        // 게시판 (초록 판 + 공지 종이)
        R(1, 14, 14, 1, SHADE);
        box(0, 0, 16, 14, '#b88a58'); box(1, 1, 14, 12, '#4f7a58', '#3a2a1c'); R(2, 2, 12, 1, '#62906a');
        box(3, 3, 5, 5, '#fbfaf4', '#8a8690'); R(4, 5, 3, 1, '#a9abbd'); R(5, 3, 1, 1, '#de4a4a');
        box(9, 4, 4, 6, '#fff2b0', '#8a7038'); R(10, 6, 2, 1, '#a08848'); R(10, 4, 1, 1, '#4f7ac8');
        R(4, 9, 4, 2, '#fbfaf4'); R(4, 9, 1, 1, '#f08838');
        break;
      case T.SOFA: {
        const L = !same(-1, 0), Rt = !same(1, 0);
        R(1, 15, 15, 1, SHADE);
        R(0, 1, 16, 14, OUT);
        R(L ? 1 : 0, 2, 16 - (L ? 1 : 0) - (Rt ? 1 : 0), 5, '#a86478'); R(L ? 1 : 0, 2, 16 - (L ? 1 : 0) - (Rt ? 1 : 0), 1, '#c4849a');
        R(L ? 1 : 0, 7, 16 - (L ? 1 : 0) - (Rt ? 1 : 0), 4, '#8e4c62'); R(L ? 1 : 0, 7, 16 - (L ? 1 : 0) - (Rt ? 1 : 0), 1, '#6c3448');
        R(L ? 1 : 0, 11, 16 - (L ? 1 : 0) - (Rt ? 1 : 0), 3, '#6c3448');
        if (L) { box(0, 5, 4, 10, '#a86478'); R(1, 6, 2, 1, '#c4849a'); }
        if (Rt) { box(12, 5, 4, 10, '#a86478'); R(13, 6, 2, 1, '#c4849a'); }
        if (!L) R(0, 3, 1, 8, '#6c3448');
        break;
      }
      case T.PLANT:
        R(4, 15, 9, 1, SHADE);
        for (const [dx, dy, w, h, col] of [[3, -1, 4, 7, '#3f8f4a'], [9, -2, 4, 8, '#4da858'], [1, 3, 5, 5, '#4da858'], [10, 4, 5, 5, '#3f8f4a'], [6, 1, 4, 8, '#66c070']] as const) {
          R(dx - 1, dy, w + 2, h, OUT); R(dx, dy - 1, w, h + 2, OUT); R(dx, dy, w, h, col); R(dx, dy, 1, 2, '#9be0a0');
        }
        box(4, 8, 8, 7, '#c8683a'); R(5, 9, 6, 1, '#e28a58'); R(5, 13, 6, 1, '#9c4a26');
        break;
      case T.GYM:
        // 벤치 + 바벨
        R(2, 15, 13, 1, SHADE);
        box(4, 6, 8, 8, '#434c5e'); R(5, 7, 6, 2, '#6a7488');
        R(1, 4, 14, 1, OUT); R(1, 5, 14, 1, '#c4cad4'); R(1, 6, 14, 1, OUT);
        box(0, 1, 4, 9, '#4a4a52'); R(1, 2, 1, 7, '#74747e'); box(12, 1, 4, 9, '#4a4a52'); R(13, 2, 1, 7, '#74747e');
        break;
      case T.TARGET:
        R(4, 15, 9, 1, SHADE); box(7, 9, 2, 6, '#7a5230');
        { const ws = [4, 8, 10, 12, 12, 12, 12, 10, 8, 4]; ws.forEach((w, i) => R(8 - w / 2, -1 + i, w, 1, OUT)); ws.forEach((w, i) => { if (i > 0 && i < 9) R(9 - w / 2, -1 + i, w - 2, 1, '#f4f2ea'); }); }
        R(5, 1, 6, 6, '#d03a3a'); R(4, 2, 8, 4, '#d03a3a'); R(6, 2, 4, 4, '#f4f2ea'); R(7, 3, 2, 2, '#d03a3a');
        break;
      case T.SANDBAG:
        R(1, 15, 15, 1, SHADE);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const bx = j * 8 - (i % 2 ? 4 : 0), by = 1 + i * 5;
          for (const k of i % 2 ? [0, 1, 2] : [0, 1]) { const xx = bx + k * 8; if (xx < -2 || xx > 14) continue; const cx = Math.max(0, xx), cw = Math.min(16, xx + 8) - cx; R(cx, by, cw, 5, OUT); R(cx + (xx >= 0 ? 1 : 0), by + 1, cw - (xx >= 0 ? 1 : 0) - (xx + 8 <= 16 ? 1 : 0), 3, '#b8a874'); R(cx + (xx >= 0 ? 1 : 0), by + 1, cw - 2, 1, '#d4c690'); }
        }
        break;
      case T.STAGE: {
        // 구령대: 이어 붙는 단상
        const L = !same(-1, 0), Rt = !same(1, 0), U = !same(0, -1), D = !same(0, 1);
        R(0, U ? 2 : 0, 16, D ? 13 : 16, '#b8a890'); if (U) { R(0, 2, 16, 1, OUT); R(0, 3, 16, 1, '#d4c6b0'); }
        if (D) { R(0, 10, 16, 5, '#8a7c68'); R(0, 10, 16, 1, '#6c5f4e'); R(0, 14, 16, 1, OUT); R(1, 15, 15, 1, SHADE); if (x % 2 === 0) R(7, 11, 1, 3, '#6c5f4e'); }
        if (L) R(0, U ? 2 : 0, 1, 16, OUT); if (Rt) R(15, U ? 2 : 0, 1, 16, OUT);
        break;
      }
      case T.BOOTH: {
        // 초소: 지붕 + 창
        const U = !same(0, -1), D = !same(0, 1), L = !same(-1, 0), Rt = !same(1, 0);
        R(0, 0, 16, 16, '#7a8a6a');
        if (U) { R(0, 0, 16, 5, '#56684c'); R(0, 0, 16, 1, OUT); R(0, 1, 16, 1, '#6e8260'); R(0, 5, 16, 1, OUT); }
        if (D) { R(0, 12, 16, 3, '#5f6f52'); R(0, 15, 16, 1, OUT); }
        if (!U || D) { box(3, U ? 7 : 2, 10, 5, '#a8c8e8', '#3c4a34'); R(4, U ? 8 : 3, 4, 1, '#e0f0ff'); }
        if (L) R(0, 0, 1, 16, OUT); if (Rt) R(15, 0, 1, 16, OUT);
        break;
      }
      case T.HANGAR: {
        const U = !same(0, -1), D = !same(0, 1), L = !same(-1, 0), Rt = !same(1, 0);
        R(0, 0, 16, 16, '#8a929a');
        for (let i = 0; i < 4; i++) { R(0, i * 4, 16, 1, '#a8b0b8'); R(0, i * 4 + 3, 16, 1, '#727a82'); }
        if (U) { R(0, 0, 16, 1, OUT); R(0, 1, 16, 2, '#c0c8d0'); }
        if (D) { R(0, 13, 16, 2, '#5c646c'); R(0, 15, 16, 1, OUT); }
        if (L) R(0, 0, 1, 16, OUT); if (Rt) R(15, 0, 1, 16, OUT);
        break;
      }
      case T.COOLER:
        // 정수기: 물통 + 본체
        R(4, 15, 9, 1, SHADE);
        box(4, -5, 8, 8, '#7ab8e8', '#2c4c74'); R(5, -4, 2, 5, '#b8dcf6'); R(5, -1, 6, 3, '#5a9ad8');
        box(3, 2, 10, 13, '#e8eef4'); R(4, 3, 8, 1, '#ffffff'); R(4, 11, 8, 3, '#c4ccd6');
        R(5, 6, 2, 2, '#3a6aa8'); R(9, 6, 2, 2, '#d04a3a'); R(5, 9, 6, 1, '#8f98a2');
        break;
      case T.WASHER:
        block(1, -1, 14, 16, 4, '#f4f6f8', '#dfe4ea');
        R(2, 4, 12, 1, '#8f98a2'); R(3, 1, 3, 1, '#58c8f0'); R(11, 1, 2, 1, '#de4a4a');
        { const ws = [4, 6, 8, 8, 8, 8, 6, 4]; ws.forEach((w, i) => R(8 - w / 2, 6 + i, w, 1, '#3a4a5a')); const wi = [2, 4, 6, 6, 4, 2]; wi.forEach((w, i) => R(8 - w / 2, 7 + i, w, 1, '#7ab0d8')); }
        R(6, 8, 2, 1, '#d0e8f8');
        break;
      case T.TOILET: {
        // 칸막이 + 양변기
        R(0, 0, 1, 16, OUT); R(1, 0, 1, 16, '#c4ccd6'); R(15, 0, 1, 16, OUT); R(14, 0, 1, 16, '#8f98a2');
        box(4, 0, 8, 5, '#ffffff', '#6c7080'); R(5, 1, 6, 1, '#e4e8f0'); R(10, 2, 1, 1, '#8f98a2');
        const ws = [6, 8, 10, 10, 10, 10, 8, 6]; ws.forEach((w, i) => R(8 - w / 2, 5 + i, w, 1, '#6c7080'));
        const wi = [4, 6, 8, 8, 8, 8, 6, 4]; wi.forEach((w, i) => { if (i > 0 && i < 7) R(8 - w / 2, 5 + i, w, 1, '#ffffff'); });
        R(6, 7, 4, 3, '#a8d0e8'); R(5, 8, 6, 1, '#a8d0e8'); R(6, 7, 2, 1, '#d8eefa');
        R(4, 13, 9, 1, SHADE);
        break;
      }
      case T.SINK:
        slab('#f4f6f8', '#c4ccd6');
        { const ws = [8, 10, 10, 8]; ws.forEach((w, i) => R(8 - w / 2, 4 + i, w, 1, '#8f98a2')); R(4, 5, 8, 2, '#a8d0e8'); R(5, 5, 3, 1, '#d8eefa'); }
        R(7, 1, 2, 4, '#6c7080'); R(7, 1, 2, 1, '#c4ccd6'); R(6, 3, 4, 1, '#6c7080');
        // 거울
        box(3, -9, 10, 8, '#bfe4f4', '#6c7080'); R(5, -7, 1, 4, '#ffffff');
        break;
      case T.STOVE:
        slab('#6a7078', '#4a5058');
        box(3, 3, 10, 7, '#2a2e34'); R(5, 5, 6, 3, '#4a4f58'); R(6, 6, 4, 1, '#f08838');
        box(4, -3, 8, 6, '#c4ccd6', '#4a5058'); R(5, -2, 6, 1, '#f4f6f8'); R(2, -1, 2, 1, OUT); R(12, -1, 2, 1, OUT);
        R(3, 12, 2, 1, '#de4a4a'); R(7, 12, 2, 1, '#c4ccd6'); R(11, 12, 2, 1, '#c4ccd6');
        break;
      case T.HOOP: {
        const top = y === runOf(map, x, y, [T.COURT, T.HOOP])[0];
        R(7, top ? 0 : 8, 2, 8, '#6a6a6a'); R(7, top ? 0 : 8, 1, 8, '#9a9aa2');
        box(2, 4, 12, 8, '#ffffff', '#3a3a44'); box(5, 6, 6, 4, '#ffffff', '#d04a2a');
        R(5, top ? 12 : 3, 6, 1, '#f08838'); R(6, top ? 13 : 2, 4, 1, '#e8e8f0');
        break;
      }
      case T.BIN: {
        const col = BIN_COLORS[x % BIN_COLORS.length];
        R(3, 15, 11, 1, SHADE);
        box(2, 3, 12, 12, col); R(3, 4, 1, 10, shade(col, 34)); R(12, 4, 1, 10, shade(col, -34)); R(3, 12, 10, 2, shade(col, -34));
        box(1, 1, 14, 4, shade(col, 26)); R(2, 2, 12, 1, shade(col, 60));
        box(5, 7, 6, 4, '#f4f2ea', shade(col, -60));
        break;
      }
      case T.AMMO: {
        // 흙을 덮은 벙커 + 가운데 아래쪽에 철문
        R(0, 0, 16, 16, '#6a7a52');
        if (r > 0.4) { R(Math.floor(r * 10) + 1, 3, 4, 1, '#84966a'); R(Math.floor(r * 8) + 3, 9, 3, 1, '#566644'); }
        if (!same(0, -1)) { R(0, 0, 16, 1, OUT); R(0, 1, 16, 1, '#84966a'); }
        if (!same(-1, 0)) R(0, 0, 1, 16, OUT); if (!same(1, 0)) R(15, 0, 1, 16, OUT);
        if (!same(0, 1)) {
          R(0, 11, 16, 4, '#8a8e7a'); R(0, 11, 16, 1, '#a8ac98'); R(0, 15, 16, 1, OUT);
          let l = x, rr = x;
          while (map.tiles[y][l - 1] === T.AMMO) l--;
          while (map.tiles[y][rr + 1] === T.AMMO) rr++;
          if (x === Math.floor((l + rr) / 2)) { box(2, 2, 12, 13, '#4a5058'); R(3, 3, 10, 1, '#6c737c'); R(7, 3, 1, 11, '#2e3238'); box(3, 0, 10, 3, '#e8c040', '#5c4a10'); R(9, 8, 2, 2, '#c4cad4'); }
        }
        break;
      }
    }
  }

  // ── 3) 건물 외관 (지붕 + 정면 벽 + 문) ──
  const G = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  for (const b of map.buildings) {
    const x0 = b.x0 * TILE, y0 = b.y0 * TILE, wpx = (b.x1 - b.x0 + 1) * TILE;
    const facadeTop = (b.y1 - 1) * TILE;
    const bottom = (b.y1 + 1) * TILE;
    G(x0 + 6, y0 + 8, wpx, bottom - y0, 'rgba(0,0,0,0.18)');
    // 정면 벽
    G(x0, facadeTop, wpx, bottom - facadeTop, OUT);
    G(x0 + P, facadeTop, wpx - 2 * P, bottom - facadeTop - P, '#ece2c8');
    G(x0 + P, bottom - 8 * P, wpx - 2 * P, 7 * P, '#7d9070'); G(x0 + P, bottom - 8 * P, wpx - 2 * P, P, '#56684c');
    G(x0 + P, bottom - 3 * P, wpx - 2 * P, 2 * P, '#5c564e');
    for (let x = b.x0; x <= b.x1; x++) {
      if (b.door.some(([dx]) => dx === x) || x === b.x0 || x === b.x1) continue;
      if ((x - b.x0) % 2 === 1) {
        const wx = x * TILE + 2 * P, wy = facadeTop + 5 * P;
        G(wx, wy, 12 * P, 11 * P, OUT); G(wx + P, wy + P, 10 * P, 9 * P, '#6a9cc8');
        G(wx + P, wy + P, 10 * P, 3 * P, '#a8d0f0'); G(wx + 2 * P, wy + 2 * P, 3 * P, P, '#e8f6ff');
        G(wx + 5 * P + P / 2, wy + P, P, 9 * P, '#f4f2ea'); G(wx + P, wy + 5 * P, 10 * P, P, '#f4f2ea');
        G(wx - P, wy + 11 * P, 14 * P, P, OUT); G(wx - P, wy + 10 * P, 14 * P, P, '#c4cad4');
      }
    }
    const dx0 = Math.min(...b.door.map((d) => d[0])) * TILE;
    const dx1 = (Math.max(...b.door.map((d) => d[0])) + 1) * TILE;
    const dTop = facadeTop + 6 * P;
    G(dx0 + P, dTop, dx1 - dx0 - 2 * P, bottom - dTop, OUT);
    G(dx0 + 2 * P, dTop + P, dx1 - dx0 - 4 * P, bottom - dTop - P, '#6e4826');
    G(dx0 + 3 * P, dTop + 2 * P, dx1 - dx0 - 6 * P, bottom - dTop - 3 * P, '#a9733f');
    G(dx0 + 3 * P, dTop + 2 * P, dx1 - dx0 - 6 * P, P, '#cf9a62');
    G((dx0 + dx1) / 2 - P / 2, dTop + 2 * P, P, bottom - dTop - 3 * P, '#6e4826');
    G(dx1 - 6 * P, dTop + 12 * P, 2 * P, 2 * P, '#f0d060');
    G(dx0, bottom - P, dx1 - dx0, P, '#8a8478');
    // 지붕: 기왓장 줄무늬 + 처마 그림자
    const roofBottom = facadeTop + 2 * P;
    const rx = x0 - 2 * P, rw = wpx + 4 * P;
    G(rx, y0, rw, roofBottom - y0, OUT);
    G(rx + P, y0 + P, rw - 2 * P, roofBottom - y0 - 2 * P, b.roof);
    G(rx + P, y0 + P, rw - 2 * P, P, shade(b.roof, 40));
    for (let yy = y0 + 6 * P, i = 0; yy < roofBottom - 4 * P; yy += 6 * P, i++) {
      G(rx + P, yy, rw - 2 * P, P, shade(b.roof, -28));
      for (let xx = rx + P + (i % 2 ? 8 * P : 0); xx < rx + rw - 2 * P; xx += 16 * P) G(xx, yy - 5 * P, P, 5 * P, shade(b.roof, -18));
    }
    G(rx + P, roofBottom - 4 * P, rw - 2 * P, 3 * P, shade(b.roof, -48));
    G(rx + P, roofBottom - 4 * P, rw - 2 * P, P, shade(b.roof, -70));
    if (winter) {
      const sh = Math.min(13 * P, Math.floor((roofBottom - y0) * 0.4 / P) * P);
      G(rx + P, y0 + P, rw - 2 * P, sh, '#f8fbff');
      for (let xx = rx + 3 * P; xx < rx + rw - 6 * P; xx += 9 * P) G(xx, y0 + P + sh, 5 * P, 2 * P + ((xx / P) % 2) * P, '#f8fbff');
      G(rx + P, y0 + P + sh - P, rw - 2 * P, P, '#d4e2ee');
    }
    // 현판
    g.font = 'bold 15px "Galmuri11", sans-serif';
    g.textAlign = 'center';
    const tw = Math.ceil((g.measureText(b.name).width + 20) / (2 * P)) * 2 * P;
    const cx = x0 + wpx / 2, cy = Math.round((y0 + roofBottom) / 2 / P) * P;
    G(cx - tw / 2, cy - 7 * P, tw, 13 * P, OUT);
    G(cx - tw / 2 + P, cy - 6 * P, tw - 2 * P, 11 * P, '#f8f4e4');
    G(cx - tw / 2 + 2 * P, cy - 5 * P, tw - 4 * P, 9 * P, '#3a5a40');
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
    // 안내판: 검은 테두리 + 흰 띠 + 색 판 (실내 남색 / 야외 초록)
    const ph = map.indoor ? 14 : 18, pw = Math.ceil(tw / 2) * 2;
    const pxl = Math.round((lx - pw / 2) / 2) * 2, pyl = Math.round((cy - 10) / 2) * 2;
    g.fillStyle = OUT; g.fillRect(pxl - 4, pyl - 4, pw + 8, ph + 8);
    g.fillStyle = '#f8f4e4'; g.fillRect(pxl - 2, pyl - 2, pw + 4, ph + 4);
    g.fillStyle = map.indoor ? '#34467e' : '#2f6a3c';
    g.fillRect(pxl, pyl, pw, ph);
    g.fillStyle = '#ffffff';
    g.fillText(d.sign, lx, cy + (map.indoor ? 2 : 3));
  }
  return c;
}
