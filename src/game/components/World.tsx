"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BranchId,
  Choice,
  Dialogue,
  Line,
  LineWho,
  MonsterLook,
  NpcId,
  SpotId,
} from "../types";
import { extraLook, extrasForDay, extraOverdue, sergeantSinceArrival, type ExtraDef } from "../data/extras";
import { QUICK_SCENES, fillExtraNames, hostNpc, quickSpotOfHost } from "../data/quickScenes";
import {
  useGame,
  presentNpcs,
  questOffers,
  dialogueById,
  PATROL_SPOTS,
  buddyForgot, spotLabel, eventDue } from "../state/store";
import {
  BRANCHES,
  FACILITY_NAME,
  STORE_NAME,
  TOTAL_DAYS,
  fmtTime,
  rankIdxForDay,
  RANKS,
  seasonForDay,
} from "../data/branches";
import { findSpecies } from "../data/monsters";
import {
  NPC_ROLES,
  NPC_SKINS,
  SOLDIER_IDS,
  birthdayNpcs,
  currentSquadLeader,
  npcDisplayName,
  npcRoleTitle,
  npcPresent,
} from "../data/npcs";
import {
  EXTRA_TALK_MORE,
  FAREWELL_LINES,
  pickTalk,
  smallTalkPool,
} from "../data/dialogues";
import { ITEMS } from "../data/items";
import { QUESTS } from "../data/quests";
import { isFreeTimeEvening, isMealTime, mealFromWork } from "../data/schedule";
import {
  setMapZoomUnit,
  stepMapZoom,
  useSettings,
} from "../state/settings";
import {
  loadTileAtlas,
  renderTilesetMap,
  supportsTileset,
} from "../engine/tileset";
import { inEventArea } from "../engine/eventArea";
import {
  MAP_NAMES,
  TILE,
  collides,
  doorCenter,
  doorToward,
  findPath,
  getWorld,
  isSolid,
  renderMapCanvas,
  type Door,
  type GameMap,
  type MapId,
  type WorldDef,
} from "../engine/map";
import { drawMonster, type CapType, type Dir } from "../engine/drawMonster";
import { runtime } from "../engine/runtime";
import { npcCap, type SpeakerInfo } from "../engine/speakers";
import type {
  CerActor,
  CeremonyCtl,
  CeremonyInfo,
  CeremonyRt,
} from "../engine/ceremony";
import { fmt, fixJosa } from "../engine/text";
import { memberFullName, memberName } from "../engine/whereabouts";
import Hud from "./Hud";
import DialogueBox, { type DialogueScript } from "./DialogueBox";
import Menu, { type MenuOption } from "./Menu";
import Notice, { type NoticeInfo } from "./Notice";
import Notebook from "./Notebook";
import RollcallCeremony from "./RollcallCeremony";
import { NIGHT_STAR_LINES, STORY_MISSIONS, missionReady, missionState } from "../data/story";
import { QuestLog, QuestTracker } from "./QuestPanel";
import MapView from "./MapView";
import TouchPad from "./TouchPad";
import { ResistMeter, StoryBackdrop } from "./StoryBackdrop";
import PuzzleBox from "./PuzzleBox";
import { playSfx, setBgmMood, type BgmMood } from "../engine/audio";
import { sceneMood, type SceneHint } from "../engine/soundCues";
import { CANDY_SPOTS, NIGHT_PUZZLES, PUZZLES, QUICK_LEVELS, QUICK_SPOTS, nextQuickSpot } from "../data/puzzles";
import { WANDER_MEMORY, WANDER_MINUTES, nextWander, quickOpenAt, wanderAt } from "../data/wanders";
import { WATCH_EXTRA, nightScene, workScene } from "../data/workScenes";
import { breakfastTalk, mealTalk } from "../data/mealTalks";
import { DUTY_BOARD, ORDERS } from "../data/orders";
import { SUSPICIONS, suspicionLeads } from "../data/suspicions";
import { WAKE_TALK_AT, errandNow, mirrorPending, orderStage, reportStage, wakeTalkPending } from "../data/errands";
import { SLEEPY_SEEN, WOKE_SENIOR, sleepySenior } from "../data/reveille";
import { MirrorReveal } from "./Scenes";
import {
  SLIPPER_LOOK,
  buddyForgets,
  josa,
  finalStar,
  libraryLightsOut,
  withReport,
  phoneCallLines,
  roofOptions,
  slipperBoss,
  slipperCorridor,
  storyExtraOptions,
  storyNpcOptions,
  storySpotOptions,
  cairnLines,
  ammoLedgerLines,
  type ResistOpts,
  type StoryBg,
  type StoryCtx,
} from "./storyEvents";

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
  /** 나와 동행 중: 내 발자취를 따라 바로 뒤에 붙었다 */
  att?: boolean;
  /** 앞사람과 겹치지 않으려고 잠깐 멈춰 서 있다 (같은 길을 가는 앞사람이 한 걸음 멀어질 때까지) */
  held?: boolean;
}

/** 맵 + 타일 좌표 */
type Pos = [MapId, number, number];

/** 부대 엑스트라 런타임 상태 */
interface ExtraRt extends NpcRt {
  wait: number;
  routeIdx: number;
}

type Overlay =
  | {
      type: "dialogue";
      script: DialogueScript;
      onChoice?: (c: Choice) => void;
      onDone?: () => void;
      bg?: StoryBg;
      /** 🔊 이 장면 동안 흐를 곡 (없으면 화자·배경을 보고 고른다) */
      bgm?: BgmMood;
      nonce?: number;
    }
  | { type: "resist"; opts: ResistOpts; onDone: (ok: boolean) => void }
  | {
      type: "puzzle";
      id: string;
      onSolved: (reward: number) => void;
      onFail?: () => void;
      /** "나중에 풀기"로 닫았을 때 (없으면 그냥 닫힌다) */
      onClose?: () => void;
    }
  | { type: "menu"; title: string; subtitle?: string; options: MenuOption[] }
  | { type: "notice"; info: NoticeInfo; onDone?: () => void }
  | { type: "mirror"; onDone: () => void }
  | { type: "notebook" }
  | { type: "quests" }
  | { type: "map" }
  | null;

/** 🔊 지금 떠 있는 창이 어떤 장면인지 (곡을 고르는 데 쓴다 · engine/soundCues.ts) */
function overlayHint(o: Overlay): SceneHint | null {
  if (!o) return null;
  if (o.type === "dialogue")
    return { type: "dialogue", bg: o.bg, speaker: o.script.custom?.name, speakerSub: o.script.custom?.sub, bgm: o.bgm };
  if (o.type === "puzzle") return { type: "puzzle", puzzle: o.id };
  if (o.type === "resist") return { type: "resist", resistMode: o.opts.mode };
  if (o.type === "mirror" || o.type === "notice" || o.type === "menu") return { type: o.type };
  return { type: "other" };
}

interface Interactable {
  key: string;
  label: string;
  kind: "event" | "npc" | "spot" | "extra" | "seat" | "duty" | "story" | "wake";
  extra?: string;
  npc?: NpcId;
  spot?: SpotId;
}

/** 자유 시간에 머무는 곳 */
const FREE_POS: Record<NpcId, Pos> = {
  sgt: ["room1", 10, 5],
  senior: ["lounge", 3, 3],
  buddy: ["cyber", 2, 2],
  junior: ["room1", 12, 5],
  junior2: ["outdoor", 34, 24],
  // 소대장은 지휘통제실 당직사관, 중대장은 행정반, 행보관은 부대를 돌아다닌다
  lt: ["command", 5, 2],
  sgm: ["outdoor", 16, 21],
  cpt: ["admin", 5, 2],
};
/**
 * 식사 시간 식당 자리 (식당 13x13: 식탁은 y=4·7·10 줄 / x=2~4, 8~10)
 * 모두 식탁 바로 위 줄(y=3·6·9)에 앉아 아래(식탁)를 보고 먹는다 → 식판이 몸에 가리지 않는다
 */
const MEAL_POS: Partial<Record<NpcId, Pos>> = {
  // 1분대: 첫 줄 (계급순: 분대장 · 1분대 상병 · 맞선임 · 나(4) | 통로 | 동기 · 후임들)
  sgt: ["mess", 1, 3],
  senior: ["mess", 3, 3],
  buddy: ["mess", 8, 3],
  junior: ["mess", 9, 3],
  junior2: ["mess", 10, 3],
  // 간부: 둘째 줄 왼쪽
  lt: ["mess", 2, 6],
  cpt: ["mess", 3, 6],
  sgm: ["mess", 4, 6],
};
/** 엑스트라 식사 자리 (취사병·PX병·위병·군견은 자리를 지킨다) */
const EXTRA_MEAL_SEAT: Record<string, [number, number]> = {
  runner: [11, 3],
  medic: [8, 6],
  nco: [9, 6],
  clerk: [10, 6],
  gym: [2, 9],
  cyber: [3, 9],
  room2a: [4, 9],
  lounge: [8, 9],
  // 1분대 선임 · 2생활관 사람들 (식탁을 넓힌 자리)
  sq1: [2, 3],
  r2b: [9, 9],
  r2c: [10, 9],
  r2d: [11, 9],
};
/** 밥 먹으러 갈 땐 길을 걸어가지 않고 식당 입구(안쪽)에 바로 도착한다 */
const MESS_DOOR_IN: [number, number] = [6.5, 11.5];
/** 📖 막사 2층 옥상 철문 (복도 위쪽 벽, 계단 옆) · 구령대 위 별 */
const ROOF_DOOR: [number, number] = [22, 0];
const STAGE_STAR: [number, number] = [20.5, 16.4];
/** 전역일: 아침 점호가 끝나고, 아직 별에게 대답하지 않았으면 구령대에 별이 있다 */
const finalStarOn = (st: ReturnType<typeof useGame.getState>) =>
  st.clues.length > 0 &&
  st.day >= TOTAL_DAYS &&
  !st.flags.f01 &&
  st.currentEvent()?.kind === "farewell";
/** 내 식사 자리: 1분대 줄, 맞선임 옆 */
const MY_MEAL_SEAT: [number, number] = [4, 3];
/** 1분대(1생활관) 식사 행군 순서 = 계급순. 맨 앞(있는 사람 중)이 식사를 이끈다 */
const SQUAD_KEYS = ["sgt", "x:sq1", "senior", "buddy", "junior", "junior2"];
/**
 * 식사 시간에 1분대가 모여 있는 자리: 1생활관 침상 사이 통로.
 * 분대장이 "밥 먹으러 가자" 하면 (내가 있으면 나까지) 다 같이 병영식당 입구로 화면 전환
 */
const MEAL_GATHER: Record<string, Pos> = {
  sgt: ["room1", 4, 4],
  "x:sq1": ["room1", 12, 6],
  senior: ["room1", 8, 4],
  buddy: ["room1", 6, 5],
  junior: ["room1", 10, 5],
  junior2: ["room1", 12, 5],
};
const GATHER_KEYS = new Set(
  Object.values(MEAL_GATHER).map((g) => `${g[0]}:${g[1]},${g[2]}`),
);
/** 분대 선두(분대장)가 앉아서 다 먹기까지(분) — 선임은 빨리 먹는다 / 내가 그냥 먹으면 걸리는 시간 */
const SQUAD_EAT_MIN = 9;
/** 내 식사 속도 (선택지): 걸리는 시간(분). 'match'는 분대 선두가 다 먹는 시각에 맞춘다 */
type EatMode = "fast" | "match" | "slow";
const EAT_MIN: Record<EatMode, number> = {
  fast: 5,
  match: SQUAD_EAT_MIN,
  slow: 14,
};
const mealOf = (m: number): "lunch" | "dinner" =>
  m < 15 * 60 ? "lunch" : "dinner";
const mealStartOf = (m: number) => (m < 15 * 60 ? 12 * 60 : 17 * 60 + 30);
const hashStr = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++)
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
};
/** 이번 끼니에 각자 자리에 앉은 시각 (자리에 도착한 순간 기록) · me: 내가 앉아 먹기 시작한 시각 */
const mealRt: { key: string; seated: Record<string, number>; me: number | null } = {
  key: "",
  seated: {},
  me: null,
};
function mealSeated(day: number, minute: number) {
  const k = `${day}-${mealOf(minute)}`;
  if (mealRt.key !== k) {
    mealRt.key = k;
    mealRt.seated = {};
    mealRt.me = null;
  }
  return mealRt.seated;
}
/** 식사 때 분대를 이끄는 사람: 분대장(가디) → 맞선임(디그다). 둘 다 전역했으면 내가 분대장이다 (null) */
function squadLeadKey(day: number): string | null {
  const l = currentSquadLeader(day);
  return l === "me" ? null : l;
}
/** 이 사람이 그날 나보다 계급이 낮은 후임인지 (주요 인물은 입대 순서, 엑스트라는 직책의 계급) */
function juniorToMe(key: string, day: number): boolean {
  const mine = rankIdxForDay(day);
  if (!key.startsWith("x:")) {
    const r = NPC_ROLES[key as NpcId];
    return !!r && !r.officer && rankIdxForDay(day, r.offset) < mine;
  }
  const def = extrasForDay(useGame.getState().branch, day).find((d) => d.id === key.slice(2));
  const word = def?.title.split(" ").pop() ?? "";
  const idx = (RANKS as readonly string[]).indexOf(word);
  return idx >= 0 && idx < mine;
}
/**
 * 💭 전역했어야 할 사람을 찾아가 말을 걸다가: 계급장이 아직도 그대로인 것이 눈에 걸린다.
 * - "내가 진급하는 동안에도 그대로"라는 생각은 내가 실제로 진급한 뒤에, 내가 전입 왔을 때부터 병장이던 사람에게만 든다
 * - "분대장님도, 맞선임도 다 떠났는데"는 두 사람이 정말 전역한 뒤에만
 */
function overdueThought(id: string, name: string, day: number): string {
  const st = useGame.getState();
  const mine = rankIdxForDay(day);
  const sinceArrival = mine >= 1 && sergeantSinceArrival(st.branch, id);
  const times = mine >= 2 ? "몇 번" : "한 번";
  if (id === "room2a" && sinceArrival)
    return `(…2분대의 말 없는 병장님. 내가 이병으로 처음 왔을 때도 병장이었다. 나는 그동안 계급장을 ${times} 바꿔 달았는데, 저 계급장은 그대로다.)`;
  const pool = [
    `(…가만. ${name} 병장님 계급장이 아직도 그대로네. 병장을 단 지가 언제인데. 전역 날짜가 한참 지났을 텐데…)`,
  ];
  if (sinceArrival)
    pool.push(`(${name} 병장님. 내가 진급하는 동안에도 저 계급장은 한 번도 바뀌지 않았다. 전역 신고를 하는 것도 본 적이 없다.)`);
  if (!npcPresent("sgt", day) && !npcPresent("senior", day))
    pool.push(`(왜 ${name} 병장님은 아직도 병장이지? 분대장님도, 맞선임도 다 떠났는데.)`);
  let h = day;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}
/** 👻 팬텀: 야간 순찰 때 화장실 거울 속에 비치는 그림자 (거울 쪽을 등지고 돌아섰을 때만 보인다) */
const PHANTOM_LOOK = { sprite: "gengar", body: "#6a4a9a", belly: "#6a4a9a", accent: "#e84a6a", shape: "round", ears: "pointy", tail: "none", eyes: "sharp", mouth: "fang" } as MonsterLook;
/** 세면대 두 개(6,1 · 7,1) 위 거울 (논리 픽셀 box(3,-9,10,8)) 를 잇는 영역, 월드 픽셀 */
const PHANTOM_MIRROR = { x: 6 * TILE + 6, y: TILE - 18, w: 2 * TILE - 12, h: 16 };
const phantomRt: { armed: boolean; showAt: number; talking: boolean } = { armed: false, showAt: 0, talking: false };
/** 📖 나를 잊은 동기가 하는 말 (낯선 사람을 대하듯, 그래도 어딘가 낯익다) */
const BUDDY_FORGOT_TALK = [
  "…저, 혹시 저 아십니까? 이상하게 낯이 익어서요.",
  "죄송합니다. 요즘 자꾸 사람 이름이 헷갈립니다. 분명 아는 얼굴 같은데…",
  "(멍하니) …어디서 같이 뭘 했던 것 같은데. 빨래였나, 컴퓨터였나…",
  "…같이 다니면 뭔가 떠오를 것 같기도 합니다.",
];
/** 내가 분대장일 때 "넵!" 하고 받는 사람 (후임 → 막내 → 동기) */
function squadResponder(day: number): NpcId | null {
  return (["junior", "junior2", "buddy"] as NpcId[]).find((id) => npcPresent(id, day)) ?? null;
}
/**
 * 최선임이 다 먹는 시각 (아직 앉지 않았으면 undefined).
 * 분대와 함께 온 끼니엔 내가 밥을 받아 앉기 전까지 선임들도 계속 먹는다:
 * 선임이 앉은 때와 내가 앉은 때 중 늦은 쪽에서 SQUAD_EAT_MIN 뒤
 */
function squadLeadDone(st: ReturnType<typeof useGame.getState>): number | undefined {
  const seated = mealSeated(st.day, st.minute);
  // 내가 분대장이면 분대원들은 내가 "생활관 가자" 할 때까지 자리에서 기다린다
  const lead = squadLeadKey(st.day);
  const ls = lead ? seated[lead] : undefined;
  if (ls === undefined) return undefined;
  const withMe = mealCall.withMe === `${st.day}-${mealOf(st.minute)}`;
  if (withMe && mealRt.me === null) return Infinity;
  return Math.max(ls, mealRt.me ?? ls) + SQUAD_EAT_MIN;
}
/** 오늘 1분대(1생활관) 사람들, 계급순 */
function squadKeys(
  branch: Parameters<typeof extrasForDay>[0],
  day: number,
): string[] {
  const ps = presentNpcs(day);
  const xs = new Set(extrasForDay(branch, day).map((d) => `x:${d.id}`));
  return SQUAD_KEYS.filter((k) =>
    k.startsWith("x:") ? xs.has(k) : ps.includes(k as NpcId),
  );
}
/** 내 식사 상태 (식판 들고 있음 / 앉아서 먹는 중) */
const myMeal: {
  tray: "" | "lunch" | "dinner";
  eating: null | {
    meal: "lunch" | "dinner";
    prog: number;
    last: number;
    dur: number;
    mode: EatMode;
    lead: string | null;
    bonus: boolean;
  };
} = { tray: "", eating: null };
/** 식판 (left: 남은 양 0~1) */
function drawTray(
  g: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  left: number,
) {
  g.fillStyle = "#9aa0a8";
  g.fillRect(tx, ty, 20, 13);
  g.fillStyle = "#c8ccd4";
  g.fillRect(tx + 1, ty + 1, 18, 11);
  if (left <= 0.02) return;
  const k = Math.max(0.2, left);
  g.fillStyle = "#ffffff";
  g.fillRect(tx + 2, ty + 2, Math.ceil(7 * k), 5); // 밥
  g.fillStyle = "#d0402a";
  g.fillRect(tx + 11, ty + 2, Math.ceil(6 * k), 4); // 김치
  g.fillStyle = "#a0682a";
  g.fillRect(tx + 2, ty + 8, Math.ceil(7 * k), 3); // 반찬
  g.fillStyle = "#e8b048";
  g.fillRect(tx + 11, ty + 7, Math.ceil(6 * k), 4); // 국
}
/**
 * 🍚 이번 끼니의 분대 이동 (key = 일차-끼니)
 * - key: 분대가 식당으로 출발했다 · withMe: 나도 같이 왔다(이때만 배식을 받는다)
 * - back: 다 먹고 다 같이 생활관으로 돌아왔다 · talking: 최선임이 부르는 중
 */
const mealCall = { key: "", withMe: "", back: "", talking: false, waitSince: 0 };
/**
 * ⏱ 시간은 저절로 흐르지 않는다. 다음 일정이 이만큼(분) 안이면 장소에 도착하는 순간 시작하고,
 * 그보다 멀면(점심·저녁 자유 시간) 장소에서 E로 "시작하기"를 눌러야 그 시각으로 넘어간다.
 */
const ARRIVE_AUTO_GAP = 30;
/** 🚪 노크하고 들어가야 하는 방 (문 이름) */
const KNOCK_ROOMS: Partial<Record<MapId, string>> = { command: "지휘통제실", admin: "행정반" };
/**
 * 식사 시간에 이 사람이 있어야 할 곳 ('free' = 평소 자리).
 * - 1분대: 1생활관에 모여 대기 → 분대장이 "밥 먹으러 가자" 하면 다 같이 식당 → 최선임이 다 먹으면 다 같이 생활관으로
 * - 다른 사람(간부·다른 부대): 저마다 다른 시각에 와서, 저마다 다른 시간 동안 먹고 간다
 */
function mealGoal(
  key: string,
  seat: Pos,
  st: ReturnType<typeof useGame.getState>,
): Pos | "free" {
  const m = st.minute;
  const seated = mealSeated(st.day, m);
  const squad = squadKeys(st.branch, st.day);
  const si = squad.indexOf(key);
  if (si >= 0) {
    const mk = `${st.day}-${mealOf(m)}`;
    if (mealCall.back === mk) return "free";
    const lead = seated[squad[0]];
    // 최선임이 다 먹었다: 내가 식당에서 같이 먹고 있으면 "생활관 간다" 할 때까지 자리에서 기다리고,
    // 내가 없으면 분대끼리 다 같이 일어나 1생활관으로 돌아간다
    const leadDone = squadLeadDone(st);
    if (leadDone !== undefined && m >= leadDone)
      return runtime.player.map === "mess" && mealCall.key === mk
        ? seat
        : (MEAL_GATHER[key] ?? "free");
    const mc = st.mealCheck;
    if (!mc || mc.meal !== mealOf(m))
      return lead !== undefined || m > mealStartOf(m) + 30 ? seat : "free";
    // 분대가 출발하기 전까지는 1생활관에서 기다린다
    if (mealCall.key !== `${st.day}-${mealOf(m)}`)
      return MEAL_GATHER[key] ?? seat;
    return seat;
  }
  const h = hashStr(`${key}-${st.day}-${mealOf(m)}`);
  const arrive = mealStartOf(m) + 2 + (h % 23);
  const dur = 9 + ((h >>> 8) % 8);
  if (m < arrive) return "free";
  const sAt = seated[key];
  if (sAt !== undefined ? m >= sAt + dur : m >= arrive + dur + 14)
    return "free";
  return seat;
}
/** 식탁 쪽을 바라보는 방향 (모든 자리는 식탁 위쪽) */
const seatFacing = (_y: number): Dir => "down";
/** 식사 중인지: 식사 시간이고 자기 자리에 앉아 있음 */
const eatingAt = (
  map: MapId,
  x: number,
  y: number,
  seat: Pos | [number, number] | undefined,
  minute: number,
) => {
  if (!seat || !isMealTime(minute)) return null;
  const [sm, sx, sy] =
    seat.length === 3 ? seat : (["mess", seat[0], seat[1]] as Pos);
  if (map !== sm || Math.hypot(x - (sx + 0.5), y - (sy + 0.5)) > 0.3)
    return null;
  return { x: sx, y: sy, face: seatFacing(sy) };
};
/** 취침 전 생활관 자리 */
const NIGHT_POS: Partial<Record<NpcId, Pos>> = {
  // 1분대는 모두 1생활관. 자기 침상(BED_X) 바로 앞 통로
  sgt: ["room1", 1, 4],
  senior: ["room1", 5, 4],
  buddy: ["room1", 9, 4],
  junior: ["room1", 11, 4],
  junior2: ["room1", 13, 4],
};
/** 소등(저녁 점호 후): 유동병력 없음. 병사는 침상에서 취침, 근무자만 제자리 */
const LIGHTS_OUT = 22 * 60;
/** 당직 간부가 밤새 앉아 있는 지휘통제실 책상 자리 */
const DUTY_DESK: Pos = ["command", 5, 2];
/** 1분대 침상 (1생활관 위쪽 줄 x, 내 침상은 3). 저녁 점호 때 이 침상에 앉고, 소등하면 그대로 눕는다 */
const BED_X: Partial<Record<NpcId, number>> = {
  sgt: 1,
  senior: 5,
  buddy: 9,
  junior: 11,
  junior2: 13,
};
/** 엑스트라 침상: [맵, x, 줄] */
const EXTRA_BED: Record<string, [MapId, number, "top" | "bottom"]> = {
  sq1: ["room1", 1, "bottom"],
  room2a: ["room2", 13, "top"],
  r2b: ["room2", 1, "top"],
  r2c: ["room2", 5, "top"],
  r2d: ["room2", 9, "top"],
};
/** 밤에도 깨어 있는 근무자: 당직병(지휘통제실)·위병(이전 근무자)과 군견. 그 밖의 병력은 없다 */
const NIGHT_STAY = new Set(["guard", "clerk", "dog"]);
/** 밤 근무 자리 (행정병 → 지휘통제실 당직병) */
const NIGHT_SPOT: Record<string, Pos> = { clerk: ["command", 8, 4] };
/**
 * 명령을 전달해도 되는 때: 점심(12:00~13:20) · 저녁 개인정비(17:30~21:10).
 * 식사 시간에는 밥을 다 먹은 뒤에만 부른다 (식사 집합·행군을 끊지 않도록).
 */
function orderWindow(st: { minute: number; daily: string[] }): boolean {
  const m = st.minute;
  if (m >= 12 * 60 && m < 13 * 60 + 20) return m >= 13 * 60 || st.daily.includes("meal_lunch");
  if (m >= 17 * 60 + 30 && m < 21 * 60 + 10) return m >= 18 * 60 + 30 || st.daily.includes("meal_dinner");
  return false;
}
/** 밤 순찰 중 글자(안농)들이 떠 있는 곳에 서 있는지: 5일차는 2층 복도 게시판 앞, 9일차는 휴게실 */
function atNightGlyphs(day: number): boolean {
  const p = runtime.player;
  if (day === 5) return p.map === "hq2" && Math.hypot(p.x - 16.5, p.y - 2.5) < 3;
  if (day === 9) return p.map === "lounge";
  return false;
}
/** 야간 근무 중 별빛(지라치)이 떠 있는 곳 */
const STAR_POS: Record<"watch" | "guard", [MapId, number, number]> = {
  watch: ["room1", 7.5, 2.4],
  guard: ["depot", 16.6, 20.5],
};
/** 🔦 불침번 순찰: 생활관마다 가서 서 봐야 하는 자리 (통로 안쪽) */
const ROUND_POINT: Record<"room1" | "room2", [number, number]> = { room2: [11.5, 5], room1: [11.5, 5] };
/** 불침번 순찰에서 다음에 돌아볼 생활관 */
const nextRound = (nd: { rounds?: string[] }): "room1" | "room2" => ((nd.rounds ?? []).includes("room2") ? "room1" : "room2");
/** 야간 근무: 깨우러 온 사람·사수/부사수·다음 근무자가 있어야 할 곳 (null = 평소 밤 규칙대로) */
function nightGoal(
  key: string,
  st: ReturnType<typeof useGame.getState>,
): Pos | null {
  const nd = st.nightDuty;
  if (!nd) return null;
  const p = runtime.player;
  if (nd.partner && key === nd.partner) {
    if (nd.phase === "sleep" || nd.phase === "woken") return ["room1", 4, 4];
    if (nd.phase === "shift") return ["depot", 14, 26];
    return [p.map, Math.floor(p.x), Math.floor(p.y)]; // 같이 간다 (따라온다)
  }
  if (key === nd.prev)
    return nd.phase === "sleep" || nd.phase === "woken"
      ? ["room1", 4, 4]
      : null;
  if (key === nd.next && nd.nextAwake) return ["room1", 7, 5]; // 새 불침번: 출입문 쪽에서 근무
  return null;
}
/** 야간 근무에 얽힌 사람인지 (깨우러 온 이전 근무자 · 사수/부사수 · 깨어난 다음 근무자). 그 밖의 인원은 이미 침상에서 자고 있다 */
function dutyInvolved(
  key: string,
  st: ReturnType<typeof useGame.getState>,
): boolean {
  const nd = st.nightDuty;
  if (!nd) return false;
  return (
    key === nd.prev || key === nd.partner || (key === nd.next && nd.nextAwake)
  );
}
/** 함께 하는 퀘스트(동기·후임·선임과 같이 가는 부탁)가 진행 중이면 그 사람이 나와 동행한다 (집합·점호·취침 준비 때는 제외) */
function questCompanion(
  key: string,
  st: ReturnType<typeof useGame.getState>,
): boolean {
  if (
    st.minute < 6 * 60 + 15 ||
    st.minute >= 21 * 60 ||
    st.rollcall
  )
    return false;
  if (companionOf(st) !== key) return false;
  const ev = st.currentEvent();
  return !(ev && !st.eventBegun && st.minute >= ev.start && ev.spot);
}
/**
 * 뒤따라오는 사람은 한 번에 한 명뿐이다.
 * 📖 잊혀 가는 이름(기억을 되찾을 때까지 동기)이 먼저, 그다음은 먼저 받은 "함께 하는 퀘스트"의 의뢰인
 */
function companionOf(st: ReturnType<typeof useGame.getState>): string | null {
  if (st.flags.m13 && !st.flags.buddyBack && npcPresent("buddy", st.day)) return "buddy";
  for (const q of st.quests) {
    const d = QUESTS[q.id];
    if (d?.together && npcPresent(d.giver, st.day)) return d.giver;
  }
  return null;
}
/** 지금 나와 동행하는 사람인지: 야간 근무 사수·부사수 / 함께 하는 퀘스트의 상대 (한 명) */
const followsMe = (key: string, st: ReturnType<typeof useGame.getState>) => {
  const nd = st.nightDuty;
  if (nd)
    return (
      nd.partner === key && (nd.phase === "toPost" || nd.phase === "report" || nd.phase === "return")
    );
  return questCompanion(key, st);
};
/** 내 발자취 (최근 위치가 맨 앞). 동행하는 사람은 이 길을 따라 내 바로 뒤에 선다 */
const myTrail: { map: MapId | null; pts: [number, number][] } = {
  map: null,
  pts: [],
};
/** 동행하는 사람이 서는 거리 (내 뒤로 한 칸) */
const FOLLOW_GAP = 1.05;
function trackMyTrail(
  p: { map: MapId; x: number; y: number; dir: Dir },
  map: GameMap,
) {
  if (myTrail.map !== p.map) {
    // 문을 지나면 발자취를 새로 시작: 들어온 방향의 반대쪽(내 뒤)이 비어 있으면 거기서부터
    const [ox, oy] = {
      up: [0, 1],
      down: [0, -1],
      left: [1, 0],
      right: [-1, 0],
    }[p.dir];
    const bx = p.x + ox * FOLLOW_GAP,
      by = p.y + oy * FOLLOW_GAP;
    myTrail.map = p.map;
    myTrail.pts = collides(map, bx, by)
      ? [[p.x, p.y]]
      : [
          [p.x, p.y],
          [bx, by],
        ];
    return;
  }
  const [lx, ly] = myTrail.pts[0];
  if (Math.hypot(p.x - lx, p.y - ly) < 0.1) return;
  myTrail.pts.unshift([p.x, p.y]);
  if (myTrail.pts.length > 80) myTrail.pts.pop();
}
/** 발자취를 따라 dist만큼 되돌아간 지점 */
function trailBack(dist: number): [number, number] {
  const pts = myTrail.pts;
  let left = dist;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i],
      [bx, by] = pts[i + 1];
    const d = Math.hypot(bx - ax, by - ay);
    if (d >= left)
      return [ax + ((bx - ax) * left) / d, ay + ((by - ay) * left) / d];
    left -= d;
  }
  return pts[pts.length - 1];
}
/** 누운 위치(발 기준 y) / 침상 앞 통로 y */
const bedY = (row: "top" | "bottom") => (row === "top" ? 2.62 : 7.62);
const aisleY = (row: "top" | "bottom") => (row === "top" ? 4 : 6);
/** 그날 밤 당직 간부 (저녁 점호 당직사령과 같다) */
const nightDutyOfficer = (day: number): NpcId => (day % 2 === 1 ? "lt" : "sgm");
/** 그날 밤 실제로 당직을 서는 간부 (당직 간부가 없는 날엔 중대장) */
function dutyOfficerNow(day: number): NpcId {
  return presentNpcs(day).includes(nightDutyOfficer(day)) ? nightDutyOfficer(day) : "cpt";
}
/** 지금 보이는 주요 NPC: 소등 후엔 당직 간부만 남고 다른 간부는 퇴근 */
function visibleNpcs(day: number, minute: number): NpcId[] {
  const ps = presentNpcs(day).filter((id) => !sceneAlone.hideNpc.has(id));
  if (minute < LIGHTS_OUT) return ps;
  const duty = dutyOfficerNow(day);
  return ps.filter((id) => !NPC_ROLES[id].officer || id === duty);
}
/** 주요 NPC가 침상에 누워 있는지 */
/** 😴 아침 기상 뒤에도 아직 침상에서 자고 있는 선임인지 (내가 깨워야 한다 · data/reveille.ts) */
const morningAsleep = (key: string) => sleepySenior(useGame.getState()) === key;
const npcAsleep = (id: NpcId, n: { map: MapId; y: number }, minute: number) =>
  (minute >= LIGHTS_OUT || morningAsleep(id)) &&
  BED_X[id] !== undefined &&
  n.map === "room1" &&
  Math.abs(n.y - bedY("top")) < 0.05;
/** 엑스트라를 대화창 화자로 (이름 + 계급 · 직책 · 모자) */
function extraSpeakerInfo(def: ExtraDef, branch: BranchId): SpeakerInfo {
  const words = def.title.split(" ");
  return {
    name: `${def.name} ${words[words.length - 1]}`,
    sub: words.length > 1 ? words.slice(0, -1).join(" ") : def.title,
    look: extraLook(def),
    cap: (def.noCap ? null : def.officer ? `officer-${BRANCHES[branch].cap}` : BRANCHES[branch].cap) as CapType,
  };
}
/** 엑스트라: 밤에 안 보임(자기 부대 막사로) / 침상에 누움 */
const extraHiddenAtNight = (id: string, minute: number) => {
  // 🎬 둘만 남는 장면 동안 자리를 비운 사람
  if (sceneAlone.hide.has(id)) return true;
  if (minute < LIGHTS_OUT) return false;
  // 위병소 교대 후: 이전 근무자(위병)는 막사로 돌아갔다
  const nd = useGame.getState().nightDuty;
  if (
    id === "guard" &&
    nd?.kind === "guard" &&
    (nd.phase === "shift" || nd.phase === "report" || nd.phase === "return")
  )
    return true;
  return !EXTRA_BED[id] && !NIGHT_STAY.has(id);
};
/** 잠만보 취사병: 식사 시간 말고는 늘 잔다 (주방 구석이라 길은 막지 않는다) */
const snorlaxCookAsleep = (id: string, minute: number) =>
  id === "cook" &&
  useGame.getState().branch !== "navy" &&
  !isMealTime(minute) &&
  minute < LIGHTS_OUT;
const extraAsleep = (
  id: string,
  e: { map: MapId; y: number },
  minute: number,
) => {
  if (snorlaxCookAsleep(id, minute)) return true;
  if (minute < LIGHTS_OUT && !morningAsleep(`x:${id}`)) return false;
  if (id === "dog") return true;
  const bed = EXTRA_BED[id];
  return !!bed && e.map === bed[0] && Math.abs(e.y - bedY(bed[2])) < 0.05;
};
/** 침상에 누운 모습: 작은 몸 + 모포 */
function drawSleeper(
  g: CanvasRenderingContext2D,
  look: MonsterLook,
  x: number,
  y: number,
  t: number,
  blanket: boolean,
) {
  drawMonster(g, look, x * TILE, (y + 0.3) * TILE, 22, {
    dir: "down",
    t,
    sleeping: true,
    shadow: false,
  });
  if (!blanket) return;
  g.fillStyle = "#5f8250";
  g.fillRect(x * TILE - 13, (y - 0.17) * TILE, 26, 0.95 * TILE);
  g.fillStyle = "#e8e4d8";
  g.fillRect(x * TILE - 13, (y - 0.17) * TILE, 26, 4);
  g.fillStyle = "#4a6a3e";
  g.fillRect(x * TILE - 13, (y + 0.7) * TILE, 26, 2);
}
/** 1일차 기상 장면: 분대원들이 이미 일어나 생활관에 모여 있다 (분대장은 내 침상 옆) */
const WAKE_POS: Partial<Record<NpcId, Pos>> = {
  sgt: ["room1", 4, 4],
  buddy: ["room1", 6, 5],
  senior: ["room1", 8, 4],
  junior: ["room1", 10, 5],
  junior2: ["room1", 12, 5],
};
/**
 * 🍚 식사하러 갈 때 먼 길을 걷지 않고 식당 입구로 바로 건너뛴다.
 * 단, 내가 보고 있는 맵에서는 순간이동하지 않는다 (눈앞에서 갑자기 사라지지 않게 문으로 걸어 나간 뒤에 건너뛴다)
 */
function hopToMess(
  ent: { map: MapId; x: number; y: number; dir: Dir; path: [number, number][]; viaDoor: Door | null },
  goalMap: MapId,
  minute: number,
): boolean {
  if (goalMap !== "mess" || ent.map === "mess" || !isMealTime(minute)) return false;
  if (ent.map === runtime.player.map) return false;
  ent.map = "mess";
  ent.x = MESS_DOOR_IN[0];
  ent.y = MESS_DOOR_IN[1];
  ent.dir = "up";
  ent.path = [];
  ent.viaDoor = null;
  return true;
}
/** 걷기 · 달리기 속도 (달리기는 지치지 않는다) */
/** 🔎 자유 시간의 혼자만의 탐색: 이번 자유 시간에 살펴보러 가기로 한 곳과, 그 자리의 장면을 이미 봤는지 */
const soloLead: { key: string; spot: string | null; tried: boolean } = { key: "", spot: null, tried: false };
/** 🍳 내가 분대장인 날, 아침 점호 직후: 아직 분대와 아침을 먹지 않았다 (먹고 나서야 오전 일과로 넘어간다) */
function breakfastPending(st: ReturnType<typeof useGame.getState>): boolean {
  if (st.day >= TOTAL_DAYS || currentSquadLeader(st.day) !== "me" || st.daily.includes("breakfast")) return false;
  const ev = st.currentEvent();
  return !!ev && ev.id === "work_am" && !st.eventBegun && st.minute < 8 * 60 + 30 && squadKeys(st.branch, st.day).length > 0;
}
/** 🌅 아침: 내가 생활관을 나섰는지 (나서기 전에는 분대원들도 생활관에서 채비를 한다) */
const morningOut = { day: 0, out: false };
const leftRoomToday = (day: number) => morningOut.day === day && morningOut.out;
/** 🌅 아침 점호 집합 대기 중인지 (점호가 시작되기 전) */
function rollcallWaiting(st: ReturnType<typeof useGame.getState>): boolean {
  const ev = st.currentEvent();
  return !!ev && ev.kind === "rollcall_am" && !st.eventBegun && !st.rollcall && st.day < TOTAL_DAYS + 1;
}
/** 아침 점호 대열에서 각자 서는 칸 번호 (점호 의식이 세우는 순서와 같다: 1분대 → 나 → 다른 생활관·부대 인원) */
function rollcallSlots(st: ReturnType<typeof useGame.getState>): Record<string, number> {
  const out: Record<string, number> = {};
  const present = presentNpcs(st.day);
  const order: string[] = SOLDIER_IDS.filter((id) => present.includes(id));
  // 전입 첫날은 늦잠을 자서 내가 맨 끝에 선다
  const late = st.day === 1 && !st.flags.tutorial;
  if (!late) order.splice(Math.max(0, order.indexOf("buddy")), 0, "me");
  for (const def of extrasForDay(st.branch, st.day))
    if (!def.officer && !def.wild && !["dog", "guard", "cook"].includes(def.id)) order.push(`x:${def.id}`);
  order.forEach((k, i) => (out[k] = i));
  return out;
}
/**
 * 📢 지금 누군가 나를 불러 맡길 스토리 임무 (열려 있는데 아직 호출도 지시도 받지 않은 것).
 * 동기가 나를 잊은 날에는 분실물함 정리(잊혀 가는 이름)부터 부른다: 그 지시를 받아야 함께 되짚는 길이 열린다
 */
function nextCallable(st: ReturnType<typeof useGame.getState>) {
  if (st.clues.length === 0) return undefined;
  const callable = (x: (typeof STORY_MISSIONS)[number]) =>
    !!ORDERS[x.id] && !st.flags[`order_${x.id}`] && !st.flags[`summon_${x.id}`] && missionState(x, st) === "open";
  const urgent = st.flags.m13 ? STORY_MISSIONS.find((x) => x.id === "M-13" && callable(x)) : undefined;
  return urgent ?? STORY_MISSIONS.find(callable);
}
/**
 * 👁 밤 순찰의 기척: 야간 순찰 · 불침번 순찰로 복도를 걸을 때 가끔 일어나는 일 (대화도 벌점도 없다. 긴장감만)
 * - stalk: 등 뒤에서 진자를 든 손이 따라온다. 돌아보는 순간 사라진다
 * - glimpse: 앞쪽 벽에 웃는 그림자가 아주 잠깐 비친다
 */
const haunt: {
  key: string;
  stalks: number;
  glimpses: number;
  cool: number;
  stalk: null | { map: MapId; x: number; y: number; since: number };
  glimpse: null | { map: MapId; x: number; y: number; until: number };
} = { key: "", stalks: 0, glimpses: 0, cool: 0, stalk: null, glimpse: null };
const HAUNT_TURNED = [
  "(…뒤에 뭔가 따라오고 있었는데. 돌아보니 복도뿐이다.)",
  "(똑딱 소리가 뚝 그쳤다. …내 발소리였나.)",
  "(손전등을 돌렸다. 아무도 없다. 그런데 방금까지 불빛 끝에 손 같은 게…)",
];
const HAUNT_GONE = ["(…발소리가 하나 더 있었던 것 같은데.)", "(등 뒤가 서늘하다. 돌아보지 말자. 순찰이나 마저 돌자.)"];
const HAUNT_WALL = ["(…방금, 벽에. 웃는 입 같은 게.)", "(벽의 얼룩이 잠깐 얼굴처럼 보였다. …얼룩이다. 얼룩이어야 한다.)"];
/** 🔦 불침번 생활관 순찰: 날마다 다른 풍경 (근무 날짜로 고른다) */
const ROUND_ROOM2: [string, string][] = [
  ["2생활관. 손전등 불빛을 바닥으로 낮추고 침상 사이를 조용히 걷는다.", "고른 숨소리. 걷어찬 모포를 덮어 주고 인원을 센다. 이상 없음."],
  ["2생활관 문을 소리 나지 않게 민다. 손전등을 손바닥으로 반쯤 가리고 발끝으로 걷는다.", "침상 끝으로 삐져나온 발 하나를 모포 안으로 넣어 주고, 머릿수를 센다. 이상 없음."],
  ["2생활관. 누군가 잠꼬대로 구령을 붙인다. \"하나, 둘…\" 셋은 끝내 나오지 않는다.", "열려 있던 관물대 문을 조용히 닫고 인원을 센다. 맞다."],
  ["2생활관. 창문 틈으로 바람이 들어 커튼이 숨 쉬듯 부푼다. 창을 닫는다.", "침상마다 불빛을 한 번씩 스친다. 다들 같은 쪽으로 돌아누워 있다. 인원 이상 없음."],
  ["2생활관. 바닥에 굴러다니는 슬리퍼 한 짝을 침상 밑으로 밀어 넣는다.", "맨 끝 침상까지 걸어갔다 돌아온다. 숨소리의 수와 침상의 수가 맞는다. 이상 없음."],
];
const ROUND_ROOM1: string[] = [
  "1생활관으로 돌아와 침상 끝까지 한 바퀴 돈다. 분대원들의 숨소리가 고르다.",
  "1생활관. 모포가 걷혀 있는 건 내 빈 침상뿐이다. 나머지는 고른 숨소리.",
  "1생활관으로 돌아왔다. 바닥에 떨어진 베개 하나를 주워 제 주인 머리맡에 놓는다.",
  "1생활관. 누가 이를 간다. 그 소리마저 박자가 일정하다. 인원 이상 없음.",
  "1생활관. 창밖 가로등 불빛이 침상 위로 줄무늬를 그린다. 한 명씩 세며 끝까지 걷는다.",
];
/** 🌙 밤새 지휘통제실을 지키는 당직병(행정병)의 말: 밤 근무 중에만 */
const NIGHT_CLERK_TALK = [
  "(작게) …근무 중 이상 무. 당직병은 밤새 전화기 옆을 지킨다. 벨이 두 번 울리기 전에 받아야 하거든.",
  "(하품을 삼키며) 새벽 세 시가 제일 길어. 시계를 안 보는 게 요령이다.",
  "(작게) 상황 일지는 30분마다 적는다. '특이 사항 없음'을 열 번쯤 쓰면 해가 뜨지.",
  "(작게) 순찰 돌 땐 손전등을 바닥으로. 자는 사람 얼굴에 비추면 내일 아침이 시끄러워진다.",
  "(작게) 당직사관님 커피는 내가 탄다. 진하게 타야 내가 덜 깨워 드려도 되거든.",
  "(작게) 낮의 행정반은 서류 싸움이고, 밤의 지통실은 졸음 싸움이야. 난 둘 다 한다.",
  "(작게) 근무 교대 시간 꼭 지켜. 1분 늦으면 앞 근무자가 평생 기억한다.",
  "(작게) 밤엔 발소리가 멀리 간다. 네가 2층 복도 도는 거, 여기서 다 들려.",
];
const NIGHT_CLERK_ODD = [
  "(작게) …자정에 벽시계 봤어? 난 그때마다 눈을 깜빡이나 봐. 늘 1분이 비어.",
  "(작게) 아까 복도에서 누가 따라오지 않았냐고? 순찰은 너 혼자잖아. …혼자 맞지?",
];
/**
 * 🎬 둘만 남는 장면: 그 방에 있던 다른 사람들은 내가 그 방을 나설 때까지 보이지 않는다 (다들 먼저 나갔다)
 * hide = 숨긴 엑스트라 id · hideNpc = 숨긴 주요 인물
 */
const sceneAlone: { map: MapId | null; hide: Set<string>; hideNpc: Set<string> } = { map: null, hide: new Set(), hideNpc: new Set() };
const WALK_SPEED = 6;
const DASH_SPEED = 10.5;

const FORMATION: [number, number][] = [
  [-2, -2],
  [-1, -2],
  [0, -2],
  [1, -2],
  [2, -2],
];

export default function World() {
  const branch = useGame((s) => s.branch);
  const day = useGame((s) => s.day);
  const speciesId = useGame((s) => s.speciesId);
  const rollcall = useGame((s) => s.rollcall);
  const nightPhase = useGame((s) => s.nightDuty?.phase ?? null);
  const nightKind = useGame((s) => s.nightDuty?.kind ?? null);
  const b = BRANCHES[branch];
  const season = seasonForDay(day);
  const world = useMemo<WorldDef>(
    () => getWorld(branch, b.trainArea),
    [branch, b.trainArea],
  );
  const look = findSpecies(speciesId)!.look;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<Partial<Record<MapId, HTMLCanvasElement>>>({});
  const [location, setLocation] = useState<MapId>(runtime.player.map);
  const keys = useRef<Record<string, boolean>>({});
  const npcs = useRef<Partial<Record<NpcId, NpcRt>>>({});
  const extras = useRef<Record<string, ExtraRt>>({});
  const extraDefs = useMemo(() => extrasForDay(branch, day), [branch, day]);
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__npcs = npcs; // 개발용 디버그 핸들
    (window as unknown as Record<string, unknown>).__extras = extras;
    (window as unknown as Record<string, unknown>).__haunt = haunt;
    (window as unknown as Record<string, unknown>).__meal = {
      myMeal,
      mealRt,
      mealCall,
    };
  }
  const [overlay, setOverlayState] = useState<Overlay>(null);
  const overlayRef = useRef<Overlay>(null);
  const [prompt, setPrompt] = useState<Interactable | null>(null);
  const promptRef = useRef<Interactable | null>(null);

  const dlgSeq = useRef(0);
  const setOverlay = useCallback((o: Overlay) => {
    // 같은 첫 줄의 대사를 이어서 다시 열어도(재도전 등) 대화창이 새로 시작되도록 번호를 붙인다
    if (o && o.type === "dialogue") o.nonce = ++dlgSeq.current;
    // 🔊 장면에 어울리는 곡으로 · 수첩/지도/임무 카드가 뜨고 닫히는 소리
    setBgmMood(sceneMood(overlayHint(o)));
    const was = overlayRef.current?.type;
    if (o?.type === "notice") playSfx("sfx_alert", 0.9);
    else if (o?.type === "notebook") playSfx("sfx_paper", 0.7);
    else if (o?.type === "quests" || o?.type === "map") playSfx("sfx_cursor", 0.6);
    else if (!o && (was === "notebook" || was === "quests" || was === "map")) playSfx("sfx_cancel", 0.4);
    overlayRef.current = o;
    setOverlayState(o);
    useGame.getState().setBusy(o !== null);
  }, []);


  // 시제품: 타일셋(그림 파일) 아틀라스. 설정에서 켜져 있고 다 불러왔을 때만 값이 있다
  const tilesetOn = useSettings((s) => s.tilesetProto);
  const [tileAtlas, setTileAtlas] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!tilesetOn) {
      setTileAtlas(null);
      return;
    }
    let alive = true;
    loadTileAtlas()
      .then((img) => alive && setTileAtlas(img))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tilesetOn]);

  // 🍚 부대 화면이 새로 뜰 때(새 하루 · 불러오기 · 다시 시작): 지난 판의 식사 진행 기록을 비운다.
  // 같은 날짜를 다시 하면 "이번 끼니는 이미 출발했다"는 기록이 남아, 생활관에 가도 분대가 모이지 않는다
  useEffect(() => {
    mealCall.key = "";
    mealCall.withMe = "";
    mealCall.back = "";
    mealCall.talking = false;
    mealCall.waitSince = 0;
    mealRt.key = "";
    mealRt.seated = {};
    mealRt.me = null;
    myMeal.tray = "";
    myMeal.eating = null;
    sceneAlone.map = null;
    sceneAlone.hide = new Set();
    sceneAlone.hideNpc = new Set();
  }, []);

  // 정적 맵 렌더 (야외 + 모든 건물 내부)
  useEffect(() => {
    const out: Partial<Record<MapId, HTMLCanvasElement>> = {};
    for (const m of Object.values(world.maps))
      out[m.id] =
        tileAtlas && supportsTileset(m)
          ? renderTilesetMap(m, tileAtlas, season)
          : renderMapCanvas(m, season);
    mapCanvasRef.current = out;
  }, [world, season, tileAtlas]);

  // 1일차: 눈을 뜨자 눈앞에 포켓몬(분대장)이 있다 → 놀라고 혼난 뒤 "세수하고 와" → 화장실 거울에서 내 모습을 확인 → 생활관으로 돌아와 맞선임의 한마디 → 연병장
  useEffect(() => {
    const st = useGame.getState();
    if (st.day !== 1 || st.flags.wokeUp) return;
    const sgt = "sgt" as NpcId;
    // 대답을 고른 뒤: 넋이 나간 얼굴을 본 분대장이 세수부터 하고 오라고 한다
    const washOrder = () =>
      setOverlay({
        type: "dialogue",
        script: {
          npc: sgt,
          lines: [
            { who: "npc", text: "…그런데 너, 얼굴이 왜 그 모양이냐. 귀신이라도 본 얼굴인데." },
            { who: "npc", text: "1층 화장실 가서 세수하고 정신 차리고 와. 3분 준다. 아침 점호에 늦지 마라!" },
            { who: "me", text: "(화장실… 그래, 거울. 방금 모포 밖으로 나온 내 손도 이상했다. 내가 지금 어떻게 생긴 건지 봐야겠어.)" },
            { who: "narr", text: "[조작] WASD/방향키로 이동 · 문 쪽으로 걸어가면 방을 나선다 · ❗ 표시를 따라 1층 화장실 세면대 앞에서 E" },
          ],
        },
        onDone: () => useGame.getState().oversleep(),
      });
    setOverlay({
      type: "dialogue",
      script: {
        npc: sgt,
        lines: [
          { who: "narr", text: "고개를 돌렸다. 바로 눈앞에 — 커다란 얼굴이 나를 내려다보고 있다. 사람의 얼굴이 아니다." },
          { who: "me", text: '"으, 으아아아아악?!?! 포, 포켓몬?!"' },
          { who: "npc", text: "야!!! 신병!!! 눈 뜨자마자 선임 얼굴 보고 비명을 질러?! 지금 몇 시인 줄 알아?!" },
          { who: "me", text: "(말을 한다. 포켓몬이 모자를 쓰고, 나한테 소리를 지르고 있다. 둘러보니… 침상마다 전부 포켓몬이다.)" },
          { who: "npc", text: "전입 온 지 하루 만에 늦잠이냐? 다들 진작 일어나서 너만 보고 있다!" },
          { who: "me", text: "(…침착하자. 입대 전에 본 군대 유튜브만 수백 편이다. 「전입 신병 생존 가이드」에서 이럴 땐 분명…)" },
          { who: "npc", text: "뭘 멍하니 있어! 관등성명!" },
        ],
        choices: [
          {
            text: '"{S}! 이병 {me}! 늦어서 죄송합니다! 바로 준비하겠습니다!"',
            grade: "good",
            effects: { affinity: { sgt: 6 }, discipline: 2 },
            reply: [
              { who: "npc", text: "…목소리는 합격이다." },
              { who: "me", text: "(휴… 눈앞에 뭐가 있든 유튜브에서 본 그대로다. 관등성명, 사과, 그리고 즉시 행동.)" },
            ],
            tip: '관등성명 = 계급 + 성명. 늦었을 땐 변명보다 "죄송합니다 + 바로 하겠습니다"가 먼저다.',
          },
          {
            text: '"저… 저 사실 사람인데요…?"',
            grade: "ok",
            effects: { affinity: { sgt: -1 } },
            reply: [
              { who: "npc", text: "잠이 덜 깼구먼. 여기 다 그런 사연 하나씩은 있다." },
              { who: "me", text: "(…다들 그런 사연이 있다고?)" },
            ],
            tip: '상급자가 부르면 "{S}! 이병 ○○○!"처럼 경례 구호와 관등성명으로 답한다.',
          },
          {
            text: "(모포를 머리끝까지 뒤집어쓴다)",
            grade: "bad",
            effects: { affinity: { sgt: -5 }, discipline: -3 },
            reply: [
              { who: "narr", text: "……모포가 거칠게 걷혔다." },
              { who: "npc", text: "일어나. 지. 금. 당. 장." },
            ],
          },
        ],
      },
      onChoice: (c) => {
        const s2 = useGame.getState();
        if (c.effects) s2.applyEffects(c.effects, "첫 만남");
        if (c.tip) s2.addTip(c.tip);
      },
      onDone: washOrder,
    });
  }, [setOverlay]);

  /** 🔎 혼자만의 탐색: 살펴보러 온 자리에서 눈에 걸리던 것을 들여다본다 → 그 자리의 퍼즐 → 풀면 한 걸음 나아간 느낌 */
  const soloRef = useRef<(spot: string) => void>(() => {});
  soloRef.current = (spot) => {
    const st0 = useGame.getState();
    const q = QUICK_SPOTS[spot];
    const def = q ? PUZZLES[q.puzzle] : undefined;
    // 🚶 따져 볼 퍼즐이 없는 자리(다 풀었거나 아직 계급에 막힌 자리)라면: 혼자 걷다 마주치는 짧은 장면
    if (!quickOpenAt(spot, st0.day, (id) => !!st0.puzzles[id]?.solved)) {
      const w = wanderAt(spot, st0.day, st0.flags);
      const done = () => {
        soloLead.spot = null;
        useGame.setState({ solo: null });
      };
      if (!w) {
        done();
        return;
      }
      keys.current = {};
      runtime.player.moving = false;
      setOverlay({
        type: "dialogue",
        script: { lines: w.lines, choices: w.choices },
        onDone: () => {
          const s2 = useGame.getState();
          s2.spend(WANDER_MINUTES);
          s2.applyEffects({ memory: WANDER_MEMORY, flag: `walk_${w.id}` }, "혼자 걸은 길");
          s2.log(`🚶 혼자 ${spotLabel(s2.branch, w.spot)}에 들렀다. 눈에 담아 둔 것이 하나 늘었다.`);
          done();
        },
      });
      return;
    }
    if (!q || !def) return;
    // 🧩 그 자리에서 누군가 겪고 있는 일(상황 장면) → 퍼즐 → 그 포켓몬의 한마디 → 혼잣말
    quickPlayRef.current(spot);
  };

  /** 🧩 짬짬이 퍼즐의 상황을 꺼내는 쪽: 엑스트라면 그 화자, 주요 인물이면 그 npc */
  const hostScript = (host: string): { npc?: NpcId; custom?: SpeakerInfo } => {
    const nid = hostNpc(host);
    if (nid) return { npc: nid };
    const def = extraDefs.find((d) => d.id === host.slice(2));
    return def ? { custom: extraSpeakerInfo(def, useGame.getState().branch) } : {};
  };
  /**
   * 🧩 짬짬이 퍼즐 하나를 상황째로 연다 (data/quickScenes.ts): 상황 장면 → 퍼즐 → 풀면 보상과 그 포켓몬의 한마디.
   * 장소 메뉴 · 상황을 꺼내는 포켓몬에게 말 걸기 · 혼자 실마리 찾기가 모두 이 길로 온다.
   * 혼자 찾아온 자리였다면 풀고 난 뒤 혼잣말이 이어진다.
   */
  const quickPlayRef = useRef<(spot: string) => void>(() => {});
  quickPlayRef.current = (spot) => {
    const st = useGame.getState();
    const quick = QUICK_SPOTS[spot];
    const def = quick ? PUZZLES[quick.puzzle] : undefined;
    if (!quick || !def) return;
    const lv = QUICK_LEVELS[def.level ?? 1];
    const solo = st.solo === spot;
    const sc = QUICK_SCENES[spot];
    const who = sc ? hostScript(sc.host) : {};
    const named = (ls: Line[]) => fillExtraNames(ls, (id) => extraDefs.find((d) => d.id === id)?.name);
    const p = runtime.player;
    keys.current = {};
    p.moving = false;
    // 상황을 꺼내는 포켓몬이 곁에 있으면 서로 마주 본다
    const he = sc?.host.startsWith("x:") ? extras.current[sc.host.slice(2)] : sc ? npcs.current[sc.host as NpcId] : undefined;
    if (he && he.map === p.map && Math.hypot(he.x - p.x, he.y - p.y) < 4.5) {
      const dx = he.x - p.x,
        dy = he.y - p.y;
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      he.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "left" : "right") : dy > 0 ? "up" : "down";
    }
    const puzzle = () =>
      setOverlay({
        type: "puzzle",
        id: quick.puzzle,
        onSolved: () => {
          const s2 = useGame.getState();
          s2.applyEffects(lv.reward, solo ? "혼자 찾은 실마리" : "짬짬이 퍼즐");
          if (s2.solo === spot) {
            soloLead.spot = null;
            useGame.setState({ solo: null });
          }
          const after: Line[] = solo
            ? [
                { who: "me", text: "(…풀렸다. 따져 보니 답이 있다. 이 부대의 이상한 점들도, 이렇게 하나씩 따져 가면 풀릴지 모른다.)" },
                { who: "narr", text: "🌟 스스로 생각한 만큼, 흐려지던 기억이 조금 또렷해진다." },
              ]
            : [];
          const lines = [...(sc ? named(sc.outro) : []), ...after];
          if (lines.length) setOverlay({ type: "dialogue", script: { ...who, lines } });
        },
      });
    if (!sc) {
      puzzle();
      return;
    }
    setOverlay({ type: "dialogue", script: { ...who, lines: named(sc.intro) }, onDone: puzzle });
  };
  /**
   * 🧩 짬짬이 퍼즐 선택지 (장소 메뉴와, 그 상황을 꺼내는 포켓몬의 메뉴에 같은 것이 붙는다). 없으면 null.
   * 쉬움은 처음부터, 보통은 일병부터, 어려움은 상병부터 (짬이 차야 선임들이 어려운 문제를 내준다)
   */
  const quickOptionRef = useRef<(spot: string) => MenuOption | null>(() => null);
  quickOptionRef.current = (spot) => {
    const st = useGame.getState();
    const quick = QUICK_SPOTS[spot];
    if (!quick || !(st.clues.length > 0 || st.solo === spot) || st.puzzles[quick.puzzle]?.solved) return null;
    const lv = QUICK_LEVELS[PUZZLES[quick.puzzle]?.level ?? 1];
    const ranked = rankIdxForDay(st.day) >= lv.rank;
    const mealFirst = !!st.mealCheck && !st.mealCheck.done;
    const due = eventDue(st);
    const free = !mealFirst && !due && (isFreeTimeEvening(st.minute) || isMealTime(st.minute));
    return {
      label: `🧩 ${quick.label}`,
      hint: !ranked
        ? `${lv.stars} ${lv.name} · 🔒 ${RANKS[lv.rank]}부터`
        : free
          ? `짬짬이 퍼즐 · ${lv.stars} ${lv.name}`
          : due
            ? "⏰ 집합 시간 — 일정부터"
            : mealFirst
              ? "🍚 먼저 분대와 식사"
              : "점심·개인정비 시간에",
      disabled: !free || !ranked,
      onSelect: () => quickPlayRef.current(spot),
    };
  };

  /**
   * 😴 아침에 못 일어난 선임 깨우기 (data/reveille.ts).
   * 기상 방송이 나오면 분대 전원이 생활관에서 일어나는데, 짬이 찬 선임은 가끔 그대로 잔다 → 침상 옆에서 깨워 드려야 다 같이 점호에 나간다
   */
  const wakeSeniorRef = useRef<() => void>(() => {});
  wakeSeniorRef.current = () => {
    const st = useGame.getState();
    const key = sleepySenior(st);
    if (!key) return;
    const p = runtime.player;
    keys.current = {};
    p.moving = false;
    const who = memberFullName(st.branch, key, st.day);
    const isNpc = !key.startsWith("x:");
    // 침상 쪽을 보고 선다 · 깨어난 선임이 일어나 설 자리(침상 앞 통로)
    const bedRow = isNpc ? "top" : (EXTRA_BED[key.slice(2)]?.[2] ?? "top");
    const bedX = (isNpc ? BED_X[key as NpcId] : EXTRA_BED[key.slice(2)]?.[1]) ?? 1;
    p.dir = bedRow === "top" ? "up" : "down";
    const def = isNpc ? undefined : extraDefs.find((d) => `x:${d.id}` === key);
    const words = def?.title.split(" ") ?? [];
    const custom: SpeakerInfo | undefined = def
      ? { name: `${def.name} ${words[words.length - 1]}`, sub: words.slice(0, -1).join(" "), look: extraLook(def), cap: BRANCHES[st.branch].cap as CapType }
      : undefined;
    const aff = (n: number) => (isNpc ? { affinity: { [key]: n } as Partial<Record<NpcId, number>> } : {});
    const tip =
      '선임을 깨울 땐 침상 옆에서 낮고 또렷하게 "○○ 병장님, 기상 시간입니다." 모포를 걷거나 소리를 지르는 건 금물. 한 번에 안 일어나면 잠시 뒤 한 번 더.';
    setOverlay({
      type: "dialogue",
      script: {
        npc: isNpc ? (key as NpcId) : undefined,
        custom,
        lines: [
          { who: "narr", text: `${who}의 침상. 기상 방송이 지나갔는데도 모포가 규칙적으로 오르내린다.` },
          { who: "me", text: "(…깨워 드려야 한다. 선임 한 명이 점호에 늦으면 분대 전체가 혼난다. 그런데 어떻게 깨우지?)" },
        ],
        choices: [
          {
            text: `(침상 옆에 서서, 낮고 또렷하게) "${who}님, 기상 시간입니다."`,
            grade: "good",
            effects: { discipline: 1, ...aff(2) },
            reply: [
              { who: "npc", text: "…으음. 벌써 여섯 시냐." },
              { who: "npc", text: "…알았다, 일어난다. 깨워 줘서 고맙다. 점호 늦을 뻔했네." },
            ],
            tip,
          },
          {
            text: '(어깨를 살짝 흔든다) "…저, 일어나셔야 합니다."',
            grade: "ok",
            reply: [
              { who: "npc", text: "…5분만… (한쪽 눈을 뜬다) …아, 알았다. 알았어. 일어난다." },
              { who: "me", text: "(휴. 다음부턴 몸에 손대지 말고 말로 깨워 드리자.)" },
            ],
            tip,
          },
          {
            text: '(모포를 확 걷으며) "기상!!! 기상입니다!!!"',
            grade: "bad",
            effects: { discipline: -1, ...aff(-3) },
            reply: [
              { who: "npc", text: "으악?! …야. 너 지금, 나한테 한 거냐?" },
              { who: "narr", text: "생활관이 조용해졌다. 다들 못 본 척 모포만 갠다. …깨우긴 깨웠다." },
            ],
            tip,
          },
        ],
      },
      onChoice: (c) => {
        const s2 = useGame.getState();
        if (c.effects) s2.applyEffects(c.effects, "선임 깨우기");
        if (c.tip) s2.addTip(c.tip);
      },
      onDone: () => {
        const s2 = useGame.getState();
        // 선임이 침상 앞 통로로 내려선다: 내가 바로 그 자리에 서 있으면 한 칸 옆으로 비켜서서 마주 본다
        const ax = bedX + 0.5,
          ay = aisleY(bedRow) + 0.5;
        if (Math.hypot(p.x - ax, p.y - ay) < 0.9) {
          const side = [ax + 1, ax - 1].find((x) => !collides(world.maps.room1, x, ay));
          if (side !== undefined) {
            p.x = side;
            p.y = ay;
            p.dir = side > ax ? "left" : "right";
          }
        }
        s2.markDaily(WOKE_SENIOR);
        s2.log(fixJosa(`🛏️ 기상 시간에 못 일어난 ${who}을(를) 깨워 드렸다.`));
        s2.toast("🏃 이제 다 같이 연병장으로! 아침 점호 집합이다.", "alert");
      },
    });
  };
  // 😴 눈을 뜬 아침, 선임 한 명이 아직 자고 있는 날: 무엇을 해야 하는지 짧게 보여 준다 (그날 한 번)
  useEffect(() => {
    const tm = setTimeout(() => {
      const st = useGame.getState();
      const key = sleepySenior(st);
      if (!key || st.daily.includes(SLEEPY_SEEN) || overlayRef.current || st.scene !== "world") return;
      st.markDaily(SLEEPY_SEEN);
      const who = memberFullName(st.branch, key, st.day);
      keys.current = {};
      runtime.player.moving = false;
      setOverlay({
        type: "dialogue",
        script: {
          lines: [
            { who: "narr", text: "기상 방송이 울리고 생활관에 불이 켜졌다. 다들 벌떡 일어나 모포를 갠다." },
            { who: "narr", text: `…그런데 ${who}의 침상만 조용하다. 모포가 머리끝까지 덮여 있다.` },
            { who: "me", text: "(아직 주무신다. 이대로 나가면 분대 전체가 점호에 늦는다. 침상 옆에 가서 깨워 드리자.)" },
          ],
        },
        onDone: () => useGame.getState().toast(`😴 ${who}의 침상 옆에서 E — 깨워 드리고 점호에 나가자.`, "alert"),
      });
    }, 700);
    return () => clearTimeout(tm);
  }, [setOverlay]);

  /**
   * 🧩 야간 근무 퍼즐 (data/puzzles.ts NIGHT_PUZZLES): 그 근무에서 아직 풀지 않은 문제가 있으면 짧은 지문 뒤에 띄운다.
   * 풀든, 나중으로 미루든 근무는 그대로 이어진다 (then). 풀 문제가 없으면 곧바로 then
   */
  const nightPuzzleRef = useRef<(kind: "watch" | "guard", then: () => void) => void>(() => {});
  nightPuzzleRef.current = (kind, then) => {
    const st = useGame.getState();
    const next = NIGHT_PUZZLES[kind].find((n) => !st.puzzles[n.id]?.solved);
    const def = next ? PUZZLES[next.id] : undefined;
    if (!next || !def) {
      then();
      return;
    }
    const lv = QUICK_LEVELS[def.level ?? 1];
    setOverlay({
      type: "dialogue",
      script: { lines: next.intro },
      onDone: () =>
        setOverlay({
          type: "puzzle",
          id: next.id,
          onSolved: () => {
            useGame.getState().applyEffects(lv.reward, "야간 근무 퍼즐");
            then();
          },
          onClose: then,
        }),
    });
  };

  /** 1일차: 세수하고 생활관으로 돌아오자, 기다리던 맞선임이 정신 차리라고 한마디 한다 → 연병장으로 */
  const wakeTalkRef = useRef<() => void>(() => {});
  wakeTalkRef.current = () => {
    const p = runtime.player;
    const sn = npcs.current.senior;
    keys.current = {};
    p.moving = false;
    if (sn) {
      p.dir = Math.abs(sn.x - p.x) > Math.abs(sn.y - p.y) ? (sn.x > p.x ? "right" : "left") : sn.y > p.y ? "down" : "up";
      sn.dir = Math.abs(p.x - sn.x) > Math.abs(p.y - sn.y) ? (p.x > sn.x ? "right" : "left") : p.y > sn.y ? "down" : "up";
    }
    setOverlay({
      type: "dialogue",
      script: {
        npc: "senior" as NpcId,
        lines: [
          { who: "npc", text: "어, 신병 왔냐. 세수는 하고 왔고?" },
          { who: "npc", text: "어제 전입 와서 피곤한 건 알겠는데, 정신 차리자. 첫 점호부터 늦으면 분대 전체가 찍힌다." },
          { who: "me", text: "(…어제 전입? 나는 어젯밤 내 방 침대에서 잠들었는데. 여기 사람들한테는 내가 어제 온 신병인 거다.)" },
          { who: "npc", text: "뭘 그렇게 봐. 내 얼굴에 뭐 묻었냐? 분대장님은 먼저 나가셨다. 얼른 연병장으로 뛰어!" },
        ],
      },
      onDone: () => {
        const s2 = useGame.getState();
        s2.applyEffects({ flag: "wakeTalk" }, undefined, true);
        s2.toast("🏃 연병장으로! 아침 점호 집합이다. (화면 위 안내와 붉은 원을 따라가자)", "alert");
      },
    });
  };

  /** 🚿 전입 첫날 화장실 세면대: 세수하고 고개를 들어, 거울 속의 내 모습을 처음 본다 */
  const mirrorScene = useCallback(() => {
    keys.current = {};
    runtime.player.dir = "up";
    runtime.player.moving = false;
    setOverlay({
      type: "dialogue",
      script: {
        lines: [
          { who: "narr", text: "수도꼭지를 틀고 차가운 물을 얼굴에 끼얹었다. 한 번, 두 번. 조금 정신이 든다." },
          { who: "me", text: "(침착하자. 꿈일 거야. 고개를 들면 평소의 내 얼굴이 있을 거야…)" },
          { who: "narr", text: "천천히 고개를 들어, 세면대 거울을 봤다." },
        ],
      },
      onDone: () =>
        setOverlay({
          type: "mirror",
          onDone: () => {
            const s2 = useGame.getState();
            s2.applyEffects({ flag: "sawSelf" }, undefined, true);
            s2.log("🪞 화장실 거울에서 처음으로 내 모습을 봤다. 내가… 포켓몬?!");
            s2.toast("🏃 분대장이 3분 준다고 했다. 일단 1생활관으로 돌아가자. (화면 위 안내와 ❗ 표시를 따라가자)", "alert");
            s2.save();
          },
        }),
    });
  }, [setOverlay]);

  // 1일차 첫 점호가 끝나면: 밀덕 주인공의 다짐 + 조작 안내
  const prevRollcall = useRef(rollcall);
  useEffect(() => {
    const was = prevRollcall.current;
    prevRollcall.current = rollcall;
    const st = useGame.getState();
    if (!was || rollcall || st.day !== 1 || st.flags.tutorial) return;
    st.applyEffects({ flag: "tutorial" }, undefined, true);
    setOverlay({
      type: "dialogue",
      script: {
        lines: [
          {
            who: "me",
            text: "(휴… 첫 점호는 어떻게든 넘겼다. 포켓몬 몸이라도 군대는 군대구나.)",
          },
          {
            who: "me",
            text: "(유튜브에서 배운 대로만 하자. 집합은 무조건 5분 전, 대답은 크게, 모르면 솔직하게 물어보기!)",
          },
          {
            who: "narr",
            text: "[조작] WASD/방향키 이동 · E/Space 상호작용 · R 생활관 바로 가기 · Tab 수첩",
          },
          {
            who: "narr",
            text: '상단에 다음 일정과 장소가 뜬다. 시계는 저절로 흐르지 않는다: 그 장소에 도착하면 일정이 시작된다. 자유 시간이 남았을 때는 그 장소에서 E를 눌러 시작한다.',
          },
          {
            who: "narr",
            text: "건물 문으로 드나들고, 길 끝(표지판)으로 걸어가면 병영식당·PX·위병소 같은 다른 구역으로 이동한다. 막사 2층엔 체단실·싸지방·도서관이 있다.",
          },
        ],
      },
    });
  }, [rollcall, setOverlay]);

  // ───────────── 점호 의식 (아침: 연병장 정렬 / 저녁: 생활관 침상) ─────────────
  const cer = useRef<CeremonyRt | null>(null);
  const [cerShow, setCerShow] = useState<{
    info: CeremonyInfo;
    aide: SpeakerInfo | null;
  } | null>(null);
  const actorRt = useCallback(
    (who: string): CerActor | undefined =>
      who === "me"
        ? runtime.player
        : who.startsWith("x:")
          ? extras.current[who.slice(2)]
          : npcs.current[who as NpcId],
    [],
  );
  const cerCtl = useMemo<CeremonyCtl>(
    () => ({
      pose: (p) => {
        const c = cer.current;
        if (c && c.pose !== p) {
          c.pose = p;
          c.poseT0 = performance.now() / 1000;
        }
      },
      bubble: (text) => {
        if (cer.current) cer.current.bubble = text;
      },
      move: (who, tx, ty, dur, endDir) => {
        const c = cer.current;
        const a = actorRt(who);
        if (!c || !a) return;
        c.moves = c.moves.filter((m) => m.a !== a);
        c.moves.push({
          a,
          fx: a.x,
          fy: a.y,
          tx,
          ty,
          t0: performance.now() / 1000,
          dur,
          endDir,
        });
      },
      stand: (who) => {
        cer.current?.seated.delete(who);
      },
    }),
    [actorRt],
  );

  useEffect(() => {
    if (!rollcall || cer.current) return;
    const st = useGame.getState();
    const kind = rollcall.kind === "rollcall_am" ? "am" : "pm";
    const present = presentNpcs(st.day);
    let duty: CeremonyInfo["duty"] = st.day % 2 === 1 ? "lt" : "sgm";
    if (!present.includes(duty)) duty = "cpt";
    const leader = currentSquadLeader(st.day) as CeremonyInfo["leader"];
    const soldiers = SOLDIER_IDS.filter((id) => present.includes(id));
    const ensure = (id: NpcId): NpcRt =>
      npcs.current[id] ??
      (npcs.current[id] = {
        map: "outdoor",
        x: 0,
        y: 0,
        dir: "down",
        moving: false,
        path: [],
        targetKey: "",
        viaDoor: null,
      });
    const place = (
      a: CerActor & {
        path?: [number, number][];
        viaDoor?: Door | null;
        targetKey?: string;
      },
      m: MapId,
      x: number,
      y: number,
      dir: Dir,
    ) => {
      a.map = m;
      a.x = x;
      a.y = y;
      a.dir = dir;
      a.moving = false;
      if (a.path) {
        a.path = [];
        a.viaDoor = null;
        a.targetKey = "cer";
      }
    };
    // 엑스트라는 게임 루프 첫 프레임에서 생기므로, 월드가 뜨자마자 점호가 시작되면 아직 없을 수 있다 → 여기서 만든다
    const ensureExtra = (id: string): ExtraRt | undefined => {
      const def = extraDefs.find((d) => d.id === id);
      if (!def) return undefined;
      return (
        extras.current[id] ??
        (extras.current[id] = {
          map: def.map,
          x: def.x + 0.5,
          y: def.y + 0.5,
          dir: "down",
          moving: false,
          path: [],
          targetKey: "",
          viaDoor: null,
          wait: Math.random() * 2,
          routeIdx: 0,
        })
      );
    };
    const ncoDef = extraDefs.find((d) => d.id === "nco");
    const nco = ncoDef ? ensureExtra(ncoDef.id) : undefined;
    const members: string[] = [];
    const seated = new Set<string>();
    let marks: CeremonyInfo["marks"];
    let total: number;
    if (kind === "am") {
      // 연병장: 구령대(y=17)를 바라보고 6열로 오와 열을 맞춘다
      const sp = world.spots.parade;
      const order: string[] = [...soldiers];
      if (!rollcall.late)
        order.splice(Math.max(0, order.indexOf("buddy")), 0, "me");
      for (const def of extraDefs)
        if (!def.officer && !def.wild && !["dog", "guard", "cook"].includes(def.id))
          order.push("x:" + def.id);
      if (rollcall.late) order.push("me");
      let i = 0;
      for (const k of order) {
        const a =
          k === "me"
            ? runtime.player
            : k.startsWith("x:")
              ? ensureExtra(k.slice(2))
              : ensure(k as NpcId);
        if (!a) continue;
        place(
          a,
          "outdoor",
          sp.x - 2 + (i % 6),
          sp.y - 1.5 + Math.floor(i / 6),
          "up",
        );
        members.push(k);
        i++;
      }
      place(ensure(duty), "outdoor", sp.x + 5.5, sp.y - 2.5, "left");
      let ox = sp.x - 3.5;
      for (const id of ["cpt", "lt", "sgm"] as NpcId[]) {
        if (id === duty || !present.includes(id)) continue;
        place(ensure(id), "outdoor", ox, sp.y - 3.4, "down");
        ox -= 1;
      }
      if (nco) place(nco, "outdoor", sp.x + 4.5, sp.y - 3.4, "down");
      marks = {
        stage: [sp.x + 0.5, sp.y - 4.45],
        leader: [0, 0],
        duty: [0, 0],
        aide: [0, 0],
        door: [0, 0],
      };
      total = members.length;
    } else {
      // 1생활관: 위쪽 침상 줄에 걸터앉아 통로를 바라본다 (내 자리는 3번 침상)
      const others = [1, 5, 9, 11, 13];
      place(runtime.player, "room1", 3.5, 3.55, "down");
      seated.add("me");
      members.push("me");
      soldiers.forEach((id, i) => {
        if (i >= others.length) return;
        place(
          ensure(id),
          "room1",
          (BED_X[id] ?? others[i]) + 0.5,
          3.55,
          "down",
        );
        seated.add(id);
        members.push(id);
      });
      // 1생활관에 사는 엑스트라(1분대 상병 등)도 빈 침상에 걸터앉고 인원에 들어간다
      const usedX = new Set(
        members.map((k) => {
          const a = k === "me" ? runtime.player : npcs.current[k as NpcId];
          return a ? Math.floor(a.x) : -1;
        }),
      );
      let roomExtras = 0;
      for (const def of extraDefs) {
        if (def.map !== "room1" || def.officer) continue;
        const a = ensureExtra(def.id);
        const bx = [13, 11, 9, 1, 5, 7].find((x) => !usedX.has(x));
        if (!a || bx === undefined) continue;
        usedX.add(bx);
        place(a, "room1", bx + 0.5, 3.55, "down");
        seated.add("x:" + def.id);
        members.push("x:" + def.id);
        roomExtras++;
      }
      place(ensure(duty), "room1", 7.5, 1.3, "down");
      if (nco) place(nco, "room1", 6.5, 1.3, "down");
      marks = {
        stage: [0, 0],
        leader: [6.5, 5.5],
        duty: [8.6, 5.6],
        aide: [10.5, 6.1],
        door: [6.5, 1.3],
      };
      total = soldiers.length + 1 + roomExtras;
    }
    cer.current = {
      kind,
      pose: "stand",
      poseT0: performance.now() / 1000,
      bubble: null,
      members,
      seated,
      moves: [],
    };
    const aide: SpeakerInfo | null =
      ncoDef && nco
        ? {
            name: ncoDef.name,
            sub: ncoDef.title,
            look: extraLook(ncoDef),
            cap: ("officer-" + b.cap) as CapType,
          }
        : null;
    setCerShow({
      info: { kind, duty, leader, total, late: rollcall.late, marks },
      aide,
    });
  }, [rollcall, world, extraDefs, b.cap]);

  const finishCeremony = useCallback(() => {
    const c = cer.current;
    if (c) {
      // 침상(통과 불가)에서 통로로 내려오고, 모두 원래 일정대로 다시 길을 찾는다
      for (const k of c.seated) {
        const a = actorRt(k);
        if (a) a.y = 4.5;
      }
      for (const n of Object.values(npcs.current))
        if (n) {
          n.path = [];
          n.viaDoor = null;
          n.targetKey = "";
          n.moving = false;
        }
      for (const e of Object.values(extras.current)) {
        e.path = [];
        e.viaDoor = null;
        e.targetKey = "";
        e.moving = false;
      }
      runtime.player.moving = false;
    }
    cer.current = null;
    setCerShow(null);
    useGame.getState().closeRollcall();
  }, [actorRt]);

  // 🧪 테스터 모드 미션 종료 (Game의 F9 단축키가 보낸다)
  // 점호 의식 → 바로 종료 / 그 외 → 현재 일정 종료
  useEffect(() => {
    const onSkip = () => {
      const c = cer.current;
      if (c) {
        finishCeremony();
        useGame
          .getState()
          .toast(
            `🧪 테스터 모드: ${c.kind === "am" ? "아침" : "저녁"} 점호 종료`,
            "info",
          );
        return;
      }
      if (overlayRef.current) setOverlay(null);
      const st = useGame.getState();
      const ev = st.currentEvent();
      if (!ev) {
        st.toast("🧪 진행 중인 미션이 없습니다.", "info");
        return;
      }
      if (ev.kind === "farewell") {
        st.beginEvent();
        return;
      }
      st.completeEvent();
      useGame.getState().toast(`🧪 테스터 모드: "${ev.label}" 종료`, "info");
    };
    window.addEventListener("tester-skip", onSkip);
    return () => window.removeEventListener("tester-skip", onSkip);
  }, [finishCeremony, setOverlay]);

  // 오마주: 처음 위병소 구역에 들어서면 위병이 외친다 "기다려! 풀숲은 위험해!"
  useEffect(() => {
    if (location !== "depot") return;
    const st = useGame.getState();
    if (st.flags.depotIntro || st.rollcall || overlayRef.current)
      return;
    const def = extraDefs.find((d) => d.id === "guard");
    if (!def) return;
    st.applyEffects({ flag: "depotIntro" }, undefined, true);
    const words = def.title.split(" ");
    setOverlay({
      type: "dialogue",
      script: {
        custom: {
          name: `${def.name} ${words[words.length - 1]}`,
          sub: words.slice(0, -1).join(" "),
          look: extraLook(def),
          cap: BRANCHES[st.branch].cap as CapType,
        },
        lines: [
          { who: "npc", text: "잠깐! 기다려! 거기 풀숲은 위험해!" },
          {
            who: "npc",
            text: "…밤마다 {wild}이(가) 튀어나온다고. 위병소 근무 서다 보면 진짜 깜짝 놀란다.",
          },
          { who: "me", text: "(이 대사… 어디서 많이 들어 본 것 같은데.)" },
        ],
      },
    });
  }, [location, extraDefs, setOverlay]);

  // 📖 N-01 안개 너머: 위병소 정문 밖으로 나가면 하얘졌다가 초소 앞으로 돌아온다
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    playSfx("sfx_flash", 0.7);
    const tm = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(tm);
  }, [flash]);
  /** 키로 사람(주요 NPC 또는 'x:엑스트라') 런타임 찾기 */
  const entityOf = useCallback(
    (key: string) =>
      (key.startsWith("x:")
        ? extras.current[key.slice(2)]
        : npcs.current[key as NpcId]) ?? null,
    [],
  );
  /** 대본용 화자: 주요 NPC면 npc, 엑스트라면 custom */
  const speakerOf = useCallback(
    (key: string): { npc?: NpcId; custom?: SpeakerInfo; who: LineWho } => {
      if (!key.startsWith("x:"))
        return { npc: key as NpcId, who: key as NpcId };
      const def = extraDefs.find((d) => d.id === key.slice(2));
      if (!def) return { who: "narr" };
      const words = def.title.split(" ");
      return {
        who: "npc",
        custom: {
          name: `${def.name} ${words[words.length - 1]}`,
          sub: words.slice(0, -1).join(" "),
          look: extraLook(def),
          cap: BRANCHES[useGame.getState().branch].cap as CapType,
        },
      };
    },
    [extraDefs],
  );
  /** 사람을 그 자리로 바로 옮긴다 (자다가 일어남 등) */
  /**
   * 🎬 장면을 위해 세워 둔 사람들. 대화가 끝날 때까지 평소 움직임(식사 행군 · 침상으로 돌아가기 · 다음 목적지)을 멈추고 그 자리에 선다.
   * 대화창이 닫히면(화면 전환 중이 아닐 때) 비워져서 다시 제 할 일을 한다.
   */
  const staged = useRef<Set<string>>(new Set());
  /** 📢 호출 · 보고를 기다리는 사람이 서 있는 자리: 내가 그 방에 들어서면 거기 서서 나를 기다린다 */
  const waitAt = useRef<{ key: string; map: MapId; x: number; y: number; dir: Dir } | null>(null);
  /** 🚶 장면 속에서 걸어가는 중인 사람들 ('me' 포함): 길(칸)을 따라 걷고, 도착하면 dir을 보고 선 뒤 then */
  const sceneWalk = useRef<Record<string, { path: [number, number][]; dir: Dir; then?: () => void; done: boolean }>>({});
  const placeAt = useCallback(
    (key: string, map: MapId, x: number, y: number, dir: Dir) => {
      const e = entityOf(key);
      if (!e) return;
      staged.current.add(key);
      e.map = map;
      e.x = x;
      e.y = y;
      e.dir = dir;
      e.path = [];
      e.viaDoor = null;
      e.targetKey = `${map}:${Math.floor(x)},${Math.floor(y)}`;
      e.moving = false;
    },
    [entityOf],
  );

  // 👟 오마주: 전입 첫날, 첫 점호와 조작 안내가 끝나면 분대장이 런닝슈즈를 건넨다 (받기 전에는 달릴 수 없다)
  useEffect(() => {
    const st = useGame.getState();
    if (
      overlay ||
      rollcall ||
      cer.current ||
      st.day !== 1 ||
      !st.flags.tutorial ||
      st.flags.runShoes ||
      st.nightDuty
    )
      return;
    st.applyEffects({ flag: "runShoes" }, undefined, true);
    // 분대장이 내 옆으로 다가와 선다
    const p = runtime.player;
    const map = world.maps[p.map];
    const [ox, oy] = (
      [
        [1.1, 0],
        [-1.1, 0],
        [0, 1.1],
        [0, -1.1],
      ] as const
    ).find(([dx, dy]) => !collides(map, p.x + dx, p.y + dy)) ?? [0, 0];
    p.dir = ox > 0 ? "right" : ox < 0 ? "left" : oy < 0 ? "up" : "down";
    p.moving = false;
    keys.current = {};
    placeAt(
      "sgt",
      p.map,
      p.x + ox,
      p.y + oy,
      ox > 0 ? "left" : ox < 0 ? "right" : oy < 0 ? "down" : "up",
    );
    setOverlay({
      type: "dialogue",
      script: {
        npc: "sgt" as NpcId,
        lines: [
          { who: "npc", text: "{me}. 잠깐 이리 와 봐." },
          {
            who: "npc",
            text: "신병 보급품이다. 아까 늦잠 자느라 너만 못 받았지. 자, 받아라.",
          },
          {
            who: "narr",
            text: "분대장에게서 런닝슈즈를 받았다! {me}은(는) 그 자리에서 런닝슈즈로 갈아 신었다.",
          },
          {
            who: "npc",
            text: '상자에 설명서도 들어 있네. 어디 보자… "Shift를 누른 채 이동하면 달릴 수 있습니다. 쿠션이 좋아 아무리 뛰어도 지치지 않습니다!"',
          },
          {
            who: "npc",
            text: "…Shift가 뭔지는 모르겠다만. 군대는 뭐든 신속이다. 집합에 늦을 것 같으면 뛰어!",
          },
          {
            who: "me",
            text: "(런닝슈즈를 받고, 설명서를 읽어 주고… 이 전개, 어디서 많이 겪어 본 것 같은데. 그땐 엄마였던 것 같기도 하고.)",
          },
        ],
      },
      onDone: () => {
        const s2 = useGame.getState();
        s2.toast(
          "👟 런닝슈즈를 손에 넣었다! Shift(터치: 달리기 버튼)를 누른 채 이동하면 달린다.",
          "good",
        );
        s2.log("👟 분대장에게 런닝슈즈를 받았다.");
        s2.addTip(
          "달리기: Shift를 누른 채 이동하면 달린다. 지치지 않으니 얼마든지 계속 뛰어도 된다.",
        );
      },
    });
  }, [overlay, rollcall, world, placeAt, setOverlay]);

  // ❓ 새 의혹: 알림으로 불쑥 띄우지 않고, 조작할 수 있게 된 순간 주인공이 이상한 점을 스스로 떠올린다.
  // 여러 개가 쌓였으면 한 번에 이어서 떠올리고, 하루가 바뀌며 생긴 의혹은 아침 점호를 마친 뒤(08:00~)에 떠올린다.
  const susNote = useGame((s) => s.susNote);
  const minuteNow = useGame((s) => s.minute);
  useEffect(() => {
    if (!susNote.length || overlay || rollcall || minuteNow < 8 * 60) return;
    const tm = setTimeout(() => {
      const st = useGame.getState();
      if (
        !st.susNote.length || overlayRef.current || holdRef.current || cer.current || st.rollcall || st.work || st.scene !== "world" ||
        st.nightDuty?.phase === "sleep" || meInBed.current || myMeal.eating || useSettings.getState().open ||
        (st.day === 1 && !st.flags.wokeUp)
      )
        return;
      const lines: Line[] = [];
      for (const id of st.susNote) {
        const d = SUSPICIONS.find((x) => x.id === id);
        if (!d) continue;
        const lead = suspicionLeads(d, st).slice(-1)[0];
        if (lead) lines.push({ who: "narr", text: lead });
        lines.push({ who: "me", text: `(…${d.question})` });
        lines.push({ who: "narr", text: `❓ 수첩에 의혹을 적었다 — 「${d.title}」 (Tab → 의혹)` });
      }
      for (const id of [...st.susNote]) st.popSusNote(id);
      if (!lines.length) return;
      runtime.player.moving = false;
      keys.current = {};
      setOverlay({ type: "dialogue", script: { lines } });
    }, 350);
    return () => clearTimeout(tm);
  }, [susNote, overlay, rollcall, minuteNow, setOverlay]);

  /** 📖 스토리 장면이 쓰는 연결: 대화 · 이동 · 사람 배치 · 저항 게이지 */
  const storyCtx = useMemo<StoryCtx>(
    () => ({
      play: (sc) =>
        setOverlay({
          type: "dialogue",
          script: sc.script,
          bg: sc.bg,
          bgm: sc.bgm ?? undefined,
          onChoice: sc.onChoice,
          onDone: sc.onDone,
        }),
      goTo: (map, x, y, dir, then) => {
        keys.current = {};
        // 화면이 바뀌는 동안에는 조작과 다른 이벤트를 막는다.
        // then은 "그 자리에 도착한 순간"(화면이 어두워진 사이)에 부른다 → 사람들을 세우고, 화면이 밝아지며 장면이 시작된다
        holdRef.current = true;
        let fired = false;
        const fire = () => {
          if (fired) return;
          fired = true;
          holdRef.current = false;
          then();
        };
        const req = {
          tiles: [],
          to: map,
          enterDir: dir,
          arrive: { x, y, dir },
          onArrive: fire,
        } as unknown as Door;
        warpReq.current = req;
        // 화면이 멈춰 있어(탭이 가려져 프레임이 안 도는 등) 전환이 끝나지 않을 때를 대비한 안전장치.
        // 대화가 엉뚱한 곳에서 시작되지 않도록, 먼저 그 자리로 옮기고 나서 다음 일을 시작한다.
        setTimeout(() => {
          if (fired) return;
          if (warpReq.current === req) warpReq.current = null;
          const p = runtime.player;
          p.map = map;
          p.x = x;
          p.y = y;
          p.dir = dir;
          p.moving = false;
          setLocation(map);
          fire();
        }, 2500);
      },
      place: (key, map, x, y, dir) => placeAt(key, map, x, y, dir),
      walk: (key, x, y, dir, then) => {
        const a = key === "me" ? runtime.player : entityOf(key);
        const p = runtime.player;
        if (!a || a.map !== p.map) {
          then?.();
          return;
        }
        keys.current = {};
        if (key !== "me") staged.current.add(key);
        // 걷는 동안에는 조작과 다른 이벤트를 막는다 (도착하면 풀고 then)
        holdRef.current = true;
        const m = world.maps[a.map];
        sceneWalk.current[key] = {
          path: findPath(m, Math.floor(a.x), Math.floor(a.y), x, y).slice(1),
          dir,
          then,
          done: false,
        };
      },
      meTile: () => [Math.floor(runtime.player.x), Math.floor(runtime.player.y)],
      alone: (map, keep) => {
        sceneAlone.map = map;
        sceneAlone.hide = new Set(
          Object.entries(extras.current)
            .filter(([id, e]) => e.map === map && !keep.includes(`x:${id}`))
            .map(([id]) => id),
        );
        sceneAlone.hideNpc = new Set(
          Object.entries(npcs.current)
            .filter(([id, n]) => !!n && n.map === map && !keep.includes(id))
            .map(([id]) => id),
        );
      },
      near: (key, d) => {
        const e = entityOf(key);
        const p = runtime.player;
        return !!e && e.map === p.map && Math.hypot(e.x - p.x, e.y - p.y) <= d;
      },
      resist: (opts, done) => {
        keys.current = {};
        setOverlay({ type: "resist", opts, onDone: done });
      },
      flash: () => setFlash(true),
      puzzle: (id, solved, failed) => {
        keys.current = {};
        setOverlay({ type: "puzzle", id, onSolved: solved, onFail: failed });
      },
    }),
    [setOverlay, placeAt, entityOf],
  );
  // 🪖 일과 장면: 집합이 끝나면 그 시간에 있었던 일을 짧은 대화로 보여 주고 일과를 마친다
  const work = useGame((s) => s.work);
  const workStaged = useRef("");
  useEffect(() => {
    if (!work) {
      workStaged.current = "";
      return;
    }
    const st = useGame.getState();
    const stageKey = `${st.day}:${work.eventId}`;
    if (overlay || workStaged.current === stageKey) return;
    workStaged.current = stageKey;
    const title = BRANCHES[st.branch].games[work.game];
    const sc = workScene(st.day, work.slot, title);
    keys.current = {};
    const start = () => {
      holdRef.current = false;
      setOverlay({
        type: "dialogue",
        script: sc ?? {
          lines: [{ who: "narr", text: `${title}. 구슬땀을 흘리며 일과를 마쳤다.` }],
        },
        onChoice: (c) => {
          if (c.effects) useGame.getState().applyEffects(c.effects, title);
        },
        onDone: () => {
          useGame.getState().finishWork();
          // 🍚 일과가 끝난 자리에서 곧장 식당으로 가는 날: 분대장이 그 자리에서 인솔한다 (생활관에 모였다 가는 날과 번갈아)
          const s2 = useGame.getState();
          const mc = s2.mealCheck;
          if (s2.scene !== "world" || !mc || mc.done || !isMealTime(s2.minute) || !mealFromWork(s2.day, mc.meal)) return;
          if (mealCall.key === `${s2.day}-${mc.meal}` || mealCall.talking) return;
          const lead0 = squadLeadKey(s2.day);
          const lead = lead0 && entityOf(lead0) ? lead0 : null;
          if (!lead && !squadKeys(s2.branch, s2.day).length) return; // 분대원이 없는 날은 혼자 간다
          mealCallRef.current(lead, true);
        },
      });
    };
    // 🎬 먼저 집합 장소에 분대원과 (말을 하는) 간부가 모여 선 다음에 장면이 시작된다
    const ev = st.currentEvent();
    const sp = ev?.spot ? world.spots[ev.spot] : null;
    if (!sp) {
      start();
      return;
    }
    const gm = world.maps[sp.map];
    const taken = new Set<string>([`${sp.x},${sp.y}`]);
    /** (x, y)에서 가장 가까운, 비어 있고 서 있을 수 있는 칸 */
    const standNear = (x: number, y: number): [number, number] => {
      for (let r = 0; r <= 4; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const tx = x + dx,
              ty = y + dy;
            if (isSolid(gm, tx, ty) || taken.has(`${tx},${ty}`)) continue;
            taken.add(`${tx},${ty}`);
            return [tx + 0.5, ty + 0.5];
          }
      return [x + 0.5, y + 0.5];
    };
    const gather = () => {
      const s2 = useGame.getState();
      const soldiers = presentNpcs(s2.day).filter((n) => !NPC_ROLES[n].officer);
      soldiers.forEach((id, i) => {
        const [dx, dy] = FORMATION[i % FORMATION.length];
        const [x, y] = standNear(sp.x + dx, sp.y + dy);
        placeAt(id, sp.map, x, y, "down");
      });
      // 장면에서 말을 하는 간부는 대열 앞에 선다
      const speakers = new Set<string>();
      for (const l of sc?.lines ?? []) speakers.add(l.who);
      for (const c of sc?.choices ?? []) for (const l of c.reply) speakers.add(l.who);
      (["lt", "sgm", "cpt"] as NpcId[])
        .filter((id) => speakers.has(id) && npcPresent(id, s2.day))
        .forEach((id, i) => {
          const [x, y] = standNear(sp.x + [-1, 1, 0][i], sp.y - 4);
          placeAt(id, sp.map, x, y, "down");
        });
    };
    const p = runtime.player;
    const here = p.map === sp.map && Math.hypot(p.x - (sp.x + 0.5), p.y - (sp.y + 0.5)) < 3.5;
    holdRef.current = true;
    if (here) {
      p.dir = "up";
      p.moving = false;
      gather();
      start();
    } else {
      storyCtxRef.current.goTo(sp.map, sp.x + 0.5, sp.y + 0.5, "up", () => {
        gather();
        start();
      });
    }
  }, [work, overlay, setOverlay, world, placeAt]);

  // 📋 명령 전달: 할 수 있게 된 스토리 미션이 있으면, 자유 시간에 시킨 사람이 나를 부른다(호출).
  // 화면이 옮겨 주지 않는다 → 내가 직접 그 사람이 있는 곳으로 걸어가 마주 서면 명령을 듣고,
  // 일을 마치면 다시 내 발로 돌아가 보고한다. (가야 할 곳이 있는 동안 다른 문은 열리지 않는다 · data/errands.ts)
  const lastOrder = useRef<{ day: number; minute: number } | null>(null);
  /** 📢 저녁 점호로 넘어가려는데 아직 받지 않은 임무가 있다 → 뜸 들이지 않고 곧바로 부른다 */
  const forceCall = useRef(false);
  useEffect(() => {
    const faceTo = (fx: number, fy: number, tx: number, ty: number): Dir =>
      Math.abs(tx - fx) > Math.abs(ty - fy) ? (tx > fx ? "right" : "left") : ty > fy ? "down" : "up";
    /** 마주 선 뒤: 명령을 듣는다 → 큰 임무 카드 */
    const playOrder = (id: string) => {
      const st = useGame.getState();
      const o = ORDERS[id];
      const present = npcPresent(o.giver, st.day);
      const brief = o.brief.replace("{ammo}", FACILITY_NAME[st.branch]);
      setOverlay({
        type: "dialogue",
        script: present
          ? { npc: o.giver, lines: o.order }
          : {
              lines: [
                {
                  who: "narr",
                  text: `생활관 문 옆 당번표에 내 이름이 적혀 있다. 「${brief}」 누가 적었는지는 알 수 없다.`,
                },
              ],
            },
        onDone: () => {
          const s2 = useGame.getState();
          s2.applyEffects({ flag: `order_${id}` }, undefined, true);
          s2.log(`📋 임무를 받았다: ${brief}`);
          // 📋 임무 안내는 화면 가운데 큰 카드로 보여 준다
          setOverlay({
            type: "notice",
            info: {
              icon: "📋",
              kicker: "새 임무",
              title: brief,
              from: present ? `${npcDisplayName(s2.branch, o.giver, s2.day)}의 지시` : "당번표에 적힌 이름",
              lines: ["화면 위 안내와 ❗ 표시를 따라가자. 퀘스트 창(Q)에서 다시 확인할 수 있다."],
            },
          });
        },
      });
    };
    /** 마주 선 뒤: 일을 마쳤다고 보고한다 */
    const playReport = (id: string) => {
      const st = useGame.getState();
      const o = ORDERS[id];
      const present = npcPresent(o.giver, st.day);
      setOverlay({
        type: "dialogue",
        script: present
          ? { npc: o.giver, lines: o.report }
          : {
              lines: [
                {
                  who: "narr",
                  text: '보고하러 왔지만, 일을 시킨 사람의 자리는 비어 있다. 당번표에 "완료"라고만 적어 두었다. 아무도 그 이름을 묻지 않는다.',
                },
              ],
            },
        onDone: () => {
          const s2 = useGame.getState();
          s2.applyEffects(
            { flag: `report_${id}`, discipline: 1, affinity: present ? { [o.giver]: 2 } : undefined },
            "임무 보고",
            true,
          );
          s2.toast("✅ 보고 완료. 다시 자유롭게 움직일 수 있다.", "good");
          s2.log(`📋 임무를 마치고 보고했다: ${o.brief.replace("{ammo}", FACILITY_NAME[s2.branch])}`);
        },
      });
    };
    /** 마지막으로 다른 일(대화 · 장면 전환 · 식사)이 끝난 때. 곧바로 또 부르지 않고 숨 돌릴 틈을 준다 */
    let idleSince = performance.now();
    const iv = setInterval(() => {
      const st = useGame.getState();
      const p = runtime.player;
      if (
        overlayRef.current || holdRef.current || st.scene !== "world" || st.busy ||
        st.rollcall || st.nightDuty || st.patrol || st.work || cer.current ||
        useSettings.getState().open || myMeal.eating || myMeal.tray || warpReq.current
      ) {
        idleSince = performance.now();
        return;
      }
      // 🍳 내가 분대장인 날: 아침 점호가 끝나면 분대를 인솔해 바로 아침을 먹으러 간다
      if (breakfastPending(st)) {
        breakfastRef.current();
        return;
      }
      const er = errandNow(st);
      // 🏃 심부름: 시킨 곳에 닿았다 → 그다음부터는 다시 자유롭게 다닐 수 있다
      if (er?.kind === "errand" && er.id && p.map === er.map) {
        st.applyEffects({ flag: `at_${er.id}` }, undefined, true);
        return;
      }
      // 📢 호출 · 📋 보고: 그 방에 들어서면 그 사람이 제자리에서 기다리고, 다가가 마주 서면 장면이 시작된다
      if (er && (er.kind === "summon" || er.kind === "report") && er.id) {
        const id = er.id;
        const o = ORDERS[id];
        const present = npcPresent(o.giver, st.day);
        const at = er.kind === "summon" ? orderStage(id, st.day) : reportStage(id, st.day);
        // 그 사람은 제자리로 가서 기다린다. 내 눈에 보이는 동안에는 걸어서 가고, 보이지 않을 때만 곧바로 가 있다 (메인 루프)
        const ge = npcs.current[o.giver];
        if (present)
          waitAt.current = { key: o.giver, map: at.map, x: at.giver[0], y: at.giver[1], dir: at.giver[2] };
        if (p.map !== at.map) return;
        if (Math.hypot(p.x - at.giver[0], p.y - at.giver[1]) > 3.4) return;
        // 그 사람이 아직 자리에 닿지 못했으면(걸어오는 중) 기다린다
        if (present && ge && (ge.map !== at.map || Math.hypot(ge.x - at.giver[0], ge.y - at.giver[1]) > 1.2)) return;
        waitAt.current = null;
        keys.current = {};
        p.moving = false;
        p.dir = faceTo(p.x, p.y, at.giver[0], at.giver[1]);
        if (present) placeAt(o.giver, at.map, at.giver[0], at.giver[1], faceTo(at.giver[0], at.giver[1], p.x, p.y));
        if (er.kind === "summon") playOrder(id);
        else playReport(id);
        return;
      }
      waitAt.current = null;
      if (er) return;
      // 🔎 혼자 살펴보러 가던 곳: 자유 시간이 끝났거나 그 퍼즐을 풀었으면 접는다
      const freeNow = orderWindow(st) && !(st.mealCheck && !st.mealCheck.done);
      if (
        st.solo &&
        (!freeNow || (st.puzzles[QUICK_SPOTS[st.solo]?.puzzle ?? ""]?.solved && !wanderAt(st.solo, st.day, st.flags)))
      ) {
        soloLead.spot = null;
        useGame.setState({ solo: null });
      }
      // 📢 새 호출: 자유 시간에, 밥을 다 먹은 뒤에만 부른다
      if (!freeNow) return;
      // 방금 다른 일(보고 · 식사 복귀 · 대화)을 마쳤으면 몇 초는 기다렸다가 부른다
      if (!forceCall.current && performance.now() - idleSince < 5000) return;
      // 한 번 부르고 나면 한동안은 다시 부르지 않는다
      const lo = lastOrder.current;
      const recent = !forceCall.current && !!lo && lo.day === st.day && st.minute - lo.minute < 40;
      const m = !recent ? nextCallable(st) : undefined;
      forceCall.current = false;
      // 📋 지시받은 임무가 아직 진행 중이거나, 곧 부를 임무가 남아 있으면 혼자 실마리를 찾아 나서지 않는다 (두 가지 일이 겹치지 않게)
      const busyMission =
        !!nextCallable(st) ||
        (st.clues.length > 0 && STORY_MISSIONS.some((x) => !!ORDERS[x.id] && !!st.flags[`order_${x.id}`] && missionState(x, st) === "open"));
      if (!m && busyMission) return;
      if (!m) {
        // 🔎 부르는 사람이 없는 자유 시간: 가만히 있지 않고, 혼자서라도 실마리를 찾아 나선다 (자유 시간마다 한 번)
        const win = st.minute < 15 * 60 ? "lunch" : "dinner";
        const sk = `solo_${win}`;
        if (st.daily.includes(sk)) return;
        const quickSpot = nextQuickSpot(rankIdxForDay(st.day), (id) => !!st.puzzles[id]?.solved);
        // 따져 볼 퍼즐이 남지 않았으면(또는 아직 계급에 막혀 있으면) 혼자 부대를 걸으며 눈에 담아 둔다
        const walk = quickSpot ? null : nextWander(st.day, st.flags);
        const spot = quickSpot ?? walk?.spot ?? null;
        if (!spot) return;
        st.markDaily(sk);
        soloLead.key = `${st.day}-${win}`;
        soloLead.spot = spot;
        soloLead.tried = false;
        useGame.setState({ solo: spot });
        const place = spotLabel(st.branch, spot as SpotId);
        keys.current = {};
        p.moving = false;
        setOverlay({
          type: "dialogue",
          script: {
            lines: [
              {
                who: "me",
                text:
                  st.clues.length === 0
                    ? win === "lunch"
                      ? "(…자유 시간이다. 다들 아무렇지 않게 웃고 떠든다. 나만 이 상황이 이상한 건가.)"
                      : "(일과가 끝났다. 정신없이 하루가 갔는데, 왜 내가 여기 있는지는 아직도 모르겠다.)"
                    : win === "lunch"
                      ? "(…자유 시간이다. 가만히 있으면 오늘도 그냥 지나간다.)"
                      : "(개인정비 시간. 다들 편하게 쉰다. 편한 게 이상하다고 느끼는 건 나뿐인 것 같다.)",
              },
              walk
                ? {
                    who: "me",
                    text: "(지금 따져 볼 수 있는 건 다 따져 봤다. 그래도 가만히 앉아 있으면 하루가 흐려진다. 걷자. 걸으면서 하나라도 더 눈에 담아 두자.)",
                  }
                : {
                    who: "me",
                    text: "(누가 알려 주길 기다려서는 안 된다. 혼자서라도 이 부대의 실마리를 찾아봐야겠다. 작은 것부터, 눈에 걸리는 것부터.)",
                  },
              {
                who: "me",
                text: walk
                  ? `(…${place} 쪽으로 가 보자. 지나다니기만 했지, 제대로 본 적은 없다.)`
                  : `(…${place} 쪽이 아까부터 마음에 걸린다. 가 보자.)`,
              },
            ],
          },
          onDone: () =>
            useGame
              .getState()
              .toast(
                walk
                  ? `🚶 혼자 걷기 — ${place}에 가 보자. (❗ 표시를 따라가자)`
                  : `🔎 혼자 실마리 찾기 — ${place}에 가 보자. (❗ 표시를 따라가자)`,
                "info",
              ),
        });
        return;
      }
      const o = ORDERS[m.id];
      const present = npcPresent(o.giver, st.day);
      const at = orderStage(m.id, st.day);
      lastOrder.current = { day: st.day, minute: st.minute };
      // 혼자 살펴보러 가던 길이었다면 접는다: 부르는 사람이 먼저다
      if (st.solo) {
        soloLead.spot = null;
        useGame.setState({ solo: null });
      }
      keys.current = {};
      p.moving = false;
      st.applyEffects({ flag: `summon_${m.id}` }, undefined, true);
      const who = npcDisplayName(st.branch, o.giver, st.day);
      const room = MAP_NAMES[at.map];
      const meName = `${RANKS[rankIdxForDay(st.day)]} ${st.name}`;
      const office = at.map === "admin" || at.map === "command";
      st.log(present ? `📢 ${who}의 호출을 받았다.` : "📢 당번표에 새 이름이 적혔다는 말을 들었다.");
      // 같은 방에 있으면 방송이나 전달 없이, 그 사람이 그 자리에서 직접 부른다 (다가가면 바로 이야기가 시작된다)
      if (present && p.map === at.map) {
        st.toast(`📢 ${who}: "${st.name}, 잠깐 이리 와 봐라."`, "alert");
        return;
      }
      setOverlay({
        type: "notice",
        info: present
          ? {
              icon: "📢",
              kicker: "호출",
              title: fixJosa(office ? `${room}(으)로 오라는 호출이다` : `${who}이(가) ${room}에서 찾는다`),
              from: `${who} · 📍 ${room}`,
              lines: [
                fixJosa(
                  office
                    ? `(막사 스피커) "${room}에서 전달한다. ${meName}, ${meName}은(는) 지금 즉시 ${room}(으)로 올 것. 이상."`
                    : `지나가던 분대원이 전해 줬다. "야, ${who}님이 생활관에서 너 찾으시더라. 얼른 가 봐."`,
                ),
                "직접 걸어가자. 화면 위 안내와 ❗ 표시가 길을 알려 준다.",
              ],
            }
          : {
              icon: "📢",
              kicker: "호출",
              title: "당번표에 새 이름이 적혔다",
              from: "📍 1생활관 문 옆 당번표",
              lines: ["누가 적었는지는 아무도 모른다고 한다.", "직접 걸어가서 확인하자."],
            },
      });
    }, 400);
    return () => clearInterval(iv);
  }, [setOverlay, placeAt]);

  const storyCtxRef = useRef(storyCtx);
  /** 짧은 연출 중(사람이 걸어 나가는 동안 등)에는 조작을 잠시 막는다 */
  const holdRef = useRef(false);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__story = {
      ctx: storyCtx,
      storySpotOptions,
      storyNpcOptions,
      storyExtraOptions,
      roofOptions,
      slipperBoss,
      finalStar,
      buddyForgets,
    };
  }, [storyCtx]); // 개발용 디버그 핸들
  const m13Tried = useRef(false);
  const libHint = useRef(0);
  storyCtxRef.current = storyCtx;
  /** 슬리퍼(가짜 당직부관)가 서 있는 곳 (사건 중에만) */
  const slipper = useRef<{ map: MapId; x: number; y: number } | null>(null);
  /** 📖 스토리 상호작용 (옥상 철문 · 구령대의 별) */
  const storyActRef = useRef<(key: string) => void>(() => {});
  storyActRef.current = (key: string) => {
    const st = useGame.getState();
    if (key === "roof") {
      // 옥상은 추리 정리 1을 마쳤거나, 옥상 일을 맡았을 때(이불 당번 등) 열린다
      const roofOpen = st.flags.roof || st.flags["order_D-02"] || st.flags["order_D-03"];
      if (!roofOpen) {
        setOverlay({
          type: "dialogue",
          script: {
            lines: [
              { who: "narr", text: "옥상으로 가는 철문. 굳게 잠겨 있다." },
            ],
          },
        });
        return;
      }
      setOverlay({
        type: "menu",
        title: "🌌 막사 옥상",
        subtitle: "철문 너머로 밤하늘이 보인다",
        options: [
          ...roofOptions(storyCtx),
          { label: "닫기", onSelect: () => setOverlay(null) },
        ],
      });
      return;
    }
    if (key === "final") finalStar(storyCtx);
  };

  /** 🌙 내가 침상에 누워 있는지 (소등 후 ~ 근무자가 깨워서 일어날 때까지) */
  const meInBed = useRef(false);
  /** 내 침상에 눕는다 (1생활관 위쪽 줄 3번 침상) */
  const lieInBed = useCallback(() => {
    const p = runtime.player;
    p.map = "room1";
    p.x = 3.5;
    p.y = bedY("top");
    p.dir = "down";
    p.moving = false;
    keys.current = {};
    meInBed.current = true;
  }, []);
  /** 🌙 소등 후 잠들어 있다가 → 근무 시간에 깨어난다 (깨우는 말을 듣고 나서야 침상에서 나온다) */
  const nightWake = useCallback(() => {
    const st = useGame.getState();
    const nd = st.nightDuty;
    if (!nd || nd.phase !== "sleep") return;
    useGame.setState({
      minute: nd.kind === "guard" ? nd.shiftStart - 20 : nd.shiftStart - 2,
    });
    lieInBed();
    // 당직 간부는 진작 지휘통제실 책상에 앉아 있다 (점호 뒤 생활관에 남아 있다가 보이지 않게)
    {
      const off = npcs.current[dutyOfficerNow(st.day)];
      if (off && off.map !== DUTY_DESK[0]) {
        off.map = DUTY_DESK[0];
        off.x = DUTY_DESK[1] + 0.5;
        off.y = DUTY_DESK[2] + 0.5;
        off.dir = "down";
        off.path = [];
        off.viaDoor = null;
        off.targetKey = `${DUTY_DESK[0]}:${DUTY_DESK[1]},${DUTY_DESK[2]}`;
        off.moving = false;
      }
    }
    placeAt(nd.prev, "room1", 4.5, 4.2, "left"); // 내 침상 머리맡 통로에 쪼그려 앉아 깨운다
    st.setNightDuty({ phase: "woken" });
    const sp = speakerOf(nd.prev);
    const prevName = memberName(st.branch, nd.prev);
    /** 누운 채로 깨우는 말을 듣고 → 침상에서 나와 통로에 선 뒤 → 나머지 대화 */
    const wakeThen = (lines: Line[], onDone: () => void) => {
      setOverlay({
        type: "dialogue",
        script: { npc: sp.npc, custom: sp.custom, lines: lines.slice(0, 2) },
        onDone: () => {
          const p = runtime.player;
          meInBed.current = false;
          p.map = "room1";
          p.x = 3.5;
          p.y = 4.5;
          p.dir = "right";
          p.moving = false;
          keys.current = {};
          setOverlay({
            type: "dialogue",
            script: { npc: sp.npc, custom: sp.custom, lines: lines.slice(2) },
            onDone,
          });
        },
      });
    };
    if (nd.kind === "watch") {
      const nextName = memberName(st.branch, nd.next);
      // 깨우러 온 사람이 내 후임이면 존댓말로 깨우고, 나는 편하게 받는다
      const prevJunior = juniorToMe(nd.prev, st.day);
      wakeThen(
        [
          {
            who: "narr",
            text: "(누군가 어깨를 조심스럽게 흔든다…) 23:58. 생활관은 숨소리뿐이다.",
          },
          {
            who: sp.who,
            text: prevJunior
              ? "(속삭이며) {myrank}님… {me} {myrank}님. 일어나십시오. 불침번 근무 시간입니다."
              : "(속삭이며) {me}… {me}. 일어나. 불침번 근무 시간이다.",
          },
          {
            who: "me",
            text: prevJunior
              ? "(비몽사몽, 모포를 걷고 침상에서 내려온다) …어, 그래. 일어났어."
              : "(비몽사몽, 모포를 걷고 침상에서 내려온다) …네. 일어났습니다.",
          },
          {
            who: sp.who,
            text: prevJunior
              ? `근무 인수인계입니다. 특이사항 없음, 화장실 간 인원 없음. 손전등이랑 근무일지 여기 있습니다. 다음 근무자는 ${nd.next.startsWith("x:") ? nextName : `${npcDisplayName(st.branch, nd.next as NpcId, st.day)}님`}, 00:50에 깨우시면 됩니다.`
              : `근무 인수인계. 특이사항 없음, 화장실 간 인원 없음. 손전등이랑 근무일지 여기. 다음 근무자는 ${nextName}, 00:50에 깨워서 교대해.`,
          },
          { who: "me", text: prevJunior ? "(작게) 응, 수고했어. 들어가 자." : "(작게) 네, 수고하셨습니다." },
          {
            who: "narr",
            text: `${josa(prevName, "이", "가")} 조용히 자기 침상으로 돌아간다. 나는 근무 신고를 하러 지휘통제실로 간다.`,
          },
        ],
        () => {
          const s2 = useGame.getState();
          // 🌙 인수인계 끝 → 화면이 옮겨 주지 않는다. 내가 직접 지휘통제실로 걸어가 근무 신고를 한다
          s2.setNightDuty({ phase: "checkin" });
          s2.addTip(
            "불침번: 취침 시간에 생활관을 지키는 근무. 이전 근무자가 깨우면 인수인계(특이사항·인원·물품)를 받고, 당직 간부에게 근무 신고를 한 뒤 생활관을 돌며, 끝나기 10분 전쯤 다음 근무자를 깨워 교대한다.",
          );
          // 깨우러 왔던 이전 근무자는 이제 풀려나 자기 침상으로 걸어간다
          staged.current.clear();
          s2.toast("🔦 먼저 지휘통제실 당직 간부에게 근무 신고를 하러 가자.", "info");
        },
      );
    } else {
      const iAmJunior = rankIdxForDay(st.day) <= 1;
      wakeThen(
        iAmJunior
          ? [
              {
                who: "narr",
                text: "(누군가 발끝으로 다가와 이불을 툭툭 친다…) 23:40.",
              },
              {
                who: sp.who,
                text: "(속삭이며) 야, {me}. 일어나. 위병소 근무 가자. …쉿, 조용히. 다른 애들 깬다.",
              },
              {
                who: "me",
                text: "(모포를 걷고 조용히 침상에서 내려온다) …네, 일어났습니다.",
              },
              {
                who: sp.who,
                text: "전투복 입고 나와. 00시 교대니까 늦지 않게 앞장서. 내가 뒤따라간다.",
              },
              {
                who: "narr",
                text: `[사수 ${josa(prevName, "과", "와")} 함께 위병소 초소로 가자. 깨어 있는 건 당직병과 당직사령뿐이다.]`,
              },
            ]
          : [
              {
                who: "narr",
                text: "(누군가 조심스럽게 어깨를 흔든다…) 23:40.",
              },
              {
                who: sp.who,
                text: "(속삭이며) {me} {myrank}님… 근무 시간입니다.",
              },
              {
                who: "me",
                text: "(침상에서 내려오며, 작게) 어, 그래. 조용히 준비하고 따라와.",
              },
              {
                who: "narr",
                text: `[부사수 ${josa(prevName, "을", "를")} 데리고 위병소 초소로 가자. 깨어 있는 건 당직병과 당직사령뿐이다.]`,
              },
            ],
        () => {
          useGame.getState().setNightDuty({ phase: "toPost" });
          useGame
            .getState()
            .addTip(
              "야간 경계근무는 사수·부사수 2인 1조. 자는 인원이 깨지 않게 조용히 일어나 함께 이동하고, 초소에서 이전 근무자와 교대한다.",
            );
        },
      );
    }
  }, [placeAt, speakerOf, setOverlay, lieInBed]);

  useEffect(() => {
    if (nightPhase === "sleep") {
      lieInBed();
      const tm = setTimeout(() => nightWake(), 3200);
      return () => clearTimeout(tm);
    }
    const st = useGame.getState();
    const nd = st.nightDuty;
    if (!nd) return;
    if (nightPhase === "wakeNext")
      st.toast(
        `🔦 00:50 — 근무 끝나기 10분 전. 다음 근무자 ${josa(memberName(st.branch, nd.next), "을", "를")} 깨워 교대하자.`,
        "alert",
      );
    if (nightPhase === "report" && nd.kind === "guard")
      st.toast(
        "🌙 02:00 — 다음 근무자와 교대했다. 사수·부사수와 함께 지휘통제실에 근무 철수 보고하러 가자.",
        "info",
      );
    if (nightPhase === "toPost")
      st.toast("🌙 위병소 초소로! 같이 근무 서는 사람이 뒤따라온다.", "info");
  }, [nightPhase, nightWake]);

  /** 🌙 야간 근무 상호작용: 위병소 교대 · 다음 근무자 깨우기 · 취침 · 별빛 */
  const nightActRef = useRef<(key: string) => void>(() => {});
  nightActRef.current = (key: string) => {
    const st = useGame.getState();
    const nd = st.nightDuty;
    if (!nd) return;
    if (key === "duty_star") {
      const lines = NIGHT_STAR_LINES[st.day] ?? [
        "…(빛이 무언가 말하려다 흩어졌다)",
      ];
      setOverlay({
        type: "dialogue",
        script: {
          custom: { name: "??? (별빛)", sub: "", look: null, cap: null },
          lines: [
            {
              who: "narr",
              text:
                nd.kind === "watch"
                  ? "창가에 작은 별빛이 떠 있다. 손전등을 비춰도 그림자가 생기지 않는다…"
                  : "안개 낀 길 위에 작은 별빛이 둥실 떠 있다. 사수는 못 본 것 같다…",
              sfx: "sfx_star_twinkle",
            },
            ...lines.map((t) => ({ who: "npc" as const, text: t })),
            { who: "narr", text: "눈을 한 번 깜빡이자, 빛은 사라지고 없었다." },
          ],
        },
        onDone: () => {
          const s2 = useGame.getState();
          s2.applyEffects(
            { memory: 2, mental: 1, flag: `star_${s2.day}` },
            "의문의 별빛",
          );
          s2.log("✨ 야간 근무 중 의문의 별빛을 만났다.");
        },
      });
      return;
    }
    if (
      key === "duty_post" &&
      st.day === 11 &&
      st.clues.length > 0 &&
      !st.flags.b01
    ) {
      const sp = world.spots.post;
      slipper.current = { map: sp.map, x: sp.x + 0.5, y: sp.y - 2.2 };
      slipperBoss(storyCtx, () => {
        slipper.current = null;
        nightActRef.current("duty_post");
      });
      return;
    }
    if (key === "duty_post") {
      const guard = extraDefs.find((d) => d.id === "guard");
      const gs = guard ? speakerOf("x:guard") : { who: "narr" as const };
      setOverlay({
        type: "dialogue",
        script: {
          custom: gs.custom,
          lines: [
            {
              who: "me",
              text: "근무 교대! 근무자 {me} 외 1명, 근무 투입하겠습니다!",
            },
            {
              who: gs.who,
              text: "수고. 특이사항 없음. 정문 쪽에 안개가 좀 꼈으니 잘 봐. 암구호는 근무일지에.",
            },
            {
              who: "narr",
              text: `이전 근무자들이 하품을 하며 막사로 돌아간다. 초소엔 나와 ${nd.partner ? memberName(st.branch, nd.partner) : "근무자"} 둘뿐.`,
            },
          ],
        },
        onDone: () => {
          const s2 = useGame.getState();
          s2.setNightDuty({ phase: "shift" });
          useGame.setState({
            minute: Math.max(s2.minute, s2.nightDuty!.shiftStart),
          });
          {
            // 🌙 근무 시간에 있었던 일 (data/workScenes.ts의 NIGHT_SCENES)
            const s3 = useGame.getState();
            const pKey = s3.nightDuty?.partner ?? null;
            const partner = pKey ? memberName(s3.branch, pKey) : "근무자";
            // 같이 선 사람이 말할 땐 그 사람의 초상화가 뜬다
            const psp = pKey && entityOf(pKey) ? speakerOf(pKey) : null;
            const hasFace = !!psp && (!!psp.npc || !!psp.custom);
            setOverlay({
              type: "dialogue",
              script: { ...nightScene(s3.day, "guard", partner, hasFace), npc: psp?.npc, custom: psp?.custom },
              onChoice: (c) => {
                if (c.effects)
                  useGame.getState().applyEffects(c.effects, "야간 근무");
              },
              onDone: () =>
                // 🧩 근무 시간이 끝나기 전, 초소에서 마주치는 문제 (선택) → 그 뒤에 교대
                nightPuzzleRef.current("guard", () => {
                  useGame.getState().finishShift();
                  // 🎬 다음 근무자가 올라와 교대하는 장면을 보여 준 뒤 복귀
                  setOverlay({
                    type: "dialogue",
                    script: {
                      lines: [
                        { who: "narr", text: "02:00. 막사 쪽에서 다음 근무자들이 하품을 하며 걸어온다." },
                        { who: "me", text: "근무 교대! 특이사항… 없음. 암구호는 근무일지에 있습니다." },
                        { who: "narr", text: `교대를 마쳤다. ${josa(partner === "근무자" ? "같이 선 근무자" : partner, "과", "와")} 함께 조용히 생활관으로 돌아가자.` },
                      ],
                    },
                  });
                }),
            });
          }
        },
      });
      return;
    }
    if (key === "duty_checkin") {
      // 🔦 근무 신고: 지휘통제실 당직 간부 앞에서 → 그 밤의 장면 → 생활관 순찰로
      st.setNightDuty({ phase: "shift" });
      useGame.setState({ minute: Math.max(st.minute, nd.shiftStart) });
      const pl = runtime.player;
      pl.dir = "up";
      pl.moving = false;
      keys.current = {};
      // 당직 간부는 책상 뒤에 앉아 있다
      placeAt(nightDutyOfficer(st.day), "command", 5.5, 2.5, "down");
      // 8일차: 2분대의 말 없는 병장이 문으로 들어와 일지 앞에 선다
      if (st.day === 8) placeAt("x:room2a", "command", 4.5, 5.6, "up");
      setOverlay({
        type: "dialogue",
        script: nightScene(st.day, "watch", "근무자"),
        onChoice: (c) => {
          if (c.effects) useGame.getState().applyEffects(c.effects, "야간 근무");
        },
        onDone: () => {
          useGame.getState().finishShift();
          // 그사이 나를 깨우고 돌아간 이전 근무자는 진작 자기 침상에서 자고 있다
          const prevKey = useGame.getState().nightDuty?.prev;
          const pe = prevKey ? entityOf(prevKey) : null;
          if (prevKey && pe) {
            const bed: [MapId, number, "top" | "bottom"] | undefined = prevKey.startsWith("x:")
              ? EXTRA_BED[prevKey.slice(2)]
              : BED_X[prevKey as NpcId] !== undefined
                ? ["room1", BED_X[prevKey as NpcId]!, "top"]
                : undefined;
            if (bed) {
              pe.map = bed[0];
              pe.x = bed[1] + 0.5;
              pe.y = bedY(bed[2]);
              pe.dir = "down";
              pe.path = [];
              pe.viaDoor = null;
              pe.moving = false;
            }
          }
          useGame.getState().toast("🔦 손전등을 들고 생활관 순찰: 2층 2생활관부터 돌아보고, 1생활관으로 돌아오자.", "info");
        },
      });
      return;
    }
    if (key === "duty_round2" || key === "duty_round1") {
      // 🔦 생활관 순찰: 그 생활관 안쪽까지 걸어 들어가 한 바퀴 돈다
      const room = key === "duty_round2" ? "room2" : "room1";
      const extra = WATCH_EXTRA[st.day]?.[room] ?? [];
      keys.current = {};
      runtime.player.moving = false;
      setOverlay({
        type: "dialogue",
        script: {
          lines:
            room === "room2"
              ? [
                  ...ROUND_ROOM2[Math.floor(st.day / 2) % ROUND_ROOM2.length].map((text) => ({ who: "narr" as const, text })),
                  ...extra,
                  { who: "me", text: "(2생활관 이상 무. 이제 1생활관으로 돌아가자.)" },
                ]
              : [
                  { who: "narr", text: ROUND_ROOM1[Math.floor(st.day / 2) % ROUND_ROOM1.length] },
                  ...extra,
                  { who: "narr", text: "근무 일지에 적는다. 「생활관 순찰, 이상 무」." },
                  { who: "narr", text: "…00:50. 근무가 끝나 간다. 다음 근무자를 깨울 시간이다." },
                ],
        },
        onDone: () => {
          const s2 = useGame.getState();
          const cur = s2.nightDuty;
          if (!cur || cur.phase !== "rounds") return;
          const rounds = [...(cur.rounds ?? []).filter((r) => r !== room), room];
          if (room === "room2") {
            s2.setNightDuty({ rounds });
            useGame.setState({ minute: Math.max(s2.minute, cur.shiftStart + 30) });
            // 🧩 순찰 중에 마주치는 문제 (선택)
            nightPuzzleRef.current("watch", () => {});
          } else {
            // 순찰 끝 → 다음 근무자를 깨워 교대
            s2.setNightDuty({ rounds, phase: "wakeNext" });
            useGame.setState({ minute: Math.max(s2.minute, cur.shiftEnd - 10) });
          }
        },
      });
      return;
    }
    if (key === "duty_wake") {
      const sp = speakerOf(nd.next);
      const nextName = memberName(st.branch, nd.next);
      const same = nd.next === "buddy";
      const forgotMe = same && buddyForgot(st);
      setOverlay({
        type: "dialogue",
        script: {
          npc: sp.npc,
          custom: sp.custom,
          lines: [
            {
              who: "me",
              text: same
                ? `(속삭이며) 야, ${nextName}. 일어나. 근무다.`
                : `(속삭이며) ${nextName}님… 일어나십시오. 불침번 근무 시간입니다.`,
            },
            {
              who: sp.who,
              text: forgotMe
                ? "…으음… 누, 누구… 아, 불침번 근무요? (나를 낯선 사람 보듯 본다) …네, 일어나겠습니다."
                : "…으음… 벌써 그렇게 됐어? …알았어, 일어날게.",
            },
            {
              who: "me",
              text: same
                ? "인수인계. 특이사항 없음, 화장실 간 인원 없음. 손전등이랑 근무일지 여기."
                : "근무 인수인계입니다. 특이사항 없음, 화장실 간 인원 없음. 손전등이랑 근무일지 여기 있습니다.",
            },
            // 별빛을 본 밤: 특이사항을 "없음"이라고 말하는 데 한 박자 걸린다
            ...(st.flags[`star_${st.day}`]
              ? [{ who: "narr" as const, text: "(창가의 별빛 이야기는 꺼내지 않았다. 말해도 아무도 믿지 않을 테니까.)" }]
              : []),
            forgotMe
              ? { who: sp.who, text: "(어색하게) …수고하셨습니다. 들어가 주무십시오." }
              : { who: sp.who, text: "(하품) 수고했어. 들어가 자." },
          ],
        },
        onDone: () => {
          const s2 = useGame.getState();
          const e = entityOf(nd.next);
          if (e) {
            // 침상에서 나와 통로 가운데에 선다 (깨운 나와 겹치지 않게)
            e.y = 5.5;
            e.path = [];
            e.viaDoor = null;
            e.targetKey = "";
          }
          s2.setNightDuty({ nextAwake: true, phase: "report" });
          s2.toast("📋 교대 완료. 지휘통제실 당직 간부에게 근무 철수 보고하고 자자.", "info");
        },
      });
      return;
    }
    if (key === "duty_report") {
      const off = dutyOfficerNow(st.day);
      const sp = speakerOf(off);
      const watch = nd.kind === "watch";
      const nextName = nd.next ? memberName(st.branch, nd.next) : "다음 근무자";
      setOverlay({
        type: "dialogue",
        script: {
          npc: sp.npc,
          custom: sp.custom,
          lines: watch
            ? [
                { who: "me", text: `(작게) "근무 철수 보고드립니다! 다음 근무자 ${nextName}에게 인계 완료했습니다."` },
                ...(WATCH_EXTRA[st.day]?.report
                  ? [{ who: "npc" as const, text: "(작게) 그래, 수고했다. 생활관은 어떻더냐?" }]
                  : [{ who: "npc" as const, text: "(근무 일지에 서명하며) 수고했다. 조용히 들어가 자라. 아침 점호 늦지 말고." }]),
              ]
            : [
                { who: "me", text: '"근무 철수 보고드립니다! 위병소 경계근무 중 특이사항 없음, 다음 근무자에게 인계 완료했습니다!"' },
                { who: "npc", text: "그래, 추운데 고생했다. 둘 다 들어가 자라." },
              ],
          choices: watch ? WATCH_EXTRA[st.day]?.report : undefined,
        },
        onChoice: (c) => {
          if (c.effects) useGame.getState().applyEffects(c.effects, "근무 철수 보고");
        },
        onDone: () => {
          const s2 = useGame.getState();
          s2.setNightDuty({ phase: "return" });
          s2.addTip("근무를 마치면 다음 근무자에게 인계하고, 당직 간부에게 \"근무 철수 보고\"를 한 뒤 들어가 쉰다.");
          s2.toast("🛏️ 철수 보고 완료. 내 침상으로 돌아가 자자.", "info");
        },
      });
      return;
    }
    if (key === "duty_sleep") {
      const sp = nd.partner ? speakerOf(nd.partner) : null;
      setOverlay({
        type: "dialogue",
        script: {
          npc: sp?.npc,
          custom: sp?.custom,
          lines:
            nd.kind === "guard" && sp
              ? [
                  {
                    who: sp.who,
                    text:
                      rankIdxForDay(st.day) <= 1
                        ? "(속삭이며) 수고했다. 얼른 자라. 아침 점호 늦지 말고."
                        : "(속삭이며) 수고하셨습니다, {me} {myrank}님. 안녕히 주무십시오.",
                  },
                  {
                    who: "narr",
                    text: "조용히 모포를 덮었다. 발이 아직 차갑다.",
                  },
                ]
              : [
                  {
                    who: "narr",
                    text: `모포를 덮었다. 이제 깨어 있는 건 ${memberName(st.branch, nd.next)}, 그리고 지휘통제실의 당직병뿐…`,
                  },
                ],
        },
        onDone: () => useGame.getState().finishNightDuty(),
      });
    }
  };

  /** 🍚 먹는 중 매 프레임: 고른 속도대로 먹고, 다 먹으면 일어난다 */
  const mealTickRef = useRef<() => void>(() => {});
  mealTickRef.current = () => {
    const st = useGame.getState();
    const e = myMeal.eating;
    if (!e) return;
    const finish = (
      text: string,
      eff: Parameters<typeof st.applyEffects>[0],
      tone: "good" | "bad" | "info" = "info",
    ) => {
      myMeal.eating = null;
      myMeal.tray = "";
      st.applyEffects(eff, e.meal === "lunch" ? "점심" : "저녁");
      st.log(text);
      st.toast(text, tone);
    };
    if (!isMealTime(st.minute)) {
      finish("🍚 배식 시간이 끝나 남은 밥을 급히 비웠다.", {
        hp: 12,
        mental: 1,
      });
      return;
    }
    // 밥상 대화가 끝나면(prog = 1) 다 먹고 수저를 내려놓는다
    if (e.prog < 1) return;
    finish(
      e.meal === "lunch"
        ? "🍚 점심 잘 먹었습니다! 식판을 깨끗이 비웠다."
        : "🍚 저녁 잘 먹었습니다! 식판을 깨끗이 비웠다.",
      { hp: 15, mental: 2 },
      "good",
    );
  };

  /**
   * 🍚 내 자리에 앉아 밥을 먹는다: 먹는 동안 분대원들과 밥상 대화를 나누고(data/mealTalks.ts), 대화가 끝나면 다 먹는다.
   * 처음 한 번만 밥차에서 식판을 받아 직접 앉고, 그다음부터는 식당에 도착하면 이미 식판을 받아 자리에 앉아 있다.
   */
  const startMealRef = useRef<(meal: "lunch" | "dinner") => void>(() => {});
  startMealRef.current = (meal) => {
    const st = useGame.getState();
    const p = runtime.player;
    p.map = "mess";
    p.x = MY_MEAL_SEAT[0] + 0.5;
    p.y = MY_MEAL_SEAT[1] + 0.5;
    p.dir = "down";
    p.moving = false;
    keys.current = {};
    // 내가 앉는 이 순간부터 분대의 식사 시간이 흐른다
    mealSeated(st.day, st.minute);
    mealRt.me = st.minute;
    myMeal.tray = meal;
    myMeal.eating = { meal, prog: 0.4, last: st.minute, dur: SQUAD_EAT_MIN, mode: "match", lead: null, bonus: false };
    st.markDaily(`meal_${meal}`);
    const mealEnd = meal === "lunch" ? 13 * 60 : 18 * 60 + 30;
    st.spend(Math.max(0, Math.min(SQUAD_EAT_MIN, mealEnd - 1 - st.minute)));
    setOverlay({
      type: "dialogue",
      script: {
        lines: [
          { who: "narr", text: "식판을 앞에 두고 1분대 줄, 내 자리에 앉았다. 잘 먹겠습니다!" },
          ...mealTalk(st.day, meal, presentNpcs(st.day)),
        ],
      },
      onDone: () => {
        if (myMeal.eating) myMeal.eating.prog = 1;
      },
    });
  };

  // 🍚 식사: 1생활관에 모인 분대에게 분대장이 "밥 먹으러 가자" → 화면 전환 → 다 같이 병영식당 입구
  // (fromWork: 일과가 끝난 자리에서 분대장이 생활관에 들르지 않고 곧장 인솔한다)
  const mealCallRef = useRef<(lead: string | null, fromWork?: boolean) => void>(() => {});
  mealCallRef.current = (lead, fromWork = false) => {
    const st = useGame.getState();
    const p = runtime.player;
    p.moving = false;
    keys.current = {};
    mealCall.talking = true;
    const meal = mealOf(st.minute);
    // 분대장이 외치고 내가 받는다 / 내가 분대장이면 내가 외치고 후임이 받는다
    const resp = lead ? null : squadResponder(st.day);
    const sp = speakerOf(lead ?? resp ?? "buddy");
    const call = fromWork
      ? meal === "lunch"
        ? lead
          ? "오전 일과 끝! 생활관에 들를 것 없이 이대로 식당으로 간다. 2열 종대로 따라와."
          : "오전 일과 끝! 생활관에 들를 것 없이 이대로 다 같이 밥 먹으러 가자."
        : lead
          ? "오늘 일과 끝! 다들 고생했다. 이대로 다 같이 저녁 먹으러 간다. 따라와."
          : "오늘 일과 끝! 다들 고생했어. 이대로 다 같이 저녁 먹으러 가자."
      : meal === "lunch"
        ? "자, 1생활관! 점심 먹으러 가자. 다들 따라와."
        : "오늘 일과 끝! 다들 저녁 먹으러 가자.";
    setOverlay({
      type: "dialogue",
      script: {
        npc: sp.npc,
        custom: sp.custom,
        lines: lead
          ? [
              { who: "npc", text: call },
              { who: "me", text: "넵, 알겠습니다!" },
            ]
          : [
              { who: "me", text: call },
              ...(resp
                ? [{ who: "npc" as const, text: resp === "buddy" ? "오케이~ 가자!" : "넵! 알겠습니다!" }]
                : []),
            ],
      },
      onDone: () => {
        const s2 = useGame.getState();
        mealCall.talking = false;
        mealCall.key = `${s2.day}-${mealOf(s2.minute)}`;
        mealCall.withMe = mealCall.key;
        if (s2.mealCheck && !s2.mealCheck.done) useGame.setState({ mealCheck: { ...s2.mealCheck, called: true } });
        const mealNow = mealOf(s2.minute);
        if (s2.flags.trayOnce) {
          // 두 번째 끼니부터: 배식은 건너뛴다. 다들 식판을 받아 자기 자리에 앉은 상태로 시작하고, 곧바로 밥상 대화가 이어진다
          squadKeys(s2.branch, s2.day).forEach((k) => {
            const en = entityOf(k);
            const seat: [number, number] | undefined = k.startsWith("x:")
              ? EXTRA_MEAL_SEAT[k.slice(2)]
              : MEAL_POS[k as NpcId]
                ? [MEAL_POS[k as NpcId]![1], MEAL_POS[k as NpcId]![2]]
                : undefined;
            if (!en || !seat) return;
            en.map = "mess";
            en.x = seat[0] + 0.5;
            en.y = seat[1] + 0.5;
            en.dir = "down";
            en.path = [];
            en.viaDoor = null;
            en.targetKey = `mess:${seat[0]},${seat[1]}`;
            en.moving = false;
          });
          holdRef.current = true;
          warpReq.current = {
            tiles: [],
            to: "mess",
            enterDir: "down",
            arrive: { x: MY_MEAL_SEAT[0] + 0.5, y: MY_MEAL_SEAT[1] + 0.5, dir: "down" },
            onArrive: () => {
              holdRef.current = false;
              startMealRef.current(mealNow);
            },
          } as unknown as Door;
          s2.toast(
            fromWork
              ? "🍚 일과를 마친 그대로 분대와 병영식당으로 왔다. 식판을 받아 1분대 줄에 앉았다."
              : "🍚 분대와 함께 병영식당으로 왔다. 식판을 받아 1분대 줄에 앉았다.",
            "info",
          );
          return;
        }
        // 첫 끼니: 분대원은 식당 입구 안쪽에 내려서 각자 자리로 가고, 나는 밥차에서 식판을 받는 법부터 배운다
        squadKeys(s2.branch, s2.day).forEach((k, i) => {
          const en = entityOf(k);
          if (!en) return;
          en.map = "mess";
          en.x = MESS_DOOR_IN[0] - 1 + (i % 3);
          en.y = MESS_DOOR_IN[1] - 1 - Math.floor(i / 3);
          en.dir = "up";
          en.path = [];
          en.viaDoor = null;
          en.targetKey = "";
          en.moving = false;
        });
        warpReq.current = {
          tiles: [],
          to: "mess",
          enterDir: "up",
          arrive: { x: MESS_DOOR_IN[0], y: MESS_DOOR_IN[1] + 0.2, dir: "up" },
        } as unknown as Door;
        s2.toast(
          fromWork
            ? "🍚 일과를 마친 그대로 분대와 병영식당에 도착했다. 밥차에서 식판을 받고 내 자리에 앉자."
            : "🍚 분대와 함께 병영식당에 도착했다. 밥차에서 식판을 받고 내 자리에 앉자.",
          "info",
        );
      },
    });
  };

  // 🍳 분대장의 아침: 점호가 끝난 자리에서 "아침 먹으러 간다" → 화면 전환 → 식당에 둘러앉아 밥상 대화 → 오전 일과로
  const breakfastRef = useRef<() => void>(() => {});
  breakfastRef.current = () => {
    const st = useGame.getState();
    st.markDaily("breakfast");
    const p = runtime.player;
    p.moving = false;
    keys.current = {};
    const resp = squadResponder(st.day);
    const sp = speakerOf(resp ?? "buddy");
    setOverlay({
      type: "dialogue",
      script: {
        npc: sp.npc,
        custom: sp.custom,
        lines: [
          { who: "me", text: "점호 끝! 1분대, 아침 먹으러 간다. 다들 따라와." },
          ...(resp ? [{ who: "npc" as const, text: resp === "buddy" ? "오케이~ 가자!" : "넵! 알겠습니다!" }] : []),
        ],
      },
      onDone: () =>
        storyCtxRef.current.goTo("mess", MY_MEAL_SEAT[0] + 0.5, MY_MEAL_SEAT[1] + 0.5, "down", () => {
          const s2 = useGame.getState();
          // 분대원들은 식판을 받아 자기 자리에 앉아 있다
          squadKeys(s2.branch, s2.day).forEach((k) => {
            const seat: [number, number] | undefined = k.startsWith("x:")
              ? EXTRA_MEAL_SEAT[k.slice(2)]
              : MEAL_POS[k as NpcId]
                ? [MEAL_POS[k as NpcId]![1], MEAL_POS[k as NpcId]![2]]
                : undefined;
            if (seat) placeAt(k, "mess", seat[0] + 0.5, seat[1] + 0.5, "down");
          });
          setOverlay({
            type: "dialogue",
            script: {
              lines: [
                { who: "narr", text: "분대원들과 식판을 받아 1분대 줄에 둘러앉았다. 이제는 내가 수저를 들어야 다들 먹기 시작한다." },
                ...breakfastTalk(s2.day, presentNpcs(s2.day)),
              ],
            },
            onDone: () => {
              const s3 = useGame.getState();
              s3.applyEffects({ hp: 8, mental: 1 }, "아침 식사");
              s3.log("🍳 분대를 인솔해 아침을 먹었다.");
              s3.toast("🍳 분대와 아침을 먹었다. 이제 오전 일과 장소로 가자.", "info");
            },
          });
        }),
    });
  };

  // 🍚 다 먹은 뒤: 최선임이 "생활관 간다" → 화면 전환 → 분대와 다 같이 1생활관
  const mealBackRef = useRef<(lead: string | null) => void>(() => {});
  mealBackRef.current = (lead) => {
    const p = runtime.player;
    p.moving = false;
    keys.current = {};
    mealCall.talking = true;
    const resp = lead ? null : squadResponder(useGame.getState().day);
    const sp = speakerOf(lead ?? resp ?? "buddy");
    setOverlay({
      type: "dialogue",
      script: {
        npc: sp.npc,
        custom: sp.custom,
        lines: lead
          ? [
              { who: "npc", text: "다들 다 먹었지? 식판 반납하고, 생활관으로 간다." },
              { who: "me", text: "넵!" },
            ]
          : [
              { who: "me", text: "다들 다 먹었지? 식판 반납하고, 생활관 가자." },
              ...(resp
                ? [{ who: "npc" as const, text: resp === "buddy" ? "오케이~" : "넵!" }]
                : []),
            ],
      },
      onDone: () => {
        const s2 = useGame.getState();
        mealCall.talking = false;
        mealCall.back = `${s2.day}-${mealOf(s2.minute)}`;
        s2.finishSquadMeal();
        // 분대원은 1생활관 통로(식사 집합 자리)에 내려서, 거기서 각자 할 일을 하러 간다
        squadKeys(s2.branch, s2.day).forEach((k) => {
          const en = entityOf(k);
          const g = MEAL_GATHER[k];
          if (!en || !g) return;
          en.map = g[0];
          en.x = g[1] + 0.5;
          en.y = g[2] + 0.5;
          en.dir = "down";
          en.path = [];
          en.viaDoor = null;
          en.targetKey = "";
          en.moving = false;
        });
        warpReq.current = {
          tiles: [],
          to: "room1",
          enterDir: "down",
          arrive: { x: 7.5, y: 5.5, dir: "down" },
        } as unknown as Door;
        s2.toast("🏠 분대와 함께 생활관으로 돌아왔다.", "info");
      },
    });
  };

  const fogEventRef = useRef<() => void>(() => {});
  fogEventRef.current = () => {
    const p = runtime.player;
    p.x = 13.5;
    p.y = 26.6;
    p.dir = "up";
    p.moving = false;
    keys.current = {};
    setFlash(true);
    setOverlay({
      type: "dialogue",
      script: {
        custom: { name: "안개 속 목소리", sub: "???", look: null, cap: null },
        lines: [
          { who: "narr", text: "정문 밖으로 한 발 내디뎠다. 사방이 하얗다…", sfx: "sfx_fog_whiteout" },
        ],
      },
      // 🧩 P-05 안개 너머: 어느 길로 가도 초소로 돌아온다. "나갈 수 없다"가 답이다
      onDone: () =>
        setOverlay({
          type: "puzzle",
          id: "P-05",
          onSolved: (reward) =>
            setOverlay({
              type: "dialogue",
              script: {
                custom: {
                  name: "안개 속 목소리",
                  sub: "???",
                  look: null,
                  cap: null,
                },
                lines: [
                  {
                    who: "narr",
                    text: "…정신을 차리니, 다시 초소 앞이다.",
                  },
                  { who: "npc", text: "…나가지 않아도 돼…" },
                  {
                    who: "me",
                    text: "(누구야…? 꿈속의 빛이랑은… 다른 목소리야.)",
                  },
                ],
              },
              onDone: () => useGame.getState().findClue("C-04", reward),
            }),
        }),
    });
  };
  const fogActive = (st: { day: number; minute: number; clues: string[] }) =>
    st.clues.length > 0 &&
    !st.clues.includes("C-04") &&
    ((st.day === 3 && st.minute >= 22 * 60) || st.day >= 4);

  // 👻 팬텀: 순찰 중 화장실을 점검하고 돌아섰을 때, 등 뒤 거울 속에서
  const phantomRef = useRef<() => void>(() => {});
  phantomRef.current = () => {
    const st = useGame.getState();
    const p = runtime.player;
    p.moving = false;
    keys.current = {};
    const first = !st.flags.phantomMet;
    const sp: SpeakerInfo = {
      name: first ? "??? (거울 속)" : "팬텀",
      sub: first ? "등 뒤 거울 속의 그림자" : "거울 속의 그림자",
      look: PHANTOM_LOOK,
      cap: null,
    };
    setOverlay({
      type: "dialogue",
      script: {
        custom: sp,
        lines: first
          ? [
              { who: "narr", text: "(…뒤통수가 서늘하다. 손전등 불빛이 저절로 흔들린다.)", sfx: "sfx_heartbeat" },
              { who: "narr", text: "(등 뒤, 세면대 거울 속에서 — 무언가가 나를 보며 웃고 있다.)", sfx: "jingle_shock" },
              { who: "npc", text: "키히히… 뒤돌아보지 마. 돌아보면 사라져 줄 테니까." },
              { who: "npc", text: "거울엔 네 얼굴이 안 비치지? 여기 오래 있으면 다 그렇게 돼. 그림자부터 없어지거든." },
              { who: "npc", text: "꿈을 먹는 녀석도 있지만… 나는 그림자를 먹어. 네 그림자, 맛있겠다." },
              { who: "me", text: "(이를 악물고 돌아섰다—)" },
              { who: "narr", text: "…아무것도 없다. 거울엔 손전등을 든 내 모습뿐이다. 아니, 저게 정말 내 모습인가?" },
            ]
          : [
              { who: "narr", text: "(또다. 등 뒤 거울 속에서, 그 웃음소리가.)", sfx: "sfx_heartbeat" },
              { who: "npc", text: "또 만났네? 이름 정도는 알려 줄게. 팬텀. 곧 친구가 될 테니까." },
              { who: "npc", text: "별 조각 모으는 거 다 봤어. 똑딱거리는 그 녀석한테 빼앗기기 전에… 마지막 밤엔 네 그림자를 나한테 놓고 가." },
              { who: "npc", text: "그럼 하나도 안 아파. 거울 속은 조용하고 따뜻하거든. 키히히…" },
              { who: "me", text: "(돌아서자—)" },
              { who: "narr", text: "거울은 다시 텅 비어 있다. 세면대 위에, 누가 손바닥을 댄 것 같은 김 서림만 남았다." },
            ],
      },
      onDone: () => {
        const s2 = useGame.getState();
        runtime.player.dir = "up";
        phantomRt.armed = false;
        phantomRt.showAt = 0;
        phantomRt.talking = false;
        s2.applyEffects({ flag: `phantom_${s2.day}` }, undefined, true);
        s2.applyEffects({ flag: "phantomMet" }, undefined, true);
        s2.log(first ? "👻 순찰 중 화장실 거울 속에서, 내가 아닌 무언가를 봤다." : "👻 거울 속의 그림자가 이름을 댔다. 팬텀.");
      },
    });
  };

  // 🚫 정문 밖으로 그냥 걸어 나가려 하면: 위병이 막아서고, 스스로 탈영할 수는 없다며 돌아선다
  const desertRef = useRef<() => void>(() => {});
  desertRef.current = () => {
    const st = useGame.getState();
    const p = runtime.player;
    // 정문 선에서 멈춰 선다 (대화가 끝나도 다시 걸리지 않게 선 바로 안쪽)
    p.y = 28.5;
    p.dir = "up";
    p.moving = false;
    keys.current = {};
    const guard = extraDefs.find((d) => d.id === "guard");
    const gs = guard ? speakerOf("x:guard") : null;
    const last = st.day >= TOTAL_DAYS;
    const night = st.minute >= 22 * 60 || st.minute < 6 * 60;
    setOverlay({
      type: "dialogue",
      script: {
        custom: gs?.custom,
        lines: last
          ? [
              { who: gs ? "npc" : "narr", text: gs ? "어이, 전역자! 정문 앞에서 인사는 하고 나가야지. 그냥 걸어 나가면 그게 탈영이다." : "정문 앞에서 발이 멈췄다." },
              { who: "me", text: "(맞다. 마지막은 제대로 하자. 모두에게 인사하고, 정문 앞에서 당당히 나서자.)" },
            ]
          : [
              {
                who: gs ? "npc" : "narr",
                text: gs
                  ? night
                    ? "(손전등 불빛이 얼굴에 꽂힌다) 정지! …뭐야, 우리 부대잖아. 이 밤에 어딜 가려고?"
                    : "어이! 거기 어디 가나? 출타증도 없이 위병소 밖으로는 한 발짝도 못 나간다!"
                  : "정문 앞에서 발이 멈췄다.",
              },
              { who: "me", text: "(…그래. 허락 없이 부대를 벗어나면 그게 탈영이지. 아무리 가기 싫었어도, 스스로 도망칠 수는 없다.)" },
              { who: "narr", text: "발길을 돌렸다. 나가려면 허락을 받아야 한다." },
            ],
      },
      onDone: () =>
        useGame
          .getState()
          .addTip("허가 없이 부대를 벗어나면 군무이탈(탈영)이다. 외출·외박·휴가는 반드시 허가를 받고 출타증을 챙겨 나간다."),
    });
  };

  // 🏠 생활관 바로 가기: 내 침상 앞으로 (문 이동과 같은 페이드)
  const warpReq = useRef<Door | null>(null);
  const goHome = useCallback(() => {
    const st = useGame.getState();
    if (
      overlayRef.current ||
      st.rollcall ||
      cer.current ||
      useSettings.getState().open
    )
      return;
    if (myMeal.eating) {
      st.toast("🍚 식사 중이다. 다 먹고 일어나자.", "info");
      return;
    }
    if (st.nightDuty && st.nightDuty.phase !== "return") {
      st.toast(
        st.nightDuty.phase === "report"
          ? "📋 근무 철수 보고부터 하자. 지휘통제실로 가야 한다."
          : "🌙 근무 중이다. 생활관으로 바로 갈 수는 없다.",
        "info",
      );
      return;
    }
    const bed = world.spots.bed;
    // 🧭 가야 할 곳이 있을 땐 생활관으로 바로 갈 수 없다 (그곳이 생활관이 아니라면)
    const er = errandNow(st);
    if (er && er.map !== bed.map) {
      st.toast(er.hud, "info");
      return;
    }
    warpReq.current = {
      tiles: [],
      to: bed.map,
      enterDir: "down",
      arrive: { x: bed.x + 0.5, y: bed.y + 0.5, dir: "down" },
    };
  }, [world]);

  /** 🧪 개발용 자동 이동: 콘솔에서 __auto.go('wc1', 6, 2) → 문을 거쳐 그 칸까지 스스로 걸어간다 (테스트 플레이용) */
  const autopilot = useRef<{ map: MapId; x: number; y: number } | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (window as unknown as Record<string, unknown>).__auto = {
      go: (map: MapId, x: number, y: number) => {
        autopilot.current = { map, x, y };
      },
      stop: () => {
        autopilot.current = null;
      },
      busy: () => !!autopilot.current,
      spots: world.spots,
    };
  }, [world]);

  // 🏃 지금 달리는 중인지 (발밑 먼지 연출용). 달리기는 지치지 않는다
  const stamina = useRef({ dashing: false });

  // 🚪 다른 생활관(2생활관) 입실: 상병 미만은 "(계급) (이름)입니다. 들어가도 되겠습니까?"
  // 안에서 대답하는 건 지금 실제로 그 방에 있는(깨어 있는) 사람뿐이다. 식사 · 점호 · 일과로 방이 비어 있으면 아무도 대답하지 않는다
  const askEnterRef = useRef<(d: Door) => void>(() => {});
  askEnterRef.current = (d: Door) => {
    const p = runtime.player;
    // 문 앞에 멈춰 선 그 자리에서 묻는다
    p.moving = false;
    keys.current = {};
    const st = useGame.getState();
    const inRoom = extraDefs.filter((def) => {
      const e = extras.current[def.id];
      return !!e && e.map === d.to && !extraHiddenAtNight(def.id, st.minute);
    });
    const awake = inRoom.filter((def) => !extraAsleep(def.id, extras.current[def.id], st.minute));
    // 대답하는 사람: 방 안에 깨어 있는 사람 가운데 가장 선임
    const rankOf = (def: (typeof extraDefs)[number]) => (RANKS as readonly string[]).indexOf(def.title.split(" ").pop() ?? "");
    const inside = [...awake].sort((x, y) => rankOf(y) - rankOf(x))[0];
    const asleepOnly = !inside && inRoom.length > 0;
    // 안에 있는 사람이 나보다 선임이거나 동급이면 편하게 말하고, 후임이면 존댓말을 쓴다
    const senior = !!inside && !juniorToMe(`x:${inside.id}`, st.day);
    const speaker = inside
      ? {
          name: `${inside.name} ${inside.title.split(" ").pop()}`,
          sub: "2생활관 (문 안쪽에서)",
          look: extraLook(inside),
          cap: BRANCHES[st.branch].cap as CapType,
        }
      : undefined;
    let enter: Door | null = null;
    setOverlay({
      type: "dialogue",
      script: {
        custom: speaker,
        lines: [
          { who: "narr", text: "2생활관 문 앞. 다른 분대 생활관이다." },
          { who: "narr", text: "어떻게 들어갈까?" },
        ],
        choices: [
          {
            text: '(똑똑) "{myrank} {me}입니다! 들어가도 되겠습니까?"',
            grade: "good",
            effects: { discipline: 1 },
            reply: [
              inside
                ? { who: "npc", text: senior ? "어, 들어와~ 무슨 일이냐?" : "네! 들어오십쇼!" }
                : asleepOnly
                  ? { who: "narr", text: "…대답이 없다. 불 꺼진 생활관 안에서 고른 숨소리만 들린다. 조용히 문을 열었다." }
                  : { who: "narr", text: "…대답이 없다. 안에는 아무도 없는 것 같다. 조용히 문을 열었다." },
            ],
            tip: '다른 생활관에 들어갈 땐 노크하고 "계급 성명입니다. 들어가도 되겠습니까?"라고 묻는 게 예의. 상병쯤 되면 편하게 드나든다.',
          },
          {
            text: "(그냥 문을 열고 들어간다)",
            grade: "bad",
            // 혼낼 사람이 안에 있을 때만 잔소리를 듣는다
            effects: inside ? { discipline: -2, mental: -1 } : undefined,
            reply: [
              inside
                ? {
                    who: "npc",
                    text: senior
                      ? "야, 노크 안 하냐? …다음부턴 물어보고 들어와라."
                      : "어…? {myrank}님, 노크는 하고 들어오셔야 합니다…",
                  }
                : asleepOnly
                  ? { who: "narr", text: "문을 열었다. 다들 자고 있다. 발소리를 죽였다." }
                  : { who: "narr", text: "문을 열었다. 생활관은 텅 비어 있다. 다들 어디 나간 모양이다." },
            ],
          },
          {
            text: "(돌아간다)",
            grade: "ok",
            reply: [{ who: "narr", text: "괜히 긴장된다. 나중에 다시 오자." }],
          },
        ],
      },
      onChoice: (c) => {
        const s2 = useGame.getState();
        if (c.effects) s2.applyEffects(c.effects, "생활관 입실");
        if (c.tip) s2.addTip(c.tip);
        enter = c.text.includes("돌아간다") ? null : d;
      },
      onDone: () => {
        if (enter) warpReq.current = enter;
      },
    });
  };

  /** 💭 머리 위에 잠깐 뜨는 혼잣말 (문 앞에서 발이 멈췄을 때 등 · 조작을 막지 않는다) */
  const thought = useRef<{ text: string; until: number } | null>(null);
  /**
   * 🚪 지금 이 문으로는 나갈 수 없는지: 갈 곳이 정해져 있을 땐 그쪽으로 가는 문만 열려 있다.
   * 막힌 문 앞에서는 튕겨 나오지 않고 그 자리에 멈춰 서서, 이유를 혼잣말로 떠올린다. (null = 지나갈 수 있다)
   */
  const doorLockRef = useRef<(d: Door) => string | null>(() => null);
  doorLockRef.current = (d: Door) => {
    const st = useGame.getState();
    const p = runtime.player;
    const nd = st.nightDuty;
    // 🌙 근무를 마쳤으면(교대 · 보고 · 복귀) 가야 할 곳으로 가는 문 말고는 나가지 않는다
    if (nd && (nd.phase === "return" || nd.phase === "report" || (nd.kind === "watch" && nd.phase === "wakeNext"))) {
      const dest = nd.phase === "report" ? DUTY_DESK[0] : world.spots.bed.map;
      if (doorToward(world, p.map, dest)?.to !== d.to)
        return nd.phase === "wakeNext"
          ? "(어딜 가… 다음 근무자부터 깨워서 교대하자.)"
          : nd.phase === "report"
            ? "(지휘통제실에 근무 철수 보고부터 하자.)"
            : "(하아암… 피곤하다. 얼른 내 침상으로 가서 자자.)";
    }
    // 🔦 야간 순찰: 점검할 곳은 모두 막사 안이다. 순찰 중에는 막사 밖으로 나가지 않는다
    if (st.patrol && !world.maps[d.to].indoor) return "(야간 순찰 중이다. 점검할 곳은 전부 막사 안이다. 밖으로 나갈 일은 없다.)";
    // 🌙 야간 위병소 근무: 사수 · 부사수와 함께 초소로 가는 길에는 다른 곳으로 빠지지 않는다
    if (nd && nd.kind === "guard" && nd.phase === "toPost") {
      if (doorToward(world, p.map, world.spots.post.map)?.to !== d.to)
        return "(근무 교대 시간이다. 딴 데로 새지 말고 곧장 위병소 초소로 가자.)";
    }
    // 🔦 불침번: 근무 신고는 지휘통제실로, 순찰은 2생활관 → 1생활관 순서로만 간다
    if (nd && nd.kind === "watch" && (nd.phase === "checkin" || nd.phase === "rounds")) {
      const dest = nd.phase === "checkin" ? DUTY_DESK[0] : nextRound(nd);
      if (doorToward(world, p.map, dest)?.to !== d.to)
        return nd.phase === "checkin"
          ? "(먼저 지휘통제실에 근무 신고부터 하자.)"
          : dest === "room2"
            ? "(순찰 중이다. 2층 2생활관부터 돌아보자.)"
            : "(순찰 중이다. 1생활관으로 돌아가자.)";
    }
    // 😴 아직 침상에서 자고 있는 선임이 있으면, 깨워 드리기 전에는 생활관을 나서지 않는다
    const sl = sleepySenior(st);
    if (sl && p.map === "room1")
      return `(…${memberFullName(st.branch, sl, st.day)}님이 아직 주무신다. 이대로 나가면 분대 전체가 점호에 늦는다. 깨워 드리고 가자.)`;
    // 🧭 호출 · 심부름 · 보고 · 첫날 세면: 가야 할 곳으로 가는 문만 열려 있다
    const er = errandNow(st);
    if (er && doorToward(world, p.map, er.map)?.to !== d.to) return er.why;
    return null;
  };

  // 🚪 지휘통제실 · 행정반: 노크하고 들어간다. 그냥 들어가면 안에 있는 간부나 선임 행정병에게 잔소리를 듣는다
  const knockRef = useRef<(d: Door) => void>(() => {});
  knockRef.current = (d: Door) => {
    const p = runtime.player;
    // 문 앞에 멈춰 선 그 자리에서 묻는다
    p.moving = false;
    keys.current = {};
    const st = useGame.getState();
    const room = KNOCK_ROOMS[d.to] ?? "사무실";
    // 안에 있는 사람: 간부(중대장 · 소대장 · 행보관) → 당직부사관 → 행정병
    const inside = (() => {
      // 지금 실제로 그 방에 있고, 눈에 보이는(퇴근하거나 자기 막사로 돌아가지 않은) 사람만 센다
      const here = visibleNpcs(st.day, st.minute);
      for (const id of ["cpt", "lt", "sgm"] as NpcId[]) {
        const n = npcs.current[id];
        if (n && n.map === d.to && here.includes(id)) return id as string;
      }
      for (const def of extraDefs) {
        const e = extras.current[def.id];
        if (e && e.map === d.to && !extraHiddenAtNight(def.id, st.minute) && !extraAsleep(def.id, e, st.minute))
          return `x:${def.id}`;
      }
      return null;
    })();
    const def = inside?.startsWith("x:") ? extraDefs.find((e) => `x:${e.id}` === inside) : undefined;
    const officer = !!inside && (!inside.startsWith("x:") || !!def?.officer);
    const sp = inside ? speakerOf(inside) : null;
    // 안에 있는 사람이 나보다 선임이거나 동급이면 편하게 말하고, 후임이면 존댓말을 쓴다
    const senior = !!inside && !juniorToMe(inside, st.day);
    let mode: "knock" | "barge" | null = null;
    setOverlay({
      type: "dialogue",
      script: {
        npc: sp?.npc,
        custom: sp?.custom,
        lines: [
          { who: "narr", text: `${room} 문 앞.` },
          { who: "narr", text: "어떻게 들어갈까?" },
        ],
        choices: [
          {
            text: '(똑똑) "{myrank} {me}입니다! 들어가도 되겠습니까?"',
            grade: "good",
            effects: { discipline: 1 },
            reply: [
              !inside
                ? { who: "narr", text: "…대답이 없다. 안에는 아무도 없는 것 같다. 조용히 문을 열었다." }
                : { who: "npc", text: officer ? "그래, 들어와." : senior ? "어, 들어와." : "네, 들어오십쇼~" },
            ],
            tip: "지휘통제실·행정반 같은 사무 공간엔 노크하고 \"계급 성명입니다. 들어가도 되겠습니까?\"라고 물은 뒤 들어간다.",
          },
          {
            text: "(그냥 문을 열고 들어간다)",
            grade: "bad",
            reply: [{ who: "narr", text: "문고리를 잡고 벌컥 열었다." }],
          },
          {
            text: "(돌아간다)",
            grade: "ok",
            reply: [{ who: "narr", text: "나중에 다시 오자." }],
          },
        ],
      },
      onChoice: (c) => {
        const s2 = useGame.getState();
        mode = c.text.startsWith("(똑똑)") ? "knock" : c.text.includes("벌컥") || c.text.includes("그냥") ? "barge" : null;
        if (mode === "knock") {
          if (c.effects) s2.applyEffects(c.effects, `${room} 입실`, true);
          if (c.tip) s2.addTip(c.tip);
        }
      },
      onDone: () => {
        if (mode === "knock" || (mode === "barge" && !inside)) {
          warpReq.current = d;
          return;
        }
        if (mode !== "barge" || !inside) return;
        // 문을 열고 들어선 순간, 안에 있던 사람에게 잔소리를 듣는다
        storyCtxRef.current.goTo(d.to, d.arrive.x, d.arrive.y, d.arrive.dir, () => {
          const s3 = useGame.getState();
          const sp2 = speakerOf(inside);
          const line =
            inside === "lt"
              ? "{me}! 지휘통제실에 노크도 없이 들어오나? 여긴 근무 중인 곳이다. 노크하고, 관등성명 대고 들어와라."
              : inside === "cpt"
                ? "…노크는 어디 두고 왔지? 행정반도 사무실이다. 다음엔 없다."
                : inside === "sgm"
                  ? "어이구~ 문은 두드리라고 있는 거다. 행보관 심장 떨어질 뻔했다. 다음부턴 똑똑 하고 들어와."
                  : officer
                    ? "야, 노크! 상황 근무 중에 문 벌컥 열면 다들 놀란다. 다시는 그러지 마라."
                    : senior
                      ? "야, 노크 안 하냐? 문 벌컥 열면 서류 다 날아간다고. 다음부턴 똑똑 하고 들어와."
                      : "…{myrank}님, 노크는 하셔야죠. 서류 날아갑니다.";
          setOverlay({
            type: "dialogue",
            script: {
              npc: sp2.npc,
              custom: sp2.custom,
              lines: [
                { who: "narr", text: "문을 벌컥 열자, 안에 있던 시선이 일제히 꽂힌다." },
                { who: "npc", text: line },
                { who: "me", text: "…죄송합니다! 다음부터 노크하고 들어오겠습니다!" },
              ],
            },
            onDone: () => {
              s3.applyEffects(
                { discipline: -2, ...(inside.startsWith("x:") ? {} : { affinity: { [inside]: -2 } }) },
                "노크 없이 입실",
              );
              s3.addTip("지휘통제실·행정반 같은 사무 공간엔 노크하고 \"계급 성명입니다. 들어가도 되겠습니까?\"라고 물은 뒤 들어간다.");
            },
          });
        });
      },
    });
  };

  // NPC 목표 위치
  const npcTarget = useCallback(
    (id: NpcId): Pos => {
      const st = useGame.getState();
      const m = st.minute;
      const ev = st.currentEvent();
      const officer = NPC_ROLES[id].officer;
      if (st.day >= TOTAL_DAYS) {
        const gate = world.spots.gate;
        return id === "lt" || id === "cpt" || id === "sgm"
          ? [
              "outdoor",
              gate.x + (id === "lt" ? -2 : id === "cpt" ? 2 : 3),
              gate.y - 2,
            ]
          : FREE_POS[id];
      }
      const ng = nightGoal(id, st);
      if (ng) return ng;
      // 1일차 늦잠 장면: 눈을 뜨는 순간에는 분대원 모두가 생활관에서 나를 보고 있다 (다른 어떤 규칙보다 먼저)
      if (!officer && st.day === 1 && !st.flags.wokeUp && WAKE_POS[id]) return WAKE_POS[id]!;
      // 🌙 소등 뒤 당직 간부는 지휘통제실 책상을 지킨다 (생활관 점호를 마치면 그리로 간다)
      if ((m >= LIGHTS_OUT || m < 6 * 60) && id === dutyOfficerNow(st.day)) return DUTY_DESK;
      // 🌅 기상 직후: 내가 생활관을 나서기 전에는 분대원들도 자기 침상 앞에서 채비를 한다 (1일차 늦잠 장면은 분대장이 내 침상 옆)
      if (!officer && rollcallWaiting(st) && !leftRoomToday(st.day)) {
        if (st.day === 1 && !st.flags.wokeUp && WAKE_POS[id]) return WAKE_POS[id]!;
        if (NIGHT_POS[id]) return NIGHT_POS[id]!;
      }
      // 1일차: 세수하고 돌아올 나를 맞선임이 생활관에서 기다린다
      if (id === "senior" && st.day === 1 && !!st.flags.wokeUp && !st.flags.wakeTalk && !st.flags.tutorial)
        return ["room1", Math.floor(WAKE_TALK_AT[0]), Math.floor(WAKE_TALK_AT[1])];
      if (ev && !st.eventBegun && !ev.auto && ev.start - m <= ARRIVE_AUTO_GAP && ev.spot) {
        const sp = world.spots[ev.spot];
        if (!officer) {
          const soldiers = presentNpcs(st.day).filter(
            (n) => !NPC_ROLES[n].officer,
          );
          const i = soldiers.indexOf(id);
          const [dx, dy] = FORMATION[i % FORMATION.length];
          return [sp.map, sp.x + dx, sp.y + dy];
        }
        if (id === "lt" || (id === "cpt" && ev.kind === "rollcall_am"))
          return [sp.map, sp.x + (id === "cpt" ? 1 : -1), sp.y - 4];
      }
      // 함께 하는 퀘스트 중이면 나를 따라온다
      if (questCompanion(id, st)) {
        const p = runtime.player;
        return [p.map, Math.floor(p.x), Math.floor(p.y)];
      }
      // 아침 점호 전에는 다들 생활관에 있다 (1일차 늦잠 장면은 분대장이 내 침상 옆)
      if (!officer && m < 6 * 60 + 15) {
        if (st.day === 1 && !st.flags.wokeUp && WAKE_POS[id])
          return WAKE_POS[id]!;
        if (NIGHT_POS[id]) return NIGHT_POS[id]!;
      }
      if (isMealTime(m) && MEAL_POS[id]) {
        const goal = mealGoal(id, MEAL_POS[id]!, st);
        if (goal !== "free") return goal;
      }
      if (officer && m >= LIGHTS_OUT)
        return ["command", id === "lt" ? 5 : 7, 2];
      if (!officer && m >= 21 * 60 && NIGHT_POS[id]) return NIGHT_POS[id]!;
      return FREE_POS[id];
    },
    [world],
  );


  // 상호작용 찾기 (같은 맵에 있는 것만)
  const findInteractable = useCallback((): Interactable | null => {
    const st = useGame.getState();
    const p = runtime.player;
    const ev = st.currentEvent();
    const dist = (x: number, y: number) => Math.hypot(p.x - x, p.y - y);
    const nd = st.nightDuty;
    if (nd) {
      const star = STAR_POS[nd.kind];
      const starOn =
        !st.flags[`star_${st.day}`] &&
        (nd.kind === "watch"
          ? nd.phase === "wakeNext" || nd.phase === "report" || nd.phase === "return"
          : nd.phase === "toPost" || nd.phase === "report" || nd.phase === "return");
      if (starOn && p.map === star[0] && dist(star[1], star[2]) < 1.9)
        return { key: "duty_star", kind: "duty", label: "✨ 희미한 별빛" };
      if (nd.phase === "toPost") {
        const sp = world.spots.post;
        if (p.map === sp.map && dist(sp.x + 0.5, sp.y + 0.5) < 2.2)
          return {
            key: "duty_post",
            kind: "duty",
            label: "근무 교대 (위병소 초소)",
          };
      }
      if (nd.phase === "wakeNext") {
        const n = entityOf(nd.next);
        if (n && n.map === p.map && dist(n.x, n.y) < 2.3)
          return {
            key: "duty_wake",
            kind: "duty",
            label: `${memberName(st.branch, nd.next)} 깨우기 (근무 교대)`,
          };
      }
      if (nd.phase === "checkin") {
        if (p.map === DUTY_DESK[0] && dist(DUTY_DESK[1] + 0.5, DUTY_DESK[2] + 1.5) < 2.4)
          return {
            key: "duty_checkin",
            kind: "duty",
            label: "근무 신고 (당직 간부)",
          };
      }
      if (nd.phase === "report") {
        if (p.map === DUTY_DESK[0] && dist(DUTY_DESK[1] + 0.5, DUTY_DESK[2] + 1.5) < 2.4)
          return {
            key: "duty_report",
            kind: "duty",
            label: "근무 철수 보고 (당직 간부)",
          };
      }
      if (nd.phase === "return") {
        const bd = world.spots.bed;
        if (p.map === bd.map && dist(bd.x + 0.5, bd.y + 0.5) < 1.6)
          return {
            key: "duty_sleep",
            kind: "duty",
            label: "침상에 누워 잠들기",
          };
      }
      // 🌙 밤새 깨어 있는 당직병(행정병)에게는 근무 중에도 말을 걸 수 있다
      const ck = extras.current.clerk;
      const ckDef = extraDefs.find((d) => d.id === "clerk");
      if (ck && ckDef && ck.map === p.map && dist(ck.x, ck.y) < 1.7)
        return { key: "extra_clerk", kind: "extra", extra: "clerk", label: `대화: ${ckDef.name} (당직병)` };
      // 근무 중엔 다른 일은 하지 않는다 (다들 자고 있다)
      return null;
    }
    // 📖 막사 2층 계단 옆 옥상 철문
    if (
      p.map === "hq2" &&
      dist(ROOF_DOOR[0] + 0.5, ROOF_DOOR[1] + 1.5) < 1.3 &&
      st.clues.length > 0
    )
      return {
        key: "roof",
        kind: "story",
        label: st.flags.roof ? "옥상으로 (철문)" : "옥상 철문",
      };
    // 📖 전역일: 연병장 구령대에 내려온 별
    if (
      finalStarOn(st) &&
      p.map === "outdoor" &&
      dist(STAGE_STAR[0], STAGE_STAR[1] + 1.6) < 2.6
    )
      return { key: "final", kind: "story", label: "✨ 구령대에 내려온 별" };
    // 실내 집합 장소(생활관 등)에서는 곁에 있는 사람과의 대화가 먼저다: 말을 걸려던 E가 점호 시작이 되지 않게 한다
    let evIt: Interactable | null = null;
    if (ev && !st.eventBegun && !ev.auto && ev.spot) {
      const sp = world.spots[ev.spot];
      // 저녁 점호는 생활관 안 어디서든 시작할 수 있다 (곁에 사람이나 침상 같은 것이 없을 때)
      const pmRoll = ev.kind === "rollcall_pm";
      if (sp.map === p.map && (pmRoll || dist(sp.x + 0.5, sp.y + 0.5) < 2.2)) {
        evIt = {
          key: `ev_${ev.id}`,
          kind: "event",
          label:
            ev.kind === "farewell"
              ? "위병소를 나선다 (전역!)"
              : st.mealCheck && !st.mealCheck.done
                ? "🍚 먼저 분대와 식사하자 (1생활관)"
                : ev.start - st.minute > ARRIVE_AUTO_GAP
                ? `${ev.label} 시작하기 (자유 시간을 마치고 ${fmtTime(ev.start)}로)`
                : pmRoll
                  ? `${ev.label} 시작하기`
                  : `집합 완료 보고: ${ev.label}`,
          spot: ev.spot,
        };
        if (!world.maps[sp.map].indoor) return evIt;
      }
    }
    // 🍱 식판을 들고 내 자리 근처에 오면 앉아서 먹기
    if (
      myMeal.tray &&
      !myMeal.eating &&
      p.map === "mess" &&
      dist(MY_MEAL_SEAT[0] + 0.5, MY_MEAL_SEAT[1] + 0.5) < 1.4
    ) {
      return { key: "meal_seat", kind: "seat", label: "내 자리에 앉아 먹기" };
    }
    // 🍱 밥차 앞: 아직 식판을 받지 않았으면, 곁에 서 있는 분대원보다 밥차가 먼저다
    {
      const mcT = st.mealCheck;
      const spM = world.spots.mess;
      if (
        mcT && !mcT.done && !myMeal.tray && !myMeal.eating && !st.daily.includes(`meal_${mcT.meal}`) &&
        p.map === spM.map && dist(spM.x + 0.5, spM.y + 0.5) < 1.4
      )
        return { key: "spot_mess", kind: "spot", spot: "mess", label: "밥차 (배식)" };
    }
    // 😴 아침에 못 일어난 선임의 침상 곁: 깨워 드린다 (곁에 서 있는 다른 분대원보다 먼저)
    {
      const sl = sleepySenior(st);
      const se = sl ? (sl.startsWith("x:") ? extras.current[sl.slice(2)] : npcs.current[sl as NpcId]) : null;
      if (sl && se && se.map === p.map && dist(se.x, se.y) < 2.1)
        return { key: "wake_senior", kind: "wake", label: `🛏️ ${memberFullName(st.branch, sl, st.day)} 깨우기` };
    }
    let best: Interactable | null = null;
    let bd = 1.5;
    // 동행 중인 사람은 내가 그쪽을 바라볼 때만 말을 건다 (뒤에 붙어 있어도 다른 사람·장소와 상호작용할 수 있게)
    const [fx, fy] = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    }[p.dir];
    const behindMe = (n: NpcRt) => {
      if (!n.att) return false;
      const dx = n.x - p.x,
        dy = n.y - p.y;
      const d = Math.hypot(dx, dy);
      return d > 0.05 && (dx * fx + dy * fy) / d < 0.5;
    };
    for (const id of visibleNpcs(st.day, st.minute)) {
      const n = npcs.current[id];
      if (!n || n.map !== p.map || behindMe(n)) continue;
      const d = dist(n.x, n.y);
      if (d < bd) {
        bd = d;
        best = {
          key: `npc_${id}`,
          kind: "npc",
          npc: id,
          label: npcAsleep(id, n, st.minute)
            ? `😴 ${npcDisplayName(st.branch, id, st.day)} (자는 중)`
            : `대화: ${npcDisplayName(st.branch, id, st.day)}`,
        };
      }
    }
    if (best) return best;
    for (const def of extraDefs) {
      const e = extras.current[def.id];
      if (
        !e ||
        e.map !== p.map ||
        extraHiddenAtNight(def.id, st.minute) ||
        behindMe(e)
      )
        continue;
      const d = dist(e.x, e.y);
      if (d < bd) {
        bd = d;
        best = {
          key: `extra_${def.id}`,
          kind: "extra",
          extra: def.id,
          label: `대화: ${def.name} ${def.title}`,
        };
      }
    }
    if (best) return best;
    // 🪑 책상 같은 구조물을 사이에 두고 마주 선 사람: 돌아가지 않고 그 자리에서 말을 건다 (행정반 · 지휘통제실 책상 너머)
    {
      const mapI = world.maps[p.map];
      const across = (e: { x: number; y: number }): number | null => {
        const dx = e.x - p.x,
          dy = e.y - p.y;
        const fwd = dx * fx + dy * fy;
        const side = Math.abs(dx * fy - dy * fx);
        if (fwd <= 1 || fwd > 3.3 || side > 0.8) return null;
        // 나와 그 사람 사이 칸에 지나갈 수 없는 구조물이 있어야 한다
        for (let s = 1; s < fwd; s++) {
          const tx = Math.floor(p.x + fx * s),
            ty = Math.floor(p.y + fy * s);
          if (tx === Math.floor(e.x) && ty === Math.floor(e.y)) break;
          if (isSolid(mapI, tx, ty)) return fwd;
        }
        return null;
      };
      let far = 99;
      for (const id of visibleNpcs(st.day, st.minute)) {
        const n = npcs.current[id];
        if (!n || n.map !== p.map || npcAsleep(id, n, st.minute)) continue;
        const d = across(n);
        if (d !== null && d < far) {
          far = d;
          best = { key: `npc_${id}`, kind: "npc", npc: id, label: `대화: ${npcDisplayName(st.branch, id, st.day)}` };
        }
      }
      for (const def of extraDefs) {
        const e = extras.current[def.id];
        if (!e || e.map !== p.map || extraHiddenAtNight(def.id, st.minute) || extraAsleep(def.id, e, st.minute)) continue;
        const d = across(e);
        if (d !== null && d < far) {
          far = d;
          best = { key: `extra_${def.id}`, kind: "extra", extra: def.id, label: `대화: ${def.name} ${def.title}` };
        }
      }
      if (best) return best;
    }
    if (evIt && !evIt.key.startsWith("ev_rollcall_pm")) return evIt;
    const spotNames: Partial<Record<SpotId, string>> = {
      bed: "내 침상",
      mess: "밥차 (배식)",
      px: STORE_NAME[st.branch],
      admin: "행정반",
      command: "지휘통제실 상황판",
      tv: "휴게실 TV",
      cyber: "싸지방 PC",
      gym: "체단실 운동 기구",
      maint: "정비실 작업대",
      library: "도서관 책장",
      wc1: "세면대",
      wc2: "세면대",
      laundry1: "세탁기",
      laundry2: "세탁기",
      water1: "정수기",
      water2: "정수기",
      board1: "복도 게시판",
      board2: "복도 게시판",
      kitchen: "조리실",
      court: "농구장",
      recycle: "분리수거장",
      cairn: "이끼 낀 돌탑",
      ammoledger: "탄약 수불 대장",
      ammo: FACILITY_NAME[st.branch],
      post: "위병소 초소",
    };
    for (const [id, label] of Object.entries(spotNames) as [SpotId, string][]) {
      const sp = world.spots[id];
      if (sp.map === p.map && dist(sp.x + 0.5, sp.y + 0.5) < 1.4)
        return {
          key: `spot_${id}`,
          kind: "spot",
          spot: id,
          label: (id === "wc1" || id === "wc2") && mirrorPending(st) ? "세면대에서 세수하기" : label,
        };
    }
    return evIt;
  }, [world, extraDefs]);

  // ───── 상호작용 핸들러 ─────
  const openNpc = useCallback(
    (id: NpcId) => {
      const st = useGame.getState();
      const sleeper = npcs.current[id];
      // 😴 아침에 못 일어난 선임이면 깨워 드린다
      if (sleepySenior(st) === id) {
        wakeSeniorRef.current();
        return;
      }
      if (sleeper && npcAsleep(id, sleeper, st.minute)) {
        setOverlay({
          type: "dialogue",
          script: {
            lines: [{ who: "narr", text: "(곤히 자고 있다… 깨우지 말자.)" }],
          },
        });
        return;
      }
      // 📖 10일차: 동기가 내 이름을 잊었다
      if (
        id === "buddy" &&
        st.day >= 10 &&
        st.day < TOTAL_DAYS &&
        buddyForgets(storyCtx)
      )
        return;
      const name = npcDisplayName(st.branch, id, st.day);
      // 📖 동기가 나를 잊은 동안엔 동기와 하던 퀘스트를 이어 갈 수 없다 (낯선 사람처럼 대한다)
      const forgot = id === "buddy" && buddyForgot(st);
      const q = forgot ? null : st.questStepAt({ npc: id });
      // ⏰ 집합할 시각이면 부탁받은 일은 일정을 마친 뒤로 미룬다 (퀘스트에는 시간이 든다)
      if (q && eventDue(st)) {
        setOverlay({
          type: "dialogue",
          script: { lines: [{ who: "me", text: "(…지금은 집합 시간이다. 부탁받은 일은 일정을 마친 뒤에 이어 가자.)" }] },
        });
        return;
      }
      if (q) {
        setOverlay({
          type: "dialogue",
          script: { npc: id, lines: [{ who: "npc", text: q.text }] },
          onDone: () => {
            useGame.getState().advanceQuest(q.quest.id);
            useGame.getState().spend(10);
          },
        });
        return;
      }
      const talk = () => {
        const s2 = useGame.getState();
        s2.spend(10);
        s2.markTalked(id);
        if (s2.day >= TOTAL_DAYS) {
          const line = FAREWELL_LINES[id] ?? "전역 축하한다!";
          setOverlay({
            type: "dialogue",
            script: {
              npc: id,
              lines: [{ who: "npc", text: line }],
              choices: [
                {
                  text: '"그동안 정말 감사했습니다! {S}!"',
                  grade: "good",
                  effects: { affinity: { [id]: 6 }, mental: 3 },
                  reply: [{ who: "npc", text: "{S}! 잘 가라!" }],
                },
                {
                  text: '"사회에서 꼭 다시 만나요!"',
                  grade: "good",
                  effects: { affinity: { [id]: 5 }, mental: 4 },
                  reply: [{ who: "npc", text: "그래, 꼭 연락해라!" }],
                },
              ],
            },
            onChoice: (c) => {
              const s3 = useGame.getState();
              s3.applyEffects(c.effects ?? {}, undefined);
              s3.markFarewell(id);
              s3.log(
                `👋 ${NPC_SKINS[s3.branch][id].name}와(과) 작별 인사를 나눴다.`,
              );
            },
          });
          return;
        }
        const d: Dialogue | null = s2.pickDialogue(id);
        if (!d && id === "buddy" && buddyForgot(s2)) {
          setOverlay({
            type: "dialogue",
            script: {
              npc: id,
              lines: [
                { who: "npc", text: pickTalk("buddy_forgot", BUDDY_FORGOT_TALK) },
                { who: "narr", text: "[함께한 곳을 되짚어 보면 기억이 돌아올지도 모른다: 행정반 분실물함 → 싸지방 → 농구장 → 막사 옥상]" },
              ],
            },
          });
          return;
        }
        if (!d) {
          setOverlay({
            type: "dialogue",
            script: {
              npc: id,
              lines: [
                {
                  who: "npc",
                  text: pickTalk(id, smallTalkPool(s2.branch, id, s2.day)),
                },
              ],
            },
            onDone: () =>
              useGame
                .getState()
                .applyEffects({ affinity: { [id]: 1 } }, undefined, true),
          });
          return;
        }
        s2.markSeen(d.id);
        if (d.effects) s2.applyEffects(d.effects, "대화");
        setOverlay({
          type: "dialogue",
          script: { npc: id, lines: d.lines, choices: d.choices },
          onChoice: (c) => {
            const s3 = useGame.getState();
            if (c.effects) s3.applyEffects(c.effects, "대화");
            if (c.tip) s3.addTip(c.tip);
            s3.log(
              `💬 ${NPC_SKINS[s3.branch][id].name}: ${c.grade === "good" ? "좋은 대화를 나눴다" : c.grade === "ok" ? "무난하게 대화했다" : "대화가 어색하게 끝났다"}.`,
            );
          },
        });
      };
      const already = st.talked.includes(id);
      const opts: MenuOption[] = [...storyNpcOptions(id, storyCtx)];
      for (const of of questOffers(st).filter(
        (o) => o.open && o.giver === id,
      )) {
        const d = dialogueById(of.dialogueId);
        if (!d) continue;
        opts.push({
          label: `💬 부탁 들어보기: ${QUESTS[of.questId].title}`,
          hint: "퀘스트",
          onSelect: () => {
            const s2 = useGame.getState();
            s2.spend(10);
            s2.markTalked(id);
            s2.markSeen(d.id);
            if (d.effects) s2.applyEffects(d.effects, "대화");
            setOverlay({
              type: "dialogue",
              script: { npc: id, lines: d.lines, choices: d.choices },
              onChoice: (c) => {
                const s3 = useGame.getState();
                if (c.effects) s3.applyEffects(c.effects, "대화");
                if (c.tip) s3.addTip(c.tip);
              },
            });
          },
        });
      }
      opts.push({
        label: already ? "잡담하기" : "대화하기",
        hint: "10분",
        onSelect: () => {
          if (already) {
            useGame.getState().spend(5);
            setOverlay({
              type: "dialogue",
              script: {
                npc: id,
                lines: [
                  {
                    who: "npc",
                    text: pickTalk(
                      id,
                      smallTalkPool(useGame.getState().branch, id, useGame.getState().day),
                    ),
                  },
                ],
              },
            });
          } else talk();
        },
      });
      const inv = Object.entries(st.inventory).filter(([, n]) => n > 0);
      opts.push({
        label: "선물하기",
        hint: st.gifted.includes(id)
          ? "오늘은 이미 줬다"
          : inv.length === 0
            ? "소지품 없음"
            : `호감 +${Math.max(1, 6 - (st.giftCount[id] ?? 0) * 2)} (줄수록 감소)`,
        disabled: st.gifted.includes(id) || inv.length === 0,
        onSelect: () => {
          setOverlay({
            type: "menu",
            title: `${name}에게 선물`,
            options: inv.map(([iid, n]) => ({
              label: `${ITEMS[iid].icon} ${ITEMS[iid].name} ×${n}`,
              hint: iid === "chocopie" ? "정(情) 보너스!" : "",
              onSelect: () => {
                useGame.getState().gift(id, iid);
                useGame.getState().spend(5);
                setOverlay({
                  type: "dialogue",
                  script: {
                    npc: id,
                    lines: [
                      {
                        who: "npc",
                        text:
                          iid === "chocopie"
                            ? "초코파이…! 이게 바로 정(情)이지. 고맙다!"
                            : "오, 나 주는 거야? 고맙다!",
                      },
                    ],
                  },
                });
              },
            })),
          });
        },
      });
      opts.push({ label: "그만두기", onSelect: () => setOverlay(null) });
      setOverlay({
        type: "menu",
        title: name,
        subtitle: `${npcRoleTitle(st.branch, id)} · ${NPC_SKINS[st.branch][id].species} · 호감 ${st.affinity[id]}`,
        options: opts,
      });
    },
    [setOverlay],
  );

  const openSpot = useCallback(
    (id: SpotId) => {
      const st = useGame.getState();
      const m = st.minute;
      // 🚿 전입 첫날: 세면대 앞에 서면 곧바로 세수 → 거울 장면
      if ((id === "wc1" || id === "wc2") && mirrorPending(st)) {
        mirrorScene();
        return;
      }
      // 🍚 식사 시간엔 분대와 먼저 밥을 먹어야 한다: 그 전에는 장소에서 하는 일(퀘스트 · 활동 · 퍼즐)을 미룬다
      const mealFirst = !!st.mealCheck && !st.mealCheck.done;
      // ⏰ 집합할 시각이 됐으면 시간이 드는 일(퀘스트 · 활동 · 퍼즐)은 일정을 마친 뒤로 미룬다
      const due = eventDue(st);
      const hold = mealFirst || due;
      const holdHint = due ? "⏰ 집합 시간 — 일정부터" : "🍚 먼저 분대와 식사";
      const free = !hold && (isFreeTimeEvening(m) || isMealTime(m));
      const opts: MenuOption[] = [];
      const q = st.questStepAt({ spot: id });
      if (q) {
        opts.push({
          label: `📋 퀘스트 진행`,
          hint: hold ? holdHint : q.minutes ? `${q.minutes}분` : "",
          disabled: hold,
          onSelect: () => {
            const s2 = useGame.getState();
            s2.spend(q.minutes ?? 10);
            setOverlay({
              type: "dialogue",
              script: { lines: [{ who: "narr", text: q.text }] },
              onDone: () => useGame.getState().advanceQuest(q.quest.id),
            });
          },
        });
      }
      opts.push(...storySpotOptions(id, storyCtx));
      const act = (
        label: string,
        hint: string,
        mins: number,
        eff: Parameters<typeof st.applyEffects>[0],
        text: string,
        dailyKey?: string,
        disabled = false,
      ) => {
        opts.push({
          label,
          hint: hold ? holdHint : hint,
          disabled:
            hold || disabled || (dailyKey ? st.daily.includes(dailyKey) : false),
          onSelect: () => {
            const s2 = useGame.getState();
            s2.spend(mins);
            if (dailyKey) s2.markDaily(dailyKey);
            s2.applyEffects(eff, label);
            s2.log(text);
            setOverlay({
              type: "dialogue",
              script: { lines: [{ who: "narr", text }] },
            });
          },
        });
      };
      let title = "";
      switch (id) {
        case "bed": {
          title = "🛏️ 내 침상";
          act(
            "침상에서 쉬기",
            "30분",
            30,
            { hp: 12, mental: 2 },
            "모포를 덮고 잠시 눈을 붙였다. 개운하다.",
            undefined,
            !free,
          );
          const phoneOk = m >= 18 * 60 && m < 21 * 60;
          const momLines = phoneCallLines();
          if (momLines && phoneOk && !st.daily.includes("phone")) {
            opts.push({
              label: "📱 엄마에게 전화하기",
              hint: "20분 · 📖",
              onSelect: () => {
                const s2 = useGame.getState();
                s2.spend(20);
                s2.markDaily("phone");
                s2.applyEffects({ mental: 10, memory: 5 }, "엄마와 통화");
                s2.log(
                  '📱 엄마: "가기 싫으면 싫다고 해도 돼. 근데 엄마는, 네가 해낼 거 알아."',
                );
                setOverlay({ type: "dialogue", script: { lines: momLines } });
              },
            });
          } else
            act(
              "휴대폰으로 가족과 통화",
              phoneOk
                ? "20분 (1일 1회)"
                : "18:00~21:00 — 지금은 그걸 쓸 때가 아니다!",
              20,
              { mental: 10, memory: st.clues.length ? 2 : 0 },
              '"엄마, 나… 포켓몬 됐어." "밥은 잘 먹고?" 역시 엄마는 엄마다.',
              "phone",
              !phoneOk,
            );
          const inv = Object.entries(st.inventory).filter(([, n]) => n > 0);
          opts.push({
            label: "간식 먹기",
            hint: inv.length ? `${inv.length}종 보유` : "없음",
            disabled: inv.length === 0,
            onSelect: () =>
              setOverlay({
                type: "menu",
                title: "🎒 간식",
                options: inv.map(([iid, n]) => ({
                  label: `${ITEMS[iid].icon} ${ITEMS[iid].name} ×${n}`,
                  hint: ITEMS[iid].desc,
                  onSelect: () => {
                    useGame.getState().useItem(iid);
                    useGame.getState().spend(10);
                    setOverlay(null);
                  },
                })),
              }),
          });
          opts.push({
            label: "💾 저장하기",
            onSelect: () => {
              useGame.getState().save();
              useGame.getState().toast("💾 저장했다.", "info");
              setOverlay(null);
            },
          });
          if (!free)
            opts.push({
              label: "(지금은 일과 시간이다)",
              disabled: true,
              onSelect: () => {},
            });
          break;
        }
        case "mess": {
          title = "🍚 밥차";
          const meal = m < 15 * 60 ? "lunch" : "dinner";
          const ok = isMealTime(m);
          const ate = st.daily.includes(`meal_${meal}`);
          // 식사는 분대 단위: 생활관에서 분대와 함께 왔을 때만 배식을 받는다
          const alone =
            !!st.mealCheck &&
            !st.mealCheck.done &&
            mealCall.withMe !== `${st.day}-${meal}`;
          opts.push({
            label: !ok
              ? "배식 시간이 아니다"
              : ate
                ? "이미 먹었다"
                : myMeal.tray
                  ? "식판을 이미 받았다"
                  : alone
                    ? "🍱 식판 받기 — 분대와 함께 와야 한다"
                    : "🍱 식판 받기 (배식)",
            hint: !ok
              ? "12:00~13:00 / 17:30~18:30"
              : alone
                ? "먼저 1생활관에 들러 분대와 같이 오자"
                : "받아서 1분대 줄 내 자리에 앉아 먹는다",
            disabled: !ok || ate || !!myMeal.tray || alone,
            onSelect: () => {
              useGame.getState().spend(1);
              myMeal.tray = meal;
              // 식판을 직접 받는 건 이번 한 번뿐: 다음 끼니부터는 식당에 도착하면 이미 받아서 앉아 있다
              useGame.getState().applyEffects({ flag: "trayOnce" }, undefined, true);
              setOverlay({
                type: "dialogue",
                script: {
                  lines: [
                    {
                      who: "narr",
                      text:
                        meal === "lunch"
                          ? "오늘의 메뉴는 제육볶음! 배식병이 밥차에서 밥을 꾹꾹 눌러 담아 준다."
                          : "저녁은 카레. 밥차의 국자 가득 카레가 부어진다.",
                    },
                    {
                      who: "narr",
                      text: "식판을 들고 1분대 줄, 내 자리로 가서 앉자.",
                    },
                  ],
                },
              });
            },
          });
          break;
        }
        case "px": {
          title = `🏪 ${STORE_NAME[st.branch]}`;
          for (const it of Object.values(ITEMS)) {
            opts.push({
              label: `${it.icon} ${it.name}`,
              hint: it.desc,
              disabled: !free,
              onSelect: () => {
                useGame.getState().buy(it.id);
              },
            });
          }
          if (!free)
            opts.push({
              label: "(운영 시간: 점심·개인정비 시간)",
              disabled: true,
              onSelect: () => {},
            });
          break;
        }
        case "cyber": {
          title = "💻 사이버지식정보방 (싸지방)";
          act(
            "인터넷 편지 확인",
            "30분 (1일 1회)",
            30,
            { mental: 6, memory: st.clues.length ? 2 : 0 },
            '누군가의 PC에 접속했다. 친구들이 보낸 인터넷 편지를 읽었다. "포켓몬이라니 ㅋㅋㅋ 사진 보내봐"',
            "letter",
            !free,
          );
          act(
            "자격증 공부",
            "40분 (1일 1회)",
            40,
            { skill: 4, mental: -3 },
            "인강을 들으며 문제를 풀었다. 머리가 지끈하지만 뿌듯하다.",
            "study",
            !free,
          );
          break;
        }
        case "gym": {
          title = "🏋️ 체단실";
          act(
            "운동하기",
            "30분 (1일 1회)",
            30,
            { hp: -8, mental: 6, discipline: 2 },
            "팔굽혀펴기와 턱걸이를 했다. 포켓몬 근육이 꿈틀댄다!",
            "gym",
            !free,
          );
          break;
        }
        case "admin": {
          title = "🗂️ 행정반";
          if (!q)
            opts.push({
              label: "간부님들이 업무 중이시다.",
              disabled: true,
              onSelect: () => {},
            });
          break;
        }
        case "command": {
          title = "📡 지휘통제실";
          if (st.patrol) {
            const all = st.patrol.done.length >= PATROL_SPOTS.length;
            opts.push({
              label: "🔦 순찰 결과 보고",
              hint: all
                ? "당직사관에게"
                : `아직 ${PATROL_SPOTS.length - st.patrol.done.length}곳 남음`,
              disabled: !all,
              onSelect: () =>
                setOverlay({
                  type: "dialogue",
                  script: {
                    npc: "lt",
                    lines: [
                      {
                        who: "me",
                        text: "{S}! 야간 순찰 결과 보고드립니다. 막사 1·2층 복도, 세탁실, 화장실 이상 무! 특이 사항은 메모해 두었습니다.",
                      },
                      {
                        who: "npc",
                        text: "수고했다. 꼼꼼하게 봤구먼. 들어가서 쉬어라.",
                      },
                    ],
                  },
                  onDone: () => useGame.getState().finishPatrol(true),
                }),
            });
          }
          const sc = st.schedule();
          const night = sc.some((e) => e.kind === "night");
          opts.push({
            label: "오늘 근무표 확인",
            hint: "5분",
            onSelect: () => {
              useGame.getState().spend(5);
              setOverlay({
                type: "dialogue",
                script: {
                  lines: [
                    {
                      who: "narr",
                      text: `📋 오늘 일정: ${sc.map((e) => `${fmtTime(e.start)} ${e.label}`).join(" / ")}`,
                    },
                    {
                      who: "narr",
                      text: night
                        ? sc.some((e) => e.game === "guard")
                          ? "🌙 오늘 밤 위병소 근무 명단(00:00~02:00)에 내 이름이 있다…"
                          : "🌙 오늘 밤 불침번 명단(00:00~01:00)에 내 이름이 있다…"
                        : "🌙 오늘 밤 근무 명단에는 내 이름이 없다. 휴~",
                    },
                    {
                      who: "narr",
                      text: "암구호는 근무 투입 직전에만 공지된다. 보안!",
                    },
                  ],
                },
              });
            },
          });
          opts.push({
            label: "상황판 살펴보기",
            hint: "5분",
            onSelect: () => {
              useGame.getState().spend(5);
              setOverlay({
                type: "dialogue",
                script: {
                  lines: [
                    {
                      who: "narr",
                      text: "부대 배치도, 비상 연락망, 오늘의 기상 정보가 빼곡하다.",
                    },
                    {
                      who: "me",
                      text: "(유튜브에서 본 그 상황판이다… 실물은 처음 본다.)",
                    },
                  ],
                },
              });
            },
          });
          break;
        }
        case "tv": {
          title = "📺 휴게실 TV";
          act(
            "TV 보기",
            free ? "20분 (1일 1회)" : "개인정비 시간에만",
            20,
            { mental: 5 },
            "오랜만에 보는 예능 프로그램. 다 같이 깔깔 웃었다. 채널을 돌리니 잉어킹이 튀어오르기를 쓰고 있다. …그러나 아무 일도 일어나지 않았다!",
            "tv",
            !free,
          );
          break;
        }
        case "library": {
          title = "📚 도서관";
          act(
            "책 읽기",
            free ? "30분 (1일 1회)" : "개인정비·점심 시간에만",
            30,
            { mental: 4, skill: 2 },
            "진중문고 신간을 골라 읽었다. 어제 외운 영단어는… 1, 2, 그리고… 펑! 깨끗이 잊어버렸다.",
            "library",
            !free,
          );
          break;
        }
        case "laundry1":
        case "laundry2": {
          title = "🧺 세탁실";
          act(
            "빨래 돌리기",
            free ? "20분 (1일 1회)" : "개인정비·점심 시간에만",
            20,
            { mental: 3 },
            "전투복과 수건을 세탁기에 넣고 돌렸다. 섬유유연제 냄새에 기분이 좋아진다.",
            "laundry",
            !free,
          );
          break;
        }
        case "wc1":
        case "wc2": {
          title = "🚻 화장실";
          if (
            st.clues.length > 0 &&
            st.day >= 2 &&
            !!st.flags["order_M-02"] &&
            !st.clues.includes("C-02")
          ) {
            opts.push({
              label: "세면하기",
              hint: "5분",
              onSelect: () => {
                useGame.getState().spend(5);
                const reveal = (reward: number) => {
                  // 멘탈 보상은 풀었을 때 한 번만 (다시 도전할 때마다 받지 않도록)
                  useGame.getState().applyEffects({ mental: 1 }, "세면하기");
                  setFlash(true);
                  setOverlay({
                    type: "dialogue",
                    script: {
                      lines: [
                        {
                          who: "me",
                          text: "(88초. 세수할 시간은 충분하다.)",
                        },
                        {
                          who: "narr",
                          text: "차가운 물로 얼굴을 씻고 고개를 든 순간 — 거울 속에… 까까머리 사람이 서 있다.",
                        },
                        {
                          who: "narr",
                          text: "눈을 깜빡이자, 다시 포켓몬이다.",
                        },
                        {
                          who: "me",
                          text: "(…착각 아니야. 나였어. 저게 원래 나야.)",
                        },
                      ],
                    },
                    onDone: () => {
                      useGame.getState().findClue("C-02", reward);
                      withReport(storyCtxRef.current, "M-02");
                    },
                  });
                };
                // 🧩 P-02 수건걸이 위의 아이앤트: 세면대가 비기를 기다렸다가 씻고, 고개를 들면 거울이 진짜 모습을 비춘다
                setOverlay({
                  type: "dialogue",
                  script: {
                    lines: [
                      {
                        who: "narr",
                        text: "세면대 앞에 섰는데, 수도꼭지 위 수건걸이 봉으로 아이앤트 여섯 마리가 줄지어 지나가고 있다.",
                      },
                      {
                        who: "me",
                        text: "(건드리면 문다던데… 다 지나갈 때까지 기다려야겠다. 얼마나 걸리려나. 3분 안에 돌아가야 하는데.)",
                      },
                    ],
                  },
                  onDone: () =>
                    setOverlay({ type: "puzzle", id: "P-02", onSolved: reveal }),
                });
              },
            });
          } else if (st.day >= 2 && !st.clues.includes("C-02") && !st.flags["order_M-02"]) {
            // 🚿 분대장이 세면하고 오라고 지시하기 전에는 세면대에서 아무 일도 일어나지 않는다 (거울은 그 지시를 받고 와서 본다)
            opts.push({
              label: "세면하기",
              hint: "지금은 씻을 일이 없다",
              disabled: true,
              onSelect: () => {},
            });
          } else {
            act(
              "세면하기",
              "5분",
              5,
              { mental: 1 },
              "거울 속에 포켓몬이 서 있다. …아직도 적응이 안 된다.",
            );
          }
          break;
        }
        case "water1":
        case "water2": {
          title = "🚰 정수기";
          act(
            "🥤 시원한 물 마시기",
            "2분 (1일 1회)",
            2,
            { hp: 3 },
            '정수기에서 "시원한 물" 한 컵. 옛날 백화점 옥상 자판기에서 200원 주고 뽑던 그 맛이다. …목마른 경비원이 있으면 한 잔 건네주고 싶어진다.',
            "water",
          );
          break;
        }
        case "board1":
        case "board2": {
          title = "📌 복도 게시판";
          const show = (
            lines: { who: "narr" | "me"; text: string }[],
            tip?: string,
          ) => {
            useGame.getState().spend(3);
            if (tip) useGame.getState().addTip(tip);
            setOverlay({ type: "dialogue", script: { lines } });
          };
          opts.push({
            label: "경계작전명령서",
            hint: "근무 전 숙지",
            onSelect: () =>
              show(
                [
                  {
                    who: "narr",
                    text: "📋 경계작전명령서 — 근무 투입 전 반드시 숙지할 것!",
                  },
                  {
                    who: "narr",
                    text: `경계 지역: 위병소 초소 · ${FACILITY_NAME[st.branch]} 일대 / 순찰: 2인 1조`,
                  },
                  {
                    who: "narr",
                    text: '수하 절차: "정지!" → "누구냐!" → 문어 → 답어 확인 → 통과 또는 정지·보고',
                  },
                  {
                    who: "narr",
                    text: "※ 암구호는 게시하지 않는다. 근무 투입 직전 구두로만 전달.",
                  },
                ],
                "경계작전명령서에는 경계 지역·임무·수하 절차가 적혀 있다. 암구호는 보안상 절대 게시하지 않는다.",
              ),
          });
          opts.push({
            label: "🎂 이번 달 생일자",
            hint: "선물하면 호감 보너스",
            onSelect: () => {
              const names = birthdayNpcs(st.day).map((id) =>
                npcDisplayName(st.branch, id, st.day),
              );
              if (
                st.clues.length > 0 &&
                st.day >= 3 &&
                !!st.flags["order_M-03"] &&
                !st.clues.includes("C-03")
              ) {
                useGame.getState().spend(3);
                const reveal = (reward: number) =>
                  setOverlay({
                    type: "dialogue",
                    script: {
                      lines: [
                        {
                          who: "narr",
                          text: "주사위를 오늘 날짜로 돌려 놓자, 명단 맨 아래에 못 보던 줄 하나가 눈에 들어온다. 번진 글씨가 또렷해진다.",
                        },
                        { who: "narr", text: "「{me} — 입대일」" },
                        { who: "me", text: "(…내 이름이다. 내 진짜 이름.)" },
                        {
                          who: "narr",
                          text: "다시 보니, 그 줄은 사라지고 없었다.",
                        },
                      ],
                    },
                    onDone: () => {
                      useGame.getState().findClue("C-03", reward);
                      withReport(storyCtxRef.current, "M-03");
                    },
                  });
                // 🧩 P-03 날짜판 주사위: 날짜판을 오늘 날짜로 맞춰 놓아야 명단에서 내 이름이 드러난다
                setOverlay({
                  type: "dialogue",
                  script: {
                    lines: [
                      {
                        who: "narr",
                        text: `🎂 이번 달 생일자: ${names.length ? names.join(", ") : "없음"}`,
                      },
                      {
                        who: "narr",
                        text: "명단 옆에는 행정반이 매일 맞춰 놓는 날짜판이 걸려 있다. 나무 주사위 두 개로 오늘 날짜를 나타내는데, 한쪽 주사위의 숫자가 닳아 지워졌다.",
                      },
                      {
                        who: "me",
                        text: "(날짜부터 맞춰 놓으라고 했지. 지워진 면에 뭐가 적혀 있었는지 알아야 다시 써 넣을 수 있다.)",
                      },
                    ],
                  },
                  onDone: () =>
                    setOverlay({ type: "puzzle", id: "P-03", onSolved: reveal }),
                });
                return;
              }
              show(
                names.length
                  ? [
                      {
                        who: "narr",
                        text: `🎂 이번 달 생일자: ${names.join(", ")}`,
                      },
                      {
                        who: "me",
                        text: "(생일인 사람에게 PX 간식이라도 선물하면 좋아하겠지?)",
                      },
                    ]
                  : [{ who: "narr", text: "🎂 이번 달 생일자: 없음" }],
              );
            },
          });
          opts.push({
            label: "🍱 이번 주 식단표",
            hint: "",
            onSelect: () =>
              show([
                {
                  who: "narr",
                  text: "월 제육볶음 · 화 카레 · 수 닭갈비 · 목 짜장 · 금 돈가스 · 토 라면 · 일 김치찌개",
                },
                { who: "me", text: "(금요일 돈가스… 버틸 이유가 생겼다.)" },
              ]),
          });
          opts.push({
            label: "📢 부대 공지",
            hint: "",
            onSelect: () =>
              show(
                [
                  {
                    who: "narr",
                    text: "포상휴가: 특등사수 · 우수 근무자 · 모범 분대",
                  },
                  {
                    who: "narr",
                    text: "마음의 편지 상시 접수 · 국방헬프콜 ☎1303 (24시간)",
                  },
                  {
                    who: "narr",
                    text: `※ ${STORE_NAME[st.branch]} 앞 트럭 밑에서 "뮤"를 봤다는 소문은 사실무근임. 트럭을 밀지 말 것.`,
                  },
                ],
                "부조리나 고민은 마음의 편지, 국방헬프콜(1303)로 언제든 알릴 수 있다.",
              ),
          });
          break;
        }
        case "maint": {
          title = "🔧 정비실";
          act(
            "공구 정리",
            free ? "20분 (1일 1회)" : "개인정비·점심 시간에만",
            20,
            { skill: 2 },
            "스패너·드라이버·몽키를 공구함 번호에 맞춰 정리하고 공구 대장에 서명했다.",
            "maint",
            !free,
          );
          break;
        }
        case "kitchen": {
          title = "🍳 조리실";
          act(
            "취사 지원 (설거지)",
            free ? "30분 (1일 1회)" : "개인정비·점심 시간에만",
            30,
            { discipline: 2, hp: -4 },
            "대형 식판 세척기 앞에서 땀을 뻘뻘 흘렸다. 조리병들의 고생을 조금은 알 것 같다.",
            "kitchen",
            !free,
          );
          break;
        }
        case "court": {
          title = "🏀 농구장";
          act(
            "농구 한 판",
            free ? "30분 (1일 1회)" : "개인정비·점심 시간에만",
            30,
            { hp: -6, mental: 8 },
            "쉬는 시간에 모인 병사들과 3대3 농구를 했다. 슛이 들어갈 때마다 환호성이 터진다!",
            "court",
            !free,
          );
          break;
        }
        case "recycle": {
          title = "♻️ 분리수거장";
          act(
            "생활관 쓰레기 분리수거",
            "15분 (1일 1회)",
            15,
            { discipline: 2 },
            "페트병은 라벨을 떼고, 캔은 찌그러뜨리고, 음식물은 물기를 빼서. 분리수거도 군기다.",
            "recycle",
          );
          break;
        }
        case "cairn": {
          title = "🪨 이끼 낀 돌탑";
          opts.push({
            label: "돌탑 살펴보기",
            hint: "",
            onSelect: () =>
              setOverlay({ type: "dialogue", script: { lines: cairnLines() } }),
          });
          break;
        }
        case "ammoledger": {
          title = "📒 탄약 수불 대장";
          opts.push({
            label: "수불 대장 넘겨 보기",
            hint: "",
            onSelect: () =>
              setOverlay({ type: "dialogue", script: { lines: ammoLedgerLines() } }),
          });
          break;
        }
        case "ammo": {
          const fac = FACILITY_NAME[st.branch];
          title = `🔒 ${fac}`;
          const lines: { who: "narr" | "me"; text: string }[] =
            st.branch === "army"
              ? [
                  {
                    who: "narr",
                    text: "탄약고 — 관계자 외 출입 금지. 출입은 반드시 2인 1조, 탄약 수불 대장에 기록한다.",
                  },
                  {
                    who: "narr",
                    text: "울타리 안쪽, 벙커 철문이 한 뼘쯤 열려 있다. 아무도 그걸 이상하게 여기지 않는다.",
                  },
                  {
                    who: "me",
                    text: "(밀덕 유튜브에서 본 그 탄약고 근무… 겨울엔 진짜 춥다던데.)",
                  },
                ]
              : st.branch === "air"
                ? [
                    {
                      who: "narr",
                      text: "격납고 — 항공기 정비 구역. 허가된 인원만 출입, FOD 주의!",
                    },
                    {
                      who: "narr",
                      text: "안쪽에서 전투기 정비 소리가 웅웅 울린다.",
                    },
                    {
                      who: "me",
                      text: "(실물 전투기를 이렇게 가까이서 보다니…!)",
                    },
                  ]
                : [
                    {
                      who: "narr",
                      text: "함정 부두 — 함정에 오를 땐 현문 당직에게 경례하고 신분을 밝힌다.",
                    },
                    { who: "narr", text: "PKG-999가 출항 준비로 분주하다." },
                    {
                      who: "me",
                      text: "(현문 경례… 유튜브에서 수십 번 돌려 본 장면이다.)",
                    },
                  ];
          opts.push({
            label: "주변 살펴보기",
            hint: "5분",
            onSelect: () => {
              useGame.getState().spend(5);
              setOverlay({ type: "dialogue", script: { lines } });
            },
          });
          break;
        }
        case "post": {
          title = "🛡️ 위병소 초소";
          if (!q)
            opts.push({
              label: "근무자가 경계 근무 중이다.",
              disabled: true,
              onSelect: () => {},
            });
          break;
        }
        default:
          return;
      }
      // 🍬 숨은 별사탕: 장소마다 한 번 (퍼즐 힌트를 여는 데 쓴다)
      const hide = CANDY_SPOTS[id];
      if (hide && st.clues.length > 0 && !st.flags[`candy_${id}`])
        opts.push({
          label: `🍬 ${hide.label}`,
          hint: "뭔가 있을지도",
          onSelect: () => {
            const s2 = useGame.getState();
            s2.spend(2);
            s2.applyEffects({ candy: 1, flag: `candy_${id}` }, "별사탕");
            setOverlay({
              type: "dialogue",
              script: { lines: [{ who: "narr", text: hide.text }] },
            });
          },
        });
      // 🧩 짬짬이 퍼즐: 선택. 풀면 기억과 별사탕을 얻고, 그 장소에서 사라진다.
      // 난이도별로 놓여 있다: 쉬움은 처음부터, 보통은 일병부터, 어려움은 상병부터 (짬이 차야 선임들이 어려운 문제를 내준다)
      const quickOpt = quickOptionRef.current(id);
      if (quickOpt) opts.push(quickOpt);
      opts.push({ label: "닫기", onSelect: () => setOverlay(null) });
      setOverlay({ type: "menu", title, options: opts });
    },
    [setOverlay, mirrorScene],
  );

  const openExtraRef = useRef<(id: string, skipStory?: boolean) => void>(
    () => {},
  );
  const openExtra = useCallback(
    (id: string, skipStory = false) => {
      const def = extraDefs.find((d) => d.id === id);
      if (!def) return;
      const st = useGame.getState();
      const ex = extras.current[id];
      // 😴 아침에 못 일어난 선임이면 깨워 드린다
      if (sleepySenior(st) === `x:${id}`) {
        wakeSeniorRef.current();
        return;
      }
      // 🌙 밤 근무 중의 당직병(행정병): 지휘통제실에서 밤을 새우는 사람의 말을 한다 (시간은 쓰지 않는다)
      if (id === "clerk" && st.minute >= LIGHTS_OUT) {
        const odd = st.clues.includes("C-07") || haunt.stalks > 0 ? NIGHT_CLERK_ODD : [];
        const words = def.title.split(" ");
        setOverlay({
          type: "dialogue",
          script: {
            custom: { name: `${def.name} ${words[words.length - 1]}`, sub: "당직병", look: extraLook(def), cap: BRANCHES[st.branch].cap as CapType },
            lines: [{ who: "npc", text: pickTalk("x:clerk-night", [...NIGHT_CLERK_TALK, ...odd]) }],
          },
        });
        return;
      }
      const storyOn = st.clues.length > 0;
      // 💭 전역했어야 할 사람을 찾아가 말을 걸다가: 계급이 왜 아직도 그대로인지 의아해진다 (하루에 한 사람당 한 번)
      if (
        storyOn && !st.nightDuty && extraOverdue(def, st.day) && !st.daily.includes(`overdue_${def.id}`) &&
        // 아직 이병이면(한 번도 진급하지 않았으면) 남의 계급장이 그대로인 게 이상하다고 느낄 수 없다
        rankIdxForDay(st.day) >= 1 &&
        // 너무 자주 떠올리지 않는다: 처음 한 번은 꼭, 그 뒤로는 하루에 많아야 한 번 · 그날 그 사람에게 마음이 걸릴 때만(셋 중 하나꼴)
        (!st.flags.overdueSeen || (!st.daily.includes("overdue_any") && hashStr(`overdue-${st.day}-${def.id}`) % 3 === 0)) &&
        !(ex && extraAsleep(id, ex, st.minute))
      ) {
        st.markDaily(`overdue_${def.id}`);
        st.markDaily("overdue_any");
        const first = !st.flags.overdueSeen;
        setOverlay({
          type: "dialogue",
          script: {
            lines: [
              { who: "narr", text: `${def.name}에게 말을 걸려다, 가슴의 계급장에 눈이 멈췄다.` },
              { who: "me", text: overdueThought(def.id, def.name, st.day) },
              ...(first
                ? [
                    { who: "me" as const, text: "(전역 날짜가 지났는데 왜 계급도, 자리도 그대로일까. …이상하다. 수첩에 적어 두자.)" },
                    { who: "narr" as const, text: "❓ 수첩의 「사라지는 전역자」에 한 줄을 보탰다." },
                  ]
                : []),
            ],
          },
          onDone: () => {
            const s2 = useGame.getState();
            if (first) {
              s2.applyEffects({ flag: "overdueSeen" }, undefined, true);
              s2.checkSuspicions();
            }
            openExtraRef.current(id, skipStory);
          },
        });
        return;
      }
      const asleepNow = !!ex && extraAsleep(id, ex, st.minute);
      const hostSpot = quickSpotOfHost(id);
      const hostOpt = hostSpot && !skipStory && !asleepNow ? quickOptionRef.current(hostSpot) : null;
      const sopts = [
        ...(skipStory || asleepNow ? [] : storyExtraOptions(id, storyCtx)),
        ...(hostOpt && !hostOpt.hint?.includes("🔒") ? [hostOpt] : []),
      ];
      if (sopts.length) {
        setOverlay({
          type: "menu",
          title: `${def.name} ${def.title}`,
          options: [
            ...sopts,
            {
              label: "이야기하기",
              onSelect: () => openExtraRef.current(id, true),
            },
            { label: "그만두기", onSelect: () => setOverlay(null) },
          ],
        });
        return;
      }
      if (id === "librarian" && !(ex && extraAsleep(id, ex, st.minute))) {
        const lspeaker = {
          name: `${def.name} 상병`,
          sub: "도서관 관리병",
          look: extraLook(def),
          cap: BRANCHES[st.branch].cap as CapType,
        };
        if (storyOn && !!st.flags["order_M-04"] && !st.clues.includes("C-08")) {
          useGame.getState().spend(10);
          setOverlay({
            type: "dialogue",
            script: {
              custom: lspeaker,
              lines: [
                { who: "npc", text: "……" },
                { who: "me", text: "저기, 책 좀 빌리려고 하는데요." },
                { who: "npc", text: "…책은 읽는 사람을 고른다." },
                {
                  who: "narr",
                  text: "(네이티오가 창밖의 해를 바라본 채, 날개로 서가 구석을 가리킨다.)",
                },
                {
                  who: "narr",
                  text: "(서가 구석에 먼지 쌓인 얇은 책 여섯 권이 뒤죽박죽 꽂혀 있다. 책등마다 별이 찍혀 있다.)",
                },
              ],
            },
            // 🧩 P-04 낡은 책 여섯 권: 네이티오의 말대로 꽂아야 한 권의 책이 된다
            onDone: () =>
              setOverlay({
                type: "puzzle",
                id: "P-04",
                onSolved: (reward) =>
                  setOverlay({
                    type: "dialogue",
                    script: {
                      custom: lspeaker,
                      lines: [
                        {
                          who: "narr",
                          text: "(책등의 글자가 이어진다. 별 · 똥 · 별 · 부 · 대 · 사.)",
                        },
                        {
                          who: "narr",
                          text: "(여섯 권이 한 권으로 겹쳐진다. 낡은 책 「별똥별 부대사」. 첫 장만 읽힌다.)",
                        },
                        {
                          who: "narr",
                          text: "『천 년에 한 번 별이 깨어날 때, 소원은 부대가 된다.』",
                        },
                        {
                          who: "narr",
                          text: "(나머지 페이지는 물에 젖어 붙어 있다.)",
                        },
                        {
                          who: "npc",
                          text: "젖은 페이지는 마르기를 기다려라. …이틀이면 된다.",
                        },
                      ],
                    },
                    onDone: () => {
                      useGame.getState().findClue("C-08", reward);
                      withReport(storyCtxRef.current, "M-04");
                    },
                  }),
              }),
          });
          return;
        }
        // 하루 한 번 수수께끼 힌트
        const nextM = storyOn
          ? STORY_MISSIONS.find((m) => missionReady(m, st))
          : null;
        const riddle = !nextM
          ? "…다음 장은 아직 쓰이지 않았다. 해가 몇 번 더 떠야 한다."
          : nextM.id === "M-02"
            ? "…물은 얼굴을 비춘다. 거울은 거짓말을 못 하지."
            : nextM.id === "M-03"
              ? "…이름은 벽에 붙어 있다. 생일을 세는 곳에."
              : nextM.id === "N-01"
                ? "…안개는 밤에 더 짙다. 정문을 두려워하지 마라."
                : nextM.id === "M-05"
                  ? "…편지는 날짜가 없어도 도착한다. 화면 속 우체통을 열어 보거라."
                  : nextM.id === "M-06"
                    ? "…물에 젖은 이름은 빨래와 함께 돌아온다. 동기와 함께 가거라."
                    : nextM.id === "M-07"
                      ? "…시계도 가끔 숨을 참는다. 자정마다."
                      : nextM.id === "D-01"
                        ? "…혼자 품은 의문은 무겁다. 같은 별을 본 자에게 털어놓거라."
                        : nextM.id === "N-02"
                          ? "…밤의 서가는 낮과 다른 말을 한다. 빛을 거두면 들린다."
                          : nextM.id === "M-08"
                            ? "…버려진 종이에도 주인이 있다. 매년 같은 문장의."
                            : nextM.id === "M-09"
                              ? "…잡음 속에도 목소리가 있다. 기름 냄새 나는 방 구석에."
                              : nextM.id === "M-10"
                                ? "…물은 사흘이면 마른다. 안쪽 방의 문은 열쇠를 가진 자에게 묻거라."
                                : nextM.id === "M-11"
                                  ? "…같은 얼굴이 해마다 웃고 있다. 그 얼굴은 지금 2생활관에 있다."
                                  : nextM.id === "D-02"
                                    ? "…별은 높은 곳에서 더 크게 보인다. 계단 끝 철문 너머."
                                    : nextM.id === "M-12"
                                      ? "…꿈을 먹는 자는 시계 소리를 낸다. 그리고 바닥에 동그라미를 그린다."
                                      : nextM.id === "N-04"
                                        ? "…글자들은 아직 말을 다 하지 않았다."
                                        : nextM.id === "M-13"
                                          ? "…잊은 것은 함께 걸은 길 위에 떨어져 있다."
                                          : nextM.id === "D-03"
                                            ? "…일곱 개의 별, 그리고 스스로 놓는 손."
                                            : nextM.id === "B-01"
                                              ? "…똑딱 소리가 들리면 눈을 감지 마라. 친구의 이름을 떠올려라."
                                              : nextM.id === "F-01"
                                                ? "…마지막 별은 구령대에 내려앉는다. 네 발로 가거라."
                                                : def.lines[
                                                    Math.floor(
                                                      Math.random() *
                                                        def.lines.length,
                                                    )
                                                  ];
        useGame.getState().spend(5);
        setOverlay({
          type: "dialogue",
          script: { custom: lspeaker, lines: [{ who: "npc", text: riddle }] },
        });
        return;
      }
      if (
        id === "guard" &&
        storyOn &&
        st.day >= 4 &&
        !st.clues.includes("C-04")
      ) {
        const gspeaker = {
          name: `${def.name} ${def.title.split(" ").pop()}`,
          sub: def.title.split(" ").slice(0, -1).join(" "),
          look: extraLook(def),
          cap: BRANCHES[st.branch].cap as CapType,
        };
        setOverlay({
          type: "dialogue",
          script: {
            custom: gspeaker,
            lines: [
              {
                who: "npc",
                text: "어젯밤 정문 쪽 안개 봤냐? …아직도 좀 남아 있더라. 기분 이상하게.",
              },
            ],
          },
        });
        return;
      }
      if (ex && extraAsleep(id, ex, st.minute)) {
        if (snorlaxCookAsleep(id, st.minute)) {
          setOverlay({
            type: "dialogue",
            script: {
              lines: [
                {
                  who: "narr",
                  text: pickTalk("x:cook-sleep", [
                    "잠만보가 쿨쿨 자고 있다. …다행히 길을 막고 있지는 않다.",
                    "잠만보가 배를 드러내고 자고 있다. 뭔가 익숙한 장면인데...",
                    "드르렁… 잠만보는 식사 시간이 아니면 일어나지 않는다. 주방 구석이라 지나다니는 데는 문제없다.",
                  ]),
                },
              ],
            },
          });
          return;
        }
        setOverlay({
          type: "dialogue",
          script: {
            lines: [
              {
                who: "narr",
                text:
                  id === "dog"
                    ? "(군견이 몸을 말고 새근새근 자고 있다.)"
                    : "(곤히 자고 있다… 깨우지 말자.)",
              },
            ],
          },
        });
        return;
      }
      const speaker = extraSpeakerInfo(def, st.branch);
      const say = () => {
        useGame.getState().spend(5);
        const line = pickTalk(`x:${def.id}`, [
          ...def.lines,
          ...(EXTRA_TALK_MORE[def.id] ?? []),
        ]);
        setOverlay({
          type: "dialogue",
          script: { custom: speaker, lines: [{ who: "npc", text: line }] },
        });
      };
      if (!def.daily) {
        say();
        return;
      }
      const daily = def.daily;
      const key = `extra_${def.id}`;
      const used = st.daily.includes(key);
      setOverlay({
        type: "menu",
        title: `${def.name} ${def.title}`,
        options: [
          { label: "이야기하기", hint: "5분", onSelect: say },
          {
            label: daily.label,
            hint: used ? "오늘은 이미 했다" : daily.hint,
            disabled: used,
            onSelect: () => {
              const s2 = useGame.getState();
              s2.markDaily(key);
              s2.spend(10);
              s2.applyEffects(daily.effects, daily.label);
              s2.log(`🩺 ${def.name}: ${daily.label}`);
              setOverlay({
                type: "dialogue",
                script: {
                  custom: speaker,
                  lines: [{ who: "narr", text: daily.text }],
                },
              });
            },
          },
          { label: "그만두기", onSelect: () => setOverlay(null) },
        ],
      });
    },
    [extraDefs, setOverlay],
  );

  openExtraRef.current = openExtra;

  /** 식판을 들고 내 자리에 앉는다 (밥차에서 직접 받아 온 첫 끼니) → 밥상 대화로 */
  const sitToEat = useCallback(() => {
    if (!myMeal.tray || myMeal.eating) return;
    startMealRef.current(myMeal.tray);
  }, []);

  const interact = useCallback(() => {
    // 🎬 장면이 바뀌는 중(화면 전환 · 연출)에는 상호작용을 받지 않는다 (연타로 같은 일이 두 번 시작되지 않게)
    if (holdRef.current || warpReq.current) return;
    const it = promptRef.current ?? findInteractable();
    if (!it) return;
    // 📖 전역일: 별에게 대답하기 전엔 위병소를 나서지 않는다
    if (it.kind === "event" && finalStarOn(useGame.getState())) {
      useGame
        .getState()
        .toast(
          "✨ 하늘이 밝아진다… 연병장 구령대 위로 별 하나가 내려앉았다. 먼저 가 보자.",
          "alert",
        );
      return;
    }
    if (it.kind === "event") {
      const stE = useGame.getState();
      // 🌙 저녁 점호로 넘어가기 전에: 가야 할 곳(호출 · 심부름 · 보고)이 남았거나, 오늘 받을 임무를 아직 받지 못했으면 점호부터 하지 않는다
      if (stE.currentEvent()?.kind === "rollcall_pm") {
        const erE = errandNow(stE);
        if (erE) {
          stE.toast(erE.hud, "alert");
          return;
        }
        if (orderWindow(stE) && !(stE.mealCheck && !stE.mealCheck.done) && nextCallable(stE)) {
          forceCall.current = true;
          thought.current = { text: "(…아직 점호 준비를 하기엔 이르다. 누가 나를 찾는 것 같다.)", until: performance.now() + 2600 };
          return;
        }
      }
      stE.arrive();
      return;
    }
    if (it.kind === "seat") {
      sitToEat();
      return;
    }
    if (it.kind === "story") {
      storyActRef.current(it.key);
      return;
    }
    if (it.kind === "duty") {
      nightActRef.current(it.key);
      return;
    }
    if (it.kind === "wake") {
      wakeSeniorRef.current();
      return;
    }
    if (it.kind === "extra" && it.extra) {
      openExtra(it.extra);
      return;
    }
    if (it.kind === "npc" && it.npc) openNpc(it.npc);
    if (it.kind === "spot" && it.spot) openSpot(it.spot);
  }, [findInteractable, openNpc, openSpot, openExtra, sitToEat]);

  // 키 입력
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (overlayRef.current || useGame.getState().rollcall || holdRef.current) return;
      if (useGame.getState().nightDuty?.phase === "sleep") {
        if (
          e.key === "Enter" ||
          e.key === " " ||
          e.key === "e" ||
          e.key === "E"
        ) {
          e.preventDefault();
          nightWake();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        keys.current = {};
        useSettings.getState().openMenu();
        return;
      }
      keys.current[e.key.toLowerCase()] = true;
      if (
        [
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
          "tab",
        ].includes(e.key.toLowerCase())
      )
        e.preventDefault();
      // 🍚 먹는 중엔 다 먹을 때까지 앉아 있는다
      if (myMeal.eating) return;
      if (e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter")
        interact();
      if (e.key === "Tab") setOverlay({ type: "notebook" });
      if (e.key === "q" || e.key === "Q") setOverlay({ type: "quests" });
      if (e.key === "m" || e.key === "M") setOverlay({ type: "map" });
      if (e.key === "r" || e.key === "R") goHome();
      if (
        (e.key === "l" || e.key === "L") &&
        useGame.getState().patrol
      ) {
        const st = useGame.getState();
        if (
          !(
            st.clues.length > 0 &&
            atNightGlyphs(st.day) &&
            libraryLightsOut(storyCtxRef.current, false)
          )
        ) {
          st.toast("🔦 손전등을 껐다 켰다. …조용하다. 이상 무.", "info");
        }
      }
      if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
        const st = useSettings.getState();
        st.set(
          "mapZoom",
          stepMapZoom(st.mapZoom, e.key === "-" || e.key === "_" ? -1 : 1),
        );
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    const blur = () => {
      keys.current = {};
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [interact, setOverlay, goHome, nightWake]);

  // 메인 루프
  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let w = 0,
      h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
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
      const next = stepMapZoom(cur, e.deltaY < 0 ? 1 : -1);
      if (next !== cur) useSettings.getState().set("mapZoom", next);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // NPC 경로 설정: 같은 맵이면 바로, 다른 맵이면 문을 거쳐서 (야외가 허브)
    const route = (n: NpcRt, target: Pos) => {
      const [tm, tx, ty] = target;
      n.targetKey = `${tm}:${tx},${ty}`;
      const map = world.maps[n.map];
      if (n.map === tm) {
        n.viaDoor = null;
        n.path = findPath(map, Math.floor(n.x), Math.floor(n.y), tx, ty).slice(
          1,
        );
        return;
      }
      const door = doorToward(world, n.map, tm);
      if (!door) return;
      n.viaDoor = door;
      const [dx, dy] = door.tiles[0];
      n.path = findPath(map, Math.floor(n.x), Math.floor(n.y), dx, dy).slice(1);
    };

    // 🌅 부대 화면이 새로 뜰 때마다(새 하루 · 불러오기 · 다시 시작) "생활관을 나섰는지"를 지금 상태로 다시 따진다.
    // 지난 판의 기록이 남아 있으면, 침상에서 눈을 떴는데 분대원들이 이미 연병장에 나가 있어 생활관이 텅 비어 버린다
    {
      const st0 = useGame.getState();
      morningOut.day = st0.day;
      morningOut.out = !rollcallWaiting(st0) || runtime.player.map !== "room1";
    }
    // NPC 초기 배치 (목표 위치에 바로)
    for (const id of presentNpcs(useGame.getState().day)) {
      const [tm, tx, ty] = npcTarget(id);
      npcs.current[id] = {
        map: tm,
        x: tx + 0.5,
        y: ty + 0.5,
        dir: "down",
        moving: false,
        path: [],
        targetKey: `${tm}:${tx},${ty}`,
        viaDoor: null,
      };
    }

    // 문 전환 페이드: 0 → 1(검정) 사이 맵 교체 → 0
    let fade = 0;
    // 🔊 마지막으로 부딪힌 소리 · 발소리가 난 때
    let bumpAt = 0;
    let stepAt = 0;
    let fading: { door: Door; phase: "out" | "in" } | null = null;
    let doorCooldown = 0;
    // 문을 지나온 직후엔 키를 떼거나 한 칸 이상 벗어나야 다음 문이 동작 (계단 왕복 방지)
    let doorArmed = true;
    let arrivedAt = { x: 0, y: 0 };
    let shownMap: MapId = runtime.player.map;
    /** 내가 방금 떠나온 맵 (문 · 생활관 바로 가기로 맵이 바뀔 때마다) */
    let cameFrom: MapId | null = null;
    setLocation(shownMap);

    let npcRetarget = 0;
    let offerT = 0;
    /** 😴 침상에 눕혀 둔 늦잠 선임 (깨우면 침상 앞 통로에 일으켜 세운다) */
    let pinnedSleeper: string | null = null;
    let offerGivers = new Set<string>();
    // 💭 전역했어야 할 사람을 볼 때의 독백 (한 사람당 하루 한 번, 한동안은 다시 안 함)
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const st = useGame.getState();
      const p = runtime.player;
      const blocked =
        !!overlayRef.current ||
        !!st.rollcall ||
        useSettings.getState().open ||
        holdRef.current ||
        st.nightDuty?.phase === "sleep";
      const myAte =
        st.daily.includes(`meal_${mealOf(st.minute)}`) || !!myMeal.tray;
      // ⏱ 다음 일정 장소에 도착하면 그 시각으로 넘어가 바로 시작한다 (자유 시간이 남았으면 장소에서 E로 시작)
      const evA = st.currentEvent();
      if (
        evA &&
        !st.eventBegun &&
        !evA.auto &&
        evA.spot &&
        evA.kind !== "farewell" &&
        // 저녁 점호는 내 생활관에서 한다: 그 방에 있거나 누구와 이야기했다고 저절로 시작되지 않는다 (E로 시작)
        evA.kind !== "rollcall_pm" &&
        evA.start - st.minute <= ARRIVE_AUTO_GAP &&
        !(st.mealCheck && !st.mealCheck.done) &&
        !breakfastPending(st) &&
        !blocked &&
        !fading &&
        !cer.current &&
        !st.nightDuty &&
        inEventArea(world, evA.spot, p)
      )
        st.arrive();
      const map = world.maps[p.map];

      // 📖 안개 정문: 정문 밖(맨 아래 줄)으로 나가려 하면
      if (
        p.map === "depot" &&
        p.y > 28.6 &&
        !blocked &&
        !fading &&
        fogActive(st)
      )
        fogEventRef.current();
      // 🚫 그 밖에는 정문 밖으로 걸어 나갈 수 없다: 위병에게 붙잡히고, 스스로 탈영할 수는 없다
      else if (
        p.map === "depot" &&
        p.y > 28.6 &&
        !blocked &&
        !fading
      )
        desertRef.current();

      // 생활관 바로 가기 요청 → 문 이동처럼 페이드
      if (warpReq.current && !fading) {
        fading = { door: warpReq.current, phase: "out" };
        playSfx("sfx_door", 0.5);
        warpReq.current = null;
      }

      // 문 전환 진행
      if (fading) {
        if (fading.phase === "out") {
          fade = Math.min(1, fade + dt * 6);
          if (fade >= 1) {
            const d = fading.door;
            p.map = d.to;
            p.x = d.arrive.x;
            p.y = d.arrive.y;
            p.dir = d.arrive.dir;
            fading.phase = "in";
            doorCooldown = 0.4;
            doorArmed = false;
            arrivedAt = { x: p.x, y: p.y };
            // 장면 이동(goTo)이면 도착한 순간 다음 일을 시작한다
            (d as { onArrive?: () => void }).onArrive?.();
          }
        } else {
          fade = Math.max(0, fade - dt * 5);
          if (fade <= 0) fading = null;
        }
      }
      doorCooldown = Math.max(0, doorCooldown - dt);
      // 문 이동·순간이동 등으로 맵이 바뀌면 위치 표시 갱신
      if (p.map !== shownMap) {
        cameFrom = shownMap;
        shownMap = p.map;
        setLocation(p.map);
      }

      // 플레이어 이동
      let vx = 0,
        vy = 0;
      if (!blocked && !fading && !myMeal.eating) {
        const k = keys.current;
        if (k["arrowleft"] || k["a"]) vx -= 1;
        if (k["arrowright"] || k["d"]) vx += 1;
        if (k["arrowup"] || k["w"]) vy -= 1;
        if (k["arrowdown"] || k["s"]) vy += 1;
      }
      // 🧪 개발용 자동 이동: 목표 칸(다른 맵이면 그쪽 문)까지 길을 찾아 걷는다
      const ap = autopilot.current;
      if (ap && !blocked && !fading && !myMeal.eating) {
        let goal: [number, number] | null = null;
        let push: Dir | null = null;
        if (p.map === ap.map) {
          if (Math.hypot(p.x - (ap.x + 0.5), p.y - (ap.y + 0.5)) < 0.3) autopilot.current = null;
          else goal = [ap.x, ap.y];
        } else {
          const dr = doorToward(world, p.map, ap.map);
          if (!dr) autopilot.current = null;
          else {
            // 가장 가까운 문 칸으로 가서, 문 방향으로 밀고 들어간다
            const tile = [...dr.tiles].sort(
              (a, c) => Math.hypot(p.x - a[0] - 0.5, p.y - a[1] - 0.5) - Math.hypot(p.x - c[0] - 0.5, p.y - c[1] - 0.5),
            )[0];
            if (Math.hypot(p.x - (tile[0] + 0.5), p.y - (tile[1] + 0.5)) < 0.75) push = dr.enterDir;
            else goal = tile;
          }
        }
        if (push) {
          vx = push === "left" ? -1 : push === "right" ? 1 : 0;
          vy = push === "up" ? -1 : push === "down" ? 1 : 0;
        } else if (goal) {
          const path = findPath(map, Math.floor(p.x), Math.floor(p.y), goal[0], goal[1]);
          const node = path[1] ?? path[0] ?? goal;
          const dx = node[0] + 0.5 - p.x,
            dy = node[1] + 0.5 - p.y;
          vx = dx > 0.08 ? 1 : dx < -0.08 ? -1 : 0;
          vy = dy > 0.08 ? 1 : dy < -0.08 ? -1 : 0;
        }
      }
      // 🏃 Shift를 누른 채 이동하면 달리기 (지치지 않고 계속 달릴 수 있다)
      // 👟 전입 첫날 런닝슈즈를 받기 전에는 달릴 수 없다
      const sta = stamina.current;
      const hasShoes = !!st.flags.runShoes || st.day > 1;
      const dashing = hasShoes && (!!keys.current["shift"] || !!autopilot.current) && !!(vx || vy);
      sta.dashing = dashing;
      const speed = dashing ? DASH_SPEED : WALK_SPEED;
      // 막힌 문 앞에서는 이번 걸음을 되돌려 그 자리에 멈춘다
      const px0 = p.x,
        py0 = p.y;
      if (vx || vy) {
        const len = Math.hypot(vx, vy);
        const nx = p.x + (vx / len) * speed * dt;
        const ny = p.y + (vy / len) * speed * dt;
        if (!collides(map, nx, p.y)) p.x = nx;
        if (!collides(map, p.x, ny)) p.y = ny;
        p.dir =
          Math.abs(vx) > Math.abs(vy)
            ? vx > 0
              ? "right"
              : "left"
            : vy > 0
              ? "down"
              : "up";
        p.moving = true;
      } else p.moving = false;

      // 문으로 걸어 들어가면 다른 맵으로
      if (
        !doorArmed &&
        (!p.moving || Math.hypot(p.x - arrivedAt.x, p.y - arrivedAt.y) > 1.2)
      )
        doorArmed = true;
      if (
        !fading &&
        !blocked &&
        doorArmed &&
        doorCooldown <= 0 &&
        p.moving
      ) {
        for (const d of map.doors) {
          if (p.dir !== d.enterDir) continue;
          const hit = d.tiles.some(
            ([tx, ty]) =>
              Math.abs(p.x - (tx + 0.5)) < 0.9 &&
              Math.abs(p.y - (ty + 0.5)) < 1.0,
          );
          if (hit) {
            // 🚪 갈 곳이 정해져 있으면 다른 문은 열리지 않는다: 문 앞에서 발이 멈추고 혼잣말이 뜬다
            const why = doorLockRef.current(d);
            if (why) {
              p.x = px0;
              p.y = py0;
              p.moving = false;
              const th = thought.current;
              if (!th || th.text !== why || now > th.until - 900)
                thought.current = { text: why, until: now + 2600 };
              if (now - bumpAt > 700) {
                bumpAt = now;
                playSfx("sfx_bump", 0.7);
              }
              break;
            }
            if (d.to === "room2" && rankIdxForDay(st.day) < 2 && !st.nightDuty) {
              p.x = px0;
              p.y = py0;
              askEnterRef.current(d);
              break;
            }
            if (KNOCK_ROOMS[d.to]) {
              // 불려 간 곳 · 근무 신고와 보고를 하러 가는 곳: 어떻게 들어갈지 묻지 않고, 노크하고 관등성명을 댄 뒤 들어간다
              const ndK = st.nightDuty;
              const erK = errandNow(st);
              const expected =
                (ndK && (ndK.phase === "checkin" || ndK.phase === "report") && d.to === DUTY_DESK[0]) ||
                (!!st.patrol && d.to === DUTY_DESK[0]) ||
                (!!erK && erK.map === d.to && (erK.kind === "summon" || erK.kind === "report"));
              if (expected) {
                thought.current = {
                  text: `(똑똑) "${RANKS[rankIdxForDay(st.day)]} ${st.name}입니다. 들어가도 되겠습니까?"`,
                  until: now + 2600,
                };
                fading = { door: d, phase: "out" };
                playSfx("sfx_knock", 0.9);
                break;
              }
              p.x = px0;
              p.y = py0;
              knockRef.current(d);
              break;
            }
            fading = { door: d, phase: "out" };
            playSfx("sfx_door", 0.8);
            break;
          }
        }
      }
      // 🔊 벽에 막혀 한 발짝도 못 나갈 때 "툭" · 밤 근무 중에는 고요한 막사에 내 발소리가 울린다
      if ((vx || vy) && !fading && !overlayRef.current && !autopilot.current) {
        if (p.x === px0 && p.y === py0) {
          if (now - bumpAt > 520) {
            bumpAt = now;
            playSfx("sfx_bump", 0.4);
          }
        } else if ((st.nightDuty || st.patrol) && now - stepAt > (dashing ? 230 : 340)) {
          stepAt = now;
          playSfx("sfx_footstep", 0.3, 0.92 + Math.random() * 0.16);
        }
      }

      // 🔎 혼자 살펴보러 온 곳에 닿으면: 눈에 걸리던 것을 들여다본다 (짧은 장면 → 퍼즐)
      if (st.solo && soloLead.spot === st.solo && !soloLead.tried && !blocked && !fading) {
        const ss = world.spots[st.solo as SpotId];
        if (ss && ss.map === p.map && Math.hypot(p.x - (ss.x + 0.5), p.y - (ss.y + 0.5)) < 1.5) {
          soloLead.tried = true;
          soloRef.current(st.solo);
        }
      }
      // 🌅 내가 생활관을 나서면, 분대원들도 아침 점호 집합에 나선다
      if (morningOut.day !== st.day) {
        morningOut.day = st.day;
        morningOut.out = !rollcallWaiting(st) || p.map !== "room1";
      } else if (!morningOut.out && p.map !== "room1" && !(st.day === 1 && !st.flags.wokeUp)) morningOut.out = true;
      // 1일차: 세수하고 생활관으로 돌아오면 맞선임이 한마디 한다
      if (wakeTalkPending(st) && !blocked && !fading && p.map === "room1") {
        const sn = npcs.current.senior;
        if (sn && sn.map === "room1" && Math.hypot(sn.x - p.x, sn.y - p.y) < 3 && Math.hypot(sn.x - WAKE_TALK_AT[0], sn.y - WAKE_TALK_AT[1]) < 1.2)
          wakeTalkRef.current();
      }

      // 👣 내 발자취 기록 → 동행하는 사람이 내 바로 뒤를 따라온다
      trackMyTrail(p, world.maps[p.map]);
      /**
       * 🚶 겹쳐 걷지 않기: 같은 방향으로 가는 사람이 바로 앞(한 칸 안)에서 걷고 있으면, 그 사람이 멀어질 때까지 멈춰 선다.
       * 서 있는 사람이나 마주 오는 사람은 기다리지 않는다 (서로 영영 못 가는 일이 없도록 그냥 지나간다).
       */
      const DIR_VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const yieldFor = (n: NpcRt, key: string, gx: number, gy: number): boolean => {
        const hx = gx - n.x,
          hy = gy - n.y;
        const hl = Math.hypot(hx, hy);
        if (hl < 0.01) return false;
        const test = (o: NpcRt | undefined, ok: string): boolean => {
          if (!o || o === n || o.map !== n.map) return false;
          const dx = o.x - n.x,
            dy = o.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.85) return false;
          const going = o.moving || (!!o.held && o.path.length > 0);
          if (!going) return false;
          const [ox, oy] = DIR_VEC[o.dir];
          // 가는 방향이 다르면(마주 오거나 가로질러 가면) 기다리지 않는다
          if ((ox * hx + oy * hy) / hl < 0.3) return false;
          // 같은 자리에서 같이 출발했으면 한쪽만 먼저 간다
          if (d < 0.08) return key > ok;
          // 그 사람이 내 앞에 있을 때만
          return (dx * hx + dy * hy) / (d * hl) > 0.35;
        };
        for (const [ok, o] of Object.entries(npcs.current)) if (test(o, ok)) return true;
        for (const [ok, o] of Object.entries(extras.current)) if (test(o, `x:${ok}`)) return true;
        return false;
      };

      /** 동행: 가까이 오면 내 뒤에 붙어서, 내가 걸어온 길 그대로 한 칸 뒤를 따라온다. (아직 멀면 false → 길을 찾아 다가온다) */
      const followStep = (n: NpcRt): boolean => {
        if (n.map !== p.map) {
          if (!n.att) return false;
          // 뒤따라 문을 지나온다: 내 뒤에 설 자리가 생기면(내가 한 칸 걸어 나오면) 그 자리로 들어선다. 그 전엔 아직 문 밖
          const [bx, by] = trailBack(FOLLOW_GAP);
          n.path = [];
          n.viaDoor = null;
          n.moving = false;
          if (Math.hypot(bx - p.x, by - p.y) < FOLLOW_GAP * 0.7) return true;
          n.map = p.map;
          n.x = bx;
          n.y = by;
          n.dir = p.dir;
        } else if (!n.att) {
          if (Math.hypot(p.x - n.x, p.y - n.y) > 3) return false;
          n.att = true;
        }
        n.path = [];
        n.viaDoor = null;
        if (blocked) {
          n.moving = false;
          return true;
        }
        const [tx, ty] = trailBack(FOLLOW_GAP);
        const dx = tx - n.x,
          dy = ty - n.y;
        const d = Math.hypot(dx, dy);
        // 발자취가 아직 짧으면(막 문을 지났거나 제자리) 서서 기다린다
        if (d < 0.03 || Math.hypot(tx - p.x, ty - p.y) < FOLLOW_GAP * 0.7) {
          n.moving = false;
          const fx = p.x - n.x,
            fy = p.y - n.y;
          if (Math.hypot(fx, fy) > 0.3)
            n.dir =
              Math.abs(fx) > Math.abs(fy)
                ? fx > 0
                  ? "right"
                  : "left"
                : fy > 0
                  ? "down"
                  : "up";
          return true;
        }
        const sp = Math.min(d, Math.max(6.5, d * 7) * dt);
        n.x += (dx / d) * sp;
        n.y += (dy / d) * sp;
        n.dir =
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "right"
              : "left"
            : dy > 0
              ? "down"
              : "up";
        n.moving = true;
        return true;
      };

      // 📖 7일차 밤: 위병소 가는 길, 막사 1층 복도에 처음 보는 당직부관 (N-03)
      const ndN = st.nightDuty;
      if (
        ndN &&
        ndN.kind === "guard" &&
        ndN.phase === "toPost" &&
        st.day === 7 &&
        st.clues.length > 0 &&
        !st.flags.n03 &&
        p.map === "hq1" &&
        !blocked &&
        !fading &&
        !slipper.current
      ) {
        slipper.current = {
          map: "hq1",
          x: Math.min(22, Math.max(1.5, p.x + (p.dir === "left" ? -2 : 2))),
          y: 3.3,
        };
        keys.current = {};
        p.moving = false;
        slipperCorridor(storyCtxRef.current, (ok) => {
          slipper.current = null;
          if (!ok) {
            // 최면에 걸려 정신을 차려 보니 초소 앞
            const sp = world.spots.post;
            warpReq.current = {
              tiles: [],
              to: sp.map,
              enterDir: "up",
              arrive: { x: sp.x + 0.5, y: sp.y + 1.6, dir: "up" },
            } as unknown as Door;
            const nd2 = useGame.getState().nightDuty;
            if (nd2?.partner)
              placeAt(nd2.partner, sp.map, sp.x + 1.5, sp.y + 1.6, "up");
          }
        });
      }
      // 📖 10일차 아침: 동기가 내 이름을 잊었다 (기상 직후 1생활관)
      if (
        st.day >= 10 &&
        st.day < TOTAL_DAYS &&
        st.clues.length > 0 &&
        !st.flags.m13 &&
        st.minute < 6 * 60 + 14 &&
        p.map === "room1" &&
        !blocked &&
        !fading &&
        !m13Tried.current
      ) {
        m13Tried.current = true;
        placeAt("buddy", "room1", Math.min(13.5, p.x + 1), 4.5, "left");
        buddyForgets(storyCtxRef.current);
      }
      // 📖 5·9일차 밤 순찰: 글자들이 떠 있는 곳(5일차 2층 게시판 · 9일차 휴게실)에 다가가면 안내
      if (
        st.patrol &&
        atNightGlyphs(st.day) &&
        st.clues.length > 0 &&
        libHint.current !== st.day &&
        !(
          st.clues.includes("C-11") &&
          (st.day === 5 || st.clues.includes("C-15"))
        )
      ) {
        libHint.current = st.day;
        st.toast(
          st.day === 5
            ? "📌 2층 게시판. 손전등 빛 속에서 공지문의 글자들이 종이를 떠나 떠오른다… [L] 손전등 끄기"
            : "📺 휴게실. TV는 꺼져 있는데, 검은 화면 앞에 무언가 둥둥 떠 있다… [L] 손전등 끄기",
          "alert",
        );
      }

      // 🔦 불침번 순찰: 그 생활관 안쪽까지 걸어 들어가면 한 바퀴 돈다
      {
        const ndR = st.nightDuty;
        if (ndR && ndR.kind === "watch" && ndR.phase === "rounds" && !blocked && !fading) {
          const room = nextRound(ndR);
          const [rx, ry] = ROUND_POINT[room];
          if (p.map === room && Math.hypot(p.x - rx, p.y - ry) < 1.7)
            nightActRef.current(room === "room2" ? "duty_round2" : "duty_round1");
        }
      }

      // 👁 밤 순찰의 기척: 복도를 걷는 동안 등 뒤의 진자 · 벽의 그림자가 잠깐 스친다
      {
        const ndH = st.nightDuty;
        const roaming = !!st.patrol || (!!ndH && ndH.kind === "watch" && ndH.phase === "rounds");
        if (haunt.key !== `${st.day}`) {
          haunt.key = `${st.day}`;
          haunt.stalks = 0;
          haunt.glimpses = 0;
          haunt.cool = 7;
          haunt.stalk = null;
          haunt.glimpse = null;
        }
        if (!roaming || st.clues.length === 0 || (p.map !== "hq1" && p.map !== "hq2")) {
          haunt.stalk = null;
          haunt.glimpse = null;
        } else if (!blocked && !fading) {
          haunt.cool = Math.max(0, haunt.cool - dt);
          const sk = haunt.stalk;
          const [qx, qy] = DIR_VEC[p.dir];
          if (sk) {
            // 내 발자취를 따라 두어 칸 뒤에서 따라온다. 내가 그쪽을 보는 순간 사라진다
            const [bx, by] = trailBack(2.3);
            const k = Math.min(1, dt * 5);
            sk.x += (bx - sk.x) * k;
            sk.y += (by - sk.y) * k;
            const dx = sk.x - p.x,
              dy = sk.y - p.y;
            const d = Math.hypot(dx, dy);
            const facing = d > 0.2 && (dx * qx + dy * qy) / d > 0.4;
            const age = now - sk.since;
            if ((facing && age > 450) || age > 9000 || sk.map !== p.map) {
              haunt.stalk = null;
              haunt.cool = 14;
              setBgmMood(null);
              const pool = facing ? HAUNT_TURNED : HAUNT_GONE;
              thought.current = { text: pool[Math.floor(Math.random() * pool.length)], until: now + 2800 };
              if (facing) playSfx("sfx_heartbeat", 0.6);
            }
          } else if (haunt.glimpse) {
            if (now > haunt.glimpse.until) {
              haunt.glimpse = null;
              haunt.cool = 14;
              setBgmMood(null);
              thought.current = { text: HAUNT_WALL[Math.floor(Math.random() * HAUNT_WALL.length)], until: now + 2800 };
            }
          } else if (haunt.cool <= 0 && p.moving && myTrail.map === p.map && myTrail.pts.length > 34 && Math.random() < dt * 0.5) {
            const canStalk = haunt.stalks < 2;
            const canGlimpse = haunt.glimpses < 1 && (qx !== 0);
            if (canGlimpse && (!canStalk || Math.random() < 0.4)) {
              // 걸어가는 앞쪽 벽에, 아주 잠깐
              haunt.glimpses++;
              haunt.glimpse = { map: p.map, x: Math.min(map.w - 2, Math.max(2, p.x + qx * 3.2)), y: 1.15, until: now + 850 };
              // 🔊 기척이 스치는 동안은 스산한 곡으로
              setBgmMood("bgm_12_unease");
              playSfx("sfx_heartbeat", 0.5);
            } else if (canStalk) {
              haunt.stalks++;
              const [sx, sy] = trailBack(3.4);
              haunt.stalk = { map: p.map, x: sx, y: sy, since: now };
              setBgmMood("bgm_12_unease");
              playSfx("sfx_pendulum_ticktock", 0.45);
            }
          }
        }
      }
      // 🔦 야간 순찰: 점검 장소에 다가가면 자동으로 점검
      if (st.patrol && !blocked && !fading) {
        for (const sid of PATROL_SPOTS) {
          if (st.patrol.done.includes(sid)) continue;
          const sp = world.spots[sid];
          if (
            sp.map === p.map &&
            Math.hypot(p.x - (sp.x + 0.5), p.y - (sp.y + 0.5)) < 1.8
          ) {
            st.patrolCheck(sid);
            break;
          }
        }
      }

      // 👻 순찰 중 화장실: 점검을 마치고 거울(세면대) 쪽을 등지고 돌아서면, 거울 속에 팬텀이 비친다
      {
        const ptl = st.patrol;
        const inWc = p.map === "wc1" || p.map === "wc2";
        if (ptl && inWc && st.clues.length > 0 && !st.flags[`phantom_${st.day}`] && ptl.done.includes(p.map as SpotId)) {
          if (!phantomRt.talking) {
            if (p.dir === "up") phantomRt.armed = true;
            else if (phantomRt.armed && p.dir === "down" && !phantomRt.showAt && !blocked && !fading) phantomRt.showAt = now;
            if (phantomRt.showAt && now - phantomRt.showAt > 900 && !blocked && !fading) {
              phantomRt.talking = true;
              phantomRef.current();
            }
          }
        } else if (!phantomRt.talking) {
          phantomRt.armed = false;
          phantomRt.showAt = 0;
        }
      }

      offerT -= dt;
      if (offerT <= 0) {
        offerT = 0.5;
        offerGivers = new Set(
          questOffers(st)
            .filter((o) => o.open)
            .map((o) => o.giver),
        );
      }

      // NPC 갱신
      npcRetarget -= dt;
      const present = visibleNpcs(st.day, st.minute);
      if (npcRetarget <= 0 && !cer.current) {
        npcRetarget = 0.5;
        for (const id of present) {
          if (staged.current.has(id) || waitAt.current?.key === id || (pinnedSleeper === id && npcs.current[id])) continue;
          let n = npcs.current[id];
          const target = npcTarget(id);
          const key = `${target[0]}:${target[1]},${target[2]}`;
          if (!n) {
            n = npcs.current[id] = {
              map: target[0],
              x: target[1] + 0.5,
              y: target[2] + 0.5,
              dir: "down",
              moving: false,
              path: [],
              targetKey: key,
              viaDoor: null,
            };
            continue;
          }
          if (n.targetKey !== key) {
            // 식사하러 갈 땐 식당 입구에 바로 도착해서 자리로 걸어간다 (내가 보고 있으면 문으로 걸어 나간다)
            hopToMess(n, target[0], st.minute);
            route(n, target);
          }
        }
        for (const id of Object.keys(npcs.current) as NpcId[])
          if (!present.includes(id)) delete npcs.current[id];
      }
      // 퀘스트 창·지도용: NPC 현재 위치와 목적지 맵
      runtime.npcLoc = {};
      for (const id of present) {
        const n = npcs.current[id];
        if (!n) continue;
        const tm = n.targetKey.includes(":")
          ? (n.targetKey.split(":")[0] as MapId)
          : n.map;
        runtime.npcLoc[id] = { map: n.map, dest: world.maps[tm] ? tm : n.map };
      }
      // 🚶 장면 속 걷기: 대화창이 떠 있든 아니든, 정해 준 칸까지 실제로 걸어간다
      {
        const walks = Object.entries(sceneWalk.current);
        for (const [key, sw] of walks) {
          const a = key === "me" ? p : key.startsWith("x:") ? extras.current[key.slice(2)] : npcs.current[key as NpcId];
          if (!a || sw.done) continue;
          if (sw.path.length) {
            const gx = sw.path[0][0] + 0.5,
              gy = sw.path[0][1] + 0.5;
            const dx = gx - a.x,
              dy = gy - a.y;
            const d = Math.hypot(dx, dy);
            const step = 4.6 * Math.min(dt, 0.12);
            if (d <= step) {
              a.x = gx;
              a.y = gy;
              sw.path.shift();
            } else {
              a.x += (dx / d) * step;
              a.y += (dy / d) * step;
            }
            if (d > 0.01) a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
            a.moving = true;
          } else {
            a.dir = sw.dir;
            a.moving = false;
            sw.done = true;
            // 아직 걷는 사람이 남아 있지 않으면 조작 잠금을 풀고 다음 장면으로
            if (!walks.some(([k2, w2]) => k2 !== key && !w2.done)) holdRef.current = false;
            sw.then?.();
          }
        }
      }
      // 🎬 둘만 남는 장면: 내가 그 방을 나서면 다른 사람들도 제자리로 돌아온다
      if (sceneAlone.map && p.map !== sceneAlone.map && !fading) {
        sceneAlone.map = null;
        sceneAlone.hide = new Set();
        sceneAlone.hideNpc = new Set();
      }
      // 🎬 대화가 끝났으면 세워 둔 사람들을 풀어 준다
      if (staged.current.size && !overlayRef.current && !holdRef.current) {
        staged.current.clear();
        sceneWalk.current = {};
      }
      // 😴 아침에 못 일어난 선임: 내가 깨울 때까지 자기 침상에 누워 있다. 깨우면(또는 점호가 시작되면) 침상 앞 통로에 일어나 선다
      const sleeper = sleepySenior(st);
      if (pinnedSleeper && pinnedSleeper !== sleeper) {
        const up = pinnedSleeper.startsWith("x:") ? extras.current[pinnedSleeper.slice(2)] : npcs.current[pinnedSleeper as NpcId];
        const bedUp = pinnedSleeper.startsWith("x:") ? EXTRA_BED[pinnedSleeper.slice(2)] : undefined;
        if (up && up.map === "room1" && (Math.abs(up.y - bedY("top")) < 0.05 || Math.abs(up.y - bedY("bottom")) < 0.05)) {
          up.y = (bedUp ? aisleY(bedUp[2]) : 4) + 0.5;
          up.dir = "down";
          up.path = [];
          up.viaDoor = null;
          up.moving = false;
          up.targetKey = "";
        }
        pinnedSleeper = null;
      }
      if (sleeper) {
        const xb = sleeper.startsWith("x:") ? EXTRA_BED[sleeper.slice(2)] : undefined;
        const bxS = sleeper.startsWith("x:") ? xb?.[1] : BED_X[sleeper as NpcId];
        const lie = sleeper.startsWith("x:") ? extras.current[sleeper.slice(2)] : npcs.current[sleeper as NpcId];
        if (lie && bxS !== undefined) {
          lie.map = "room1";
          lie.x = bxS + 0.5;
          lie.y = bedY(xb ? xb[2] : "top");
          lie.dir = "down";
          lie.path = [];
          lie.viaDoor = null;
          lie.moving = false;
          lie.att = false;
          pinnedSleeper = sleeper;
        }
      }
      for (const id of present) {
        const n = npcs.current[id];
        if (!n) continue;
        if (staged.current.has(id)) {
          n.moving = false;
          n.path = [];
          continue;
        }
        if (pinnedSleeper === id) continue;
        // 📢 호출 · 보고를 기다리는 사람은 제자리(책상 뒤 · 생활관 통로)에서 나를 기다린다
        const wa = waitAt.current;
        if (wa && wa.key === id) {
          n.att = false;
          const there = n.map === wa.map && Math.hypot(n.x - wa.x, n.y - wa.y) < 0.4;
          // 나와 다른 곳에 있고 그 자리도 내가 없는 방이면, 보이지 않는 사이에 가 있다
          const unseen = n.map !== p.map && wa.map !== p.map;
          if (there || unseen) {
            n.map = wa.map;
            n.x = wa.x;
            n.y = wa.y;
            n.dir = wa.dir;
            n.path = [];
            n.viaDoor = null;
            n.moving = false;
            n.targetKey = "";
            continue;
          }
          // 내 눈에 보이는 곳에 있으면(또는 내가 그 방에 먼저 와 있으면) 걸어서 온다: 갑자기 사라지거나 나타나지 않는다
          const wk = `${wa.map}:${Math.floor(wa.x)},${Math.floor(wa.y)}`;
          if (n.targetKey !== wk) route(n, [wa.map, Math.floor(wa.x), Math.floor(wa.y)]);
        }
        // 🌙 야간 근무 중: 근무와 상관없는 1분대원은 이미 자기 침상에서 자고 있다 (걸어가는 중이었어도)
        const bxN = BED_X[id];
        if (
          st.nightDuty &&
          st.minute >= LIGHTS_OUT &&
          bxN !== undefined &&
          !dutyInvolved(id, st) &&
          !npcAsleep(id, n, st.minute)
        ) {
          const tg = npcTarget(id);
          n.map = "room1";
          n.x = bxN + 0.5;
          n.y = bedY("top");
          n.dir = "down";
          n.path = [];
          n.viaDoor = null;
          n.moving = false;
          n.att = false;
          n.targetKey = `${tg[0]}:${tg[1]},${tg[2]}`;
          continue;
        }
        const follow = followsMe(id, st);
        if (!follow) n.att = false;
        else if (followStep(n)) continue;
        if (n.path.length && !blocked) {
          const [px, py] = n.path[0];
          const gx = px + 0.5,
            gy = py + 0.5;
          const dx = gx - n.x,
            dy = gy - n.y;
          const d = Math.hypot(dx, dy);
          if (yieldFor(n, id, gx, gy)) {
            n.moving = false;
            n.held = true;
            continue;
          }
          n.held = false;
          // 식사하러 줄지어 갈 땐 조금 빠른 걸음
          const sp =
            (follow
              ? 5.6
              : isMealTime(st.minute) && SQUAD_KEYS.includes(id)
                ? 5
                : 4) * dt;
          if (d <= sp) {
            n.x = gx;
            n.y = gy;
            n.path.shift();
          } else {
            n.x += (dx / d) * sp;
            n.y += (dy / d) * sp;
          }
          n.dir =
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? "right"
                : "left"
              : dy > 0
                ? "down"
                : "up";
          n.moving = true;
        } else if (n.viaDoor && !blocked) {
          // 문에 도착 → 다음 맵으로 넘어가서 다시 경로 설정 (식당으로 가는 길이면 내 시야를 벗어난 뒤 건너뛴다)
          const d = n.viaDoor;
          n.map = d.to;
          n.x = d.arrive.x;
          n.y = d.arrive.y;
          n.dir = d.arrive.dir;
          n.viaDoor = null;
          const tgN = npcTarget(id);
          hopToMess(n, tgN[0], st.minute);
          route(n, tgN);
        } else {
          n.moving = false;
          // 소등 후: 자기 침상 앞 통로에 도착하면 그대로 눕는다
          const bx = BED_X[id];
          if (
            st.minute >= LIGHTS_OUT &&
            bx !== undefined &&
            !cer.current &&
            n.map === "room1" &&
            Math.abs(n.x - (bx + 0.5)) < 0.6 &&
            n.y > 3.5 &&
            n.y < 4.9
          ) {
            n.x = bx + 0.5;
            n.y = bedY("top");
            n.dir = "down";
          }
          if (n.map === p.map && !cer.current && !npcAsleep(id, n, st.minute)) {
            const dd = Math.hypot(p.x - n.x, p.y - n.y);
            if (dd < 2.5)
              n.dir =
                Math.abs(p.x - n.x) > Math.abs(p.y - n.y)
                  ? p.x > n.x
                    ? "right"
                    : "left"
                  : p.y > n.y
                    ? "down"
                    : "up";
          }
        }
      }

      // 엑스트라: 정해진 길을 돌거나 집 주변을 어슬렁거린다
      for (const def of extraDefs) {
        let e = extras.current[def.id];
        if (!e) {
          // 야간 근무 중(불러오기 등)이면 맡은 자리에서 시작
          const ng0 = nightGoal(`x:${def.id}`, st);
          const [im, ix, iy] = ng0 ?? [def.map, def.x, def.y];
          e = extras.current[def.id] = {
            map: im,
            x: ix + 0.5,
            y: iy + 0.5,
            dir: "down",
            moving: false,
            path: [],
            targetKey: "",
            viaDoor: null,
            wait: Math.random() * 2,
            routeIdx: 0,
          };
        }
        // 장면 속에서 걸어가는 중이면 그 걸음을 그대로 둔다
        if (sceneWalk.current[`x:${def.id}`] && !sceneWalk.current[`x:${def.id}`].done) continue;
        if (staged.current.has(`x:${def.id}`)) {
          e.moving = false;
          e.path = [];
          continue;
        }
        if (pinnedSleeper === `x:${def.id}`) continue;
        if (sceneWalk.current[`x:${def.id}`]) continue;
        // 🌅 아침 점호 집합: 다른 생활관·부대 인원도 미리 연병장에 오와 열을 맞춰 서 있다 (점호 의식이 세우는 자리 그대로)
        if (!cer.current && rollcallWaiting(st) && leftRoomToday(st.day)) {
          const slot = rollcallSlots(st)[`x:${def.id}`];
          if (slot !== undefined) {
            const sp = world.spots.parade;
            e.map = sp.map;
            e.x = sp.x - 2 + (slot % 6);
            e.y = sp.y - 1.5 + Math.floor(slot / 6);
            e.dir = "up";
            e.path = [];
            e.viaDoor = null;
            e.moving = false;
            e.targetKey = "";
            continue;
          }
        }
        // 🌙 야간 근무 중: 근무와 상관없는 인원은 이미 침상에서 자고 있다 (깨우는 대화 중에도)
        const bedN = EXTRA_BED[def.id];
        if (
          bedN &&
          st.nightDuty &&
          st.minute >= LIGHTS_OUT &&
          !cer.current &&
          !dutyInvolved(`x:${def.id}`, st) &&
          !nightGoal(`x:${def.id}`, st)
        ) {
          e.map = bedN[0];
          e.x = bedN[1] + 0.5;
          e.y = bedY(bedN[2]);
          e.dir = "down";
          e.path = [];
          e.viaDoor = null;
          e.moving = false;
          e.att = false;
          continue;
        }
        if (blocked) {
          e.moving = false;
          continue;
        }
        // 소등 후: 침상이 있으면 가서 눕고, 근무자·군견은 제자리, 나머지는 자기 부대 막사로(안 보임)
        if (st.minute >= LIGHTS_OUT && !cer.current) {
          const bed = EXTRA_BED[def.id];
          const xk = `x:${def.id}`;
          const duty = nightGoal(xk, st);
          if (!duty) {
            if (!bed && !NIGHT_STAY.has(def.id)) {
              e.moving = false;
              continue;
            }
            if (
              bed &&
              e.map === bed[0] &&
              Math.abs(e.y - bedY(bed[2])) < 0.05
            ) {
              e.moving = false;
              continue;
            }
          }
          const ns = NIGHT_SPOT[def.id];
          const goalN: Pos | null =
            duty ??
            (bed
              ? [bed[0], bed[1], aisleY(bed[2])]
              : (ns ?? (e.map !== def.map ? [def.map, def.x, def.y] : null)));
          if (!goalN) {
            e.moving = false;
            e.path = [];
            continue;
          }
          const gk = `${goalN[0]}:${goalN[1]},${goalN[2]}`;
          const follow = followsMe(xk, st);
          if (!follow) e.att = false;
          else if (followStep(e)) {
            e.targetKey = gk;
            continue;
          }
          if (e.targetKey !== gk && (!follow || npcRetarget >= 0.45))
            route(e, goalN);
          if (e.path.length) {
            const [px, py] = e.path[0];
            const gx = px + 0.5,
              gy = py + 0.5;
            const dx = gx - e.x,
              dy = gy - e.y;
            const d = Math.hypot(dx, dy);
            if (yieldFor(e, `x:${def.id}`, gx, gy)) {
              e.moving = false;
              e.held = true;
              continue;
            }
            e.held = false;
            const sp = (follow ? 5.6 : 3) * dt;
            if (d <= sp) {
              e.x = gx;
              e.y = gy;
              e.path.shift();
            } else {
              e.x += (dx / d) * sp;
              e.y += (dy / d) * sp;
            }
            e.dir =
              Math.abs(dx) > Math.abs(dy)
                ? dx > 0
                  ? "right"
                  : "left"
                : dy > 0
                  ? "down"
                  : "up";
            e.moving = true;
          } else if (e.viaDoor) {
            const dd = e.viaDoor;
            e.map = dd.to;
            e.x = dd.arrive.x;
            e.y = dd.arrive.y;
            e.dir = dd.arrive.dir;
            e.viaDoor = null;
            route(e, goalN);
          } else {
            e.moving = false;
            if (!duty && bed && e.map === bed[0]) {
              e.x = bed[1] + 0.5;
              e.y = bedY(bed[2]);
              e.dir = "down";
            }
          }
          continue;
        }
        // 잠만보 취사병은 식사 시간이 아니면 그 자리에서 잔다
        if (snorlaxCookAsleep(def.id, st.minute)) {
          e.moving = false;
          e.path = [];
          continue;
        }
        // 식사 시간엔 식당 자리로, 끝나면 자기 자리로 (다른 맵이면 문을 거쳐서)
        const seat = EXTRA_MEAL_SEAT[def.id];
        const xkey = `x:${def.id}`;
        const mg =
          isMealTime(st.minute) && seat
            ? mealGoal(xkey, ["mess", seat[0], seat[1]], st)
            : "free";
        const home: Pos | null =
          e.map !== def.map ||
          e.targetKey.startsWith("mess:") ||
          GATHER_KEYS.has(e.targetKey)
            ? [def.map, def.x, def.y]
            : null;
        const goal: Pos | null = mg !== "free" ? mg : home;
        if (goal) {
          const gk = `${goal[0]}:${goal[1]},${goal[2]}`;
          if (e.targetKey !== gk) {
            hopToMess(e, goal[0], st.minute);
            route(e, goal);
          }
          if (e.path.length) {
            const [px, py] = e.path[0];
            const gx = px + 0.5,
              gy = py + 0.5;
            const dx = gx - e.x,
              dy = gy - e.y;
            const d = Math.hypot(dx, dy);
            if (yieldFor(e, `x:${def.id}`, gx, gy)) {
              e.moving = false;
              e.held = true;
              continue;
            }
            e.held = false;
            const sp = (SQUAD_KEYS.includes(xkey) ? 5 : 3) * dt;
            if (d <= sp) {
              e.x = gx;
              e.y = gy;
              e.path.shift();
            } else {
              e.x += (dx / d) * sp;
              e.y += (dy / d) * sp;
            }
            e.dir =
              Math.abs(dx) > Math.abs(dy)
                ? dx > 0
                  ? "right"
                  : "left"
                : dy > 0
                  ? "down"
                  : "up";
            e.moving = true;
          } else if (e.viaDoor) {
            const dd = e.viaDoor;
            e.map = dd.to;
            e.x = dd.arrive.x;
            e.y = dd.arrive.y;
            e.dir = dd.arrive.dir;
            e.viaDoor = null;
            hopToMess(e, goal[0], st.minute);
            route(e, goal);
          } else {
            e.moving = false;
            // 집에 돌아왔으면 평소 행동으로
            if (
              goal[0] === def.map &&
              e.map === def.map &&
              !isMealTime(st.minute)
            )
              e.targetKey = "";
          }
          continue;
        }
        if (e.path.length) {
          const [px, py] = e.path[0];
          const gx = px + 0.5,
            gy = py + 0.5;
          const dx = gx - e.x,
            dy = gy - e.y;
          const d = Math.hypot(dx, dy);
          if (yieldFor(e, `x:${def.id}`, gx, gy)) {
            e.moving = false;
            e.held = true;
            continue;
          }
          e.held = false;
          const sp = (def.route ? 3.2 : 2.2) * dt;
          if (d <= sp) {
            e.x = gx;
            e.y = gy;
            e.path.shift();
          } else {
            e.x += (dx / d) * sp;
            e.y += (dy / d) * sp;
          }
          e.dir =
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? "right"
                : "left"
              : dy > 0
                ? "down"
                : "up";
          e.moving = true;
          continue;
        }
        e.moving = false;
        // 주인공이 가까이 오면 멈춰서 쳐다본다
        if (e.map === p.map && Math.hypot(p.x - e.x, p.y - e.y) < 2.2) {
          e.dir =
            Math.abs(p.x - e.x) > Math.abs(p.y - e.y)
              ? p.x > e.x
                ? "right"
                : "left"
              : p.y > e.y
                ? "down"
                : "up";
          continue;
        }
        e.wait -= dt;
        if (e.wait > 0) continue;
        const em = world.maps[e.map];
        let tx = def.x,
          ty = def.y;
        if (def.route) {
          e.routeIdx = (e.routeIdx + 1) % def.route.length;
          [tx, ty] = def.route[e.routeIdx];
          e.wait = 0;
        } else if (def.wander) {
          for (let i = 0; i < 6; i++) {
            const cx = def.x + Math.round((Math.random() * 2 - 1) * def.wander);
            const cy = def.y + Math.round((Math.random() * 2 - 1) * def.wander);
            if (!isSolid(em, cx, cy)) {
              tx = cx;
              ty = cy;
              break;
            }
          }
          e.wait = 2 + Math.random() * 3;
        } else {
          e.wait = 3 + Math.random() * 3;
          e.dir = (["down", "left", "right", "down"] as Dir[])[
            Math.floor(Math.random() * 4)
          ];
          continue;
        }
        e.path = findPath(em, Math.floor(e.x), Math.floor(e.y), tx, ty).slice(
          1,
        );
      }

      // 🍚 식사: 자리에 앉은 시각 기록 → 각자 다 먹으면 일어난다
      if (isMealTime(st.minute)) {
        const seated = mealSeated(st.day, st.minute);
        // 🍚 분대 출발: 분대장과 내가 1생활관에 있으면 분대장이 "밥 먹으러 가자" → 화면 전환으로 다 같이 식당 입구.
        // 분대는 내가 올 때까지 생활관에서 기다린다 (식사는 분대 단위)
        const mcM = st.mealCheck;
        const mkey = `${st.day}-${mealOf(st.minute)}`;
        if (
          mealCall.key !== mkey &&
          !mealCall.talking &&
          !cer.current &&
          mcM &&
          !mcM.done &&
          mcM.meal === mealOf(st.minute)
        ) {
          const squad = squadKeys(st.branch, st.day);
          const lead0 = squadLeadKey(st.day);
          const le = lead0 ? entityOf(lead0) : undefined;
          // 분대장이 화면에 없으면(아직 안 나타남 등) 내가 데리고 간다
          const lead = lead0 && le ? lead0 : null;
          // 정확한 자리가 아니어도 생활관 안에만 있으면 모인 것 (나를 따라다니는 사람도 생활관에 있다)
          const inRoom = (k: string) => {
            const e = entityOf(k);
            return !e || e.map === "room1";
          };
          // 🏠 내가 생활관에 들어서는 순간(화면이 바뀌는 사이): 아직 오는 중이던 분대원들은 먼저 와서 기다리던 것으로 한다.
          // 내가 생활관 바로 가기로 먼저 도착해서, 걸어오는 사람들을 멍하니 기다리는 일이 없게.
          // 방금 내 눈앞(떠나온 맵)에 있던 사람만 문으로 뒤따라 들어온다
          if (!myAte && p.map === "room1") {
            const doorIn = cameFrom ? doorToward(world, cameFrom, "room1") : null;
            for (const k of squad) {
              const e = entityOf(k);
              const g = MEAL_GATHER[k];
              if (!e || !g || e.map === "room1" || followsMe(k, st)) continue;
              const seen = !!doorIn && doorIn.to === "room1" && e.map === cameFrom;
              e.map = "room1";
              e.x = seen ? doorIn!.arrive.x : g[1] + 0.5;
              e.y = seen ? doorIn!.arrive.y : g[2] + 0.5;
              e.dir = "down";
              e.path = [];
              e.viaDoor = null;
              e.moving = false;
              e.targetKey = seen ? "" : `${g[0]}:${g[1]},${g[2]}`;
            }
          }
          const meReady =
            !myAte && p.map === "room1" && !blocked && !fading && !warpReq.current && !myMeal.eating;
          // 시간은 멈춰 있으니, 생활관에 들어서고 잠깐(3초) 기다려도 다 안 모이면 그냥 출발한다
          if (!meReady) mealCall.waitSince = 0;
          else if (!mealCall.waitSince) mealCall.waitSince = now;
          const gathered = squad.every(inRoom) || (meReady && now - mealCall.waitSince > 3000);
          if (lead && le && meReady && le.map === "room1" && gathered)
            mealCallRef.current(lead);
          else if (!lead && squad.length && meReady && gathered)
            // 내가 분대장: 생활관에 들어서면 내가 분대원들을 데리고 간다
            mealCallRef.current(null);
          else if (!lead && !squad.length) {
            // 분대원이 아무도 없는 날: 혼자 가서 먹는다
            mealCall.key = mkey;
            mealCall.withMe = mkey;
          }
        }
        // 🍚 다 먹은 뒤: 식당에서 나도 다 먹었으면, 최선임이 숟가락을 놓을 때까지 기다렸다가 다 같이 생활관으로
        if (
          mealCall.key === mkey &&
          mealCall.back !== mkey &&
          !mealCall.talking &&
          !cer.current &&
          p.map === "mess" &&
          !blocked &&
          !fading &&
          !warpReq.current
        ) {
          const lead = squadLeadKey(st.day);
          const leadAt = squadLeadDone(st);
          const meDone =
            st.daily.includes(`meal_${mealOf(st.minute)}`) &&
            !myMeal.eating &&
            !myMeal.tray;
          if (!lead && meDone) {
            // 내가 분대장: 다 먹었으면 내가 "생활관 가자" (분대원이 없으면 그냥 끝)
            if (squadKeys(st.branch, st.day).length) mealBackRef.current(null);
            else {
              mealCall.back = mkey;
              st.finishSquadMeal();
            }
          } else if (lead && meDone) {
            // 최선임이 아직 자리에 앉지 못했으면 지금 다 먹은 것으로 본다
            const leadDone = leadAt !== undefined && Number.isFinite(leadAt) ? leadAt : st.minute;
            // 먼저 다 먹었으면 최선임이 숟가락을 놓을 때까지 자리에서 기다린다 (그만큼 시간이 지난다)
            if (st.minute < leadDone) st.spend(Math.ceil(leadDone - st.minute));
            mealBackRef.current(lead);
          }
        }
        for (const id of present) {
          const n = npcs.current[id];
          if (
            n &&
            seated[id] === undefined &&
            eatingAt(n.map, n.x, n.y, MEAL_POS[id], st.minute)
          )
            seated[id] = st.minute;
        }
        for (const def of extraDefs) {
          const e = extras.current[def.id];
          const k = `x:${def.id}`;
          if (
            e &&
            seated[k] === undefined &&
            eatingAt(e.map, e.x, e.y, EXTRA_MEAL_SEAT[def.id], st.minute)
          )
            seated[k] = st.minute;
        }
      } else if (myMeal.tray && !myMeal.eating) {
        myMeal.tray = "";
        st.toast("🍱 배식 시간이 끝나 식판을 반납했다…", "bad");
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
      g.fillStyle = map.indoor ? "#14110e" : "#2a2a2a";
      g.fillRect(0, 0, w, h);
      const mw = map.w * TILE,
        mh = map.h * TILE;
      // 실내는 화면에 맞게 확대
      // 기본: 화면에 가로 약 20타일·세로 약 12.5타일이 보이도록 확대 (카메라는 주인공을 따라간다)
      // 여기에 마우스 휠로 조절한 배율(설정의 mapZoom)을 곱하고, 바뀔 땐 부드럽게 따라간다
      const baseZoom = Math.max(
        1.1,
        Math.min(2.2, Math.min(w / (20 * TILE), h / (12.5 * TILE))),
      );
      // 도트 한 칸(맵 캔버스의 TILE/16 px)이 화면 픽셀 정수 개가 되는 배율로만 멈춘다.
      // 소수 배율이면 같은 1px 선이 어디는 굵고 어디는 가늘게 보인다
      const zoomUnit = 16 / (TILE * dpr);
      setMapZoomUnit(zoomUnit / baseZoom);
      const targetZoom =
        Math.max(
          1,
          Math.round((baseZoom * useSettings.getState().mapZoom) / zoomUnit),
        ) * zoomUnit;
      shownZoom =
        shownZoom === 0
          ? targetZoom
          : shownZoom + (targetZoom - shownZoom) * Math.min(1, dt * 12);
      if (Math.abs(targetZoom - shownZoom) < 0.004) shownZoom = targetZoom;
      const zoom = shownZoom;
      g.imageSmoothingEnabled = false; // 확대해도 도트 느낌 유지
      const vw = w / zoom,
        vh = h / zoom;
      let camX = p.x * TILE - vw / 2;
      let camY = p.y * TILE - vh / 2;
      camX = Math.max(0, Math.min(mw - vw, camX));
      camY = Math.max(0, Math.min(mh - vh, camY));
      if (mw < vw) camX = (mw - vw) / 2;
      if (mh < vh) camY = (mh - vh) / 2;
      g.save();
      g.scale(zoom, zoom);
      // 카메라도 화면 픽셀 단위로 맞춘다 (반 픽셀 어긋나면 도트 경계가 번진다)
      const snapCam = (v: number) => Math.round(v * zoom * dpr) / (zoom * dpr);
      g.translate(-snapCam(camX), -snapCam(camY));
      const mc = mapCanvasRef.current[p.map];
      if (mc) {
        if (map.indoor) {
          g.fillStyle = "rgba(0,0,0,0.5)";
          g.fillRect(6, 10, mw, mh);
        }
        g.drawImage(mc, 0, 0);
      }
      // 👻 복도 벽에 잠깐 비치는 웃는 그림자 (밤 순찰)
      {
        const gl = haunt.glimpse;
        if (gl && gl.map === p.map) {
          const left = Math.max(0, gl.until - performance.now()) / 850;
          g.save();
          g.globalAlpha = Math.sin(Math.min(1, left) * Math.PI) * 0.75;
          const cx = gl.x * TILE,
            cy = gl.y * TILE;
          const glow = g.createRadialGradient(cx, cy - 6, 3, cx, cy - 6, 34);
          glow.addColorStop(0, "rgba(150,70,210,0.55)");
          glow.addColorStop(1, "rgba(150,70,210,0)");
          g.fillStyle = glow;
          g.fillRect(cx - 36, cy - 40, 72, 68);
          drawMonster(g, PHANTOM_LOOK, cx, cy + 8, 30, { dir: "down", t, shadow: false });
          g.restore();
        }
      }
      // 👻 거울 속의 팬텀 (돌아서 있는 동안만)
      if (phantomRt.showAt && (p.map === "wc1" || p.map === "wc2")) {
        const m = PHANTOM_MIRROR;
        const pulse = 0.5 + Math.sin(t * 5) * 0.5;
        g.save();
        // 거울 둘레로 번지는 보랏빛
        const glow = g.createRadialGradient(m.x + m.w / 2, m.y + m.h / 2, 4, m.x + m.w / 2, m.y + m.h / 2, 46);
        glow.addColorStop(0, `rgba(150,70,210,${0.45 + pulse * 0.25})`);
        glow.addColorStop(1, "rgba(150,70,210,0)");
        g.fillStyle = glow;
        g.fillRect(m.x - 40, m.y - 30, m.w + 80, m.h + 70);
        // 거울 속: 어두운 보랏빛 + 씩 웃는 팬텀
        g.fillStyle = "rgba(40,16,64,0.85)";
        g.fillRect(m.x, m.y, m.w, m.h);
        g.beginPath();
        g.rect(m.x, m.y, m.w, m.h);
        g.clip();
        g.globalAlpha = 0.8 + pulse * 0.2;
        drawMonster(g, PHANTOM_LOOK, m.x + m.w / 2, m.y + m.h + 16, 34, { dir: "down", t });
        g.restore();
      }

      // 라벨
      g.font = 'bold 13px "Galmuri11", sans-serif';
      g.textAlign = "center";
      for (const lb of map.labels) {
        const tw = g.measureText(lb.text).width + 12;
        g.fillStyle = "rgba(40,30,20,0.75)";
        g.fillRect(lb.x * TILE - tw / 2, lb.y * TILE - 11, tw, 18);
        g.fillStyle = "#fff6dc";
        g.fillText(lb.text, lb.x * TILE, lb.y * TILE + 3);
      }

      // 다른 맵에 있는 목표는 그쪽으로 가는 문을 가리킨다
      const guide = (
        tm: MapId,
        x: number,
        y: number,
      ): { x: number; y: number; viaDoor: boolean } | null => {
        if (tm === p.map) return { x, y, viaDoor: false };
        const d = doorToward(world, p.map, tm);
        if (!d) return null;
        const c = doorCenter(d);
        return { x: c.x, y: c.y + (map.indoor ? 0 : 0.3), viaDoor: true };
      };

      // 목표 지점 표시
      const ev = st.currentEvent();
      let target: { x: number; y: number; viaDoor: boolean } | null = null;
      // 🧭 먼저 가야 할 곳(호출 · 심부름 · 보고 · 첫날 세면)이 있으면 다음 일정 표시는 잠시 접어 둔다
      const erNow = errandNow(st);
      if (
        ev &&
        !st.eventBegun &&
        ev.spot &&
        !erNow &&
        (st.minute >= ev.start || ev.kind === "farewell")
      ) {
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
        const left = PATROL_SPOTS.filter(
          (sid) => !st.patrol!.done.includes(sid),
        );
        for (const sid of left.length ? left : (["command"] as SpotId[])) {
          const sp = world.spots[sid];
          const gd = guide(sp.map, sp.x + 0.5, sp.y + 0.5);
          if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
      }
      const ndm = st.nightDuty;
      if (
        ndm &&
        ndm.phase !== "sleep" &&
        ndm.phase !== "woken" &&
        ndm.phase !== "shift"
      ) {
        let tg: { m: MapId; x: number; y: number } | null = null;
        if (ndm.phase === "toPost") {
          const sp = world.spots.post;
          tg = { m: sp.map, x: sp.x + 0.5, y: sp.y + 0.5 };
        }
        if (ndm.phase === "wakeNext") {
          const n = entityOf(ndm.next);
          if (n) tg = { m: n.map, x: n.x, y: n.y - 0.8 };
        }
        if (ndm.phase === "report" || ndm.phase === "checkin")
          tg = { m: DUTY_DESK[0], x: DUTY_DESK[1] + 0.5, y: DUTY_DESK[2] + 2 };
        if (ndm.phase === "rounds") {
          const room = nextRound(ndm);
          tg = { m: room, x: ROUND_POINT[room][0], y: ROUND_POINT[room][1] };
        }
        if (ndm.phase === "return") {
          const bd = world.spots.bed;
          tg = { m: bd.map, x: bd.x + 0.5, y: bd.y + 0.5 };
        }
        const gd = tg && guide(tg.m, tg.x, tg.y);
        if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
      }
      {
        // 🧭 호출 · 심부름 · 보고 · 첫날 세면: 가야 할 곳
        const er = erNow;
        const gd = er && guide(er.map, er.x, er.y);
        if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        // 🔎 혼자 살펴보러 가기로 한 곳
        const ss = !er && st.solo ? world.spots[st.solo as SpotId] : null;
        const gs = ss && guide(ss.map, ss.x + 0.5, ss.y + 0.5);
        if (gs) qTargets.push({ x: gs.x, y: gs.y - (gs.viaDoor ? 0.6 : 0) });
      }
      if (isMealTime(st.minute) && st.day < TOTAL_DAYS) {
        const mealKey = st.minute < 15 * 60 ? "meal_lunch" : "meal_dinner";
        const mcg = st.mealCheck;
        if (!st.daily.includes(mealKey)) {
          // 분대가 생활관에서 기다리는 중이면 1생활관 → 출발하면 배식대 → 식판을 받았으면 내 자리
          const gp: Pos | null =
            mcg && mealCall.key !== `${st.day}-${mealOf(st.minute)}`
              ? [world.spots.bed.map, world.spots.bed.x, world.spots.bed.y]
              : null;
          const [gm, gx, gy]: Pos =
            gp ??
            (myMeal.tray
              ? ["mess", MY_MEAL_SEAT[0], MY_MEAL_SEAT[1]]
              : [world.spots.mess.map, world.spots.mess.x, world.spots.mess.y]);
          const gd = guide(gm, gx + 0.5, gy + 0.5);
          if (gd) qTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
      }
      const storyTargets: { x: number; y: number }[] = [];
      if (st.clues.length > 0) {
        for (const m of STORY_MISSIONS) {
          if (!m.spot || !missionReady(m, st)) continue;
          const lib = m.id === "M-04" ? extras.current.librarian : null;
          const sp = world.spots[m.spot];
          const gd = lib
            ? guide(lib.map, lib.x, lib.y - 1.3)
            : guide(sp.map, sp.x + 0.5, sp.y + 0.5);
          if (gd)
            storyTargets.push({ x: gd.x, y: gd.y - (gd.viaDoor ? 0.6 : 0) });
        }
      }
      for (const st2 of storyTargets) {
        g.font = "bold 18px sans-serif";
        g.globalAlpha = 0.65 + Math.sin(t * 5) * 0.35;
        g.fillText("✨", st2.x * TILE, st2.y * TILE - 6 + Math.sin(t * 3) * 3);
        g.globalAlpha = 1;
      }
      for (const qt of qTargets) {
        g.fillStyle = "#f2c230";
        g.font = "bold 18px sans-serif";
        g.fillText("❗", qt.x * TILE, qt.y * TILE - 6 + Math.sin(t * 4) * 3);
      }
      if (target) {
        const pulse = (Math.sin(t * 5) + 1) / 2;
        const r0 = target.viaDoor ? 18 : 26;
        g.strokeStyle = `rgba(255,80,60,${0.5 + pulse * 0.5})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(
          target.x * TILE,
          target.y * TILE,
          r0 + pulse * 10,
          0,
          Math.PI * 2,
        );
        g.stroke();
        g.fillStyle = "rgba(255,80,60,0.18)";
        g.beginPath();
        g.arc(target.x * TILE, target.y * TILE, r0, 0, Math.PI * 2);
        g.fill();
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
            const dx = mv.tx - mv.fx,
              dy = mv.ty - mv.fy;
            mv.a.dir =
              Math.abs(dx) > Math.abs(dy)
                ? dx > 0
                  ? "right"
                  : "left"
                : dy > 0
                  ? "down"
                  : "up";
          } else mv.a.dir = mv.endDir;
        }
        cerC.moves = cerC.moves.filter((mv) => t - mv.t0 < mv.dur);
        if (cerC.kind === "am" && p.map === "outdoor") {
          // 구령대 옆 국기 게양대
          const fx0 = 24.2 * TILE,
            fy0 = 17.9 * TILE;
          g.fillStyle = "#d8d8d8";
          g.fillRect(fx0 - 1, fy0 - 70, 3, 70);
          g.fillStyle = "#f0c040";
          g.fillRect(fx0 - 2, fy0 - 73, 5, 4);
          const wave = Math.sin(t * 3) * 1.5;
          g.fillStyle = "#ffffff";
          g.fillRect(fx0 + 2, fy0 - 68 + wave, 24, 16);
          g.fillStyle = "#d03040";
          g.fillRect(fx0 + 10, fy0 - 64 + wave, 8, 4);
          g.fillStyle = "#2050a0";
          g.fillRect(fx0 + 10, fy0 - 60 + wave, 8, 4);
          g.fillStyle = "#202020";
          for (const [ax, ay] of [
            [4, 2],
            [21, 2],
            [4, 11],
            [21, 11],
          ])
            g.fillRect(fx0 + ax, fy0 - 68 + ay + wave, 2, 3);
        }
      }
      for (const def of extraDefs) {
        const e = extras.current[def.id];
        if (!e || extraHiddenAtNight(def.id, st.minute)) continue;
        const tm = e.targetKey.includes(":")
          ? (e.targetKey.split(":")[0] as MapId)
          : e.map;
        runtime.npcLoc[`x:${def.id}`] = {
          map: e.map,
          dest: world.maps[tm] ? tm : e.map,
        };
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
        if (cerC.pose === "exercise") {
          const ph = Math.floor(pt * 2.4) % 4;
          r.dir = (["up", "left", "up", "right"] as Dir[])[ph];
          r.hop = ph % 2 === 0 ? 6 : 0;
        } else if (cerC.pose === "anthem") {
          r.dir = "up";
          if (mi % 3 === 0)
            notes.push({ x, y, ph: (pt * 0.6 + mi * 0.37) % 1 });
        } else if (cerC.pose === "shout" || cerC.pose === "salute") {
          r.hop = Math.sin(pt * 18 + mi) > 0.3 ? 2 : 0;
        }
        if (cerC.bubble && (cerC.pose === "salute" || cerC.pose === "shout"))
          bubbles.push({ x, y, text: cerC.bubble });
        return r;
      };

      // 식사 중인 자리 앞 식탁에 식판
      if (p.map === "mess" && isMealTime(st.minute)) {
        const trays: { x: number; y: number; left?: number }[] = [];
        for (const id of present) {
          const n = npcs.current[id];
          const at = n && eatingAt(n.map, n.x, n.y, MEAL_POS[id], st.minute);
          if (at) {
            trays.push({
              x: at.x,
              y: at.face === "down" ? at.y + 1 : at.y - 1,
            });
            n!.dir = at.face;
          }
        }
        for (const def of extraDefs) {
          const e = extras.current[def.id];
          const at =
            e && eatingAt(e.map, e.x, e.y, EXTRA_MEAL_SEAT[def.id], st.minute);
          if (at) {
            trays.push({
              x: at.x,
              y: at.face === "down" ? at.y + 1 : at.y - 1,
            });
            e!.dir = at.face;
          }
        }
        if (myMeal.eating)
          trays.push({
            x: MY_MEAL_SEAT[0],
            y: MY_MEAL_SEAT[1] + 1,
            left: 1 - myMeal.eating.prog,
          });
        for (const tr of trays)
          drawTray(g, tr.x * TILE + 6, tr.y * TILE + 9, tr.left ?? 1);
      }

      // 🚶 거의 같은 자리에 겹쳐 선 둘(스쳐 지나가는 순간 등)은 좌우로 조금씩 벌려 그린다
      const nudges = new Map<object, number>();
      {
        const vis: NpcRt[] = [];
        for (const id of present) {
          const n = npcs.current[id];
          if (n && n.map === p.map && !npcAsleep(id, n, st.minute)) vis.push(n);
        }
        for (const def of extraDefs) {
          const e = extras.current[def.id];
          if (e && e.map === p.map && !extraHiddenAtNight(def.id, st.minute) && !extraAsleep(def.id, e, st.minute)) vis.push(e);
        }
        for (let i = 0; i < vis.length; i++)
          for (let j = i + 1; j < vis.length; j++) {
            const va = vis[i],
              vb = vis[j];
            if (Math.abs(va.y - vb.y) < 0.4 && Math.abs(va.x - vb.x) < 0.55) {
              const side = va.x <= vb.x ? -1 : 1;
              nudges.set(va, (nudges.get(va) ?? 0) + side * 9);
              nudges.set(vb, (nudges.get(vb) ?? 0) - side * 9);
            }
          }
      }
      // 엔티티 (y 정렬, 같은 맵만)
      const ents: { y: number; draw: () => void }[] = [];
      for (const id of present) {
        const n = npcs.current[id];
        if (!n || n.map !== p.map) continue;
        const sk = NPC_SKINS[st.branch][id];
        const nx0 = nudges.get(n) ?? 0;
        if (npcAsleep(id, n, st.minute)) {
          ents.push({
            y: n.y,
            draw: () => drawSleeper(g, sk.look, n.x, n.y, t + id.length, true),
          });
          continue;
        }
        ents.push({
          y: n.y,
          draw: () => {
            const chew = eatingAt(n.map, n.x, n.y, MEAL_POS[id], st.minute)
              ? Math.sin(t * 7 + id.length) > 0.6
                ? 2
                : 0
              : 0;
            const fx = fxOf(id, n.dir, n.x, n.y);
            drawMonster(
              g,
              sk.look,
              (n.x * TILE + nx0),
              n.y * TILE + 12 - chew + fx.dy - fx.hop,
              34,
              {
                dir: fx.dir,
                t: t + id.length,
                walking: n.moving,
                cap: npcCap(st.branch, id),
              },
            );
            if (cerC) return; // 점호 중에는 이름표를 숨긴다
            if (
              eatingAt(n.map, n.x, n.y, MEAL_POS[id], st.minute) &&
              Math.hypot(p.x - n.x, p.y - n.y) > 1.8
            )
              return;
            g.font = '11px "Galmuri11", sans-serif';
            const nm = sk.name;
            const tw = g.measureText(nm).width + 8;
            g.fillStyle = NPC_ROLES[id].officer
              ? "rgba(60,50,20,0.8)"
              : "rgba(20,30,40,0.7)";
            g.fillRect((n.x * TILE + nx0) - tw / 2, n.y * TILE - 44, tw, 14);
            g.fillStyle = NPC_ROLES[id].officer ? "#ffe08a" : "#ffffff";
            g.fillText(nm, (n.x * TILE + nx0), n.y * TILE - 33);
            if (offerGivers.has(id)) {
              // 말풍선: 부탁할 게 있다
              const by = n.y * TILE - 66 + Math.sin(t * 3 + id.length) * 2;
              g.fillStyle = "#ffffff";
              g.strokeStyle = "#283048";
              g.lineWidth = 2;
              g.beginPath();
              g.roundRect((n.x * TILE + nx0) - 13, by, 26, 18, 5);
              g.fill();
              g.stroke();
              g.beginPath();
              g.moveTo((n.x * TILE + nx0) - 4, by + 18);
              g.lineTo((n.x * TILE + nx0), by + 24);
              g.lineTo((n.x * TILE + nx0) + 4, by + 18);
              g.fill();
              g.font = "bold 12px sans-serif";
              g.fillStyle = "#e8a030";
              g.fillText("···", (n.x * TILE + nx0), by + 13);
            }
          },
        });
      }
      for (const def of extraDefs) {
        const e = extras.current[def.id];
        if (!e || e.map !== p.map || extraHiddenAtNight(def.id, st.minute))
          continue;
        const elook = extraLook(def);
        const ex0 = nudges.get(e) ?? 0;
        if (extraAsleep(def.id, e, st.minute)) {
          if (snorlaxCookAsleep(def.id, st.minute)) {
            // 잠만보: 제자리에 드러누워 쿨쿨 (덩치 그대로, 모포 없이)
            ents.push({
              y: e.y,
              draw: () => {
                drawMonster(g, elook, (e.x * TILE + ex0), e.y * TILE + 12, 44, {
                  dir: "down",
                  t,
                  sleeping: true,
                });
                g.fillStyle = "#ffffff";
                g.font = "bold 11px sans-serif";
                g.textAlign = "center";
                g.fillText(
                  "Z".repeat(1 + (Math.floor(t * 1.5) % 3)),
                  (e.x * TILE + ex0) + 18,
                  e.y * TILE - 30 - ((t * 6) % 8),
                );
              },
            });
            continue;
          }
          ents.push({
            y: e.y,
            draw: () =>
              drawSleeper(
                g,
                elook,
                e.x,
                e.y,
                t + def.id.length,
                def.id !== "dog",
              ),
          });
          continue;
        }
        const ecap = (
          def.noCap ? null : def.officer ? `officer-${b.cap}` : b.cap
        ) as CapType;
        ents.push({
          y: e.y,
          draw: () => {
            const chew = eatingAt(
              e.map,
              e.x,
              e.y,
              EXTRA_MEAL_SEAT[def.id],
              st.minute,
            )
              ? Math.sin(t * 7 + def.id.length) > 0.6
                ? 2
                : 0
              : 0;
            const fx = fxOf("x:" + def.id, e.dir, e.x, e.y);
            drawMonster(
              g,
              elook,
              (e.x * TILE + ex0),
              e.y * TILE + 12 - chew + fx.dy - fx.hop,
              32,
              {
                dir: fx.dir,
                t: t + def.id.length * 0.7,
                walking: e.moving,
                cap: ecap,
              },
            );
            if (cerC) return;
            if (
              eatingAt(e.map, e.x, e.y, EXTRA_MEAL_SEAT[def.id], st.minute) &&
              Math.hypot(p.x - e.x, p.y - e.y) > 1.8
            )
              return;
            g.font = '10px "Galmuri11", sans-serif';
            const tw = g.measureText(def.name).width + 8;
            g.fillStyle = "rgba(70,74,84,0.72)";
            g.fillRect((e.x * TILE + ex0) - tw / 2, e.y * TILE - 42, tw, 13);
            g.fillStyle = "#e8ecf2";
            g.fillText(def.name, (e.x * TILE + ex0), e.y * TILE - 32);
          },
        });
      }
      // 🌙 침상에 누워 있는 나 (근무자가 깨우기 전까지)
      const meLying =
        meInBed.current &&
        (st.nightDuty?.phase === "sleep" || st.nightDuty?.phase === "woken");
      if (!meLying) meInBed.current = false;
      if (meLying)
        ents.push({
          y: p.y,
          draw: () => drawSleeper(g, look, p.x, p.y, t, true),
        });
      else
        ents.push({
          y: p.y,
          draw: () => {
            const fx = fxOf("me", p.dir, p.x, p.y);
            drawMonster(
              g,
              look,
              p.x * TILE,
              p.y * TILE + 12 + fx.dy - fx.hop,
              36,
              { dir: fx.dir, t, walking: p.moving, cap: b.cap },
            );
            if (myMeal.tray && !myMeal.eating)
              drawTray(
                g,
                p.x * TILE - 10,
                p.y * TILE - (p.dir === "up" ? 18 : 4),
                1,
              );
            const sta2 = stamina.current;
            if (sta2.dashing && Math.floor(t * 14) % 2 === 0) {
              g.fillStyle = "rgba(200,190,170,0.75)";
              const back = p.dir === "left" ? 10 : p.dir === "right" ? -10 : 0;
              g.beginPath();
              g.arc(p.x * TILE + back - 5, p.y * TILE + 12, 3, 0, Math.PI * 2);
              g.fill();
              g.beginPath();
              g.arc(p.x * TILE + back + 5, p.y * TILE + 10, 2, 0, Math.PI * 2);
              g.fill();
            }
            const my = p.y * TILE + fx.dy - fx.hop + Math.sin(t * 4) * 2;
            g.fillStyle = "#ffe14a";
            g.beginPath();
            g.moveTo(p.x * TILE - 5, my - 46);
            g.lineTo(p.x * TILE + 5, my - 46);
            g.lineTo(p.x * TILE, my - 39);
            g.fill();
          },
        });
      // 👁 등 뒤를 따라오는 손과 진자 (밤 순찰 · 돌아보면 사라진다)
      const hs = haunt.stalk;
      if (hs && hs.map === p.map)
        ents.push({
          y: hs.y,
          draw: () => {
            const age = (performance.now() - hs.since) / 1000;
            const hx = hs.x * TILE,
              hy = hs.y * TILE - 20;
            g.save();
            g.globalAlpha = Math.min(0.7, age * 1.4);
            // 어둠 속에서 뻗어 나온 누런 손
            g.fillStyle = "#f2d050";
            g.fillRect(hx - 6, hy - 4, 12, 7);
            g.fillRect(hx - 6, hy + 3, 3, 4);
            g.fillRect(hx - 1, hy + 3, 3, 5);
            g.fillRect(hx + 4, hy + 3, 2, 4);
            g.fillStyle = "#8a6a30";
            g.fillRect(hx - 6, hy - 6, 12, 2);
            // 똑딱, 똑딱… 손끝에서 흔들리는 진자
            const a = Math.sin(t * 3) * 0.7;
            const ex = hx + Math.sin(a) * 20,
              ey = hy + 8 + Math.cos(a) * 20;
            g.strokeStyle = "#d8d8e0";
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(hx, hy + 6);
            g.lineTo(ex, ey);
            g.stroke();
            g.fillStyle = "#e8e8f0";
            g.beginPath();
            g.arc(ex, ey, 3.2, 0, Math.PI * 2);
            g.fill();
            g.restore();
          },
        });
      const sl = slipper.current;
      if (sl && sl.map === p.map) {
        ents.push({
          y: sl.y,
          draw: () => {
            drawMonster(g, SLIPPER_LOOK, sl.x * TILE, sl.y * TILE + 12, 40, {
              dir: "down",
              t,
            });
            // 똑딱, 똑딱… 흔들리는 진자
            const a = Math.sin(t * 3) * 0.6,
              hx = sl.x * TILE + 14,
              hy = sl.y * TILE - 6;
            g.strokeStyle = "#d8d8e0";
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(hx, hy);
            g.lineTo(hx + Math.sin(a) * 16, hy + Math.cos(a) * 16);
            g.stroke();
            g.fillStyle = "#e8e8f0";
            g.beginPath();
            g.arc(
              hx + Math.sin(a) * 16,
              hy + Math.cos(a) * 16,
              3.5,
              0,
              Math.PI * 2,
            );
            g.fill();
          },
        });
      }
      ents.sort((a, c) => a.y - c.y).forEach((e) => e.draw());
      // 💭 머리 위 혼잣말
      {
        const th = thought.current;
        if (th && now < th.until && !overlayRef.current) {
          const fadeA = Math.min(1, (th.until - now) / 350);
          g.save();
          g.globalAlpha = fadeA;
          g.font = 'bold 11px "Galmuri11", sans-serif';
          g.textAlign = "center";
          // 낱말 단위로 줄을 나눈다 (한 줄 약 130px)
          const words = th.text.split(" ");
          const rows: string[] = [];
          let cur = "";
          for (const wd of words) {
            const nx = cur ? `${cur} ${wd}` : wd;
            if (cur && g.measureText(nx).width > 130) {
              rows.push(cur);
              cur = wd;
            } else cur = nx;
          }
          if (cur) rows.push(cur);
          const bw = Math.max(...rows.map((r) => g.measureText(r).width)) + 16;
          const bh = rows.length * 14 + 10;
          const bx = p.x * TILE - bw / 2,
            by = p.y * TILE - 54 - bh;
          g.fillStyle = "#ffffff";
          g.strokeStyle = "#283048";
          g.lineWidth = 2;
          g.beginPath();
          g.roundRect(bx, by, bw, bh, 6);
          g.fill();
          g.stroke();
          g.beginPath();
          g.arc(p.x * TILE - 4, by + bh + 5, 3, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.beginPath();
          g.arc(p.x * TILE - 1, by + bh + 12, 1.8, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = "#283048";
          rows.forEach((r, i) => g.fillText(r, p.x * TILE, by + 15 + i * 14));
          g.restore();
        } else if (th && now >= th.until) thought.current = null;
      }
      // 📖 옥상 철문 (막사 2층, 계단 옆)
      if (p.map === "hq2" && st.clues.length > 0) {
        const dx0 = ROOF_DOOR[0] * TILE + 4,
          dy0 = ROOF_DOOR[1] * TILE + 6;
        g.fillStyle = "#5a6068";
        g.fillRect(dx0, dy0, TILE - 8, TILE - 6);
        g.fillStyle = "#7a8088";
        g.fillRect(dx0 + 3, dy0 + 3, TILE - 14, TILE - 12);
        g.fillStyle = st.flags.roof ? "#f2c230" : "#3a3e44";
        g.fillRect(dx0 + TILE - 14, dy0 + 12, 3, 3);
      }
      // 📖 전역일: 구령대 위에 내려앉은 별
      if (finalStarOn(st) && p.map === "outdoor") {
        const sx = STAGE_STAR[0] * TILE,
          sy = STAGE_STAR[1] * TILE - 20 + Math.sin(t * 1.6) * 6;
        const gl = g.createRadialGradient(sx, sy, 0, sx, sy, 70);
        gl.addColorStop(0, "rgba(255,252,220,1)");
        gl.addColorStop(0.35, "rgba(255,232,140,0.6)");
        gl.addColorStop(1, "rgba(255,232,140,0)");
        g.fillStyle = gl;
        g.beginPath();
        g.arc(sx, sy, 70, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fffbe0";
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2,
            rr = i % 2 === 0 ? 11 : 5;
          g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      }
      // ✨ 야간 근무 중 의문의 별빛 (지라치)
      let starGlow: { x: number; y: number } | null = null;
      const ndS = st.nightDuty;
      if (
        ndS &&
        !st.flags[`star_${st.day}`] &&
        (ndS.kind === "watch"
          ? ndS.phase === "wakeNext" || ndS.phase === "report" || ndS.phase === "return"
          : ndS.phase === "toPost" || ndS.phase === "report" || ndS.phase === "return")
      ) {
        const [sm, sx0, sy0] = STAR_POS[ndS.kind];
        if (p.map === sm) {
          const sx = sx0 * TILE,
            sy = sy0 * TILE - 18 + Math.sin(t * 1.8) * 5;
          starGlow = { x: sx, y: sy };
          const pulse = 0.7 + Math.sin(t * 3.2) * 0.3;
          const gl = g.createRadialGradient(sx, sy, 0, sx, sy, 46 * pulse + 12);
          gl.addColorStop(0, "rgba(255,250,200,0.95)");
          gl.addColorStop(0.4, "rgba(255,230,120,0.45)");
          gl.addColorStop(1, "rgba(255,230,120,0)");
          g.fillStyle = gl;
          g.beginPath();
          g.arc(sx, sy, 60, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#fffbe0";
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (Math.PI / 5) * i - Math.PI / 2 + t * 0.6,
              rr = i % 2 === 0 ? 8 : 3.6;
            g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
          }
          g.closePath();
          g.fill();
          for (let i = 0; i < 3; i++) {
            const a = t * 1.3 + i * 2.1;
            g.fillStyle = `rgba(255,250,210,${0.5 + 0.5 * Math.sin(t * 4 + i)})`;
            g.fillRect(
              sx + Math.cos(a) * 18 - 1,
              sy + Math.sin(a) * 12 - 1,
              3,
              3,
            );
          }
        }
      }
      // 🌫 위병소 정문 밖 안개
      if (p.map === "depot" && (st.minute >= 21 * 60 + 30 || fogActive(st))) {
        const fy0 = 25.5 * TILE,
          fy1 = 30 * TILE;
        const fogG = g.createLinearGradient(0, fy0, 0, fy1);
        fogG.addColorStop(0, "rgba(236,240,248,0)");
        fogG.addColorStop(0.6, "rgba(236,240,248,0.55)");
        fogG.addColorStop(1, "rgba(244,246,252,0.92)");
        g.fillStyle = fogG;
        g.fillRect(6 * TILE, fy0, 18 * TILE, fy1 - fy0);
        for (let i = 0; i < 7; i++) {
          const bx = (8 + ((i * 3.1 + t * 0.35) % 14)) * TILE,
            by = (27.6 + Math.sin(t * 0.6 + i) * 0.5) * TILE;
          const bg = g.createRadialGradient(bx, by, 0, bx, by, 70);
          bg.addColorStop(0, "rgba(255,255,255,0.45)");
          bg.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = bg;
          g.beginPath();
          g.arc(bx, by, 70, 0, Math.PI * 2);
          g.fill();
        }
      }

      // 점호 말풍선 / 애국가 음표 (모든 캐릭터 위에)
      g.textAlign = "center";
      for (const nt of notes) {
        g.globalAlpha = 1 - nt.ph;
        g.fillStyle = "#3858a8";
        g.font = '14px "Galmuri11", sans-serif';
        g.fillText(
          nt.ph < 0.5 ? "♪" : "♫",
          nt.x * TILE + 10,
          nt.y * TILE - 40 - nt.ph * 24,
        );
      }
      g.globalAlpha = 1;
      for (const bb of bubbles) {
        g.font = '10px "Galmuri11", sans-serif';
        const bw = g.measureText(bb.text).width + 8;
        const bx = bb.x * TILE - bw / 2,
          by = bb.y * TILE - 58;
        g.fillStyle = "#ffffff";
        g.fillRect(bx, by, bw, 14);
        g.strokeStyle = "#283048";
        g.lineWidth = 1.5;
        g.strokeRect(bx, by, bw, 14);
        g.fillStyle = "#283048";
        g.fillText(bb.text, bb.x * TILE, by + 11);
      }
      g.restore();

      // 밤 조명 (실내는 조명이 켜져 있어 덜 어둡다)
      const m = st.minute;
      let dark = 0;
      if (m < 7 * 60) dark = 0.28 * (1 - (m - 360) / 60);
      if (m > 18 * 60 + 30)
        dark = Math.min(0.42, ((m - (18 * 60 + 30)) / 150) * 0.42);
      if (map.indoor) dark *= 0.35;
      if (dark > 0) {
        g.fillStyle = `rgba(20,24,60,${dark})`;
        g.fillRect(0, 0, w, h);
      }
      const dutyLight = !!st.nightDuty && st.nightDuty.phase !== "sleep";
      if ((st.patrol && map.indoor) || dutyLight) {
        const sx = (p.x * TILE - camX) * zoom,
          sy = (p.y * TILE - camY) * zoom;
        const r0 = 60 * zoom,
          r1 = 190 * zoom;
        const fl = g.createRadialGradient(sx, sy, r0, sx, sy, r1);
        fl.addColorStop(0, "rgba(8,10,24,0)");
        fl.addColorStop(1, `rgba(8,10,24,${map.indoor ? 0.82 : 0.6})`);
        g.fillStyle = fl;
        g.fillRect(0, 0, w, h);
      }
      if (starGlow) {
        const gx = (starGlow.x - camX) * zoom,
          gy = (starGlow.y - camY) * zoom;
        const pulse = 0.75 + Math.sin(t * 3.2) * 0.25;
        g.save();
        g.globalCompositeOperation = "lighter";
        const sg = g.createRadialGradient(gx, gy, 0, gx, gy, 70 * zoom * pulse);
        sg.addColorStop(0, "rgba(255,245,190,0.85)");
        sg.addColorStop(0.3, "rgba(255,225,120,0.35)");
        sg.addColorStop(1, "rgba(255,225,120,0)");
        g.fillStyle = sg;
        g.beginPath();
        g.arc(gx, gy, 70 * zoom, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }

      // 화면 밖 목표 화살표
      if (target) {
        const sx = (target.x * TILE - camX) * zoom,
          sy = (target.y * TILE - camY) * zoom;
        if (sx < 0 || sy < 0 || sx > w || sy > h) {
          const cx = w / 2,
            cy = h / 2;
          const ang = Math.atan2(sy - cy, sx - cx);
          const r = Math.min(w, h) / 2 - 40;
          const ax = cx + Math.cos(ang) * r,
            ay = cy + Math.sin(ang) * r;
          g.save();
          g.translate(ax, ay);
          g.rotate(ang);
          g.fillStyle = "#ff503c";
          g.beginPath();
          g.moveTo(18, 0);
          g.lineTo(-10, -12);
          g.lineTo(-4, 0);
          g.lineTo(-10, 12);
          g.closePath();
          g.fill();
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
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [world, look, b.cap, npcTarget, findInteractable, extraDefs]);

  const closeOverlay = useCallback(() => {
    const o = overlayRef.current;
    setOverlay(null);
    if (o && o.type === "dialogue" && o.onDone) o.onDone();
  }, [setOverlay]);

  const state = useGame();
  const ctx = { branch: state.branch, name: state.name, day: state.day };

  return (
    <div className="world">
      <div className="world-canvas" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
      <Hud
        onNotebook={() => setOverlay({ type: "notebook" })}
        onQuests={() => setOverlay({ type: "quests" })}
        onMap={() => setOverlay({ type: "map" })}
        onHome={goHome}
        place={world.maps[location].name}
      />
      {!overlay && !cerShow && !(state.day === 1 && !state.flags.tutorial) && (
        <QuestTracker onOpen={() => setOverlay({ type: "quests" })} />
      )}
      <div className="location-badge">📍 {world.maps[location].name}</div>
      <div key={location} className="location-banner">
        {world.maps[location].name}
      </div>
      {prompt && !overlay && !rollcall && (
        <div
          className={`prompt ${prompt.kind === "event" ? "urgent" : ""}`}
          onClick={interact}
        >
          <kbd>E</kbd> {fmt(prompt.label, ctx)}
        </div>
      )}
      <TouchPad keys={keys} />
      {overlay?.type === "dialogue" && (
        <>
          {overlay.bg && <StoryBackdrop bg={overlay.bg} />}
          <DialogueBox
            key={overlay.nonce ?? JSON.stringify(overlay.script.lines[0])}
            script={overlay.script}
            onChoice={overlay.onChoice}
            onClose={closeOverlay}
          />
        </>
      )}
      {overlay?.type === "resist" && (
        <ResistMeter
          key={overlay.opts.title + overlay.opts.mode}
          opts={overlay.opts}
          onDone={(ok) => {
            const o = overlay;
            setOverlay(null);
            o.onDone(ok);
          }}
        />
      )}
      {overlay?.type === "puzzle" && (
        <PuzzleBox
          key={overlay.id}
          id={overlay.id}
          onSolved={(reward) => {
            const o = overlay;
            setOverlay(null);
            o.onSolved(reward);
          }}
          onFail={
            overlay.onFail
              ? () => {
                  const o = overlay;
                  setOverlay(null);
                  o.onFail?.();
                }
              : undefined
          }
          onClose={() => {
            const o = overlay;
            setOverlay(null);
            o.onClose?.();
          }}
        />
      )}
      {overlay?.type === "menu" && (
        <Menu
          title={overlay.title}
          subtitle={overlay.subtitle}
          options={overlay.options}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.type === "notice" && (
        <Notice
          info={overlay.info}
          onClose={() => {
            const o = overlay;
            setOverlay(null);
            o.onDone?.();
          }}
        />
      )}
      {overlay?.type === "mirror" && (
        <MirrorReveal
          onDone={() => {
            const o = overlay;
            setOverlay(null);
            o.onDone();
          }}
        />
      )}
      {overlay?.type === "notebook" && (
        <Notebook onClose={() => setOverlay(null)} />
      )}
      {overlay?.type === "quests" && (
        <QuestLog onClose={() => setOverlay(null)} />
      )}
      {overlay?.type === "map" && <MapView onClose={() => setOverlay(null)} />}
      {flash && <div className="white-flash" />}
      {cerShow && (
        <RollcallCeremony
          info={cerShow.info}
          ctl={cerCtl}
          aide={cerShow.aide}
          onEnd={finishCeremony}
        />
      )}
      {nightPhase === "sleep" && (
        <div className="night-sleep" onClick={nightWake}>
          <div className="night-zzz">
            Z<span>z</span>
            <i>z</i>
          </div>
          <div className="night-text">소등. 모포를 덮고 눈을 감았다…</div>
          <div className="night-sub">
            {nightKind === "guard"
              ? "오늘은 위병소 야간 근무가 있다. 사수가 깨우러 올 것이다."
              : "오늘은 불침번 근무가 있다. 이전 근무자가 깨우러 올 것이다."}
          </div>
          <div className="night-hint">클릭 · Enter</div>
        </div>
      )}
      <div className="rank-hint">
        {rankIdxForDay(day) >= 3 ? "병장 · 전역이 코앞!" : ""}
      </div>
    </div>
  );
}

const QUEST_STEPS = Object.fromEntries(
  Object.entries(QUESTS).map(([k, v]) => [k, v.steps]),
);
