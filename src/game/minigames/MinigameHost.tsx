'use client';
import { useEffect, useState } from 'react';
import type { GameId, MinigameCtx, MinigameProps } from '../types';
import { useGame, gradeEffects, gradeOf, fatigueOf } from '../state/store';
import { cdMul } from './common';
import { DIFFICULTY_MUL, useSettings } from '../state/settings';
import { BRANCHES, rankIdxForDay, seasonForDay } from '../data/branches';
import EnvCleanup from './EnvCleanup';
import NightWatch from './NightWatch';
import CombatReady from './CombatReady';
import GuardDuty from './GuardDuty';
import Shooting from './Shooting';
import DamageControl from './DamageControl';
import FodWalk from './FodWalk';
import Sandbag from './Sandbag';
import Overlock from './Overlock';

interface Info { desc: string; controls: string; skill: string; fact: string }

function info(game: GameId, c: MinigameCtx): Info {
  const b = BRANCHES[c.branch];
  const envWhat = c.season === 'winter' ? '제설' : c.season === 'autumn' ? '낙엽 쓸기' : '제초';
  switch (game) {
    case 'env':
      return {
        desc: `${envWhat} 작업! 제한 시간 안에 구역의 90% 이상을 정리하자. 계속 ${c.season === 'winter' ? '눈이 내리고' : '다시 쌓이니'} 쉬지 말 것.`,
        controls: 'WASD/방향키 이동 (지나가면 정리됨)',
        skill: c.branch === 'army' ? '[Space] 불꽃 방사 — 주변 원형 범위를 한 번에 정리' : c.branch === 'navy' ? '[Space] 물대포 — 바라보는 방향으로 길게 3줄 정리' : '[Space] 날개 돌풍 — 전방 3줄 정리 + 이동속도 증가',
        fact: c.season === 'winter' ? '제설은 "넉가래"와 "빗자루"가 주력 장비. 부대 도로가 얼면 보급과 출동이 막히기 때문에 중요한 작전이다.' : '여름철 제초는 경계 시야 확보와 화재 예방을 위한 작업이다.',
      };
    case 'night':
      return {
        desc: '취침 시간 동안 생활관을 지키는 불침번 근무. 졸음을 참고, 순찰·돌발 상황에 올바르게 대응하자.',
        controls: '[Space] 정신 차리기 (너무 연타하면 소음으로 생활관 인원이 깬다!) · 상황 발생 시 1~3 선택',
        skill: `[Q] ${c.branch === 'army' ? '체온 올리기 — 잠시 졸음 증가 둔화' : c.branch === 'navy' ? '찬물 세수 — 졸음 즉시 0' : '야행성 집중 — 잠시 졸음 증가 둔화'}`,
        fact: '불침번은 화재·인원 이상·안전 사고를 확인하고, 순찰 간부에게 "근무 중 이상 무"를 보고한다.',
      };
    case 'combat':
      return {
        desc: '비상! 관물대에서 필수 휴대 물자를 "순서대로" 챙겨라. 엉뚱한 물건을 집으면 시간 -3초.',
        controls: '마우스 클릭',
        skill: '[Space] 다음 물자 위치 잠깐 표시',
        fact: '전투준비태세(전준태)는 실제 상황을 가정해 신속하게 출동 준비를 하는 훈련이다. 평소 관물대 정리가 곧 실력!',
      };
    case 'guard':
      return {
        desc: `${b.games.guard}. 접근하는 인원을 "수하"하고, 답어가 맞는지 판단하자. ${b.wildlife}도 자주 나온다…`,
        controls: '[Space] 수하(정지! 누구냐!) · 1 통과 / 2 정지·보고',
        skill: `[Q] ${c.branch === 'army' ? '횃불 조명' : c.branch === 'navy' ? '탐조등' : '야간 투시'} — 접근자의 모습을 미리 확인`,
        fact: '암구호는 문어(묻는 말)와 답어(대답)로 구성되며 매일 바뀐다. 절대 외부에 유출하면 안 된다.',
      };
    case 'specialty':
      if (c.branch === 'army') return {
        desc: '주특기 사격 훈련! 100m·200m·250m에서 올라오는 표적 20개를 맞혀라. 18발 이상이면 특등사수!',
        controls: '마우스 조준 · 클릭 사격 · [Shift] 호흡 정지(흔들림 감소)',
        skill: '[Space] 불꽃 집중 — 3초간 조준 흔들림 거의 없음',
        fact: '육군 기록사격은 20발을 쏴서 18발 이상 명중하면 "특등사수". 포상휴가의 지름길!',
      };
      if (c.branch === 'navy') return {
        desc: '손상통제 훈련! 함정 격실에 생긴 누수를 쐐기로 막아라. 수위가 100%가 되면 실패.',
        controls: '누수 지점 클릭 (4번씩) · 오래 둔 누수일수록 물이 많이 샌다',
        skill: '[Space] 물 흡수 — 수위 25% 감소',
        fact: '손상통제(DC)는 함정이 피해를 입었을 때 침수·화재를 막는 해군 필수 훈련이다. 모든 수병이 익혀야 한다.',
      };
      return {
        desc: 'FOD 워크다운! 활주로 위 이물질(볼트·너트·돌·비닐 등)만 골라 수거하자. 도색이나 활주로등은 건드리지 말 것.',
        controls: '마우스 클릭',
        skill: '[Space] 매의 눈 — 3초간 FOD가 빛남',
        fact: 'FOD(Foreign Object Debris)는 항공기 엔진에 빨려 들어가 큰 사고를 낼 수 있다. 공군은 매일 줄지어 활주로를 걸으며 FOD를 줍는다.',
      };
    case 'sandbag':
      return {
        desc: `${b.games.sandbag}! 움직이는 모래주머니를 아래 줄에 맞춰 10단 쌓자. 삐져나온 부분은 떨어진다.`,
        controls: '[Space] 또는 클릭으로 내려놓기',
        skill: `[Q] ${c.branch === 'army' ? '숯불 다지기' : c.branch === 'navy' ? '단단한 집게' : '바람 고정'} — 1회, 폭을 원래대로 복구`,
        fact: '모래주머니는 진지 구축, 방호벽, 수해·태풍 대비 등 군에서 가장 많이 쓰이는 만능 자재다.',
      };
    case 'overlock':
      return {
        desc: '진급 축하! 새 계급장을 전투복에 오버로크(박음질)하자. 마우스를 누른 채 점선을 따라 그리면 된다.',
        controls: '마우스를 누른 채 드래그',
        skill: '없음 — 손재주가 전부다',
        fact: '"오버로크"는 계급장·명찰을 전투복에 재봉하는 것. 진급하면 PX나 수선집에서 새로 달아야 한다.',
      };
  }
}

const COMPONENTS: Record<GameId, React.ComponentType<MinigameProps>> = {
  env: EnvCleanup,
  night: NightWatch,
  combat: CombatReady,
  guard: GuardDuty,
  specialty: Shooting,
  sandbag: Sandbag,
  overlock: Overlock,
};

export default function MinigameHost() {
  const s = useGame();
  const req = s.minigame!;
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro');
  const [result, setResult] = useState<{ score: number; summary: string } | null>(null);
  const ctx: MinigameCtx = {
    branch: s.branch,
    archetype: s.archetype,
    speciesId: s.speciesId,
    rankIdx: rankIdxForDay(s.day),
    day: s.day,
    season: seasonForDay(s.day),
    skill: s.stats.skill,
  };
  const fatigue = fatigueOf(s.stats);
  const cdCut = Math.round((1 - cdMul(ctx.skill)) * 100);
  const inf = info(req.game, ctx);
  let Comp = COMPONENTS[req.game];
  if (req.game === 'specialty') Comp = s.branch === 'army' ? Shooting : s.branch === 'navy' ? DamageControl : FodWalk;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (phase === 'intro') setPhase('play');
      else if (phase === 'result' && result) s.finishMinigame(result.score, result.summary);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const grade = result ? gradeOf(result.score) : null;
  const eff = result ? gradeEffects(req.game, result.score) : null;
  const effText = eff
    ? [
        eff.hp ? `체력 ${eff.hp > 0 ? '+' : ''}${eff.hp}` : '',
        eff.mental ? `멘탈 ${eff.mental > 0 ? '+' : ''}${eff.mental}` : '',
        eff.discipline ? `군기 ${eff.discipline > 0 ? '+' : ''}${eff.discipline}` : '',
        eff.skill ? `숙련도 +${eff.skill} (숙련될수록 상승폭 감소)` : '',
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="minigame">
      <div className="mg-title">{req.title}</div>
      {phase === 'intro' && (
        <div className="mg-intro">
          <p className="mg-desc">{inf.desc}</p>
          <div className="mg-row"><b>🎮 조작</b> {inf.controls}</div>
          <div className="mg-row"><b>✨ {BRANCHES[s.branch].type} 타입 기술</b> {inf.skill}</div>
          {req.game !== 'overlock' && req.game !== 'sandbag' && cdCut > 0 && (
            <div className="mg-row"><b>🛠️ 숙련도 {Math.round(ctx.skill)}</b> 기술 재사용 대기시간 -{cdCut}%</div>
          )}
          {fatigue.reasons.length > 0 && (
            <div className="mg-row mg-penalty">😫 지친 상태: 최종 점수 {fatigue.reasons.join(', ')}</div>
          )}
          <div className="mg-fact">📘 {inf.fact}</div>
          <button className="primary big" onClick={() => setPhase('play')}>시작! (Enter)</button>
        </div>
      )}
      {phase === 'play' && (
        <div className="mg-play">
          <Comp
            ctx={ctx}
            onFinish={(raw, summary) => {
              const diff = useSettings.getState().difficulty;
              const dMul = DIFFICULTY_MUL[diff];
              const score = Math.max(0, Math.min(100, raw * fatigue.mul * dMul));
              const notes = [
                fatigue.mul < 1 ? `지침 페널티: ${fatigue.reasons.join(', ')}` : '',
                dMul !== 1 ? `난이도 ${diff === 'easy' ? '쉬움 +15%' : '어려움 -10%'}` : '',
              ].filter(Boolean);
              const note = notes.length ? ` (${notes.join(' · ')})` : '';
              setResult({ score, summary: summary + note });
              setPhase('result');
              s.addTip(inf.fact);
            }}
          />
        </div>
      )}
      {phase === 'result' && result && grade && (
        <div className="mg-result">
          <div className={`big-grade g-${grade}`}>{grade}</div>
          <div className="mg-score">{Math.round(result.score)}점</div>
          <div>{result.summary}</div>
          <div className="hud-dim">{effText}</div>
          <button className="primary big" onClick={() => s.finishMinigame(result.score, result.summary)}>확인 (Enter)</button>
        </div>
      )}
    </div>
  );
}
