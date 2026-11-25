'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useGame } from '../state/store';
import { BRANCHES } from '../data/branches';
import { NPC_SKINS } from '../data/npcs';
import { findSpecies } from '../data/monsters';
import ParadeStar from './ParadeStar';
import SceneryCanvas from './SceneryCanvas';
import UnownLetter from './UnownLetter';
import MonsterCanvas from './MonsterCanvas';
import type { ResistOpts, StoryBg } from './storyEvents';

/** 스토리 장면 배경: 옥상 · 기록 보관실 · 불 꺼진 서가 · 연병장 · 라디오 */
export function StoryBackdrop({ bg }: { bg: StoryBg }) {
  const s = useGame();
  const me = findSpecies(s.speciesId)?.look;
  const buddy = NPC_SKINS[s.branch].buddy.look;
  const cap = BRANCHES[s.branch].cap;
  return (
    <div className="story-bg">
      <SceneryCanvas scene={bg} day={s.day} />
      {bg === 'roof' && (
        <div className="story-bg-actors roof">
          {me && <MonsterCanvas look={me} size={96} dir="up" cap={cap} />}
          <MonsterCanvas look={buddy} size={96} dir="up" cap={cap} />
        </div>
      )}
      {bg === 'library' && (
        <div className="story-bg-unown">
          {Array.from({ length: 6 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.35}s` }}><UnownLetter index={i} /></span>)}
        </div>
      )}
      {bg === 'parade' && (
        <div className="story-bg-actors parade">
          <span className="jirachi"><ParadeStar /></span>
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
