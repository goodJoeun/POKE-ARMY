'use client';
import { useRef, useState } from 'react';
import type { MinigameProps, MonsterLook } from '../types';
import { BRANCHES } from '../data/branches';
import { NPC_SKINS } from '../data/npcs';
import { drawMonster } from '../engine/drawMonster';
import { getSprite } from '../engine/sprites';

/** 군별 야생 포켓몬 스프라이트 키 */
const WILD_SPRITE = { army: 'rattata', navy: 'wingull', air: 'meowth' } as const;
import { GH, GW, GameCanvas, cdMul, hudText, useCanvasLoop } from './common';

const PAIRS: [string, string][] = [
  ['백두산', '한라산'], ['등대', '파도'], ['구름', '무지개'], ['호랑이', '곶감'], ['별빛', '은하수'], ['나침반', '북극성'],
];
const DECOYS = ['소나기', '단풍잎', '고등어', '자전거', '가로등', '해바라기'];

type Kind = 'friend' | 'stranger' | 'animal' | 'officer';
interface Enc { kind: Kind; look: MonsterLook | null; reply: string }

export default function GuardDuty({ ctx, onFinish }: MinigameProps) {
  const b = BRANCHES[ctx.branch];
  const [pair] = useState(() => PAIRS[Math.floor(Math.random() * PAIRS.length)]);
  const [decision, setDecision] = useState<null | { reply: string; kind: Kind }>(null);
  const skins = NPC_SKINS[ctx.branch];
  const encounters = useRef<Enc[]>(
    ([
      { kind: 'friend', look: skins.buddy.look, reply: pair[1] },
      { kind: 'stranger', look: { ...skins.senior.look, sprite: 'ekans', body: '#5a5a5a', belly: '#8a8a8a' }, reply: DECOYS[Math.floor(Math.random() * DECOYS.length)] },
      { kind: 'animal', look: null, reply: '' },
      { kind: 'officer', look: skins.lt.look, reply: pair[1] },
      { kind: 'stranger', look: { ...skins.junior.look, sprite: 'koffing', body: '#4a4a5a' }, reply: '…어, 그게… 뭐더라?' },
      { kind: 'friend', look: skins.junior2?.look ?? skins.buddy.look, reply: pair[1] },
    ] as Enc[]).sort(() => Math.random() - 0.5),
  );
  const st = useRef({
    phase: 'memo' as 'memo' | 'approach' | 'decide' | 'gap' | 'end',
    timer: 4.5, idx: 0, dist: 0, challenged: false, score: 0, correct: 0, msg: '', msgT: 0, skill: 0, skillCd: 0, done: false, early: 0,
  });

  const skillName = ctx.branch === 'army' ? '횃불 조명' : ctx.branch === 'navy' ? '탐조등' : '야간 투시';
  const animalName = b.wildlife;

  const decide = (pass: boolean) => {
    const s = st.current;
    if (s.phase !== 'decide') return;
    const enc = encounters.current[s.idx];
    let ok = false;
    if (enc.kind === 'animal') ok = pass; // 동물: 확인 후 근무 지속(=통과 버튼)
    else ok = (enc.kind === 'friend' || enc.kind === 'officer') ? pass : !pass;
    if (ok) { s.score += 12; s.correct++; s.msg = '✅ 올바른 판단!'; }
    else { s.msg = enc.kind === 'stranger' ? '❌ 답어가 틀린 인원을 통과시켰다!' : enc.kind === 'animal' ? '❌ 동물 때문에 비상이 걸렸다…' : '❌ 아군을 붙잡아 두었다…'; }
    s.msgT = 2;
    s.phase = 'gap';
    s.timer = 1.3;
    setDecision(null);
  };

  const ref = useCanvasLoop(({ g, dt, t, pressed }) => {
    const s = st.current;
    if (s.done) return false;
    s.msgT -= dt;
    s.skill = Math.max(0, s.skill - dt);
    s.skillCd = Math.max(0, s.skillCd - dt);
    if (pressed.has('q') && s.skillCd <= 0 && s.phase === 'approach') { s.skill = 3; s.skillCd = 10 * cdMul(ctx.skill); }

    const enc = encounters.current[s.idx];
    if (s.phase === 'memo') {
      s.timer -= dt;
      if (s.timer <= 0) { s.phase = 'approach'; s.dist = 0; s.challenged = false; }
    } else if (s.phase === 'approach') {
      s.dist += dt * 0.22;
      if (pressed.has(' ')) {
        if (s.dist < 0.3) { s.early++; s.msg = '⚠️ 너무 멀다! 접근을 지켜보자.'; s.msgT = 1.2; }
        else {
          s.challenged = true;
          s.score += s.dist < 0.85 ? 5 : 2;
          s.phase = 'decide';
          setDecision({ reply: enc.kind === 'animal' ? `야생의 ${animalName}이(가) 나타났다! …놀라서 도망간다.` : `"${enc.reply}"`, kind: enc.kind });
        }
      }
      if (s.dist >= 1 && s.phase === 'approach') {
        s.msg = '❌ 수하 없이 초소 앞까지 접근을 허용했다!'; s.msgT = 2;
        s.phase = 'gap'; s.timer = 1.3;
      }
    } else if (s.phase === 'decide') {
      if (pressed.has('1')) decide(true);
      else if (pressed.has('2')) decide(false);
    } else if (s.phase === 'gap') {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.idx++;
        if (s.idx >= encounters.current.length) s.phase = 'end';
        else { s.phase = 'approach'; s.dist = 0; s.challenged = false; }
      }
    }

    // ── 그리기: 야간 초소 ──
    const sky = g.createLinearGradient(0, 0, 0, GH);
    sky.addColorStop(0, '#0a0e22'); sky.addColorStop(0.55, '#1a2240'); sky.addColorStop(1, '#2a2a30');
    g.fillStyle = sky; g.fillRect(0, 0, GW, GH);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + ((i * 37) % 10) / 20})`; g.fillRect((i * 97) % GW, (i * 53) % 180, 2, 2); }
    // 길
    g.fillStyle = ctx.branch === 'navy' ? '#3a3a42' : '#2e2e2a';
    g.beginPath(); g.moveTo(GW / 2 - 20, 210); g.lineTo(GW / 2 + 20, 210); g.lineTo(GW / 2 + 260, GH); g.lineTo(GW / 2 - 260, GH); g.fill();
    if (ctx.branch === 'navy') { g.fillStyle = '#10224a'; g.fillRect(0, 230, GW / 2 - 140, GH); g.fillRect(GW / 2 + 140, 230, GW, GH); }
    // 철조망
    g.strokeStyle = '#5a5a5a'; g.lineWidth = 2;
    for (let x = 0; x < GW; x += 40) { g.beginPath(); g.moveTo(x, 200); g.lineTo(x, 240); g.stroke(); }
    g.beginPath(); g.moveTo(0, 210); g.lineTo(GW, 210); g.moveTo(0, 225); g.lineTo(GW, 225); g.stroke();

    // 접근자
    if ((s.phase === 'approach' || s.phase === 'decide') && enc) {
      const scale = 0.15 + s.dist * 0.95;
      const y = 215 + s.dist * 200;
      const lit = s.skill > 0 || s.phase === 'decide';
      const wildLook: MonsterLook = { sprite: WILD_SPRITE[ctx.branch], body: '#8a6a4a', belly: '#c8a87a', accent: '#5a4a3a', shape: 'wide', ears: 'pointy', tail: 'none', eyes: 'dot', mouth: 'cat' };
      if (enc.kind === 'animal' && getSprite(wildLook.sprite, 'front')) {
        drawMonster(g, wildLook, GW / 2, y, 120 * scale, { t, walking: s.phase === 'approach', art: false, silhouette: lit ? undefined : '#0a0a12' });
      } else if (enc.kind === 'animal') {
        g.fillStyle = lit ? '#8a6a4a' : '#151515';
        g.beginPath(); g.ellipse(GW / 2, y - 30 * scale, 50 * scale, 26 * scale, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(GW / 2 + 45 * scale, y - 55 * scale, 18 * scale, 16 * scale, 0, 0, Math.PI * 2); g.fill();
        g.fillRect(GW / 2 - 35 * scale, y - 15 * scale, 8 * scale, 20 * scale);
        g.fillRect(GW / 2 + 25 * scale, y - 15 * scale, 8 * scale, 20 * scale);
        g.fillStyle = '#ffe14a';
        g.beginPath(); g.arc(GW / 2 + 50 * scale, y - 58 * scale, 3 * scale + 1, 0, Math.PI * 2); g.fill();
      } else if (enc.look && getSprite(enc.look.sprite, 'front')) {
        drawMonster(g, enc.look, GW / 2, y, 170 * scale, { t, walking: s.phase === 'approach', silhouette: lit ? undefined : '#0a0a12' });
      } else if (enc.look) {
        drawMonster(g, enc.look, GW / 2, y, 170 * scale, { t, walking: s.phase === 'approach', cap: enc.kind === 'officer' ? `officer-${b.cap}` : enc.kind === 'friend' ? b.cap : null });
        if (!lit) { g.fillStyle = 'rgba(5,5,10,0.88)'; g.fillRect(GW / 2 - 100 * scale, y - 180 * scale, 200 * scale, 185 * scale); }
      }
      // 수하 가능 영역 표시
      if (s.phase === 'approach' && s.dist >= 0.3) hudText(g, '[Space] "정지! 정지! 정지! 움직이면 쏜다! 누구냐!"', GW / 2, 190, 'center', 16, '#ffe14a');
    }
    if (s.skill > 0) {
      const lg = g.createRadialGradient(GW / 2, 330, 20, GW / 2, 330, 300);
      lg.addColorStop(0, 'rgba(255,250,200,0.25)'); lg.addColorStop(1, 'rgba(255,250,200,0)');
      g.fillStyle = lg; g.fillRect(0, 0, GW, GH);
    }
    // 초소 프레임
    g.fillStyle = '#3a4a32'; g.fillRect(0, 0, 40, GH); g.fillRect(GW - 40, 0, 40, GH); g.fillRect(0, GH - 30, GW, 30); g.fillRect(0, 0, GW, 22);

    hudText(g, `${b.games.guard} · ${Math.min(s.idx + 1, encounters.current.length)}/${encounters.current.length}`, 52, 48, 'left', 16);
    hudText(g, `문어: ${pair[0]}  /  답어: ${s.phase === 'memo' ? pair[1] : '???'}`, GW - 52, 48, 'right', 16, '#9ad0ff');
    hudText(g, s.skillCd > 0 ? `${skillName} ${s.skillCd.toFixed(0)}s` : `[Q] ${skillName}`, GW - 52, GH - 40, 'right', 14, s.skillCd > 0 ? '#aaa' : '#ffe14a');
    if (s.phase === 'memo') {
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(140, 120, GW - 280, 190);
      hudText(g, '📝 오늘의 암구호 (근무 투입 전 교육)', GW / 2, 160, 'center', 20, '#ffe14a');
      hudText(g, `문어 "${pair[0]}"  →  답어 "${pair[1]}"`, GW / 2, 215, 'center', 28);
      hudText(g, '답어를 정확히 말하는 인원만 통과! 암구호는 보안 유지!', GW / 2, 265, 'center', 15, '#cccccc');
    }
    if (s.msgT > 0) hudText(g, s.msg, GW / 2, 110, 'center', 20, '#ffe14a');

    if (s.phase === 'end' && !s.done) {
      s.done = true;
      const max = encounters.current.length * 17;
      const score = Math.max(0, Math.min(100, (s.score / max) * 100 - s.early * 3));
      onFinish(score, `${encounters.current.length}건 중 ${s.correct}건 올바르게 판단`);
      return false;
    }
  });

  return (
    <div className="mg-stack">
      <GameCanvas canvasRef={ref} />
      {decision && (
        <div className="mg-question">
          <div className="mg-q-title">
            {decision.kind === 'animal' ? '정체는…' : `문어 "${pair[0]}"! — 상대의 대답:`} <b>{decision.reply}</b>
          </div>
          <button className="choice" onClick={() => decide(true)}><span className="choice-num">1</span> {decision.kind === 'animal' ? '동물임을 확인하고 근무를 계속한다' : '통과시킨다'}</button>
          <button className="choice" onClick={() => decide(false)}><span className="choice-num">2</span> {decision.kind === 'animal' ? '비상! 즉시 상황 보고한다' : '정지시키고 상황을 보고한다'}</button>
        </div>
      )}
    </div>
  );
}
