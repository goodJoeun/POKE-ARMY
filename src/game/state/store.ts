'use client';
import { create } from 'zustand';
import type {
  ActiveQuest, Archetype, BranchId, Dialogue, DialogueCtx, Effects, GameId,
  NpcId, Scene, ScheduleEvent, SpotId, Stats,
} from '../types';
import { BRANCHES, FACILITY_NAME, MONTHLY_PAY, RANKS, STORE_NAME, TOTAL_DAYS, fmtMoney, rankIdxForDay, seasonForDay } from '../data/branches';
import { pickSpecies, topArchetype } from '../data/monsters';
import { NPC_IDS, NPC_SKINS, SOLDIER_IDS, birthdayNpcs, currentSquadLeader, npcPresent, arriveDay, leaveDay } from '../data/npcs';
import { buildSchedule } from '../data/schedule';
import { DIALOGUES } from '../data/dialogues';
import { QUESTS, QUEST_CHAINS, chainOf } from '../data/quests';
import { ITEMS, GIFT_AFFINITY } from '../data/items';
import { rollcallPool, type RollcallQuestion } from '../data/rollcall';
import { fixJosa, fmt } from '../engine/text';
import { teleport } from '../engine/runtime';
import { extrasForDay } from '../data/extras';
import { CLUES, CHAPTERS, DREAMS, MEMORY_DECAY, MEMORY_PER_CLUE, MEMORY_PER_DREAM, MEMORY_START, chapterDone, clueDef } from '../data/story';
import { getWorld } from '../engine/map';
import { SUSPICIONS, suspicionState } from '../data/suspicions';
import { CANDY_START, NO_PROGRESS, puzzleDef, puzzleReward, type PuzzleProgress } from '../data/puzzles';

// v2: 포켓몬 종 ID로 변경되어 이전 세이브와 호환되지 않음
const SAVE_KEY = 'poke-army-save-v2';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'alert';
}

interface GradeRecord {
  day: number;
  game: GameId;
  score: number;
}

interface Persist {
  name: string;
  branch: BranchId;
  archetype: Archetype;
  speciesId: string;
  day: number;
  minute: number;
  stats: Stats;
  affinity: Record<NpcId, number>;
  talked: NpcId[];
  gifted: NpcId[];
  seen: string[];
  quests: ActiveQuest[];
  doneQuests: string[];
  inventory: Record<string, number>;
  flags: Record<string, boolean>;
  tips: string[];
  eventIdx: number;
  eventBegun: boolean;
  announced: string[];
  daily: string[];
  dayLog: string[];
  dayStart: { stats: Stats; affinity: Record<NpcId, number> };
  lateCount: number;
  askedQ: number[];
  farewellDone: NpcId[];
  giftCount: Partial<Record<NpcId, number>>;
  /** 식사 시간: 분대가 1생활관에 모였다가 분대장이 부르면 다 같이 식당으로 간다 */
  mealCheck: MealCheck | null;
  /** 야간 순찰 진행 상태 (점검한 장소) */
  patrol: { done: SpotId[] } | null;
  /** 메인 스토리: 찾은 단서 id */
  clues: string[];
  /** 메인 스토리: 모은 별 조각 번호 (1~7) */
  stars: number[];
  /** 🌟 인간의 기억 (0이 되면 배드 엔딩) */
  memory: number;
  /** 두뇌 퍼즐 진행 (퍼즐 ID → 풀었는지 · 오답 수 · 연 힌트 수) */
  puzzles: Record<string, PuzzleProgress>;
  /** 🍬 별사탕 (퍼즐 힌트를 여는 데 쓴다) */
  candy: number;
  /** 의혹 수첩: 이미 알린 상태 (의혹 ID → 'open' | 'solved') */
  susSeen: Record<string, string>;
}

/** 야간 순찰 점검 장소: 막사 1·2층 복도 게시판 · 세탁실 · 화장실 */
export const PATROL_SPOTS: SpotId[] = ['board1', 'laundry1', 'wc1', 'board2', 'laundry2', 'wc2'];
const PATROL_TEXT: Partial<Record<SpotId, string[]>> = {
  board1: ['1층 복도 이상 무. 게시판 경계작전명령서 최신본 확인.', '1층 복도 창문 잠금 확인. 이상 무.'],
  board2: ['2층 복도 이상 무. 비상구 표지등 정상.', '2층 복도 창문 하나가 열려 있다. 닫았다.'],
  laundry1: ['1층 세탁실: 건조기가 아직 돌아간다. 취침 시간 이후 사용 금지… 전원을 끄고 메모를 붙였다.', '1층 세탁실 이상 무. 물 새는 곳 없음.'],
  laundry2: ['2층 세탁실 이상 무. 세제 정리 상태 양호.', '2층 세탁실: 누군가 빨래를 두고 갔다. 이름표 확인 후 메모.'],
  wc1: ['1층 화장실: 불이 켜져 있다. 아무도 없다. 소등 완료.', '1층 화장실 이상 무. 수도꼭지 잠금 확인.'],
  wc2: ['2층 화장실 이상 무.', '2층 화장실: 물이 계속 흐른다. 꼭지를 잠그고 수리 요청 메모.'],
};

const fmtClock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

export interface MealCheck {
  meal: 'lunch' | 'dinner';
  /** 식사 시작 시각 */
  start: number;
  /** 분대와 함께 먹고 생활관으로 돌아왔다. 그 전에는 배식 시간이 끝나지 않고, 다음 일정·스토리도 진행되지 않는다 */
  done: boolean;
}

/**
 * 야간 근무 (불침번 · 위병소): 소등 후 잠들었다가 근무 시간에 깨어나 근무하고, 교대 후 다시 잔다.
 * - watch(불침번): 이전 근무자가 깨움 → 인수인계 → 근무 → 끝나기 10분 전 다음 근무자를 깨워 교대 → 취침
 * - guard(위병소): 사수(또는 부사수)가 조용히 깨움 → 같이 위병소로 → 이전 근무자와 교대 → 근무 → 같이 복귀 → 취침
 */
export interface NightDuty {
  kind: 'watch' | 'guard';
  /** report: 교대를 마치고 지휘통제실 당직 간부에게 근무 철수 보고하러 가는 중 → return: 보고를 마치고 침상으로 */
  phase: 'sleep' | 'woken' | 'toPost' | 'shift' | 'wakeNext' | 'report' | 'return';
  /** 나를 깨우는 사람 (불침번: 이전 근무자 / 위병소: 같이 가는 사수·부사수). 주요 NPC id 또는 'x:<엑스트라>' */
  prev: string;
  /** 위병소: 같이 근무하는 사수·부사수 */
  partner: string | null;
  /** 불침번: 내가 깨울 다음 근무자 */
  next: string;
  nextAwake: boolean;
  shiftStart: number;
  shiftEnd: number;
}

/**
 * 야간 근무 단계마다 시계가 넘어갈 수 없는 시각. 교대 대기 중에 시간이 끝없이 흘러
 * 새벽 3시·4시가 되는 일이 없도록, 다음 장면이 시각을 정할 때까지 여기서 멈춘다.
 */
export function nightDutyClockCap(nd: NightDuty): number {
  switch (nd.phase) {
    case 'sleep':
    case 'woken':
    case 'toPost':
      return nd.shiftStart;
    case 'shift':
      return nd.kind === 'watch' ? nd.shiftEnd - 10 : nd.shiftEnd;
    case 'wakeNext':
    case 'report':
      return nd.shiftEnd;
    case 'return':
      return nd.shiftEnd + 30;
  }
}

export interface RollcallState {
  kind: 'rollcall_am' | 'rollcall_pm';
  q: RollcallQuestion;
  late: boolean;
}

interface Store extends Persist {
  scene: Scene;
  nightDuty: NightDuty | null;
  setNightDuty: (patch: Partial<NightDuty>) => void;
  /** 야간 근무를 마치고 침상에 누웠다 → 하루 끝 */
  finishNightDuty: () => void;
  rollcall: RollcallState | null;
  toasts: Toast[];
  busy: boolean;

  go: (s: Scene) => void;
  newGame: (name: string) => void;
  chooseBranch: (b: BranchId) => void;
  finishQuiz: (scores: Record<Archetype, number>) => void;
  startDay: () => void;
  nextDay: () => void;
  setBusy: (b: boolean) => void;
  /** 시간을 mins분 보낸다 (활동·대화 등). 다음 일정 장소에 도착하기 전에는 그 일정 시각을 넘지 않는다 */
  tick: (mins: number) => void;
  schedule: () => ScheduleEvent[];
  currentEvent: () => ScheduleEvent | null;
  beginEvent: (late?: boolean) => void;
  /** 다음 일정 장소에 도착했다: 그 일정 시각으로 넘어가 바로 시작한다 */
  arrive: () => void;
  /** 분대와 함께 먹고 생활관으로 돌아왔다 (식사 끝) */
  finishSquadMeal: () => void;
  /** 1일차 늦잠 장면 종료 → 연병장으로 끌려가 아침 점호 */
  oversleep: () => void;
  completeEvent: () => void;
  answerRollcall: (choice: number) => boolean;
  closeRollcall: () => void;
  applyEffects: (e: Effects, label?: string, silent?: boolean) => string;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  log: (text: string) => void;
  spend: (mins: number) => void;
  /** 일과 장면 대기: 집합이 끝나 일과가 시작됐다 (월드가 장면을 보여 주고 finishWork를 부른다) */
  work: { eventId: string; game: GameId; slot: 'am' | 'pm' } | null;
  /** 일과 장면이 끝났다 → 일과 종료 시각으로 */
  finishWork: () => void;
  /** 야간 근무(불침번·위병소)의 근무 시간이 지나갔다 → 교대하러 / 복귀하러 */
  finishShift: () => void;
  dialogueCtx: () => DialogueCtx;
  pickDialogue: (npc: NpcId) => Dialogue | null;
  markSeen: (id: string) => void;
  markTalked: (npc: NpcId) => void;
  questStepAt: (t: { spot?: SpotId; npc?: NpcId }) => { quest: ActiveQuest; text: string; minutes?: number } | null;
  advanceQuest: (id: string) => void;
  buy: (item: string) => boolean;
  useItem: (item: string) => void;
  gift: (npc: NpcId, item: string) => boolean;
  addTip: (tip: string) => void;
  markDaily: (key: string) => void;
  markFarewell: (npc: NpcId) => void;
  save: () => void;
  load: () => boolean;
  hasSave: () => boolean;
  wipe: () => void;
  /** 저장 데이터를 지우고 타이틀로 (새로 시작) */
  resetAll: () => void;
  /** 식사 미션: 선임에게 식사 여부를 여쭤봤다 */
  /** 야간 순찰: 장소 점검 */
  patrolCheck: (spot: SpotId) => void;
  /** 야간 순찰 종료 (보고 완료 / 시간 초과) */
  finishPatrol: (reported: boolean) => void;
  /** 메인 스토리: 단서 발견 (처음일 때만 true) */
  findClue: (id: string, memory?: number) => boolean;
  /** 의혹 수첩: 새로 열리거나 풀린 의혹을 알린다 */
  checkSuspicions: () => void;
  /** 방금 눈에 띈 의혹 (ID). 조작할 수 있게 되면 혼잣말 장면으로 떠올리고 수첩에 적는다 · 저장하지 않는다 */
  susNote: string[];
  /** 떠올린 의혹을 목록에서 지운다 */
  popSusNote: (id: string) => void;
  /** 퍼즐: 오답 기록 */
  puzzleWrong: (id: string) => void;
  /** 퍼즐: 별사탕 1개로 다음 힌트 열기 (열었으면 true) */
  puzzleHint: (id: string) => boolean;
  /** 퍼즐: 정답. 되살아날 기억량을 돌려준다 (이미 풀었으면 0) */
  solvePuzzle: (id: string) => number;
  /** 메인 스토리: 별 조각 획득 */
  gainStar: (n: number) => void;
  /** 오늘 밤 꿈(별의 언덕)을 다 봤다 */
  finishDream: () => void;
  /** 메인 스토리: 단서가 아닌 진행(추리 정리·보스·최종 선택 등) 기록 + 장(章) 완료 확인 */
  storyFlag: (flag: string) => void;
}

const zeroAff = (): Record<NpcId, number> =>
  Object.fromEntries(NPC_IDS.map((n) => [n, 0])) as Record<NpcId, number>;

const initialPersist = (): Persist => ({
  name: '김몬스',
  branch: 'army',
  archetype: 'leader',
  speciesId: 'charmander',
  day: 1,
  minute: 360,
  stats: { hp: 80, mental: 70, discipline: 50, skill: 10, money: 30000 },
  affinity: zeroAff(),
  talked: [],
  gifted: [],
  seen: [],
  quests: [],
  doneQuests: [],
  inventory: {},
  flags: {},
  tips: [],
  eventIdx: 0,
  eventBegun: false,
  announced: [],
  daily: [],
  mealCheck: null,
  patrol: null,
  clues: [],
  stars: [],
  memory: MEMORY_START,
  puzzles: {},
  candy: CANDY_START,
  susSeen: {},
  dayLog: [],
  dayStart: { stats: { hp: 80, mental: 70, discipline: 50, skill: 10, money: 30000 }, affinity: zeroAff() },
  lateCount: 0,
  askedQ: [],
  farewellDone: [],
  giftCount: {},
});

/** 일과별 기본 피로도 (체력/멘탈 소모) */
const WORKLOAD: Record<GameId, { hp: number; mental: number }> = {
  env: { hp: -12, mental: -5 },
  sandbag: { hp: -12, mental: -5 },
  combat: { hp: -8, mental: -5 },
  specialty: { hp: -6, mental: -5 },
  guard: { hp: -6, mental: -5 },
  night: { hp: -10, mental: -6 },
};

export function fmtDelta(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : ''}${Number.isInteger(r) ? r : r.toFixed(1)}`;
}


const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
let toastId = 1;

export const useGame = create<Store>((set, get) => ({
  ...initialPersist(),
  scene: 'title',
  work: null,
 
  nightDuty: null,
  susNote: [],
  rollcall: null,
 
  toasts: [],
  busy: false,

  go: (s) => set({ scene: s }),

  newGame: (name) => {
    set({ ...initialPersist(), name: name.trim() || '김몬스', scene: 'home', rollcall: null, work: null, toasts: [], busy: false });
  },

  chooseBranch: (b) => set({ branch: b }),

  finishQuiz: (scores) => {
    const sp = pickSpecies(get().branch, scores);
    set({ archetype: topArchetype(scores), speciesId: sp.id, scene: 'transform' });
  },

  startDay: () => {
    const s = get();
    const day = s.day;
    const prevRank = rankIdxForDay(day - 1);
    const rank = rankIdxForDay(day);
    const logs: string[] = [];
    const st = { ...s.stats };
    const b = BRANCHES[s.branch];
    // 🌟 인간이었던 기억은 매일 조금씩 흐려진다 (스토리가 시작된 뒤부터)
    let memory = s.memory;
    if (s.clues.length > 0 && day >= 2) {
      memory = Math.max(0, memory - MEMORY_DECAY);
      logs.push(`🌟 인간이었던 기억이 조금 흐려졌다… (기억 ${memory})`);
    }
    // 도착/전역 알림
    for (const id of SOLDIER_IDS) {
      const sk = NPC_SKINS[s.branch][id];
      if (arriveDay(id) === day && day > 1) logs.push(`📦 새 후임 ${sk.name}(${sk.species})이(가) 전입 왔다.`);
      if (leaveDay(id) === day) logs.push(`🎉 ${sk.name} 선임이 전역했다.`);
    }
    // 군기 해이: 높을수록 조금씩 풀린다 → 꾸준히 관리해야 유지되는 균형점이 생긴다
    if (day > 1) {
      const slack = Math.max(0, Math.round((st.discipline - 40) * 0.1 * 10) / 10);
      if (slack >= 0.5) {
        st.discipline = Math.max(0, st.discipline - slack);
        logs.push('🫠 하루가 지나며 긴장이 조금 풀렸다.');
      }
    }
    if (day % 2 === 0) {
      st.money += MONTHLY_PAY[rank];
      logs.push(`💰 월급 ${fmtMoney(MONTHLY_PAY[rank])}이 입금됐다.`);
    }
    const promoted = day > 1 && rank > prevRank;
    if (promoted) logs.push(`🎖️ ${RANKS[rank]}으로 진급했다!`);
    if (day === 7) logs.push('🪖 생활관 분대장 임무를 맡게 됐다.');
    // 의뢰인이나 남은 단계의 상대가 전역(전출)해 부대에 없으면 그 퀘스트는 사라진다
    const quests = s.quests.filter((q) => {
      const d = QUESTS[q.id];
      if (!d) return false;
      const gone = [d.giver, ...d.steps.slice(q.step).map((x) => x.npc)].find((n) => n && !npcPresent(n, day));
      if (!gone) return true;
      logs.push(fixJosa(`📋 ${NPC_SKINS[s.branch][gone].name}이(가) 전역해서 「${d.title}」 퀘스트가 사라졌다.`));
      return false;
    });
    teleportToBed(s.branch);
    set({
      minute: 6 * 60,
      eventIdx: 0,
      eventBegun: false,
      announced: [],
      talked: [],
      gifted: [],
      daily: [],
      mealCheck: null,
      patrol: null,
      quests,
      memory,
      dayLog: logs,
      stats: st,
      dayStart: { stats: { ...st }, affinity: { ...s.affinity } },
      scene: promoted ? 'promotion' : 'world',
      work: null,
      rollcall: null,
     
      busy: false,
    });
    for (const l of logs) get().toast(l, 'info');
    if (day === TOTAL_DAYS) get().toast(`🎊 전역일 아침이다! ${b.name} 생활 마지막 날.`, 'good');
    get().checkSuspicions();
    get().save();
  },

  nextDay: () => {
    const s = get();
    if (s.day >= TOTAL_DAYS) {
      set({ scene: 'ending' });
      return;
    }
    set({ day: s.day + 1 });
    get().startDay();
  },

  setBusy: (b) => set({ busy: b }),

  schedule: () => buildSchedule(get().day, get().branch),

  currentEvent: () => {
    const sc = get().schedule();
    return sc[get().eventIdx] ?? null;
  },

  tick: (mins) => {
    const s = get();
    if (s.scene !== 'world') return;
    // 1일차: 늦잠 장면이 끝나기 전에는 시간이 흐르지 않는다
    if (s.day === 1 && !s.flags.wokeUp) return;
    let minute = s.minute + mins;
    if (s.nightDuty) minute = Math.min(minute, Math.max(s.minute, nightDutyClockCap(s.nightDuty)));
    // 시간은 저절로 흐르지 않는다: 다음 일정 장소에 도착하기(arrive) 전에는 그 일정 시각에서 멈춘다
    const ev0 = s.currentEvent();
    if (ev0 && !s.eventBegun && !ev0.auto) minute = Math.min(minute, Math.max(s.minute, ev0.start));
    // 식사는 분대 단위: 분대와 함께 먹고 돌아오기 전에는 배식 시간이 끝나지 않는다
    const mc0 = s.mealCheck;
    if (mc0 && !mc0.done) minute = Math.min(minute, Math.max(s.minute, (mc0.meal === 'lunch' ? 13 * 60 : 18 * 60 + 30) - 1));
    set({ minute });
    const ev = get().currentEvent();
    // 시간대 알림
    const ann = (key: string, at: number, text: string, tone: Toast['tone'] = 'info') => {
      if (minute >= at && !get().announced.includes(key)) {
        set({ announced: [...get().announced, key] });
        get().toast(text, tone);
      }
    };
    if (s.day < TOTAL_DAYS) {
      ann('lunch', 12 * 60, '🍚 점심시간! 오후 일과 전까지 자유 시간이다.');
      ann('dinner', 17 * 60 + 30, '🌇 일과 종료! 개인정비 시간 (저녁 식사 ~18:30)');
      ann('phone', 18 * 60, '📱 휴대폰 사용 시간 (침상에서 사용 가능, ~21:00)');
      // 식사 시간이 끝났는데 밥을 안 먹었으면 굶은 대가를 치른다
      const missed = (key: string, at: number, meal: 'meal_lunch' | 'meal_dinner', label: string) => {
        if (minute < at || get().announced.includes(key)) return;
        set({ announced: [...get().announced, key] });
        if (get().daily.includes(meal)) return;
        get().applyEffects({ hp: -6, mental: -3 }, `${label} 거름`);
        get().toast(`🍚 ${label}을 걸렀다… 배에서 꼬르륵 소리가 난다.`, 'bad');
        get().log(`🍚 ${label}을 걸렀다.`);
      };
      missed('lunchMissed', 13 * 60, 'meal_lunch', '점심');
      missed('dinnerMissed', 18 * 60 + 30, 'meal_dinner', '저녁');
      // 식사 시간이 되면 분대가 1생활관에 모인다. 분대장이 "밥 먹으러 가자" 하면 다 같이 식당으로 (World에서 처리)
      const assignMeal = (key: string, at: number, meal: MealCheck['meal']) => {
        if (minute < at || get().announced.includes(key)) return;
        set({ announced: [...get().announced, key] });
        set({ mealCheck: { meal, start: at, done: false } });
        get().toast('🍚 식사 시간. 먼저 1생활관에 가자 — 분대원들과 다 같이 식당으로 간다.', 'info');
      };
      const endMeal = (key: string, at: number, meal: MealCheck['meal']) => {
        if (minute < at || get().announced.includes(key)) return;
        set({ announced: [...get().announced, key] });
        if (get().mealCheck?.meal === meal) set({ mealCheck: null });
      };
      assignMeal('mealCheckLunch', 12 * 60, 'lunch');
      assignMeal('mealCheckDinner', 17 * 60 + 30, 'dinner');
      endMeal('mealCheckLunchEnd', 13 * 60, 'lunch');
      endMeal('mealCheckDinnerEnd', 18 * 60 + 30, 'dinner');
    }
    if (!ev || s.eventBegun) return;
    if (ev.auto) {
      if (minute >= ev.start) get().beginEvent();
      return;
    }
    if (ev.kind === 'farewell') ann('farewell', ev.start, '🎊 전역 신고 완료! 모두에게 인사하고 위병소 정문으로 가자.', 'good');
    // 나머지 일정은 장소에 도착하면 시작한다 (arrive)
  },

  finishSquadMeal: () => {
    const mc = get().mealCheck;
    if (mc && !mc.done) set({ mealCheck: { ...mc, done: true } });
  },

  arrive: () => {
    const s = get();
    const ev = s.currentEvent();
    if (!ev || s.eventBegun || ev.auto) return;
    if (ev.kind === 'farewell') { get().beginEvent(); return; }
    // 식사 시간엔 먼저 생활관에 들러 분대와 함께 먹어야 다음 일정으로 넘어간다
    if (s.mealCheck && !s.mealCheck.done) {
      get().toast('🍚 식사 시간이다. 먼저 1생활관에 들러 분대와 함께 밥을 먹자.', 'alert');
      return;
    }
    // 그 일정 시각으로 넘어간다 (그 사이 지나간 식사·알림 처리 포함)
    if (s.minute < ev.start) {
      set({ minute: ev.start });
      get().tick(0);
    }
    const now = get();
    if (now.eventBegun || now.currentEvent()?.id !== ev.id) return;
    get().toast(`✅ 집합 완료! ${ev.label} 시작`, 'good');
    get().beginEvent();
  },

  oversleep: () => {
    const s = get();
    const sp = getWorld(s.branch, BRANCHES[s.branch].trainArea).spots.parade;
    teleport(sp.map, sp.x + 0.5, sp.y + 1.5, 'up');
    get().applyEffects({ discipline: -5, mental: -2, flag: 'wokeUp' }, '전입 첫날 늦잠');
    get().log('😱 눈을 떠 보니 포켓몬이 되어 있었다. 게다가 전입 첫날부터 늦잠…');
    get().markSeen('sgt_first');
    set({ lateCount: s.lateCount + 1, minute: Math.max(s.minute, 6 * 60 + 25) });
    get().beginEvent(true);
  },

  beginEvent: (late = false) => {
    const s = get();
    const ev = s.currentEvent();
    if (!ev || s.eventBegun) return;
    set({ eventBegun: true });
    switch (ev.kind) {
      case 'rollcall_am':
      case 'rollcall_pm': {
        const pool = rollcallPool(s.branch);
        let candidates = pool.map((_, i) => i).filter((i) => !get().askedQ.includes(i));
        if (candidates.length === 0) { candidates = pool.map((_, i) => i); set({ askedQ: [] }); }
        const qi = candidates[Math.floor(Math.random() * candidates.length)];
        const base = pool[qi];
        const order = base.options.map((_, i) => i).sort(() => Math.random() - 0.5);
        const q = { ...base, options: order.map((i) => base.options[i]), answer: order.indexOf(base.answer) };
        set({ askedQ: [...get().askedQ, qi], rollcall: { kind: ev.kind, q, late }, busy: true });
        break;
      }
      case 'work':
        // 일과는 조작하지 않는다. 그 시간에 있었던 일을 짧은 장면으로 보여 준다 (data/workScenes.ts)
        set({ work: { eventId: ev.id, game: ev.game!, slot: ev.id === 'work_am' ? 'am' : 'pm' }, busy: true });
        break;
      case 'night': {
        // 소등 → 잠들었다가 근무 시간에 깨어난다 (진행은 월드에서)
        const xs = new Set(extrasForDay(s.branch, s.day).map((d) => `x:${d.id}`));
        const has = (k: string) => (k.startsWith('x:') ? xs.has(k) : npcPresent(k as NpcId, s.day));
        const pick = (...ks: string[]) => ks.find(has) ?? ks[ks.length - 1];
        const rank = rankIdxForDay(s.day);
        let nd: NightDuty;
        if (ev.game === 'guard') {
          // 이병·일병이면 사수(선임)를 따라가고, 상병부터는 부사수(후임)를 데려간다
          const partner = rank <= 1 ? pick('senior', 'x:sq1', 'x:r2b', 'sgt') : pick('junior', 'junior2', 'buddy');
          nd = { kind: 'guard', phase: 'sleep', prev: partner, partner, next: '', nextAwake: false, shiftStart: 24 * 60, shiftEnd: 26 * 60 };
        } else {
          // 앞 근무자: 이병·일병 땐 2분대 선임이, 상병부터는 후임(막내)이 깨우러 온다
          const prev = rank >= 2 ? pick('junior2', 'junior', 'x:r2d', 'buddy') : pick('x:r2c', 'x:r2b', 'x:room2a', 'buddy');
          const next = pick('buddy', 'junior', 'x:sq1', 'senior');
          nd = { kind: 'watch', phase: 'sleep', prev, partner: null, next, nextAwake: false, shiftStart: 24 * 60, shiftEnd: 25 * 60 };
        }
        set({ nightDuty: nd, busy: false });
        break;
      }
      case 'farewell':
        set({ scene: 'ending' });
        break;
      case 'patrol':
        set({ patrol: { done: [] }, busy: false });
        get().toast('🔦 야간 순찰 시작! 막사 1·2층 복도·세탁실·화장실을 점검하고 지휘통제실 당직사관에게 보고하자', 'alert');
        if (s.clues.length > 0 && s.day === 5) get().toast('📋 당직 간부: "2층 게시판 공지 떨어진 거 없는지도 봐라."', 'info');
        if (s.clues.length > 0 && s.day === 9) get().toast('📋 당직 간부: "2층 휴게실 TV를 누가 켜 놨더라. 끄고 와라."', 'info');
        break;
    }
  },

  setNightDuty: (patch) => {
    const nd = get().nightDuty;
    if (nd) set({ nightDuty: { ...nd, ...patch } });
  },

  finishNightDuty: () => {
    const nd = get().nightDuty;
    if (!nd) return;
    get().applyEffects({ discipline: 2 }, nd.kind === 'watch' ? '불침번 교대' : '위병소 근무 복귀');
    get().log(nd.kind === 'watch' ? '🌙 불침번 근무를 마치고 다음 근무자와 교대했다.' : '🌙 위병소 야간 근무를 마치고 조용히 복귀했다.');
    set({ nightDuty: null });
    get().completeEvent();
  },

  completeEvent: () => {
    const s = get();
    const ev = s.currentEvent();
    if (!ev) return;
    if (s.nightDuty) set({ nightDuty: null });
    if (s.work) set({ work: null });
    const minute = Math.max(s.minute, ev.end);
    set({ minute, eventIdx: s.eventIdx + 1, eventBegun: false, rollcall: null, busy: false });
    if (ev.kind === 'rollcall_am' && s.day < TOTAL_DAYS) get().toast('🍳 아침 식사와 청소를 마쳤다.', 'info');
    const next = get().currentEvent();
    if (!next) {
      set({ scene: 'dayEnd' });
      return;
    }
    if (next.auto && get().minute >= next.start) {
      get().beginEvent();
      return;
    }
    set({ scene: 'world' });
    // 시간이 넘어갔으니 그 시각의 알림(식사 시간 등)을 처리하고, 다음 목적지를 알려 준다
    get().tick(0);
    if (!get().eventBegun && get().currentEvent()?.id === next.id && next.spot && next.kind !== 'farewell')
      get().toast(`📍 다음 일정: ${fmtClock(next.start)} ${next.label} — ${buildMapSpotLabel(get().branch, next.spot)}에 가면 시작`, 'info');
    get().save();
  },

  answerRollcall: (choice) => {
    const s = get();
    if (!s.rollcall) return false;
    const correct = choice === s.rollcall.q.answer;
    const who: NpcId = 'lt';
    if (correct) get().applyEffects({ discipline: 2, affinity: { [who]: 1 } }, '점호');
    else get().applyEffects({ discipline: -3, mental: -2 }, '점호');
    get().addTip(s.rollcall.q.tip);
    get().log(correct ? '✅ 점호 질문에 정확히 답했다.' : '❌ 점호 질문에 틀렸다.');
    return correct;
  },

  closeRollcall: () => {
    set({ rollcall: null, busy: false });
    get().completeEvent();
  },

  applyEffects: (e, label, silent) => {
    const s = get();
    const mult = (key: string, v: number) => {
      if (v <= 0) return v;
      if (key === 'discipline' && s.archetype === 'leader') return Math.round(v * 1.3);
      if (key === 'skill' && s.archetype === 'diligent') return Math.round(v * 1.3);
      if (key === 'affinity' && s.archetype === 'social') return Math.round(v * 1.3);
      return v;
    };
    const stats = { ...s.stats };
    const parts: string[] = [];
    (['hp', 'mental', 'discipline', 'skill', 'money'] as (keyof Stats)[]).forEach((k) => {
      const raw = e[k];
      if (!raw) return;
      let v = mult(k, raw);
      // 군기·숙련도는 높을수록 오르기 어렵다 (소프트 캡)
      if ((k === 'discipline' || k === 'skill') && v > 0) v = Math.round(v * Math.max(0.2, 1 - stats[k] / 125) * 10) / 10;
      stats[k] = k === 'money' ? Math.max(0, stats[k] + v) : clamp(stats[k] + v);
      // 체력·멘탈·군기·숙련은 화면에 보이지 않는 값이다: 알림에는 돈만 적는다
      if (k === 'money') parts.push(`돈 ${v > 0 ? '+' : ''}${v.toLocaleString()}`);
    });
    const affinity = { ...s.affinity };
    if (e.affinity) {
      for (const [id, raw] of Object.entries(e.affinity) as [NpcId, number][]) {
        if (!raw) continue;
        const v = mult('affinity', raw);
        affinity[id] = clamp(affinity[id] + v, -100, 100);
        parts.push(`${NPC_SKINS[s.branch][id].name} 호감 ${v > 0 ? '+' : ''}${v}`);
      }
    }
    let memory = s.memory;
    if (e.memory) {
      memory = Math.max(0, Math.min(100, memory + e.memory));
      parts.push(`🌟 기억 ${e.memory > 0 ? '+' : ''}${e.memory}`);
    }
    let candy = s.candy;
    if (e.candy) {
      candy = Math.max(0, candy + e.candy);
      parts.push(`🍬 별사탕 ${e.candy > 0 ? '+' : ''}${e.candy}`);
    }
    const flags = e.flag ? { ...s.flags, [e.flag]: true } : s.flags;
    let quests = s.quests;
    if (e.quest && !s.quests.some((q) => q.id === e.quest) && !s.doneQuests.includes(e.quest)) {
      quests = [...s.quests, { id: e.quest, step: 0 }];
      get().toast(`📋 새 퀘스트: ${QUESTS[e.quest].title}`, 'info');
    }
    const inventory = { ...s.inventory };
    if (e.item) inventory[e.item] = (inventory[e.item] ?? 0) + 1;
    set({ stats, affinity, flags, quests, inventory, memory, candy });

    // 쓰러짐 / 멘붕 처리
    if (stats.hp <= 0) {
      set({ stats: { ...get().stats, hp: 40, mental: clamp(get().stats.mental - 10) } });
      get().toast('🏥 너무 지쳐서 쓰러졌다… 의무대에서 쉬고 나왔다.', 'bad');
      get().log('🏥 탈진해서 의무대 신세를 졌다.');
    }
    if (get().stats.mental <= 0) {
      set({ stats: { ...get().stats, mental: 35, discipline: clamp(get().stats.discipline - 5) } });
      get().toast('🫂 병영생활전문상담관과 면담했다. 마음이 조금 편해졌다.', 'info');
      get().log('🫂 상담관 선생님과 이야기를 나눴다.');
    }
    const summary = parts.join(' · ');
    if (!silent && summary) {
      const negative = Object.values(e).some((v) => typeof v === 'number' && v < 0);
      get().toast(`${label ? `[${label}] ` : ''}${summary}`, negative && parts.every((p) => p.includes('-')) ? 'bad' : 'good');
    }
    return summary;
  },

  toast: (text, tone = 'info') => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-4), { id, text: fixJosa(text), tone }] });
    setTimeout(() => get().dismissToast(id), tone === 'alert' ? 5000 : 3800);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  log: (text) => set({ dayLog: [...get().dayLog, fixJosa(text)] }),

  spend: (mins) => get().tick(mins),

  finishWork: () => {
    const s = get();
    const w = s.work;
    if (!w) return;
    const game = w.game as Exclude<GameId, 'night'>;
    const title = BRANCHES[s.branch].games[game];
    set({ work: null });
    get().applyEffects({ ...WORKLOAD[game], skill: 2, discipline: 1 }, title, true);
    get().log(`🪖 ${title}: 일과를 마쳤다.`);
    if (s.currentEvent()?.id === w.eventId) get().completeEvent();
  },

  finishShift: () => {
    const nd = get().nightDuty;
    if (!nd || nd.phase !== 'shift') return;
    const watch = nd.kind === 'watch';
    get().applyEffects({ ...WORKLOAD[watch ? 'night' : 'guard'], discipline: 1 }, watch ? '불침번 근무' : '위병소 근무', true);
    get().log(watch ? '🌙 한 시간 동안 생활관의 밤을 지켰다.' : '🌙 두 시간 동안 위병소 초소를 지켰다.');
    // 불침번은 끝나기 10분 전 → 다음 근무자 깨우러 / 위병소는 다음 근무자와 교대 → 지휘통제실에 철수 보고
    set({ nightDuty: { ...nd, phase: watch ? 'wakeNext' : 'report' }, minute: watch ? nd.shiftEnd - 10 : nd.shiftEnd });
  },

  dialogueCtx: () => {
    const s = get();
    return {
      day: s.day,
      done: s.doneQuests,
      minute: s.minute,
      rankIdx: rankIdxForDay(s.day),
      affinity: s.affinity,
      flags: s.flags,
      season: seasonForDay(s.day),
      branch: s.branch,
      isLastDay: s.day >= TOTAL_DAYS,
    };
  },

  pickDialogue: (npc) => {
    const s = get();
    // 📖 동기가 나를 잊은 동안(잊혀 가는 이름): 예전처럼 부탁하거나 아는 척하지 않는다
    if (npc === 'buddy' && buddyForgot(s)) return null;
    const c = get().dialogueCtx();
    const cands = DIALOGUES.filter(
      (d) => d.npc === npc && !(d.once && s.seen.includes(d.id)) && (!d.when || d.when(c)),
    );
    if (cands.length === 0) return null;
    const maxP = Math.max(...cands.map((d) => d.priority ?? 0));
    const top = cands.filter((d) => (d.priority ?? 0) === maxP);
    return top[Math.floor(Math.random() * top.length)];
  },

  markSeen: (id) => { if (!get().seen.includes(id)) set({ seen: [...get().seen, id] }); },
  markTalked: (npc) => { if (!get().talked.includes(npc)) set({ talked: [...get().talked, npc] }); },

  questStepAt: (t) => {
    const s = get();
    for (const q of s.quests) {
      const def = QUESTS[q.id];
      const step = def.steps[q.step];
      if (!step) continue;
      if ((t.spot && step.spot === t.spot) || (t.npc && step.npc === t.npc)) {
        return { quest: q, text: fmt(step.text, { branch: s.branch, name: s.name, day: s.day }), minutes: step.minutes };
      }
    }
    return null;
  },

  advanceQuest: (id) => {
    const s = get();
    const q = s.quests.find((x) => x.id === id);
    if (!q) return;
    const def = QUESTS[id];
    const step = q.step + 1;
    if (step >= def.steps.length) {
      const doneQuests = [...s.doneQuests, id];
      set({ quests: s.quests.filter((x) => x.id !== id), doneQuests });
      get().applyEffects(def.reward, `퀘스트 완료: ${def.title}`);
      get().log(`📋 퀘스트 "${def.title}" 완료`);
      // 연계 퀘스트: 다음 단계 안내 / 체인을 모두 끝내면 보너스
      const ch = chainOf(id);
      if (ch) {
        const idx = ch.quests.indexOf(id);
        if (ch.quests.every((qid) => doneQuests.includes(qid))) {
          get().applyEffects(ch.bonus, `🔗 연계 퀘스트 완료: ${ch.title}`);
          get().toast(`🔗 연계 퀘스트 「${ch.title}」 완료! 보너스 보상`, 'good');
          get().log(`🔗 연계 퀘스트 「${ch.title}」를 모두 마쳤다.`);
        } else if (idx >= 0 && idx < ch.quests.length - 1) {
          get().toast(`🔗 연계 퀘스트 「${ch.title}」 ${idx + 1}/${ch.quests.length} — 다음: ${QUESTS[ch.quests[idx + 1]].title} (${NPC_SKINS[s.branch][ch.giver].name}에게 다시 말 걸기)`, 'info');
        }
      }
    } else {
      set({ quests: s.quests.map((x) => (x.id === id ? { ...x, step } : x)) });
    }
  },

  buy: (item) => {
    const s = get();
    const def = ITEMS[item];
    if (s.stats.money < def.price) {
      get().toast('💸 돈이 부족하다.', 'bad');
      return false;
    }
    set({ stats: { ...s.stats, money: s.stats.money - def.price }, inventory: { ...s.inventory, [item]: (s.inventory[item] ?? 0) + 1 } });
    get().toast(`🛒 ${def.icon} ${def.name} 구매 (-${def.price.toLocaleString()}원)`, 'info');
    return true;
  },

  useItem: (item) => {
    const s = get();
    if (!s.inventory[item]) return;
    set({ inventory: { ...s.inventory, [item]: s.inventory[item] - 1 } });
    get().applyEffects(ITEMS[item].use, `${ITEMS[item].icon} ${ITEMS[item].name}`);
  },

  gift: (npc, item) => {
    const s = get();
    if (!s.inventory[item] || s.gifted.includes(npc)) return false;
    const count = s.giftCount[npc] ?? 0;
    set({
      inventory: { ...s.inventory, [item]: s.inventory[item] - 1 },
      gifted: [...s.gifted, npc],
      giftCount: { ...s.giftCount, [npc]: count + 1 },
    });
    // 같은 상대에게 반복 선물할수록 효과 감소 (6 → 4 → 2 → 1…)
    const bday = birthdayNpcs(s.day).includes(npc);
    const bonus = (item === 'chocopie' ? 2 : 0) + (bday ? 3 : 0);
    if (bday) get().toast(`🎂 생일 축하 선물! ${NPC_SKINS[s.branch][npc].name}의 호감이 더 올랐다.`, 'good');
    get().applyEffects({ affinity: { [npc]: Math.max(1, GIFT_AFFINITY - count * 2) + bonus } }, '선물');
    get().log(`🎁 ${NPC_SKINS[s.branch][npc].name}에게 ${ITEMS[item].name}을(를) 선물했다.`);
    return true;
  },

  addTip: (tip) => {
    const s = get();
    const t = fmt(tip, { branch: s.branch, name: s.name, day: s.day });
    if (!s.tips.includes(t)) set({ tips: [...s.tips, t] });
  },

  markDaily: (key) => set({ daily: [...get().daily, key] }),
  markFarewell: (npc) => set({ farewellDone: [...get().farewellDone, npc] }),

  findClue: (id, memory = MEMORY_PER_CLUE) => {
    const s = get();
    const def = clueDef(id);
    if (!def || s.clues.includes(id)) return false;
    const clues = [...s.clues, id];
    set({ clues });
    get().applyEffects({ memory }, `🔍 단서: ${def.title}`);
    get().log(`🔍 단서 「${def.title}」를 기억의 실마리에 적었다.`);
    // 장(章) 완료
    const ch = CHAPTERS.find((c) => c.n === def.chapter);
    if (ch && chapterDone(ch.n, { clues, flags: get().flags }) && !s.flags[`story_ch${ch.n}`]) {
      get().applyEffects({ flag: `story_ch${ch.n}` }, undefined, true);
      get().toast(`📖 ${ch.n}장 「${ch.title}」 완료! 실마리 ${clues.length}/${CLUES.length}`, 'good');
      get().log(`📖 ${ch.n}장 「${ch.title}」의 단서를 모두 모았다.`);
    }
    get().checkSuspicions();
    return true;
  },

  popSusNote: (id) => set({ susNote: get().susNote.filter((x) => x !== id) }),

  checkSuspicions: () => {
    const s = get();
    if (s.clues.length === 0) return;
    const seen = { ...s.susSeen };
    let changed = false;
    for (const d of SUSPICIONS) {
      const st = suspicionState(d, s);
      if (st === 'hidden' || seen[d.id] === st) continue;
      // 열리자마자 풀린 의혹도 물음부터 알린다
      // 새 의혹은 불쑥 알림으로 띄우지 않는다: 주인공이 이상한 점을 스스로 떠올리는 장면으로 보여 준다 (World)
      if (!seen[d.id]) { set({ susNote: [...get().susNote.filter((x) => x !== d.id), d.id] }); get().log(`❓ 수첩에 의혹을 적었다: ${d.title}`); }
      if (st === 'solved') { get().toast(`✅ 의혹이 풀렸다: ${d.title}`, 'good'); get().log(`✅ 의혹 「${d.title}」이(가) 풀렸다.`); }
      seen[d.id] = st;
      changed = true;
    }
    if (changed) set({ susSeen: seen });
  },

  puzzleWrong: (id) => {
    const s = get();
    const p = s.puzzles[id] ?? NO_PROGRESS;
    if (p.solved) return;
    set({ puzzles: { ...s.puzzles, [id]: { ...p, wrong: p.wrong + 1 } } });
  },

  puzzleHint: (id) => {
    const s = get();
    const p = s.puzzles[id] ?? NO_PROGRESS;
    if (p.hints >= 3 || s.candy <= 0) return false;
    set({ candy: s.candy - 1, puzzles: { ...s.puzzles, [id]: { ...p, hints: p.hints + 1 } } });
    return true;
  },

  solvePuzzle: (id) => {
    const s = get();
    const def = puzzleDef(id);
    const p = s.puzzles[id] ?? NO_PROGRESS;
    if (!def || p.solved) return 0;
    set({ puzzles: { ...s.puzzles, [id]: { ...p, solved: true } } });
    get().log(`🧩 퍼즐 「${def.title}」을(를) 풀었다.${p.wrong === 0 ? ' 한 번에!' : ''}`);
    return puzzleReward(def, p.wrong);
  },

  gainStar: (n) => {
    const s = get();
    if (s.stars.includes(n)) return;
    set({ stars: [...s.stars, n].sort((a, b) => a - b) });
    get().toast(`✨ 별 조각을 얻었다! (${s.stars.length + 1}/7)`, 'good');
    get().log(`✨ 별 조각 ${n}번째를 손에 넣었다.`);
  },

  storyFlag: (flag) => {
    if (get().flags[flag]) return;
    set({ flags: { ...get().flags, [flag]: true } });
    const s = get();
    for (const ch of CHAPTERS) {
      if (s.flags[`story_ch${ch.n}`] || !chapterDone(ch.n, s)) continue;
      set({ flags: { ...get().flags, [`story_ch${ch.n}`]: true } });
      get().toast(`📖 ${ch.n}장 「${ch.title}」 완료!`, 'good');
      get().log(`📖 ${ch.n}장 「${ch.title}」을(를) 마쳤다.`);
    }
    get().checkSuspicions();
  },

  finishDream: () => {
    const s = get();
    const dream = DREAMS[s.day];
    if (!dream || s.flags[`dream_${s.day}`]) return;
    get().applyEffects({ flag: `dream_${s.day}` }, undefined, true);
    if (dream.clue) get().findClue(dream.clue);
    if (dream.star) get().gainStar(dream.star);
    get().applyEffects({ memory: MEMORY_PER_DREAM }, '꿈: 별의 언덕', true);
  },

  patrolCheck: (spot) => {
    const pt = get().patrol;
    if (!pt || pt.done.includes(spot)) return;
    const done = [...pt.done, spot];
    set({ patrol: { done } });
    const pool = PATROL_TEXT[spot] ?? ['이상 무.'];
    get().toast(`🔦 (${done.length}/${PATROL_SPOTS.length}) ${pool[Math.floor(Math.random() * pool.length)]}`, 'info');
    if (done.length >= PATROL_SPOTS.length) get().toast('✅ 순찰 완료! 막사 1층 지휘통제실 당직사관에게 보고하자.', 'good');
  },

  finishPatrol: (reported) => {
    const pt = get().patrol;
    if (!pt) return;
    set({ patrol: null });
    if (reported) {
      get().applyEffects({ discipline: 4, affinity: { lt: 3 } }, '야간 순찰');
      get().log('🔦 야간 순찰을 빠짐없이 돌고 당직사관에게 보고했다.');
    } else {
      const ratio = pt.done.length / PATROL_SPOTS.length;
      get().applyEffects(ratio >= 1 ? { discipline: 1 } : { discipline: -3, mental: -2 }, '야간 순찰');
      get().toast(ratio >= 1 ? '🔦 순찰은 다 돌았지만 보고를 못 했다…' : `🔦 순찰을 다 돌지 못했다… (${pt.done.length}/${PATROL_SPOTS.length})`, 'bad');
      get().log('🔦 야간 순찰을 제대로 마치지 못했다.');
    }
    get().completeEvent();
  },

  save: () => {
    try {
      const s = get();
      const data: Persist = {
        name: s.name, branch: s.branch, archetype: s.archetype, speciesId: s.speciesId, day: s.day, minute: s.minute,
        stats: s.stats, affinity: s.affinity, talked: s.talked, gifted: s.gifted, seen: s.seen, quests: s.quests,
        doneQuests: s.doneQuests, inventory: s.inventory, flags: s.flags, tips: s.tips, eventIdx: s.eventIdx,
        eventBegun: false, announced: s.announced, daily: s.daily, dayLog: s.dayLog, dayStart: s.dayStart,
        lateCount: s.lateCount, askedQ: s.askedQ, farewellDone: s.farewellDone,
        giftCount: s.giftCount, mealCheck: s.mealCheck, patrol: null,
        clues: s.clues, stars: s.stars, memory: s.memory, puzzles: s.puzzles, candy: s.candy, susSeen: s.susSeen,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* 저장 불가 환경 */ }
  },

  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as Persist;
      // 식사 상태는 끼니·시작 시각만 이어받는다. 저장할 때 이미 먹었으면 식사는 끝난 것으로
      const mc = data.mealCheck;
      const mealCheck = mc ? { meal: mc.meal, start: mc.start, done: !!data.daily?.includes(`meal_${mc.meal}`) } : null;
      set({ ...initialPersist(), ...data, mealCheck, scene: 'world', nightDuty: null, rollcall: null, work: null, toasts: [], busy: false });
      teleportToBed(data.branch);
      return true;
    } catch {
      return false;
    }
  },

  hasSave: () => {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  },

  wipe: () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
  },

  resetAll: () => {
    get().wipe();
    set({ ...initialPersist(), scene: 'title', rollcall: null, work: null, toasts: [], busy: false });
  },
}));

function teleportToBed(branch: BranchId) {
  const bed = getWorld(branch, BRANCHES[branch].trainArea).spots.bed;
  teleport(bed.map, bed.x + 0.5, bed.y + 0.5, 'down');
}

function buildMapSpotLabel(branch: BranchId, spot: SpotId): string {
  const labels: Record<SpotId, string> = {
    bed: '1생활관 내 침상', barracks: '막사 1층 1생활관', mess: '병영식당', px: STORE_NAME[branch], admin: '막사 1층 행정반',
    command: '막사 1층 지휘통제실', tv: '막사 2층 휴게실', cyber: '막사 2층 싸지방',
    gym: '막사 2층 체단실', parade: '연병장', train: BRANCHES[branch].trainArea, post: '위병소 초소', gate: '위병소 정문',
    maint: '막사 1층 정비실', library: '막사 2층 도서관', wc1: '막사 1층 화장실', wc2: '막사 2층 화장실',
    laundry1: '막사 1층 세탁실', laundry2: '막사 2층 세탁실', water1: '막사 1층 정수기', water2: '막사 2층 정수기',
    board1: '막사 1층 복도 게시판', board2: '막사 2층 복도 게시판',
    kitchen: '병영식당 조리실', court: '농구장', recycle: '분리수거장', ammo: FACILITY_NAME[branch],
    cairn: '분리수거장 구석 돌탑', ammoledger: '탄약고 수불 대장',
  };
  return labels[spot];
}

export function spotLabel(branch: BranchId, spot: SpotId) {
  return buildMapSpotLabel(branch, spot);
}

/** 퀘스트 창 "받을 수 있는 퀘스트": 퀘스트를 주는 대화 기준으로 지금 받을 수 있는지 / 잠겨 있는지 */
export interface QuestOffer {
  questId: string;
  giver: NpcId;
  dialogueId: string;
  /** 지금 말을 걸면 받을 수 있다 */
  open: boolean;
  /** 대화했지만 거절해서 놓쳤다 */
  missed: boolean;
}
export function questOffers(s: Store): QuestOffer[] {
  const c = s.dialogueCtx();
  const out = new Map<string, QuestOffer>();
  const forgot = buddyForgot(s);
  for (const d of DIALOGUES) {
    if (forgot && d.npc === 'buddy') continue;
    const qids = [...new Set((d.choices ?? []).map((ch) => ch.effects?.quest).filter(Boolean) as string[])];
    for (const qid of qids) {
      if (!QUESTS[qid] || s.quests.some((x) => x.id === qid) || s.doneQuests.includes(qid)) continue;
      if (!npcPresent(d.npc, s.day)) continue;
      const seen = !!d.once && s.seen.includes(d.id);
      const open = !seen && (!d.when || d.when(c));
      const prev = out.get(qid);
      // 같은 퀘스트를 주는 대화가 여럿이면 받을 수 있는 쪽을 우선
      if (!prev || (open && !prev.open)) out.set(qid, { questId: qid, giver: d.npc, dialogueId: d.id, open, missed: seen && !open });
    }
  }
  return [...out.values()];
}
/** 📖 잊혀 가는 이름: 동기가 내 이름을 잊었고(10일차~) 아직 기억을 되찾지 못했다 */
export function buddyForgot(s: { flags: Record<string, boolean> }): boolean {
  return !!s.flags.m13 && !s.flags.buddyBack;
}
/** 대화 id로 대화 찾기 */
export function dialogueById(id: string) {
  return DIALOGUES.find((d) => d.id === id) ?? null;
}
export { QUEST_CHAINS };

export function presentNpcs(day: number): NpcId[] {
  return NPC_IDS.filter((id) => npcPresent(id, day));
}
