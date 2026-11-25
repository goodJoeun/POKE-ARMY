import { clampMapZoom, useSettings } from '../state/settings';

/** Only contacts that started on the map count. A thumb on the D-pad is independent. */
export function attachMapPinch(canvas: HTMLCanvasElement, blocked: () => boolean) {
  let startDistance = 0, startZoom = 1;
  let preview: number | null = null;

  const distance = (touches: TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  const cancel = () => { startDistance = 0; preview = null; };
  const contactsChanged = (event: TouchEvent) => {
    const settings = useSettings.getState();
    if (!blocked() && preview !== null && preview !== settings.mapZoom) settings.set('mapZoom', preview);
    cancel();
    if (event.targetTouches.length === 2 && !blocked()) {
      startDistance = distance(event.targetTouches);
      startZoom = useSettings.getState().mapZoom;
    }
  };
  const move = (event: TouchEvent) => {
    if (blocked()) { cancel(); return; }
    if (startDistance > 0 && event.targetTouches.length === 2) {
      preview = clampMapZoom(startZoom * distance(event.targetTouches) / startDistance);
    }
  };
  canvas.addEventListener('touchstart', contactsChanged, { passive: true });
  canvas.addEventListener('touchmove', move, { passive: true });
  canvas.addEventListener('touchend', contactsChanged, { passive: true });
  canvas.addEventListener('touchcancel', cancel);
  return {
    get preview() { return preview; },
    dispose() {
      canvas.removeEventListener('touchstart', contactsChanged);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', contactsChanged);
      canvas.removeEventListener('touchcancel', cancel);
    },
  };
}
