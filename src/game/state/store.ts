'use client';
import { create } from 'zustand';
import type {
  ActiveQuest, Archetype, BranchId, Dialogue, DialogueCtx, Effects, GameId, MinigameRequest,
  NpcId, Scene, ScheduleEvent, SpotId, Stats,
} from '../types';
import { BRANCHES, FACILITY_NAME, MONTHLY_PAY, RANKS, STORE_NAME, TOTAL_DAYS, fmtMoney, rankIdxForDay, seasonForDay } from '../data/branches';
import { pickSpecies, topArchetype } from '../data/monsters';
import { NPC_IDS, NPC_ROLES, NPC_SKINS, SOLDIER_IDS, birthdayNpcs, currentSquadLeader, npcPresent, arriveDay, leaveDay } from '../data/npcs';
import { buildSchedule, isFreeTimeEvening, isMealTime, mealGatherMinutes } from '../data/schedule';
import { DIALOGUES } from '../data/dialogues';
import { QUESTS, QUEST_CHAINS, chainOf } from '../data/quests';
import { ITEMS, GIFT_AFFINITY } from '../data/items';
import { rollcallPool, type RollcallQuestion } from '../data/rollcall';
import { fmt } from '../engine/text';
import { runtime, teleport } from '../engine/runtime';
import { inEventArea } from '../engine/eventArea';
import { isExtraKey, memberName } from '../engine/whereabouts';
import { extrasForDay } from '../data/extras';
import { CLUES, CHAPTERS, DREAMS, MEMORY_DECAY, MEMORY_PER_CLUE, MEMORY_PER_DREAM, MEMORY_START, chapterDone, clueDef } from '../data/story';
import { getWorld } from '../engine/map';

// v2: 포켓몬 종 ID로 변경되어 이전 세이브와 호환되지 않음
const SAVE_KEY = 'poke-army-save-v2';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'alert';
}

export interface GradeRecord {
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
  grades: GradeRecord[];
  lateCount: number;
  askedQ: number[];
  farewellDone: NpcId[];
  giftCount: Partial<Record<NpcId, number>>;
  /** 식사 집합 미션: 밥 먹으러 가기 전에 선임들께 여쭤보고 함께 간다 */
  mealCheck: MealCheck | null;
  /** 야간 순찰 진행 상태 (점검한 장소) */
  patrol: { done: SpotId[] } | null;
  /** 메인 스토리: 찾은 단서 id */
  clues: string[];
  /** 메인 스토리: 모은 별 조각 번호 (1~7) */
  stars: number[];
  /** 🌟 인간의 기억 (0이 되면 배드 엔딩) */
  memory: number;
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

/** 식사 집합 시간(분): 식사 시작 후 이 시간 안에 선임들께 다 여쭤봐야 함께 간다 (시간 속도에 맞춰 늘어난다) */
export const mealGatherMin = () => mealGatherMinutes();
/** 맞후임이 여쭤보거나 알아서 모일 때: 식사 시작 후 막사 앞에서 출발하기까지(분) */
export const MEAL_ASSEMBLE_MIN = 6;
const fmtClock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

export interface MealCheck {
  meal: 'lunch' | 'dinner';
  /** 식사 시작 시각 */
  start: number;
  /** 여쭤봐야 할 선임 (주요 NPC id 또는 엑스트라 'x:<id>') */
  targets: string[];
  asked: string[];
  /** asking: 여쭤보는 중(여쭌 선임은 막사 앞에서 대기) / together: 다 모여 함께 식당으로 / missed: 다 못 여쭸지만 생활관끼리 모여 감 */
  status: 'asking' | 'together' | 'missed';
  /** 누가 여쭤보나: me(이병·일병이고 맞후임이 없을 때 — 내 의무) / junior(맞후임이 여쭤봄) / auto(알아서 모임) */
  by?: 'me' | 'junior' | 'auto';
  /** 1생활관이 막사 앞에서 식당으로 출발하는 시각 (null = 아직 모이는 중) */
  marchAt?: number | null;
}

/**
 * 야간 근무 (불침번 · 위병소): 소등 후 잠들었다가 근무 시간에 깨어나 근무하고, 교대 후 다시 잔다.
 * - watch(불침번): 이전 근무자가 깨움 → 인수인계 → 근무(미니게임) → 끝나기 10분 전 다음 근무자를 깨워 교대 → 취침
 * - guard(위병소): 사수(또는 부사수)가 조용히 깨움 → 같이 위병소로 → 이전 근무자와 교대 → 근무(미니게임) → 같이 복귀 → 취침
 */
export interface NightDuty {
  kind: 'watch' | 'guard';
  phase: 'sleep' | 'woken' | 'toPost' | 'shift' | 'wakeNext' | 'return';
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
  minigame: MinigameRequest | null;
  rollcall: RollcallState | null;
  /** 지각해서 혼나는 중 (월드가 꾸중 대화를 띄운다) */
  lateCall: { eventId: string; who: NpcId; label: string } | null;
  toasts: Toast[];
  busy: boolean;

  go: (s: Scene) => void;
  newGame: (name: string) => void;
  chooseBranch: (b: BranchId) => void;
  finishQuiz: (scores: Record<Archetype, number>) => void;
  startDay: () => void;
  nextDay: () => void;
  setBusy: (b: boolean) => void;
  tick: (mins: number) => void;
  schedule: () => ScheduleEvent[];
  currentEvent: () => ScheduleEvent | null;
  beginEvent: (late?: boolean) => void;
  /** 집합 시간 초과: 장소로 이동 + 페널티, 꾸중 대화 대기 */
  handleLate: () => void;
  /** 꾸중 대화가 끝나면 호출 → 일정 시작 */
  resolveLate: () => void;
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
  startMinigame: (req: MinigameRequest) => void;
  finishMinigame: (score: number, summary: string) => void;
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
  askMeal: (key: string) => boolean;
  /** 야간 순찰: 장소 점검 */
  patrolCheck: (spot: SpotId) => void;
  /** 야간 순찰 종료 (보고 완료 / 시간 초과) */
  finishPatrol: (reported: boolean) => void;
  /** 메인 스토리: 단서 발견 (처음일 때만 true) */
  findClue: (id: string) => boolean;
  /** 메인 스토리: 별 조각 획득 */
  gainStar: (n: number) => void;
  /** 오늘 밤 꿈(별의 언덕)을 다 봤다 */
  finishDream: () => void;
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
  dayLog: [],
  dayStart: { stats: { hp: 80, mental: 70, discipline: 50, skill: 10, money: 30000 }, affinity: zeroAff() },
  grades: [],
  lateCount: 0,
  askedQ: [],
  farewellDone: [],
  giftCount: {},
});

export function gradeOf(score: number): 'S' | 'A' | 'B' | 'C' | 'F' {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  if (score >= 35) return 'C';
  return 'F';
}

/** 일과별 기본 피로도 (체력/멘탈 소모) */
const WORKLOAD: Record<GameId, { hp: number; mental: number }> = {
  env: { hp: -12, mental: -5 },
  sandbag: { hp: -12, mental: -5 },
  combat: { hp: -8, mental: -5 },
  specialty: { hp: -6, mental: -5 },
  guard: { hp: -6, mental: -5 },
  night: { hp: -10, mental: -6 },
  overlock: { hp: 0, mental: 0 },
};

export function gradeEffects(game: GameId, score: number): Effects {
  const g = gradeOf(score);
  const base: Record<string, Effects> = {
    S: { skill: 6, discipline: 3, mental: 2 },
    A: { skill: 4, discipline: 2, mental: 0 },
    B: { skill: 2, discipline: 0, mental: -1 },
    C: { skill: 1, discipline: -2, mental: -3 },
    F: { skill: 0, discipline: -5, mental: -6 },
  };
  const e: Effects = { ...base[g] };
  if (game === 'overlock') return { discipline: e.discipline, mental: (e.mental ?? 0) + 4 };
  e.hp = WORKLOAD[game].hp;
  e.mental = (e.mental ?? 0) + WORKLOAD[game].mental;
  return e;
}

/** 지침 상태: 체력/멘탈이 낮으면 훈련 점수에 페널티 */
export function fatigueOf(stats: Stats): { mul: number; reasons: string[] } {
  let mul = 1;
  const reasons: string[] = [];
  if (stats.hp < 25) { mul *= 0.85; reasons.push('체력 부족 -15%'); }
  if (stats.mental < 25) { mul *= 0.9; reasons.push('멘탈 저하 -10%'); }
  return { mul, reasons };
}

export function fmtDelta(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : ''}${Number.isInteger(r) ? r : r.toFixed(1)}`;
}

const STAT_LABEL: Record<keyof Stats, string> = {
  hp: '체력', mental: '멘탈', discipline: '군기', skill: '숙련도', money: '돈',
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
let toastId = 1;

export const useGame = create<Store>((set, get) => ({
  ...initialPersist(),
  scene: 'title',
  minigame: null,
  nightDuty: null,
  rollcall: null,
  lateCall: null,
  toasts: [],
  busy: false,

  go: (s) => set({ scene: s }),

  newGame: (name) => {
    set({ ...initialPersist(), name: name.trim() || '김몬스', scene: 'home', minigame: null, rollcall: null, lateCall: null, toasts: [], busy: false });
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
        logs.push(`🫠 하루가 지나며 긴장이 조금 풀렸다. (군기 -${slack})`);
      }
    }
    if (day % 2 === 0) {
      st.money += MONTHLY_PAY[rank];
      logs.push(`💰 월급 ${fmtMoney(MONTHLY_PAY[rank])}이 입금됐다.`);
    }
    const promoted = day > 1 && rank > prevRank;
    if (promoted) logs.push(`🎖️ ${RANKS[rank]}으로 진급했다!`);
    if (day === 7) logs.push('🪖 생활관 분대장 임무를 맡게 됐다.');
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
      memory,
      dayLog: logs,
      stats: st,
      dayStart: { stats: { ...st }, affinity: { ...s.affinity } },
      scene: promoted ? 'promotion' : 'world',
      minigame: null,
      rollcall: null,
      lateCall: null,
      busy: false,
    });
    for (const l of logs) get().toast(l, 'info');
    if (day === TOTAL_DAYS) get().toast(`🎊 전역일 아침이다! ${b.name} 생활 마지막 날.`, 'good');
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
    if (s.busy || s.scene !== 'world' || s.lateCall) return;
    // 1일차: 늦잠 장면이 끝나기 전에는 시간이 흐르지 않는다
    if (s.day === 1 && !s.flags.wokeUp) return;
    const minute = s.minute + mins;
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
      ann('lunch', 12 * 60, '🍚 점심시간! 식당에서 밥을 먹자 (13:00까지)');
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
      // 식사 집합 미션: 밥 먹으러 가기 전에 선임들께 "식사하러 가시겠습니까?" 여쭤보고 다 같이 간다
      const assignMeal = (key: string, at: number, meal: MealCheck['meal']) => {
        if (minute < at || get().announced.includes(key)) return;
        set({ announced: [...get().announced, key] });
        // 1분대 선임: 주요 NPC(분대장·맞선임) + 1분대 상병(엑스트라)
        const seniors: string[] = [
          ...SOLDIER_IDS.filter((id) => npcPresent(id, s.day) && NPC_ROLES[id].offset > 0),
          ...extrasForDay(s.branch, s.day).filter((d) => d.squad1Senior).map((d) => `x:${d.id}`),
        ];
        // 식사도 작전이다: 이병·일병이고 맞후임이 없으면 내가 여쭤본다. 맞후임이 생기면 맞후임 몫
        const myDuty = rankIdxForDay(s.day) <= 1 && !npcPresent('junior', s.day);
        if (!myDuty || !seniors.length) {
          const by = npcPresent('junior', s.day) ? 'junior' : 'auto';
          set({ mealCheck: { meal, start: at, targets: seniors, asked: [...seniors], status: 'together', by, marchAt: at + MEAL_ASSEMBLE_MIN } });
          get().toast(by === 'junior'
            ? `🍚 맞후임 ${memberName(s.branch, 'junior')}이(가) 선임들께 식사 여부를 여쭤봤다. 1생활관은 막사 앞에 모여 ${fmtClock(at + MEAL_ASSEMBLE_MIN)}에 식당으로!`
            : `🍚 식사 시간. 1생활관은 막사 앞에 모여 ${fmtClock(at + MEAL_ASSEMBLE_MIN)}에 다 같이 식당으로 간다.`, 'info');
          return;
        }
        set({ mealCheck: { meal, start: at, targets: seniors, asked: [], status: 'asking', by: 'me', marchAt: null } });
        const names = seniors.map((id) => memberName(s.branch, id)).join('·');
        get().toast(`📋 미션: 식사 집합 — ${mealGatherMin()}분 안에 ${names}께 "식사하러 가시겠습니까?" 여쭤보자`, 'info');
      };
      // 집합 시간이 지나도록 다 못 여쭸으면: 기다리던 선임들은 먼저 식당으로
      const missGather = (key: string, at: number, meal: MealCheck['meal']) => {
        if (minute < at || get().announced.includes(key)) return;
        set({ announced: [...get().announced, key] });
        const mc = get().mealCheck;
        if (!mc || mc.meal !== meal || mc.status !== 'asking') return;
        // 다 못 여쭤봐도 같은 생활관 사람끼리는 막사 앞에 모여 다 같이 간다 (눈치는 좀 보인다)
        set({ mealCheck: { ...mc, status: 'missed', marchAt: minute + 3 } });
        const left = mc.targets.filter((id) => !mc.asked.includes(id));
        const aff: Partial<Record<NpcId, number>> = {};
        for (const id of left) if (!isExtraKey(id)) aff[id as NpcId] = -1;
        get().applyEffects({ affinity: aff, mental: -1 }, '식사 집합 못 챙김');
        get().toast(`🍚 ${left.map((id) => memberName(s.branch, id)).join('·')}께 여쭤보지 못했다… 1생활관 인원이 알아서 막사 앞에 모였다. 같이 식당으로!`, 'bad');
        get().log('🍚 식사 집합을 제때 챙기지 못했다.');
      };
      const endMeal = (key: string, at: number, meal: MealCheck['meal']) => {
        if (minute < at || get().announced.includes(key)) return;
        set({ announced: [...get().announced, key] });
        if (get().mealCheck?.meal === meal) set({ mealCheck: null });
      };
      assignMeal('mealCheckLunch', 12 * 60, 'lunch');
      assignMeal('mealCheckDinner', 17 * 60 + 30, 'dinner');
      missGather('mealGatherLunch', 12 * 60 + mealGatherMin(), 'lunch');
      missGather('mealGatherDinner', 17 * 60 + 30 + mealGatherMin(), 'dinner');
      // 막사 앞 집합 → 출발
      const mcm = get().mealCheck;
      if (mcm?.marchAt != null && minute >= mcm.marchAt) ann(`mealMarch_${mcm.meal}`, mcm.marchAt, '🚶 1생활관 출발! 다 같이 식당으로 이동한다.');
      endMeal('mealCheckLunchEnd', 13 * 60, 'lunch');
      endMeal('mealCheckDinnerEnd', 18 * 60 + 30, 'dinner');
    }
    if (ev && ev.kind === 'patrol' && s.eventBegun && get().patrol && minute >= ev.end) { get().finishPatrol(false); return; }
    if (!ev || s.eventBegun) return;
    if (ev.auto) {
      if (minute >= ev.start) get().beginEvent();
      return;
    }
    if (ev.kind === 'farewell') {
      ann('farewell', ev.start, '🎊 전역 신고 완료! 모두에게 인사하고 위병소 정문으로 가자.', 'good');
      if (minute >= ev.end) get().beginEvent();
      return;
    }
    ann(`call_${ev.id}`, ev.start, `📢 집합! ${ev.label} — ${ev.spot ? buildMapSpotLabel(get().branch, ev.spot) : ''}`, 'alert');
    // 집합 시각(마감)이 되는 순간 해당 구역에 있으면 정시에 시작, 없으면 지각
    const deadline = ev.start + ev.window;
    if (minute >= deadline && ev.spot) {
      const w = getWorld(s.branch, BRANCHES[s.branch].trainArea);
      if (inEventArea(w, ev.spot, runtime.player)) {
        get().toast(`✅ 집합 완료! ${ev.label} 시작`, 'good');
        get().beginEvent();
        return;
      }
    }
    if (minute > deadline) get().handleLate();
  },

  handleLate: () => {
    const s = get();
    const ev = s.currentEvent();
    if (!ev || s.eventBegun || s.lateCall) return;
    const leader = currentSquadLeader(s.day);
    const who: NpcId = leader === 'me' ? 'lt' : leader;
    // 집합 장소로 끌려가서 혼난다 → 월드에서 꾸중 대화 후 일정 시작(resolveLate)
    if (ev.spot) {
      const sp = getWorld(s.branch, BRANCHES[s.branch].trainArea).spots[ev.spot];
      teleport(sp.map, sp.x + 0.5, sp.y + 1.5, 'up');
    }
    get().applyEffects({ discipline: -8, mental: -3, affinity: { [who]: -5 } }, '지각');
    get().log(`⏰ ${ev.label}에 늦어서 ${NPC_SKINS[s.branch][who].name}에게 혼났다.`);
    set({ lateCount: s.lateCount + 1, lateCall: { eventId: ev.id, who, label: ev.label } });
  },

  resolveLate: () => {
    set({ lateCall: null });
    get().beginEvent(true);
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
        get().startMinigame({
          game: ev.game!,
          title: BRANCHES[s.branch].games[ev.game as Exclude<GameId, 'overlock'>],
          eventId: ev.id,
          returnTo: 'world',
        });
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
          const prev = pick('x:r2c', 'x:r2b', 'x:room2a', 'buddy');
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
        get().toast('🔦 야간 순찰 시작! 막사 1·2층 복도·세탁실·화장실을 점검하고 지휘통제실 당직사관에게 보고하자 (23:00까지)', 'alert');
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
    const minute = Math.max(s.minute, ev.end);
    set({ minute, eventIdx: s.eventIdx + 1, eventBegun: false, rollcall: null, busy: false });
    if (ev.kind === 'rollcall_am' && s.day < TOTAL_DAYS) get().toast('🍳 아침 식사와 청소를 마쳤다. 08:30 오전 일과 집합!', 'info');
    if (ev.kind === 'rollcall_am' && s.day >= TOTAL_DAYS) {
      // 전역일: 점호 후 바로 전역 이벤트 진행
    }
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
      parts.push(`${STAT_LABEL[k]} ${k === 'money' ? `${v > 0 ? '+' : ''}${v.toLocaleString()}` : fmtDelta(v)}`);
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
    const flags = e.flag ? { ...s.flags, [e.flag]: true } : s.flags;
    let quests = s.quests;
    if (e.quest && !s.quests.some((q) => q.id === e.quest) && !s.doneQuests.includes(e.quest)) {
      quests = [...s.quests, { id: e.quest, step: 0 }];
      get().toast(`📋 새 퀘스트: ${QUESTS[e.quest].title}`, 'info');
    }
    const inventory = { ...s.inventory };
    if (e.item) inventory[e.item] = (inventory[e.item] ?? 0) + 1;
    set({ stats, affinity, flags, quests, inventory, memory });

    // 쓰러짐 / 멘붕 처리
    if (stats.hp <= 0) {
      set({ stats: { ...get().stats, hp: 40, mental: clamp(get().stats.mental - 10) } });
      get().toast('🏥 체력이 바닥나 의무대에 다녀왔다. (체력 40으로 회복, 멘탈 -10)', 'bad');
      get().log('🏥 탈진해서 의무대 신세를 졌다.');
    }
    if (get().stats.mental <= 0) {
      set({ stats: { ...get().stats, mental: 35, discipline: clamp(get().stats.discipline - 5) } });
      get().toast('🫂 병영생활전문상담관과 면담했다. 마음이 조금 편해졌다. (멘탈 35)', 'info');
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
    set({ toasts: [...get().toasts.slice(-4), { id, text, tone }] });
    setTimeout(() => get().dismissToast(id), tone === 'alert' ? 5000 : 3800);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  log: (text) => set({ dayLog: [...get().dayLog, text] }),

  spend: (mins) => {
    const s = get();
    set({ minute: s.minute + mins });
    // 집합 시간 체크는 다음 tick에서 처리
  },

  startMinigame: (req) => set({ minigame: req, scene: 'minigame', busy: false }),

  finishMinigame: (score, summary) => {
    const s = get();
    const req = s.minigame;
    if (!req) return;
    const eff = gradeEffects(req.game, score);
    // 감독 간부/선임 호감
    const g = gradeOf(score);
    const leader = currentSquadLeader(s.day);
    const sup: NpcId = req.game === 'overlock' ? 'sgm' : req.game === 'night' || req.game === 'guard' ? 'lt' : leader === 'me' ? 'sgm' : leader;
    if (g === 'S' || g === 'A') eff.affinity = { [sup]: 4 };
    if (g === 'F') eff.affinity = { [sup]: -4 };
    get().applyEffects(eff, req.title, true);
    set({ grades: [...s.grades, { day: s.day, game: req.game, score }], minigame: null });
    get().log(`🎯 ${req.title}: ${g}등급 (${Math.round(score)}점) — ${summary}`);
    const nd = get().nightDuty;
    if (nd && nd.phase === 'shift' && (req.game === 'night' || req.game === 'guard')) {
      // 근무 끝: 불침번은 끝나기 10분 전 → 다음 근무자 깨우러 / 위병소는 다음 근무자와 교대 → 복귀
      set({ nightDuty: { ...nd, phase: nd.kind === 'watch' ? 'wakeNext' : 'return' }, minute: nd.kind === 'watch' ? nd.shiftEnd - 10 : nd.shiftEnd, scene: 'world' });
      return;
    }
    if (req.eventId) {
      get().completeEvent();
      if (req.returnTo === 'dayEnd' && get().scene !== 'dayEnd') set({ scene: 'dayEnd' });
    } else {
      set({ scene: req.returnTo });
      get().save();
    }
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

  findClue: (id) => {
    const s = get();
    const def = clueDef(id);
    if (!def || s.clues.includes(id)) return false;
    const clues = [...s.clues, id];
    set({ clues });
    get().applyEffects({ memory: MEMORY_PER_CLUE }, `🔍 단서: ${def.title}`);
    get().log(`🔍 단서 「${def.title}」를 기억의 실마리에 적었다.`);
    // 장(章) 완료
    const ch = CHAPTERS.find((c) => c.n === def.chapter);
    if (ch && chapterDone(ch.n, clues) && !s.flags[`story_ch${ch.n}`]) {
      get().applyEffects({ flag: `story_ch${ch.n}` }, undefined, true);
      get().toast(`📖 ${ch.n}장 「${ch.title}」 완료! 실마리 ${clues.length}/${CLUES.length}`, 'good');
      get().log(`📖 ${ch.n}장 「${ch.title}」의 단서를 모두 모았다.`);
    }
    return true;
  },

  gainStar: (n) => {
    const s = get();
    if (s.stars.includes(n)) return;
    set({ stars: [...s.stars, n].sort((a, b) => a - b) });
    get().toast(`✨ 별 조각을 얻었다! (${s.stars.length + 1}/7)`, 'good');
    get().log(`✨ 별 조각 ${n}번째를 손에 넣었다.`);
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

  askMeal: (npc) => {
    const mc = get().mealCheck;
    if (!mc || mc.status !== 'asking' || !mc.targets.includes(npc) || mc.asked.includes(npc)) return false;
    const asked = [...mc.asked, npc];
    get().applyEffects(isExtraKey(npc) ? { mental: 1 } : { affinity: { [npc]: 2 } }, '식사 집합', true);
    if (asked.length >= mc.targets.length) {
      set({ mealCheck: { ...mc, asked, status: 'together', marchAt: get().minute + 2 } });
      get().applyEffects({ discipline: 2, mental: 1 }, '식사 집합 완료');
      get().toast('✅ 식사 집합 완료! 선임들과 다 같이 식당으로 간다 (군기 +2 · 멘탈 +1 · 선임 호감 +2씩)', 'good');
      get().log('🍚 선임들께 빠짐없이 여쭤보고 다 같이 식사하러 갔다.');
    } else {
      set({ mealCheck: { ...mc, asked } });
      get().toast(`🍚 식사 집합 ${asked.length}/${mc.targets.length} — 여쭌 선임은 막사 앞에서 기다린다`, 'info');
    }
    return true;
  },

  save: () => {
    try {
      const s = get();
      const data: Persist = {
        name: s.name, branch: s.branch, archetype: s.archetype, speciesId: s.speciesId, day: s.day, minute: s.minute,
        stats: s.stats, affinity: s.affinity, talked: s.talked, gifted: s.gifted, seen: s.seen, quests: s.quests,
        doneQuests: s.doneQuests, inventory: s.inventory, flags: s.flags, tips: s.tips, eventIdx: s.eventIdx,
        eventBegun: false, announced: s.announced, daily: s.daily, dayLog: s.dayLog, dayStart: s.dayStart,
        grades: s.grades, lateCount: s.lateCount, askedQ: s.askedQ, farewellDone: s.farewellDone,
        giftCount: s.giftCount, mealCheck: s.mealCheck, patrol: null,
        clues: s.clues, stars: s.stars, memory: s.memory,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* 저장 불가 환경 */ }
  },

  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as Persist;
      set({ ...initialPersist(), ...data, scene: 'world', minigame: null, nightDuty: null, rollcall: null, lateCall: null, toasts: [], busy: false });
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
    set({ ...initialPersist(), scene: 'title', minigame: null, rollcall: null, lateCall: null, toasts: [], busy: false });
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
  };
  return labels[spot];
}

export function spotLabel(branch: BranchId, spot: SpotId) {
  return buildMapSpotLabel(branch, spot);
}

/** 자유 시간(점심·저녁 개인정비)에 퀘스트·식사 집합이 진행 중이면 시간이 절반 속도로 흐른다 */
export function questSlowActive(s: { quests: ActiveQuest[]; mealCheck: MealCheck | null; minute: number; patrol: { done: SpotId[] } | null }): boolean {
  if (s.patrol) return true;
  const busy = s.quests.length > 0 || s.mealCheck?.status === 'asking';
  return busy && (isMealTime(s.minute) || isFreeTimeEvening(s.minute));
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
  for (const d of DIALOGUES) {
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
/** 대화 id로 대화 찾기 */
export function dialogueById(id: string) {
  return DIALOGUES.find((d) => d.id === id) ?? null;
}
export { QUEST_CHAINS };

export function presentNpcs(day: number): NpcId[] {
  return NPC_IDS.filter((id) => npcPresent(id, day));
}
