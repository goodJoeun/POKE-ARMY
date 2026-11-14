/**
 * 포켓몬 이미지 로더.
 * public/sprites/manifest.json (npm run sprites 로 생성):
 *   { "charmander": { "front": "front/charmander.png", "back": "back/...", "art": "art/..." } }
 * - front/back: 맵에서 쓰는 도트 스프라이트 (정면/뒷모습)
 * - art: 대화 초상화·변신 연출 등 큰 화면용 공식 일러스트
 * 등록되지 않은 포켓몬은 절차적 드로잉으로 표시된다.
 */
export type SpriteKind = 'front' | 'back' | 'art';

/** 투명 여백을 잘라낸 캔버스 */
const trimmed = new Map<string, HTMLCanvasElement>();
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

export function initSprites() {
  if (started || typeof window === 'undefined') return;
  started = true;
  fetch('/sprites/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: Record<string, string | Partial<Record<SpriteKind, string>>>) => {
      for (const [key, v] of Object.entries(m)) {
        const entry = typeof v === 'string' ? { front: v } : v;
        for (const [kind, file] of Object.entries(entry) as [SpriteKind, string][]) {
          const img = new Image();
          img.onload = () => {
            trimmed.set(`${key}/${kind}`, trim(img));
            version++;
            listeners.forEach((f) => f());
          };
          img.src = `/sprites/${file}`;
        }
      }
    })
    .catch(() => { /* 매니페스트 없음 → 절차적 드로잉만 사용 */ });
}

/** 원하는 종류가 없으면 비슷한 것으로 대체 */
export function getSprite(key: string | undefined, kind: SpriteKind): HTMLCanvasElement | null {
  if (!key) return null;
  const order: SpriteKind[] = kind === 'art' ? ['art', 'front'] : kind === 'back' ? ['back', 'front'] : ['front', 'art'];
  for (const k of order) {
    const c = trimmed.get(`${key}/${k}`);
    if (c) return c;
  }
  return null;
}

/** 검은 실루엣 버전 (군 선택 화면, 야간 경계 등) */
export function getSilhouette(key: string, kind: SpriteKind, src: HTMLCanvasElement, color = '#1a1a24'): HTMLCanvasElement {
  const id = `${key}/${kind}/${color}`;
  const cached = silhouettes.get(id);
  if (cached && cached.width === src.width) return cached;
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
