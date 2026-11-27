'use client';
/**
 * 📱 전체 화면: 브라우저 탭 줄 · 주소창을 걷어 화면 높이를 다 쓴다 (폰을 가로로 눕혔을 때 특히 필요하다).
 * - 안드로이드 크롬 · 아이패드: 웹 페이지 전체 화면을 지원한다. 단, 사용자가 화면을 한 번 눌러야 켤 수 있다
 * - 아이폰 사파리: 동영상 말고는 막아 두었다 → "홈 화면에 추가"로 여는 수밖에 없다 (app/manifest.ts)
 */
type FsDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = () => document as FsDoc;

/** 이 브라우저에서 웹 페이지를 전체 화면으로 띄울 수 있는지 */
export const fullscreenSupported = () => typeof document !== 'undefined' && !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
/** 지금 전체 화면인지 */
export const isFullscreen = () => typeof document !== 'undefined' && !!(doc().fullscreenElement || doc().webkitFullscreenElement);
/** 홈 화면에 추가한 아이콘으로 연 앱인지 (이미 주소창이 없다) */
export const isHomeScreenApp = () =>
  typeof window !== 'undefined' &&
  (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** 전체 화면으로 (화면을 누른 직후에만 된다. 막히면 조용히 그대로 둔다) */
export function enterFullscreen() {
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    else el.webkitRequestFullscreen?.();
  } catch { /* 막혀 있으면 그대로 둔다 */ }
}
export function exitFullscreen() {
  if (!isFullscreen()) return;
  try {
    if (doc().exitFullscreen) void doc().exitFullscreen().catch(() => undefined);
    else doc().webkitExitFullscreen?.();
  } catch { /* noop */ }
}
/** 전체 화면에 들어가고 나올 때 부른다. 돌려받은 함수로 그만 듣는다 */
export function onFullscreenChange(cb: () => void): () => void {
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
  return () => {
    document.removeEventListener('fullscreenchange', cb);
    document.removeEventListener('webkitfullscreenchange', cb);
  };
}

/**
 * 안드로이드 폰 · 태블릿: 페이지를 열고 처음 화면을 누를 때 전체 화면으로 들어간다 (설정의 "전체 화면"이 켜져 있을 때).
 * 브라우저는 누르기 전에는 막으므로, 손을 떼는 순간(pointerup · click)에 한 번만 시도한다.
 * 그 뒤로 뒤로 가기 등으로 직접 나왔다면 그 뜻을 따라 다시 들어가지 않는다 (다음에 페이지를 열 때 다시).
 * 글자를 쓰는 칸(이름 입력)을 누른 거라면 자판이 뜨는 중이니 건너뛰고 다음 터치를 기다린다.
 */
export function autoFullscreenOnFirstTap(wanted: () => boolean): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const android = /Android/i.test(navigator.userAgent);
  if (!android || !matchMedia('(pointer: coarse)').matches || !fullscreenSupported() || isHomeScreenApp()) return () => undefined;
  const typing = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea');
  const stop = () => {
    window.removeEventListener('pointerup', tap, true);
    window.removeEventListener('click', tap, true);
  };
  function tap(e: Event) {
    if (typing(e.target)) return;
    stop();
    if (wanted() && !isFullscreen()) enterFullscreen();
  }
  window.addEventListener('pointerup', tap, true);
  window.addEventListener('click', tap, true);
  return stop;
}
