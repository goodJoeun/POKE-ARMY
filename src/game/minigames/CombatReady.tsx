'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../types';
import { cdMul } from './common';

interface Item { id: string; icon: string; name: string }

const REQUIRED: Record<string, Item[]> = {
  army: [
    { id: 'helmet', icon: '🪖', name: '방탄헬멧' },
    { id: 'vest', icon: '🦺', name: '전투조끼' },
    { id: 'rifle', icon: '🎯', name: '개인화기' },
    { id: 'mag', icon: '🧰', name: '탄입대' },
    { id: 'canteen', icon: '🧴', name: '수통' },
    { id: 'mask', icon: '😷', name: '방독면' },
    { id: 'bag', icon: '🎒', name: '전투배낭' },
  ],
  navy: [
    { id: 'life', icon: '🛟', name: '구명조끼' },
    { id: 'helmet', icon: '🪖', name: '방탄헬멧' },
    { id: 'mask', icon: '😷', name: '방독면' },
    { id: 'light', icon: '🔦', name: '손전등' },
    { id: 'radio', icon: '📻', name: '무전기' },
    { id: 'aid', icon: '🩹', name: '구급낭' },
    { id: 'gloves', icon: '🧤', name: '방화장갑' },
  ],
  air: [
    { id: 'helmet', icon: '🪖', name: '방탄헬멧' },
    { id: 'mask', icon: '😷', name: '방독면' },
    { id: 'vest', icon: '🦺', name: '전투조끼' },
    { id: 'rifle', icon: '🎯', name: '개인화기' },
    { id: 'canteen', icon: '🧴', name: '수통' },
    { id: 'ration', icon: '🥫', name: '전투식량' },
    { id: 'radio', icon: '📻', name: '무전기' },
  ],
};

const DISTRACT: Item[] = [
  { id: 'comic', icon: '📚', name: '만화책' },
  { id: 'choco', icon: '🍫', name: '초코파이' },
  { id: 'game', icon: '🎮', name: '게임기' },
  { id: 'phone', icon: '📱', name: '휴대폰' },
  { id: 'doll', icon: '🧸', name: '애착인형' },
  { id: 'ramen', icon: '🍜', name: '컵라면' },
  { id: 'letter', icon: '💌', name: '연애편지' },
  { id: 'glasses', icon: '🕶️', name: '선글라스' },
  { id: 'pillow', icon: '🛏️', name: '베개' },
];

const DURATION = 38;

export default function CombatReady({ ctx, onFinish }: MinigameProps) {
  const req = REQUIRED[ctx.branch];
  const grid = useMemo(() => {
    const d = [...DISTRACT].sort(() => Math.random() - 0.5).slice(0, 9);
    return [...req, ...d].sort(() => Math.random() - 0.5);
  }, [req]);
  const [packed, setPacked] = useState<string[]>([]);
  const [time, setTime] = useState(DURATION);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState<string | null>(null);
  const [hint, setHint] = useState(0);
  const [cd, setCd] = useState(0);
  const [msg, setMsg] = useState('');
  const done = useRef(false);
  const stateRef = useRef({ packed, time, mistakes });
  stateRef.current = { packed, time, mistakes };

  const skillName = ctx.branch === 'army' ? '불꽃 집중' : ctx.branch === 'navy' ? '물 흐르듯' : '매의 눈';

  const finish = (p: string[], tm: number, mk: number) => {
    if (done.current) return;
    done.current = true;
    const complete = p.length === req.length;
    // 완료 시 40점 + 남은 시간 비율 × 70 (약 18초 완료 ≈ A, 10초 이내 ≈ S)
    const score = complete ? Math.max(0, Math.min(100, 40 + (tm / DURATION) * 70 - mk * 7)) : (p.length / req.length) * 40 - mk * 3;
    onFinish(Math.max(0, score), complete ? `${(DURATION - tm).toFixed(1)}초 만에 완료, 실수 ${mk}회` : `${p.length}/${req.length}개 챙김 (시간 초과)`);
  };

  useEffect(() => {
    const iv = setInterval(() => {
      setTime((t) => {
        const nt = t - 0.1;
        if (nt <= 0) { finish(stateRef.current.packed, 0, stateRef.current.mistakes); return 0; }
        return nt;
      });
      setCd((c) => Math.max(0, c - 0.1));
      setHint((h) => Math.max(0, h - 0.1));
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); activateSkill(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const activateSkill = () => {
    if (cd > 0) return;
    setCd(8 * cdMul(ctx.skill));
    setHint(1.6);
  };

  const click = (it: Item) => {
    if (done.current || packed.includes(it.id)) return;
    const next = req[packed.length];
    if (it.id === next.id) {
      const np = [...packed, it.id];
      setPacked(np);
      setMsg(`✅ ${it.name}`);
      if (np.length === req.length) finish(np, time, mistakes);
    } else {
      setMistakes((m) => m + 1);
      setTime((t) => Math.max(0, t - 3));
      setShake(it.id);
      setTimeout(() => setShake(null), 300);
      const isReq = req.some((r) => r.id === it.id);
      setMsg(isReq ? `⚠️ 순서가 틀렸다! 다음은 "${next.name}"` : `❌ ${it.name}은(는) 전투 물자가 아니다! (-3초)`);
    }
  };

  const nextId = req[packed.length]?.id;

  return (
    <div className="combat">
      <div className="combat-head">
        <div className="siren">🚨 상황 발생! {ctx.branch === 'navy' ? '전투배치!' : '전투준비태세!'}</div>
        <div className="timer-bar"><span style={{ width: `${(time / DURATION) * 100}%`, background: time > 12 ? '#4ab06a' : '#e0584a' }} /></div>
        <div className="hud-dim">{time.toFixed(1)}초 · 실수 {mistakes}회</div>
      </div>
      <div className="combat-body">
        <div className="checklist">
          <div className="cl-title">📋 휴대 물자 (순서대로!)</div>
          {req.map((r, i) => (
            <div key={r.id} className={`cl-item ${packed.includes(r.id) ? 'done' : i === packed.length ? 'now' : ''}`}>
              {i + 1}. {r.icon} {r.name}
            </div>
          ))}
          <button className={`skill-btn ${cd > 0 ? 'cd' : ''}`} onClick={activateSkill}>
            {cd > 0 ? `${skillName} ${cd.toFixed(1)}s` : `[Space] ${skillName}`}
          </button>
          <div className="hud-dim small">다음 물자 위치를 잠깐 밝혀준다</div>
        </div>
        <div className="locker">
          <div className="cl-title">🗄️ 관물대</div>
          <div className="locker-grid">
            {grid.map((it) => (
              <button
                key={it.id}
                className={`locker-item ${packed.includes(it.id) ? 'taken' : ''} ${shake === it.id ? 'shake' : ''} ${hint > 0 && it.id === nextId ? 'hint' : ''}`}
                onClick={() => click(it)}
              >
                <span className="li-icon">{it.icon}</span>
                <span className="li-name">{it.name}</span>
              </button>
            ))}
          </div>
          <div className="combat-msg">{msg}</div>
        </div>
      </div>
    </div>
  );
}
