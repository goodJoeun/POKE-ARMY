'use client';
import { useRef } from 'react';
import type { MinigameProps } from '../types';
import { findSpecies } from '../data/monsters';
import { BRANCHES } from '../data/branches';
import { drawMonster, type Dir } from '../engine/drawMonster';
import { GH, GW, GameCanvas, cdMul, drawTimerBar, hudText, skillCooldownText, useCanvasLoop } from './common';

const COLS = 18, ROWS = 10, CELL = 40, TOP = 40;
const DURATION = 40;

export default function EnvCleanup({ ctx, onFinish }: MinigameProps) {
  const variant = ctx.season === 'winter' ? 'snow' : ctx.season === 'autumn' ? 'leaves' : 'weed';
  const look = findSpecies(ctx.speciesId)!.look;
  const cap = BRANCHES[ctx.branch].cap;
  const st = useRef({
    cells: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 1)),
    rocks: new Set<string>(['4,3', '9,6', '13,2', '15,7', '6,8']),
    x: 0.5, y: 5.5, dir: 'right' as Dir, moving: false,
    time: DURATION, cd: 0, boost: 0, spawn: 0, done: false,
    fx: [] as { x: number; y: number; r: number; life: number; col: string }[],
    msg: '', msgT: 0,
  });

  const skillName = ctx.branch === 'army' ? '불꽃 방사' : ctx.branch === 'navy' ? '물대포' : '날개 돌풍';

  const ref = useCanvasLoop(({ g, dt, t, keys, pressed }) => {
    const s = st.current;
    if (s.done) return false;
    s.time -= dt;
    s.cd = Math.max(0, s.cd - dt);
    s.boost = Math.max(0, s.boost - dt);
    s.msgT -= dt;

    // 이동
    let vx = 0, vy = 0;
    if (keys['arrowleft'] || keys['a']) vx -= 1;
    if (keys['arrowright'] || keys['d']) vx += 1;
    if (keys['arrowup'] || keys['w']) vy -= 1;
    if (keys['arrowdown'] || keys['s']) vy += 1;
    const sp = (s.boost > 0 ? 7 : 4.6) * dt;
    if (vx || vy) {
      const l = Math.hypot(vx, vy);
      const nx = Math.max(0.3, Math.min(COLS - 0.3, s.x + (vx / l) * sp));
      const ny = Math.max(0.3, Math.min(ROWS - 0.3, s.y + (vy / l) * sp));
      if (!s.rocks.has(`${Math.floor(nx)},${Math.floor(s.y)}`)) s.x = nx;
      if (!s.rocks.has(`${Math.floor(s.x)},${Math.floor(ny)}`)) s.y = ny;
      s.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
      s.moving = true;
    } else s.moving = false;

    // 치우기
    const cx = Math.floor(s.x), cy = Math.floor(s.y);
    if (s.cells[cy] && s.cells[cy][cx] > 0) s.cells[cy][cx] = Math.max(0, s.cells[cy][cx] - 4 * dt);

    // 기술 (군별로 정리 면적이 비슷하도록 조정: 원형 21칸 / 직선 3x8 / 전방 3x5+가속)
    if (pressed.has(' ') && s.cd <= 0) {
      s.cd = 5 * cdMul(ctx.skill);
      const clear = (x: number, y: number) => { if (s.cells[y] && s.cells[y][x] !== undefined) s.cells[y][x] = 0; };
      const [dx, dy] = s.dir === 'left' ? [-1, 0] : s.dir === 'right' ? [1, 0] : s.dir === 'up' ? [0, -1] : [0, 1];
      if (ctx.branch === 'army') {
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) clear(cx + x, cy + y);
        s.fx.push({ x: s.x, y: s.y, r: 2.4, life: 0.6, col: 'rgba(255,120,40,' });
        s.msg = variant === 'weed' ? '🔥 잡초를 태웠다! (산불 조심…!)' : '🔥 눈이 스르륵 녹는다!';
      } else if (ctx.branch === 'navy') {
        for (let i = 0; i <= 7; i++) for (let w = -1; w <= 1; w++) clear(cx + dx * i + (dy ? w : 0), cy + dy * i + (dx ? w : 0));
        s.fx.push({ x: s.x + dx * 3, y: s.y + dy * 3, r: 1.5, life: 0.5, col: 'rgba(80,160,255,' });
        s.msg = '💧 물대포 발사!';
      } else {
        for (let i = 0; i <= 5; i++) for (let w = -1; w <= 1; w++) clear(cx + dx * i + (dy ? w : 0), cy + dy * i + (dx ? w : 0));
        s.boost = 2.5;
        s.fx.push({ x: s.x + dx * 2, y: s.y + dy * 2, r: 2, life: 0.5, col: 'rgba(220,240,255,' });
        s.msg = '🌪️ 돌풍으로 싹 날려버렸다!';
      }
      s.msgT = 1.5;
    }

    // 다시 쌓임
    s.spawn -= dt;
    if (s.spawn <= 0) {
      s.spawn = 0.55;
      const x = Math.floor(Math.random() * COLS), y = Math.floor(Math.random() * ROWS);
      if (!s.rocks.has(`${x},${y}`)) s.cells[y][x] = Math.min(1, s.cells[y][x] + 0.5);
    }

    // 점수
    let total = 0, clean = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (s.rocks.has(`${x},${y}`)) continue;
      total++;
      if (s.cells[y][x] < 0.15) clean++;
    }
    const ratio = clean / total;

    // ── 그리기 ──
    const ground = variant === 'snow' ? '#8a8a8a' : '#b89a72';
    g.fillStyle = ground; g.fillRect(0, 0, GW, GH);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const px = x * CELL, py = TOP + y * CELL;
      if (s.rocks.has(`${x},${y}`)) {
        g.fillStyle = '#6a6a6a'; g.beginPath(); g.ellipse(px + 20, py + 22, 16, 13, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#8a8a8a'; g.beginPath(); g.ellipse(px + 16, py + 17, 7, 5, 0, 0, Math.PI * 2); g.fill();
        continue;
      }
      g.fillStyle = (x + y) % 2 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
      g.fillRect(px, py, CELL, CELL);
      const a = s.cells[y][x];
      if (a <= 0.02) continue;
      if (variant === 'snow') {
        g.fillStyle = `rgba(250,252,255,${0.35 + a * 0.65})`;
        g.fillRect(px, py, CELL, CELL);
        g.fillStyle = `rgba(210,225,240,${a})`;
        g.fillRect(px + 4, py + 26, 14, 5); g.fillRect(px + 22, py + 10, 12, 4);
      } else if (variant === 'weed') {
        g.fillStyle = `rgba(60,140,50,${0.4 + a * 0.6})`;
        for (let i = 0; i < 4; i++) {
          const bx = px + 6 + i * 9, by = py + 34;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 3, by - 10 - a * 14 - (i % 2) * 6); g.lineTo(bx + 6, by); g.fill();
        }
      } else {
        const cols = ['#d0782a', '#e8a040', '#b8502a'];
        for (let i = 0; i < 5; i++) {
          g.fillStyle = cols[(x + y + i) % 3];
          g.globalAlpha = 0.3 + a * 0.7;
          g.beginPath(); g.ellipse(px + 6 + ((i * 13 + x * 7) % 28), py + 6 + ((i * 11 + y * 5) % 28), 5, 3, i, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
      }
    }
    for (const f of s.fx) {
      f.life -= dt;
      g.fillStyle = f.col + Math.max(0, f.life) + ')';
      g.beginPath(); g.arc(f.x * CELL, TOP + f.y * CELL, f.r * CELL * (1.2 - f.life), 0, Math.PI * 2); g.fill();
    }
    s.fx = s.fx.filter((f) => f.life > 0);
    // 삽 / 낫
    drawMonster(g, look, s.x * CELL, TOP + s.y * CELL + 16, 42, { dir: s.dir, t, walking: s.moving, cap });
    g.fillStyle = 'rgba(30,30,30,0.85)'; g.fillRect(0, 0, GW, TOP);
    drawTimerBar(g, s.time, DURATION);
    hudText(g, `정리율 ${Math.round(ratio * 100)}%  (목표 90%)`, 12, 30);
    hudText(g, `남은 시간 ${Math.max(0, s.time).toFixed(1)}s`, GW / 2, 30, 'center');
    hudText(g, skillCooldownText(s.cd, skillName), GW - 12, 30, 'right', 15, s.cd > 0 ? '#aaaaaa' : '#ffe14a');
    if (s.msgT > 0) hudText(g, s.msg, GW / 2, GH - 16, 'center', 18, '#ffe14a');

    if (s.time <= 0 && !s.done) {
      s.done = true;
      const score = Math.max(0, Math.min(100, ((ratio - 0.35) / 0.55) * 100));
      const what = variant === 'snow' ? '제설' : variant === 'weed' ? '제초' : '낙엽 쓸기';
      onFinish(score, `${what} 정리율 ${Math.round(ratio * 100)}%`);
      return false;
    }
  });

  return <GameCanvas canvasRef={ref} />;
}
