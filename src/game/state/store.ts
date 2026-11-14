'use client';
import { create } from 'zustand';
import type {
  ActiveQuest, Archetype, BranchId, Dialogue, DialogueCtx, Effects, GameId, MinigameRequest,
  NpcId, Scene, ScheduleEvent, SpotId, Stats,
} from '../types';
import { BRANCHES, MONTHLY_PAY, RANKS, TOTAL_DAYS, fmtMoney, rankIdxForDay, seasonForDay } from '../data/branches';
import { pickSpecies, topArchetype } from '../data/monsters';
import { NPC_IDS, NPC_SKINS, SOLDIER_IDS, currentSquadLeader, npcPresent, arriveDay, leaveDay } from '../data/npcs';
import { buildSchedule } from '../data/schedule';
import { DIALOGUES } from '../data/dialogues';
import { QUESTS } from '../data/quests';
import { ITEMS, GIFT_AFFINITY } from '../data/items';
import { rollcallPool, type RollcallQuestion } from '../data/rollcall';
import { fmt } from '../engine/text';
import { teleport } from '../engine/runtime';
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
}

export interface RollcallState {
  kind: 'rollcall_am' | 'rollcall_pm';
  q: RollcallQuestion;
  late: boolean;
}

interface Store extends Persist {
  scene: Scene;
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
    }
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
    if (minute > ev.start + ev.window) get().handleLate();
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
      case 'night':
        get().startMinigame({
          game: ev.game!,
          title: BRANCHES[s.branch].games[ev.game as Exclude<GameId, 'overlock'>],
          eventId: ev.id,
          returnTo: ev.kind === 'night' ? 'dayEnd' : 'world',
        });
        break;
      case 'farewell':
        set({ scene: 'ending' });
        break;
    }
  },

  completeEvent: () => {
    const s = get();
    const ev = s.currentEvent();
    if (!ev) return;
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
    const flags = e.flag ? { ...s.flags, [e.flag]: true } : s.flags;
    let quests = s.quests;
    if (e.quest && !s.quests.some((q) => q.id === e.quest) && !s.doneQuests.includes(e.quest)) {
      quests = [...s.quests, { id: e.quest, step: 0 }];
      get().toast(`📋 새 퀘스트: ${QUESTS[e.quest].title}`, 'info');
    }
    const inventory = { ...s.inventory };
    if (e.item) inventory[e.item] = (inventory[e.item] ?? 0) + 1;
    set({ stats, affinity, flags, quests, inventory });

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
      set({ quests: s.quests.filter((x) => x.id !== id), doneQuests: [...s.doneQuests, id] });
      get().applyEffects(def.reward, `퀘스트 완료: ${def.title}`);
      get().log(`📋 퀘스트 "${def.title}" 완료`);
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
    const bonus = item === 'chocopie' ? 2 : 0;
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

  save: () => {
    try {
      const s = get();
      const data: Persist = {
        name: s.name, branch: s.branch, archetype: s.archetype, speciesId: s.speciesId, day: s.day, minute: s.minute,
        stats: s.stats, affinity: s.affinity, talked: s.talked, gifted: s.gifted, seen: s.seen, quests: s.quests,
        doneQuests: s.doneQuests, inventory: s.inventory, flags: s.flags, tips: s.tips, eventIdx: s.eventIdx,
        eventBegun: false, announced: s.announced, daily: s.daily, dayLog: s.dayLog, dayStart: s.dayStart,
        grades: s.grades, lateCount: s.lateCount, askedQ: s.askedQ, farewellDone: s.farewellDone,
        giftCount: s.giftCount,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* 저장 불가 환경 */ }
  },

  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as Persist;
      set({ ...initialPersist(), ...data, scene: 'world', minigame: null, rollcall: null, lateCall: null, toasts: [], busy: false });
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
    bed: '1생활관 내 침상', barracks: '막사 1층 1생활관', mess: '식당', px: 'PX', admin: '막사 1층 행정반',
    command: '막사 1층 지휘통제실', tv: '막사 2층 휴게실', cyber: '싸지방',
    gym: '체력단련장', parade: '연병장', train: BRANCHES[branch].trainArea, post: '위병소 초소', gate: '위병소 정문',
  };
  return labels[spot];
}

export function spotLabel(branch: BranchId, spot: SpotId) {
  return buildMapSpotLabel(branch, spot);
}

export function presentNpcs(day: number): NpcId[] {
  return NPC_IDS.filter((id) => npcPresent(id, day));
}
