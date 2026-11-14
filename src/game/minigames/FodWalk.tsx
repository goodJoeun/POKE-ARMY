'use client';
import { useRef } from 'react';
import type { MinigameProps } from '../types';
import { GH, GW, GameCanvas, cdMul, drawTimerBar, hudText, useCanvasLoop, rand } from './common';

const DURATION = 40;
type Obj = { x: number; y: number; fod: boolean; kind: number; found: boolean; wrong: boolean };

const FOD_KINDS = ['볼트', '너트', '돌멩이', '철사', '비닐', '나사'];
const OK_KINDS = ['도색 표시', '포장 이음매', '활주로등', '배수구'];

export default function FodWalk({ ctx, onFinish }: MinigameProps) {
  const st = useRef({
    time: DURATION, objs: [] as Obj[], spawn: 0, found: 0, wrong: 0, missed: 0, totalFod: 0, scroll: 0,
    skill: 0, skillCd: 0, msg: '', msgT: 0, done: false,
  });

  const drawObj = (g: CanvasRenderingContext2D, o: Obj, glow: boolean) => {
    g.save();
    g.translate(o.x, o.y);
    if (glow && o.fod) { g.fillStyle = 'rgba(255,225,74,0.45)'; g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill(); }
    if (o.fod) {
      switch (o.kind) {
        case 0: g.fillStyle = '#9aa0a8'; g.fillRect(-3, -9, 6, 16); g.fillRect(-6, -11, 12, 4); break;
        case 1: g.fillStyle = '#8a9098'; g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(Math.cos(i * Math.PI / 3) * 7, Math.sin(i * Math.PI / 3) * 7); g.fill(); g.fillStyle = '#5a5e64'; g.beginPath(); g.arc(0, 0, 3, 0, Math.PI * 2); g.fill(); break;
        case 2: g.fillStyle = '#8a7a6a'; g.beginPath(); g.ellipse(0, 0, 8, 6, 0.4, 0, Math.PI * 2); g.fill(); break;
        case 3: g.strokeStyle = '#b8a070'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, 4); g.quadraticCurveTo(0, -10, 10, 2); g.stroke(); break;
        case 4: g.fillStyle = 'rgba(240,240,250,0.85)'; g.beginPath(); g.moveTo(-9, -6); g.lineTo(8, -8); g.lineTo(10, 6); g.lineTo(-7, 8); g.fill(); break;
        default: g.fillStyle = '#c0c4c8'; g.fillRect(-2, -8, 4, 14); g.beginPath(); g.arc(0, -8, 4, 0, Math.PI * 2); g.fill();
      }
    } else {
      switch (o.kind) {
        case 0: g.fillStyle = '#f2f2f2'; g.fillRect(-18, -4, 36, 8); break;
        case 1: g.strokeStyle = '#3a3e44'; g.lineWidth = 2; g.beginPath(); g.moveTo(-25, 0); g.lineTo(25, 0); g.stroke(); break;
        case 2: g.fillStyle = '#e8d24a'; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#6a6a6a'; g.lineWidth = 2; g.stroke(); break;
        default: g.fillStyle = '#3a3e44'; g.fillRect(-12, -8, 24, 16); g.strokeStyle = '#6a6e74'; for (let i = -8; i <= 8; i += 4) { g.beginPath(); g.moveTo(i, -8); g.lineTo(i, 8); g.stroke(); }
      }
    }
    if (o.found) { g.strokeStyle = '#4ab06a'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.stroke(); }
    if (o.wrong) { g.strokeStyle = '#e0584a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -10); g.lineTo(10, 10); g.moveTo(10, -10); g.lineTo(-10, 10); g.stroke(); }
    g.restore();
  };

  const ref = useCanvasLoop(({ g, dt, mouse, pressed }) => {
    const s = st.current;
    if (s.done) return false;
    s.time -= dt;
    s.msgT -= dt;
    s.skill = Math.max(0, s.skill - dt);
    s.skillCd = Math.max(0, s.skillCd - dt);
    if (pressed.has(' ') && s.skillCd <= 0) { s.skill = 3; s.skillCd = 9 * cdMul(ctx.skill); s.msg = '🦅 매의 눈! 이물질이 반짝인다'; s.msgT = 1.2; }

    const speed = 90 + (DURATION - s.time) * 2.5;
    s.scroll = (s.scroll + speed * dt) % 80;
    s.spawn -= dt;
    if (s.spawn <= 0 && s.time > 2) {
      s.spawn = rand(0.25, 0.5);
      const fod = Math.random() < 0.5;
      if (fod) s.totalFod++;
      s.objs.push({ x: rand(150, GW - 150), y: -20, fod, kind: Math.floor(Math.random() * (fod ? FOD_KINDS.length : OK_KINDS.length)), found: false, wrong: false });
    }
    for (const o of s.objs) o.y += speed * dt;
    if (mouse.clicked) {
      let best: Obj | null = null, bd = 26;
      for (const o of s.objs) { if (o.found || o.wrong) continue; const d = Math.hypot(o.x - mouse.x, o.y - mouse.y); if (d < bd) { bd = d; best = o; } }
      if (best) {
        if (best.fod) { best.found = true; s.found++; s.msg = `✅ FOD 수거: ${FOD_KINDS[best.kind]}`; }
        else { best.wrong = true; s.wrong++; s.msg = `❌ "${OK_KINDS[best.kind]}"는 FOD가 아니다`; }
        s.msgT = 0.9;
      }
    }
    for (const o of s.objs) if (o.y > GH + 20 && o.fod && !o.found) { s.missed++; o.found = true; }
    s.objs = s.objs.filter((o) => o.y < GH + 30);

    // 활주로
    g.fillStyle = '#6a8a4a'; g.fillRect(0, 0, GW, GH);
    g.fillStyle = '#4e5258'; g.fillRect(120, 0, GW - 240, GH);
    g.fillStyle = '#e8d24a'; g.fillRect(120, 0, 4, GH); g.fillRect(GW - 124, 0, 4, GH);
    g.fillStyle = '#f2f2f2';
    for (let y = -80 + s.scroll; y < GH; y += 80) g.fillRect(GW / 2 - 4, y, 8, 40);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = -80 + s.scroll; y < GH; y += 80) g.fillRect(120, y + 60, GW - 240, 2);
    for (const o of s.objs) drawObj(g, o, s.skill > 0);
    // 워크다운 인원 줄
    g.fillStyle = 'rgba(30,60,120,0.6)';
    for (let x = 140; x < GW - 120; x += 50) { g.beginPath(); g.arc(x, GH - 8, 10, Math.PI, 0); g.fill(); }

    drawTimerBar(g, s.time, DURATION);
    hudText(g, `수거 ${s.found} · 놓침 ${s.missed} · 오인 ${s.wrong}`, 14, 30, 'left', 16);
    hudText(g, s.skillCd > 0 ? `매의 눈 ${s.skillCd.toFixed(0)}s` : '[Space] 매의 눈', GW - 14, 30, 'right', 15, s.skillCd > 0 ? '#aaa' : '#ffe14a');
    hudText(g, '활주로 위 이물질(FOD)만 클릭!', GW / 2, 56, 'center', 14);
    if (s.msgT > 0) hudText(g, s.msg, GW / 2, 100, 'center', 20, '#ffe14a');

    if (s.time <= 0 && !s.done) {
      s.done = true;
      const total = Math.max(1, s.totalFod);
      const score = Math.max(0, Math.min(100, ((s.found - s.wrong * 0.6) / total) * 105));
      onFinish(score, `FOD ${total}개 중 ${s.found}개 수거, 오인 ${s.wrong}회`);
      return false;
    }
  });

  return <GameCanvas canvasRef={ref} cursor="crosshair" />;
}
