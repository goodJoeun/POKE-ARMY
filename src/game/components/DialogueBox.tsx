'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Choice, Line, NpcId } from '../types';
import { useGame } from '../state/store';
import { TEXT_SPEED, useSettings } from '../state/settings';
import { fmt } from '../engine/text';
import { npcSpeaker, playerSpeaker, type SpeakerInfo } from '../engine/speakers';
import MonsterCanvas from './MonsterCanvas';
import { selfUnseen } from '../data/errands';
import { playCue, playSfx } from '../engine/audio';
import { lineCue, useLineSound } from '../engine/soundCues';

export interface DialogueScript {
  npc?: NpcId;
  /** 주요 NPC가 아닌 화자 (부대 엑스트라 등) — who: 'npc' 줄에 쓰인다 */
  custom?: SpeakerInfo;
  lines: Line[];
  choices?: Choice[];
  /** 정답이 하나뿐인 문답 (점호 문제 · 추리 정리 등): grade 'good'이 정답. 테스터 모드에서는 E로 정답을 고른다 */
  quiz?: boolean;
}

interface Props {
  script: DialogueScript;
  onChoice?: (c: Choice) => void;
  onClose: () => void;
}

export default function DialogueBox({ script, onChoice, onClose }: Props) {
  const { branch, name, day, speciesId } = useGame();
  const unseen = useGame(selfUnseen);
  const ctx = { branch, name, day };
  const [lines, setLines] = useState<Line[]>(script.lines);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'lines' | 'choices' | 'reply'>('lines');
  const [picked, setPicked] = useState<Choice | null>(null);
  const [typed, setTyped] = useState(0);
  // 선택지 커서: ↑↓(방향패드)로 옮기고 확인(E · Enter · 터치 확인 버튼)으로 고른다
  const [sel, setSel] = useState(0);
  const choicesAt = useRef(0);
  useEffect(() => { if (phase === 'choices') { setSel(0); choicesAt.current = performance.now(); } }, [phase]);

  const line = lines[idx];
  const text = line ? fmt(line.text, ctx) : '';

  const [typeMs, typeStep] = TEXT_SPEED[useSettings((st) => st.textSpeed)];
  const showTips = useSettings((st) => st.showTips);
  const tester = useSettings((st) => st.testerMode);
  useEffect(() => {
    if (!text) { setTyped(0); return; }
    if (typeMs === 0) { setTyped(text.length); return; } // 즉시 표시
    setTyped(0);
    const iv = setInterval(() => setTyped((t) => (t >= text.length ? t : t + typeStep)), typeMs);
    return () => clearInterval(iv);
  }, [text, idx, phase, typeMs, typeStep]);

  // 🔊 새 줄 · 타자 소리 (선택지를 고르는 동안은 조용히)
  useLineSound(`${phase}-${idx}`, text, typed, { cue: line?.sfx, hush: line?.hush, silent: phase === 'choices', spoken: !!line && line.who !== 'narr' });

  const speaker: SpeakerInfo | null = useMemo(() => {
    if (!line) return null;
    if (line.who === 'narr') return null;
    if (line.who === 'me') return playerSpeaker(branch, speciesId, name, day, unseen);
    if (line.who === 'npc' && script.custom) return script.custom;
    const id = (line.who === 'npc' ? script.npc : line.who) as NpcId | undefined;
    if (!id) return null;
    return npcSpeaker(branch, id, day);
  }, [line, branch, speciesId, name, day, unseen, script.npc, script.custom]);

  const advance = useCallback(() => {
    if (phase === 'choices') return;
    if (typed < text.length) { setTyped(text.length); return; }
    if (idx < lines.length - 1) { setIdx(idx + 1); return; }
    if (phase === 'lines' && script.choices && script.choices.length > 0) { setPhase('choices'); return; }
    onClose();
  }, [phase, typed, text.length, idx, lines.length, script.choices, onClose]);

  const choose = useCallback((c: Choice) => {
    // 🔊 고른 말에 어울리는 소리 (노크 등) → 없으면 선택음, 나쁜 대답이면 낮은 소리
    const cue = lineCue(c.text, true);
    if (cue) playCue(cue, 0.9);
    else playSfx(c.grade === 'bad' ? 'sfx_cancel' : 'sfx_confirm', 0.6);
    setPicked(c);
    onChoice?.(c);
    setLines(c.reply.length ? c.reply : [{ who: 'narr', text: '…' }]);
    setIdx(0);
    setPhase('reply');
  }, [onChoice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'choices' && script.choices) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= script.choices.length) { e.preventDefault(); choose(script.choices[n - 1]); return; }
        const count = script.choices.length;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); playSfx('sfx_cursor', 0.5); setSel((v) => (v + 1) % count); }
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); playSfx('sfx_cursor', 0.5); setSel((v) => (v - 1 + count) % count); }
        // 대사를 넘기던 손이 그대로 첫 선택지를 골라 버리지 않게, 선택지가 뜬 직후엔 잠깐 받지 않는다
        if ((e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') && !e.repeat && performance.now() - choicesAt.current > 400) {
          e.preventDefault();
          // 🧪 테스터 모드: 정답이 있는 문답이면 E는 커서와 상관없이 정답을 고른다
          const right = (e.key === 'e' || e.key === 'E') && script.quiz && useSettings.getState().testerMode
            ? script.choices.find((x) => x.grade === 'good')
            : undefined;
          const c = right ?? script.choices[sel];
          if (c) choose(c);
        }
        return;
      }
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') { e.preventDefault(); advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, script.choices, script.quiz, choose, advance, sel]);

  return (
    <div className="dialogue-wrap" onClick={advance}>
      {phase === 'reply' && picked?.tip && showTips && (
        <div className="tip-card" onClick={(e) => e.stopPropagation()}>
          <div className="tip-title">📘 군대 상식</div>
          <div>{fmt(picked.tip, ctx)}</div>
        </div>
      )}
      <div className="dialogue">
        {speaker?.look && (
          <div className="portrait">
            <MonsterCanvas look={speaker.look} size={124} cap={speaker.cap} unknown={speaker.unknown} />
          </div>
        )}
        <div className="dialogue-body">
          {speaker ? (
            <div className="speaker">
              {speaker.name} <span className="speaker-sub">{speaker.sub}</span>
            </div>
          ) : (
            <div className="speaker narr">　</div>
          )}
          {phase === 'choices' && script.choices ? (
            <div className="choices" onClick={(e) => e.stopPropagation()}>
              <div className="choice-prompt">{fmt(lines[lines.length - 1]?.text ?? '', ctx)}</div>
              {script.quiz && tester && <div className="tester-hint">🧪 테스터 모드: E를 누르면 정답</div>}
              {script.choices.map((c, i) => (
                <button key={i} className={`choice ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => choose(c)}>
                  <span className="choice-num">{i + 1}</span> {fmt(c.text, ctx)}
                </button>
              ))}
            </div>
          ) : (
            <div className={`dialogue-text ${line?.who === 'narr' ? 'narr' : ''}`}>
              {text.slice(0, typed)}
              {typed >= text.length && <span className="next-indicator">▼</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
