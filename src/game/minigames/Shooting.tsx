'use client';
import { useRef } from 'react';
import type { MinigameProps } from '../types';
import { GH, GW, GameCanvas, cdMul, hudText, useCanvasLoop, rand } from './common';

const ROUNDS = 20;

export default function Shooting({ ctx, onFinish }: MinigameProps) {
  const st = useRef({
    idx: 0, hits: 0, target: null as null | { x: number; y: number; r: number; dist: number; life: number },
    gap: 1.2, recoil: 0, breath: 100, skill: 0, skillCd: 0, msg: '', msgT: 0, done: false,
    holes: [] as { x: number; y: number }[], flash: 0,
  });

  const ref = useCanvasLoop(({ g, dt, t, mouse, keys, pressed }) => {
    const s = st.current;
    if (s.done) return false;
    s.msgT -= dt;
    s.flash = Math.max(0, s.flash - dt);
    s.recoil = Math.max(0, s.recoil - dt * 3);
    s.skill = Math.max(0, s.skill - dt);
    s.skillCd = Math.max(0, s.skillCd - dt);
    const holding = keys['shift'] && s.breath > 0;
    s.breath = Math.max(0, Math.min(100, s.breath + (holding ? -40 : 18) * dt));
    if (pressed.has(' ') && s.skillCd <= 0) { s.skill = 3; s.skillCd = 10 * cdMul(ctx.skill); s.msg = '🔥 불꽃 집중! 호흡이 안정된다'; s.msgT = 1.2; }

    let amp = 22 + s.recoil * 30;
    if (holding) amp *= 0.3;
    if (s.skill > 0) amp *= 0.1;
    const ax = mouse.x + Math.sin(t * 1.7) * amp + Math.sin(t * 4.3) * amp * 0.3;
    const ay = mouse.y + Math.cos(t * 1.3) * amp * 0.8 + Math.sin(t * 3.1) * amp * 0.25;

    if (!s.target) {
      s.gap -= dt;
      if (s.gap <= 0 && s.idx < ROUNDS) {
        const dist = [100, 200, 250][Math.floor(Math.random() * 3)];
        const r = dist === 100 ? 26 : dist === 200 ? 17 : 13;
        const horizon = dist === 100 ? 300 : dist === 200 ? 245 : 215;
        s.target = { x: rand(90, GW - 90), y: horizon, r, dist, life: 3.2 };
      }
    } else {
      s.target.life -= dt;
      if (mouse.clicked) {
        const d = Math.hypot(ax - s.target.x, ay - (s.target.y - s.target.r * 1.6));
        s.recoil = 1;
        s.flash = 0.08;
        s.holes.push({ x: ax, y: ay });
        if (d <= s.target.r) { s.hits++; s.msg = `🎯 명중! (${s.target.dist}m)`; }
        else s.msg = '💨 빗나감';
        s.msgT = 0.9;
        s.target = null; s.idx++; s.gap = 0.9;
      } else if (s.target.life <= 0) {
        s.msg = '⌛ 표적이 내려갔다'; s.msgT = 0.9;
        s.target = null; s.idx++; s.gap = 0.9;
      }
    }

    // 사격장
    const sky = g.createLinearGradient(0, 0, 0, 220);
    sky.addColorStop(0, '#8ac4ea'); sky.addColorStop(1, '#d6ecf6');
    g.fillStyle = sky; g.fillRect(0, 0, GW, 220);
    g.fillStyle = '#6a8a4a';
    g.beginPath(); g.moveTo(0, 210); for (let x = 0; x <= GW; x += 60) g.lineTo(x, 190 + Math.sin(x * 0.02) * 14); g.lineTo(GW, 220); g.lineTo(0, 220); g.fill();
    g.fillStyle = '#b89a6a'; g.fillRect(0, 210, GW, GH);
    for (const yy of [215, 245, 300]) { g.fillStyle = 'rgba(90,70,40,0.35)'; g.fillRect(0, yy, GW, 3); }
    if (s.target) {
      const tg = s.target;
      const up = Math.min(1, (3.2 - tg.life) * 5);
      g.fillStyle = '#5a4a2a'; g.fillRect(tg.x - 2, tg.y - tg.r * 1.6 * up, 4, tg.r * 1.6 * up);
      g.save();
      g.translate(tg.x, tg.y - tg.r * 1.6 * up);
      g.fillStyle = '#3a4a2a';
      g.beginPath(); g.ellipse(0, 0, tg.r * 0.75, tg.r, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0, -tg.r * 1.15, tg.r * 0.45, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#f2f2ea'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, tg.r * 0.5, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    // 모래주머니
    g.fillStyle = '#9a8a5a';
    for (let x = -20; x < GW; x += 70) { g.beginPath(); g.ellipse(x + 35, GH - 20, 40, 22, 0, 0, Math.PI * 2); g.fill(); }
    if (s.flash > 0) { g.fillStyle = 'rgba(255,240,180,0.35)'; g.fillRect(0, 0, GW, GH); }

    // 조준경
    g.strokeStyle = s.skill > 0 ? '#ff7a2e' : '#1a1a1a'; g.lineWidth = 2;
    g.beginPath(); g.arc(ax, ay, 18, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(ax - 28, ay); g.lineTo(ax - 6, ay); g.moveTo(ax + 6, ay); g.lineTo(ax + 28, ay);
    g.moveTo(ax, ay - 28); g.lineTo(ax, ay - 6); g.moveTo(ax, ay + 6); g.lineTo(ax, ay + 28); g.stroke();
    g.fillStyle = '#d03a3a'; g.beginPath(); g.arc(ax, ay, 2, 0, Math.PI * 2); g.fill();

    hudText(g, `탄 ${ROUNDS - s.idx}/${ROUNDS} · 명중 ${s.hits}`, 14, 28, 'left', 18);
    hudText(g, s.skillCd > 0 ? `불꽃 집중 ${s.skillCd.toFixed(0)}s` : '[Space] 불꽃 집중', GW - 14, 28, 'right', 15, s.skillCd > 0 ? '#555' : '#c04010');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(14, 40, 140, 10);
    g.fillStyle = '#3a8fe0'; g.fillRect(14, 40, 1.4 * s.breath, 10);
    hudText(g, '[Shift] 호흡 정지', 160, 50, 'left', 12);
    hudText(g, '클릭: 사격 · 표적 가운데를 노려라', GW / 2, GH - 50, 'center', 14);
    if (s.msgT > 0) hudText(g, s.msg, GW / 2, 90, 'center', 22, '#ffe14a');

    if (s.idx >= ROUNDS && !s.target && !s.done) {
      s.done = true;
      const sharp = s.hits >= 18 ? ' — 🏅 특등사수!' : s.hits >= 15 ? ' — 1급 사수' : '';
      onFinish((s.hits / ROUNDS) * 100, `${ROUNDS}발 중 ${s.hits}발 명중${sharp}`);
      return false;
    }
  });

  return <GameCanvas canvasRef={ref} cursor="none" />;
}
