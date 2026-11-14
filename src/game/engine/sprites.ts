/**
 * 선택적 스프라이트 로더.
 * public/sprites/manifest.json 에 { "charmander": "charmander.png", ... } 형태로 등록하면
 * 해당 포켓몬은 절차적 드로잉 대신 이미지로 그려진다. (등록되지 않은 키는 기존 드로잉 사용)
 */
const images = new Map<string, HTMLImageElement>();
let started = false;

export function initSprites() {
  if (started || typeof window === 'undefined') return;
  started = true;
  fetch('/sprites/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: Record<string, string>) => {
      for (const [key, file] of Object.entries(m)) {
        const img = new Image();
        img.src = `/sprites/${file}`;
        images.set(key, img);
      }
    })
    .catch(() => { /* 매니페스트 없음 → 절차적 드로잉만 사용 */ });
}

export function getSprite(key?: string): HTMLImageElement | null {
  if (!key) return null;
  const img = images.get(key);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}
