'use client';
import { useEffect, useRef } from 'react';

export const GW = 720;
export const GH = 440;

export interface LoopApi {
  g: CanvasRenderingContext2D;
  dt: number;
  t: number;
  mouse: { x: number; y: number; down: boolean; clicked: boolean };
  keys: Record<string, boolean>;
  pressed: Set<string>;
}

/** 고정 해상도(720x440) 캔버스 + 게임 루프. update가 false를 반환하면 루프 정지 */
export function useCanvasLoop(update: (api: LoopApi) => void | boolean, deps: unknown[] = []) {
  const ref = useRef<HTMLCanvasElement>(null);
  const updRef = useRef(update);
  updRef.current = update;
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = GW * dpr;
    c.height = GH * dpr;
    const g = c.getContext('2d')!;
    const mouse = { x: GW / 2, y: GH / 2, down: false, clicked: false };
    const keys: Record<string, boolean> = {};
    const pressed = new Set<string>();
    const toLocal = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * GW;
      mouse.y = ((e.clientY - r.top) / r.height) * GH;
    };
    const pm = (e: PointerEvent) => toLocal(e);
    const pd = (e: PointerEvent) => { toLocal(e); mouse.down = true; mouse.clicked = true; };
    const pu = () => { mouse.down = false; };
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (!keys[k]) pressed.add(k);
      keys[k] = true;
    };
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    c.addEventListener('pointermove', pm);
    c.addEventListener('pointerdown', pd);
    window.addEventListener('pointerup', pu);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    let raf = 0;
    let last = performance.now();
    const start = last;
    let stopped = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = updRef.current({ g, dt, t: (now - start) / 1000, mouse, keys, pressed });
      mouse.clicked = false;
      pressed.clear();
      if (r === false) { stopped = true; return; }
      if (!stopped) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      c.removeEventListener('pointermove', pm);
      c.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointerup', pu);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function GameCanvas({ canvasRef, cursor = 'default' }: { canvasRef: React.RefObject<HTMLCanvasElement | null>; cursor?: string }) {
  return <canvas ref={canvasRef} className="mg-canvas" style={{ cursor }} />;
}

export function drawTimerBar(g: CanvasRenderingContext2D, remain: number, total: number) {
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(0, 0, GW, 8);
  const r = Math.max(0, remain / total);
  g.fillStyle = r > 0.3 ? '#4ab06a' : '#e0584a';
  g.fillRect(0, 0, GW * r, 8);
}

export function hudText(g: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = 'left', size = 16, color = '#ffffff') {
  g.font = `bold ${size}px "Galmuri11", sans-serif`;
  g.textAlign = align;
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

export function skillCooldownText(cd: number, name: string) {
  return cd > 0 ? `${name} 재충전 ${cd.toFixed(1)}s` : `[Space] ${name} 준비됨!`;
}

/** 숙련도에 따른 기술 재사용 대기시간 배율 (숙련도 100 → -40%) */
export function cdMul(skill: number) {
  return 1 - Math.min(0.4, Math.max(0, skill) / 250);
}

export const rand =(a: number, b: number) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
