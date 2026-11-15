'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useGame } from '../state/store';
import { BRANCHES } from '../data/branches';
import { NPC_SKINS } from '../data/npcs';
import { findSpecies } from '../data/monsters';
import type { MonsterLook } from '../types';
import MonsterCanvas from './MonsterCanvas';
import type { ResistOpts, StoryBg } from './storyEvents';

const UNOWN: MonsterLook = { sprite: 'unown', body: '#3a3a4a', belly: '#3a3a4a', accent: '#3a3a4a', shape: 'round' } as MonsterLook;
const JIRACHI: MonsterLook = { sprite: 'jirachi', body: '#f8f4d0', belly: '#ffffff', accent: '#f2d050', shape: 'round' } as MonsterLook;

/** 스토리 장면 배경: 옥상 · 기록 보관실 · 불 꺼진 서가 · 연병장 · 라디오 */
export function StoryBackdrop({ bg }: { bg: StoryBg }) {
  const s = useGame();
  const ref = useRef<HTMLCanvasElement>(null);
  const day = s.day;
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    const stars = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.5 + 0.3, p: Math.random() * 6 }));
    const dust = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: 0.01 + Math.random() * 0.02 }));
    let raf = 0;
    const draw = (now: number) => {
      const t = now / 1000;
      const w = (c.width = c.clientWidth), h = (c.height = c.clientHeight);
      if (bg === 'roof') {
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#060a1c'); sky.addColorStop(0.75, '#1c2550'); sky.addColorStop(1, '#2a2448');
        g.fillStyle = sky; g.fillRect(0, 0, w, h);
        for (const st of stars) { g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + st.p)); g.fillStyle = '#fff'; g.beginPath(); g.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 1;
        // 날이 갈수록 크고 낮아지는 별
        const k = Math.min(1, Math.max(0, (day - 4) / 8));
        const sx = w * 0.62, sy = h * (0.16 + k * 0.18), r = 18 + k * 60;
        const gl = g.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2);
        gl.addColorStop(0, 'rgba(255,250,210,1)'); gl.addColorStop(0.3, 'rgba(255,230,140,0.55)'); gl.addColorStop(1, 'rgba(255,230,140,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(sx, sy, r * 2.2, 0, Math.PI * 2); g.fill();
        // 물탱크 · 안테나 · 난간
        g.fillStyle = '#141828'; g.fillRect(w * 0.06, h * 0.42, w * 0.14, h * 0.26); g.fillRect(w * 0.84, h * 0.2, 4, h * 0.48);
        g.fillStyle = '#0e1220'; g.fillRect(0, h * 0.68, w, h * 0.32);
        g.fillStyle = '#2a3048'; g.fillRect(0, h * 0.66, w, 6);
        for (let x = 0; x < w; x += 46) g.fillRect(x, h * 0.66, 5, h * 0.1);
      } else if (bg === 'archive') {
        g.fillStyle = '#1c1812'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#2a2418'; g.fillRect(0, 0, w, h * 0.62);
        // 벽 가득한 단체 사진 액자
        for (let i = 0; i < 12; i++) {
          const fx = w * 0.08 + (i % 6) * w * 0.145, fy = h * 0.08 + Math.floor(i / 6) * h * 0.24;
          g.fillStyle = '#6a5030'; g.fillRect(fx, fy, w * 0.12, h * 0.18);
          g.fillStyle = `rgba(${200 - i * 6},${190 - i * 6},${160 - i * 6},1)`; g.fillRect(fx + 5, fy + 5, w * 0.12 - 10, h * 0.18 - 10);
          g.fillStyle = 'rgba(40,30,20,0.55)';
          for (let j = 0; j < 5; j++) g.fillRect(fx + 10 + j * (w * 0.02), fy + h * 0.1, 6, 10);
          // 해마다 같은 자리의 같은 얼굴 (붉게 반짝)
          if (Math.sin(t * 2 + i) > 0.2) { g.fillStyle = 'rgba(230,80,60,0.85)'; g.fillRect(fx + 10, fy + h * 0.1, 6, 10); }
        }
        g.fillStyle = '#3a2c1a'; g.fillRect(w * 0.3, h * 0.7, w * 0.4, h * 0.08);
        for (const d of dust) { d.y = (d.y + d.v / 30) % 1; g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(d.x * w, d.y * h, 2, 2); }
      } else if (bg === 'library') {
        g.fillStyle = '#05060c'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#0c0e18';
        for (let i = 0; i < 5; i++) g.fillRect(w * (0.05 + i * 0.19), h * 0.2, w * 0.15, h * 0.55);
      } else if (bg === 'parade') {
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#8ab8e8'); sky.addColorStop(1, '#e8f0f8');
        g.fillStyle = sky; g.fillRect(0, 0, w, h);
        g.fillStyle = '#d8c8a0'; g.fillRect(0, h * 0.68, w, h * 0.32);
        g.fillStyle = '#a89070'; g.fillRect(w * 0.36, h * 0.56, w * 0.28, h * 0.14);
        const gl = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, 140 + Math.sin(t * 2) * 12);
        gl.addColorStop(0, 'rgba(255,255,230,0.95)'); gl.addColorStop(1, 'rgba(255,240,170,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(w * 0.5, h * 0.42, 160, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = '#14161a'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#3a3428'; g.fillRect(w * 0.35, h * 0.3, w * 0.3, h * 0.22);
        g.fillStyle = '#c8b070'; g.fillRect(w * 0.4, h * 0.34, w * 0.2, h * 0.05);
        g.strokeStyle = '#58e078'; g.lineWidth = 2; g.beginPath();
        for (let x = 0; x < w; x += 4) {
          const ph = (x / w) * 12 + t * 6;
          const beat = Math.abs(Math.sin(ph / 4)) > 0.97 ? -40 : 0;
          g.lineTo(x, h * 0.66 + Math.sin(ph * 3) * (4 + Math.random() * 3) + beat);
        }
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bg, day]);

  const me = findSpecies(s.speciesId)?.look;
  const buddy = NPC_SKINS[s.branch].buddy.look;
  const cap = BRANCHES[s.branch].cap;
  return (
    <div className="story-bg">
      <canvas ref={ref} />
      {bg === 'roof' && (
        <div className="story-bg-actors roof">
          {me && <MonsterCanvas look={me} size={96} dir="up" cap={cap} />}
          <MonsterCanvas look={buddy} size={96} dir="up" cap={cap} />
        </div>
      )}
      {bg === 'library' && (
        <div className="story-bg-unown">
          {Array.from({ length: 6 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.35}s` }}><MonsterCanvas look={UNOWN} size={56} /></span>)}
        </div>
      )}
      {bg === 'parade' && (
        <div className="story-bg-actors parade">
          <span className="jirachi"><MonsterCanvas look={JIRACHI} size={120} /></span>
        </div>
      )}
    </div>
  );
}

/** 저항 게이지: 졸음(최면)이 차오르기 전에 버티기 / 가만히 서 있기 */
export function ResistMeter({ opts, onDone }: { opts: ResistOpts; onDone: (ok: boolean) => void }) {
  const [v, setV] = useState(0);
  const [el, setEl] = useState(0);
  const [ready, setReady] = useState(false);
  const st = useRef({ v: 0, last: '' as string, done: false });
  const end = useCallback((ok: boolean) => { if (st.current.done) return; st.current.done = true; setTimeout(() => onDone(ok), 500); }, [onDone]);
  useEffect(() => { const tm = setTimeout(() => setReady(true), 900); return () => clearTimeout(tm); }, []);
  useEffect(() => {
    if (!ready) return;
    const t0 = performance.now();
    let prev = t0;
    const iv = setInterval(() => {
      const now = performance.now();
      const dt = (now - prev) / 1000; prev = now;
      const e = (now - t0) / 1000;
      setEl(e);
      if (st.current.done) return;
      if (opts.mode !== 'still') {
        st.current.v = Math.min(1, st.current.v + dt * (opts.rise ?? 0.5));
        setV(st.current.v);
        if (st.current.v >= 1) { end(false); return; }
      }
      if (e >= opts.secs) end(true);
    }, 50);
    const onKey = (ev: KeyboardEvent) => {
      if (st.current.done) return;
      ev.preventDefault(); ev.stopPropagation();
      if (opts.mode === 'still') { if (!ev.repeat) end(false); return; }
      if (ev.repeat) return;
      const k = ev.key;
      if (opts.mode === 'mash' && (k === ' ' || k === 'e' || k === 'E' || k === 'Enter')) st.current.v = Math.max(0, st.current.v - 0.1);
      if (opts.mode === 'alt' && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd')) {
        const side = k === 'ArrowLeft' || k === 'a' ? 'L' : 'R';
        if (side !== st.current.last) st.current.v = Math.max(0, st.current.v - 0.12);
        st.current.last = side;
      }
      setV(st.current.v);
    };
    window.addEventListener('keydown', onKey, true);
    return () => { clearInterval(iv); window.removeEventListener('keydown', onKey, true); };
  }, [ready, opts, end]);
  const done = st.current.done;
  const ok = done && (opts.mode === 'still' ? el >= opts.secs : v < 1);
  return (
    <div className="cer-banner shout resist" onClick={() => { if (opts.mode === 'mash' && !done && ready) { st.current.v = Math.max(0, st.current.v - 0.1); setV(st.current.v); } }}>
      <div className="cer-title">{opts.title}</div>
      <div className="cer-sub">{!ready ? '준비…' : done ? (ok ? '버텼다!' : opts.mode === 'still' ? '앗, 움직였다!' : '…눈이 감긴다') : opts.sub}</div>
      <div className="shout-meter resist-meter"><i style={{ width: `${(opts.mode === 'still' ? Math.min(1, el / opts.secs) : v) * 100}%` }} /></div>
      <div className="cer-sub">{opts.mode === 'still' ? `${Math.max(0, Math.ceil(opts.secs - el))}초` : `남은 시간 ${Math.max(0, Math.ceil(opts.secs - el))}초 · 게이지가 끝까지 차면 실패`}</div>
    </div>
  );
}
