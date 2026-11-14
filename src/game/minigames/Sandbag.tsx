'use client';
import { useRef } from 'react';
import type { MinigameProps } from '../types';
import { BRANCHES } from '../data/branches';
import { GH, GW, GameCanvas, hudText, useCanvasLoop } from './common';

const BASE_W = 220;
const LAYER_H = 30;
const TARGET = 10;

export default function Sandbag({ ctx, onFinish }: MinigameProps) {
  const b = BRANCHES[ctx.branch];
  const st = useRef({
    stack: [{ x: GW / 2 - BASE_W / 2, w: BASE_W }] as { x: number; w: number }[],
    cur: { x: 0, w: BASE_W, dir: 1 }, speed: 200, falling: [] as { x: number; y: number; w: number; vy: number }[],
    skillUsed: false, msg: '', msgT: 0, done: false, endT: 0, perfect: 0,
  });
  const skillName = ctx.branch === 'army' ? '숯불 다지기' : ctx.branch === 'navy' ? '단단한 집게' : '바람 고정';

  const ref = useCanvasLoop(({ g, dt, t, mouse, pressed }) => {
    const s = st.current;
    if (s.done) return false;
    s.msgT -= dt;
    const layers = s.stack.length - 1;
    const topY = GH - 40 - s.stack.length * LAYER_H;

    if (s.endT > 0) {
      s.endT -= dt;
      if (s.endT <= 0) {
        s.done = true;
        const last = s.stack[s.stack.length - 1];
        const score = Math.min(100, (layers / TARGET) * 85 + (layers >= TARGET ? (last.w / BASE_W) * 15 : 0));
        onFinish(score, `모래주머니 ${layers}/${TARGET}단 적재${s.perfect ? `, 완벽 정렬 ${s.perfect}회` : ''}`);
        return false;
      }
    } else {
      s.cur.x += s.cur.dir * s.speed * dt;
      if (s.cur.x < 40) { s.cur.x = 40; s.cur.dir = 1; }
      if (s.cur.x + s.cur.w > GW - 40) { s.cur.x = GW - 40 - s.cur.w; s.cur.dir = -1; }

      if (pressed.has('q') && !s.skillUsed) {
        s.skillUsed = true;
        s.cur.w = BASE_W;
        const top = s.stack[s.stack.length - 1];
        top.x = Math.max(40, top.x - (BASE_W - top.w) / 2);
        top.w = BASE_W;
        s.msg = `✨ ${skillName}! 진지가 단단해졌다`; s.msgT = 1.5;
      }
      if (pressed.has(' ') || mouse.clicked) {
        const top = s.stack[s.stack.length - 1];
        const l = Math.max(top.x, s.cur.x);
        const r = Math.min(top.x + top.w, s.cur.x + s.cur.w);
        const ov = r - l;
        if (ov <= 0) {
          s.falling.push({ x: s.cur.x, y: topY, w: s.cur.w, vy: 0 });
          s.msg = '💥 와르르… 진지가 무너졌다'; s.msgT = 2;
          s.endT = 1.5;
        } else {
          if (Math.abs(ov - top.w) < 6) { s.perfect++; s.msg = '👌 완벽!'; s.msgT = 0.8; s.stack.push({ x: top.x, w: top.w }); }
          else {
            if (s.cur.x < top.x) s.falling.push({ x: s.cur.x, y: topY, w: top.x - s.cur.x, vy: 0 });
            if (s.cur.x + s.cur.w > top.x + top.w) s.falling.push({ x: top.x + top.w, y: topY, w: s.cur.x + s.cur.w - (top.x + top.w), vy: 0 });
            s.stack.push({ x: l, w: ov });
          }
          const nt = s.stack[s.stack.length - 1];
          s.cur = { x: s.cur.dir > 0 ? 40 : GW - 40 - nt.w, w: nt.w, dir: s.cur.dir };
          s.speed += 22;
          if (s.stack.length - 1 >= TARGET) { s.msg = '🏆 진지 구축 완료!'; s.msgT = 2; s.endT = 1.3; }
        }
      }
    }

    // 배경
    const sky = g.createLinearGradient(0, 0, 0, GH);
    sky.addColorStop(0, ctx.branch === 'navy' ? '#5a7a9a' : '#9ac8e8'); sky.addColorStop(1, '#e8f0f2');
    g.fillStyle = sky; g.fillRect(0, 0, GW, GH);
    if (ctx.branch === 'navy') { g.fillStyle = '#3a6a9a'; g.fillRect(0, GH - 70, GW, 70); }
    g.fillStyle = ctx.branch === 'air' ? '#5a5e64' : '#a08a5a'; g.fillRect(0, GH - 40, GW, 40);
    const camShift = Math.max(0, s.stack.length * LAYER_H - 260);
    g.save();
    g.translate(0, camShift);
    const drawBag = (x: number, y: number, w: number) => {
      g.fillStyle = '#b8a878';
      g.beginPath(); g.roundRect(x, y, w, LAYER_H - 3, 10); g.fill();
      g.strokeStyle = '#8a7a50'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(90,70,40,0.4)';
      for (let i = x + 20; i < x + w - 10; i += 30) { g.beginPath(); g.moveTo(i, y + 4); g.lineTo(i, y + LAYER_H - 7); g.stroke(); }
    };
    s.stack.forEach((sb, i) => drawBag(sb.x, GH - 40 - (i + 1) * LAYER_H, sb.w));
    if (s.endT <= 0) drawBag(s.cur.x, topY + Math.sin(t * 6) * 2 - 6, s.cur.w);
    for (const f of s.falling) { f.vy += 900 * dt; f.y += f.vy * dt; drawBag(f.x, f.y, f.w); }
    s.falling = s.falling.filter((f) => f.y < GH + 200);
    g.restore();

    hudText(g, `${b.games.sandbag} · ${layers}/${TARGET}단`, 14, 30, 'left', 18);
    hudText(g, '[Space/클릭] 내려놓기', GW / 2, 30, 'center', 15);
    hudText(g, s.skillUsed ? `${skillName} 사용함` : `[Q] ${skillName} (1회)`, GW - 14, 30, 'right', 15, s.skillUsed ? '#888' : '#c06a10');
    if (s.msgT > 0) hudText(g, s.msg, GW / 2, 80, 'center', 22, '#d0501a');
  });

  return <GameCanvas canvasRef={ref} />;
}
