'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/store';
import { TEXT_SPEED, useSettings } from '../state/settings';
import { fmt } from '../engine/text';
import { DREAMS, DREAM_FADED, type DreamLine } from '../data/story';
import PuzzleBox from './PuzzleBox';
import { setBgmMood, type CueId } from '../engine/audio';
import { useLineSound } from '../engine/soundCues';
import MonsterCanvas from './MonsterCanvas';
import type { MonsterLook } from '../types';

const JIRACHI = { sprite: 'jirachi', body: '#f8f4d0', belly: '#ffffff', accent: '#f2d050', shape: 'round', ears: 'tuft', tail: 'none', eyes: 'sleepy', mouth: 'smile' } as MonsterLook;

/**
 * 꿈: 별의 언덕 — 하루 끝(결산) 전에 보는 짧은 장면.
 * 첫날은 어두운 생활관(베개 밑 별 조각)에서 시작해 별의 언덕으로 넘어간다.
 */
export default function Dream() {
  const s = useGame();
  const dream = DREAMS[s.day];
  // 기억이 30 이하면 꿈이 흐려진다 (첫날 꿈과 지라치가 이름을 밝히는 밤은 그대로)
  const faded = s.memory <= 30 && s.day > 1 && s.day !== 11;
  const lines = useMemo<(DreamLine & { scene: 'room' | 'hill' })[]>(() => [
    ...(dream?.room ?? []).map((l) => ({ ...l, scene: 'room' as const })),
    ...((faded ? DREAM_FADED : dream?.hill) ?? []).map((l) => ({ ...l, scene: 'hill' as const })),
  ], [dream, faded]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const ctx = { branch: s.branch, name: s.name, day: s.day };
  const line = lines[idx];
  const text = line ? fmt(line.text, ctx) : '';
  const [typeMs, typeStep] = TEXT_SPEED[useSettings((st) => st.textSpeed)];

  useEffect(() => {
    if (typeMs === 0) { setTyped(text.length); return; }
    setTyped(0);
    const iv = setInterval(() => setTyped((t) => (t >= text.length ? t : t + typeStep)), typeMs);
    return () => clearInterval(iv);
  }, [text, typeMs, typeStep]);

  // 🔊 꿈의 소리: 엄마 목소리엔 심장 소리, 빛의 목소리는 높고 맑게. 소등한 생활관 장면은 곡 없이 조용하다
  // ✨ 빛이 모습을 드러내는 연출 (data/story.ts DreamLine.fx): reveal 줄부터는 지라치가 보인다
  const revealAt = lines.findIndex((l) => l.fx === 'reveal');
  const revealed = revealAt >= 0 && idx >= revealAt;
  const fx = line?.fx ?? null;
  const fxRef = useRef<{ fx: string | null; revealed: boolean; since: number }>({ fx: null, revealed: false, since: 0 });
  if (fxRef.current.fx !== fx || fxRef.current.revealed !== revealed) fxRef.current = { fx, revealed, since: typeof performance !== 'undefined' ? performance.now() : 0 };
  const lineCueId: CueId | null = fx === 'gather' ? 'sfx_evo_pulse' : fx === 'flash' ? 'sfx_flash' : fx === 'reveal' ? 'jingle_star_fragment' : line?.who === 'mom' ? 'sfx_heartbeat' : line?.who === 'jirachi' && idx > 0 && lines[idx - 1].who !== 'jirachi' ? 'sfx_star_twinkle' : null;
  useLineSound(idx, text, typed, { cue: lineCueId, spoken: !!line && line.who !== 'narr', voice: line?.who === 'voice' || line?.who === 'jirachi' ? 1.5 : line?.who === 'mom' ? 0.8 : 1 });
  const inRoom = line?.scene === 'room';
  useEffect(() => {
    setBgmMood(inRoom ? 'none' : null);
    return () => setBgmMood(null);
  }, [inRoom]);

  // 🧩 P-01 첫 번째 조각: 첫날 밤, 언덕의 창문을 처음 본 직후에 조각을 끼운다
  const [puzzle, setPuzzle] = useState(false);
  const puzzleAt = lines.findIndex((l) => l.scene === 'hill');
  const advance = useCallback(() => {
    if (puzzle) return;
    if (typed < text.length) { setTyped(text.length); return; }
    if (s.day === 1 && idx === puzzleAt && !useGame.getState().puzzles['P-01']?.solved) { setPuzzle(true); return; }
    if (idx < lines.length - 1) setIdx(idx + 1);
    else useGame.getState().finishDream();
  }, [puzzle, typed, text.length, idx, lines.length, s.day, puzzleAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') { e.preventDefault(); advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  // 배경: 별이 반짝이는 언덕 / 어두운 생활관
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<'room' | 'hill'>('room');
  sceneRef.current = line?.scene ?? 'hill';
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 }));
    let raf = 0;
    const draw = (now: number) => {
      const t = now / 1000;
      const w = (c.width = c.clientWidth), h = (c.height = c.clientHeight);
      if (sceneRef.current === 'room') {
        // 소등한 생활관: 어둠 속 침상과 베개 밑 별 조각
        g.fillStyle = '#0a0c18'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#1a2030'; g.fillRect(w * 0.25, h * 0.52, w * 0.5, h * 0.2);
        g.fillStyle = '#26304a'; g.fillRect(w * 0.27, h * 0.5, w * 0.16, h * 0.07);
        const pulse = 0.6 + Math.sin(t * 3) * 0.4;
        const gx = w * 0.35, gy = h * 0.54;
        const glow = g.createRadialGradient(gx, gy, 0, gx, gy, 60 * pulse + 20);
        glow.addColorStop(0, 'rgba(255,240,170,0.95)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
        g.fillStyle = glow; g.beginPath(); g.arc(gx, gy, 80, 0, Math.PI * 2); g.fill();
        star(g, gx, gy, 9, '#fff6c0');
      } else {
        // 별의 언덕
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#070a1e'); sky.addColorStop(0.7, '#1a2350'); sky.addColorStop(1, '#2a2050');
        g.fillStyle = sky; g.fillRect(0, 0, w, h);
        for (const st of stars) {
          g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + st.p));
          g.fillStyle = '#ffffff';
          g.beginPath(); g.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
        // 별똥별
        const sx = ((t * 0.18) % 1.4) * w, sy = h * 0.12 + ((t * 0.18) % 1.4) * h * 0.18;
        g.strokeStyle = 'rgba(255,255,220,0.7)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 70, sy - 18); g.stroke();
        // 멀리 떠 있는 내 방 창문 (날이 갈수록 멀어진다)
        const far = Math.min(1, (useGame.getState().day - 1) / 11);
        const ww = 70 - far * 30, wx = w * 0.78, wy = h * 0.22 + far * 30;
        g.fillStyle = '#ffd890'; g.fillRect(wx - ww / 2, wy - ww * 0.6, ww, ww * 1.2);
        g.fillStyle = '#5a4030'; g.fillRect(wx - 2, wy - ww * 0.6, 4, ww * 1.2); g.fillRect(wx - ww / 2, wy - 2, ww, 4);
        // 언덕
        g.fillStyle = '#10142a';
        g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(w * 0.4, h * 0.55, w, h * 0.78); g.lineTo(w, h); g.fill();
        // 빛 (지라치의 목소리)
        const ox = w * 0.42, oy = h * 0.38 + Math.sin(t * 1.6) * 8;
        const f = fxRef.current;
        const age = (now - f.since) / 1000;
        if (f.fx === 'gather') {
          // 언덕의 별빛이 한 점으로 빨려 들어간다: 사방에서 모여드는 빛줄기 + 점점 커지는 빛
          const k = Math.min(1, age / 2.2);
          g.strokeStyle = 'rgba(255,245,190,0.75)'; g.lineWidth = 2;
          for (let i = 0; i < 18; i++) {
            const a = (Math.PI * 2 * i) / 18 + t * 0.4;
            const r1 = (1 - ((age * 0.9 + i * 0.13) % 1)) * Math.max(w, h) * 0.55 + 30;
            g.beginPath(); g.moveTo(ox + Math.cos(a) * r1, oy + Math.sin(a) * r1); g.lineTo(ox + Math.cos(a) * (r1 - 46), oy + Math.sin(a) * (r1 - 46)); g.stroke();
          }
          const rr = 70 + k * 90 + Math.sin(t * 14) * 6;
          const gg = g.createRadialGradient(ox, oy, 0, ox, oy, rr);
          gg.addColorStop(0, 'rgba(255,255,240,1)'); gg.addColorStop(0.4, 'rgba(255,236,150,0.8)'); gg.addColorStop(1, 'rgba(255,230,120,0)');
          g.fillStyle = gg; g.beginPath(); g.arc(ox, oy, rr, 0, Math.PI * 2); g.fill();
          star(g, ox, oy, 12 + k * 14, '#ffffff');
        } else if (f.fx === 'flash') {
          // 눈부시게 터진다
          const rr = 160 + age * 900;
          const gg = g.createRadialGradient(ox, oy, 0, ox, oy, rr);
          gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(0.6, 'rgba(255,250,220,0.9)'); gg.addColorStop(1, 'rgba(255,240,180,0)');
          g.fillStyle = gg; g.fillRect(0, 0, w, h);
        } else if (f.revealed) {
          // 모습을 드러낸 뒤: 등 뒤로 은은한 후광만 남는다 (지라치는 화면 위에 따로 그린다)
          const rr = 96 + Math.sin(t * 2) * 8;
          const gg = g.createRadialGradient(ox, oy, 0, ox, oy, rr);
          gg.addColorStop(0, 'rgba(255,246,190,0.75)'); gg.addColorStop(0.5, 'rgba(255,230,120,0.3)'); gg.addColorStop(1, 'rgba(255,230,120,0)');
          g.fillStyle = gg; g.beginPath(); g.arc(ox, oy, rr, 0, Math.PI * 2); g.fill();
        } else {
          const og = g.createRadialGradient(ox, oy, 0, ox, oy, 70);
          og.addColorStop(0, 'rgba(255,250,200,1)'); og.addColorStop(0.35, 'rgba(255,230,120,0.6)'); og.addColorStop(1, 'rgba(255,230,120,0)');
          g.fillStyle = og; g.beginPath(); g.arc(ox, oy, 70, 0, Math.PI * 2); g.fill();
          star(g, ox, oy, 12, '#fffbe0');
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!line) return null;
  const speaker = line.who === 'voice' ? '??? (빛)' : line.who === 'jirachi' ? '지라치' : line.who === 'mom' ? '엄마 (아주 먼 곳에서)' : line.who === 'me' ? s.name : '';
  return (
    <div className="dream-scene" onClick={advance}>
      <canvas ref={ref} className="dream-canvas" />
      {fx === 'flash' && <div className="dream-flash" />}
      {revealed && line.scene === 'hill' && (
        <div className="dream-jirachi" key="jirachi"><span><MonsterCanvas look={JIRACHI} size={150} /></span></div>
      )}
      <div className="dream-title">{line.scene === 'room' ? `DAY ${s.day} · 소등` : '꿈 · 별의 언덕'}</div>
      <div className="dialogue-wrap dream-box">
        <div className="dialogue">
          <div className="dialogue-body">
            {speaker ? <div className="speaker">{speaker}</div> : <div className="speaker narr">　</div>}
            <div className={`dialogue-text ${line.who === 'narr' ? 'narr' : ''}`}>
              {text.slice(0, typed)}
              {typed >= text.length && <span className="next-indicator">▼</span>}
            </div>
          </div>
        </div>
      </div>
      {puzzle && (
        <PuzzleBox
          id="P-01"
          mustSolve
          onClose={() => {}}
          onSolved={(reward) => {
            // 퍼즐 보상으로 첫 단서를 적는다 (꿈이 끝날 때의 기본 보상 대신)
            if (dream?.clue) useGame.getState().findClue(dream.clue, reward);
            setPuzzle(false);
            setIdx((i) => Math.min(i + 1, lines.length - 1));
          }}
        />
      )}
    </div>
  );
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}
