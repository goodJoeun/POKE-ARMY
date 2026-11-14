'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Archetype, BranchId, NpcId } from '../types';
import { useGame, presentNpcs, fmtDelta, fatigueOf } from '../state/store';
import { useSettings } from '../state/settings';
import { hasNightDuty } from '../data/schedule';
import { BRANCHES, RANKS, TOTAL_DAYS, fmtMoney, rankIdxForDay, serviceMonth } from '../data/branches';
import { ARCHETYPE_INFO, PLAYER_SPECIES, findSpecies } from '../data/monsters';
import { PERSONALITY_QUIZ } from '../data/quiz';
import { NPC_IDS, NPC_SKINS } from '../data/npcs';
import { npcCap, npcSpeaker } from '../engine/speakers';
import MonsterCanvas from './MonsterCanvas';
import { RankBadge } from './Hud';

// ───────── 타이틀 ─────────
export function Title() {
  const s = useGame();
  const [name, setName] = useState('');
  const [hasSave, setHasSave] = useState(false);
  const settingsOpen = useSettings((st) => st.open);
  // 설정에서 저장 데이터를 지운 경우를 반영하기 위해 설정 창이 닫힐 때도 다시 확인
  useEffect(() => setHasSave(s.hasSave()), [s, settingsOpen]);
  const demo = PLAYER_SPECIES.army[0].look;
  const demo2 = PLAYER_SPECIES.navy[0].look;
  const demo3 = PLAYER_SPECIES.air[0].look;
  return (
    <div className="scene title-scene">
      <div className="title-monsters">
        <MonsterCanvas look={demo} size={120} cap="army" />
        <MonsterCanvas look={demo2} size={120} cap="navy" />
        <MonsterCanvas look={demo3} size={120} cap="air" />
      </div>
      <h1 className="logo">포켓몬 이등병</h1>
      <div className="logo-sub">군대 가기 싫다고 했더니… 포켓몬이 되어 입대했다?!</div>
      <div className="title-form">
        <input
          placeholder="주인공 이름 (예: 김몬스)"
          value={name}
          maxLength={8}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') s.newGame(name); }}
        />
        <button className="primary big" onClick={() => s.newGame(name)}>새 게임</button>
        {hasSave && <button className="big" onClick={() => s.load()}>이어하기</button>}
        <button className="big" onClick={() => useSettings.getState().openMenu()}>⚙️ 설정</button>
      </div>
      <div className="title-foot">프로토타입 v0.1 · WASD/방향키 이동 · E 상호작용 · Tab 수첩</div>
    </div>
  );
}

// ───────── 잠든 뒤 → 꿈 (방 오프닝 다음) ─────────
const INTRO_LINES = [
  '불을 끄고 침대에 누웠다.',
  '스물두 살 {me}은(는) 천장을 보며 중얼거렸다.',
  '"군대 가기 싫다… 군대 가기 싫다… 군대 가기 싫다…"',
  '그렇게 중얼거리다 스르륵 잠이 들었고…',
  '꿈속에서 누군가 말을 걸어왔다.',
  '"그렇게 가기 싫다면… 다른 세계의 군대는 어떠냐?"',
];

export function Intro() {
  const s = useGame();
  const [i, setI] = useState(0);
  const lines = INTRO_LINES.map((l) => l.replace('{me}', s.name));
  const next = () => (i < lines.length - 1 ? setI(i + 1) : s.go('branch'));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="scene intro-scene" onClick={next}>
      <div className="intro-room">
        <div className="moon" />
        <div className="bed-human">🛏️</div>
      </div>
      <div className="intro-text">
        {lines.slice(0, i + 1).map((l, k) => <p key={k} className={k === i ? 'fade-in' : 'dim'}>{l}</p>)}
      </div>
      <div className="hud-dim">클릭 또는 Enter</div>
    </div>
  );
}

// ───────── 군 선택 ─────────
export function BranchSelect() {
  const s = useGame();
  const ids: BranchId[] = ['army', 'navy', 'air'];
  return (
    <div className="scene branch-scene">
      <h2>📜 입영 통지서</h2>
      <p className="hud-dim">꿈속의 목소리: "어느 군으로 가겠느냐? 선택한 곳에 따라 너의 모습도 달라질 것이다…"</p>
      <div className="branch-cards">
        {ids.map((id) => {
          const b = BRANCHES[id];
          const sp = PLAYER_SPECIES[id];
          return (
            <button key={id} className={`branch-card b-${id}`} onClick={() => s.chooseBranch(id)}>
              <div className="bc-name">{b.name}</div>
              <div className="bc-type" style={{ background: b.typeColor }}>{b.type} 타입</div>
              <div className="bc-tag">{b.tagline}</div>
              <div className="bc-mons">
                {sp.map((x) => (
                  <MonsterCanvas key={x.id} look={{ ...x.look, body: '#2a2a3a', belly: '#3a3a4a', accent: '#4a4a5a' }} silhouette="#2a2a3a" size={54} animate={false} />
                ))}
              </div>
              <div className="bc-cands">{sp.map((x) => x.name).join(' · ')}</div>
              <ul>
                <li>복무 {b.months}개월 · 경례 "{b.salute}!"</li>
                <li>주특기: {b.games.specialty.replace('주특기: ', '')}</li>
                <li>{b.unit}</li>
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────── 성격 분석 ─────────
export function Quiz() {
  const s = useGame();
  const [i, setI] = useState(0);
  const [score, setScore] = useState<Record<Archetype, number>>({ leader: 0, diligent: 0, social: 0 });
  const q = PERSONALITY_QUIZ[i];
  const pick = (a: Archetype) => {
    const ns = { ...score, [a]: score[a] + 1 };
    setScore(ns);
    if (i < PERSONALITY_QUIZ.length - 1) setI(i + 1);
    else s.finishQuiz(ns);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 3) pick(q.options[n - 1].type); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="scene quiz-scene">
      <div className="quiz-progress">{PERSONALITY_QUIZ.map((_, k) => <span key={k} className={k <= i ? 'on' : ''} />)}</div>
      <div className="quiz-voice">🌀 꿈속의 목소리가 묻는다… ({i + 1}/{PERSONALITY_QUIZ.length})</div>
      <h2 className="quiz-q">{q.q}</h2>
      <div className="quiz-options">
        {q.options.map((o, k) => (
          <button key={k} className="choice big" onClick={() => pick(o.type)}>
            <span className="choice-num">{k + 1}</span> {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────── 잠에서 깨어 변신을 깨닫는 장면 ─────────
export function Transform() {
  const s = useGame();
  const sp = findSpecies(s.speciesId)!;
  const b = BRANCHES[s.branch];
  // 단계별 연출: 0~3 어둠 속 독백 → 4 첫 모습 → 5 패닉 → 6 결과 카드
  const lines = [
    '……',
    '눈꺼풀 너머로 희미한 빛이 들어온다.',
    '눈을 떴다. 낯선 천장. 꿉꿉한 모포 냄새. 여긴… 내 방이 아니다.',
    '기지개를 켜려고 팔을 쭉 뻗었는데…',
    sp.wake,
    '"으아아아악?!"',
  ];
  const [stage, setStage] = useState(0);
  const last = lines.length; // 결과 카드 단계
  const next = () => setStage((v) => Math.min(last, v + 1));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') {
        e.preventDefault();
        if (stage < last) next(); else s.startDay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const revealed = stage >= 4;
  const shakeOn = useSettings((st) => st.screenShake);
  return (
    <div className={`scene transform-scene ${revealed ? 'stage-2' : 'stage-0'} ${stage === 5 && shakeOn ? 'shake' : ''}`} onClick={() => stage < last && next()}>
      {revealed && (
        <div className={`transform-reveal ${stage === 4 ? 'peek' : ''}`}>
          {stage >= last && <div className="sparkle" />}
          <MonsterCanvas look={sp.look} size={220} cap={stage >= last ? b.cap : null} />
        </div>
      )}
      {stage < last && (
        <div className="wake-text">
          <p key={stage} className={`fade-in ${stage === 5 ? 'scream' : ''}`}>{lines[stage]}</p>
          <div className="hud-dim">클릭 또는 Enter</div>
        </div>
      )}
      {stage >= last && (
        <div className="transform-info fade-in" onClick={(e) => e.stopPropagation()}>
          <h2>"내가… 포켓몬?!"</h2>
          <p><b className="species-name">{sp.name}</b> <span className="bc-type" style={{ background: b.typeColor }}>{sp.type} 타입</span></p>
          <p>{sp.desc}</p>
          <p>성격 분석 결과: <b>{ARCHETYPE_INFO[s.archetype].name}</b> — {ARCHETYPE_INFO[s.archetype].desc}<br />
            <span className="perk">✨ {ARCHETYPE_INFO[s.archetype].perk}</span></p>
          <p className="hud-dim">꿈이 아니다. 머리 위에는 {b.name} 모자까지 얹혀 있다. 그리고 그 순간, 문이 벌컥 열리며 누군가 소리쳤다—</p>
          <button className="primary big" onClick={() => s.startDay()}>▶ 다음 (Enter)</button>
        </div>
      )}
    </div>
  );
}

// ───────── 진급 ─────────
export function Promotion() {
  const s = useGame();
  const rank = rankIdxForDay(s.day);
  const b = BRANCHES[s.branch];
  const cpt = npcSpeaker(s.branch, 'cpt', s.day);
  const [answered, setAnswered] = useState<null | boolean>(null);
  const opts = useMemo(() => [
    { ok: true, text: `"${b.salute}! 신고합니다. ${RANKS[rank - 1]} ${s.name}은(는) ${RANKS[rank]}(으)로 진급을 명받았습니다. 이에 신고합니다. ${b.salute}!"` },
    { ok: false, text: `"저 ${RANKS[rank]} 됐어요! 감사합니다~"` },
    { ok: false, text: `"${b.salute}! 이제 저도 짬 좀 찼습니다!"` },
  ].sort(() => Math.random() - 0.5), [b.salute, rank, s.name]);
  const answer = (ok: boolean) => {
    if (answered !== null) return;
    setAnswered(ok);
    s.applyEffects(ok ? { discipline: 5, affinity: { cpt: 5 } } : { discipline: -2, affinity: { cpt: -2 } }, '진급 신고');
    s.addTip('진급·전입·휴가 등은 지휘관에게 "신고"를 한다. 형식: "경례! 신고합니다. 계급 성명은 ○○부로 ○○을 명받았습니다. 이에 신고합니다. 경례!"');
  };
  return (
    <div className="scene promo-scene">
      <h2>🎖️ 진급 신고</h2>
      <div className="promo-badge"><RankBadge rankIdx={rank} size={60} /><div>{RANKS[rank - 1]} → <b>{RANKS[rank]}</b></div></div>
      <div className="promo-cpt">
        {cpt.look && <MonsterCanvas look={cpt.look} size={110} cap={cpt.cap} />}
        <div>
          <div className="speaker">{cpt.name} <span className="speaker-sub">{cpt.sub}</span></div>
          <div>{answered === null ? `${s.name}, 진급 축하한다. 신고해 봐라.` : answered ? '좋아. 아주 정확한 신고다. 계급에 맞는 책임감을 가져라.' : '…신고 형식부터 다시 배우자. 그래도 축하한다.'}</div>
        </div>
      </div>
      {answered === null ? (
        <div className="quiz-options">
          {opts.map((o, i) => <button key={i} className="choice" onClick={() => answer(o.ok)}><span className="choice-num">{i + 1}</span> {o.text}</button>)}
        </div>
      ) : (
        <button className="primary big" onClick={() => s.startMinigame({ game: 'overlock', title: `${RANKS[rank]} 계급장 오버로크`, returnTo: 'world' })}>
          새 계급장 달러 가기 (오버로크) ▶
        </button>
      )}
    </div>
  );
}

// ───────── 하루 결산 ─────────
export function DayEnd() {
  const s = useGame();
  const ds = s.dayStart.stats;
  const diff = (k: keyof typeof ds) => s.stats[k] - ds[k];
  const affDiff = NPC_IDS.map((id) => [id, s.affinity[id] - s.dayStart.affinity[id]] as [NpcId, number]).filter(([, d]) => d !== 0);
  const sign = fmtDelta;
  const nightDuty = hasNightDuty(s.day);
  // 수면 회복: 불침번 선 날은 덜 회복된다
  const proceed = () => { s.applyEffects(nightDuty ? { hp: 12 } : { hp: 20, mental: 3 }, undefined, true); s.nextDay(); };
  const tomorrowFatigue = fatigueOf({
    ...s.stats,
    hp: Math.min(100, s.stats.hp + (nightDuty ? 12 : 20)),
    mental: Math.min(100, s.stats.mental + (nightDuty ? 0 : 3)),
  }).reasons;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') proceed(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="scene dayend-scene">
      <div className="diary">
        <h2>📔 DAY {s.day} 복무 일기</h2>
        <div className="hud-dim">{BRANCHES[s.branch].name} 복무 {serviceMonth(s.day, s.branch)}개월차 · 전역까지 D-{TOTAL_DAYS - s.day}</div>
        <ul className="diary-log">
          {s.dayLog.length === 0 && <li>평범한 하루였다.</li>}
          {s.dayLog.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
        <div className="diary-stats">
          <span>❤️ 체력 {Math.round(s.stats.hp)} ({sign(diff('hp'))})</span>
          <span>🧠 멘탈 {Math.round(s.stats.mental)} ({sign(diff('mental'))})</span>
          <span>🎖️ 군기 {Math.round(s.stats.discipline)} ({sign(diff('discipline'))})</span>
          <span>🛠️ 숙련 {Math.round(s.stats.skill)} ({sign(diff('skill'))})</span>
          <span>💰 {fmtMoney(s.stats.money)}</span>
        </div>
        {affDiff.length > 0 && (
          <div className="diary-aff">
            {affDiff.map(([id, d]) => <span key={id} className={d > 0 ? 'up' : 'down'}>{NPC_SKINS[s.branch][id].name} {sign(d)}</span>)}
          </div>
        )}
        <p className="diary-sleep">💤 {nightDuty ? '불침번 근무를 마치고 녹초가 되어 잠들었다. (수면 회복: 체력 +12)' : '취침 나팔과 함께 스르륵 잠들었다. (수면 회복: 체력 +20, 멘탈 +3)'}</p>
        {tomorrowFatigue.length > 0 && <p className="diary-warn">😫 자고 일어나도 지친 상태: 내일 훈련 점수 {tomorrowFatigue.join(', ')} — 식사와 휴식을 챙기자.</p>}
        <button className="primary big" onClick={proceed}>
          {s.day >= TOTAL_DAYS - 1 ? '내일은 드디어… 전역일! ▶' : '다음 날 ▶ (Enter)'}
        </button>
      </div>
    </div>
  );
}

// ───────── 엔딩 ─────────
export function Ending() {
  const s = useGame();
  const b = BRANCHES[s.branch];
  const sp = findSpecies(s.speciesId)!;
  const [stage, setStage] = useState(0);
  const present = presentNpcs(Math.min(s.day, TOTAL_DAYS));
  const avgAff = Math.round(NPC_IDS.reduce((a, id) => a + s.affinity[id], 0) / NPC_IDS.length);
  const st = s.stats;
  let title = '🎖️ 무사 전역';
  let desc = '큰 사고 없이 무사히 전역했다. 그게 가장 어려운 일이다.';
  if (st.discipline >= 75 && avgAff >= 30) { title = '🏅 모범 병사 전역 · 사단장 표창'; desc = '군기와 인간관계 모두 완벽! 부대의 전설로 남았다.'; }
  else if (avgAff >= 35) { title = '🤝 인싸 전역 · 생활관의 전설'; desc = '모두가 아쉬워하는 전역. 위병소 앞까지 배웅 행렬이 이어졌다.'; }
  else if (st.skill >= 70) { title = '🛠️ 주특기 장인 전역'; desc = `${b.games.specialty.replace('주특기: ', '')}라면 누구보다 자신 있다.`; }
  else if (st.discipline < 30) { title = '😅 아슬아슬 전역'; desc = '지각과 실수투성이였지만… 어쨌든 전역은 전역이다!'; }
  const avgScore = s.grades.length ? Math.round(s.grades.reduce((a, g) => a + g.score, 0) / s.grades.length) : 0;

  useEffect(() => { s.wipe(); }, [s]);

  if (stage === 0) {
    return (
      <div className="scene ending-scene">
        <h2>🎊 전역을 명받았습니다!</h2>
        <MonsterCanvas look={sp.look} size={160} cap={b.cap} />
        <div className="ending-title">{title}</div>
        <p>{desc}</p>
        <div className="ending-stats">
          <span>군기 {Math.round(st.discipline)}</span><span>숙련도 {Math.round(st.skill)}</span><span>평균 호감 {avgAff}</span>
          <span>훈련 평균 {avgScore}점</span><span>지각 {s.lateCount}회</span><span>군대 상식 {s.tips.length}개</span>
        </div>
        <div className="ending-crew">
          {present.map((id) => {
            const sk = NPC_SKINS[s.branch][id];
            return (
              <div key={id} className="crew">
                <MonsterCanvas look={sk.look} size={64} cap={npcCap(s.branch, id)} />
                <span>{sk.name}</span>
                <span className="hud-dim">{s.affinity[id] >= 30 ? '😭 가지 마!' : s.affinity[id] >= 0 ? '👋 잘 가!' : '😐 …'}</span>
              </div>
            );
          })}
        </div>
        <p>위병소를 나서며 마지막으로 경례했다. <b>"{b.salute}!"</b></p>
        <p className="hud-dim">그날 밤, 사회에서의 첫 잠자리에 누워 눈을 감았다…</p>
        <button className="primary big" onClick={() => setStage(1)}>잠들기 💤</button>
      </div>
    );
  }
  return (
    <div className="scene reality-scene">
      <div className="reality-text">
        <p className="fade-in">"…야, 일어나. 불침번 교대다."</p>
        <p className="fade-in d1">눈을 뜨자 낯선 천장. 모포 냄새. 줄지어 누운 까까머리 훈련병들.</p>
        <p className="fade-in d2">사람의 손이다. 꼬리도, {s.branch === 'air' ? '날개도' : s.branch === 'navy' ? '물갈퀴도' : '꼬리 불꽃도'} 없다. {sp.name}의 모습은 온데간데없다.</p>
        <p className="fade-in d3">여기는… <b>훈련소 첫날 밤</b>이다.</p>
        <p className="fade-in d4">옆 침상 훈련병이 속삭였다. "너 아까 잠꼬대로 '{b.salute}!' 외치던데? 무슨 꿈 꿨냐?"</p>
        <p className="fade-in d5">{s.name}은(는) 피식 웃었다. 이번엔 왠지… 해낼 수 있을 것 같다.</p>
        <h2 className="fade-in d6">— 그리고, 진짜 군 생활이 시작된다. —</h2>
        <p className="fade-in d6 hud-dim">THE END · 플레이해 주셔서 감사합니다</p>
        <button className="primary big fade-in d6" onClick={() => s.go('title')}>타이틀로</button>
      </div>
    </div>
  );
}

export { npcSpeaker };
