'use client';
import PuzzleInstrument from './PuzzleInstrument';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import { NO_PROGRESS, checkPuzzle, puzzleDef, puzzleReward, type PuzzleAnswer, type PuzzleDef, QUICK_LEVELS } from '../data/puzzles';
import MonsterCanvas from './MonsterCanvas';
import type { MonsterLook } from '../types';

/** 삽화용 외형: 스프라이트만 쓴다 (그림이 없을 때만 보이는 단색 몬스터) */
const castLook = (sprite: string): MonsterLook =>
  ({ sprite, body: '#a8a8b8', belly: '#f2ead8', accent: '#a8a8b8', shape: 'round', ears: 'none', tail: 'none', eyes: 'dot', mouth: 'smile' });

/**
 * 지문에 나오는 포켓몬 삽화. 한 마리는 크게, 둘은 마주 보게, 셋 이상은 작은 도트로 줄지어 세운다.
 */
function PuzzleCast({ cast }: { cast: NonNullable<PuzzleDef['cast']> }) {
  const actors = cast.flatMap((c) => Array.from({ length: c.count ?? 1 }, () => c.sprite));
  const n = actors.length;
  const size = n === 1 ? 140 : n === 2 ? 96 : 48;
  return (
    <div className={`pz-art pz-cast ${n === 2 ? 'pair' : n > 2 ? 'crowd' : ''}`} aria-hidden="true">
      {actors.map((sprite, i) => (
        <MonsterCanvas key={i} look={castLook(sprite)} size={size} dir={n === 2 && i === 0 ? 'right' : 'down'} />
      ))}
    </div>
  );
}

interface Props {
  id: string;
  /** 정답을 맞히고 창을 닫을 때. reward = 되살아날 인간의 기억 */
  onSolved: (reward: number) => void;
  /** 풀지 않고 닫을 때 (나중에 다시 풀 수 있다) */
  onClose: () => void;
  /** 꿈 장면처럼 미룰 수 없는 자리: "나중에 풀기"를 숨긴다 */
  mustSolve?: boolean;
  /** 실패가 있는 퍼즐(집중)에서 졌을 때 */
  onFail?: () => void;
}

/** 집중 퍼즐의 색 (글자 · 색 · 방향키) */
const STROOP = [
  { name: '빨강', color: '#f05a48', key: 'ArrowLeft', arrow: '←' },
  { name: '노랑', color: '#f2d040', key: 'ArrowUp', arrow: '↑' },
  { name: '파랑', color: '#5a9cf0', key: 'ArrowRight', arrow: '→' },
  { name: '초록', color: '#4ac060', key: 'ArrowDown', arrow: '↓' },
];
/** 글자와 색이 늘 엇갈리는 문제 n개 */
function stroopItems(n: number) {
  return Array.from({ length: n }, () => {
    const word = Math.floor(Math.random() * 4);
    const color = (word + 1 + Math.floor(Math.random() * 3)) % 4;
    return { word, color };
  });
}

/**
 * 칠교판 창문 (4×4). 큰 세모 자리는 위쪽(뾰족한 끝이 아래)과 왼쪽(뾰족한 끝이 오른쪽) 둘이다.
 * rot: 손에 든 조각의 뾰족한 끝 방향 (0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽)
 */
const TANGRAM_OUTLINES = [
  '0,0 4,0 2,2', '0,0 0,4 2,2', '4,0 4,2 3,1', '2,2 3,1 4,2 3,3', '2,2 3,3 1,3', '0,4 1,3 3,3 2,4', '2,4 4,4 4,2',
];
const TANGRAM_SLOTS = [
  { name: '위쪽 자리', points: '0,0 4,0 2,2', rot: 2 },
  { name: '왼쪽 자리', points: '0,0 0,4 2,2', rot: 1 },
];
const ROT_NAME = ['위', '오른쪽', '아래', '왼쪽'];

/**
 * ⭐ 일곱 조각 별: 별 조각 일곱 개로 별 모양 창문을 완성한다 (P-21, 1일차 P-01에서 맨 위 꼭짓점을 끼워 둔 그 창문).
 * 다섯 꼭짓점(같은 모양) + 가운데 오각형을 둘로 나눈 사다리꼴 · 세모. 자리(slot)마다 모양(kind)과 방향(rot)이 정해져 있다.
 * 조각은 한 번 돌릴 때마다 72도(꼭짓점 하나만큼) 돈다. 다섯 번 돌리면 제자리.
 */
type TanKind = 'tip' | 'trap' | 'cap';
const TAN_STEPS = 5;
const TAN_DEG = 360 / TAN_STEPS;
/** 손에 든 조각의 모양 (무게중심이 원점, 방향 0 = 별 안에 놓인 그대로) */
const TAN_SHAPE: Record<TanKind, { name: string; points: string }> = {
  tip: { name: '꼭짓점 조각', points: '0,-1.474 0.718,0.737 -0.718,0.737' },
  trap: { name: '사다리꼴 조각', points: '-1.162,0.683 -0.718,-0.683 0.718,-0.683 1.162,0.683' },
  cap: { name: '가운데 세모', points: '1.162,-0.282 0,0.563 -1.162,-0.282' },
};
/** 별 모양 창틀 (바깥 반지름 2, 안쪽 꼭짓점은 황금비만큼 안쪽) */
const STAR_OUTLINE = '0,-2 0.449,-0.618 1.902,-0.618 0.727,0.236 1.176,1.618 0,0.764 -1.176,1.618 -0.727,0.236 -1.902,-0.618 -0.449,-0.618';
const TAN7_SLOTS: { kind: TanKind; name: string; points: string; rot: number; cx: number; cy: number }[] = [
  { kind: 'tip', name: '맨 위 꼭짓점', points: '0,-2 0.449,-0.618 -0.449,-0.618', rot: 0, cx: 0, cy: -0.95 },
  { kind: 'tip', name: '오른쪽 위 꼭짓점', points: '1.902,-0.618 0.727,0.236 0.449,-0.618', rot: 1, cx: 1.026, cy: -0.2 },
  { kind: 'tip', name: '오른쪽 아래 꼭짓점', points: '1.176,1.618 0,0.764 0.727,0.236', rot: 2, cx: 0.634, cy: 1.0 },
  { kind: 'tip', name: '왼쪽 아래 꼭짓점', points: '-1.176,1.618 -0.727,0.236 0,0.764', rot: 3, cx: -0.634, cy: 1.0 },
  { kind: 'tip', name: '왼쪽 위 꼭짓점', points: '-1.902,-0.618 -0.449,-0.618 -0.727,0.236', rot: 4, cx: -1.026, cy: -0.2 },
  { kind: 'trap', name: '가운데 위', points: '-0.727,0.236 -0.449,-0.618 0.449,-0.618 0.727,0.236', rot: 0, cx: 0, cy: -0.06 },
  { kind: 'cap', name: '가운데 아래', points: '0.727,0.236 0,0.764 -0.727,0.236', rot: 0, cx: 0, cy: 0.54 },
];
/** 조각 일곱 개 (0번은 첫날 밤 맨 위 꼭짓점에 끼운 조각). rot: 처음 손에 들었을 때의 방향 */
const TAN7_PIECES: { kind: TanKind; rot: number }[] = [
  { kind: 'tip', rot: 0 }, { kind: 'tip', rot: 2 }, { kind: 'tip', rot: 4 }, { kind: 'tip', rot: 1 },
  { kind: 'tip', rot: 3 }, { kind: 'trap', rot: 3 }, { kind: 'cap', rot: 2 },
];

function TangramWindow({ rot, placed, onSlot }: { rot: number; placed: number | null; onSlot: (i: number) => void }) {
  return (
    <div className="pz-tangram">
      <svg viewBox="-0.15 -0.15 4.3 4.3" className="pz-tan-frame" role="group" aria-label="일곱 조각의 자리가 그려진 정사각형 창문 틀">
        <rect x={0} y={0} width={4} height={4} fill="#141a38" stroke="#5a4030" strokeWidth={0.16} />
        {TANGRAM_OUTLINES.map((pts, i) => <polygon key={i} points={pts} fill="none" stroke="#8890c0" strokeWidth={0.03} strokeDasharray="0.1 0.08" />)}
        {TANGRAM_SLOTS.map((sl, i) => (
          <polygon
            key={i} points={sl.points} className={`pz-tan-slot ${placed === i ? 'on' : ''}`}
            role="button" tabIndex={0} aria-label={`${i + 1}번: ${sl.name}에 끼우기`}
            onClick={() => onSlot(i)}
          />
        ))}
        <text x={2} y={0.75} className="pz-tan-num">1</text>
        <text x={0.6} y={2.15} className="pz-tan-num">2</text>
      </svg>
      {placed === null && (
        <div className="pz-tan-hand">
          <svg viewBox="-2.4 -2.4 4.8 4.8" aria-label={`손에 든 큰 세모 조각. 뾰족한 끝이 ${ROT_NAME[rot]}를 향한다.`} role="img">
            <polygon points="0,-1.2 2,0.8 -2,0.8" fill="#ffe890" stroke="#c89820" strokeWidth={0.12} style={{ transform: `rotate(${rot * 90}deg)`, transition: 'transform 0.15s' }} />
          </svg>
          <div className="hud-dim">뾰족한 끝: {ROT_NAME[rot]}</div>
        </div>
      )}
    </div>
  );
}

/** 거울에 비친 시계: 바늘은 거울 속 모습(3시 40분) 그대로 그린다 */
function MirrorClock() {
  const hand = (deg: number, len: number, w: number, color: string) => {
    const r = (deg - 90) * (Math.PI / 180);
    return <line x1={80} y1={80} x2={80 + Math.cos(r) * len} y2={80 + Math.sin(r) * len} stroke={color} strokeWidth={w} strokeLinecap="round" />;
  };
  return (
    <svg className="pz-art" viewBox="0 0 160 160" role="img" aria-label="거울에 비친 숫자 없는 벽시계. 짧은 바늘은 3과 4 사이, 긴 바늘은 8을 가리킨다.">
      <rect x={4} y={4} width={152} height={152} rx={10} fill="#cfe4ee" stroke="#283048" strokeWidth={4} />
      <path d="M18 60 L60 18 M30 96 L96 30" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" opacity={0.55} />
      <circle cx={80} cy={80} r={56} fill="#f8f8f0" stroke="#283048" strokeWidth={4} />
      {Array.from({ length: 12 }, (_, i) => {
        const r = (i * 30 - 90) * (Math.PI / 180);
        const a = i % 3 === 0 ? 42 : 46;
        return <line key={i} x1={80 + Math.cos(r) * a} y1={80 + Math.sin(r) * a} x2={80 + Math.cos(r) * 51} y2={80 + Math.sin(r) * 51} stroke="#283048" strokeWidth={i % 3 === 0 ? 4 : 2} />;
      })}
      {hand(110, 28, 6, '#283048')}
      {hand(240, 42, 4, '#283048')}
      <circle cx={80} cy={80} r={4} fill="#c84838" />
    </svg>
  );
}

/** 명찰 조각(자모 일곱 개)을 글자 셋으로 조합한다. 자리에 맞지 않는 조각이 있으면 그 글자는 '?' */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
function syllable(cho: string, jung: string, jong = ' '): string {
  const c = CHO.indexOf(cho), j = JUNG.indexOf(jung), k = JONG.indexOf(jong);
  return c < 0 || j < 0 || k < 0 ? '?' : String.fromCharCode(0xac00 + (c * 21 + j) * 28 + k);
}
const nametag = (j: string[]) => syllable(j[0], j[1]) + syllable(j[2], j[3], j[4]) + syllable(j[5], j[6]);

/** 안농의 원: 맨 앞이 맨 뒤로 / 맨 뒤가 맨 앞으로 / 맨 앞 둘 바꾸기 / 맨 앞 뒤집기 */
const RING_OPS = {
  left: (r: string[]) => [...r.slice(1), r[0]],
  right: (r: string[]) => [r[r.length - 1], ...r.slice(0, -1)],
  swap: (r: string[]) => [r[1], r[0], ...r.slice(2)],
  flip: (r: string[]) => [r[0].endsWith('!') ? r[0].slice(0, -1) : `${r[0]}!`, ...r.slice(1)],
};
type RingOp = keyof typeof RING_OPS;

const digits = (v: string, max: number) => {
  const d = v.replace(/\D/g, '').slice(0, String(max).length);
  return d !== '' && Number(d) > max ? String(max) : d;
};

/** 분리수거장 마당 (가로 12칸 · 세로 8칸)과 한쪽에 치우친 폐지 더미 (가로 4칸 · 세로 3칸). 풀면 반으로 가르는 줄이 그어진다 */
function YardArt({ solved }: { solved: boolean }) {
  const C = 22; // 한 칸
  const X0 = 26, Y0 = 10, W = 12, H = 8;
  const y = (v: number) => Y0 + (H - v) * C; // 바닥에서 v칸 높이
  return (
    <svg className="pz-yard" viewBox={`0 0 ${X0 * 2 + W * C} ${Y0 * 2 + H * C + 8}`} role="img" aria-label="마당은 가로 12칸, 세로 8칸. 폐지 더미는 왼쪽에서 7칸부터 11칸까지, 바닥에서 4칸부터 7칸 높이까지 놓여 있다.">
      <rect x={X0} y={Y0} width={W * C} height={H * C} fill="#e9e2c8" stroke="#283048" strokeWidth="2" />
      {Array.from({ length: W - 1 }, (_, i) => <line key={`v${i}`} x1={X0 + (i + 1) * C} y1={Y0} x2={X0 + (i + 1) * C} y2={Y0 + H * C} stroke="#b9b092" strokeWidth="1" />)}
      {Array.from({ length: H - 1 }, (_, i) => <line key={`h${i}`} x1={X0} y1={Y0 + (i + 1) * C} x2={X0 + W * C} y2={Y0 + (i + 1) * C} stroke="#b9b092" strokeWidth="1" />)}
      <rect x={X0 + 7 * C} y={y(7)} width={4 * C} height={3 * C} fill="#b88a58" stroke="#6a4a28" strokeWidth="2" />
      <text x={X0 + 9 * C} y={y(5.5) + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#3a2a14">폐지 더미</text>
      {Array.from({ length: H + 1 }, (_, v) => (
        <g key={`t${v}`}>
          <text x={X0 - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#283048">{v}</text>
          <text x={X0 + W * C + 6} y={y(v) + 4} textAnchor="start" fontSize="10" fill="#283048">{v}</text>
        </g>
      ))}
      {solved && <line x1={X0} y1={y(1)} x2={X0 + W * C} y2={y(7)} stroke="#d03838" strokeWidth="3" strokeDasharray="6 4" />}
    </svg>
  );
}

/** 두뇌 퍼즐 창: 지문 · 그림 · 답 입력 · 힌트. 열려 있는 동안 게임 시계는 멈춘다 (월드의 오버레이 규칙) */
export default function PuzzleBox({ id, onSolved, onClose, mustSolve: mustSolveProp, onFail }: Props) {
  const def = puzzleDef(id);
  const input = def?.input;
  const prog = useGame((s) => s.puzzles[id]) ?? NO_PROGRESS;
  const candy = useGame((s) => s.candy);
  // 입력 방식별 답 상태
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [pick, setPick] = useState<number | null>(null);
  const mustSolve = mustSolveProp || !!onFail;
  const tester = useSettings((st) => st.testerMode);
  // 순서 배열: 아직 찾지 못한 단서의 카드는 빼고 시작한다
  const [order, setOrder] = useState<string[]>(() => {
    if (input?.type !== 'order') return [];
    const have = useGame.getState().clues;
    return input.start.filter((oid) => { const it = input.items.find((x) => x.id === oid); return !it?.clue || have.includes(it.clue); });
  });
  /** 순서 배열에서 먼저 집은 칸 */
  const [held, setHeld] = useState<number | null>(null);
  /** 미로: 지금까지 걸은 갈림길 수 · 마지막으로 본 글 */
  const [steps, setSteps] = useState(0);
  const [mazeText, setMazeText] = useState('');
  /** 조각 끼우기: 조각 방향 · 끼운 자리 · 안 맞았을 때 한마디 */
  const [rot, setRot] = useState(0);
  const [placed, setPlaced] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
  /** 숫자 칸 */
  const [nums, setNums] = useState<string[]>(() => (input?.type === 'numbers' ? input.fields.map(() => '') : []));
  /** 안농의 원: 지금 배열 · 움직인 횟수 */
  const [ring, setRing] = useState<string[]>(() => (input?.type === 'ring' ? input.start : []));
  const [moves, setMoves] = useState(0);
  /** 단체 사진: 사진마다 짚은 칸 */
  const [picks, setPicks] = useState<(number | null)[]>(() => (input?.type === 'photos' ? input.photos.map(() => null) : []));
  /** 집중: 문제 목록 · 지금 문제(-1이면 시작 전) · 맞힌 수 · 졌는지 */
  const [sItems] = useState(() => (input?.type === 'stroop' ? stroopItems(input.rounds) : []));
  const [sIdx, setSIdx] = useState(-1);
  const [sScore, setSScore] = useState(0);
  const [failed, setFailed] = useState(false);
  /** 한붓그리기: 지나온 장소 · 막혔는지 */
  const [trail, setTrail] = useState<string[]>(() => (input?.type === 'path' && input.start ? [input.start] : []));
  const [stuck, setStuck] = useState(false);
  /** 물 붓기: 두 그릇에 든 양 · 움직인 횟수 */
  const [jugs, setJugs] = useState<[number, number]>([0, 0]);
  const [jugMoves, setJugMoves] = useState(0);
  /** 글자 입력: 쓴 글 · 고른 오답 선택지 수 */
  const [typed, setTyped] = useState('');
  const [decoyHits, setDecoyHits] = useState(0);
  /** 제한 시간: 남은 초 */
  const [left, setLeft] = useState<number | null>(def?.timeLimitMs && onFail ? Math.ceil(def.timeLimitMs / 1000) : null);
  /** 일곱 조각: 자리마다 끼운 조각 · 조각마다 방향 · 고른 조각 */
  const tanHave = Math.min(7, useGame.getState().stars.length);
  const [tSlots, setTSlots] = useState<(number | null)[]>([0, null, null, null, null, null, null]);
  const [tRot, setTRot] = useState<number[]>(() => TAN7_PIECES.map((x) => x.rot));
  const [tSel, setTSel] = useState(1);
  const [result, setResult] = useState<'wrong' | 'right' | null>(null);
  const [reward, setReward] = useState(0);
  const hourRef = useRef<HTMLInputElement>(null);

  useEffect(() => { hourRef.current?.focus(); }, []);

  const solved = result === 'right';
  const answer: PuzzleAnswer | null = !input ? null
    : input.type === 'time' ? (hour === '' || minute === '' ? null : { type: 'time', hour: Number(hour), minute: Number(minute) })
    : input.type === 'choice' ? (pick === null ? null : { type: 'choice', index: pick })
    : input.type === 'order' ? { type: 'order', ids: order }
    : input.type === 'numbers' ? (nums.some((v) => v === '') ? null : { type: 'numbers', values: nums.map(Number) })
    : input.type === 'photos' ? (picks.some((v) => v === null) ? null : { type: 'photos', picks: picks as number[] })
    : null;
  /** 답하기 버튼 없이 조작만으로 끝나는 퍼즐 */
  const direct = input?.type === 'maze' || input?.type === 'tangram1' || input?.type === 'ring' || input?.type === 'stroop' || input?.type === 'path' || input?.type === 'text' || input?.type === 'tangram7' || input?.type === 'jugs';

  const submit = useCallback(() => {
    if (!def || solved || !answer) return;
    const st = useGame.getState();
    if (checkPuzzle(def, answer)) {
      setReward(st.solvePuzzle(id));
      setResult('right');
      setHeld(null);
    } else {
      st.puzzleWrong(id);
      setResult('wrong');
      if (def.oneShot && onFail) setFailed(true);
    }
  }, [def, answer, id, solved, onFail]);

  const finish = useCallback(() => onSolved(reward), [onSolved, reward]);

  /** 조작만으로 끝나는 퍼즐의 정답 처리 */
  const win = useCallback(() => {
    if (solved) return;
    setReward(useGame.getState().solvePuzzle(id));
    setResult('right');
  }, [id, solved]);

  // 🧪 개발용: 테스트 플레이에서 퍼즐을 바로 통과한다 (콘솔: __puzzle.win() → __puzzle.finish())
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const w = window as unknown as Record<string, unknown>;
    w.__puzzle = { id, win, finish, solved };
    return () => { if ((w.__puzzle as { id?: string } | undefined)?.id === id) delete w.__puzzle; };
  }, [id, win, finish, solved]);

  const lap = input?.type === 'maze' ? Math.floor(steps / input.forks) : 0;
  const canGiveUp = input?.type === 'maze' && lap >= input.laps - 1;
  /** 미로: 어느 길을 골라도 걷다가 제자리로 돌아온다 */
  const walk = useCallback((i: number) => {
    if (solved || input?.type !== 'maze') return;
    if (i === input.paths.length) { if (canGiveUp) win(); return; }
    if (i > input.paths.length) return;
    const at = steps % input.forks;
    setMazeText(at === input.forks - 1 ? `${input.walk[at]} ${input.back}` : input.walk[at]);
    setSteps(steps + 1);
  }, [solved, input, steps, canGiveUp, win]);

  /** 조각 끼우기: 방향이 맞는 자리에만 들어간다 (틀려도 오답으로 세지 않는다) */
  const fit = useCallback((i: number) => {
    if (solved || input?.type !== 'tangram1' || !TANGRAM_SLOTS[i]) return;
    if (TANGRAM_SLOTS[i].rot === rot) { setPlaced(i); setBump(false); win(); }
    else setBump(true);
  }, [solved, input, rot, win]);
  const rotate = useCallback((d: number) => { if (!solved) { setRot((r) => (r + d + 4) % 4); setBump(false); } }, [solved]);

  /** 안농의 원: 한 번 움직이고, 목표와 같아지면 정답 */
  const ringMove = useCallback((op: RingOp) => {
    if (solved || input?.type !== 'ring' || (op === 'flip' && !input.flip)) return;
    const next = RING_OPS[op](ring);
    setRing(next);
    setMoves(moves + 1);
    if (next.every((t, i) => t === input.answer[i])) win();
  }, [solved, input, ring, moves, win]);
  const ringReset = useCallback(() => { if (!solved && input?.type === 'ring') { setRing(input.start); setMoves(0); } }, [solved, input]);

  /** 집중: 색을 답한다 (null = 시간 초과). 마지막 문제 뒤에 성공·실패가 갈린다 */
  const stroopAnswer = useCallback((color: number | null) => {
    if (solved || failed || input?.type !== 'stroop' || sIdx < 0 || sIdx >= input.rounds) return;
    const score = sScore + (color === sItems[sIdx].color ? 1 : 0);
    setSScore(score);
    setSIdx(sIdx + 1);
    if (sIdx + 1 >= input.rounds) { if (score >= input.need) win(); else setFailed(true); }
  }, [solved, failed, input, sIdx, sScore, sItems, win]);
  const stroopMs = input?.type === 'stroop' && sIdx >= 0 ? Math.round(input.slowMs - (input.slowMs - input.fastMs) * (sIdx / Math.max(1, input.rounds - 1))) : 0;
  useEffect(() => {
    if (input?.type !== 'stroop' || sIdx < 0 || sIdx >= input.rounds || solved || failed) return;
    const tm = setTimeout(() => stroopAnswer(null), stroopMs);
    return () => clearTimeout(tm);
  }, [input, sIdx, solved, failed, stroopMs, stroopAnswer]);

  /** 한붓그리기: 이웃한 장소로, 아직 지나지 않은 길을 따라 한 칸 간다 */
  const usedEdge = useCallback((a: string, b: string) => trail.some((n, i) => i > 0 && ((trail[i - 1] === a && n === b) || (trail[i - 1] === b && n === a))), [trail]);
  const pathStep = useCallback((to: string) => {
    if (solved || input?.type !== 'path' || stuck) return;
    // 시작할 곳이 정해지지 않은 약도: 처음 누른 곳에서 출발한다
    if (trail.length === 0) { setTrail([to]); return; }
    const at = trail[trail.length - 1];
    const isEdge = input.edges.some(([a, b]) => (a === at && b === to) || (b === at && a === to));
    if (!isEdge || usedEdge(at, to)) return;
    const next = [...trail, to];
    setTrail(next);
    if (next.length - 1 === input.edges.length) { win(); return; }
    const used = (a: string, b: string) => next.some((n, i) => i > 0 && ((next[i - 1] === a && n === b) || (next[i - 1] === b && n === a)));
    const canGo = input.edges.some(([a, b]) => (a === to || b === to) && !used(a, b));
    if (!canGo) { setStuck(true); useGame.getState().puzzleWrong(id); }
  }, [solved, input, stuck, trail, usedEdge, win, id]);
  const pathUndo = useCallback(() => {
    if (solved || input?.type !== 'path' || trail.length <= (input.start ? 1 : 0)) return;
    setTrail(trail.slice(0, -1));
    setStuck(false);
  }, [solved, input, trail]);
  const pathReset = useCallback(() => { if (!solved && input?.type === 'path') { setTrail(input.start ? [input.start] : []); setStuck(false); } }, [solved, input]);

  // 제한 시간: 다 되면 실패
  useEffect(() => {
    if (left === null || solved || failed) return;
    if (left <= 0) { setFailed(true); return; }
    const tm = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(tm);
  }, [left, solved, failed]);

  /** 물 붓기: 0·1 채우기 / 2·3 비우기 / 4 작은→큰 / 5 큰→작은 */
  const jugOp = useCallback((op: number) => {
    if (solved || input?.type !== 'jugs' || op < 0 || op > 5) return;
    const [ca, cb] = input.caps;
    let [a, b] = jugs;
    if (op === 0) a = ca;
    else if (op === 1) b = cb;
    else if (op === 2) a = 0;
    else if (op === 3) b = 0;
    else if (op === 4) { const t = Math.min(a, cb - b); a -= t; b += t; }
    else { const t = Math.min(b, ca - a); b -= t; a += t; }
    if (a === jugs[0] && b === jugs[1]) return;
    setJugs([a, b]);
    setJugMoves(jugMoves + 1);
    if (a === input.target || b === input.target) win();
  }, [solved, input, jugs, jugMoves, win]);
  const jugReset = useCallback(() => { if (!solved) { setJugs([0, 0]); setJugMoves(0); } }, [solved]);

  /** 글자 입력: 내 이름을 쓰면 정답. 주어진 선택지를 고르면 오답 (실패가 있는 자리에선 다 고르면 진다) */
  const textSubmit = useCallback(() => {
    if (solved || failed || input?.type !== 'text' || typed.trim() === '') return;
    if (typed.trim() === useGame.getState().name.trim()) { win(); return; }
    useGame.getState().puzzleWrong(id);
    setResult('wrong');
  }, [solved, failed, input, typed, win, id]);
  const pickDecoy = useCallback(() => {
    if (solved || failed || input?.type !== 'text') return;
    const n = decoyHits + 1;
    setDecoyHits(n);
    setResult(null);
    useGame.getState().puzzleWrong(id);
    if (onFail && n >= input.decoys.length) setFailed(true);
  }, [solved, failed, input, decoyHits, id, onFail]);

  /** 일곱 조각: 아직 손에 있는 조각들 */
  const tanLoose = TAN7_PIECES.map((_, i) => i).filter((i) => i < tanHave && !tSlots.includes(i));
  const tanShort = input?.type === 'tangram7' && tanHave < 7 && tanLoose.length === 0;
  const tanPlace = useCallback((slot: number) => {
    if (solved || input?.type !== 'tangram7' || !TAN7_SLOTS[slot] || tSlots[slot] !== null || !tanLoose.includes(tSel)) return;
    const sl = TAN7_SLOTS[slot], pc = TAN7_PIECES[tSel];
    if (pc.kind !== sl.kind || tRot[tSel] % TAN_STEPS !== sl.rot) { setBump(true); return; }
    const next = tSlots.map((v, i) => (i === slot ? tSel : v));
    setTSlots(next);
    setBump(false);
    const rest = tanLoose.filter((i) => i !== tSel);
    if (rest.length) setTSel(rest[0]);
    if (next.every((v) => v !== null)) win();
  }, [solved, input, tSlots, tanLoose, tSel, tRot, win]);
  const tanRotate = useCallback((d: number) => { if (!solved && tanLoose.includes(tSel)) { setTRot((r) => r.map((v, i) => (i === tSel ? (v + d + TAN_STEPS) % TAN_STEPS : v))); setBump(false); } }, [solved, tanLoose, tSel]);
  const tanCycle = useCallback((d: number) => {
    if (solved || tanLoose.length === 0) return;
    const at = Math.max(0, tanLoose.indexOf(tSel));
    setTSel(tanLoose[(at + d + tanLoose.length) % tanLoose.length]);
    setBump(false);
  }, [solved, tanLoose, tSel]);

  const choose = useCallback((i: number) => { if (!solved) { setPick(i); setResult(null); } }, [solved]);
  /** 순서 배열: 칸을 하나 집고, 다른 칸을 누르면 둘이 자리를 바꾼다 */
  const tapSlot = useCallback((i: number) => {
    if (solved) return;
    setResult(null);
    if (held === null) { setHeld(i); return; }
    if (held !== i) setOrder((o) => { const n = o.slice(); [n[held], n[i]] = [n[i], n[held]]; return n; });
    setHeld(null);
  }, [held, solved]);

  // 키 입력은 이 창이 모두 가져간다 (월드 단축키가 숫자·글자 입력에 반응하지 않도록)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      // 한글 조합 중의 Enter는 글자 확정이다
      if (e.isComposing) return;
      // 🧪 테스터 모드: E(터치 확인 버튼 포함)를 누르면 어떤 퍼즐이든 바로 정답 처리, 한 번 더 누르면 닫는다
      if ((e.key === 'e' || e.key === 'E') && useSettings.getState().testerMode) {
        e.preventDefault();
        if (e.repeat) return;
        if (solved) finish();
        else { setFailed(false); win(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); if (solved) finish(); else if (failed) onFail?.(); else if (!mustSolve) onClose(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (solved) finish(); else if (failed) onFail?.(); else if (input?.type === 'stroop' && sIdx < 0) setSIdx(0); else if (input?.type === 'text') textSubmit(); else submit();
        return;
      }
      if (input?.type === 'stroop') {
        const c = STROOP.findIndex((x) => x.key === e.key);
        if (c >= 0) { e.preventDefault(); stroopAnswer(c); }
        return;
      }
      // 글자를 쓰는 동안에는 다른 단축키를 받지 않는다
      if (input?.type === 'text') return;
      if (input?.type === 'tangram7') {
        if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); tanRotate(-1); return; }
        if (e.key === 'e' || e.key === 'E') { e.preventDefault(); tanRotate(1); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); tanCycle(-1); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); tanCycle(1); return; }
      }
      if (input?.type === 'path') {
        if (e.key === 'Backspace' || e.key === 'u' || e.key === 'U') { e.preventDefault(); pathUndo(); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); pathReset(); return; }
      }
      if (input?.type === 'tangram1' && (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft')) { e.preventDefault(); rotate(-1); return; }
      if (input?.type === 'tangram1' && (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight')) { e.preventDefault(); rotate(1); return; }
      if (input?.type === 'ring') {
        const op: RingOp | null = e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === ' ' ? 'swap' : e.key === 'f' || e.key === 'F' ? 'flip' : null;
        if (op) { e.preventDefault(); ringMove(op); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); ringReset(); return; }
      }
      // 숫자키: 고르기는 그 번호 선택, 순서 배열은 그 칸 집기
      const n = parseInt(e.key, 10);
      if (!input || !(n >= 1)) return;
      if (input.type === 'choice' && n <= input.options.length) { e.preventDefault(); choose(n - 1); }
      if (input.type === 'order' && n <= input.items.length) { e.preventDefault(); tapSlot(n - 1); }
      if (input.type === 'maze') { e.preventDefault(); walk(n - 1); }
      if (input.type === 'path' && n <= input.nodes.length) { e.preventDefault(); pathStep(input.nodes[n - 1].id); }
      if (input.type === 'tangram1') { e.preventDefault(); fit(n - 1); }
      if (input.type === 'tangram7') { e.preventDefault(); tanPlace(n - 1); }
      if (input.type === 'jugs') { e.preventDefault(); jugOp(n - 1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [solved, finish, win, onClose, submit, input, choose, tapSlot, walk, fit, rotate, mustSolve, ringMove, ringReset, failed, onFail, sIdx, stroopAnswer, pathStep, pathUndo, pathReset, textSubmit, tanRotate, tanCycle, tanPlace, jugOp]);

  if (!def || !input) return null;
  const nextReward = puzzleReward(def, prog.wrong);

  return (
    <div className="modal-backdrop" onClick={(e) => e.stopPropagation()}>
      <div className="menu puzzle" role="dialog" aria-label={`퍼즐: ${def.title}`}>
        <div className="pz-head">
          <span className="menu-title">🧩 {def.title}</span>
          <span className="pz-meta">{left !== null && !solved && !failed ? `⏳ ${left}초 · ` : ''}{def.level ? `${QUICK_LEVELS[def.level].stars} ${QUICK_LEVELS[def.level].name}` : def.id} · 🌟 기억 +{solved ? reward : nextReward}{def.level ? ` · 🍬 +${QUICK_LEVELS[def.level].reward.candy}` : ''}</span>
        </div>
        <div className="pz-main">
          {def.art === 'mirrorClock' && <MirrorClock />}
          {def.art === 'digital' && <div className="pz-digital" role="img" aria-label={`거울 속 전자시계에 보이는 숫자: ${def.artText}`}>{def.artText}</div>}
          {def.art === 'pendulum' && !solved && !failed && <div className="pz-pendulum" aria-hidden="true"><i /></div>}
          {def.art === 'yard' && <YardArt solved={solved} />}
          {!def.art && def.cast && <PuzzleCast cast={def.cast} />}
          <div className="pz-prompt">
            {def.prompt.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
        {id === 'P-12' && <PuzzleInstrument kind="dial" frequency={nums.length === 3 && nums.every(Boolean) ? Number(nums[0] + nums[1] + '.' + nums[2]) : undefined} />}
        {def.notes && (
          <div className="pz-notes">
            {def.notes.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        )}

        {input.type === 'choice' && (
          <div className="pz-choices" role="radiogroup" aria-label="답 고르기">
            {input.options.map((o, i) => (
              <button key={i} role="radio" aria-checked={pick === i} disabled={solved} className={`pz-choice ${pick === i ? 'on' : ''} ${solved && i === input.answer ? 'right' : ''}`} onClick={() => choose(i)}>
                <span className="choice-num">{i + 1}</span>{o}
              </button>
            ))}
          </div>
        )}

        {input.type === 'order' && (input.view === 'tiles' || input.view === 'rows') && (
          <>
            {input.compose === 'nametag' && (
              <div className="pz-nametag" aria-live="polite" aria-label={`지금 명찰의 글자: ${nametag(order.map((oid) => input.items.find((x) => x.id === oid)!.label))}`}>
                {nametag(order.map((oid) => input.items.find((x) => x.id === oid)!.label))}
              </div>
            )}
            <div className={`pz-tiles ${input.view === 'rows' ? 'rows' : ''}`} aria-label={input.view === 'rows' ? '위에서부터 놓인 순서' : '왼쪽부터 놓인 순서'}>
              {order.map((oid, i) => {
                const it = input.items.find((x) => x.id === oid)!;
                return (
                  <button key={oid} disabled={solved} className={`pz-tile ${held === i ? 'held' : ''} ${input.checkFirst && i >= input.checkFirst ? 'spare' : ''}`} style={{ background: it.color }} aria-label={`${i + 1}번 자리: ${it.label}${it.sub ? ` (${it.sub})` : ''}${held === i ? ' (집음)' : ''}`} onClick={() => tapSlot(i)}>
                    <span className="pz-book-num">{i + 1}</span>
                    <span className="pz-tile-label">{it.label}</span>
                    {it.sub && <span className="pz-tile-sub">{it.sub}</span>}
                    {solved && it.reveal && <span className="pz-tile-reveal">{it.reveal}</span>}
                  </button>
                );
              })}
            </div>
            {!solved && <div className="hud-dim">{held === null ? `하나를 누르고, 바꿀 자리를 누르면 서로 자리를 바꾼다. (숫자키 1~${order.length})` : `${held + 1}번 자리를 집었다. 바꿀 자리를 누르자.`}</div>}
          </>
        )}

        {input.type === 'ring' && (
          <>
            <div className="pz-ring" aria-live="polite" aria-label={`▼ 자리부터 시계 방향: ${ring.map((t) => (t.endsWith('!') ? `${t.slice(0, -1)}(뒤집힘)` : t)).join(' ')}`}>
              {(id === 'P-10' || id === 'P-18') && <PuzzleInstrument kind="ring" />}
              <span className="pz-ring-mark">▼</span>
              {ring.map((t, i) => {
                const a = (-90 + i * (360 / ring.length)) * (Math.PI / 180);
                const flipped = t.endsWith('!');
                return (
                  <span key={i} className={`pz-unown ${i < 2 ? 'front' : ''} ${flipped ? 'flipped' : ''}`} style={{ left: `${50 + Math.cos(a) * 38}%`, top: `${54 + Math.sin(a) * 38}%` }}>
                    {flipped ? t.slice(0, -1) : t}
                  </span>
                );
              })}
              <span className="pz-ring-goal">{input.answer.join(' ')}</span>
            </div>
            {!solved && (
              <div className="pz-answer">
                <button onClick={() => ringMove('left')}>← 돌리기</button>
                <button onClick={() => ringMove('right')}>돌리기 →</button>
                <button onClick={() => ringMove('swap')}>맨 앞 둘 바꾸기 (Space)</button>
                {input.flip && <button onClick={() => ringMove('flip')}>맨 앞 뒤집기 (F)</button>}
                <button onClick={ringReset}>🔦 처음으로 (R)</button>
                <span className="hud-dim">{moves}수째 · 가장 짧게는 {input.par}수</span>
              </div>
            )}
          </>
        )}

        {input.type === 'order' && input.view !== 'tiles' && input.view !== 'rows' && (
          <>
            <div className="pz-shelf" aria-label="왼쪽부터 꽂힌 순서">
              {order.map((oid, i) => {
                const it = input.items.find((x) => x.id === oid)!;
                return (
                  <button key={oid} disabled={solved} className={`pz-book ${held === i ? 'held' : ''}`} style={{ background: it.color }} aria-label={`${i + 1}번 자리: ${it.label}${held === i ? ' (집음)' : ''}`} onClick={() => tapSlot(i)}>
                    <span className="pz-book-letter">{solved ? (input.revealAt?.[i] ?? it.reveal) : ''}</span>
                    <span className="pz-book-name">{it.label}</span>
                    <span className="pz-book-num">{i + 1}</span>
                  </button>
                );
              })}
            </div>
            {!solved && <div className="hud-dim">{held === null ? `책을 하나 누르고, 바꿀 자리의 책을 누르면 서로 자리를 바꾼다. (숫자키 1~${order.length})` : `${held + 1}번 자리의 책을 집었다. 바꿀 자리를 누르자.`}</div>}
          </>
        )}

        {input.type === 'photos' && (
          <div className="pz-photos">
            {input.photos.map((ph, pi) => (
              <div key={pi} className="pz-photo" role="radiogroup" aria-label={`${ph.label} 사진`}>
                <div className="pz-photo-grid" style={{ gridTemplateColumns: `repeat(${input.cols}, 1fr)` }}>
                  {ph.faces.map((f, fi) => (
                    <button
                      key={fi} role="radio" aria-checked={picks[pi] === fi} disabled={solved}
                      aria-label={`${ph.label} ${Math.floor(fi / input.cols) + 1}째 줄 ${(fi % input.cols) + 1}번째 ${f}`}
                      className={picks[pi] === fi ? 'on' : ''}
                      onClick={() => { setPicks((a) => a.map((v, k) => (k === pi ? fi : v))); setResult(null); }}
                    >{f}</button>
                  ))}
                </div>
                <div className="pz-photo-label">{ph.label}</div>
              </div>
            ))}
          </div>
        )}

        {input.type === 'stroop' && !solved && !failed && (
          <div className="pz-stroop">
            {sIdx < 0 ? (
              <button className="primary" onClick={() => setSIdx(0)}>눈을 부릅뜬다 (Enter)</button>
            ) : sIdx < input.rounds ? (
              <>
                <div className="hud-dim" style={{ color: '#b8c0e0' }}>{sIdx + 1} / {input.rounds} · 맞힌 수 {sScore}</div>
                <div key={sIdx} className="pz-stroop-word" style={{ color: STROOP[sItems[sIdx].color].color }}>{STROOP[sItems[sIdx].word].name}</div>
                <div key={`bar${sIdx}`} className="pz-stroop-bar"><i style={{ animationDuration: `${stroopMs}ms` }} /></div>
                <div className="pz-stroop-keys">
                  {STROOP.map((c, i) => <button key={i} onClick={() => stroopAnswer(i)}>{c.arrow} {c.name}</button>)}
                </div>
              </>
            ) : null}
          </div>
        )}

        {input.type === 'path' && (
          <>
            <svg className="pz-path" viewBox="0 -6 324 214" role="group" aria-label={`약도. 지나온 길: ${trail.length ? trail.map((t) => input.nodes.find((n) => n.id === t)!.label).join(' → ') : '아직 시작하지 않음'}`}>
              {input.edges.map(([a, b], i) => {
                const na = input.nodes.find((n) => n.id === a)!, nb = input.nodes.find((n) => n.id === b)!;
                return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} className={usedEdge(a, b) ? 'used' : ''} />;
              })}
              {input.nodes.map((n, i) => {
                const here = trail[trail.length - 1] === n.id;
                return (
                  <g key={n.id} className={`pz-node ${here ? 'here' : ''}`} role="button" tabIndex={0} aria-label={`${i + 1}번: ${n.label}${here ? ' (지금 여기)' : ''}`} onClick={() => pathStep(n.id)}>
                    <circle cx={n.x} cy={n.y} r={13} />
                    <text x={n.x} y={n.y + 4} className="num">{i + 1}</text>
                    <text x={n.x} y={n.y + (n.y < 60 ? -18 : 28)} className="name">{n.label}</text>
                  </g>
                );
              })}
            </svg>
            {!solved && (
              <div className="pz-answer">
                <button onClick={pathUndo}>한 칸 되돌리기 (U)</button>
                <button onClick={pathReset}>처음부터 (R)</button>
                <span className="hud-dim">{trail.length === 0 ? '시작할 장소를 누르자 (숫자키도 된다)' : `${trail.length - 1} / ${input.edges.length}줄 · 이웃한 장소를 누르거나 숫자키로 이동`}</span>
              </div>
            )}
            {stuck && !solved && <div className="pz-result wrong">…더 따라갈 자국이 없는데, 아직 지나지 않은 자국이 남았다. 되돌아가 보자.</div>}
          </>
        )}

        {failed && (
          <div className="pz-result wrong">
            <span>…눈이 감긴다.{input.type === 'stroop' && <span className="hud-dim"> (맞힌 수 {sScore})</span>}</span>
            <button className="primary" onClick={() => onFail?.()}>계속 (Enter)</button>
          </div>
        )}

        {input.type === 'maze' && !solved && (
          <>
            <div className="pz-maze-log" aria-live="polite">
              <span className="hud-dim">{lap + 1}바퀴째 · 갈림길 {(steps % input.forks) + 1}/{input.forks}</span>
              {mazeText && <div>{mazeText}</div>}
            </div>
            <div className="pz-choices">
              {input.paths.map((p, i) => (
                <button key={i} className="pz-choice" onClick={() => walk(i)}><span className="choice-num">{i + 1}</span>{p}</button>
              ))}
              {canGiveUp && (
                <button className="pz-choice giveup" onClick={() => walk(input.paths.length)}><span className="choice-num">{input.paths.length + 1}</span>{input.giveUp}</button>
              )}
            </div>
          </>
        )}

        {input.type === 'jugs' && (
          <>
            <div className="pz-jugs" aria-live="polite">
              {[0, 1].map((k) => (
                <div key={k} className="pz-jug" style={{ height: 30 + input.caps[k] * 15 }} aria-label={`${input.names[k]}: ${jugs[k]} / ${input.caps[k]}${input.unit}`}>
                  <i style={{ height: `${(jugs[k] / input.caps[k]) * 100}%` }} />
                  <b>{jugs[k]}<span> / {input.caps[k]}</span></b>
                  <em>{input.names[k]}</em>
                </div>
              ))}
            </div>
            {!solved && (
              <div className="pz-answer">
                {[`${input.names[0]} 채우기`, `${input.names[1]} 채우기`, `${input.names[0]} 비우기`, `${input.names[1]} 비우기`, `${input.names[0]} → ${input.names[1]}`, `${input.names[1]} → ${input.names[0]}`].map((t, i) => (
                  <button key={i} onClick={() => jugOp(i)}><span className="choice-num">{i + 1}</span> {t}</button>
                ))}
                <button onClick={jugReset}>처음부터</button>
                <span className="hud-dim">{jugMoves}번째 · 가장 짧게는 {input.par}번 · 목표 {input.target}{input.unit}</span>
              </div>
            )}
          </>
        )}

        {input.type === 'text' && !solved && !failed && (
          <>
            <div className="pz-decoys" style={{ opacity: Math.max(0.35, 1 - decoyHits * 0.22) }}>
              {input.decoys.map((d, i) => <button key={i} className="pz-choice" onClick={pickDecoy}>{d}</button>)}
            </div>
            {decoyHits > 0 && <div className="pz-result wrong">{input.decoyReply}</div>}
            <div className="pz-answer">
              <input className="pz-text" aria-label="직접 쓰는 대답" placeholder={input.placeholder} value={typed} maxLength={12} onChange={(e) => { setTyped(e.target.value); setResult(null); }} />
              <button className="primary" disabled={typed.trim() === ''} onClick={textSubmit}>말한다 (Enter)</button>
            </div>
            {result === 'wrong' && <div className="pz-result wrong">…그건 내 이름이 아니다.</div>}
          </>
        )}

        {input.type === 'tangram7' && (
          <>
            <div className="pz-tangram">
              <svg viewBox="-2.25 -2.25 4.5 4.15" className="pz-tan-frame" role="group" aria-label="일곱 조각의 자리가 그려진 별 모양 창문 틀">
                <polygon points={STAR_OUTLINE} fill="#141a38" stroke="#5a4030" strokeWidth={0.16} strokeLinejoin="round" />
                {TAN7_SLOTS.map((sl, i) => (
                  <polygon
                    key={i} points={sl.points} className={`pz-tan-slot lined ${tSlots[i] !== null ? 'on' : ''}`}
                    role="button" tabIndex={0} aria-label={`${i + 1}번 자리: ${sl.name} (${TAN_SHAPE[sl.kind].name})${tSlots[i] !== null ? ' (끼움)' : ''}`}
                    onClick={() => tanPlace(i)}
                  />
                ))}
                {TAN7_SLOTS.map((sl, i) => tSlots[i] === null && <text key={i} x={sl.cx} y={sl.cy} className="pz-tan-num">{i + 1}</text>)}
              </svg>
              {!solved && (
                <div className="pz-tan-tray" role="radiogroup" aria-label="손에 든 조각">
                  {tanLoose.map((pi) => {
                    const sh = TAN_SHAPE[TAN7_PIECES[pi].kind];
                    return (
                      <button key={pi} role="radio" aria-checked={tSel === pi} className={tSel === pi ? 'on' : ''} aria-label={`${sh.name}, ${tRot[pi] * TAN_DEG}도 돌림`} onClick={() => { setTSel(pi); setBump(false); }}>
                        <svg viewBox="-2.4 -2.4 4.8 4.8"><polygon points={sh.points} fill="#ffe890" stroke="#c89820" strokeWidth={0.12} style={{ transform: `rotate(${tRot[pi] * TAN_DEG}deg)`, transition: 'transform 0.15s' }} /></svg>
                      </button>
                    );
                  })}
                  {tanLoose.length === 0 && <span className="hud-dim">손에 든 조각이 없다.</span>}
                </div>
              )}
            </div>
            {!solved && !tanShort && (
              <div className="pz-answer">
                <button onClick={() => tanRotate(-1)}>↺ 돌리기 (Q)</button>
                <button onClick={() => tanRotate(1)}>↻ 돌리기 (E)</button>
                <span className="hud-dim">조각을 고르고(← →) 한 꼭짓점씩 돌린 뒤, 자리를 누르거나 숫자키 1~7로 끼운다 · 별 조각 {tanHave}/7</span>
              </div>
            )}
            {bump && !solved && <div className="pz-result wrong">…모양이나 방향이 맞지 않아 튕겨 나온다.</div>}
            {tanShort && !solved && (
              <div className="pz-result wrong">
                <span>조각이 모자란다. 별의 빈자리로 찬 바람이 샌다. <span className="hud-dim">(별 조각 {tanHave}/7)</span></span>
                <button className="primary" onClick={() => (onFail ? onFail() : onClose())}>계속</button>
              </div>
            )}
          </>
        )}

        {input.type === 'tangram1' && (
          <>
            <TangramWindow rot={rot} placed={placed} onSlot={fit} />
            {!solved && (
              <div className="pz-answer">
                <button onClick={() => rotate(-1)}>↺ 돌리기 (Q)</button>
                <button onClick={() => rotate(1)}>↻ 돌리기 (E)</button>
                <span className="hud-dim">돌린 뒤 자리를 누르거나 숫자키 1 · 2로 끼운다</span>
              </div>
            )}
            {bump && !solved && <div className="pz-result wrong">…모양이 맞지 않아 튕겨 나온다. 조각을 돌려 보자.</div>}
          </>
        )}

        {solved ? (
          <div className="pz-result right">
            <span><b>정답!</b> {def.solvedText}</span>
            <button className="primary" onClick={finish}>계속 (Enter)</button>
          </div>
        ) : failed ? null : (
          <>
            <div className="pz-answer">
              {input.type === 'time' && (
                <>
                  <input ref={hourRef} inputMode="numeric" aria-label="시" value={hour} onChange={(e) => { setHour(digits(e.target.value, 23)); setResult(null); }} />
                  <span>시</span>
                  <input inputMode="numeric" aria-label="분" value={minute} onChange={(e) => { setMinute(digits(e.target.value, 59)); setResult(null); }} />
                  <span>분</span>
                </>
              )}
              {input.type === 'numbers' && input.fields.map((f, i) => (
                <span key={i} className="pz-field">
                  {f.label && <span>{f.label}</span>}
                  <input ref={i === 0 ? hourRef : undefined} inputMode="numeric" aria-label={`${f.label ?? ''} ${f.unit ?? ''} ${i + 1}번 칸`.trim()} value={nums[i]} onChange={(e) => { const v = digits(e.target.value, f.max); setNums((a) => a.map((x, k) => (k === i ? v : x))); setResult(null); }} />
                  {f.unit && <span>{f.unit}</span>}
                </span>
              ))}
              {!direct && <button className="primary" disabled={!answer} onClick={submit}>답하기 (Enter)</button>}
            </div>
            {result === 'wrong' && !direct && <div className="pz-result wrong">…아닌 것 같다. 다시 생각해 보자. <span className="hud-dim">(틀려도 기억이 깎이지는 않는다)</span></div>}
          </>
        )}

        <div className="pz-hints">
          {def.hints.slice(0, prog.hints).map((h, i) => <div key={i} className="pz-hint">💡 힌트 {i + 1}. {h.replace('{me}', useGame.getState().name)}</div>)}
          {!solved && def.noHints && <div className="hud-dim">💡 {def.noHints}</div>}
          {!solved && !def.noHints && prog.hints < 3 && (
            <button className="pz-hint-btn" disabled={candy <= 0} onClick={() => useGame.getState().puzzleHint(id)}>
              🍬 별사탕 1개로 힌트 {prog.hints + 1} 보기 <span className="hud-dim">(남은 별사탕 {candy}개)</span>
            </button>
          )}
        </div>

        {!solved && (
          <div className="pz-foot">
            {mustSolve ? <span /> : <button className="link-btn" onClick={onClose}>나중에 풀기 (Esc)</button>}
            <span className="menu-foot">{tester ? '🧪 테스터 모드: E를 누르면 정답 처리' : '퍼즐을 푸는 동안 시간은 흐르지 않는다'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
