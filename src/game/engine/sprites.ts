/**
 * 포켓몬 이미지 로더.
 * public/sprites/manifest.json (npm run sprites 로 생성):
 *   { "charmander": { "front": "front/charmander.png", "back": "back/...", "art": "art/..." } }
 * - front/back: 맵에서 쓰는 도트 스프라이트 (정면/뒷모습)
 * - art: 공식 일러스트 (현재는 사용하지 않음)
 * - icon: 필드에서 쓰는 2등신 도트 아이콘 (7세대 파티 아이콘)
 * 등록되지 않은 포켓몬은 절차적 드로잉으로 표시된다.
 */
export type SpriteKind = 'front' | 'back' | 'art' | 'icon' | 'follower';

/** 투명 여백을 잘라낸 캔버스 */
const trimmed = new Map<string, HTMLCanvasElement>();
/** 팔로워 걷기 시트 (원본 그대로, 4x4 칸) */
const sheets = new Map<string, HTMLCanvasElement>();

/**
 * 어나더 레드 정면/뒷모습/아이콘: 정사각형 프레임이 가로로 이어진 애니메이션 띠.
 * 원본 이미지를 그대로 두고, 모든 프레임에 공통인 그림 영역(x0,y0,bw,bh)만 기억해 둔다.
 */
export interface SpriteAnim { img: HTMLImageElement; fh: number; n: number; x0: number; y0: number; bw: number; bh: number }
const anims = new Map<string, SpriteAnim>();

function sliceStrip(img: HTMLImageElement): { anim: SpriteAnim; first: HTMLCanvasElement } {
  const w = img.naturalWidth, h = img.naturalHeight;
  const n = Math.max(1, Math.floor(w / h));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = h, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < n * h; x++) {
    if (d[(y * w + x) * 4 + 3] > 8) {
      const fx = x % h;
      if (fx < x0) x0 = fx;
      if (fx > x1) x1 = fx;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = h - 1; y1 = h - 1; }
  const anim: SpriteAnim = { img, fh: h, n, x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
  const first = document.createElement('canvas');
  first.width = anim.bw; first.height = anim.bh;
  first.getContext('2d')!.drawImage(img, x0, y0, anim.bw, anim.bh, 0, 0, anim.bw, anim.bh);
  return { anim, first };
}

/** 애니메이션 띠가 있으면 반환 (초상화 등 큰 화면에서 움직이게 그릴 때) */
export function getSpriteAnim(key: string | undefined, kind: SpriteKind): SpriteAnim | null {
  if (!key) return null;
  const order: SpriteKind[] = kind === 'back' ? ['back', 'front'] : [kind];
  for (const k of order) {
    const a = anims.get(`${key}/${k}`);
    if (a) return a;
  }
  return null;
}
const silhouettes = new Map<string, HTMLCanvasElement>();
let started = false;
let version = 0;
const listeners = new Set<() => void>();

function trim(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return c;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

type Manifest = Record<string, Partial<Record<SpriteKind, string>>>;
/** 받아 온 목록 (아직이면 null). 불러오다 실패한 그림은 여기서 지워, 비슷한 다른 그림으로 넘어가게 한다 */
let manifest: Manifest | null = null;
/** 이미 요청한 그림 (`키/종류`) */
const requested = new Set<string>();
/** 목록이 오기 전에 미리 받아 두라고 한 것 */
let pendingPreload: [string, SpriteKind[]][] = [];
/** 그림 주소에 붙이는 버전 (next.config.mjs): 그림이 바뀌면 값이 달라져, 오래 캐시해 두어도 새 그림을 받는다 */
const ASSET_Q = process.env.NEXT_PUBLIC_ASSET_V ? `?v=${process.env.NEXT_PUBLIC_ASSET_V}` : '';

const has = (key: string, kind: SpriteKind) => !!manifest?.[key]?.[kind];
const notify = () => { version++; listeners.forEach((f) => f()); };

/**
 * 그림 한 장을 받는다 (이미 요청했으면 아무것도 하지 않는다).
 * 그림은 화면에 그리려는 순간에만 받는다: 목록의 수백 장을 접속할 때마다 한꺼번에 받지 않는다.
 */
function request(key: string, kind: SpriteKind) {
  const file = manifest?.[key]?.[kind];
  const id = `${key}/${kind}`;
  if (!file || requested.has(id)) return;
  requested.add(id);
  const img = new Image();
  img.onload = () => {
    if (kind === 'follower') {
      // 팔로워 시트는 4x4 칸 구조를 지켜야 하므로 자르지 않는다
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      sheets.set(key, c);
    } else if (img.naturalWidth >= img.naturalHeight * 1.5) {
      // 어나더 레드 애니메이션 띠 → 첫 프레임은 정지 이미지로, 띠는 애니메이션용으로
      const { anim, first } = sliceStrip(img);
      anims.set(id, anim);
      trimmed.set(id, first);
    } else {
      trimmed.set(id, trim(img));
    }
    notify();
  };
  img.onerror = () => {
    if (manifest?.[key]) delete manifest[key][kind];
    notify();
  };
  img.src = `/sprites/${file}${ASSET_Q}`;
}

/** 필드에서 걷는 모습에 쓰는 그림: 팔로워 시트가 있으면 그것만, 없으면 2등신 아이콘 */
function requestWalk(key: string) {
  if (has(key, 'follower')) request(key, 'follower');
  else request(key, 'icon');
}

/**
 * 곧 화면에 나올 포켓몬의 그림을 미리 받아 둔다 (처음 그릴 때 임시 그림이 잠깐 비치지 않게).
 * kinds의 'follower'는 "필드에서 걷는 모습"을 뜻한다 (시트가 없으면 아이콘).
 */
export function preloadSprites(keys: (string | undefined)[], kinds: SpriteKind[]) {
  for (const key of keys) {
    if (!key) continue;
    if (!manifest) { pendingPreload.push([key, kinds]); continue; }
    for (const kind of kinds) {
      if (kind === 'follower') requestWalk(key);
      else request(key, kind);
    }
  }
}

export function initSprites() {
  if (started || typeof window === 'undefined') return;
  started = true;
  fetch(`/sprites/manifest.json${ASSET_Q}`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: Record<string, string | Partial<Record<SpriteKind, string>>>) => {
      const next: Manifest = {};
      for (const [key, v] of Object.entries(m)) next[key] = typeof v === 'string' ? { front: v } : { ...v };
      manifest = next;
      const queued = pendingPreload;
      pendingPreload = [];
      for (const [key, kinds] of queued) preloadSprites([key], kinds);
      // 목록이 오기 전에 그리려던 화면들이 다시 그리면서 필요한 그림을 요청한다
      notify();
    })
    .catch(() => { /* 매니페스트 없음 → 절차적 드로잉만 사용 */ });
}

/**
 * 원하는 종류가 없으면 비슷한 것으로 대체.
 * 아직 받지 않았다면 가장 알맞은 한 장을 요청해 두고, 그동안은 이미 받아 둔 비슷한 그림(없으면 null)을 돌려준다.
 */
export function getSprite(key: string | undefined, kind: SpriteKind, load = true): HTMLCanvasElement | null {
  if (!key) return null;
  const order: SpriteKind[] = kind === 'icon' ? ['icon'] : kind === 'art' ? ['art', 'front'] : kind === 'back' ? ['back', 'front'] : ['front', 'art'];
  let asked = !load;
  for (const k of order) {
    const c = trimmed.get(`${key}/${k}`);
    if (c) return c;
    if (!asked && has(key, k)) { request(key, k); asked = true; }
  }
  return null;
}

// ───────────── 필드 걷기 스프라이트 (2등신 아이콘에서 자동 생성) ─────────────
type Dir4 = 'down' | 'up' | 'left' | 'right';
const walkCache = new Map<string, HTMLCanvasElement>();

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * 뒷모습: 얼굴(눈·입·하이라이트)을 지우고 몸통 주색으로 채운 뒤,
 * 아래쪽은 어둡게·위쪽 가장자리는 밝게 칠해 등을 보이는 느낌을 낸다. 외곽선은 그대로.
 */
function makeBack(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const c = canvasOf(w, h);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const opaque = (i: number) => d[i * 4 + 3] > 100;
  const isOutline = (i: number) => luma(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < 55;
  // 몸통 주색: 외곽선·흰색을 뺀 가장 많은 색
  const count = new Map<number, number>();
  const tally = (minL: number) => {
    for (let i = 0; i < w * h; i++) {
      if (!opaque(i) || isOutline(i)) continue;
      const l = luma(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      // 너무 어두운 색(그림자·외곽선 근처)과 흰색(눈·하이라이트)은 몸통 색 후보에서 뺀다
      if (l > 225 || l < minL) continue;
      const key = ((d[i * 4] >> 3) << 10) | ((d[i * 4 + 1] >> 3) << 5) | (d[i * 4 + 2] >> 3);
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  };
  tally(90);
  if (count.size === 0) tally(0);
  let best = 0, bestN = -1;
  for (const [k, n] of count) if (n > bestN) { best = k; bestN = n; }
  const br = ((best >> 10) & 31) << 3, bg = ((best >> 5) & 31) << 3, bb = (best & 31) << 3;
  // 세로 범위
  let top = h, bottom = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(y * w + x)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  const span = Math.max(1, bottom - top);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!opaque(i) || isOutline(i)) continue;
    // 바깥쪽 외곽선 바로 안쪽 픽셀은 원래 색을 살짝 남긴다 (귀·꼬리 끝 같은 포인트 색)
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx < 0 || ny < 0 || nx >= w || ny >= h || !opaque(ny * w + nx);
    });
    const rel = (y - top) / span;
    const shade = rel > 0.62 ? 0.78 : rel < 0.18 ? 1.12 : 1;
    let r = br, gg = bg, b = bb;
    if (edge) { r = (r + d[i * 4]) / 2; gg = (gg + d[i * 4 + 1]) / 2; b = (b + d[i * 4 + 2]) / 2; }
    d[i * 4] = Math.min(255, r * shade);
    d[i * 4 + 1] = Math.min(255, gg * shade);
    d[i * 4 + 2] = Math.min(255, b * shade);
  }
  // 등 가운데 세로 그늘 한 줄 (등선)
  const cx = Math.round(w / 2);
  for (let y = top + Math.round(span * 0.3); y < top + Math.round(span * 0.75); y++) {
    const i = y * w + cx;
    if (opaque(i) && !isOutline(i)) { d[i * 4] *= 0.85; d[i * 4 + 1] *= 0.85; d[i * 4 + 2] *= 0.85; }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function mirrorCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvasOf(src.width, src.height);
  const g = c.getContext('2d')!;
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/** 걷기 프레임: 아래쪽(발) 몇 줄을 좌우로 1px 밀어 발을 번갈아 내딛는 느낌 */
function stepFrame(src: HTMLCanvasElement, dx: number): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const feet = Math.max(2, Math.round(h * 0.18));
  const c = canvasOf(w + 2, h);
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0, w, h - feet, 1, 0, w, h - feet);
  // 발은 왼쪽·오른쪽 절반을 서로 반대로 민다
  const half = Math.floor(w / 2);
  g.drawImage(src, 0, h - feet, half, feet, 1 + dx, h - feet, half, feet);
  g.drawImage(src, half, h - feet, w - half, feet, 1 + half - dx, h - feet, w - half, feet);
  return c;
}

/**
 * 팔로워 시트에서 한 칸 꺼내기. 행: 0 앞 · 1 왼쪽 · 2 오른쪽 · 3 뒤 / 열: 걷기 4프레임.
 * 모든 칸을 같은 영역(16칸 전체의 합집합 테두리)으로 잘라서 프레임마다 발 위치가 흔들리지 않게 한다.
 */
const sheetCrop = new Map<string, { x: number; y: number; w: number; h: number }>();
function followerFrame(key: string, dir: Dir4, frame: number): HTMLCanvasElement | null {
  const sheet = sheets.get(key);
  if (!sheet) return null;
  const row = { down: 0, left: 1, right: 2, up: 3 }[dir];
  const col = [0, 1, 3][frame] ?? 0;
  const id = `sheet/${key}/${row}/${col}`;
  const cached = walkCache.get(id);
  if (cached) return cached;
  const cw = Math.floor(sheet.width / 4), ch = Math.floor(sheet.height / 4);
  let crop = sheetCrop.get(key);
  if (!crop) {
    const data = sheet.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, sheet.width, sheet.height).data;
    let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
    for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) {
      if (data[(y * sheet.width + x) * 4 + 3] <= 8) continue;
      const lx = x % cw, ly = y % ch;
      if (lx < x0) x0 = lx; if (lx > x1) x1 = lx;
      if (ly < y0) y0 = ly; if (ly > y1) y1 = ly;
    }
    crop = x1 < 0 ? { x: 0, y: 0, w: cw, h: ch } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    sheetCrop.set(key, crop);
  }
  const c = canvasOf(crop.w, crop.h);
  c.getContext('2d')!.drawImage(sheet, col * cw + crop.x, row * ch + crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  walkCache.set(id, c);
  return c;
}

/**
 * 필드용 걷기 스프라이트 (방향 4종 × 프레임 3종: 0 서기, 1·2 걷기).
 * 팔로워 시트가 있으면 그것을, 없으면 2등신 아이콘에서 자동 생성한다.
 * 2등신 아이콘이 없으면 null.
 */
export function getWalkSprite(key: string | undefined, dir: Dir4, frame: number): HTMLCanvasElement | null {
  if (!key) return null;
  requestWalk(key);
  const fromSheet = followerFrame(key, dir, frame);
  if (fromSheet) return fromSheet;
  const icon = trimmed.get(`${key}/icon`);
  if (!icon) return null;
  const id = `${key}/${dir}/${frame}/${icon.width}x${icon.height}`;
  const cached = walkCache.get(id);
  if (cached) return cached;
  // 아이콘은 왼쪽 앞을 보고 있다
  let base: HTMLCanvasElement;
  if (dir === 'up') base = makeBack(icon);
  else if (dir === 'right') base = mirrorCanvas(icon);
  else base = icon;
  const out = frame === 0 ? stepFrame(base, 0) : stepFrame(base, frame === 1 ? 1 : -1);
  walkCache.set(id, out);
  return out;
}

// ───────────── 도트(필드용) 버전 ─────────────
/** 필드에서 쓰는 도트 스프라이트 높이(px). 이 크기로 줄인 뒤 외곽선을 둘러 또렷한 도트로 만든다 */
export const DOT_H = 28;
const OUTLINE = [32, 32, 40];
const dots = new Map<string, HTMLCanvasElement>();

/**
 * 도트 버전: 작게 줄이고 → 반투명을 없애고(알파 이진화) → 색 단계를 줄이고 → 1px 외곽선.
 * 확대할 때는 반드시 imageSmoothing 끄고 그린다.
 */
export function getDot(key: string | undefined, kind: SpriteKind): HTMLCanvasElement | null {
  if (!key) return null;
  // 걷는 그림(시트 · 아이콘)이 따로 있는 포켓몬은 그쪽을 기다린다: 그 잠깐을 메우려고 배틀 스프라이트까지 받지 않는다
  const src = getSprite(key, kind === 'art' || kind === 'icon' ? 'front' : kind, !has(key, 'follower') && !has(key, 'icon'));
  if (!src) return null;
  const id = `${key}/${kind}/${src.width}x${src.height}`;
  const cached = dots.get(id);
  if (cached) return cached;

  const scale = Math.min(1, DOT_H / src.height);
  const w = Math.max(1, Math.round(src.width * scale)), h = Math.max(1, Math.round(src.height * scale));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const sg = small.getContext('2d', { willReadFrequently: true })!;
  sg.imageSmoothingEnabled = true;
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(src, 0, 0, w, h);
  const img = sg.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3];
    if (a >= 110) {
      solid[i] = 1;
      // 반투명 테두리는 진하게, 색 단계는 줄여서 도트 느낌
      for (let c = 0; c < 3; c++) {
        const v = d[i * 4 + c] / (a / 255);
        d[i * 4 + c] = Math.min(255, Math.round(v / 24) * 24);
      }
      d[i * 4 + 3] = 255;
    } else {
      d[i * 4 + 3] = 0;
    }
  }
  // 1px 외곽선을 위해 사방 1px 여유
  const out = document.createElement('canvas');
  out.width = w + 2; out.height = h + 2;
  const og = out.getContext('2d')!;
  const oimg = og.createImageData(w + 2, h + 2);
  const o = oimg.data;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x] === 1;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const oi = ((y + 1) * (w + 2) + (x + 1)) * 4;
    if (at(x, y)) {
      const si = (y * w + x) * 4;
      o[oi] = d[si]; o[oi + 1] = d[si + 1]; o[oi + 2] = d[si + 2]; o[oi + 3] = 255;
    } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
      o[oi] = OUTLINE[0]; o[oi + 1] = OUTLINE[1]; o[oi + 2] = OUTLINE[2]; o[oi + 3] = 255;
    }
  }
  og.putImageData(oimg, 0, 0);
  dots.set(id, out);
  return out;
}

/** 검은 실루엣 버전 (야간 경계 등) */
export function getSilhouette(key: string, kind: string, src: HTMLCanvasElement, color = '#1a1a24'): HTMLCanvasElement {
  const id = `${key}/${kind}/${color}/${src.width}x${src.height}`;
  const cached = silhouettes.get(id);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  silhouettes.set(id, c);
  return c;
}

/** 스프라이트 로딩 완료 시 재그리기가 필요한 정적 캔버스용 */
export function onSpritesLoaded(f: () => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

export function spritesVersion() {
  return version;
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // 개발용: 콘솔에서 __walk('pidgey', 'up', 1) 로 생성된 걷기 스프라이트 확인
  (window as unknown as Record<string, unknown>).__walk = getWalkSprite;
}

/** 팔로워 걷기 시트가 있는지 (있으면 원본 크기 비율을 살려서 그린다) */
export function hasFollower(key: string | undefined): boolean {
  return !!key && sheets.has(key);
}
