'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Choice, Dialogue, LineWho, MonsterLook, NpcId, SpotId } from '../types';
import { extraLook, extrasForDay } from '../data/extras';
import { useGame, presentNpcs, questSlowActive, questOffers, dialogueById, PATROL_SPOTS } from '../state/store';
import { BRANCHES, FACILITY_NAME, STORE_NAME, TOTAL_DAYS, fmtTime, rankIdxForDay, seasonForDay } from '../data/branches';
import { findSpecies } from '../data/monsters';
import { NPC_ROLES, NPC_SKINS, SOLDIER_IDS, birthdayNpcs, currentSquadLeader, npcDisplayName, npcRoleTitle } from '../data/npcs';
import { FAREWELL_LINES, SMALL_TALK } from '../data/dialogues';
import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import { isFreeTimeEvening, isMealTime } from '../data/schedule';
import { MS_PER_MINUTE, clampMapZoom, useSettings } from '../state/settings';
import {
  MAP_NAMES, TILE, collides, doorCenter, doorToward, findPath, getWorld, isSolid, renderMapCanvas,
  type Door, type MapId, type WorldDef,
} from '../engine/map';
import { drawMonster, type CapType, type Dir } from '../engine/drawMonster';
import { runtime } from '../engine/runtime';
import { npcCap, type SpeakerInfo } from '../engine/speakers';
import type { CerActor, CeremonyCtl, CeremonyInfo, CeremonyRt } from '../engine/ceremony';
import { fmt } from '../engine/text';
import { memberName } from '../engine/whereabouts';
import Hud from './Hud';
import DialogueBox, { type DialogueScript } from './DialogueBox';
import Menu, { type MenuOption } from './Menu';
import Notebook from './Notebook';
import RollcallCeremony from './RollcallCeremony';
import { NIGHT_STAR_LINES, STORY_MISSIONS, missionState } from '../data/story';
import { QuestLog, QuestTracker } from './QuestPanel';
import MapView from './MapView';
import TouchPad from './TouchPad';

interface NpcRt {
  map: MapId;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  path: [number, number][];
  targetKey: string;
  /** 경로 끝에 도착하면 통과할 문 (다른 건물로 이동 중) */
  viaDoor: Door | null;
}

/** 맵 + 타일 좌표 */
type Pos = [MapId, number, number];

/** 부대 엑스트라 런타임 상태 */
interface ExtraRt extends NpcRt {
  wait: number;
  routeIdx: number;
}


type Overlay =
  | { type: 'dialogue'; script: DialogueScript; onChoice?: (c: Choice) => void; onDone?: () => void }
  | { type: 'menu'; title: string; subtitle?: string; options: MenuOption[] }
  | { type: 'notebook' }
  | { type: 'quests' }
  | { type: 'map' }
  | null;

interface Interactable {
  key: string;
  label: string;
  kind: 'event' | 'npc' | 'spot' | 'extra' | 'seat' | 'duty';
  extra?: string;
  npc?: NpcId;
  spot?: SpotId;
}

/** 자유 시간에 머무는 곳 */
const FREE_POS: Record<NpcId, Pos> = {
  sgt: ['room1', 10, 5], senior: ['lounge', 3, 3], buddy: ['cyber', 2, 2], junior: ['room1', 12, 5], junior2: ['outdoor', 34, 24],
  // 소대장은 지휘통제실 당직사관, 중대장은 행정반, 행보관은 부대를 돌아다닌다
  lt: ['command', 5, 2], sgm: ['outdoor', 16, 21], cpt: ['admin', 5, 2],
};
/**
 * 식사 시간 식당 자리 (식당 13x13: 식탁은 y=4·7·10 줄 / x=2~4, 8~10)
 * 모두 식탁 바로 위 줄(y=3·6·9)에 앉아 아래(식탁)를 보고 먹는다 → 식판이 몸에 가리지 않는다
 */
const MEAL_POS: Partial<Record<NpcId, Pos>> = {
  // 1분대: 첫 줄 (계급순: 분대장 · 1분대 상병 · 맞선임 · 나(4) | 통로 | 동기 · 후임들)
  sgt: ['mess', 1, 3], senior: ['mess', 3, 3], buddy: ['mess', 8, 3], junior: ['mess', 9, 3], junior2: ['mess', 10, 3],
  // 간부: 둘째 줄 왼쪽
  lt: ['mess', 2, 6], cpt: ['mess', 3, 6], sgm: ['mess', 4, 6],
};
/** 엑스트라 식사 자리 (취사병·PX병·위병·군견은 자리를 지킨다) */
const EXTRA_MEAL_SEAT: Record<string, [number, number]> = {
  runner: [11, 3],
  medic: [8, 6], nco: [9, 6], clerk: [10, 6],
  gym: [2, 9], cyber: [3, 9], room2a: [4, 9], lounge: [8, 9],
  // 1분대 선임 · 2생활관 사람들 (식탁을 넓힌 자리)
  sq1: [2, 3], r2b: [9, 9], r2c: [10, 9], r2d: [11, 9],
};
/** 내 식사 자리: 1분대 줄, 맞선임 옆 */
const MY_MEAL_SEAT: [number, number] = [4, 3];
/** 1분대(1생활관) 식사 행군 순서 = 계급순. 맨 앞(있는 사람 중)이 식사를 이끈다 */
const SQUAD_KEYS = ['sgt', 'x:sq1', 'senior', 'buddy', 'junior', 'junior2'];
/** 막사 현관 앞 식사 집합 자리 */
const MEAL_GATHER: Record<string, Pos> = {
  sgt: ['outdoor', 10, 14], 'x:sq1': ['outdoor', 11, 14], senior: ['outdoor', 12, 14],
  buddy: ['outdoor', 13, 14], junior: ['outdoor', 14, 14], junior2: ['outdoor', 15, 14],
};
const GATHER_KEYS = new Set(Object.values(MEAL_GATHER).map((g) => `${g[0]}:${g[1]},${g[2]}`));
/** 분대 선두(분대장)가 앉아서 다 먹기까지(분) — 선임은 빨리 먹는다 / 내가 그냥 먹으면 걸리는 시간 */
const SQUAD_EAT_MIN = 9;
const MY_EAT_MIN = 13;
const mealOf = (m: number): 'lunch' | 'dinner' => (m < 15 * 60 ? 'lunch' : 'dinner');
const mealStartOf = (m: number) => (m < 15 * 60 ? 12 * 60 : 17 * 60 + 30);
const hashStr = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
/** 이번 끼니에 각자 자리에 앉은 시각 (자리에 도착한 순간 기록) */
const mealRt: { key: string; seated: Record<string, number> } = { key: '', seated: {} };
function mealSeated(day: number, minute: number) {
  const k = `${day}-${mealOf(minute)}`;
  if (mealRt.key !== k) { mealRt.key = k; mealRt.seated = {}; }
  return mealRt.seated;
}
/** 오늘 1분대(1생활관) 사람들, 계급순 */
function squadKeys(branch: Parameters<typeof extrasForDay>[0], day: number): string[] {
  const ps = presentNpcs(day);
  const xs = new Set(extrasForDay(branch, day).map((d) => `x:${d.id}`));
  return SQUAD_KEYS.filter((k) => (k.startsWith('x:') ? xs.has(k) : ps.includes(k as NpcId)));
}
/** 내 식사 상태 (식판 들고 있음 / 앉아서 먹는 중) */
const myMeal: {
  tray: '' | 'lunch' | 'dinner';
  eating: null | { meal: 'lunch' | 'dinner'; prog: number; last: number; start: number; pace: null | { finish: number; lead: string }; bite: number };
} = { tray: '', eating: null };
/** 식판 (left: 남은 양 0~1) */
function drawTray(g: CanvasRenderingContext2D, tx: number, ty: number, left: number) {
  g.fillStyle = '#9aa0a8'; g.fillRect(tx, ty, 20, 13);
  g.fillStyle = '#c8ccd4'; g.fillRect(tx + 1, ty + 1, 18, 11);
  if (left <= 0.02) return;
  const k = Math.max(0.2, left);
  g.fillStyle = '#ffffff'; g.fillRect(tx + 2, ty + 2, Math.ceil(7 * k), 5);   // 밥
  g.fillStyle = '#d0402a'; g.fillRect(tx + 11, ty + 2, Math.ceil(6 * k), 4);  // 김치
  g.fillStyle = '#a0682a'; g.fillRect(tx + 2, ty + 8, Math.ceil(7 * k), 3);   // 반찬
  g.fillStyle = '#e8b048'; g.fillRect(tx + 11, ty + 7, Math.ceil(6 * k), 4);  // 국
}
/**
 * 식사 시간에 이 사람이 있어야 할 곳 ('free' = 평소 자리).
 * - 1분대: (여쭤보는 중이면) 여쭌 사람은 막사 앞 대기 → 출발 시각에 계급순으로 줄지어 식당 → 분대장이 다 먹으면 차례로 일어남
 * - 다른 사람(간부·다른 부대): 저마다 다른 시각에 와서, 저마다 다른 시간 동안 먹고 간다
 */
function mealGoal(key: string, seat: Pos, st: ReturnType<typeof useGame.getState>): Pos | 'free' {
  const m = st.minute;
  const seated = mealSeated(st.day, m);
  const squad = squadKeys(st.branch, st.day);
  const si = squad.indexOf(key);
  if (si >= 0) {
    const lead = seated[squad[0]];
    if (lead !== undefined && m >= lead + SQUAD_EAT_MIN + si * 0.7) return 'free';
    const mc = st.mealCheck;
    if (!mc || mc.meal !== mealOf(m)) return lead !== undefined || m > mealStartOf(m) + 30 ? seat : 'free';
    if (mc.status === 'asking') return mc.targets.includes(key) && !mc.asked.includes(key) ? 'free' : MEAL_GATHER[key] ?? seat;
    if (mc.marchAt === null || (mc.marchAt !== undefined && m < mc.marchAt + si * 0.35)) return MEAL_GATHER[key] ?? seat;
    return seat;
  }
  const h = hashStr(`${key}-${st.day}-${mealOf(m)}`);
  const arrive = mealStartOf(m) + 2 + (h % 23);
  const dur = 9 + ((h >>> 8) % 8);
  if (m < arrive) return 'free';
  const sAt = seated[key];
  if (sAt !== undefined ? m >= sAt + dur : m >= arrive + dur + 14) return 'free';
  return seat;
}
/** 식탁 쪽을 바라보는 방향 (모든 자리는 식탁 위쪽) */
const seatFacing = (_y: number): Dir => 'down';
/** 식사 중인지: 식사 시간이고 자기 자리에 앉아 있음 */
const eatingAt = (map: MapId, x: number, y: number, seat: Pos | [number, number] | undefined, minute: number) => {
  if (!seat || !isMealTime(minute)) return null;
  const [sm, sx, sy] = seat.length === 3 ? seat : (['mess', seat[0], seat[1]] as Pos);
  if (map !== sm || Math.hypot(x - (sx + 0.5), y - (sy + 0.5)) > 0.3) return null;
  return { x: sx, y: sy, face: seatFacing(sy) };
};
/** 취침 전 생활관 자리 */
const NIGHT_POS: Partial<Record<NpcId, Pos>> = {
  // 1분대는 모두 1생활관. 자기 침상(BED_X) 바로 앞 통로
  sgt: ['room1', 1, 4], senior: ['room1', 5, 4], buddy: ['room1', 9, 4], junior: ['room1', 11, 4], junior2: ['room1', 13, 4],
};
/** 소등(저녁 점호 후): 유동병력 없음. 병사는 침상에서 취침, 근무자만 제자리 */
const LIGHTS_OUT = 22 * 60;
/** 1분대 침상 (1생활관 위쪽 줄 x, 내 침상은 3). 저녁 점호 때 이 침상에 앉고, 소등하면 그대로 눕는다 */
const BED_X: Partial<Record<NpcId, number>> = { sgt: 1, senior: 5, buddy: 9, junior: 11, junior2: 13 };
/** 엑스트라 침상: [맵, x, 줄] */
const EXTRA_BED: Record<string, [MapId, number, 'top' | 'bottom']> = {
  sq1: ['room1', 1, 'bottom'],
  room2a: ['room2', 13, 'top'], r2b: ['room2', 1, 'top'], r2c: ['room2', 5, 'top'], r2d: ['room2', 9, 'top'],
};
/** 밤에도 깨어 있는 근무자: 당직병(지휘통제실)·위병(이전 근무자)과 군견. 그 밖의 병력은 없다 */
const NIGHT_STAY = new Set(['guard', 'clerk', 'dog']);
/** 밤 근무 자리 (행정병 → 지휘통제실 당직병) */
const NIGHT_SPOT: Record<string, Pos> = { clerk: ['command', 8, 4] };
/** 야간 근무 중 별빛(지라치)이 떠 있는 곳 */
const STAR_POS: Record<'watch' | 'guard', [MapId, number, number]> = { watch: ['room1', 7.5, 2.4], guard: ['depot', 16.6, 20.5] };
/** 야간 근무: 깨우러 온 사람·사수/부사수·다음 근무자가 있어야 할 곳 (null = 평소 밤 규칙대로) */
function nightGoal(key: string, st: ReturnType<typeof useGame.getState>): Pos | null {
  const nd = st.nightDuty;
  if (!nd) return null;
  const p = runtime.player;
  if (nd.partner && key === nd.partner) {
    if (nd.phase === 'sleep' || nd.phase === 'woken') return ['room1', 4, 4];
    if (nd.phase === 'shift') return ['depot', 14, 26];
    return [p.map, Math.floor(p.x), Math.floor(p.y)]; // 같이 간다 (따라온다)
  }
  if (key === nd.prev) return nd.phase === 'sleep' || nd.phase === 'woken' ? ['room1', 4, 4] : null;
  if (key === nd.next && nd.nextAwake) return ['room1', 7, 5]; // 새 불침번: 출입문 쪽에서 근무
  return null;
}
/** 지금 나를 따라오는 사수·부사수인지 */
const followsMe = (key: string, st: ReturnType<typeof useGame.getState>) => {
  const nd = st.nightDuty;
  return !!nd && nd.partner === key && (nd.phase === 'toPost' || nd.phase === 'return');
};
/** 누운 위치(발 기준 y) / 침상 앞 통로 y */
const bedY = (row: 'top' | 'bottom') => (row === 'top' ? 2.62 : 7.62);
const aisleY = (row: 'top' | 'bottom') => (row === 'top' ? 4 : 6);
/** 그날 밤 당직 간부 (저녁 점호 당직사령과 같다) */
const nightDutyOfficer = (day: number): NpcId => (day % 2 === 1 ? 'lt' : 'sgm');
/** 지금 보이는 주요 NPC: 소등 후엔 당직 간부만 남고 다른 간부는 퇴근 */
function visibleNpcs(day: number, minute: number): NpcId[] {
  const ps = presentNpcs(day);
  if (minute < LIGHTS_OUT) return ps;
  const duty = ps.includes(nightDutyOfficer(day)) ? nightDutyOfficer(day) : 'cpt';
  return ps.filter((id) => !NPC_ROLES[id].officer || id === duty);
}
/** 주요 NPC가 침상에 누워 있는지 */
const npcAsleep = (id: NpcId, n: { map: MapId; y: number }, minute: number) =>
  minute >= LIGHTS_OUT && BED_X[id] !== undefined && n.map === 'room1' && Math.abs(n.y - bedY('top')) < 0.05;
/** 엑스트라: 밤에 안 보임(자기 부대 막사로) / 침상에 누움 */
const extraHiddenAtNight = (id: string, minute: number) => {
  if (minute < LIGHTS_OUT) return false;
  // 위병소 교대 후: 이전 근무자(위병)는 막사로 돌아갔다
  const nd = useGame.getState().nightDuty;
  if (id === 'guard' && nd?.kind === 'guard' && (nd.phase === 'shift' || nd.phase === 'return')) return true;
  return !EXTRA_BED[id] && !NIGHT_STAY.has(id);
};
const extraAsleep = (id: string, e: { map: MapId; y: number }, minute: number) => {
  if (minute < LIGHTS_OUT) return false;
  if (id === 'dog') return true;
  const bed = EXTRA_BED[id];
  return !!bed && e.map === bed[0] && Math.abs(e.y - bedY(bed[2])) < 0.05;
};
/** 침상에 누운 모습: 작은 몸 + 모포 */
function drawSleeper(g: CanvasRenderingContext2D, look: MonsterLook, x: number, y: number, t: number, blanket: boolean) {
  drawMonster(g, look, x * TILE, (y + 0.3) * TILE, 22, { dir: 'down', t, sleeping: true, shadow: false });
  if (!blanket) return;
  g.fillStyle = '#5f8250';
  g.fillRect(x * TILE - 13, (y - 0.17) * TILE, 26, 0.95 * TILE);
  g.fillStyle = '#e8e4d8';
  g.fillRect(x * TILE - 13, (y - 0.17) * TILE, 26, 4);
  g.fillStyle = '#4a6a3e';
  g.fillRect(x * TILE - 13, (y + 0.7) * TILE, 26, 2);
}
/** 1일차 기상 장면: 분대원들이 이미 일어나 생활관에 모여 있다 (분대장은 내 침상 옆) */
const WAKE_POS: Partial<Record<NpcId, Pos>> = {
  sgt: ['room1', 4, 4], buddy: ['room1', 6, 5], senior: ['room1', 8, 4], junior: ['room1', 10, 5], junior2: ['room1', 12, 5],
};
/** 식사 집합 미션: "식사하러 가시겠습니까?"에 대한 선임들의 대답 */
const MEAL_REPLY: Partial<Record<NpcId, string[]>> = {
  sgt: ['그래, 가자. 막사 앞으로 모여. 다른 애들도 다 챙기고.', '벌써 그렇게 됐나? 좋아, 다 모이면 같이 간다.'],
  senior: ['오~ 가자가자. 오늘 메뉴 뭐냐? …제육이면 뛰어간다.', '나 막사 앞에서 기다린다~ 다른 사람들도 빨리 데려와.'],
};
/** 달리기: 기력 소모(초당)·회복 시간, 속도 */
const WALK_SPEED = 6;
const DASH_SPEED = 10.5;
const DASH_DRAIN_SEC = 2.8;
const DASH_REGEN_SEC = 3.5;

const FORMATION: [number, number][] = [[-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2]];

export default function World() {
  const branch = useGame((s) => s.branch);
  const day = useGame((s) => s.day);
  const speciesId = useGame((s) => s.speciesId);
  const rollcall = useGame((s) => s.rollcall);
  const nightPhase = useGame((s) => s.nightDuty?.phase ?? null);
  const nightKind = useGame((s) => s.nightDuty?.kind ?? null);
  const b = BRANCHES[branch];
  const season = seasonForDay(day);
  const world = useMemo<WorldDef>(() => getWorld(branch, b.trainArea), [branch, b.trainArea]);
  const look = findSpecies(speciesId)!.look;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<Partial<Record<MapId, HTMLCanvasElement>>>({});
  const [location, setLocation] = useState<MapId>(runtime.player.map);
  const keys = useRef<Record<string, boolean>>({});
  const npcs = useRef<Partial<Record<NpcId, NpcRt>>>({});
  const extras = useRef<Record<string, ExtraRt>>({});
  const extraDefs = useMemo(() => extrasForDay(branch, day), [branch, day]);
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__npcs = npcs; // 개발용 디버그 핸들
    (window as unknown as Record<string, unknown>).__extras = extras;
    (window as unknown as Record<string, unknown>).__meal = { myMeal, mealRt };
  }
  const [overlay, setOverlayState] = useState<Overlay>(null);
  const overlayRef = useRef<Overlay>(null);
  const [prompt, setPrompt] = useState<Interactable | null>(null);
  const promptRef = useRef<Interactable | null>(null);
  const [fast, setFast] = useState(false);
  const fastRef = useRef(false);

  const setOverlay = useCallback((o: Overlay) => {
    overlayRef.current = o;
    setOverlayState(o);
    useGame.getState().setBusy(o !== null);
  }, []);

  useEffect(() => { fastRef.current = fast; }, [fast]);

  // 정적 맵 렌더 (야외 + 모든 건물 내부)
  useEffect(() => {
    const out: Partial<Record<MapId, HTMLCanvasElement>> = {};
    for (const m of Object.values(world.maps)) out[m.id] = renderMapCanvas(m, season);
    mapCanvasRef.current = out;
  }, [world, season]);

  // 시간 흐름 (게임 1분 = 설정의 시간 흐름 속도, 설정 창이 열려 있으면 정지)
  const timeSpeed = useSettings((s) => s.timeSpeed);
  const slowFlip = useRef(false);
  useEffect(() => {
    const iv = setInterval(() => {
      const st = useGame.getState();
      if (st.rollcall || useSettings.getState().open || overlayRef.current) return;
      // 🐢 자유 시간에 퀘스트가 진행 중이면 절반 속도 (빨리감기 중엔 무시)
      if (!fastRef.current && questSlowActive(st)) {
        slowFlip.current = !slowFlip.current;
        if (slowFlip.current) return;
      }
      st.tick(fastRef.current ? 5 : 1);
    }, MS_PER_MINUTE[timeSpeed]);
    return () => clearInterval(iv);
  }, [timeSpeed]);

  // 1일차: 눈을 떠 보니 늦잠 → 분대장에게 혼나고 연병장으로
  useEffect(() => {
    const st = useGame.getState();
    if (st.day !== 1 || st.flags.wokeUp) return;
    const sgt = 'sgt' as NpcId;
    setOverlay({
      type: 'dialogue',
      script: {
        npc: sgt,
        lines: [
          { who: 'narr', text: '쾅! 생활관 문이 벌컥 열렸다. 기상나팔은 이미 끝난 지 오래였다.' },
          { who: 'npc', text: '야!!! 신병!!! 지금 몇 시인 줄 알아?!' },
          { who: 'npc', text: '전입 첫날부터 늦잠이냐? 다들 연병장에 집합해 있다!' },
          { who: 'me', text: '(군대…? 진짜 군대야? 그것도 포켓몬들의 군대…?!)' },
          { who: 'me', text: '(…침착하자. 입대 전에 본 군대 유튜브만 수백 편이다. 「전입 신병 생존 가이드」에서 이럴 땐 분명…)' },
          { who: 'npc', text: '뭘 멍하니 있어! 관등성명!' },
        ],
        choices: [
          {
            text: '"{S}! 이병 {me}! 늦어서 죄송합니다! 바로 집합하겠습니다!"', grade: 'good',
            effects: { affinity: { sgt: 6 }, discipline: 2 },
            reply: [
              { who: 'npc', text: '…목소리는 합격이다. 3초 준다. 튀어나와!' },
              { who: 'me', text: '(휴… 유튜브에서 본 그대로다. 관등성명, 사과, 그리고 즉시 행동.)' },
            ],
            tip: '관등성명 = 계급 + 성명. 늦었을 땐 변명보다 "죄송합니다 + 바로 하겠습니다"가 먼저다.',
          },
          {
            text: '"저… 저 사실 사람인데요…?"', grade: 'ok',
            effects: { affinity: { sgt: -1 } },
            reply: [
              { who: 'npc', text: '잠이 덜 깼구먼. 여기 다 그런 사연 하나씩은 있다. 빨리 일어나!' },
              { who: 'me', text: '(…다들 그런 사연이 있다고?)' },
            ],
            tip: '상급자가 부르면 "{S}! 이병 ○○○!"처럼 경례 구호와 관등성명으로 답한다.',
          },
          {
            text: '(모포를 머리끝까지 뒤집어쓴다)', grade: 'bad',
            effects: { affinity: { sgt: -5 }, discipline: -3 },
            reply: [
              { who: 'narr', text: '……모포가 거칠게 걷혔다.' },
              { who: 'npc', text: '연병장으로. 지. 금. 당. 장.' },
            ],
          },
        ],
      },
      onChoice: (c) => {
        const s2 = useGame.getState();
        if (c.effects) s2.applyEffects(c.effects, '첫 만남');
        if (c.tip) s2.addTip(c.tip);
      },
      onDone: () => useGame.getState().oversleep(),
    });
  }, [setOverlay]);

  // 1일차 첫 점호가 끝나면: 밀덕 주인공의 다짐 + 조작 안내
  const prevRollcall = useRef(rollcall);
  useEffect(() => {
    const was = prevRollcall.current;
    prevRollcall.current = rollcall;
    const st = useGame.getState();
    if (!was || rollcall || st.day !== 1 || st.flags.tutorial) return;
    st.applyEffects({ flag: 'tutorial' }, undefined, true);
    setOverlay({
      type: 'dialogue',
      script: {
        lines: [
          { who: 'me', text: '(휴… 첫 점호는 어떻게든 넘겼다. 포켓몬 몸이라도 군대는 군대구나.)' },
          { who: 'me', text: '(유튜브에서 배운 대로만 하자. 집합은 무조건 5분 전, 대답은 크게, 모르면 솔직하게 물어보기!)' },
          { who: 'narr', text: '[조작] WASD/방향키 이동 · Shift 달리기(기력 소모) · E/Space 상호작용 · R 생활관 바로 가기 · Tab 수첩 · F 빨리감기' },
          { who: 'narr', text: '상단에 다음 일정이 뜬다. 집합 시각(상단 "○○까지")에 표시된 장소에 있으면 정시에 시작된다. 미리 도착해서 E로 보고하면 바로 시작. 그 시각에 없으면 끌려가 혼난다!' },
          { who: 'narr', text: '건물 문으로 드나들고, 길 끝(표지판)으로 걸어가면 병영식당·PX·위병소 같은 다른 구역으로 이동한다. 막사 2층엔 체단실·싸지방·도서관이 있다. 체력·멘탈이 25 미만이면 훈련 점수가 깎인다.' },
        ],
      },
    });
  }, [rollcall, setOverlay]);

  // 지각: 집합 장소로 끌려와 혼난 뒤 일정 시작
  const npcTargetRef = useRef<((id: NpcId) => Pos) | null>(null);
  useEffect(() => useGame.subscribe((st, prev) => {
    if (!st.lateCall || prev.lateCall) return;
    const { who, label } = st.lateCall;
    // 다른 인원은 이미 집합해 있다: 이번 집합에 올 사람들을 대열 자리에 바로 세우고, 혼내는 사람은 내 앞에
    const ev = st.currentEvent();
    const targetOf = npcTargetRef.current;
    if (ev?.spot && targetOf) {
      const sp = world.spots[ev.spot];
      for (const id of presentNpcs(st.day)) {
        const n = npcs.current[id];
        if (!n) continue;
        const [tm, tx, ty] = targetOf(id);
        if (tm !== sp.map || Math.hypot(tx - sp.x, ty - sp.y) > 6) continue; // 이번 집합 대상이 아님
        n.map = tm; n.x = tx + 0.5; n.y = ty + 0.5; n.dir = 'down';
        n.path = []; n.viaDoor = null; n.moving = false; n.targetKey = `${tm}:${tx},${ty}`;
      }
      const w = npcs.current[who];
      if (w) {
        const p = runtime.player;
        w.map = p.map; w.x = p.x; w.y = p.y - 1.1; w.dir = 'down';
        w.path = []; w.viaDoor = null; w.moving = false;
        w.targetKey = ''; // 꾸중이 끝나면 다시 대열 자리로
      }
    }
    setOverlay({
      type: 'dialogue',
      script: {
        npc: who,
        lines: [
          { who: 'narr', text: `집합 시간이 지났다… 「${label}」 집합 장소로 헐레벌떡 끌려왔다.` },
          { who: 'npc', text: '{me}! 지금이 몇 시야? 다들 기다리고 있었다!' },
          { who: 'npc', text: '집합 시간은 생명이다. 할 말 있나?' },
        ],
        choices: [
          {
            text: '"죄송합니다! 다음부터 5분 전에 도착하겠습니다. 시정하겠습니다!"', grade: 'good',
            effects: { affinity: { [who]: 3 }, discipline: 1 },
            reply: [{ who: 'npc', text: '…좋아. 말한 대로 해라. 바로 시작한다.' }],
            tip: '집합은 "5분 전 도착"이 기본. 늦었다면 변명보다 사과와 시정 의지를 먼저 보이자.',
          },
          {
            text: '"길을 잃었습니다…"', grade: 'ok',
            effects: {},
            reply: [{ who: 'npc', text: '부대 지도는 머릿속에 넣어 둬라. 다음엔 없다.' }],
          },
          {
            text: '"아직 시간 남은 줄 알았는데요?"', grade: 'bad',
            effects: { affinity: { [who]: -3 }, discipline: -2 },
            reply: [{ who: 'npc', text: '…시계 볼 줄 모르나? 일단 시작해. 끝나고 따로 보자.' }],
          },
        ],
      },
      onChoice: (c) => {
        const s2 = useGame.getState();
        if (c.effects) s2.applyEffects(c.effects, '지각');
        if (c.tip) s2.addTip(c.tip);
      },
      onDone: () => useGame.getState().resolveLate(),
    });
  }), [setOverlay, world]);

  // ───────────── 점호 의식 (아침: 연병장 정렬 / 저녁: 생활관 침상) ─────────────
  const cer = useRef<CeremonyRt | null>(null);
  const [cerShow, setCerShow] = useState<{ info: CeremonyInfo; aide: SpeakerInfo | null } | null>(null);
  const actorRt = useCallback((who: string): CerActor | undefined =>
    who === 'me' ? runtime.player : who.startsWith('x:') ? extras.current[who.slice(2)] : npcs.current[who as NpcId], []);
  const cerCtl = useMemo<CeremonyCtl>(() => ({
    pose: (p) => { const c = cer.current; if (c && c.pose !== p) { c.pose = p; c.poseT0 = performance.now() / 1000; } },
    bubble: (text) => { if (cer.current) cer.current.bubble = text; },
    move: (who, tx, ty, dur, endDir) => {
      const c = cer.current;
      const a = actorRt(who);
      if (!c || !a) return;
      c.moves = c.moves.filter((m) => m.a !== a);
      c.moves.push({ a, fx: a.x, fy: a.y, tx, ty, t0: performance.now() / 1000, dur, endDir });
    },
    stand: (who) => { cer.current?.seated.delete(who); },
  }), [actorRt]);

  useEffect(() => {
    if (!rollcall || cer.current) return;
    const st = useGame.getState();
    const kind = rollcall.kind === 'rollcall_am' ? 'am' : 'pm';
    const present = presentNpcs(st.day);
    let duty: CeremonyInfo['duty'] = st.day % 2 === 1 ? 'lt' : 'sgm';
    if (!present.includes(duty)) duty = 'cpt';
    const leader = currentSquadLeader(st.day) as CeremonyInfo['leader'];
    const soldiers = SOLDIER_IDS.filter((id) => present.includes(id));
    const ensure = (id: NpcId): NpcRt =>
      npcs.current[id] ?? (npcs.current[id] = { map: 'outdoor', x: 0, y: 0, dir: 'down', moving: false, path: [], targetKey: '', viaDoor: null });
    const place = (a: CerActor & { path?: [number, number][]; viaDoor?: Door | null; targetKey?: string }, m: MapId, x: number, y: number, dir: Dir) => {
      a.map = m; a.x = x; a.y = y; a.dir = dir; a.moving = false;
      if (a.path) { a.path = []; a.viaDoor = null; a.targetKey = 'cer'; }
    };
    const ncoDef = extraDefs.find((d) => d.id === 'nco');
    const nco = ncoDef ? extras.current[ncoDef.id] : undefined;
    const members: string[] = [];
    const seated = new Set<string>();
    let marks: CeremonyInfo['marks'];
    let total: number;
    if (kind === 'am') {
      // 연병장: 구령대(y=17)를 바라보고 6열로 오와 열을 맞춘다
      const sp = world.spots.parade;
      const order: string[] = [...soldiers];
      if (!rollcall.late) order.splice(Math.max(0, order.indexOf('buddy')), 0, 'me');
      for (const def of extraDefs) if (!def.officer && !['dog', 'guard', 'cook'].includes(def.id)) order.push('x:' + def.id);
      if (rollcall.late) order.push('me');
      let i = 0;
      for (const k of order) {
        const a = k === 'me' ? runtime.player : k.startsWith('x:') ? extras.current[k.slice(2)] : ensure(k as NpcId);
        if (!a) continue;
        place(a, 'outdoor', sp.x - 2 + (i % 6), sp.y - 1.5 + Math.floor(i / 6), 'up');
        members.push(k);
        i++;
      }
      place(ensure(duty), 'outdoor', sp.x + 5.5, sp.y - 2.5, 'left');
      let ox = sp.x - 3.5;
      for (const id of ['cpt', 'lt', 'sgm'] as NpcId[]) {
        if (id === duty || !present.includes(id)) continue;
        place(ensure(id), 'outdoor', ox, sp.y - 3.4, 'down');
        ox -= 1;
      }
      if (nco) place(nco, 'outdoor', sp.x + 4.5, sp.y - 3.4, 'down');
      marks = { stage: [sp.x + 0.5, sp.y - 4.45], leader: [0, 0], duty: [0, 0], aide: [0, 0], door: [0, 0] };
      total = members.length;
    } else {
      // 1생활관: 위쪽 침상 줄에 걸터앉아 통로를 바라본다 (내 자리는 3번 침상)
      const others = [1, 5, 9, 11, 13];
      place(runtime.player, 'room1', 3.5, 3.55, 'down');
      seated.add('me'); members.push('me');
      soldiers.forEach((id, i) => {
        if (i >= others.length) return;
        place(ensure(id), 'room1', (BED_X[id] ?? others[i]) + 0.5, 3.55, 'down');
        seated.add(id); members.push(id);
      });
      place(ensure(duty), 'room1', 7.5, 1.3, 'down');
      if (nco) place(nco, 'room1', 6.5, 1.3, 'down');
      marks = { stage: [0, 0], leader: [6.5, 5.5], duty: [8.6, 5.6], aide: [10.5, 6.1], door: [6.5, 1.3] };
      total = soldiers.length + 1;
    }
    cer.current = { kind, pose: 'stand', poseT0: performance.now() / 1000, bubble: null, members, seated, moves: [] };
    const aide: SpeakerInfo | null = ncoDef && nco
      ? { name: ncoDef.name, sub: ncoDef.title, look: extraLook(ncoDef), cap: ('officer-' + b.cap) as CapType }
      : null;
    setCerShow({ info: { kind, duty, leader, total, late: rollcall.late, marks }, aide });
  }, [rollcall, world, extraDefs, b.cap]);

  const finishCeremony = useCallback(() => {
    const c = cer.current;
    if (c) {
      // 침상(통과 불가)에서 통로로 내려오고, 모두 원래 일정대로 다시 길을 찾는다
      for (const k of c.seated) { const a = actorRt(k); if (a) a.y = 4.5; }
      for (const n of Object.values(npcs.current)) if (n) { n.path = []; n.viaDoor = null; n.targetKey = ''; n.moving = false; }
      for (const e of Object.values(extras.current)) { e.path = []; e.viaDoor = null; e.targetKey = ''; e.moving = false; }
      runtime.player.moving = false;
    }
    cer.current = null;
    setCerShow(null);
    useGame.getState().closeRollcall();
  }, [actorRt]);

  // 🧪 테스터 모드 미션 종료 (Game의 F9 단축키가 보낸다)
  // 점호 의식 → 바로 종료 / 지각 꾸중 → 건너뛰고 해당 일정 종료 / 그 외 → 현재 일정 종료
  useEffect(() => {
    const onSkip = () => {
      const c = cer.current;
      if (c) {
        finishCeremony();
        useGame.getState().toast(`🧪 테스터 모드: ${c.kind === 'am' ? '아침' : '저녁'} 점호 종료`, 'info');
        return;
      }
      if (useGame.getState().lateCall) useGame.setState({ lateCall: null });
      if (overlayRef.current) setOverlay(null);
      const st = useGame.getState();
      const ev = st.currentEvent();
      if (!ev) { st.toast('🧪 진행 중인 미션이 없습니다.', 'info'); return; }
      if (ev.kind === 'farewell') { st.beginEvent(); return; }
      st.completeEvent();
      useGame.getState().toast(`🧪 테스터 모드: "${ev.label}" 종료`, 'info');
    };
    window.addEventListener('tester-skip', onSkip);
    return () => window.removeEventListener('tester-skip', onSkip);
  }, [finishCeremony, setOverlay]);

  // 오마주: 처음 위병소 구역에 들어서면 위병이 외친다 "기다려! 풀숲은 위험해!"
  useEffect(() => {
    if (location !== 'depot') return;
    const st = useGame.getState();
    if (st.flags.depotIntro || st.lateCall || st.rollcall || overlayRef.current) return;
    const def = extraDefs.find((d) => d.id === 'guard');
    if (!def) return;
    st.applyEffects({ flag: 'depotIntro' }, undefined, true);
    const words = def.title.split(' ');
    setOverlay({
      type: 'dialogue',
      script: {
        custom: { name: `${def.name} ${words[words.length - 1]}`, sub: words.slice(0, -1).join(' '), look: extraLook(def), cap: BRANCHES[st.branch].cap as CapType },
        lines: [
          { who: 'npc', text: '잠깐! 기다려! 거기 풀숲은 위험해!' },
          { who: 'npc', text: '…밤마다 {wild}이(가) 튀어나온다고. 위병소 근무 서다 보면 진짜 깜짝 놀란다.' },
          { who: 'me', text: '(이 대사… 어디서 많이 들어 본 것 같은데.)' },
        ],
      },
    });
  }, [location, extraDefs, setOverlay]);

  // 📖 N-01 안개 너머: 위병소 정문 밖으로 나가면 하얘졌다가 초소 앞으로 돌아온다
  const [flash, setFlash] = useState(false);
  useEffect(() => { if (!flash) return; const tm = setTimeout(() => setFlash(false), 1200); return () => clearTimeout(tm); }, [flash]);
  /** 키로 사람(주요 NPC 또는 'x:엑스트라') 런타임 찾기 */
  const entityOf = useCallback((key: string) => (key.startsWith('x:') ? extras.current[key.slice(2)] : npcs.current[key as NpcId]) ?? null, []);
  /** 대본용 화자: 주요 NPC면 npc, 엑스트라면 custom */
  const speakerOf = useCallback((key: string): { npc?: NpcId; custom?: SpeakerInfo; who: LineWho } => {
    if (!key.startsWith('x:')) return { npc: key as NpcId, who: key as NpcId };
    const def = extraDefs.find((d) => d.id === key.slice(2));
    if (!def) return { who: 'narr' };
    const words = def.title.split(' ');
    return {
      who: 'npc',
      custom: { name: `${def.name} ${words[words.length - 1]}`, sub: words.slice(0, -1).join(' '), look: extraLook(def), cap: BRANCHES[useGame.getState().branch].cap as CapType },
    };
  }, [extraDefs]);
  /** 사람을 그 자리로 바로 옮긴다 (자다가 일어남 등) */
  const placeAt = useCallback((key: string, map: MapId, x: number, y: number, dir: Dir) => {
    const e = entityOf(key);
    if (!e) return;
    e.map = map; e.x = x; e.y = y; e.dir = dir; e.path = []; e.viaDoor = null; e.targetKey = `${map}:${Math.floor(x)},${Math.floor(y)}`; e.moving = false;
  }, [entityOf]);

  /** 🌙 소등 후 잠들어 있다가 → 근무 시간에 깨어난다 */
  const nightWake = useCallback(() => {
    const st = useGame.getState();
    const nd = st.nightDuty;
    if (!nd || nd.phase !== 'sleep') return;
    useGame.setState({ minute: nd.kind === 'guard' ? nd.shiftStart - 20 : nd.shiftStart - 2 });
    const p = runtime.player;
    p.map = 'room1'; p.x = 3.5; p.y = 4.5; p.dir = 'right'; p.moving = false;
    keys.current = {};
    placeAt(nd.prev, 'room1', 4.5, 4.5, 'left');
    st.setNightDuty({ phase: 'woken' });
    const sp = speakerOf(nd.prev);
    const prevName = memberName(st.branch, nd.prev);
    if (nd.kind === 'watch') {
      const nextName = memberName(st.branch, nd.next);
      setOverlay({
        type: 'dialogue',
        script: { npc: sp.npc, custom: sp.custom, lines: [
          { who: 'narr', text: '(누군가 어깨를 조심스럽게 흔든다…) 23:58. 생활관은 숨소리뿐이다.' },
          { who: sp.who, text: '(속삭이며) {me}… {me}. 일어나. 불침번 근무 시간이다.' },
          { who: 'me', text: '(비몽사몽) …네. 일어났습니다.' },
          { who: sp.who, text: `근무 인수인계. 특이사항 없음, 화장실 간 인원 없음. 손전등이랑 근무일지 여기. 다음 근무자는 ${nextName}, 00:50에 깨워서 교대해.` },
          { who: 'me', text: '(작게) 네, 수고하셨습니다.' },
          { who: 'narr', text: `${prevName}이(가) 조용히 자기 침상으로 돌아간다. 깨어 있는 건 이제 나, 그리고 지휘통제실의 당직병과 당직사령뿐.` },
        ] },
        onDone: () => {
          const s2 = useGame.getState();
          s2.setNightDuty({ phase: 'shift' });
          useGame.setState({ minute: Math.max(s2.minute, s2.nightDuty!.shiftStart) });
          s2.addTip('불침번: 취침 시간에 생활관을 지키는 근무. 이전 근무자가 깨우면 인수인계(특이사항·인원·물품)를 받고, 끝나기 10분 전쯤 다음 근무자를 깨워 교대한다.');
          s2.startMinigame({ game: 'night', title: '🌙 불침번 근무 (00:00~01:00)', returnTo: 'world' });
        },
      });
    } else {
      const iAmJunior = rankIdxForDay(st.day) <= 1;
      setOverlay({
        type: 'dialogue',
        script: { npc: sp.npc, custom: sp.custom, lines: iAmJunior ? [
          { who: 'narr', text: '(누군가 발끝으로 다가와 이불을 툭툭 친다…) 23:40.' },
          { who: sp.who, text: '(속삭이며) 야, {me}. 일어나. 위병소 근무 가자. …쉿, 조용히. 다른 애들 깬다.' },
          { who: 'me', text: '(작게) …네, 일어났습니다.' },
          { who: sp.who, text: '전투복 입고 나와. 00시 교대니까 늦지 않게 앞장서. 내가 뒤따라간다.' },
          { who: 'narr', text: `[사수 ${prevName}와(과) 함께 위병소 초소로 가자. 깨어 있는 건 당직병과 당직사령뿐이다.]` },
        ] : [
          { who: 'narr', text: '(누군가 조심스럽게 어깨를 흔든다…) 23:40.' },
          { who: sp.who, text: '(속삭이며) {me} {myrank}님… 근무 시간입니다.' },
          { who: 'me', text: '(작게) 어, 그래. 조용히 준비하고 따라와.' },
          { who: 'narr', text: `[부사수 ${prevName}을(를) 데리고 위병소 초소로 가자. 깨어 있는 건 당직병과 당직사령뿐이다.]` },
        ] },
        onDone: () => {
          useGame.getState().setNightDuty({ phase: 'toPost' });
          useGame.getState().addTip('야간 경계근무는 사수·부사수 2인 1조. 자는 인원이 깨지 않게 조용히 일어나 함께 이동하고, 초소에서 이전 근무자와 교대한다.');
        },
      });
    }
  }, [placeAt, speakerOf, setOverlay]);

  useEffect(() => {
    if (nightPhase === 'sleep') {
      const p = runtime.player;
      p.map = 'room1'; p.x = 3.5; p.y = 4.5; p.dir = 'up'; p.moving = false;
      keys.current = {};
      const tm = setTimeout(() => nightWake(), 3200);
      return () => clearTimeout(tm);
    }
    const st = useGame.getState();
    const nd = st.nightDuty;
    if (!nd) return;
    if (nightPhase === 'wakeNext') st.toast(`🔦 00:50 — 근무 끝나기 10분 전. 다음 근무자 ${memberName(st.branch, nd.next)}을(를) 깨워 교대하자.`, 'alert');
    if (nightPhase === 'return' && nd.kind === 'guard') st.toast('🌙 02:00 — 다음 근무자와 교대했다. 사수·부사수와 함께 조용히 생활관으로 복귀하자.', 'info');
    if (nightPhase === 'toPost') st.toast('🌙 위병소 초소로! 같이 근무 서는 사람이 뒤따라온다.', 'info');
  }, [nightPhase, nightWake]);

  /** 🌙 야간 근무 상호작용: 위병소 교대 · 다음 근무자 깨우기 · 취침 · 별빛 */
  const nightActRef = useRef<(key: string) => void>(() => {});
  nightActRef.current = (key: string) => {
    const st = useGame.getState();
    const nd = st.nightDuty;
    if (!nd) return;
    if (key === 'duty_star') {
      const lines = NIGHT_STAR_LINES[st.day] ?? ['…(빛이 무언가 말하려다 흩어졌다)'];
      setOverlay({
        type: 'dialogue',
        script: {
          custom: { name: '??? (별빛)', sub: '', look: null, cap: null },
          lines: [
            { who: 'narr', text: nd.kind === 'watch' ? '창가에 작은 별빛이 떠 있다. 손전등을 비춰도 그림자가 생기지 않는다…' : '안개 낀 길 위에 작은 별빛이 둥실 떠 있다. 사수는 못 본 것 같다…' },
            ...lines.map((t) => ({ who: 'npc' as const, text: t })),
            { who: 'narr', text: '눈을 한 번 깜빡이자, 빛은 사라지고 없었다.' },
          ],
        },
        onDone: () => {
          const s2 = useGame.getState();
          s2.applyEffects({ memory: 2, mental: 1, flag: `star_${s2.day}` }, '의문의 별빛');
          s2.log('✨ 야간 근무 중 의문의 별빛을 만났다.');
        },
      });
      return;
    }
    if (key === 'duty_post') {
      const guard = extraDefs.find((d) => d.id === 'guard');
      const gs = guard ? speakerOf('x:guard') : { who: 'narr' as const };
      setOverlay({
        type: 'dialogue',
        script: { custom: gs.custom, lines: [
          { who: 'me', text: '근무 교대! 근무자 {me} 외 1명, 근무 투입하겠습니다!' },
          { who: gs.who, text: '수고. 특이사항 없음. 정문 쪽에 안개가 좀 꼈으니 잘 봐. 암구호는 근무일지에.' },
          { who: 'narr', text: `이전 근무자들이 하품을 하며 막사로 돌아간다. 초소엔 나와 ${nd.partner ? memberName(st.branch, nd.partner) : '근무자'} 둘뿐.` },
        ] },
        onDone: () => {
          const s2 = useGame.getState();
          s2.setNightDuty({ phase: 'shift' });
          useGame.setState({ minute: Math.max(s2.minute, s2.nightDuty!.shiftStart) });
          s2.startMinigame({ game: 'guard', title: '🌙 야간 위병소 근무 (00:00~02:00)', returnTo: 'world' });
        },
      });
      return;
    }
    if (key === 'duty_wake') {
      const sp = speakerOf(nd.next);
      const nextName = memberName(st.branch, nd.next);
      const same = nd.next === 'buddy';
      setOverlay({
        type: 'dialogue',
        script: { npc: sp.npc, custom: sp.custom, lines: [
          { who: 'me', text: same ? `(속삭이며) 야, ${nextName}. 일어나. 근무다.` : `(속삭이며) ${nextName}님… 일어나십시오. 불침번 근무 시간입니다.` },
          { who: sp.who, text: '…으음… 벌써 그렇게 됐어? …알았어, 일어날게.' },
          { who: 'me', text: same ? '인수인계. 특이사항 없음, 화장실 간 인원 없음. 손전등이랑 근무일지 여기.' : '근무 인수인계입니다. 특이사항 없음, 화장실 간 인원 없음. 손전등이랑 근무일지 여기 있습니다.' },
          { who: sp.who, text: '(하품) 수고했어. 들어가 자.' },
        ] },
        onDone: () => {
          const s2 = useGame.getState();
          const e = entityOf(nd.next);
          if (e) { e.y = 4.5; e.path = []; e.viaDoor = null; e.targetKey = ''; }
          s2.setNightDuty({ nextAwake: true, phase: 'return' });
          s2.toast('🛏️ 교대 완료. 내 침상으로 돌아가 자자.', 'info');
        },
      });
      return;
    }
    if (key === 'duty_sleep') {
      const sp = nd.partner ? speakerOf(nd.partner) : null;
      setOverlay({
        type: 'dialogue',
        script: { npc: sp?.npc, custom: sp?.custom, lines: nd.kind === 'guard' && sp ? [
          { who: sp.who, text: rankIdxForDay(st.day) <= 1 ? '(속삭이며) 수고했다. 얼른 자라. 아침 점호 늦지 말고.' : '(속삭이며) 수고하셨습니다, {me} {myrank}님. 안녕히 주무십시오.' },
          { who: 'narr', text: '조용히 모포를 덮었다. 발이 아직 차갑다.' },
        ] : [
          { who: 'narr', text: `모포를 덮었다. 이제 깨어 있는 건 ${memberName(st.branch, nd.next)}, 그리고 지휘통제실의 당직병뿐…` },
        ] },
        onDone: () => useGame.getState().finishNightDuty(),
      });
    }
  };

  /** 🍚 먹는 중 매 프레임: 진행, (처음 한 번) 선임 속도 맞추기, 다 먹으면 일어나기 */
  const mealTickRef = useRef<() => void>(() => {});
  mealTickRef.current = () => {
    const st = useGame.getState();
    const e = myMeal.eating;
    if (!e) return;
    const finish = (text: string, eff: Parameters<typeof st.applyEffects>[0], tone: 'good' | 'bad' | 'info' = 'info') => {
      myMeal.eating = null; myMeal.tray = '';
      st.applyEffects(eff, e.meal === 'lunch' ? '점심' : '저녁');
      st.log(text);
      st.toast(text, tone);
    };
    if (!isMealTime(st.minute)) { finish('🍚 배식 시간이 끝나 남은 밥을 급히 비웠다.', { hp: 12, mental: 1 }); return; }
    const dm = Math.max(0, st.minute - e.last);
    e.last = st.minute;
    e.prog = Math.min(1, e.prog + dm / MY_EAT_MIN);
    const squad = squadKeys(st.branch, st.day);
    const lead = squad[0];
    const leadAt = lead ? mealSeated(st.day, st.minute)[lead] : undefined;
    // 🥄 처음 한 번: 선임 먹는 속도에 맞추는 군대 개념
    if (!st.flags.mealPace && !e.pace && lead && leadAt !== undefined && st.minute >= e.start + 1 && st.minute < leadAt + SQUAD_EAT_MIN - 3) {
      const teacher: NpcId | null = presentNpcs(st.day).includes('senior') ? 'senior' : lead.startsWith('x:') ? null : (lead as NpcId);
      e.pace = { finish: leadAt + SQUAD_EAT_MIN, lead };
      const leadName = memberName(st.branch, lead);
      setOverlay({
        type: 'dialogue',
        script: {
          npc: teacher ?? undefined,
          lines: [
            { who: 'narr', text: `같은 줄 끝의 ${leadName}. 숟가락이 무서운 속도로 움직인다. 식판이 벌써 반쯤 비었다…` },
            teacher
              ? { who: teacher, text: '(작게) 야, {me}. 천천히 먹는 건 좋은데… 군대에선 선임 먹는 속도에 맞추는 거다. 선임이 숟가락 내려놓으면 같이 일어나야 돼.' }
              : { who: 'narr', text: '선임이 숟가락을 내려놓으면 같이 일어나야 한다. 서두르자!' },
            { who: 'narr', text: '[Space를 연타해서 선임과 같이 다 먹자!]' },
          ],
        },
        onDone: () => useGame.getState().addTip('식사 예절: 선임과 같이 밥을 먹을 땐 속도를 맞춘다. 선임이 다 먹었는데 혼자 천천히 먹고 있으면 눈치가 보인다… (요즘은 많이 사라진 문화지만, 아직 남아 있는 곳도 있다)'),
      });
      return;
    }
    if (e.pace && st.minute >= e.pace.finish) {
      const ok = e.prog >= 0.85;
      useGame.setState({ flags: { ...useGame.getState().flags, mealPace: true } });
      const leadName = memberName(st.branch, e.pace.lead);
      if (ok) finish(`🥄 ${leadName}이(가) 숟가락을 내려놓는 순간, 나도 식판을 비웠다. 완벽한 타이밍!`, { hp: 15, mental: 2, discipline: 2, affinity: e.pace.lead.startsWith('x:') ? {} : { [e.pace.lead]: 2 } }, 'good');
      else finish(`🥄 ${leadName}이(가) 숟가락을 내려놓았다… 남은 밥을 허겁지겁 밀어 넣고 따라 일어났다.`, { hp: 10, mental: -2, discipline: -1 }, 'bad');
      return;
    }
    if (e.prog >= 1 && e.pace) {
      useGame.setState({ flags: { ...useGame.getState().flags, mealPace: true } });
      finish(`🥄 ${memberName(st.branch, e.pace.lead)}보다 한발 먼저 식판을 비우고, 숟가락 놓기를 기다렸다. 눈치 백 점!`, { hp: 15, mental: 2, discipline: 2, affinity: e.pace.lead.startsWith('x:') ? {} : { [e.pace.lead]: 2 } }, 'good');
      return;
    }
    if (e.prog >= 1) {
      finish(e.meal === 'lunch' ? '🍚 점심 잘 먹었습니다! 제육볶음은 진리다.' : '🍚 저녁 잘 먹었습니다! 군대 카레는 왜 이렇게 맛있지?', e.pace ? { hp: 15, mental: 2, discipline: 2 } : { hp: 15, mental: 2 }, 'good');
    }
  };

  const fogEventRef = useRef<() => void>(() => {});
  fogEventRef.current = () => {
    const p = runtime.player;
    p.x = 13.5; p.y = 26.6; p.dir = 'up'; p.moving = false;
    keys.current = {};
    setFlash(true);
    setOverlay({
      type: 'dialogue',
      script: {
        custom: { name: '안개 속 목소리', sub: '???', look: null, cap: null },
        lines: [
          { who: 'narr', text: '정문 밖으로 한 발 내디뎠다. 사방이 하얗다…' },
          { who: 'narr', text: '…정신을 차리니, 다시 초소 앞이다.' },
          { who: 'npc', text: '…나가지 않아도 돼…' },
          { who: 'me', text: '(누구야…? 꿈속의 빛이랑은… 다른 목소리야.)' },
        ],
      },
      onDone: () => useGame.getState().findClue('C-04'),
    });
  };
  const fogActive = (st: { day: number; minute: number; clues: string[] }) =>
    st.clues.length > 0 && !st.clues.includes('C-04') && ((st.day === 3 && st.minute >= 22 * 60) || st.day >= 4);

  // 🏠 생활관 바로 가기: 내 침상 앞으로 (문 이동과 같은 페이드)
  const warpReq = useRef<Door | null>(null);
  const goHome = useCallback(() => {
    const st = useGame.getState();
    if (overlayRef.current || st.rollcall || st.lateCall || cer.current || useSettings.getState().open) return;
    if (myMeal.eating) { st.toast('🍚 식사 중이다. 다 먹고 일어나자.', 'info'); return; }
    const bed = world.spots.bed;
    warpReq.current = { tiles: [], to: bed.map, enterDir: 'down', arrive: { x: bed.x + 0.5, y: bed.y + 0.5, dir: 'down' } };
  }, [world]);

  // 🏃 달리기 기력 (0~1). 바닥나면 35%까지 회복될 때까지 달릴 수 없다
  const stamina = useRef({ v: 1, lock: false, idle: 0, dashing: false });

  // 🚪 다른 생활관(2생활관) 입실: 상병 미만은 "(계급) (이름)입니다. 들어가도 되겠습니까?"
  const askEnterRef = useRef<(d: Door) => void>(() => {});
  askEnterRef.current = (d: Door) => {
    const p = runtime.player;
    // 대답을 기다리는 동안 문이 다시 열리지 않게 한 발 물러선다
    const back = { up: [0, 0.7], down: [0, -0.7], left: [0.7, 0], right: [-0.7, 0] }[d.enterDir];
    p.x += back[0]; p.y += back[1]; p.moving = false;
    keys.current = {};
    const inside = extraDefs.find((e) => e.id === 'room2a');
    const st = useGame.getState();
    const speaker = inside ? {
      name: `${inside.name} ${inside.title.split(' ').pop()}`, sub: '2생활관 (문 안쪽에서)', look: extraLook(inside),
      cap: BRANCHES[st.branch].cap as CapType,
    } : undefined;
    let enter: Door | null = null;
    setOverlay({
      type: 'dialogue',
      script: {
        custom: speaker,
        lines: [
          { who: 'narr', text: '2생활관 문 앞. 다른 분대 생활관이다.' },
          { who: 'narr', text: '어떻게 들어갈까?' },
        ],
        choices: [
          {
            text: '(똑똑) "{myrank} {me}입니다! 들어가도 되겠습니까?"', grade: 'good', effects: { discipline: 1 },
            reply: [{ who: 'npc', text: '어, 들어와~ 무슨 일이냐?' }],
            tip: '다른 생활관에 들어갈 땐 노크하고 "계급 성명입니다. 들어가도 되겠습니까?"라고 묻는 게 예의. 상병쯤 되면 편하게 드나든다.',
          },
          {
            text: '(그냥 문을 열고 들어간다)', grade: 'bad', effects: { discipline: -2, mental: -1 },
            reply: [{ who: 'npc', text: '야, 노크 안 하냐? …다음부턴 물어보고 들어와라.' }],
          },
          { text: '(돌아간다)', grade: 'ok', reply: [{ who: 'narr', text: '괜히 긴장된다. 나중에 다시 오자.' }] },
        ],
      },
      onChoice: (c) => {
        const s2 = useGame.getState();
        if (c.effects) s2.applyEffects(c.effects, '생활관 입실');
        if (c.tip) s2.addTip(c.tip);
        enter = c.text.includes('돌아간다') ? null : d;
      },
      onDone: () => { if (enter) warpReq.current = enter; },
    });
  };

  // NPC 목표 위치
  const npcTarget = useCallback((id: NpcId): Pos => {
    const st = useGame.getState();
    const m = st.minute;
    const ev = st.currentEvent();
    const officer = NPC_ROLES[id].officer;
    if (st.day >= TOTAL_DAYS) {
      const gate = world.spots.gate;
      return id === 'lt' || id === 'cpt' || id === 'sgm' ? ['outdoor', gate.x + (id === 'lt' ? -2 : id === 'cpt' ? 2 : 3), gate.y - 2] : FREE_POS[id];
    }
    const ng = nightGoal(id, st);
    if (ng) return ng;
    if (ev && !st.eventBegun && m >= ev.start && ev.spot) {
      const sp = world.spots[ev.spot];
      if (!officer) {
        const soldiers = presentNpcs(st.day).filter((n) => !NPC_ROLES[n].officer);
        const i = soldiers.indexOf(id);
        const [dx, dy] = FORMATION[i % FORMATION.length];
        return [sp.map, sp.x + dx, sp.y + dy];
      }
      if (id === 'lt' || (id === 'cpt' && ev.kind === 'rollcall_am')) return [sp.map, sp.x + (id === 'cpt' ? 1 : -1), sp.y - 4];
    }
    // 아침 점호 전에는 다들 생활관에 있다 (1일차 늦잠 장면은 분대장이 내 침상 옆)
    if (!officer && m < 6 * 60 + 15) {
      if (st.day === 1 && !st.flags.wokeUp && WAKE_POS[id]) return WAKE_POS[id]!;
      if (NIGHT_POS[id]) return NIGHT_POS[id]!;
    }
    if (isMealTime(m) && MEAL_POS[id]) {
      const goal = mealGoal(id, MEAL_POS[id]!, st);
      if (goal !== 'free') return goal;
    }
    if (officer && m >= LIGHTS_OUT) return ['command', id === 'lt' ? 5 : 7, 2];
    if (!officer && m >= 21 * 60 && NIGHT_POS[id]) return NIGHT_POS[id]!;
    return FREE_POS[id];
  }, [world]);

  npcTargetRef.current = npcTarget;

  // 상호작용 찾기 (같은 맵에 있는 것만)
  const findInteractable = useCallback((): Interactable | null => {
    const st = useGame.getState();
    const p = runtime.player;
    const ev = st.currentEvent();
    const dist = (x: number, y: number) => Math.hypot(p.x - x, p.y - y);
    const nd = st.nightDuty;
    if (nd) {
      const star = STAR_POS[nd.kind];
      const starOn = !st.flags[`star_${st.day}`] && (nd.kind === 'watch' ? nd.phase === 'wakeNext' || nd.phase === 'return' : nd.phase === 'toPost' || nd.phase === 'return');
      if (starOn && p.map === star[0] && dist(star[1], star[2]) < 1.9) return { key: 'duty_star', kind: 'duty', label: '✨ 희미한 별빛' };
      if (nd.phase === 'toPost') {
        const sp = world.spots.post;
        if (p.map === sp.map && dist(sp.x + 0.5, sp.y + 0.5) < 2.2) return { key: 'duty_post', kind: 'duty', label: '근무 교대 (위병소 초소)' };
      }
      if (nd.phase === 'wakeNext') {
        const n = entityOf(nd.next);
        if (n && n.map === p.map && dist(n.x, n.y) < 2.3) return { key: 'duty_wake', kind: 'duty', label: `${memberName(st.branch, nd.next)} 깨우기 (근무 교대)` };
      }
      if (nd.phase === 'return') {
        const bd = world.spots.bed;
        if (p.map === bd.map && dist(bd.x + 0.5, bd.y + 0.5) < 1.6) return { key: 'duty_sleep', kind: 'duty', label: '침상에 누워 잠들기' };
      }
      // 근무 중엔 다른 일은 하지 않는다 (다들 자고 있다)
      return null;
    }
    if (ev && !st.eventBegun && ev.spot && (st.minute >= ev.start || ev.kind === 'farewell')) {
      const sp = world.spots[ev.spot];
      if (sp.map === p.map && dist(sp.x + 0.5, sp.y + 0.5) < 2.2) {
        return { key: `ev_${ev.id}`, kind: 'event', label: ev.kind === 'farewell' ? '위병소를 나선다 (전역!)' : `집합 완료 보고: ${ev.label}`, spot: ev.spot };
      }
    }
    // 🍱 식판을 들고 내 자리 근처에 오면 앉아서 먹기
    if (myMeal.tray && !myMeal.eating && p.map === 'mess' && dist(MY_MEAL_SEAT[0] + 0.5, MY_MEAL_SEAT[1] + 0.5) < 1.4) {
      return { key: 'meal_seat', kind: 'seat', label: '내 자리에 앉아 먹기' };
    }
    let best: Interactable | null = null;
    let bd = 1.5;
    for (const id of visibleNpcs(st.day, st.minute)) {
      const n = npcs.current[id];
      if (!n || n.map !== p.map) continue;
      const d = dist(n.x, n.y);
      if (d < bd) {
        bd = d;
        best = { key: `npc_${id}`, kind: 'npc', npc: id, label: npcAsleep(id, n, st.minute) ? `😴 ${npcDisplayName(st.branch, id, st.day)} (자는 중)` : `대화: ${npcDisplayName(st.branch, id, st.day)}` };
      }
    }
    if (best) return best;
    for (const def of extraDefs) {
      const e = extras.current[def.id];
      if (!e || e.map !== p.map || extraHiddenAtNight(def.id, st.minute)) continue;
      const d = dist(e.x, e.y);
      if (d < bd) { bd = d; best = { key: `extra_${def.id}`, kind: 'extra', extra: def.id, label: `대화: ${def.name} ${def.title}` }; }
    }
    if (best) return best;
    const spotNames: Partial<Record<SpotId, string>> = {
      bed: '내 침상', mess: '식당 배식대', px: STORE_NAME[st.branch], admin: '행정반', command: '지휘통제실 상황판', tv: '휴게실 TV',
      cyber: '싸지방 PC', gym: '체단실 운동 기구', maint: '정비실 작업대', library: '도서관 책장',
      wc1: '화장실', wc2: '화장실', laundry1: '세탁기', laundry2: '세탁기', water1: '정수기', water2: '정수기',
      board1: '복도 게시판', board2: '복도 게시판', kitchen: '조리실', court: '농구장', recycle: '분리수거장',
      ammo: FACILITY_NAME[st.branch], post: '위병소 초소',
    };
    for (const [id, label] of Object.entries(spotNames) as [SpotId, string][]) {
      const sp = world.spots[id];
      if (sp.map === p.map && dist(sp.x + 0.5, sp.y + 0.5) < 1.4) return { key: `spot_${id}`, kind: 'spot', spot: id, label };
    }
    return null;
  }, [world, extraDefs]);

  // ───── 상호작용 핸들러 ─────
  const openNpc = useCallback((id: NpcId) => {
    const st = useGame.getState();
    const sleeper = npcs.current[id];
    if (sleeper && npcAsleep(id, sleeper, st.minute)) {
      setOverlay({ type: 'dialogue', script: { lines: [{ who: 'narr', text: '(곤히 자고 있다… 깨우지 말자.)' }] } });
      return;
    }
    const name = npcDisplayName(st.branch, id, st.day);
    const q = st.questStepAt({ npc: id });
    if (q) {
      setOverlay({
        type: 'dialogue',
        script: { npc: id, lines: [{ who: 'npc', text: q.text }] },
        onDone: () => { useGame.getState().advanceQuest(q.quest.id); useGame.getState().spend(10); },
      });
      return;
    }
    const talk = () => {
      const s2 = useGame.getState();
      s2.spend(10);
      s2.markTalked(id);
      if (s2.day >= TOTAL_DAYS) {
        const line = FAREWELL_LINES[id] ?? '전역 축하한다!';
        setOverlay({
          type: 'dialogue',
          script: {
            npc: id,
            lines: [{ who: 'npc', text: line }],
            choices: [
              { text: '"그동안 정말 감사했습니다! {S}!"', grade: 'good', effects: { affinity: { [id]: 6 }, mental: 3 }, reply: [{ who: 'npc', text: '{S}! 잘 가라!' }] },
              { text: '"사회에서 꼭 다시 만나요!"', grade: 'good', effects: { affinity: { [id]: 5 }, mental: 4 }, reply: [{ who: 'npc', text: '그래, 꼭 연락해라!' }] },
            ],
          },
          onChoice: (c) => { const s3 = useGame.getState(); s3.applyEffects(c.effects ?? {}, undefined); s3.markFarewell(id); s3.log(`👋 ${NPC_SKINS[s3.branch][id].name}와(과) 작별 인사를 나눴다.`); },
        });
        return;
      }
      const d: Dialogue | null = s2.pickDialogue(id);
      if (!d) {
        const pool = SMALL_TALK[id] ?? ['…'];
        setOverlay({
          type: 'dialogue',
          script: { npc: id, lines: [{ who: 'npc', text: pool[Math.floor(Math.random() * pool.length)] }] },
          onDone: () => useGame.getState().applyEffects({ affinity: { [id]: 1 } }, undefined, true),
        });
        return;
      }
      s2.markSeen(d.id);
      if (d.effects) s2.applyEffects(d.effects, '대화');
      setOverlay({
        type: 'dialogue',
        script: { npc: id, lines: d.lines, choices: d.choices },
        onChoice: (c) => {
          const s3 = useGame.getState();
          if (c.effects) s3.applyEffects(c.effects, '대화');
          if (c.tip) s3.addTip(c.tip);
          s3.log(`💬 ${NPC_SKINS[s3.branch][id].name}: ${c.grade === 'good' ? '좋은 대화를 나눴다' : c.grade === 'ok' ? '무난하게 대화했다' : '대화가 어색하게 끝났다'}.`);
        },
      });
    };
    const already = st.talked.includes(id);
    const opts: MenuOption[] = [];
    for (const of of questOffers(st).filter((o) => o.open && o.giver === id)) {
      const d = dialogueById(of.dialogueId);
      if (!d) continue;
      opts.push({
        label: `💬 부탁 들어보기: ${QUESTS[of.questId].title}`, hint: '퀘스트',
        onSelect: () => {
          const s2 = useGame.getState();
          s2.spend(10);
          s2.markTalked(id);
          s2.markSeen(d.id);
          if (d.effects) s2.applyEffects(d.effects, '대화');
          setOverlay({
            type: 'dialogue',
            script: { npc: id, lines: d.lines, choices: d.choices },
            onChoice: (c) => {
              const s3 = useGame.getState();
              if (c.effects) s3.applyEffects(c.effects, '대화');
              if (c.tip) s3.addTip(c.tip);
            },
          });
        },
      });
    }
    const mc = st.mealCheck;
    if (mc && mc.status === 'asking' && mc.targets.includes(id) && !mc.asked.includes(id)) {
      opts.push({
        label: '🍚 "식사하러 가시겠습니까?"', hint: `식사 집합 ${mc.asked.length}/${mc.targets.length}`,
        onSelect: () => {
          const list = MEAL_REPLY[id] ?? ['그래, 가자.'];
          useGame.getState().spend(2);
          setOverlay({
            type: 'dialogue',
            script: {
              npc: id,
              lines: [
                { who: 'me', text: `{S}! {r:${id}}님, 식사하러 가시겠습니까?` },
                { who: 'npc', text: list[Math.floor(Math.random() * list.length)] },
              ],
            },
            onDone: () => {
              const s2 = useGame.getState();
              s2.askMeal(id);
              s2.addTip('식사 시간이 되면 후임이 선임들께 "식사하러 가시겠습니까?" 여쭤보고, 다 모이면 분대가 함께 식당으로 간다.');
            },
          });
        },
      });
    }
    opts.push(
      { label: already ? '잡담하기' : '대화하기', hint: '10분', onSelect: () => {
        if (already) {
          const pool = SMALL_TALK[id] ?? ['…'];
          useGame.getState().spend(5);
          setOverlay({ type: 'dialogue', script: { npc: id, lines: [{ who: 'npc', text: pool[Math.floor(Math.random() * pool.length)] }] } });
        } else talk();
      } },
    );
    const inv = Object.entries(st.inventory).filter(([, n]) => n > 0);
    opts.push({
      label: '선물하기',
      hint: st.gifted.includes(id) ? '오늘은 이미 줬다' : inv.length === 0 ? '소지품 없음' : `호감 +${Math.max(1, 6 - (st.giftCount[id] ?? 0) * 2)} (줄수록 감소)`,
      disabled: st.gifted.includes(id) || inv.length === 0,
      onSelect: () => {
        setOverlay({
          type: 'menu',
          title: `${name}에게 선물`,
          options: inv.map(([iid, n]) => ({
            label: `${ITEMS[iid].icon} ${ITEMS[iid].name} ×${n}`,
            hint: iid === 'chocopie' ? '정(情) 보너스!' : '',
            onSelect: () => {
              useGame.getState().gift(id, iid);
              useGame.getState().spend(5);
              setOverlay({ type: 'dialogue', script: { npc: id, lines: [{ who: 'npc', text: iid === 'chocopie' ? '초코파이…! 이게 바로 정(情)이지. 고맙다!' : '오, 나 주는 거야? 고맙다!' }] } });
            },
          })),
        });
      },
    });
    opts.push({ label: '그만두기', onSelect: () => setOverlay(null) });
    setOverlay({ type: 'menu', title: name, subtitle: `${npcRoleTitle(st.branch, id)} · ${NPC_SKINS[st.branch][id].species} · 호감 ${st.affinity[id]}`, options: opts });
  }, [setOverlay]);

  const openSpot = useCallback((id: SpotId) => {
    const st = useGame.getState();
    const m = st.minute;
    const free = isFreeTimeEvening(m) || isMealTime(m);
    const opts: MenuOption[] = [];
    const q = st.questStepAt({ spot: id });
    if (q) {
      opts.push({
        label: `📋 퀘스트 진행`, hint: q.minutes ? `${q.minutes}분` : '',
        onSelect: () => {
          const s2 = useGame.getState();
          s2.spend(q.minutes ?? 10);
          setOverlay({ type: 'dialogue', script: { lines: [{ who: 'narr', text: q.text }] }, onDone: () => useGame.getState().advanceQuest(q.quest.id) });
        },
      });
    }
    const act = (label: string, hint: string, mins: number, eff: Parameters<typeof st.applyEffects>[0], text: string, dailyKey?: string, disabled = false) => {
      opts.push({
        label, hint, disabled: disabled || (dailyKey ? st.daily.includes(dailyKey) : false),
        onSelect: () => {
          const s2 = useGame.getState();
          s2.spend(mins);
          if (dailyKey) s2.markDaily(dailyKey);
          s2.applyEffects(eff, label);
          s2.log(text);
          setOverlay({ type: 'dialogue', script: { lines: [{ who: 'narr', text }] } });
        },
      });
    };
    let title = '';
    switch (id) {
      case 'bed': {
        title = '🛏️ 내 침상';
        act('침상에서 쉬기', '30분 · 체력+12', 30, { hp: 12, mental: 2 }, '모포를 덮고 잠시 눈을 붙였다. 개운하다.', undefined, !free);
        const phoneOk = m >= 18 * 60 && m < 21 * 60;
        act('휴대폰으로 가족과 통화', phoneOk ? '20분 · 멘탈+10 (1일 1회)' : '18:00~21:00 — 지금은 그걸 쓸 때가 아니다!', 20, { mental: 10, memory: st.clues.length ? 3 : 0 }, '"엄마, 나… 포켓몬 됐어." "밥은 잘 먹고?" 역시 엄마는 엄마다.', 'phone', !phoneOk);
        const inv = Object.entries(st.inventory).filter(([, n]) => n > 0);
        opts.push({
          label: '간식 먹기', hint: inv.length ? `${inv.length}종 보유` : '없음', disabled: inv.length === 0,
          onSelect: () => setOverlay({
            type: 'menu', title: '🎒 간식',
            options: inv.map(([iid, n]) => ({ label: `${ITEMS[iid].icon} ${ITEMS[iid].name} ×${n}`, hint: ITEMS[iid].desc, onSelect: () => { useGame.getState().useItem(iid); useGame.getState().spend(10); setOverlay(null); } })),
          }),
        });
        opts.push({ label: '💾 저장하기', onSelect: () => { useGame.getState().save(); useGame.getState().toast('💾 저장했다.', 'info'); setOverlay(null); } });
        if (!free) opts.push({ label: '(지금은 일과 시간이다)', disabled: true, onSelect: () => {} });
        break;
      }
      case 'mess': {
        title = '🍚 식당 배식대';
        const meal = m < 15 * 60 ? 'lunch' : 'dinner';
        const ok = isMealTime(m);
        const ate = st.daily.includes(`meal_${meal}`);
        opts.push({
          label: !ok ? '배식 시간이 아니다' : ate ? '이미 먹었다' : myMeal.tray ? '식판을 이미 받았다' : '🍱 식판 받기 (배식)',
          hint: ok ? '받아서 1분대 줄 내 자리(맞선임 옆)에 앉아 먹는다' : '12:00~13:00 / 17:30~18:30',
          disabled: !ok || ate || !!myMeal.tray,
          onSelect: () => {
            useGame.getState().spend(1);
            myMeal.tray = meal;
            setOverlay({ type: 'dialogue', script: { lines: [
              { who: 'narr', text: meal === 'lunch' ? '오늘의 메뉴는 제육볶음! 배식병이 밥을 꾹꾹 눌러 담아 준다.' : '저녁은 카레. 국자 가득 카레가 부어진다.' },
              { who: 'narr', text: '식판을 들고 1분대 줄, 내 자리(맞선임 옆)로 가서 앉자.' },
            ] } });
          },
        });
        break;
      }
      case 'px': {
        title = `🏪 ${STORE_NAME[st.branch]}`;
        for (const it of Object.values(ITEMS)) {
          opts.push({
            label: `${it.icon} ${it.name}`, hint: `${it.price.toLocaleString()}원`, disabled: !free,
            onSelect: () => { useGame.getState().buy(it.id); },
          });
        }
        if (!free) opts.push({ label: '(운영 시간: 점심·개인정비 시간)', disabled: true, onSelect: () => {} });
        break;
      }
      case 'cyber': {
        title = '💻 사이버지식정보방 (싸지방)';
        act('인터넷 편지 확인', '30분 · 멘탈+6 (1일 1회)', 30, { mental: 6, memory: st.clues.length ? 3 : 0 }, '누군가의 PC에 접속했다. 친구들이 보낸 인터넷 편지를 읽었다. "포켓몬이라니 ㅋㅋㅋ 사진 보내봐"', 'letter', !free);
        act('자격증 공부', '40분 · 숙련도+4 멘탈-3 (1일 1회)', 40, { skill: 4, mental: -3 }, '인강을 들으며 문제를 풀었다. 머리가 지끈하지만 뿌듯하다.', 'study', !free);
        break;
      }
      case 'gym': {
        title = '🏋️ 체단실';
        act('운동하기', '30분 · 멘탈+6 군기+2 체력-8 (1일 1회)', 30, { hp: -8, mental: 6, discipline: 2 }, '팔굽혀펴기와 턱걸이를 했다. 포켓몬 근육이 꿈틀댄다!', 'gym', !free);
        break;
      }
      case 'admin': {
        title = '🗂️ 행정반';
        if (!q) opts.push({ label: '간부님들이 업무 중이시다.', disabled: true, onSelect: () => {} });
        break;
      }
      case 'command': {
        title = '📡 지휘통제실';
        if (st.patrol) {
          const all = st.patrol.done.length >= PATROL_SPOTS.length;
          opts.push({
            label: '🔦 순찰 결과 보고', hint: all ? '당직사관에게' : `아직 ${PATROL_SPOTS.length - st.patrol.done.length}곳 남음`, disabled: !all,
            onSelect: () => setOverlay({
              type: 'dialogue',
              script: {
                npc: 'lt',
                lines: [
                  { who: 'me', text: '{S}! 야간 순찰 결과 보고드립니다. 막사 1·2층 복도, 세탁실, 화장실 이상 무! 특이 사항은 메모해 두었습니다.' },
                  { who: 'npc', text: '수고했다. 꼼꼼하게 봤구먼. 들어가서 쉬어라.' },
                ],
              },
              onDone: () => useGame.getState().finishPatrol(true),
            }),
          });
        }
        const sc = st.schedule();
        const night = sc.some((e) => e.kind === 'night');
        opts.push({
          label: '오늘 근무표 확인', hint: '5분',
          onSelect: () => {
            useGame.getState().spend(5);
            setOverlay({
              type: 'dialogue',
              script: {
                lines: [
                  { who: 'narr', text: `📋 오늘 일정: ${sc.map((e) => `${fmtTime(e.start)} ${e.label}`).join(' / ')}` },
                  { who: 'narr', text: night ? (sc.some((e) => e.game === 'guard') ? '🌙 오늘 밤 위병소 근무 명단(00:00~02:00)에 내 이름이 있다…' : '🌙 오늘 밤 불침번 명단(00:00~01:00)에 내 이름이 있다…') : '🌙 오늘 밤 근무 명단에는 내 이름이 없다. 휴~' },
                  { who: 'narr', text: '암구호는 근무 투입 직전에만 공지된다. 보안!' },
                ],
              },
            });
          },
        });
        opts.push({
          label: '상황판 살펴보기', hint: '5분',
          onSelect: () => {
            useGame.getState().spend(5);
            setOverlay({ type: 'dialogue', script: { lines: [
              { who: 'narr', text: '부대 배치도, 비상 연락망, 오늘의 기상 정보가 빼곡하다.' },
              { who: 'me', text: '(유튜브에서 본 그 상황판이다… 실물은 처음 본다.)' },
            ] } });
          },
        });
        break;
      }
      case 'tv': {
        title = '📺 휴게실 TV';
        act('TV 보기', free ? '20분 · 멘탈+5 (1일 1회)' : '개인정비 시간에만', 20, { mental: 5 }, '오랜만에 보는 예능 프로그램. 다 같이 깔깔 웃었다. 채널을 돌리니 잉어킹이 튀어오르기를 쓰고 있다. …그러나 아무 일도 일어나지 않았다!', 'tv', !free);
        break;
      }
      case 'library': {
        title = '📚 도서관';
        act('책 읽기', free ? '30분 · 멘탈+4 숙련+2 (1일 1회)' : '개인정비·점심 시간에만', 30, { mental: 4, skill: 2 }, '진중문고 신간을 골라 읽었다. 어제 외운 영단어는… 1, 2, 그리고… 펑! 깨끗이 잊어버렸다.', 'library', !free);
        break;
      }
      case 'laundry1': case 'laundry2': {
        title = '🧺 세탁실';
        act('빨래 돌리기', free ? '20분 · 멘탈+3 (1일 1회)' : '개인정비·점심 시간에만', 20, { mental: 3 }, '전투복과 수건을 세탁기에 넣고 돌렸다. 섬유유연제 냄새에 기분이 좋아진다.', 'laundry', !free);
        break;
      }
      case 'wc1': case 'wc2': {
        title = '🚻 화장실';
        if (st.clues.length > 0 && st.day >= 2 && !st.clues.includes('C-02')) {
          opts.push({
            label: '세면하기', hint: '5분 · 멘탈+1',
            onSelect: () => {
              useGame.getState().spend(5);
              useGame.getState().applyEffects({ mental: 1 }, '세면하기');
              setFlash(true);
              setOverlay({
                type: 'dialogue',
                script: { lines: [
                  { who: 'narr', text: '차가운 물로 얼굴을 씻고 고개를 들었다.' },
                  { who: 'narr', text: '거울 속에… 까까머리 사람이 서 있다.' },
                  { who: 'narr', text: '눈을 깜빡이자, 다시 포켓몬이다.' },
                  { who: 'me', text: '(…착각 아니야. 나였어. 저게 원래 나야.)' },
                ] },
                onDone: () => useGame.getState().findClue('C-02'),
              });
            },
          });
        } else {
          act('세면하기', '5분 · 멘탈+1', 5, { mental: 1 }, '거울 속에 포켓몬이 서 있다. …아직도 적응이 안 된다.');
        }
        break;
      }
      case 'water1': case 'water2': {
        title = '🚰 정수기';
        act('물 마시기', '2분 · 체력+3 (1일 1회)', 2, { hp: 3 }, '시원한 물 한 컵. 살 것 같다.', 'water');
        break;
      }
      case 'board1': case 'board2': {
        title = '📌 복도 게시판';
        const show = (lines: { who: 'narr' | 'me'; text: string }[], tip?: string) => {
          useGame.getState().spend(3);
          if (tip) useGame.getState().addTip(tip);
          setOverlay({ type: 'dialogue', script: { lines } });
        };
        opts.push({
          label: '경계작전명령서', hint: '근무 전 숙지',
          onSelect: () => show([
            { who: 'narr', text: '📋 경계작전명령서 — 근무 투입 전 반드시 숙지할 것!' },
            { who: 'narr', text: `경계 지역: 위병소 초소 · ${FACILITY_NAME[st.branch]} 일대 / 순찰: 2인 1조` },
            { who: 'narr', text: '수하 절차: "정지!" → "누구냐!" → 문어 → 답어 확인 → 통과 또는 정지·보고' },
            { who: 'narr', text: '※ 암구호는 게시하지 않는다. 근무 투입 직전 구두로만 전달.' },
          ], '경계작전명령서에는 경계 지역·임무·수하 절차가 적혀 있다. 암구호는 보안상 절대 게시하지 않는다.'),
        });
        opts.push({
          label: '🎂 이번 달 생일자', hint: '선물하면 호감 보너스',
          onSelect: () => {
            const names = birthdayNpcs(st.day).map((id) => npcDisplayName(st.branch, id, st.day));
            if (st.clues.length > 0 && st.day >= 3 && !st.clues.includes('C-03')) {
              useGame.getState().spend(3);
              setOverlay({
                type: 'dialogue',
                script: { lines: [
                  { who: 'narr', text: `🎂 이번 달 생일자: ${names.length ? names.join(', ') : '없음'}` },
                  { who: 'narr', text: '…맨 아래, 흐린 글씨로 한 줄이 더 있다.' },
                  { who: 'narr', text: '「{me} — 입대일」' },
                  { who: 'me', text: '(…내 이름이다. 내 진짜 이름.)' },
                  { who: 'narr', text: '다시 보니, 그 줄은 사라지고 없었다.' },
                ] },
                onDone: () => useGame.getState().findClue('C-03'),
              });
              return;
            }
            show(names.length
              ? [{ who: 'narr', text: `🎂 이번 달 생일자: ${names.join(', ')}` }, { who: 'me', text: '(생일인 사람에게 PX 간식이라도 선물하면 좋아하겠지?)' }]
              : [{ who: 'narr', text: '🎂 이번 달 생일자: 없음' }]);
          },
        });
        opts.push({
          label: '🍱 이번 주 식단표', hint: '',
          onSelect: () => show([{ who: 'narr', text: '월 제육볶음 · 화 카레 · 수 닭갈비 · 목 짜장 · 금 돈가스 · 토 라면 · 일 김치찌개' }, { who: 'me', text: '(금요일 돈가스… 버틸 이유가 생겼다.)' }]),
        });
        opts.push({
          label: '📢 부대 공지', hint: '',
          onSelect: () => show([
            { who: 'narr', text: '포상휴가: 특등사수 · 우수 근무자 · 모범 분대' },
            { who: 'narr', text: '마음의 편지 상시 접수 · 국방헬프콜 ☎1303 (24시간)' },
            { who: 'narr', text: `※ ${STORE_NAME[st.branch]} 앞 트럭 밑에서 "뮤"를 봤다는 소문은 사실무근임. 트럭을 밀지 말 것.` },
          ], '부조리나 고민은 마음의 편지, 국방헬프콜(1303)로 언제든 알릴 수 있다.'),
        });
        break;
      }
      case 'maint': {
        title = '🔧 정비실';
        act('공구 정리', free ? '20분 · 숙련+2 (1일 1회)' : '개인정비·점심 시간에만', 20, { skill: 2 }, '스패너·드라이버·몽키를 공구함 번호에 맞춰 정리하고 공구 대장에 서명했다.', 'maint', !free);
        break;
      }
      case 'kitchen': {
        title = '🍳 조리실';
        act('취사 지원 (설거지)', free ? '30분 · 군기+2 체력-4 (1일 1회)' : '개인정비·점심 시간에만', 30, { discipline: 2, hp: -4 }, '대형 식판 세척기 앞에서 땀을 뻘뻘 흘렸다. 조리병들의 고생을 조금은 알 것 같다.', 'kitchen', !free);
        break;
      }
      case 'court': {
        title = '🏀 농구장';
        act('농구 한 판', free ? '30분 · 멘탈+8 체력-6 (1일 1회)' : '개인정비·점심 시간에만', 30, { hp: -6, mental: 8 }, '쉬는 시간에 모인 병사들과 3대3 농구를 했다. 슛이 들어갈 때마다 환호성이 터진다!', 'court', !free);
        break;
      }
      case 'recycle': {
        title = '♻️ 분리수거장';
        act('생활관 쓰레기 분리수거', '15분 · 군기+2 (1일 1회)', 15, { discipline: 2 }, '페트병은 라벨을 떼고, 캔은 찌그러뜨리고, 음식물은 물기를 빼서. 분리수거도 군기다.', 'recycle');
        break;
      }
      case 'ammo': {
        const fac = FACILITY_NAME[st.branch];
        title = `🔒 ${fac}`;
        const lines: { who: 'narr' | 'me'; text: string }[] = st.branch === 'army'
          ? [{ who: 'narr', text: '탄약고 — 관계자 외 출입 금지. 출입은 반드시 2인 1조, 탄약 수불 대장에 기록한다.' }, { who: 'narr', text: '울타리 안쪽에서 군견이 귀를 쫑긋 세우고 있다.' }, { who: 'me', text: '(밀덕 유튜브에서 본 그 탄약고 근무… 겨울엔 진짜 춥다던데.)' }]
          : st.branch === 'air'
            ? [{ who: 'narr', text: '격납고 — 항공기 정비 구역. 허가된 인원만 출입, FOD 주의!' }, { who: 'narr', text: '안쪽에서 전투기 정비 소리가 웅웅 울린다.' }, { who: 'me', text: '(실물 전투기를 이렇게 가까이서 보다니…!)' }]
            : [{ who: 'narr', text: '함정 부두 — 함정에 오를 땐 현문 당직에게 경례하고 신분을 밝힌다.' }, { who: 'narr', text: 'PKG-999가 출항 준비로 분주하다.' }, { who: 'me', text: '(현문 경례… 유튜브에서 수십 번 돌려 본 장면이다.)' }];
        opts.push({ label: '주변 살펴보기', hint: '5분', onSelect: () => { useGame.getState().spend(5); setOverlay({ type: 'dialogue', script: { lines } }); } });
        break;
      }
      case 'post': {
        title = '🛡️ 위병소 초소';
        if (!q) opts.push({ label: '근무자가 경계 근무 중이다.', disabled: true, onSelect: () => {} });
        break;
      }
      default:
        return;
    }
    opts.push({ label: '닫기', onSelect: () => setOverlay(null) });
    setOverlay({ type: 'menu', title, options: opts });
  }, [setOverlay]);

  const openExtra = useCallback((id: string) => {
    const def = extraDefs.find((d) => d.id === id);
    if (!def) return;
    const st = useGame.getState();
    const ex = extras.current[id];
    const storyOn = st.clues.length > 0;
    if (id === 'librarian' && !(ex && extraAsleep(id, ex, st.minute))) {
      const lspeaker = { name: `${def.name} 상병`, sub: '도서관 관리병', look: extraLook(def), cap: BRANCHES[st.branch].cap as CapType };
      if (storyOn && !st.clues.includes('C-08')) {
        useGame.getState().spend(10);
        setOverlay({
          type: 'dialogue',
          script: { custom: lspeaker, lines: [
            { who: 'npc', text: '……' },
            { who: 'me', text: '저기, 책 좀 빌리려고 하는데요.' },
            { who: 'npc', text: '…책은 읽는 사람을 고른다.' },
            { who: 'narr', text: '(네이티오가 창밖의 해를 바라본 채, 날개로 서가 구석을 가리킨다.)' },
            { who: 'narr', text: '(먼지 쌓인 낡은 책 「별똥별 부대사」. 첫 장만 읽힌다.)' },
            { who: 'narr', text: '『천 년에 한 번 별이 깨어날 때, 소원은 부대가 된다.』' },
            { who: 'narr', text: '(나머지 페이지는 물에 젖어 붙어 있다.)' },
            { who: 'npc', text: '젖은 페이지는 마르기를 기다려라. …이틀이면 된다.' },
          ] },
          onDone: () => useGame.getState().findClue('C-08'),
        });
        return;
      }
      // 하루 한 번 수수께끼 힌트
      const nextM = storyOn ? STORY_MISSIONS.find((m) => missionState(m, st) === 'open') : null;
      const riddle = !nextM ? '…다음 장은 아직 쓰이지 않았다. 해가 몇 번 더 떠야 한다.'
        : nextM.id === 'M-02' ? '…물은 얼굴을 비춘다. 거울은 거짓말을 못 하지.'
          : nextM.id === 'M-03' ? '…이름은 벽에 붙어 있다. 생일을 세는 곳에.'
            : nextM.id === 'N-01' ? '…안개는 밤에 더 짙다. 정문을 두려워하지 마라.'
              : def.lines[Math.floor(Math.random() * def.lines.length)];
      useGame.getState().spend(5);
      setOverlay({ type: 'dialogue', script: { custom: lspeaker, lines: [{ who: 'npc', text: riddle }] } });
      return;
    }
    if (id === 'guard' && storyOn && st.day >= 4 && !st.clues.includes('C-04')) {
      const gspeaker = { name: `${def.name} ${def.title.split(' ').pop()}`, sub: def.title.split(' ').slice(0, -1).join(' '), look: extraLook(def), cap: BRANCHES[st.branch].cap as CapType };
      setOverlay({ type: 'dialogue', script: { custom: gspeaker, lines: [{ who: 'npc', text: '어젯밤 정문 쪽 안개 봤냐? …아직도 좀 남아 있더라. 기분 이상하게.' }] } });
      return;
    }
    if (ex && extraAsleep(id, ex, st.minute)) {
      setOverlay({ type: 'dialogue', script: { lines: [{ who: 'narr', text: id === 'dog' ? '(군견이 몸을 말고 새근새근 자고 있다.)' : '(곤히 자고 있다… 깨우지 말자.)' }] } });
      return;
    }
    const words = def.title.split(' ');
    const speaker = {
      name: `${def.name} ${words[words.length - 1]}`,
      sub: words.length > 1 ? words.slice(0, -1).join(' ') : def.title,
      look: extraLook(def),
      cap: (def.noCap ? null : def.officer ? `officer-${BRANCHES[st.branch].cap}` : BRANCHES[st.branch].cap) as CapType,
    };
    const say = () => {
      useGame.getState().spend(5);
      const line = def.lines[Math.floor(Math.random() * def.lines.length)];
      setOverlay({ type: 'dialogue', script: { custom: speaker, lines: [{ who: 'npc', text: line }] } });
    };
    const mcE = st.mealCheck;
    const xkey = `x:${def.id}`;
    if (mcE && mcE.status === 'asking' && mcE.targets.includes(xkey) && !mcE.asked.includes(xkey)) {
      setOverlay({
        type: 'menu',
        title: `${def.name} ${def.title}`,
        options: [
          {
            label: '🍚 "식사하러 가시겠습니까?"', hint: `식사 집합 ${mcE.asked.length}/${mcE.targets.length}`,
            onSelect: () => {
              useGame.getState().spend(2);
              setOverlay({
                type: 'dialogue',
                script: { custom: speaker, lines: [
                  { who: 'me', text: `{S}! ${speaker.name}님, 식사하러 가시겠습니까?` },
                  { who: 'npc', text: '오, 챙겨 주는 거냐? 좋아, 막사 앞에서 기다린다.' },
                ] },
                onDone: () => useGame.getState().askMeal(xkey),
              });
            },
          },
          { label: '이야기하기', hint: '5분', onSelect: say },
          { label: '그만두기', onSelect: () => setOverlay(null) },
        ],
      });
      return;
    }
    if (!def.daily) { say(); return; }
    const daily = def.daily;
    const key = `extra_${def.id}`;
    const used = st.daily.includes(key);
    setOverlay({
      type: 'menu',
      title: `${def.name} ${def.title}`,
      options: [
        { label: '이야기하기', hint: '5분', onSelect: say },
        {
          label: daily.label, hint: used ? '오늘은 이미 했다' : daily.hint, disabled: used,
          onSelect: () => {
            const s2 = useGame.getState();
            s2.markDaily(key);
            s2.spend(10);
            s2.applyEffects(daily.effects, daily.label);
            s2.log(`🩺 ${def.name}: ${daily.label}`);
            setOverlay({ type: 'dialogue', script: { custom: speaker, lines: [{ who: 'narr', text: daily.text }] } });
          },
        },
        { label: '그만두기', onSelect: () => setOverlay(null) },
      ],
    });
  }, [extraDefs, setOverlay]);

  /** 내 자리에 앉아서 먹기 시작 (실시간으로 먹는다 · Space로 빨리) */
  const sitToEat = useCallback(() => {
    const st = useGame.getState();
    if (!myMeal.tray || myMeal.eating) return;
    const p = runtime.player;
    p.x = MY_MEAL_SEAT[0] + 0.5; p.y = MY_MEAL_SEAT[1] + 0.5; p.dir = 'down'; p.moving = false;
    keys.current = {};
    myMeal.eating = { meal: myMeal.tray, prog: 0, last: st.minute, start: st.minute, pace: null, bite: 0 };
    st.markDaily(`meal_${myMeal.tray}`);
    st.toast('🍚 자리에 앉았다. 잘 먹겠습니다! (Space: 빨리 먹기)', 'info');
  }, []);

  const interact = useCallback(() => {
    const it = promptRef.current ?? findInteractable();
    if (!it) return;
    if (it.kind === 'event') { useGame.getState().beginEvent(); return; }
    if (it.kind === 'seat') { sitToEat(); return; }
    if (it.kind === 'duty') { nightActRef.current(it.key); return; }
    if (it.kind === 'extra' && it.extra) { openExtra(it.extra); return; }
    if (it.kind === 'npc' && it.npc) openNpc(it.npc);
    if (it.kind === 'spot' && it.spot) openSpot(it.spot);
  }, [findInteractable, openNpc, openSpot, openExtra, sitToEat]);

  // 키 입력
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (overlayRef.current || useGame.getState().rollcall) return;
      if (useGame.getState().nightDuty?.phase === 'sleep') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') { e.preventDefault(); nightWake(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); keys.current = {}; useSettings.getState().openMenu(); return; }
      keys.current[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(e.key.toLowerCase())) e.preventDefault();
      // 🍚 먹는 중: Space/E 연타로 빨리 먹기 (선임 속도 맞추기)
      if (myMeal.eating && (e.key === ' ' || e.key === 'e' || e.key === 'E' || e.key === 'Enter')) {
        if (!e.repeat) { myMeal.eating.prog = Math.min(1, myMeal.eating.prog + 0.03); myMeal.eating.bite = performance.now(); }
        return;
      }
      if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') interact();
      if (e.key === 'Tab') setOverlay({ type: 'notebook' });
      if (e.key === 'q' || e.key === 'Q') setOverlay({ type: 'quests' });
      if (e.key === 'm' || e.key === 'M') setOverlay({ type: 'map' });
      if (e.key === 'r' || e.key === 'R') goHome();
      if (e.key === 'f' || e.key === 'F') setFast((v) => !v);
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        const st = useSettings.getState();
        st.set('mapZoom', clampMapZoom(st.mapZoom * (e.key === '-' || e.key === '_' ? 1 / 1.1 : 1.1)));
      }
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    const blur = () => { keys.current = {}; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [interact, setOverlay, goHome, nightWake]);

  // 메인 루프
  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    let w = 0, h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    // 마우스 휠로 확대/축소 (설정에 저장, 화면에는 부드럽게 반영)
    let shownZoom = 0;
    const onWheel = (e: WheelEvent) => {
      if (overlayRef.current || useSettings.getState().open) return;
      e.preventDefault();
      const cur = useSettings.getState().mapZoom;
      const next = clampMapZoom(cur * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      if (next !== cur) useSettings.getState().set('mapZoom', next);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // NPC 경로 설정: 같은 맵이면 바로, 다른 맵이면 문을 거쳐서 (야외가 허브)
    const route = (n: NpcRt, target: Pos) => {
      const [tm, tx, ty] = target;
      n.targetKey = `${tm}:${tx},${ty}`;
      const map = world.maps[n.map];
      if (n.map === tm) {
        n.viaDoor = null;
        n.path = findPath(map, Math.floor(n.x), Math.floor(n.y), tx, ty).slice(1);
        return;
      }
      const door = doorToward(world, n.map, tm);
      if (!door) return;
      n.viaDoor = door;
      const [dx, dy] = door.tiles[0];
      n.path = findPath(map, Math.floor(n.x), Math.floor(n.y), dx, dy).slice(1);
    };

    // NPC 초기 배치 (목표 위치에 바로)
    for (const id of presentNpcs(useGame.getState().day)) {
      const [tm, tx, ty] = npcTarget(id);
      npcs.current[id] = { map: tm, x: tx + 0.5, y: ty + 0.5, dir: 'down', moving: false, path: [], targetKey: `${tm}:${tx},${ty}`, viaDoor: null };
    }

    // 문 전환 페이드: 0 → 1(검정) 사이 맵 교체 → 0
    let fade = 0;
    let fading: { door: Door; phase: 'out' | 'in' } | null = null;
    let doorCooldown = 0;
    // 문을 지나온 직후엔 키를 떼거나 한 칸 이상 벗어나야 다음 문이 동작 (계단 왕복 방지)
    let doorArmed = true;
    let arrivedAt = { x: 0, y: 0 };
    let shownMap: MapId = runtime.player.map;
    setLocation(shownMap);

    let npcRetarget = 0;
    let offerT = 0;
    let offerGivers = new Set<string>();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const st = useGame.getState();
      const p = runtime.player;
      const blocked = !!overlayRef.current || !!st.rollcall || useSettings.getState().open || st.nightDuty?.phase === 'sleep';
      const map = world.maps[p.map];

      // 📖 안개 정문: 정문 밖(맨 아래 줄)으로 나가려 하면
      if (p.map === 'depot' && p.y > 28.6 && !blocked && !fading && fogActive(st)) fogEventRef.current();

      // 생활관 바로 가기 요청 → 문 이동처럼 페이드
      if (warpReq.current && !fading) { fading = { door: warpReq.current, phase: 'out' }; warpReq.current = null; }

      // 문 전환 진행
      if (fading) {
        if (fading.phase === 'out') {
          fade = Math.min(1, fade + dt * 6);
          if (fade >= 1) {
            const d = fading.door;
            p.map = d.to; p.x = d.arrive.x; p.y = d.arrive.y; p.dir = d.arrive.dir;
            fading.phase = 'in';
            doorCooldown = 0.4;
            doorArmed = false;
            arrivedAt = { x: p.x, y: p.y };
          }
        } else {
          fade = Math.max(0, fade - dt * 5);
          if (fade <= 0) fading = null;
        }
      }
      doorCooldown = Math.max(0, doorCooldown - dt);
      // 문 이동·지각 순간이동 등으로 맵이 바뀌면 위치 표시 갱신
      if (p.map !== shownMap) { shownMap = p.map; setLocation(p.map); }

      // 플레이어 이동
      let vx = 0, vy = 0;
      if (!blocked && !fading && !myMeal.eating) {
        const k = keys.current;
        if (k['arrowleft'] || k['a']) vx -= 1;
        if (k['arrowright'] || k['d']) vx += 1;
        if (k['arrowup'] || k['w']) vy -= 1;
        if (k['arrowdown'] || k['s']) vy += 1;
      }
      // 🏃 Shift를 누른 채 이동하면 달리기 (기력 게이지 소모, 체력 25 미만이면 회복이 느리다)
      const sta = stamina.current;
      const dashing = !!keys.current['shift'] && !!(vx || vy) && !sta.lock && sta.v > 0;
      if (dashing) {
        sta.v = Math.max(0, sta.v - dt / DASH_DRAIN_SEC);
        sta.idle = 0;
        if (sta.v <= 0) sta.lock = true;
      } else {
        sta.idle += dt;
        if (sta.idle > 0.5) sta.v = Math.min(1, sta.v + dt / (st.stats.hp < 25 ? DASH_REGEN_SEC * 2 : DASH_REGEN_SEC));
        if (sta.lock && sta.v >= 0.35) sta.lock = false;
      }
      sta.dashing = dashing;
      const speed = dashing ? DASH_SPEED : WALK_SPEED;
      if (vx || vy) {
        const len = Math.hypot(vx, vy);
        const nx = p.x + (vx / len) * speed * dt;
        const ny = p.y + (vy / len) * speed * dt;
        if (!collides(map, nx, p.y)) p.x = nx;
        if (!collides(map, p.x, ny)) p.y = ny;
        p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
        p.moving = true;
      } else p.moving = false;

      // 문으로 걸어 들어가면 다른 맵으로
      if (!doorArmed && (!p.moving || Math.hypot(p.x - arrivedAt.x, p.y - arrivedAt.y) > 1.2)) doorArmed = true;
      if (!fading && !blocked && doorArmed && doorCooldown <= 0 && p.moving) {
        for (const d of map.doors) {
          if (p.dir !== d.enterDir) continue;
          const hit = d.tiles.some(([tx, ty]) => Math.abs(p.x - (tx + 0.5)) < 0.9 && Math.abs(p.y - (ty + 0.5)) < 1.0);
          if (hit) {
            if (d.to === 'room2' && rankIdxForDay(st.day) < 2) { askEnterRef.current(d); break; }
            fading = { door: d, phase: 'out' };
            break;
          }
        }
      }

      // 🔦 야간 순찰: 점검 장소에 다가가면 자동으로 점검
      if (st.patrol && !blocked && !fading) {
        for (const sid of PATROL_SPOTS) {
          if (st.patrol.done.includes(sid)) continue;
          const sp = world.spots[sid];
          if (sp.map === p.map && Math.hypot(p.x - (sp.x + 0.5), p.y - (sp.y + 0.5)) < 1.8) { st.patrolCheck(sid); break; }
        }
      }

      offerT -= dt;
      if (offerT <= 0) { offerT = 0.5; offerGivers = new Set(questOffers(st).filter((o) => o.open).map((o) => o.giver)); }

      // NPC 갱신
      npcRetarget -= dt;
      const present = visibleNpcs(st.day, st.minute);
      if (npcRetarget <= 0 && !cer.current) {
        npcRetarget = 0.5;
        for (const id of present) {
          let n = npcs.current[id];
          const target = npcTarget(id);
          const key = `${target[0]}:${target[1]},${target[2]}`;
          if (!n) {
            n = npcs.current[id] = { map: target[0], x: target[1] + 0.5, y: target[2] + 0.5, dir: 'down', moving: false, path: [], targetKey: key, viaDoor: null };
            continue;
          }
          if (n.targetKey !== key) route(n, target);
        }
        for (const id of Object.keys(npcs.current) as NpcId[]) if (!present.includes(id)) delete npcs.current[id];
      }
      // 퀘스트 창·지도용: NPC 현재 위치와 목적지 맵
      runtime.npcLoc = {};
      for (const id of present) {
        const n = npcs.current[id];
        if (!n) continue;
        const tm = n.targetKey.includes(":") ? (n.targetKey.split(":")[0] as MapId) : n.map;
        runtime.npcLoc[id] = { map: n.map, dest: world.maps[tm] ? tm : n.map };
      }
      for (const id of present) {
        const n = npcs.current[id];
        if (!n) continue;
        const follow = followsMe(id, st);
        if (follow && n.map === p.map && Math.hypot(p.x - n.x, p.y - n.y) < 1.4) { n.path = []; n.viaDoor = null; }
        if (n.path.length && !blocked) {
          const [px, py] = n.path[0];
          const gx = px + 0.5, gy = py + 0.5;
          const dx = gx - n.x, dy = gy - n.y;
          const d = Math.hypot(dx, dy);
          // 식사하러 줄지어 갈 땐 조금 빠른 걸음
          const sp = (follow ? 5.6 : isMealTime(st.minute) && SQUAD_KEYS.includes(id) ? 5 : 4) * dt;
          if (d <= sp) { n.x = gx; n.y = gy; n.path.shift(); }
          else { n.x += (dx / d) * sp; n.y += (dy / d) * sp; }
          n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          n.moving = true;
        } else if (n.viaDoor && !blocked) {
          // 문에 도착 → 다음 맵으로 넘어가서 다시 경로 설정
          const d = n.viaDoor;
          n.map = d.to; n.x = d.arrive.x; n.y = d.arrive.y; n.dir = d.arrive.dir;
          n.viaDoor = null;
          route(n, npcTarget(id));
        } else {
          n.moving = false;
          // 소등 후: 자기 침상 앞 통로에 도착하면 그대로 눕는다
          const bx = BED_X[id];
          if (st.minute >= LIGHTS_OUT && bx !== undefined && !cer.current && n.map === 'room1' && Math.abs(n.x - (bx + 0.5)) < 0.6 && n.y > 3.5 && n.y < 4.9) {
            n.x = bx + 0.5; n.y = bedY('top'); n.dir = 'down';
          }
          if (n.map === p.map && !cer.current && !npcAsleep(id, n, st.minute)) {
            const dd = Math.hypot(p.x - n.x, p.y - n.y);
            if (dd < 2.5) n.dir = Math.abs(p.x - n.x) > Math.abs(p.y - n.y) ? (p.x > n.x ? 'right' : 'left') : p.y > n.y ? 'down' : 'up';
          }
        }
      }

      // 엑스트라: 정해진 길을 돌거나 집 주변을 어슬렁거린다
      for (const def of extraDefs) {
        let e = extras.current[def.id];
        if (!e) {
          // 야간 근무 중(미니게임 뒤 등)이면 맡은 자리에서 시작
          const ng0 = nightGoal(`x:${def.id}`, st);
          const [im, ix, iy] = ng0 ?? [def.map, def.x, def.y];
          e = extras.current[def.id] = { map: im, x: ix + 0.5, y: iy + 0.5, dir: 'down', moving: false, path: [], targetKey: '', viaDoor: null, wait: Math.random() * 2, routeIdx: 0 };
        }
        if (blocked) { e.moving = false; continue; }
        // 소등 후: 침상이 있으면 가서 눕고, 근무자·군견은 제자리, 나머지는 자기 부대 막사로(안 보임)
        if (st.minute >= LIGHTS_OUT && !cer.current) {
          const bed = EXTRA_BED[def.id];
          const xk = `x:${def.id}`;
          const duty = nightGoal(xk, st);
          if (!duty) {
            if (!bed && !NIGHT_STAY.has(def.id)) { e.moving = false; continue; }
            if (bed && e.map === bed[0] && Math.abs(e.y - bedY(bed[2])) < 0.05) { e.moving = false; continue; }
          }
          const ns = NIGHT_SPOT[def.id];
          const goalN: Pos | null = duty ?? (bed ? [bed[0], bed[1], aisleY(bed[2])] : ns ?? (e.map !== def.map ? [def.map, def.x, def.y] : null));
          if (!goalN) { e.moving = false; e.path = []; continue; }
          const gk = `${goalN[0]}:${goalN[1]},${goalN[2]}`;
          const follow = followsMe(xk, st);
          if (follow && e.map === p.map && Math.hypot(p.x - e.x, p.y - e.y) < 1.4) { e.path = []; e.viaDoor = null; e.moving = false; e.targetKey = gk; continue; }
          if (e.targetKey !== gk && (!follow || npcRetarget >= 0.45)) route(e, goalN);
          if (e.path.length) {
            const [px, py] = e.path[0];
            const gx = px + 0.5, gy = py + 0.5;
            const dx = gx - e.x, dy = gy - e.y;
            const d = Math.hypot(dx, dy);
            const sp = (follow ? 5.6 : 3) * dt;
            if (d <= sp) { e.x = gx; e.y = gy; e.path.shift(); } else { e.x += (dx / d) * sp; e.y += (dy / d) * sp; }
            e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
            e.moving = true;
          } else if (e.viaDoor) {
            const dd = e.viaDoor;
            e.map = dd.to; e.x = dd.arrive.x; e.y = dd.arrive.y; e.dir = dd.arrive.dir;
            e.viaDoor = null;
            route(e, goalN);
          } else {
            e.moving = false;
            if (!duty && bed && e.map === bed[0]) { e.x = bed[1] + 0.5; e.y = bedY(bed[2]); e.dir = 'down'; }
          }
          continue;
        }
        // 식사 시간엔 식당 자리로, 끝나면 자기 자리로 (다른 맵이면 문을 거쳐서)
        const seat = EXTRA_MEAL_SEAT[def.id];
        const xkey = `x:${def.id}`;
        const mg = isMealTime(st.minute) && seat ? mealGoal(xkey, ['mess', seat[0], seat[1]], st) : 'free';
        const home: Pos | null = e.map !== def.map || e.targetKey.startsWith('mess:') || GATHER_KEYS.has(e.targetKey) ? [def.map, def.x, def.y] : null;
        const goal: Pos | null = mg !== 'free' ? mg : home;
        if (goal) {
          const gk = `${goal[0]}:${goal[1]},${goal[2]}`;
          if (e.targetKey !== gk) route(e, goal);
          if (e.path.length) {
            const [px, py] = e.path[0];
            const gx = px + 0.5, gy = py + 0.5;
            const dx = gx - e.x, dy = gy - e.y;
            const d = Math.hypot(dx, dy);
            const sp = (SQUAD_KEYS.includes(xkey) ? 5 : 3) * dt;
            if (d <= sp) { e.x = gx; e.y = gy; e.path.shift(); } else { e.x += (dx / d) * sp; e.y += (dy / d) * sp; }
            e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
            e.moving = true;
          } else if (e.viaDoor) {
            const dd = e.viaDoor;
            e.map = dd.to; e.x = dd.arrive.x; e.y = dd.arrive.y; e.dir = dd.arrive.dir;
            e.viaDoor = null;
            route(e, goal);
          } else {
            e.moving = false;
            // 집에 돌아왔으면 평소 행동으로
            if (goal[0] === def.map && e.map === def.map && !isMealTime(st.minute)) e.targetKey = '';
          }
          continue;
        }
        if (e.path.length) {
          const [px, py] = e.path[0];
          const gx = px + 0.5, gy = py + 0.5;
          const dx = gx - e.x, dy = gy - e.y;
          const d = Math.hypot(dx, dy);
          const sp = (def.route ? 3.2 : 2.2) * dt;
          if (d <= sp) { e.x = gx; e.y = gy; e.path.shift(); } else { e.x += (dx / d) * sp; e.y += (dy / d) * sp; }
          e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          e.moving = true;
          continue;
        }
        e.moving = false;
        // 주인공이 가까이 오면 멈춰서 쳐다본다
        if (e.map === p.map && Math.hypot(p.x - e.x, p.y - e.y) < 2.2) {
          e.dir = Math.abs(p.x - e.x) > Math.abs(p.y - e.y) ? (p.x > e.x ? 'right' : 'left') : p.y > e.y ? 'down' : 'up';
          continue;
        }
        e.wait -= dt;
        if (e.wait > 0) continue;
        const em = world.maps[e.map];
        let tx = def.x, ty = def.y;
        if (def.route) {
          e.routeIdx = (e.routeIdx + 1) % def.route.length;
          [tx, ty] = def.route[e.routeIdx];
          e.wait = 0;
        } else if (def.wander) {
          for (let i = 0; i < 6; i++) {
            const cx = def.x + Math.round((Math.random() * 2 - 1) * def.wander);
            const cy = def.y + Math.round((Math.random() * 2 - 1) * def.wander);
            if (!isSolid(em, cx, cy)) { tx = cx; ty = cy; break; }
          }
          e.wait = 2 + Math.random() * 3;
        } else {
          e.wait = 3 + Math.random() * 3;
          e.dir = (['down', 'left', 'right', 'down'] as Dir[])[Math.floor(Math.random() * 4)];
          continue;
        }
        e.path = findPath(em, Math.floor(e.x), Math.floor(e.y), tx, ty).slice(1);
      }

      // 🍚 식사: 자리에 앉은 시각 기록 → 각자 다 먹으면 일어난다
      if (isMealTime(st.minute)) {
        const seated = mealSeated(st.day, st.minute);
        for (const id of present) {
          const n = npcs.current[id];
          if (n && seated[id] === undefined && eatingAt(n.map, n.x, n.y, MEAL_POS[id], st.minute)) seated[id] = st.minute;
        }
        for (const def of extraDefs) {
          const e = extras.current[def.id];
          const k = `x:${def.id}`;
          if (e && seated[k] === undefined && eatingAt(e.map, e.x, e.y, EXTRA_MEAL_SEAT[def.id], st.minute)) seated[k] = st.minute;
        }
      } else if (myMeal.tray && !myMeal.eating) {
        myMeal.tray = '';
        st.toast('🍱 배식 시간이 끝나 식판을 반납했다…', 'bad');
      }
      if (myMeal.eating && !blocked) mealTickRef.current();

      // 상호작용 프롬프트
      const it = blocked || fading ? null : findInteractable();
      if ((it?.key ?? null) !== (promptRef.current?.key ?? null)) {
        promptRef.current = it;
        setPrompt(it);
      }

      // ── 그리기 ──
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = map.indoor ? '#14110e' : '#2a2a2a';
      g.fillRect(0, 0, w, h);
      const mw = map.w * TILE, mh = map.h * TILE;
      // 실내는 화면에 맞게 확대
      // 기본: 화면에 가로 약 20타일·세로 약 12.5타일이 보이도록 확대 (카메라는 주인공을 따라간다)
      // 여기에 마우스 휠로 조절한 배율(설정의 mapZoom)을 곱하고, 바뀔 땐 부드럽게 따라간다
      const baseZoom = Math.max(1.1, Math.min(2.2, Math.min(w / (20 * TILE), h / (12.5 * TILE))));
      const targetZoom = baseZoom * useSettings.getState().mapZoom;
      shownZoom = shownZoom === 0 ? targetZoom : shownZoom + (targetZoom - shownZoom) * Math.min(1, dt * 12);
      const zoom = shownZoom;
      g.imageSmoothingEnabled = false; // 확대해도 도트 느낌 유지
      const vw = w / zoom, vh = h / zoom;
      let camX = p.x * TILE - vw / 2;
      let camY = p.y * TILE - vh / 2;
      camX = Math.max(0, Math.min(mw - vw, camX));
      camY = Math.max(0, Math.min(mh - vh, camY));
      if (mw < vw) camX = (mw - vw) / 2;
      if (mh < vh) camY = (mh - vh) / 2;
      g.save();
      g.scale(zoom, zoom);
      g.translate(-Math.round(camX), -Math.round(camY));
      const mc = mapCanvasRef.current[p.map];
      if (mc) {
        if (map.indoor) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(6, 10, mw, mh); }
        g.drawImage(mc, 0, 0);
      }

      // 라벨
      g.font = 'bold 13px "Galmuri11", sans-serif';
      g.textAlign = 'center';
      for (const lb of map.labels) {
        const tw = g.measureText(lb.text).width + 12;
        g.fillStyle = 'rgba(40,30,20,0.75)';
        g.fillRect(lb.x * TILE - tw / 2, lb.y * TILE - 11, tw, 18);
        g.fillStyle = '#fff6dc';
        g.fillText(lb.text, lb.x * TILE, lb.y * TILE + 3);
      }

      // 다른 맵에 있는 목표는 그쪽으로 가는 문을 가리킨다
      const guide = (tm: MapId, x: number, y: number): { x: number; y: number; viaDoor: boolean } | null => {
        if (tm === p.map) return { x, y, viaDoor: false };
        const d = doorToward(world, p.map, tm);
        if (!d) return null;
        const c = doorCenter(d);
        return { x: c.x, y: c.y + (map.indoor ? 0 : 0.3), viaDoor: true };
      };

      // 목표 지점 표시
      const ev = st.currentEvent();
      let target: { x: number; y: number; viaDoor: boolean } | null = null;
      if (ev && !st.eventBegun && ev.spot && (st.minute >= ev.start || ev.kind === 'farewell')) {
        const sp = world.spots[ev.spot];
        target = guide(sp.map, sp.x + 0.5, sp.y + 0.5);
      }
      const qTargets: { x: number; y: number }[] = [];
      for (const q of st.quests) {
        const step = (QUEST_STEPS[q.id] ?? [])[q.step];
        if (!step) continue;
        if (step.spot) {
          const sp = world.spots[step.spot];
          const gd = guide(sp.map, sp.x + 0.5, sp.y + 0.5);
          if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
        if (step.npc && npcs.current[step.npc]) {
          const n = npcs.current[step.npc]!;
          const gd = guide(n.map, n.x, n.y - 1.3);
          if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
      }
      if (st.patrol) {
        const left = PATROL_SPOTS.filter((sid) => !st.patrol!.done.includes(sid));
        for (const sid of left.length ? left : (['command'] as SpotId[])) {
          const sp = world.spots[sid];
          const gd = guide(sp.map, sp.x + 0.5, sp.y + 0.5);
          if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
      }
      const ndm = st.nightDuty;
      if (ndm && ndm.phase !== 'sleep' && ndm.phase !== 'woken' && ndm.phase !== 'shift') {
        let tg: { m: MapId; x: number; y: number } | null = null;
        if (ndm.phase === 'toPost') { const sp = world.spots.post; tg = { m: sp.map, x: sp.x + 0.5, y: sp.y + 0.5 }; }
        if (ndm.phase === 'wakeNext') { const n = entityOf(ndm.next); if (n) tg = { m: n.map, x: n.x, y: n.y - 0.8 }; }
        if (ndm.phase === 'return') { const bd = world.spots.bed; tg = { m: bd.map, x: bd.x + 0.5, y: bd.y + 0.5 }; }
        const gd = tg && guide(tg.m, tg.x, tg.y);
        if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
      }
      if (st.mealCheck?.status === 'asking') {
        for (const id of st.mealCheck.targets) {
          const n = id.startsWith('x:') ? extras.current[id.slice(2)] : npcs.current[id as NpcId];
          if (!n || st.mealCheck.asked.includes(id)) continue;
          const gd = guide(n.map, n.x, n.y - 1.3);
          if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
      }
      if (isMealTime(st.minute) && st.day < TOTAL_DAYS) {
        const mealKey = st.minute < 15 * 60 ? 'meal_lunch' : 'meal_dinner';
        const mcg = st.mealCheck;
        if (!st.daily.includes(mealKey)) {
          // 막사 앞에 모이는 중이면 집합 자리 → 출발하면 배식대 → 식판을 받았으면 내 자리
          const gp = mcg && mcg.status !== 'asking' && mcg.marchAt != null && st.minute < mcg.marchAt ? MEAL_GATHER.buddy : null;
          const [gm, gx, gy]: Pos = gp ?? (myMeal.tray ? ['mess', MY_MEAL_SEAT[0], MY_MEAL_SEAT[1]] : [world.spots.mess.map, world.spots.mess.x, world.spots.mess.y]);
          const gd = guide(gm, gx + 0.5, gy + 0.5);
          if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
      }
      const storyTargets: { x: number; y: number }[] = [];
      if (st.clues.length > 0) {
        for (const m of STORY_MISSIONS) {
          if (!m.spot || missionState(m, st) !== 'open') continue;
          const lib = m.id === 'M-04' ? extras.current.librarian : null;
          const sp = world.spots[m.spot];
          const gd = lib ? guide(lib.map, lib.x, lib.y - 1.3) : guide(sp.map, sp.x + 0.5, sp.y + 0.5);
          if (gd) storyTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
      }
      for (const st2 of storyTargets) {
        g.font = 'bold 18px sans-serif';
        g.globalAlpha = 0.65 + Math.sin(t * 5) * 0.35;
        g.fillText('✨', st2.x * TILE, st2.y * TILE - 6 + Math.sin(t * 3) * 3);
        g.globalAlpha = 1;
      }
      for (const qt of qTargets) {
        g.fillStyle = '#f2c230';
        g.font = 'bold 18px sans-serif';
        g.fillText('❗', qt.x * TILE, qt.y * TILE - 6 + Math.sin(t * 4) * 3);
      }
      if (target) {
        const pulse = (Math.sin(t * 5) + 1) / 2;
        const r0 = target.viaDoor ? 18 : 26;
        g.strokeStyle = `rgba(255,80,60,${0.5 + pulse * 0.5})`;
        g.lineWidth = 3;
        g.beginPath(); g.arc(target.x * TILE, target.y * TILE, r0 + pulse * 10, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(255,80,60,0.18)';
        g.beginPath(); g.arc(target.x * TILE, target.y * TILE, r0, 0, Math.PI * 2); g.fill();
      }

      // 점호 연출: 걸어가는 배우, 국기, 동작/말풍선
      const cerC = cer.current;
      if (cerC) {
        for (const mv of cerC.moves) {
          const k = Math.min(1, (t - mv.t0) / mv.dur);
          mv.a.x = mv.fx + (mv.tx - mv.fx) * k;
          mv.a.y = mv.fy + (mv.ty - mv.fy) * k;
          mv.a.moving = k < 1;
          if (k < 1) {
            const dx = mv.tx - mv.fx, dy = mv.ty - mv.fy;
            mv.a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          } else mv.a.dir = mv.endDir;
        }
        cerC.moves = cerC.moves.filter((mv) => t - mv.t0 < mv.dur);
        if (cerC.kind === 'am' && p.map === 'outdoor') {
          // 구령대 옆 국기 게양대
          const fx0 = 24.2 * TILE, fy0 = 17.9 * TILE;
          g.fillStyle = '#d8d8d8'; g.fillRect(fx0 - 1, fy0 - 70, 3, 70);
          g.fillStyle = '#f0c040'; g.fillRect(fx0 - 2, fy0 - 73, 5, 4);
          const wave = Math.sin(t * 3) * 1.5;
          g.fillStyle = '#ffffff'; g.fillRect(fx0 + 2, fy0 - 68 + wave, 24, 16);
          g.fillStyle = '#d03040'; g.fillRect(fx0 + 10, fy0 - 64 + wave, 8, 4);
          g.fillStyle = '#2050a0'; g.fillRect(fx0 + 10, fy0 - 60 + wave, 8, 4);
          g.fillStyle = '#202020';
          for (const [ax, ay] of [[4, 2], [21, 2], [4, 11], [21, 11]]) g.fillRect(fx0 + ax, fy0 - 68 + ay + wave, 2, 3);
        }
      }
      for (const def of extraDefs) {
        const e = extras.current[def.id];
        if (!e || extraHiddenAtNight(def.id, st.minute)) continue;
        const tm = e.targetKey.includes(':') ? (e.targetKey.split(':')[0] as MapId) : e.map;
        runtime.npcLoc[`x:${def.id}`] = { map: e.map, dest: world.maps[tm] ? tm : e.map };
      }
      const bubbles: { x: number; y: number; text: string }[] = [];
      const notes: { x: number; y: number; ph: number }[] = [];
      const fxOf = (key: string, dir: Dir, x: number, y: number) => {
        const r = { dy: 0, dir, hop: 0 };
        if (!cerC) return r;
        if (cerC.seated.has(key)) r.dy = 4;
        const mi = cerC.members.indexOf(key);
        if (mi < 0) return r;
        const pt = t - cerC.poseT0;
        if (cerC.pose === 'exercise') {
          const ph = Math.floor(pt * 2.4) % 4;
          r.dir = (['up', 'left', 'up', 'right'] as Dir[])[ph];
          r.hop = ph % 2 === 0 ? 6 : 0;
        } else if (cerC.pose === 'anthem') {
          r.dir = 'up';
          if (mi % 3 === 0) notes.push({ x, y, ph: (pt * 0.6 + mi * 0.37) % 1 });
        } else if (cerC.pose === 'shout' || cerC.pose === 'salute') {
          r.hop = Math.sin(pt * 18 + mi) > 0.3 ? 2 : 0;
        }
        if (cerC.bubble && (cerC.pose === 'salute' || cerC.pose === 'shout')) bubbles.push({ x, y, text: cerC.bubble });
        return r;
      };

      // 식사 중인 자리 앞 식탁에 식판
      if (p.map === 'mess' && isMealTime(st.minute)) {
        const trays: { x: number; y: number; left?: number }[] = [];
        for (const id of present) {
          const n = npcs.current[id];
          const at = n && eatingAt(n.map, n.x, n.y, MEAL_POS[id], st.minute);
          if (at) { trays.push({ x: at.x, y: at.face === 'down' ? at.y + 1 : at.y - 1 }); n!.dir = at.face; }
        }
        for (const def of extraDefs) {
          const e = extras.current[def.id];
          const at = e && eatingAt(e.map, e.x, e.y, EXTRA_MEAL_SEAT[def.id], st.minute);
          if (at) { trays.push({ x: at.x, y: at.face === 'down' ? at.y + 1 : at.y - 1 }); e!.dir = at.face; }
        }
        if (myMeal.eating) trays.push({ x: MY_MEAL_SEAT[0], y: MY_MEAL_SEAT[1] + 1, left: 1 - myMeal.eating.prog });
        for (const tr of trays) drawTray(g, tr.x * TILE + 6, tr.y * TILE + 9, tr.left ?? 1);
      }

      // 엔티티 (y 정렬, 같은 맵만)
      const ents: { y: number; draw: () => void }[] = [];
      for (const id of present) {
        const n = npcs.current[id];
        if (!n || n.map !== p.map) continue;
        const sk = NPC_SKINS[st.branch][id];
        if (npcAsleep(id, n, st.minute)) {
          ents.push({ y: n.y, draw: () => drawSleeper(g, sk.look, n.x, n.y, t + id.length, true) });
          continue;
        }
        ents.push({
          y: n.y,
          draw: () => {
            const chew = eatingAt(n.map, n.x, n.y, MEAL_POS[id], st.minute) ? (Math.sin(t * 7 + id.length) > 0.6 ? 2 : 0) : 0;
            const fx = fxOf(id, n.dir, n.x, n.y);
            drawMonster(g, sk.look, n.x * TILE, n.y * TILE + 12 - chew + fx.dy - fx.hop, 34, { dir: fx.dir, t: t + id.length, walking: n.moving, cap: npcCap(st.branch, id) });
            if (cerC) return; // 점호 중에는 이름표를 숨긴다
            if (eatingAt(n.map, n.x, n.y, MEAL_POS[id], st.minute) && Math.hypot(p.x - n.x, p.y - n.y) > 1.8) return;
            g.font = '11px "Galmuri11", sans-serif';
            const nm = sk.name;
            const tw = g.measureText(nm).width + 8;
            g.fillStyle = NPC_ROLES[id].officer ? 'rgba(60,50,20,0.8)' : 'rgba(20,30,40,0.7)';
            g.fillRect(n.x * TILE - tw / 2, n.y * TILE - 44, tw, 14);
            g.fillStyle = NPC_ROLES[id].officer ? '#ffe08a' : '#ffffff';
            g.fillText(nm, n.x * TILE, n.y * TILE - 33);
            if (offerGivers.has(id)) {
              // 말풍선: 부탁할 게 있다
              const by = n.y * TILE - 66 + Math.sin(t * 3 + id.length) * 2;
              g.fillStyle = '#ffffff'; g.strokeStyle = '#283048'; g.lineWidth = 2;
              g.beginPath(); g.roundRect(n.x * TILE - 13, by, 26, 18, 5); g.fill(); g.stroke();
              g.beginPath(); g.moveTo(n.x * TILE - 4, by + 18); g.lineTo(n.x * TILE, by + 24); g.lineTo(n.x * TILE + 4, by + 18); g.fill();
              g.font = 'bold 12px sans-serif'; g.fillStyle = '#e8a030'; g.fillText('···', n.x * TILE, by + 13);
            }
          },
        });
      }
      for (const def of extraDefs) {
        const e = extras.current[def.id];
        if (!e || e.map !== p.map || extraHiddenAtNight(def.id, st.minute)) continue;
        const elook = extraLook(def);
        if (extraAsleep(def.id, e, st.minute)) {
          ents.push({ y: e.y, draw: () => drawSleeper(g, elook, e.x, e.y, t + def.id.length, def.id !== 'dog') });
          continue;
        }
        const ecap = (def.noCap ? null : def.officer ? `officer-${b.cap}` : b.cap) as CapType;
        ents.push({
          y: e.y,
          draw: () => {
            const chew = eatingAt(e.map, e.x, e.y, EXTRA_MEAL_SEAT[def.id], st.minute) ? (Math.sin(t * 7 + def.id.length) > 0.6 ? 2 : 0) : 0;
            const fx = fxOf('x:' + def.id, e.dir, e.x, e.y);
            drawMonster(g, elook, e.x * TILE, e.y * TILE + 12 - chew + fx.dy - fx.hop, 32, { dir: fx.dir, t: t + def.id.length * 0.7, walking: e.moving, cap: ecap });
            if (cerC) return;
            if (eatingAt(e.map, e.x, e.y, EXTRA_MEAL_SEAT[def.id], st.minute) && Math.hypot(p.x - e.x, p.y - e.y) > 1.8) return;
            g.font = '10px "Galmuri11", sans-serif';
            const tw = g.measureText(def.name).width + 8;
            g.fillStyle = 'rgba(70,74,84,0.72)';
            g.fillRect(e.x * TILE - tw / 2, e.y * TILE - 42, tw, 13);
            g.fillStyle = '#e8ecf2';
            g.fillText(def.name, e.x * TILE, e.y * TILE - 32);
          },
        });
      }
      ents.push({
        y: p.y,
        draw: () => {
          const fx = fxOf('me', p.dir, p.x, p.y);
          drawMonster(g, look, p.x * TILE, p.y * TILE + 12 + fx.dy - fx.hop, 36, { dir: fx.dir, t, walking: p.moving, cap: b.cap });
          if (myMeal.tray && !myMeal.eating) drawTray(g, p.x * TILE - 10, p.y * TILE - (p.dir === 'up' ? 18 : 4), 1);
          const me = myMeal.eating;
          if (me) {
            const bx = p.x * TILE - 34, by0 = p.y * TILE - 70;
            const bar = (y: number, label: string, v: number, col: string) => {
              g.fillStyle = 'rgba(20,22,30,0.82)'; g.fillRect(bx - 2, y - 2, 72, 13);
              g.fillStyle = col; g.fillRect(bx + 22, y + 1, 46 * Math.min(1, v), 7);
              g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'left'; g.fillText(label, bx, y + 8);
            };
            if (me.pace) {
              const leadV = 1 - Math.max(0, me.pace.finish - st.minute) / SQUAD_EAT_MIN;
              bar(by0 - 14, '선임', leadV, '#e86040');
              bar(by0, '나', me.prog, '#58c058');
              g.textAlign = 'center'; g.font = 'bold 10px sans-serif'; g.fillStyle = Math.floor(t * 3) % 2 ? '#ffe14a' : '#ffffff';
              g.fillText('Space 연타! 선임 속도에 맞춰 먹자', p.x * TILE, by0 - 22);
            } else bar(by0, '🍚', me.prog, '#58c058');
            if (performance.now() - me.bite < 250) {
              g.textAlign = 'center'; g.font = 'bold 11px sans-serif'; g.fillStyle = '#fff';
              g.fillText('냠!', p.x * TILE + 16, p.y * TILE - 30);
            }
          }
          const sta2 = stamina.current;
          if (sta2.dashing && Math.floor(t * 14) % 2 === 0) {
            g.fillStyle = 'rgba(200,190,170,0.75)';
            const back = p.dir === 'left' ? 10 : p.dir === 'right' ? -10 : 0;
            g.beginPath(); g.arc(p.x * TILE + back - 5, p.y * TILE + 12, 3, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.arc(p.x * TILE + back + 5, p.y * TILE + 10, 2, 0, Math.PI * 2); g.fill();
          }
          if (sta2.v < 1) {
            const bw = 30, bx = p.x * TILE - bw / 2, by = p.y * TILE + 16;
            g.fillStyle = 'rgba(30,30,40,0.75)'; g.fillRect(bx - 1, by - 1, bw + 2, 6);
            g.fillStyle = sta2.lock ? (Math.floor(t * 6) % 2 ? '#e84838' : '#802018') : sta2.v > 0.5 ? '#58c058' : sta2.v > 0.25 ? '#f0c040' : '#e86030';
            g.fillRect(bx, by, bw * sta2.v, 4);
          }
          const my = p.y * TILE + fx.dy - fx.hop + Math.sin(t * 4) * 2;
          g.fillStyle = '#ffe14a';
          g.beginPath();
          g.moveTo(p.x * TILE - 5, my - 46);
          g.lineTo(p.x * TILE + 5, my - 46);
          g.lineTo(p.x * TILE, my - 39);
          g.fill();
        },
      });
      ents.sort((a, c) => a.y - c.y).forEach((e) => e.draw());
      // ✨ 야간 근무 중 의문의 별빛 (지라치)
      let starGlow: { x: number; y: number } | null = null;
      const ndS = st.nightDuty;
      if (ndS && !st.flags[`star_${st.day}`] && (ndS.kind === 'watch' ? ndS.phase === 'wakeNext' || ndS.phase === 'return' : ndS.phase === 'toPost' || ndS.phase === 'return')) {
        const [sm, sx0, sy0] = STAR_POS[ndS.kind];
        if (p.map === sm) {
          const sx = sx0 * TILE, sy = sy0 * TILE - 18 + Math.sin(t * 1.8) * 5;
          starGlow = { x: sx, y: sy };
          const pulse = 0.7 + Math.sin(t * 3.2) * 0.3;
          const gl = g.createRadialGradient(sx, sy, 0, sx, sy, 46 * pulse + 12);
          gl.addColorStop(0, 'rgba(255,250,200,0.95)'); gl.addColorStop(0.4, 'rgba(255,230,120,0.45)'); gl.addColorStop(1, 'rgba(255,230,120,0)');
          g.fillStyle = gl; g.beginPath(); g.arc(sx, sy, 60, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#fffbe0'; g.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (Math.PI / 5) * i - Math.PI / 2 + t * 0.6, rr = i % 2 === 0 ? 8 : 3.6;
            g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
          }
          g.closePath(); g.fill();
          for (let i = 0; i < 3; i++) {
            const a = t * 1.3 + i * 2.1;
            g.fillStyle = `rgba(255,250,210,${0.5 + 0.5 * Math.sin(t * 4 + i)})`;
            g.fillRect(sx + Math.cos(a) * 18 - 1, sy + Math.sin(a) * 12 - 1, 3, 3);
          }
        }
      }
      // 🌫 위병소 정문 밖 안개
      if (p.map === 'depot' && (st.minute >= 21 * 60 + 30 || fogActive(st))) {
        const fy0 = 25.5 * TILE, fy1 = 30 * TILE;
        const fogG = g.createLinearGradient(0, fy0, 0, fy1);
        fogG.addColorStop(0, 'rgba(236,240,248,0)');
        fogG.addColorStop(0.6, 'rgba(236,240,248,0.55)');
        fogG.addColorStop(1, 'rgba(244,246,252,0.92)');
        g.fillStyle = fogG;
        g.fillRect(6 * TILE, fy0, 18 * TILE, fy1 - fy0);
        for (let i = 0; i < 7; i++) {
          const bx = (8 + ((i * 3.1 + t * 0.35) % 14)) * TILE, by = (27.6 + Math.sin(t * 0.6 + i) * 0.5) * TILE;
          const bg = g.createRadialGradient(bx, by, 0, bx, by, 70);
          bg.addColorStop(0, 'rgba(255,255,255,0.45)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = bg; g.beginPath(); g.arc(bx, by, 70, 0, Math.PI * 2); g.fill();
        }
      }

      // 점호 말풍선 / 애국가 음표 (모든 캐릭터 위에)
      g.textAlign = 'center';
      for (const nt of notes) {
        g.globalAlpha = 1 - nt.ph;
        g.fillStyle = '#3858a8';
        g.font = '14px "Galmuri11", sans-serif';
        g.fillText(nt.ph < 0.5 ? '♪' : '♫', nt.x * TILE + 10, nt.y * TILE - 40 - nt.ph * 24);
      }
      g.globalAlpha = 1;
      for (const bb of bubbles) {
        g.font = '10px "Galmuri11", sans-serif';
        const bw = g.measureText(bb.text).width + 8;
        const bx = bb.x * TILE - bw / 2, by = bb.y * TILE - 58;
        g.fillStyle = '#ffffff'; g.fillRect(bx, by, bw, 14);
        g.strokeStyle = '#283048'; g.lineWidth = 1.5; g.strokeRect(bx, by, bw, 14);
        g.fillStyle = '#283048'; g.fillText(bb.text, bb.x * TILE, by + 11);
      }
      g.restore();

      // 밤 조명 (실내는 조명이 켜져 있어 덜 어둡다)
      const m = st.minute;
      let dark = 0;
      if (m < 7 * 60) dark = 0.28 * (1 - (m - 360) / 60);
      if (m > 18 * 60 + 30) dark = Math.min(0.42, ((m - (18 * 60 + 30)) / 150) * 0.42);
      if (map.indoor) dark *= 0.35;
      if (dark > 0) {
        g.fillStyle = `rgba(20,24,60,${dark})`;
        g.fillRect(0, 0, w, h);
      }
      const dutyLight = !!st.nightDuty && st.nightDuty.phase !== 'sleep';
      if ((st.patrol && map.indoor) || dutyLight) {
        const sx = (p.x * TILE - camX) * zoom, sy = (p.y * TILE - camY) * zoom;
        const r0 = 60 * zoom, r1 = 190 * zoom;
        const fl = g.createRadialGradient(sx, sy, r0, sx, sy, r1);
        fl.addColorStop(0, 'rgba(8,10,24,0)');
        fl.addColorStop(1, `rgba(8,10,24,${map.indoor ? 0.82 : 0.6})`);
        g.fillStyle = fl;
        g.fillRect(0, 0, w, h);
      }
      if (starGlow) {
        const gx = (starGlow.x - camX) * zoom, gy = (starGlow.y - camY) * zoom;
        const pulse = 0.75 + Math.sin(t * 3.2) * 0.25;
        g.save();
        g.globalCompositeOperation = 'lighter';
        const sg = g.createRadialGradient(gx, gy, 0, gx, gy, 70 * zoom * pulse);
        sg.addColorStop(0, 'rgba(255,245,190,0.85)'); sg.addColorStop(0.3, 'rgba(255,225,120,0.35)'); sg.addColorStop(1, 'rgba(255,225,120,0)');
        g.fillStyle = sg; g.beginPath(); g.arc(gx, gy, 70 * zoom, 0, Math.PI * 2); g.fill();
        g.restore();
      }

      // 화면 밖 목표 화살표
      if (target) {
        const sx = (target.x * TILE - camX) * zoom, sy = (target.y * TILE - camY) * zoom;
        if (sx < 0 || sy < 0 || sx > w || sy > h) {
          const cx = w / 2, cy = h / 2;
          const ang = Math.atan2(sy - cy, sx - cx);
          const r = Math.min(w, h) / 2 - 40;
          const ax = cx + Math.cos(ang) * r, ay = cy + Math.sin(ang) * r;
          g.save();
          g.translate(ax, ay);
          g.rotate(ang);
          g.fillStyle = '#ff503c';
          g.beginPath(); g.moveTo(18, 0); g.lineTo(-10, -12); g.lineTo(-4, 0); g.lineTo(-10, 12); g.closePath(); g.fill();
          g.restore();
        }
      }

      // 페이드
      if (fade > 0) {
        g.fillStyle = `rgba(0,0,0,${fade})`;
        g.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('wheel', onWheel); };
  }, [world, look, b.cap, npcTarget, findInteractable, extraDefs]);

  const closeOverlay = useCallback(() => {
    const o = overlayRef.current;
    setOverlay(null);
    if (o && o.type === 'dialogue' && o.onDone) o.onDone();
  }, [setOverlay]);

  const state = useGame();
  const ctx = { branch: state.branch, name: state.name, day: state.day };

  return (
    <div className="world">
      <div className="world-canvas" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
      <Hud onNotebook={() => setOverlay({ type: 'notebook' })} onQuests={() => setOverlay({ type: 'quests' })} onMap={() => setOverlay({ type: 'map' })} onHome={goHome} fast={fast} onToggleFast={() => setFast((v) => !v)} />
      {!overlay && !cerShow && <QuestTracker onOpen={() => setOverlay({ type: 'quests' })} />}
      <div className="location-badge">📍 {world.maps[location].name}</div>
      <div key={location} className="location-banner">{world.maps[location].name}</div>
      {prompt && !overlay && !rollcall && (
        <div className={`prompt ${prompt.kind === 'event' ? 'urgent' : ''}`} onClick={interact}>
          <kbd>E</kbd> {fmt(prompt.label, ctx)}
        </div>
      )}
      <TouchPad keys={keys} onAction={interact} />
      {overlay?.type === 'dialogue' && (
        <DialogueBox key={JSON.stringify(overlay.script.lines[0])} script={overlay.script} onChoice={overlay.onChoice} onClose={closeOverlay} />
      )}
      {overlay?.type === 'menu' && <Menu title={overlay.title} subtitle={overlay.subtitle} options={overlay.options} onClose={() => setOverlay(null)} />}
      {overlay?.type === 'notebook' && <Notebook onClose={() => setOverlay(null)} />}
      {overlay?.type === 'quests' && <QuestLog onClose={() => setOverlay(null)} />}
      {overlay?.type === 'map' && <MapView onClose={() => setOverlay(null)} />}
      {flash && <div className="white-flash" />}
      {cerShow && <RollcallCeremony info={cerShow.info} ctl={cerCtl} aide={cerShow.aide} onEnd={finishCeremony} />}
      {nightPhase === 'sleep' && (
        <div className="night-sleep" onClick={nightWake}>
          <div className="night-zzz">Z<span>z</span><i>z</i></div>
          <div className="night-text">소등. 모포를 덮고 눈을 감았다…</div>
          <div className="night-sub">{nightKind === 'guard' ? '오늘은 위병소 야간 근무가 있다. 사수가 깨우러 올 것이다.' : '오늘은 불침번 근무가 있다. 이전 근무자가 깨우러 올 것이다.'}</div>
          <div className="night-hint">클릭 · Enter</div>
        </div>
      )}
      <div className="rank-hint">{rankIdxForDay(day) >= 3 ? '병장 · 전역이 코앞!' : ''}</div>
    </div>
  );
}

const QUEST_STEPS = Object.fromEntries(Object.entries(QUESTS).map(([k, v]) => [k, v.steps]));
