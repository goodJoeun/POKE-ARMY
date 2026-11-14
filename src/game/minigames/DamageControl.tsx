'use client';
import { useRef } from 'react';
import type { MinigameProps } from '../types';
import { GH, GW, GameCanvas, cdMul, drawTimerBar, hudText, useCanvasLoop, rand } from './common';

const DURATION = 45;
const SLOTS: [number, number][] = [
  [90, 140], [90, 260], [90, 360], [630, 150], [630, 270], [630, 370], [220, 395], [360, 400], [500, 395], [250, 110], [470, 110],
];

export default function DamageControl({ ctx, onFinish }: MinigameProps) {
  const st = useRef({
    time: DURATION, water: 0, maxWater: 0, leaks: [] as { slot: number; hp: number; age: number }[],
    spawn: 1.5, plugged: 0, skillCd: 0, msg: '', msgT: 0, done: false, flooded: false, hammer: 0,
    drops: [] as { x: number; y: number; vx: number; vy: number }[],
  });

  const ref = useCanvasLoop(({ g, dt, t, mouse, pressed }) => {
    const s = st.current;
    if (s.done) return false;
    s.time -= dt;
    s.msgT -= dt;
    s.skillCd = Math.max(0, s.skillCd - dt);
    s.hammer = Math.max(0, s.hammer - dt);

    s.spawn -= dt;
    if (s.spawn <= 0) {
      const free = SLOTS.map((_, i) => i).filter((i) => !s.leaks.some((l) => l.slot === i));
      if (free.length) s.leaks.push({ slot: free[Math.floor(Math.random() * free.length)], hp: 4, age: 0 });
      s.spawn = Math.max(0.8, 2.6 - (DURATION - s.time) * 0.04);
    }
    for (const l of s.leaks) l.age += dt;
    // 오래 방치한 누수일수록 물이 더 많이 샌다
    const inflow = s.leaks.reduce((a, l) => a + 2.2 * (1 + Math.min(1, l.age * 0.08)), 0);
    s.water = Math.max(0, s.water + (inflow - 1.0) * dt);
    s.maxWater = Math.max(s.maxWater, s.water);

    if (mouse.clicked) {
      for (const l of s.leaks) {
        const [lx, ly] = SLOTS[l.slot];
        if (Math.hypot(mouse.x - lx, mouse.y - ly) < 30) {
          l.hp--;
          s.hammer = 0.12;
          if (l.hp <= 0) { s.plugged++; s.msg = '🔨 쐐기 박기 성공!'; s.msgT = 0.8; }
          break;
        }
      }
      s.leaks = s.leaks.filter((l) => l.hp > 0);
    }
    if (pressed.has(' ') && s.skillCd <= 0) {
      s.skillCd = 10 * cdMul(ctx.skill); s.water = Math.max(0, s.water - 25); s.msg = '💧 물 흡수! 수위가 내려간다'; s.msgT = 1.2;
    }

    // 그리기: 함정 격실 단면
    g.fillStyle = '#4a525a'; g.fillRect(0, 0, GW, GH);
    g.fillStyle = '#7a848e'; g.fillRect(60, 80, GW - 120, GH - 80);
    g.strokeStyle = '#5a646e'; g.lineWidth = 2;
    for (let x = 60; x < GW - 60; x += 60) { g.beginPath(); g.moveTo(x, 80); g.lineTo(x, GH); g.stroke(); }
    for (let y = 80; y < GH; y += 50) { g.beginPath(); g.moveTo(60, y); g.lineTo(GW - 60, y); g.stroke(); }
    // 배관/장비
    g.fillStyle = '#c04a3a'; g.fillRect(60, 95, GW - 120, 10);
    g.fillStyle = '#e8d24a'; for (let x = 70; x < GW - 60; x += 80) g.fillRect(x, 95, 20, 10);
    g.fillStyle = '#5a6a7a'; g.fillRect(300, 300, 120, 80);
    hudText(g, 'PUMP', 360, 345, 'center', 14);
    // 물
    const wy = GH - (s.water / 100) * (GH - 80);
    g.fillStyle = 'rgba(40,110,200,0.65)';
    g.beginPath(); g.moveTo(60, GH);
    for (let x = 60; x <= GW - 60; x += 20) g.lineTo(x, wy + Math.sin(t * 3 + x * 0.05) * 4);
    g.lineTo(GW - 60, GH); g.fill();
    // 누수
    for (const l of s.leaks) {
      const [lx, ly] = SLOTS[l.slot];
      for (let i = 0; i < 2; i++) s.drops.push({ x: lx, y: ly, vx: rand(-60, 60) + (lx < 200 ? 90 : lx > 520 ? -90 : 0), vy: rand(-30, 40) });
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(lx, ly, 12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffe14a'; g.lineWidth = 3; g.beginPath(); g.arc(lx, ly, 22 + Math.sin(t * 8) * 3, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < l.hp; i++) { g.fillStyle = '#ffe14a'; g.fillRect(lx - 15 + i * 11, ly - 34, 8, 5); }
    }
    g.fillStyle = 'rgba(120,180,255,0.8)';
    for (const d of s.drops) { d.vy += 400 * dt; d.x += d.vx * dt; d.y += d.vy * dt; g.fillRect(d.x, d.y, 3, 3); }
    s.drops = s.drops.filter((d) => d.y < wy && d.y < GH).slice(-300);
    // 망치 커서
    g.save(); g.translate(mouse.x, mouse.y); g.rotate(s.hammer > 0 ? -0.6 : 0.2);
    g.fillStyle = '#8a6a4a'; g.fillRect(-3, -2, 6, 30);
    g.fillStyle = '#5a5a5a'; g.fillRect(-14, -12, 28, 12);
    g.restore();

    g.fillStyle = 'rgba(20,20,30,0.85)'; g.fillRect(0, 0, GW, 70);
    drawTimerBar(g, s.time, DURATION);
    hudText(g, `🚨 손상통제 훈련 — 누수 지점을 클릭(4회)해 쐐기를 박아라!`, 14, 34, 'left', 16);
    hudText(g, `수위 ${Math.round(s.water)}% · 막은 누수 ${s.plugged}`, 14, 58, 'left', 15, s.water > 60 ? '#ff8a7a' : '#9ad0ff');
    hudText(g, s.skillCd > 0 ? `물 흡수 ${s.skillCd.toFixed(0)}s` : '[Space] 물 흡수', GW - 14, 58, 'right', 15, s.skillCd > 0 ? '#aaa' : '#ffe14a');
    if (s.msgT > 0) hudText(g, s.msg, GW / 2, 130, 'center', 20, '#ffe14a');

    if (s.water >= 100) s.flooded = true;
    if ((s.time <= 0 || s.flooded) && !s.done) {
      s.done = true;
      const score = s.flooded ? 15 : Math.max(0, Math.min(100, 105 - s.maxWater * 0.8 - s.leaks.length * 6));
      onFinish(score, s.flooded ? '격실 침수… 훈련 실패' : `누수 ${s.plugged}곳 차단, 최고 수위 ${Math.round(s.maxWater)}%`);
      return false;
    }
  });

  return <GameCanvas canvasRef={ref} cursor="none" />;
}
