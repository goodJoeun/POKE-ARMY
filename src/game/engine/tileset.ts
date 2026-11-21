/**
 * 타일셋(그림 파일) 방식 맵 렌더러 — 시제품, 실내 맵 전체를 지원한다 (야외는 기존 방식).
 *
 * 맵 데이터(T 격자 · 문 · 스팟 · 충돌)는 map.ts 그대로 두고 "그리는 부분"만 바꾼다.
 * 그림은 public/tiles/barracks.png 한 장(16px 격자 원본 도트)에 모여 있고,
 * 조각 위치는 data/tilesets/barracks.json에 있다 (둘 다 `npm run tiles`로 만든다).
 */
import manifest from '../data/tilesets/barracks.json';
import { T, TILE, drawDoorSigns, type GameMap, type MapId } from './map';

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
    img.src = manifest.image;
  });
  return atlasPromise;
}

/** 이 타일셋에 그림이 준비된 타일 종류 */
const SUPPORTED = new Set<T>([
  T.FLOOR, T.WALL, T.DOOR, T.BED, T.LOCKER, T.TV, T.BOARD,
  T.DESK, T.TABLE, T.COUNTER, T.PC, T.SHELF, T.PLANT, T.STAIRS, T.SOFA,
  T.COOLER, T.WASHER, T.TOILET, T.SINK, T.STOVE, T.CRATE, T.FOODCART, T.GYM,
]);

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
  if (!map.indoor || !FLOORS[map.id]) return false;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (!SUPPORTED.has(map.tiles[y][x])) return false;
  return true;
}

function hash(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function renderTilesetMap(map: GameMap, atlas: HTMLImageElement): HTMLCanvasElement {
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
