'use client';
import { useEffect, useRef } from 'react';
import type { MonsterLook } from '../types';
import { drawMonster, type CapType, type Dir } from '../engine/drawMonster';

interface Props {
  look: MonsterLook;
  size?: number;
  dir?: Dir;
  cap?: CapType;
  animate?: boolean;
  walking?: boolean;
  className?: string;
  sleeping?: boolean;
}

export default function MonsterCanvas({ look, size = 96, dir = 'down', cap = null, animate = true, walking = false, className, sleeping }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const g = c.getContext('2d')!;
    let raf = 0;
    const start = performance.now();
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);
      drawMonster(g, look, size / 2, size * 0.94, size * 0.82, { dir, t, cap, walking, sleeping });
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [look, size, dir, cap, animate, walking, sleeping]);
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} />;
}
