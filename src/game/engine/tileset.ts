/**
 * 타일셋(그림 파일) 방식 맵 렌더러 — 시제품, 실내·야외 맵 전체를 지원한다.
 *
 * 맵 데이터(T 격자 · 문 · 스팟 · 충돌)는 map.ts 그대로 두고 "그리는 부분"만 바꾼다.
 * 그림은 public/tiles/barracks.png 한 장(16px 격자 원본 도트)에 모여 있고,
 * 조각 위치는 data/tilesets/barracks.json에 있다 (둘 다 `npm run tiles`로 만든다).
 */
import manifest from '../data/tilesets/barracks.json';
import type { Season } from '../types';
import { T, TILE, drawDoorSigns, drawOutdoorExtras, type GameMap, type MapId } from './map';

type SpriteName = keyof typeof manifest.sprites;
const SPR = manifest.sprites as Record<SpriteName, { x: number; y: number; w: number; h: number; ox: number; oy: number }>;
const CELL = manifest.tile;

let atlasPromise: Promise<HTMLImageElement> | null = null;
/** 아틀라스 그림을 한 번만 불러온다 */
export function loadTileAtlas(): Promise<HTMLImageElement> {
  atlasPromise ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { atlasPromise = null; reject(new Error('타일 아틀라스를 불러오지 못했습니다')); };
    // 주소에 그림 버전을 붙인다 (next.config.mjs): 오래 캐시해 두어도 그림이 바뀌면 새로 받는다
    img.src = process.env.NEXT_PUBLIC_ASSET_V ? `${manifest.image}?v=${process.env.NEXT_PUBLIC_ASSET_V}` : manifest.image;
  });
  return atlasPromise;
}

/** 이 타일셋에 그림이 준비된 타일 종류 */
const SUPPORTED = new Set<T>([
  T.FLOOR, T.WALL, T.DOOR, T.BED, T.LOCKER, T.TV, T.BOARD,
  T.DESK, T.TABLE, T.COUNTER, T.PC, T.SHELF, T.PLANT, T.STAIRS, T.SOFA,
  T.COOLER, T.WASHER, T.TOILET, T.SINK, T.STOVE, T.CRATE, T.FOODCART, T.GYM,
]);

/** 야외 맵에 나오는 타일 종류 */
const OUTDOOR = new Set<T>([
  T.GRASS, T.ROAD, T.SAND, T.TREE, T.FENCE, T.WATER, T.PIER, T.RUNWAY, T.TARGET, T.SANDBAG, T.SHIP, T.BOOTH, T.STAGE,
  T.DIRT, T.FLOWER, T.HANGAR, T.ROOF, T.DOOR, T.COURT, T.HOOP, T.BIN, T.AMMO, T.CAIRN, T.GYM,
]);
type Ground = 'grass' | 'road' | 'sand' | 'dirt' | 'court' | 'water' | 'pier' | 'runway';
/** 그 타일 밑에 깔리는 땅 */
function groundOf(t: T | undefined): Ground {
  switch (t) {
    case T.ROAD: case T.BIN: case T.BOOTH: case T.HANGAR: case T.DOOR: case T.ROOF: return 'road';
    case T.SAND: case T.STAGE: return 'sand';
    case T.DIRT: case T.TARGET: case T.SANDBAG: case T.AMMO: case T.GYM: return 'dirt';
    case T.COURT: case T.HOOP: return 'court';
    case T.WATER: case T.SHIP: return 'water';
    case T.PIER: return 'pier';
    case T.RUNWAY: return 'runway';
    default: return 'grass';
  }
}
const ROOF_KIND: Record<string, string> = { '#5a7a4a': 'green', '#a0503a': 'red', '#c08a3a': 'orange' };

/** 맵별 바닥 무늬와 색조 (같은 무늬도 방마다 살짝 다른 빛깔로) */
const FLOORS: Partial<Record<MapId, { spr: SpriteName; tint?: string }>> = {
  room1: { spr: 'floor' }, room2: { spr: 'floor' },
  lounge: { spr: 'floor', tint: 'rgba(255,190,110,0.10)' },
  gymroom: { spr: 'floor', tint: 'rgba(120,70,20,0.10)' },
  library: { spr: 'floor', tint: 'rgba(90,50,20,0.14)' },
  hq1: { spr: 'floor_lino_green' }, hq2: { spr: 'floor_lino_green' },
  admin: { spr: 'floor_lino_gray' },
  command: { spr: 'floor_lino_gray', tint: 'rgba(40,60,90,0.16)' },
  cyber: { spr: 'floor_lino_gray', tint: 'rgba(80,120,180,0.10)' },
  wc1: { spr: 'floor_tile_cool' }, wc2: { spr: 'floor_tile_cool' },
  laundry1: { spr: 'floor_tile_cool', tint: 'rgba(120,150,200,0.07)' }, laundry2: { spr: 'floor_tile_cool', tint: 'rgba(120,150,200,0.07)' },
  kitchen: { spr: 'floor_tile_cool', tint: 'rgba(150,160,140,0.12)' },
  mess: { spr: 'floor_tile_warm' },
  px: { spr: 'floor_tile_warm', tint: 'rgba(220,170,90,0.10)' },
  maint: { spr: 'floor_concrete' },
  ammoroom: { spr: 'floor_concrete', tint: 'rgba(60,70,40,0.10)' },
};
/** 물 쓰는 방: 벽이 타일이다 */
const WET = new Set<MapId>(['wc1', 'wc2', 'laundry1', 'laundry2', 'kitchen']);
const SHELF_KIND: Partial<Record<MapId, SpriteName>> = {
  px: 'shelf_goods', lounge: 'shelf_goods', maint: 'shelf_tools', kitchen: 'shelf_tools', laundry1: 'shelf_tools', laundry2: 'shelf_tools',
};
/** 이어 붙는 상판 가구 */
const SLAB: Partial<Record<T, string>> = {
  [T.DESK]: 'desk', [T.PC]: 'desk', [T.TABLE]: 'table', [T.COUNTER]: 'counter', [T.SINK]: 'sink', [T.STOVE]: 'stove',
};

const at = (map: GameMap, x: number, y: number): T | undefined => map.tiles[y]?.[x];
const walkable = (map: GameMap, x: number, y: number) => { const v = at(map, x, y); return v !== undefined && v !== T.WALL; };
/** 정면이 보이는 벽 (바로 아래가 방 안). 옆벽에 난 문 위의 벽은 윗면으로 본다 */
const isFace = (map: GameMap, x: number, y: number) =>
  at(map, x, y) === T.WALL && walkable(map, x, y + 1) && !(at(map, x, y + 1) === T.DOOR && (x === 0 || x === map.w - 1));
/** 위쪽 벽에 난 문 (문짝이 정면으로 보인다) */
const isTopDoor = (map: GameMap, x: number, y: number) => at(map, x, y) === T.DOOR && walkable(map, x, y + 1) && !walkable(map, x, y - 1);

/** 타일셋으로 그릴 수 있는 맵인가 (모르는 타일이 하나라도 있으면 기존 방식으로 그린다) */
export function supportsTileset(map: GameMap): boolean {
  if (map.indoor && !FLOORS[map.id]) return false;
  const ok = map.indoor ? SUPPORTED : OUTDOOR;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (!ok.has(map.tiles[y][x])) return false;
  return true;
}

function hash(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function renderTilesetMap(map: GameMap, atlas: HTMLImageElement, season: Season): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = map.w * TILE;
  c.height = map.h * TILE;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const S = TILE / CELL; // 원본 1px이 맵 캔버스에서 차지하는 크기

  /** 타일 (tx, ty) 자리에 조각을 그린다 */
  const put = (name: SpriteName | string, tx: number, ty: number) => {
    const s = SPR[name as SpriteName];
    if (!s) return;
    // 바로 아래가 벽이면 타일 밖으로 떨어지는 그림자를 자른다 (벽 윗면에 바닥 그림자가 지면 어색하다)
    const h = at(map, tx, ty + 1) === T.WALL && at(map, tx, ty) !== T.WALL ? Math.min(s.h, CELL - s.oy) : s.h;
    g.drawImage(atlas, s.x, s.y, s.w, h, (tx * CELL + s.ox) * S, (ty * CELL + s.oy) * S, s.w * S, h * S);
  };
  const shade = (tx: number, ty: number, x: number, y: number, w: number, h: number, a: number) => {
    g.fillStyle = `rgba(48,28,30,${a})`;
    g.fillRect((tx * CELL + x) * S, (ty * CELL + y) * S, w * S, h * S);
  };

  if (!map.indoor) {
    renderOutdoor(map, atlas, season, g, put);
    drawOutdoorExtras(g, map);
    drawDoorSigns(g, map);
    return c;
  }

  // ── 1) 바닥 · 벽 · 문 ──
  const fl = FLOORS[map.id] ?? { spr: 'floor' as SpriteName };
  const floor = SPR[fl.spr], fw = floor.w / CELL, fh = floor.h / CELL;
  const wet = WET.has(map.id);
  let freeWall = 0; // 장식을 걸 수 있는 빈 벽 순번
  let clockHung = false;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.tiles[y][x];
    if (t === T.WALL) {
      if (isFace(map, x, y)) {
        put(wet ? 'wall_face_tile' : hash(x, y) > 0.5 ? 'wall_face_a' : 'wall_face_b', x, y);
        // 가구가 가리지 않는 벽에만 장식: 문 옆에는 스위치, 나머지는 액자 · 시계 · 포스터 · 표지를 번갈아
        if (!wet && at(map, x, y + 1) === T.FLOOR) {
          if (at(map, x - 1, y) === T.DOOR) put('decor_switch', x, y);
          else if (at(map, x + 1, y) !== T.DOOR) {
            const k = freeWall++ % 6;
            if (k === 0) put('decor_frame', x, y);
            else if (k === 2) { put(clockHung ? 'decor_poster' : 'decor_clock', x, y); clockHung = true; }
            else if (k === 4) put('decor_sign', x, y);
          }
        }
      } else {
        put('wtop', x, y);
        // 방 쪽(또는 정면 벽 쪽) 가장자리에 띠를 두른다
        const open = (dx: number, dy: number) => walkable(map, x + dx, y + dy) || isFace(map, x + dx, y + dy);
        const e = open(1, 0), w = open(-1, 0), n = open(0, -1), s = walkable(map, x, y + 1);
        if (e) put('wtop_e', x, y);
        if (w) put('wtop_w', x, y);
        if (n) put('wtop_n', x, y);
        if (s) put('wtop_s', x, y);
        if (!e && !n && open(1, -1)) put('wtop_ne', x, y);
        if (!w && !n && open(-1, -1)) put('wtop_nw', x, y);
        if (!e && !s && walkable(map, x + 1, y + 1)) put('wtop_se', x, y);
        if (!w && !s && walkable(map, x - 1, y + 1)) put('wtop_sw', x, y);
      }
      continue;
    }
    if (isTopDoor(map, x, y)) {
      const l = at(map, x - 1, y) === T.DOOR, r = at(map, x + 1, y) === T.DOOR;
      put(r && !l ? 'door_l' : l && !r ? 'door_r' : 'door_single', x, y);
      continue;
    }
    if (t === T.STAIRS) { put('stairs', x, y); continue; }
    // 바닥: 4x4 타일짜리 큰 무늬를 이어 깐다 (가구 밑에도 바닥이 있다)
    g.drawImage(atlas, floor.x + (x % fw) * CELL, floor.y + (y % fh) * CELL, CELL, CELL, x * TILE, y * TILE, TILE, TILE);
    if (fl.tint) { g.fillStyle = fl.tint; g.fillRect(x * TILE, y * TILE, TILE, TILE); }
    if (t === T.DOOR) {
      // 아래·옆 벽에 난 문: 발매트 + 바깥쪽으로 어두워지는 문턱
      if (walkable(map, x, y - 1) && !walkable(map, x, y + 1)) { put('mat_h', x, y); shade(x, y, 0, 14, CELL, 2, 0.3); }
      else if (!walkable(map, x - 1, y)) { put('mat_v', x, y); shade(x, y, 0, 0, 2, CELL, 0.3); }
      else { put('mat_v', x, y); shade(x, y, 14, 0, 2, CELL, 0.3); }
      continue;
    }
    // 벽이 바닥에 드리우는 그림자 (빛은 왼쪽 위)
    if (!walkable(map, x, y - 1)) { shade(x, y, 0, 0, CELL, 2, 0.26); shade(x, y, 0, 2, CELL, 1, 0.12); }
    if (at(map, x - 1, y) === T.WALL) { shade(x, y, 0, 0, 1, CELL, 0.2); shade(x, y, 1, 0, 1, CELL, 0.09); }
  }

  // ── 2) 가구 (위로 솟는 그림이 윗줄을 덮도록 위에서 아래로) ──
  const barracks = map.id === 'room1' || map.id === 'room2';
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.tiles[y][x];
    const same = (dx: number, dy: number) => at(map, x + dx, y + dy) === t;
    const r = ((x * 7 + y * 13) % 10) / 10 + hash(x + 5, y + 11) * 0.1; // 이웃끼리 겹치지 않게 섞는다
    const slab = SLAB[t];
    if (slab) {
      const mask = (same(-1, 0) ? 0 : 1) | (same(1, 0) ? 0 : 2) | (same(0, -1) ? 0 : 4) | (same(0, 1) ? 0 : 8);
      put(`${slab}_${mask}`, x, y);
      if (t === T.DESK) { if (r > 0.7) put('desk_paper', x, y); else if (r > 0.45) put('desk_book', x, y); else if (r > 0.3) put('desk_phone', x, y); }
      else if (t === T.TABLE) { if (r > 0.6) put('table_tray', x, y); }
      else if (t === T.PC) put((x + y) % 2 ? 'pc_top_a' : 'pc_top_b', x, y);
      else if (t === T.SINK) { put('sink_top', x, y); if (map.id === 'wc1' || map.id === 'wc2') put('mirror', x, y); }
      else if (t === T.STOVE) put(x % 2 ? 'stove_top_b' : 'stove_top_a', x, y);
      continue;
    }
    switch (t) {
      case T.BED:
        put(!same(0, -1) ? 'bed_head' : !same(0, 1) ? 'bed_foot' : 'bed_mid', x, y);
        // 발치가 통로 쪽이면 전투화 한 켤레를 가지런히 둔다 (장식일 뿐 길은 막지 않는다)
        if (!same(0, 1) && at(map, x, y + 1) === T.FLOOR) put('boots', x, y + 1);
        break;
      case T.LOCKER:
        put(barracks ? (r > 0.7 ? 'locker_b' : r > 0.4 ? 'locker_c' : 'locker_a') : 'cabinet', x, y);
        break;
      case T.TV: put('tv', x, y); break;
      case T.BOARD: put(map.id === 'command' ? 'board_map' : 'board', x, y); break;
      case T.SHELF: put(SHELF_KIND[map.id] ?? 'shelf_books', x, y); break;
      case T.PLANT: put('plant', x, y); break;
      case T.SOFA: { const L = !same(-1, 0), R = !same(1, 0); put(L && R ? 'sofa_single' : L ? 'sofa_l' : R ? 'sofa_r' : 'sofa_m', x, y); break; }
      case T.COOLER: put('cooler', x, y); break;
      case T.WASHER: put(x % 2 ? 'washer' : 'dryer', x, y); break;
      case T.TOILET: put('toilet', x, y); break;
      case T.CRATE: put(r > 0.7 ? 'crate_b' : 'crate_a', x, y); break;
      case T.GYM: put(x % 4 === 0 ? 'gym_rack' : 'gym_bench', x, y); break;
      case T.FOODCART: {
        const L = !same(-1, 0), R = !same(1, 0);
        put(L && R ? 'foodcart_single' : L ? 'foodcart_l' : R ? 'foodcart_r' : 'foodcart_m', x, y);
        let l = x;
        while (at(map, l - 1, y) === T.FOODCART) l--;
        put((x - l) % 2 ? 'foodcart_pans_b' : 'foodcart_pans_a', x, y);
        break;
      }
    }
  }

  drawDoorSigns(g, map);
  return c;
}

/** 야외: 계절별 땅 → 경계(풀 번짐 · 물가 · 경기장 선) → 나무 · 시설 → 건물 외관 */
function renderOutdoor(
  map: GameMap, atlas: HTMLImageElement, season: Season, g: CanvasRenderingContext2D,
  put: (name: string, tx: number, ty: number) => void,
) {
  const S = TILE / CELL;
  const winter = season === 'winter';
  /** 원본 픽셀 좌표로 사각형 · 조각을 그린다 */
  const nr = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x * S, y * S, w * S, h * S); };
  const blit = (name: string, nx: number, ny: number) => {
    const s = SPR[name as SpriteName];
    if (s) g.drawImage(atlas, s.x, s.y, s.w, s.h, nx * S, ny * S, s.w * S, s.h * S);
  };
  const gr = (x: number, y: number) => groundOf(at(map, x, y));
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h;
  const texOf = (k: Ground): string =>
    k === 'grass' ? `grass_${season}` : k === 'road' || k === 'sand' || k === 'dirt' ? (winter ? `${k}_winter` : k) : k;
  /** 같은 땅이 세로로 이어진 범위 */
  const runOf = (x: number, y: number, k: Ground): [number, number] => {
    let a = y, b = y;
    while (inMap(x, a - 1) && gr(x, a - 1) === k) a--;
    while (inMap(x, b + 1) && gr(x, b + 1) === k) b++;
    return [a, b];
  };
  const DIRS: [string, number, number][] = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
  const DIAG: [string, number, number][] = [['ne', 1, -1], ['se', 1, 1], ['sw', -1, 1], ['nw', -1, -1]];

  // ── 1) 땅 ──
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const k = gr(x, y);
    if (k === 'pier') put('pier', x, y);
    else {
      const s = SPR[texOf(k) as SpriteName], fw = s.w / CELL, fh = s.h / CELL;
      g.drawImage(atlas, s.x + (x % fw) * CELL, s.y + (y % fh) * CELL, CELL, CELL, x * TILE, y * TILE, TILE, TILE);
    }
    const X = x * CELL, Y = y * CELL;
    const is = (dx: number, dy: number, want: Ground) => inMap(x + dx, y + dy) && gr(x + dx, y + dy) === want;
    if (k === 'road' || k === 'sand' || k === 'dirt') {
      // 풀이 길 위로 번진다
      for (const [d, dx, dy] of DIRS) if (is(dx, dy, 'grass')) put(`fringe_${season}_${d}`, x, y);
      for (const [d, dx, dy] of DIAG) if (is(dx, dy, 'grass') && !is(dx, 0, 'grass') && !is(0, dy, 'grass')) put(`fringe_${season}_${d}`, x, y);
    } else if (k === 'water') {
      for (const [d, dx, dy] of DIRS) if (inMap(x + dx, y + dy) && gr(x + dx, y + dy) !== 'water' && gr(x + dx, y + dy) !== 'pier') put(`shore_${d}`, x, y);
    } else if (k === 'pier') {
      if (is(-1, 0, 'water')) nr(X, Y, 1, CELL, '#3a2412');
      if (is(1, 0, 'water')) nr(X + 15, Y, 1, CELL, '#3a2412');
      if (is(0, 1, 'water')) nr(X, Y + 15, CELL, 1, '#3a2412');
    } else if (k === 'court') {
      const line = '#f4ece0';
      if (!is(-1, 0, 'court')) nr(X, Y, 1, CELL, line);
      if (!is(1, 0, 'court')) nr(X + 15, Y, 1, CELL, line);
      if (!is(0, -1, 'court')) nr(X, Y, CELL, 1, line);
      if (!is(0, 1, 'court')) nr(X, Y + 15, CELL, 1, line);
      const [a, b] = runOf(x, y, 'court');
      if (y === Math.floor((a + b) / 2)) nr(X, Y + 7, CELL, 1, line);
    } else if (k === 'runway') {
      const [a, b] = runOf(x, y, 'runway');
      if (y === a) nr(X, Y, CELL, 2, '#e8d24a');
      if (y === b) nr(X, Y + 14, CELL, 2, '#e8d24a');
      if (y === Math.floor((a + b) / 2) && x % 3 === 0) nr(X + 2, Y + 14, 12, 2, '#f2f2f2');
    }
  }

  // ── 2) 건물 외관 (지붕 + 정면 벽 + 현관). 건물 앞에 선 나무가 벽을 가리도록 나무보다 먼저 그린다 ──
  const OUT = '#181018';
  for (const b of map.buildings) {
    const X0 = b.x0 * CELL, Y0 = b.y0 * CELL, W = (b.x1 - b.x0 + 1) * CELL;
    const facadeTop = (b.y1 - 1) * CELL, bottom = (b.y1 + 1) * CELL, roofBottom = facadeTop + 2;
    nr(X0 + 3, Y0 + 4, W, bottom - Y0, 'rgba(0,0,0,0.18)');
    // 정면 벽: 한 칸 건너 창
    const isDoor = (x: number) => b.door.some(([dx]) => dx === x);
    for (let x = b.x0; x <= b.x1; x++) blit(!isDoor(x) && x !== b.x0 && x !== b.x1 && (x - b.x0) % 2 === 1 ? 'facade_win' : 'facade', x * CELL, facadeTop);
    nr(X0, facadeTop, 1, 32, OUT); nr(X0 + W - 1, facadeTop, 1, 32, OUT);
    const dMin = Math.min(...b.door.map((d) => d[0]));
    for (const [dx] of b.door) blit(dx === dMin ? 'bdoor_l' : 'bdoor_r', dx * CELL, facadeTop + 6);
    // 지붕: 기와 무늬를 깔고 테두리 · 처마를 두른다
    const kind = ROOF_KIND[b.roof] ?? 'green';
    const rx = X0 - 2, rw = W + 4, rh = roofBottom - Y0;
    g.save();
    g.beginPath(); g.rect(rx * S, Y0 * S, rw * S, rh * S); g.clip();
    for (let yy = Y0; yy < roofBottom; yy += CELL) for (let xx = rx; xx < rx + rw; xx += CELL) blit(`roof_${kind}`, xx, yy);
    for (let xx = rx; xx < rx + rw; xx += CELL) blit(`eave_${kind}`, xx, roofBottom - 5);
    if (winter) {
      const sh = Math.min(13, Math.floor(rh * 0.4));
      g.save();
      g.beginPath(); g.rect(rx * S, Y0 * S, rw * S, (sh + 1) * S); g.clip();
      for (let xx = rx; xx < rx + rw; xx += CELL) blit('roof_snow', xx, Y0);
      g.restore();
      for (let xx = rx; xx < rx + rw; xx += CELL) blit('roof_snow_edge', xx, Y0 + 1 + sh);
    }
    nr(rx, Y0, rw, 1, OUT); nr(rx, Y0, 1, rh, OUT); nr(rx + rw - 1, Y0, 1, rh, OUT);
    g.restore();
    // 현판
    g.font = 'bold 15px "Galmuri11", sans-serif';
    g.textAlign = 'center';
    const tw = Math.ceil((g.measureText(b.name).width + 20) / (2 * S)) * 2;
    const cx = X0 + W / 2, cy = Math.round((Y0 + roofBottom) / 2);
    nr(cx - tw / 2, cy - 7, tw, 13, OUT);
    nr(cx - tw / 2 + 1, cy - 6, tw - 2, 11, '#f8f4e4');
    nr(cx - tw / 2 + 2, cy - 5, tw - 4, 9, '#3a5a40');
    g.fillStyle = '#fff6dc'; g.fillText(b.name, cx * S, cy * S + 5);
  }

  // ── 3) 나무 · 시설 (위에서 아래로) ──
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.tiles[y][x];
    const same = (dx: number, dy: number) => at(map, x + dx, y + dy) === t;
    const mask = (same(-1, 0) ? 0 : 1) | (same(1, 0) ? 0 : 2) | (same(0, -1) ? 0 : 4) | (same(0, 1) ? 0 : 8);
    const bunk = (dx: number, dy: number) => { const v = at(map, x + dx, y + dy); return v === T.AMMO || v === T.DOOR; };
    switch (t) {
      case T.TREE: put(`tree_${season}`, x, y); break;
      case T.FLOWER: if (!winter) put((x + y) % 2 ? 'flower_a' : 'flower_b', x, y); break;
      case T.FENCE:
        if (at(map, x - 1, y) === T.FENCE || at(map, x + 1, y) === T.FENCE) put('fence_rails', x, y);
        if (at(map, x, y - 1) === T.FENCE || at(map, x, y + 1) === T.FENCE) put('fence_vbar', x, y);
        put('fence_post', x, y);
        break;
      case T.TARGET: put('target', x, y); break;
      case T.SANDBAG: put('sandbag', x, y); break;
      case T.STAGE: put(`stage_${mask}`, x, y); break;
      case T.BOOTH: put(`booth_${mask}`, x, y); break;
      case T.HANGAR: put(`hangar_${mask}`, x, y); break;
      case T.HOOP: put(y === runOf(x, y, 'court')[0] ? 'hoop_top' : 'hoop_bot', x, y); break;
      case T.CAIRN: put(same(0, 1) ? 'cairn_top' : 'cairn_bot', x, y); break;
      case T.BIN: put(`bin_${x % 6}`, x, y); break;
      case T.GYM: put('gym_bench', x, y); break;
      case T.AMMO: {
        const front = !bunk(0, 1);
        put(`bunker_${(bunk(-1, 0) ? 0 : 1) | (bunk(1, 0) ? 0 : 2) | (same(0, -1) ? 0 : 4) | (front ? 8 : 0)}`, x, y);
        if (front) {
          let l = x, r = x;
          while (bunk(l - x - 1, 0)) l--;
          while (bunk(r - x + 1, 0)) r++;
          if (x === Math.floor((l + r) / 2)) put('bunker_door', x, y);
        }
        break;
      }
      case T.DOOR:
        // 탄약고 벙커의 철문 (건물 문은 건물 외관이 덮어 그린다)
        if (at(map, x - 1, y) === T.AMMO || at(map, x + 1, y) === T.AMMO) { put('bunker_8', x, y); put('bunker_door', x, y); }
        break;
    }
  }
}
