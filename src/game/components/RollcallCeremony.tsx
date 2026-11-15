'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Choice, Line, LineWho } from '../types';
import { useGame } from '../state/store';
import { BRANCHES, TOTAL_DAYS } from '../data/branches';
import { buildSchedule, hasNightDuty } from '../data/schedule';
import type { SpeakerInfo } from '../engine/speakers';
import type { CeremonyCtl, CeremonyInfo } from '../engine/ceremony';
import DialogueBox, { type DialogueScript } from './DialogueBox';

/** 병영생활 행동강령 (제창 순서) */
const CODE_OF_CONDUCT: { line: string; wrong: string[]; tip: string }[] = [
  {
    line: '분대장만이 분대원에 대한 지시 및 명령권을 가진다',
    wrong: ['선임병은 후임병에게 지시 및 명령할 수 있다', '계급이 높은 병사가 생활관을 통제한다'],
    tip: '병영생활 행동강령 하나. 분대원에게 지시·명령할 수 있는 병사는 분대장뿐이다. 선임이라는 이유만으로는 지시할 수 없다.',
  },
  {
    line: '병 상호 간에는 명령·지시·간섭을 금한다',
    wrong: ['병 상호 간에는 계급 순서대로 지시한다', '후임은 선임의 사적 지시를 따른다'],
    tip: '병영생활 행동강령 둘. 병사끼리는 명령·지시·간섭을 할 수 없다. 사적인 심부름 요구도 여기에 해당한다.',
  },
  {
    line: '어떠한 경우에도 구타·폭언·가혹행위 및 집단따돌림을 금한다',
    wrong: ['군기를 위해서라면 얼차려를 줄 수 있다', '장난으로 하는 폭언은 괜찮다'],
    tip: '병영생활 행동강령 셋. 어떤 경우에도 구타·폭언·가혹행위·집단따돌림은 금지. 피해를 보면 마음의 편지나 국방헬프콜(1303)로 알린다.',
  },
];
const NUM = ['하나', '둘', '셋'];
const COUNT = ['하나!', '둘!', '셋!', '넷!'];

type Step =
  | { t: 'talk'; script: DialogueScript | (() => DialogueScript); onChoice?: (c: Choice) => void; before?: () => void }
  | { t: 'act'; title: string; subs: string[]; secs: number; count?: boolean; before?: () => void; after?: () => void }
  | { t: 'shout'; before?: () => void }
  | { t: 'wait'; secs: number; before?: () => void };

interface Props {
  info: CeremonyInfo;
  ctl: CeremonyCtl;
  aide: SpeakerInfo | null;
  onEnd: () => void;
}

const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

export default function RollcallCeremony({ info, ctl, aide, onEnd }: Props) {
  const shoutAvg = useRef(0);
  const steps = useMemo<Step[]>(() => build(info, ctl, aide, shoutAvg), [info, ctl, aide]);
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  const next = useCallback(() => setIdx((i) => i + 1), []);

  useEffect(() => {
    if (!step) { ctl.pose('stand'); ctl.bubble(null); onEnd(); return; }
    step.before?.();
    if (step.t === 'wait') {
      const tm = setTimeout(next, step.secs * 1000);
      return () => clearTimeout(tm);
    }
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const script = step?.t === 'talk' ? (typeof step.script === 'function' ? step.script() : step.script) : null;
  // 함수형 대본은 단계마다 한 번만 만든다
  const scriptRef = useRef<{ idx: number; s: DialogueScript | null }>({ idx: -1, s: null });
  if (scriptRef.current.idx !== idx) scriptRef.current = { idx, s: script };

  return (
    <>
      <div className="cer-fade" />
      {step?.t === 'talk' && scriptRef.current.s && (
        <DialogueBox key={idx} script={scriptRef.current.s} onChoice={step.onChoice} onClose={next} />
      )}
      {step?.t === 'act' && <ActBanner key={idx} step={step} onDone={next} />}
      {step?.t === 'shout' && <ShoutMeter key={idx} ctl={ctl} onDone={(avg) => { shoutAvg.current = avg; next(); }} />}
    </>
  );
}

/** 자동으로 흘러가는 연출 (체조·애국가·입장 등). Enter로 넘길 수 있다 */
function ActBanner({ step, onDone }: { step: Extract<Step, { t: 'act' }>; onDone: () => void }) {
  const [el, setEl] = useState(0);
  const done = useRef(false);
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    step.after?.();
    onDone();
  }, [step, onDone]);
  useEffect(() => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setEl(s);
      if (s >= step.secs) finish();
    }, 100);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') && (performance.now() - t0) > 800) { e.preventDefault(); finish(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(iv); window.removeEventListener('keydown', onKey); };
  }, [step, finish]);
  const sub = step.subs[Math.min(step.subs.length - 1, Math.floor((el / step.secs) * step.subs.length))];
  const beat = Math.floor(el * 2.4);
  return (
    <div className="cer-banner" onClick={() => el > 0.8 && finish()}>
      <div className="cer-title">{step.title}</div>
      <div className="cer-sub">{sub}</div>
      {step.count && (
        <div className="cer-count">
          {(beat % 8 < 4 ? ['하나', '둘', '셋', '넷'] : ['둘', '둘', '셋', '넷']).map((w, i) => <span key={i} className={i === beat % 4 ? 'on' : ''}>{w}</span>)}
        </div>
      )}
      <div className="cer-bar"><i style={{ width: `${Math.min(100, (el / step.secs) * 100)}%` }} /></div>
    </div>
  );
}

/** 구령 조절 3회: Space(또는 화면 터치)를 연타해 목소리를 키운다 */
function ShoutMeter({ ctl, onDone }: { ctl: CeremonyCtl; onDone: (avg: number) => void }) {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'go' | 'result'>('ready');
  const [vol, setVol] = useState(0);
  const presses = useRef(0);
  const scores = useRef<number[]>([]);
  const ROUND_SEC = 2.2;
  const TARGET = 12;

  const hit = useCallback(() => {
    if (phase !== 'go') return;
    presses.current++;
    setVol(Math.min(1, presses.current / TARGET));
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') { e.preventDefault(); if (!e.repeat) hit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hit]);

  useEffect(() => {
    if (phase === 'ready') {
      presses.current = 0; setVol(0);
      ctl.pose('stand'); ctl.bubble(null);
      const tm = setTimeout(() => setPhase('go'), 900);
      return () => clearTimeout(tm);
    }
    if (phase === 'go') {
      ctl.pose('shout');
      let c = 0;
      ctl.bubble(COUNT[0]);
      const iv = setInterval(() => { c++; ctl.bubble(COUNT[c % 4]); }, (ROUND_SEC * 1000) / 4);
      const tm = setTimeout(() => {
        scores.current.push(Math.min(1, presses.current / TARGET));
        setPhase('result');
      }, ROUND_SEC * 1000);
      return () => { clearInterval(iv); clearTimeout(tm); };
    }
    // result
    ctl.pose('stand'); ctl.bubble(null);
    const tm = setTimeout(() => {
      if (round >= 2) {
        const s = scores.current;
        onDone(s.reduce((a, b) => a + b, 0) / s.length);
      } else { setRound(round + 1); setPhase('ready'); }
    }, 800);
    return () => clearTimeout(tm);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = scores.current[scores.current.length - 1] ?? 0;
  return (
    <div className="cer-banner shout" onClick={hit}>
      <div className="cer-title">📣 구령 조절 {round + 1}회 / 3</div>
      <div className="cer-sub">
        {phase === 'ready' && '구령 조절 준비…'}
        {phase === 'go' && 'Space 연타! 최대한 크게! (화면 터치도 가능)'}
        {phase === 'result' && (last >= 0.75 ? '연병장이 쩌렁쩌렁 울린다!' : last >= 0.4 ? '그럭저럭 들린다.' : '모기 소리 같다…')}
      </div>
      <div className="shout-meter"><i style={{ width: `${(phase === 'result' ? last : vol) * 100}%` }} /></div>
    </div>
  );
}

// ───────────────────────── 대본 ─────────────────────────
function build(info: CeremonyInfo, ctl: CeremonyCtl, aide: SpeakerInfo | null, shoutAvg: { current: number }): Step[] {
  const st = useGame.getState();
  const b = BRANCHES[st.branch];
  const S = `${b.salute}!`;
  const D = info.duty;
  const L: LineWho = info.leader === 'me' ? 'me' : info.leader;
  const n = info.total;
  const eff = (e: Parameters<typeof st.applyEffects>[0], label = '점호') => useGame.getState().applyEffects(e, label);
  const steps: Step[] = [{ t: 'wait', secs: 0.7 }];
  const salute = (text: string): Step => ({
    t: 'talk', before: () => { ctl.pose('salute'); ctl.bubble(S); },
    script: { lines: [{ who: L, text: `${text} ${S}` }] },
  });
  const calm = () => { ctl.pose('stand'); ctl.bubble(null); };

  /** 분대장이 나일 때: 인원 보고 선택지 */
  const myReport = (place: string, after: Line[]): DialogueScript => ({
    npc: D,
    lines: [{ who: 'narr', text: '분대장인 내가 인원 보고를 할 차례다. 모두의 시선이 쏠린다…' }, { who: 'narr', text: '어떻게 보고할까?' }],
    choices: [
      {
        text: `"인원 보고! 총원 ${n}명, 사고 0명, 현재원 ${n}명! 이상 ${place} 준비 끝!"`, grade: 'good',
        effects: { discipline: 3, affinity: { [D]: 2 } },
        reply: [{ who: D, text: '보고 깔끔하다. 분대장답네.' }, ...after],
        tip: '인원 보고는 "총원 - 사고(열외) - 현재원" 순서로, 숫자를 또박또박. 끝에 "이상 ○○ 준비 끝!"을 붙인다.',
      },
      {
        text: `"총원 ${n}명입니다! 다 있습니다!"`, grade: 'ok',
        effects: { discipline: 1 },
        reply: [{ who: D, text: '사고 인원, 현재원까지 보고해야지. 다음엔 정확히.' }, ...after],
        tip: '인원 보고는 총원·사고·현재원을 모두 말해야 한다.',
      },
      {
        text: '"어… 대충 다 온 것 같습니다!"', grade: 'bad',
        effects: { discipline: -3, affinity: { [D]: -2 } },
        reply: [{ who: D, text: '대충?! 분대장이 인원 파악도 못 하나! 다시 세어 봐!' }, { who: 'narr', text: '(허둥지둥 다시 세어서 보고했다…)' }, ...after],
      },
    ],
  });

  if (info.kind === 'am') {
    const sched = buildSchedule(st.day, st.branch).filter((e) => e.kind === 'work');
    const plan = sched.map((e) => e.label.replace(/^(오전|오후) 일과: /, '')).join(', 오후는 ');
    steps.push(
      {
        t: 'talk',
        script: {
          lines: [
            { who: 'narr', text: '연병장. 전 장병이 오와 열을 맞춰 정렬했다. 구령대 위로 아침 해가 떠오른다.' },
            ...(info.late ? [{ who: 'me' as LineWho, text: '(늦게 끌려온 탓에 맨 뒷줄 끝자리에 섰다… 시선이 따갑다.)' }] : []),
            { who: 'narr', text: `오늘 당직사관은 {r:${D}}. 저벅저벅 구령대로 올라간다.` },
          ],
        },
      },
      { t: 'act', title: '🎖️ 당직사관 구령대 등단', subs: ['저벅, 저벅…', '구령대 위에 섰다.'], secs: 2.0, before: () => ctl.move(D, info.marks.stage[0], info.marks.stage[1], 1.8, 'down') },
      salute('부대 차렷! 당직사관님께 경례!'),
      info.leader === 'me'
        ? { t: 'talk', before: calm, script: myReport('아침 점호', [{ who: D, text: '쉬어. 아침 점호를 시작한다.' }]), onChoice: (c) => c.effects && eff(c.effects) }
        : {
            t: 'talk', before: calm,
            script: { lines: [
              { who: L, text: `인원 보고! 총원 ${n}명, 사고 0명, 현재원 ${n}명! 이상 아침 점호 준비 끝!` },
              { who: D, text: '쉬어. 아침 점호를 시작한다.' },
            ] },
          },
      { t: 'talk', script: { lines: [{ who: D, text: '국군도수체조 준비! 구령에 맞춰서 크게! 시작!' }] } },
      {
        t: 'act', title: '🤸 국군도수체조', count: true, secs: 7,
        subs: ['숨쉬기 운동', '다리 운동', '팔 운동', '목 운동', '가슴 운동', '옆구리 운동', '등배 운동', '몸통 운동', '뜀뛰기', '숨쉬기 운동'],
        before: () => ctl.pose('exercise'), after: () => { calm(); eff({ hp: 2 }, '도수체조'); },
      },
      { t: 'talk', script: { lines: [{ who: D, text: '체조 끝. 바로 애국가 제창! 1절!' }] } },
      {
        t: 'act', title: '🎵 애국가 1절 제창', secs: 7,
        subs: ['♪ 동해 물과 백두산이 마르고 닳도록…', '♪ 하느님이 보우하사 우리나라 만세…', '♪ 무궁화 삼천리 화려 강산…', '♪ 대한 사람 대한으로 길이 보전하세…'],
        before: () => ctl.pose('anthem'), after: calm,
      },
      { t: 'talk', script: { lines: [{ who: D, text: '다음, 병영생활 행동강령 제창! 크게 따라 한다!' }] } },
    );
    CODE_OF_CONDUCT.forEach((c, i) => {
      const opts = shuffle([c.line, ...c.wrong]);
      steps.push({
        t: 'talk',
        before: () => { ctl.pose('shout'); ctl.bubble(`${NUM[i]}!`); },
        script: {
          npc: D,
          lines: [{ who: D, text: `병영생활 행동강령 ${NUM[i]}!` }, { who: 'narr', text: `"${NUM[i]}! ……" 다음 구절은?` }],
          choices: opts.map((o) => o === c.line
            ? { text: `"${o}!"`, grade: 'good' as const, effects: { discipline: 1 }, reply: [{ who: 'narr' as LineWho, text: `"${o}!" 장병들의 목소리가 연병장에 울려 퍼졌다.` }], tip: c.tip }
            : { text: `"${o}!"`, grade: 'bad' as const, effects: { discipline: -1, mental: -1 }, reply: [{ who: D, text: `거기 누구야! "${c.line}"! 정신 차리고 다시!` }], tip: c.tip }),
        },
        onChoice: (ch) => { calm(); if (ch.effects) eff(ch.effects, '행동강령'); },
      });
    });
    steps.push(
      { t: 'talk', before: calm, script: { lines: [{ who: D, text: '목소리가 작다! 구령 조절 3회 실시!' }, { who: 'narr', text: '[Space를 연타해서 최대한 크게 외치자!]' }] } },
      { t: 'shout' },
      {
        t: 'talk',
        before: () => {
          const a = shoutAvg.current;
          if (a >= 0.75) eff({ discipline: 2, mental: 1, affinity: { [D]: 1 } }, '구령 조절');
          else if (a < 0.4) eff({ discipline: -2 }, '구령 조절');
        },
        script: () => {
          const a = shoutAvg.current;
          const pct = Math.round(a * 100);
          return {
            lines: [
              { who: 'narr', text: `목소리 크기 ${pct}점.` },
              { who: D, text: a >= 0.75 ? '좋아! 목소리 살아 있네. 오늘 하루도 이 기세로 간다!' : a >= 0.4 ? '음, 그럭저럭. 내일은 더 크게 한다.' : '아침부터 목소리가 그게 뭐야! 정신 바짝 차려라!' },
            ],
          };
        },
      },
      {
        t: 'talk',
        script: {
          lines: st.day >= TOTAL_DAYS
            ? [{ who: D, text: '전달 사항. 오늘 전역하는 인원이 있다. 그동안 정말 고생 많았다!' }, { who: D, text: '이상 아침 점호 끝!' }]
            : [{ who: D, text: `전달 사항. 오늘 오전 일과는 ${plan}. 안전사고 유의하고.` }, { who: D, text: '이상 아침 점호 끝!' }],
        },
      },
      salute('부대 차렷! 당직사관님께 경례!'),
      { t: 'wait', secs: 0.6, before: calm },
    );
    return steps;
  }

  // ── 저녁 점호: 생활관 침상에 걸터앉아 분대장이 당직사령에게 보고 ──
  const q = st.rollcall?.q;
  const aideName = aide?.name ?? '당직부관';
  steps.push(
    {
      t: 'talk',
      script: { lines: [
        { who: 'narr', text: '저녁 점호 시간. 분대원들이 각자 침상에 걸터앉아 각을 잡고 기다린다.' },
        { who: 'narr', text: `복도에서 발소리가 들린다. 오늘 당직사령은 {r:${D}}, 당직부관은 ${aideName}.` },
      ] },
    },
    {
      t: 'act', title: '🚪 당직사령 입실', subs: ['저벅, 저벅…', '생활관 문이 열렸다.'], secs: 2.0,
      before: () => {
        ctl.move(D, info.marks.duty[0], info.marks.duty[1], 1.7, 'left');
        if (aide) ctl.move('x:nco', info.marks.aide[0], info.marks.aide[1], 1.9, 'left');
        ctl.stand(info.leader);
        ctl.move(info.leader, info.marks.leader[0], info.marks.leader[1], 1.2, 'right');
      },
    },
    salute('생활관 차렷! 당직사령님께 경례!'),
    info.leader === 'me'
      ? { t: 'talk', before: calm, script: myReport('저녁 점호', [{ who: D, text: '쉬어. 다들 오늘 고생 많았다.' }]), onChoice: (c) => c.effects && eff(c.effects) }
      : {
          t: 'talk', before: calm,
          script: { lines: [
            { who: L, text: `1생활관 인원 보고! 총원 ${n}명, 사고 0명, 현재원 ${n}명! 이상 저녁 점호 준비 끝!` },
            { who: D, text: '쉬어. 다들 오늘 고생 많았다.' },
          ] },
        },
  );
  if (aide) {
    const messy = st.stats.discipline < 40;
    steps.push({
      t: 'talk',
      before: () => { if (messy) eff({ discipline: -1 }, '청소 상태'); },
      script: {
        custom: aide,
        lines: [
          { who: 'npc', text: '생활관 청소 상태, 관물대 정리 확인하겠습니다.' },
          { who: 'narr', text: `당직부관 ${aideName}. 관물대를 훑어보더니 창틀을 손가락으로 쓸어 본다…` },
          messy
            ? { who: 'npc', text: '…창틀에 먼지가 있습니다. 관물대 각도 안 잡혀 있고요. 내일 아침 청소 다시 하도록.' }
            : { who: 'npc', text: '…청소 상태, 정리 상태 양호합니다!' },
        ],
      },
    });
  }
  if (q) {
    steps.push({
      t: 'talk',
      script: {
        npc: D,
        lines: [{ who: D, text: '좋아. 자기 전에 하나 물어보지. {me}!' }, { who: 'me', text: '네! {myrank} {me}!' }, { who: D, text: `${q.q}` }],
        choices: q.options.map((o, i) => i === q.answer
          ? { text: o, grade: 'good' as const, reply: [{ who: D, text: '정확하다. 잘 알고 있네.' }], tip: q.tip }
          : { text: o, grade: 'bad' as const, reply: [{ who: D, text: `틀렸다. 정답은 "${q.options[q.answer]}". 내일까지 확실히 외워 둬.` }], tip: q.tip }),
      },
      onChoice: (c) => {
        const s = useGame.getState();
        const i = q.options.findIndex((o) => o === c.text);
        s.answerRollcall(i);
      },
    });
  }
  steps.push(
    {
      t: 'talk',
      script: { lines: [
        { who: D, text: hasNightDuty(st.day) ? '오늘 불침번 근무자는 {me}지? 근무 교대 시간 지키고, 이상 있으면 바로 보고해.' : '내일 일과 확인하고 바로 취침 준비해라. 불침번 근무자는 근무 잘 서고.' },
        { who: D, text: '이상 저녁 점호 끝!' },
      ] },
    },
    salute('생활관 차렷! 당직사령님께 경례!'),
    {
      t: 'act', title: '🌙 당직사령 퇴실', subs: ['다음 생활관으로…', '"취침 준비!"'], secs: 1.8,
      before: () => {
        calm();
        ctl.move(D, info.marks.door[0] + 1, info.marks.door[1], 1.6, 'up');
        if (aide) ctl.move('x:nco', info.marks.door[0], info.marks.door[1], 1.6, 'up');
      },
    },
  );
  return steps;
}
