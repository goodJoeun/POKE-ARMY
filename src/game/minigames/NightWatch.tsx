'use client';
import { useRef, useState } from 'react';
import type { MinigameProps } from '../types';
import { BRANCHES } from '../data/branches';
import { NPC_SKINS } from '../data/npcs';
import { drawMonster } from '../engine/drawMonster';
import { GH, GW, GameCanvas, cdMul, hudText, drawTimerBar, useCanvasLoop, rand } from './common';

const DURATION = 50;

interface Ev {
  at: number;
  kind: 'patrol' | 'toilet' | 'fire';
  done: boolean;
}

export default function NightWatch({ ctx, onFinish }: MinigameProps) {
  const b = BRANCHES[ctx.branch];
  const sleepers = (['sgt', 'senior', 'buddy', 'junior', 'junior2'] as const).map((id) => NPC_SKINS[ctx.branch][id].look);
  const [question, setQuestion] = useState<null | { kind: Ev['kind']; options: { text: string; ok: boolean }[]; remain: number }>(null);
  const st = useRef({
    time: DURATION, drowsy: 20, strikes: 0, good: 0, bad: 0, blackout: 0, cd: 0, slap: 0, skillCd: 0, warm: 0, noise: 0, woke: 0,
    events: [
      { at: DURATION - rand(8, 12), kind: 'patrol', done: false },
      { at: DURATION - rand(20, 26), kind: 'toilet', done: false },
      { at: DURATION - rand(32, 38), kind: 'patrol', done: false },
      { at: DURATION - rand(42, 46), kind: 'fire', done: false },
    ] as Ev[],
    q: null as null | { kind: Ev['kind']; options: { text: string; ok: boolean }[]; remain: number },
    msg: '', msgT: 0, done: false,
  });

  const OPTIONS: Record<Ev['kind'], { text: string; ok: boolean }[]> = {
    patrol: [
      { text: `"${b.salute}! 불침번 근무 중 이상 무!"`, ok: true },
      { text: '"헉, 깜짝이야!"', ok: false },
      { text: '(자는 척한다)', ok: false },
    ],
    toilet: [
      { text: '화장실 가는 인원을 확인하고 근무일지에 기록한다', ok: true },
      { text: '못 본 척한다', ok: false },
      { text: '"빨리 다녀와라~" 하고 다시 존다', ok: false },
    ],
    fire: [
      { text: '타는 냄새의 원인을 즉시 확인하고 당직사관에게 보고한다', ok: true },
      { text: '누가 라면 끓이나 보다… 무시한다', ok: false },
      { text: '생활관 전원을 큰 소리로 깨운다', ok: false },
    ],
  };
  const PROMPT: Record<Ev['kind'], string> = {
    patrol: '🔦 당직사관이 순찰을 왔다!',
    toilet: '🚶 누군가 침상에서 일어나 밖으로 나간다.',
    fire: '👃 어디선가 타는 냄새가 난다…',
  };

  const answer = (ok: boolean) => {
    const s = st.current;
    if (!s.q) return;
    if (ok) { s.good++; s.msg = '✅ 정확한 대응!'; } else { s.bad++; s.msg = '❌ 잘못된 대응…'; }
    s.msgT = 1.5;
    s.q = null;
    setQuestion(null);
  };

  const skillName = ctx.branch === 'army' ? '체온 올리기' : ctx.branch === 'navy' ? '찬물 세수' : '야행성 집중';

  const ref = useCanvasLoop(({ g, dt, t, pressed }) => {
    const s = st.current;
    if (s.done) return false;
    if (s.q) {
      s.q.remain -= dt;
      for (let i = 1; i <= 3; i++) if (pressed.has(String(i))) answer(s.q.options[i - 1].ok);
      if (s.q && s.q.remain <= 0) { s.bad++; s.msg = '⌛ 대응하지 못했다…'; s.msgT = 1.5; s.q = null; setQuestion(null); }
    } else {
      s.time -= dt;
    }
    s.cd = Math.max(0, s.cd - dt);
    s.skillCd = Math.max(0, s.skillCd - dt);
    s.warm = Math.max(0, s.warm - dt);
    s.slap = Math.max(0, s.slap - dt);
    s.msgT -= dt;

    if (s.blackout > 0) {
      s.blackout -= dt;
    } else if (!s.q) {
      const rate = (8 + Math.sin(t * 0.7) * 4 + (DURATION - s.time) * 0.12) * (s.warm > 0 ? 0.35 : 1);
      s.drowsy += rate * dt;
      // 정신차리기는 소음을 만든다 — 연타하면 생활관 인원이 깬다
      s.noise = Math.max(0, s.noise - 15 * dt);
      if (pressed.has(' ') && s.cd <= 0) {
        s.drowsy = Math.max(0, s.drowsy - 18); s.cd = 0.3; s.slap = 0.2;
        s.noise += 14;
        if (s.noise >= 100) { s.woke++; s.noise = 30; s.msg = '😠 "아 좀 조용히 해!" 생활관 인원이 깼다'; s.msgT = 1.8; }
      }
      if (pressed.has('q') && s.skillCd <= 0) {
        s.skillCd = 14 * cdMul(ctx.skill);
        if (ctx.branch === 'navy') s.drowsy = 0; else s.warm = 6;
        s.msg = `✨ ${skillName}!`; s.msgT = 1.4;
      }
      if (s.drowsy >= 100) { s.strikes++; s.blackout = 1.6; s.drowsy = 45; s.msg = '💤 깜빡 졸았다…!'; s.msgT = 1.8; }
      for (const e of s.events) {
        if (!e.done && s.time <= e.at) {
          e.done = true;
          const opts = [...OPTIONS[e.kind]].sort(() => Math.random() - 0.5);
          s.q = { kind: e.kind, options: opts, remain: 5 };
          setQuestion({ ...s.q });
          break;
        }
      }
    }

    // 그리기: 어두운 생활관
    const grd = g.createLinearGradient(0, 0, 0, GH);
    grd.addColorStop(0, '#141a2e'); grd.addColorStop(1, '#232a44');
    g.fillStyle = grd; g.fillRect(0, 0, GW, GH);
    // 창문 달빛
    g.fillStyle = 'rgba(180,200,255,0.12)';
    g.fillRect(60, 40, 120, 80); g.fillRect(540, 40, 120, 80);
    g.fillStyle = '#e8ecff'; g.beginPath(); g.arc(120, 70, 14, 0, Math.PI * 2); g.fill();
    // 침상
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 140;
      g.fillStyle = '#2e3a2e'; g.fillRect(x - 50, 250, 100, 110);
      g.fillStyle = '#3e5a3e'; g.fillRect(x - 46, 290, 92, 66);
      drawMonster(g, sleepers[i], x, 300, 70, { t: t + i, sleeping: true, shadow: false });
      g.fillStyle = '#3e5a3e'; g.fillRect(x - 46, 296, 92, 60);
    }
    // 이벤트 연출
    if (s.q?.kind === 'patrol') {
      const lg = g.createRadialGradient(GW - 120, 200, 10, GW - 120, 200, 260);
      lg.addColorStop(0, 'rgba(255,240,180,0.55)'); lg.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = lg; g.fillRect(0, 0, GW, GH);
    }
    if (s.q?.kind === 'fire') {
      g.fillStyle = `rgba(120,120,120,${0.25 + Math.sin(t * 3) * 0.05})`;
      g.fillRect(0, 0, GW, GH);
    }
    // 눈꺼풀
    const lid = s.blackout > 0 ? GH / 2 : Math.max(0, (s.drowsy - 30) / 70) * (GH / 2) * 0.95;
    g.fillStyle = '#000';
    g.fillRect(0, 0, GW, lid);
    g.fillRect(0, GH - lid, GW, lid);
    if (s.slap > 0) { g.fillStyle = 'rgba(255,200,200,0.25)'; g.fillRect(0, 0, GW, GH); }

    drawTimerBar(g, s.time, DURATION);
    // 졸음 게이지
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(20, GH - 40, 260, 20);
    g.fillStyle = s.drowsy > 75 ? '#e0584a' : '#a070e0'; g.fillRect(20, GH - 40, 2.6 * Math.min(100, s.drowsy), 20);
    hudText(g, `졸음 ${Math.round(s.drowsy)}%  [Space] 정신차리기`, 26, GH - 25, 'left', 14);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(300, GH - 40, 140, 20);
    g.fillStyle = s.noise > 70 ? '#e0584a' : '#e0a030'; g.fillRect(300, GH - 40, 1.4 * Math.min(100, s.noise), 20);
    hudText(g, `소음 ${Math.round(s.noise)}%`, 306, GH - 25, 'left', 14);
    hudText(g, `근무 종료까지 ${Math.max(0, s.time).toFixed(0)}분`, GW - 20, 34, 'right', 16);
    hudText(g, s.skillCd > 0 ? `${skillName} ${s.skillCd.toFixed(0)}s` : `[Q] ${skillName}`, GW - 20, GH - 25, 'right', 14, s.skillCd > 0 ? '#aaa' : '#ffe14a');
    hudText(g, `졸음 ${s.strikes}회 · 대응 ${s.good}/${s.good + s.bad}`, 20, 34, 'left', 15);
    if (s.msgT > 0) hudText(g, s.msg, GW / 2, 90, 'center', 22, '#ffe14a');

    if (s.time <= 0 && !s.q) {
      s.done = true;
      const missed = s.events.filter((e) => !e.done).length;
      const score = Math.max(0, Math.min(100, 100 - s.strikes * 22 - s.bad * 18 - s.woke * 12 - missed * 10));
      onFinish(score, `졸음 ${s.strikes}회, 소란 ${s.woke}회, 상황 대응 ${s.good}/${s.good + s.bad}`);
      return false;
    }
  });

  return (
    <div className="mg-stack">
      <GameCanvas canvasRef={ref} />
      {question && (
        <div className="mg-question">
          <div className="mg-q-title">{PROMPT[question.kind]}</div>
          {question.options.map((o, i) => (
            <button key={i} className="choice" onClick={() => answer(o.ok)}>
              <span className="choice-num">{i + 1}</span> {o.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
