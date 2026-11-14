'use client';
import { useRef } from 'react';
import type { MinigameProps } from '../types';
import { RANKS } from '../data/branches';
import { GH, GW, GameCanvas, drawTimerBar, hudText, useCanvasLoop } from './common';

const DURATION = 25;
const PX = 230, PY = 120, PW = 260, PH = 200, RAD = 26;

function buildPath(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const x0 = PX + 14, y0 = PY + 14, w = PW - 28, h = PH - 28, r = RAD - 8;
  const seg = (ax: number, ay: number, bx: number, by: number, n: number) => {
    for (let i = 0; i < n; i++) pts.push({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n });
  };
  const arc = (cx: number, cy: number, a0: number, n: number) => {
    for (let i = 0; i < n; i++) { const a = a0 + (Math.PI / 2) * (i / n); pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  };
  seg(x0 + r, y0, x0 + w - r, y0, 24); arc(x0 + w - r, y0 + r, -Math.PI / 2, 6);
  seg(x0 + w, y0 + r, x0 + w, y0 + h - r, 18); arc(x0 + w - r, y0 + h - r, 0, 6);
  seg(x0 + w - r, y0 + h, x0 + r, y0 + h, 24); arc(x0 + r, y0 + h - r, Math.PI / 2, 6);
  seg(x0, y0 + h - r, x0, y0 + r, 18); arc(x0 + r, y0 + r, Math.PI, 6);
  return pts;
}

export default function Overlock({ ctx, onFinish }: MinigameProps) {
  const st = useRef({
    pts: buildPath().map((p) => ({ ...p, done: false })),
    time: DURATION, off: 0, done: false, trail: [] as { x: number; y: number; ok: boolean }[], msg: '', msgT: 0,
  });
  const rank = ctx.rankIdx;

  const ref = useCanvasLoop(({ g, dt, mouse }) => {
    const s = st.current;
    if (s.done) return false;
    s.time -= dt;
    s.msgT -= dt;
    let nearest = Infinity;
    for (const p of s.pts) nearest = Math.min(nearest, Math.hypot(p.x - mouse.x, p.y - mouse.y));
    if (mouse.down) {
      const ok = nearest < 14;
      if (ok) for (const p of s.pts) if (Math.hypot(p.x - mouse.x, p.y - mouse.y) < 12) p.done = true;
      if (!ok && nearest < 80) { s.off += dt; if (s.msgT <= 0) { s.msg = '🧵 삐뚤어졌다! 점선을 따라가자'; s.msgT = 0.8; } }
      const last = s.trail[s.trail.length - 1];
      if (!last || Math.hypot(last.x - mouse.x, last.y - mouse.y) > 4) s.trail.push({ x: mouse.x, y: mouse.y, ok });
    }
    const cover = s.pts.filter((p) => p.done).length / s.pts.length;

    // 전투복 원단
    g.fillStyle = '#4a5a3a'; g.fillRect(0, 0, GW, GH);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = ['#3a4a2a', '#5a6a42', '#6a5a3a', '#2e3a22'][i % 4];
      const x = (i * 137) % GW, y = (i * 89) % GH;
      g.beginPath(); g.ellipse(x, y, 18 + (i % 5) * 4, 10 + (i % 3) * 4, i, 0, Math.PI * 2); g.fill();
    }
    // 계급장 패치
    g.fillStyle = '#1e2a1a';
    g.beginPath(); g.roundRect(PX, PY, PW, PH, RAD); g.fill();
    const bars = rank + 1;
    const bh = 22, gap = 12;
    const total = bars * bh + (bars - 1) * gap;
    for (let i = 0; i < bars; i++) {
      g.fillStyle = '#d8d0b0';
      g.fillRect(PX + 50, PY + PH / 2 - total / 2 + i * (bh + gap), PW - 100, bh);
    }
    // 점선 가이드
    for (const p of s.pts) {
      g.fillStyle = p.done ? '#f2e2a0' : 'rgba(255,255,255,0.45)';
      g.beginPath(); g.arc(p.x, p.y, p.done ? 2.6 : 2, 0, Math.PI * 2); g.fill();
    }
    // 바느질 자국
    for (const tr of s.trail) { g.fillStyle = tr.ok ? 'rgba(242,226,160,0.9)' : 'rgba(255,80,60,0.7)'; g.fillRect(tr.x - 1.5, tr.y - 1.5, 3, 3); }
    // 재봉틀 바늘
    g.strokeStyle = '#d8dce0'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(mouse.x, mouse.y); g.lineTo(mouse.x, mouse.y - (mouse.down ? 30 : 40)); g.stroke();
    g.fillStyle = '#8a929a'; g.fillRect(mouse.x - 22, mouse.y - 70, 44, 30);
    g.fillStyle = '#c04a3a'; g.fillRect(mouse.x - 22, mouse.y - 74, 44, 6);

    drawTimerBar(g, s.time, DURATION);
    hudText(g, `🧵 ${RANKS[rank]} 계급장 오버로크 — 마우스를 누른 채 점선을 따라 박음질!`, 14, 34, 'left', 16);
    hudText(g, `진행 ${Math.round(cover * 100)}% · 이탈 ${s.off.toFixed(1)}s`, 14, 58, 'left', 15);
    if (s.msgT > 0) hudText(g, s.msg, GW / 2, GH - 30, 'center', 18, '#ffe14a');

    if ((cover >= 0.98 || s.time <= 0) && !s.done) {
      s.done = true;
      const score = Math.max(0, Math.min(100, cover * 105 - s.off * 6 + (cover >= 0.98 ? s.time * 0.8 : 0)));
      onFinish(score, `박음질 ${Math.round(cover * 100)}% 완료${s.off > 2 ? ' (조금 삐뚤…)' : ''}`);
      return false;
    }
  });

  return <GameCanvas canvasRef={ref} cursor="none" />;
}
