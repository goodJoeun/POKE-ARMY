'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Choice, Line, NpcId } from '../types';
import { useGame } from '../state/store';
import { TEXT_SPEED, useSettings } from '../state/settings';
import { fmt } from '../engine/text';
import { npcSpeaker, playerSpeaker, type SpeakerInfo } from '../engine/speakers';
import MonsterCanvas from './MonsterCanvas';
import { playCue, playSfx } from '../engine/audio';
import { lineCue, useLineSound } from '../engine/soundCues';

export interface DialogueScript {
  npc?: NpcId;
  /** 주요 NPC가 아닌 화자 (부대 엑스트라 등) — who: 'npc' 줄에 쓰인다 */
  custom?: SpeakerInfo;
  lines: Line[];
  choices?: Choice[];
}

interface Props {
  script: DialogueScript;
  onChoice?: (c: Choice) => void;
  onClose: () => void;
}

export default function DialogueBox({ script, onChoice, onClose }: Props) {
  const { branch, name, day, speciesId } = useGame();
  const ctx = { branch, name, day };
  const [lines, setLines] = useState<Line[]>(script.lines);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'lines' | 'choices' | 'reply'>('lines');
  const [picked, setPicked] = useState<Choice | null>(null);
  const [typed, setTyped] = useState(0);

  const line = lines[idx];
  const text = line ? fmt(line.text, ctx) : '';

  const [typeMs, typeStep] = TEXT_SPEED[useSettings((st) => st.textSpeed)];
  const showTips = useSettings((st) => st.showTips);
  useEffect(() => {
    if (!text) { setTyped(0); return; }
    if (typeMs === 0) { setTyped(text.length); return; } // 즉시 표시
    setTyped(0);
    const iv = setInterval(() => setTyped((t) => (t >= text.length ? t : t + typeStep)), typeMs);
    return () => clearInterval(iv);
  }, [text, idx, phase, typeMs, typeStep]);

  // 🔊 새 줄 · 타자 소리 (선택지를 고르는 동안은 조용히)
  useLineSound(`${phase}-${idx}`, text, typed, { cue: line?.sfx, silent: phase === 'choices' });

  const speaker: SpeakerInfo | null = useMemo(() => {
    if (!line) return null;
    if (line.who === 'narr') return null;
    if (line.who === 'me') return playerSpeaker(branch, speciesId, name, day);
    if (line.who === 'npc' && script.custom) return script.custom;
    const id = (line.who === 'npc' ? script.npc : line.who) as NpcId | undefined;
    if (!id) return null;
    return npcSpeaker(branch, id, day);
  }, [line, branch, speciesId, name, day, script.npc, script.custom]);

  const advance = useCallback(() => {
    if (phase === 'choices') return;
    if (typed < text.length) { setTyped(text.length); return; }
    if (idx < lines.length - 1) { setIdx(idx + 1); return; }
    if (phase === 'lines' && script.choices && script.choices.length > 0) { setPhase('choices'); return; }
    onClose();
  }, [phase, typed, text.length, idx, lines.length, script.choices, onClose]);

  const choose = useCallback((c: Choice) => {
    // 🔊 고른 말에 어울리는 소리 (노크 등) → 없으면 선택음, 나쁜 대답이면 낮은 소리
    const cue = lineCue(c.text);
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
        if (n >= 1 && n <= script.choices.length) { e.preventDefault(); choose(script.choices[n - 1]); }
        return;
      }
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') { e.preventDefault(); advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, script.choices, choose, advance]);

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
            <MonsterCanvas look={speaker.look} size={124} cap={speaker.cap} />
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
              {script.choices.map((c, i) => (
                <button key={i} className="choice" onClick={() => choose(c)}>
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
