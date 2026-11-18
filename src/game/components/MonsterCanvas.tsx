'use client';
import { useEffect, useRef, useState } from 'react';
import type { MonsterLook } from '../types';
import { drawMonster, type CapType, type Dir } from '../engine/drawMonster';
import { onSpritesLoaded } from '../engine/sprites';

interface Props {
  look: MonsterLook;
  size?: number;
  dir?: Dir;
  cap?: CapType;
  animate?: boolean;
  walking?: boolean;
  className?: string;
  sleeping?: boolean;
  /** 실루엣 색 (예: '#2a2a3a') */
  silhouette?: string;
}

export default function MonsterCanvas({ look, size = 96, dir = 'down', cap = null, animate = true, walking = false, className, sleeping, silhouette }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // 이미지가 늦게 로드되면 정적 캔버스도 다시 그린다
  const [tick, setTick] = useState(0);
  useEffect(() => onSpritesLoaded(() => setTick((t) => t + 1)), []);

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
      // 그림이 캔버스 밖으로 나가 머리·날개가 잘리지 않게 가장자리 안쪽 상자에 맞춘다
      const pad = Math.max(2, size * 0.03);
      drawMonster(g, look, size / 2, size * 0.94, size * 0.82, {
        dir, t, cap, walking, sleeping, silhouette,
        fit: { left: pad, top: pad, right: size - pad, bottom: size - pad * 0.5 },
      });
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [look, size, dir, cap, animate, walking, sleeping, silhouette, tick]);
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} />;
}
