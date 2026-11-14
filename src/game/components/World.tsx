'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Choice, Dialogue, NpcId, SpotId } from '../types';
import { useGame, presentNpcs } from '../state/store';
import { BRANCHES, TOTAL_DAYS, rankIdxForDay, seasonForDay } from '../data/branches';
import { findSpecies } from '../data/monsters';
import { NPC_ROLES, NPC_SKINS, npcDisplayName, npcRoleTitle } from '../data/npcs';
import { FAREWELL_LINES, SMALL_TALK } from '../data/dialogues';
import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import { isFreeTimeEvening, isMealTime } from '../data/schedule';
import { MS_PER_MINUTE, useSettings } from '../state/settings';
import {
  MAP_NAMES, TILE, collides, doorCenter, doorToward, findPath, getWorld, renderMapCanvas,
  type Door, type MapId, type WorldDef,
} from '../engine/map';
import { drawMonster, type Dir } from '../engine/drawMonster';
import { runtime } from '../engine/runtime';
import { npcCap } from '../engine/speakers';
import { fmt } from '../engine/text';
import Hud from './Hud';
import DialogueBox, { type DialogueScript } from './DialogueBox';
import Menu, { type MenuOption } from './Menu';
import Notebook from './Notebook';
import RollcallModal from './RollcallModal';
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

type Overlay =
  | { type: 'dialogue'; script: DialogueScript; onChoice?: (c: Choice) => void; onDone?: () => void }
  | { type: 'menu'; title: string; subtitle?: string; options: MenuOption[] }
  | { type: 'notebook' }
  | null;

interface Interactable {
  key: string;
  label: string;
  kind: 'event' | 'npc' | 'spot';
  npc?: NpcId;
  spot?: SpotId;
}

/** 자유 시간에 머무는 곳 */
const FREE_POS: Record<NpcId, Pos> = {
  sgt: ['barracks', 10, 5], senior: ['outdoor', 5, 26], buddy: ['cyber', 2, 2], junior: ['barracks', 12, 5], junior2: ['outdoor', 24, 25],
  lt: ['admin', 1, 4], sgm: ['outdoor', 16, 21], cpt: ['admin', 5, 2],
};
/** 식사 시간 식당 자리 */
const MEAL_POS: Partial<Record<NpcId, Pos>> = {
  sgt: ['mess', 2, 5], senior: ['mess', 3, 5], buddy: ['mess', 8, 5], junior: ['mess', 9, 5], junior2: ['mess', 10, 8],
};
/** 취침 전 생활관 자리 */
const NIGHT_POS: Partial<Record<NpcId, Pos>> = {
  sgt: ['barracks', 10, 5], senior: ['barracks', 11, 6], buddy: ['barracks', 4, 5], junior: ['barracks', 12, 4], junior2: ['barracks', 9, 6],
};
const FORMATION: [number, number][] = [[-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2]];

export default function World() {
  const branch = useGame((s) => s.branch);
  const day = useGame((s) => s.day);
  const speciesId = useGame((s) => s.speciesId);
  const rollcall = useGame((s) => s.rollcall);
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
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__npcs = npcs; // 개발용 디버그 핸들
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
  useEffect(() => {
    const iv = setInterval(() => {
      const st = useGame.getState();
      if (st.rollcall || useSettings.getState().open) return;
      if (!overlayRef.current) st.tick(fastRef.current ? 5 : 1);
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
          { who: 'narr', text: '[조작] WASD/방향키 이동 · E/Space 상호작용 · Tab 수첩 · F 빨리감기' },
          { who: 'narr', text: '상단에 다음 일정이 뜬다. 집합 시간 안에 표시된 장소로 가서 E로 보고하자. 늦으면 그 자리로 끌려가 혼난다!' },
          { who: 'narr', text: '건물 문으로 드나들 수 있다. 쉬는 시간엔 선후임·간부와 대화하고 PX·싸지방·체력단련장을 이용하자. 체력·멘탈이 25 미만이면 훈련 점수가 깎인다.' },
        ],
      },
    });
  }, [rollcall, setOverlay]);

  // 지각: 집합 장소로 끌려와 혼난 뒤 일정 시작
  useEffect(() => useGame.subscribe((st, prev) => {
    if (!st.lateCall || prev.lateCall) return;
    const { who, label } = st.lateCall;
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
  }), [setOverlay]);

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
    if (!officer) {
      if (isMealTime(m) && MEAL_POS[id]) return MEAL_POS[id]!;
      if (m >= 21 * 60 && NIGHT_POS[id]) return NIGHT_POS[id]!;
    }
    return FREE_POS[id];
  }, [world]);

  // 상호작용 찾기 (같은 맵에 있는 것만)
  const findInteractable = useCallback((): Interactable | null => {
    const st = useGame.getState();
    const p = runtime.player;
    const ev = st.currentEvent();
    const dist = (x: number, y: number) => Math.hypot(p.x - x, p.y - y);
    if (ev && !st.eventBegun && ev.spot && (st.minute >= ev.start || ev.kind === 'farewell')) {
      const sp = world.spots[ev.spot];
      if (sp.map === p.map && dist(sp.x + 0.5, sp.y + 0.5) < 2.2) {
        return { key: `ev_${ev.id}`, kind: 'event', label: ev.kind === 'farewell' ? '위병소를 나선다 (전역!)' : `집합 완료 보고: ${ev.label}`, spot: ev.spot };
      }
    }
    let best: Interactable | null = null;
    let bd = 1.5;
    for (const id of presentNpcs(st.day)) {
      const n = npcs.current[id];
      if (!n || n.map !== p.map) continue;
      const d = dist(n.x, n.y);
      if (d < bd) {
        bd = d;
        best = { key: `npc_${id}`, kind: 'npc', npc: id, label: `대화: ${npcDisplayName(st.branch, id, st.day)}` };
      }
    }
    if (best) return best;
    const spotNames: Partial<Record<SpotId, string>> = { bed: '내 침상', mess: '식당 배식대', px: 'PX', admin: '행정반', cyber: '싸지방 PC', gym: '체력단련 기구' };
    for (const [id, label] of Object.entries(spotNames) as [SpotId, string][]) {
      const sp = world.spots[id];
      if (sp.map === p.map && dist(sp.x + 0.5, sp.y + 0.5) < 1.4) return { key: `spot_${id}`, kind: 'spot', spot: id, label };
    }
    return null;
  }, [world]);

  // ───── 상호작용 핸들러 ─────
  const openNpc = useCallback((id: NpcId) => {
    const st = useGame.getState();
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
    const opts: MenuOption[] = [
      { label: already ? '잡담하기' : '대화하기', hint: '10분', onSelect: () => {
        if (already) {
          const pool = SMALL_TALK[id] ?? ['…'];
          useGame.getState().spend(5);
          setOverlay({ type: 'dialogue', script: { npc: id, lines: [{ who: 'npc', text: pool[Math.floor(Math.random() * pool.length)] }] } });
        } else talk();
      } },
    ];
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
        act('휴대폰으로 가족과 통화', phoneOk ? '20분 · 멘탈+10 (1일 1회)' : '18:00~21:00만 가능', 20, { mental: 10 }, '"엄마, 나… 포켓몬 됐어." "밥은 잘 먹고?" 역시 엄마는 엄마다.', 'phone', !phoneOk);
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
        act(ok ? (meal === 'lunch' ? '점심 먹기' : '저녁 먹기') : '배식 시간이 아니다', ok ? '20분 · 체력+15 멘탈+2' : '12:00~13:00 / 17:30~18:30', 20, { hp: 15, mental: 2 }, meal === 'lunch' ? '오늘의 메뉴는 제육볶음! 짬밥이 이렇게 맛있을 줄이야.' : '저녁은 카레. 군대 카레는 왜 이렇게 맛있지?', `meal_${meal}`, !ok);
        break;
      }
      case 'px': {
        title = '🏪 PX (영외마트 아님)';
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
        act('인터넷 편지 확인', '30분 · 멘탈+6 (1일 1회)', 30, { mental: 6 }, '친구들이 보낸 인터넷 편지를 읽었다. "포켓몬이라니 ㅋㅋㅋ 사진 보내봐"', 'letter', !free);
        act('자격증 공부', '40분 · 숙련도+4 멘탈-3 (1일 1회)', 40, { skill: 4, mental: -3 }, '인강을 들으며 문제를 풀었다. 머리가 지끈하지만 뿌듯하다.', 'study', !free);
        break;
      }
      case 'gym': {
        title = '🏋️ 체력단련장';
        act('운동하기', '30분 · 멘탈+6 군기+2 체력-8 (1일 1회)', 30, { hp: -8, mental: 6, discipline: 2 }, '팔굽혀펴기와 턱걸이를 했다. 포켓몬 근육이 꿈틀댄다!', 'gym', !free);
        break;
      }
      case 'admin': {
        title = '🗂️ 행정반';
        if (!q) opts.push({ label: '간부님들이 업무 중이시다.', disabled: true, onSelect: () => {} });
        break;
      }
      default:
        return;
    }
    opts.push({ label: '닫기', onSelect: () => setOverlay(null) });
    setOverlay({ type: 'menu', title, options: opts });
  }, [setOverlay]);

  const interact = useCallback(() => {
    const it = promptRef.current ?? findInteractable();
    if (!it) return;
    if (it.kind === 'event') { useGame.getState().beginEvent(); return; }
    if (it.kind === 'npc' && it.npc) openNpc(it.npc);
    if (it.kind === 'spot' && it.spot) openSpot(it.spot);
  }, [findInteractable, openNpc, openSpot]);

  // 키 입력
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (overlayRef.current || useGame.getState().rollcall) return;
      if (e.key === 'Escape') { e.preventDefault(); keys.current = {}; useSettings.getState().openMenu(); return; }
      keys.current[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') interact();
      if (e.key === 'Tab') setOverlay({ type: 'notebook' });
      if (e.key === 'f' || e.key === 'F') setFast((v) => !v);
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
  }, [interact, setOverlay]);

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
    let shownMap: MapId = runtime.player.map;
    setLocation(shownMap);

    let npcRetarget = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const st = useGame.getState();
      const p = runtime.player;
      const blocked = !!overlayRef.current || !!st.rollcall || useSettings.getState().open;
      const map = world.maps[p.map];

      // 문 전환 진행
      if (fading) {
        if (fading.phase === 'out') {
          fade = Math.min(1, fade + dt * 6);
          if (fade >= 1) {
            const d = fading.door;
            p.map = d.to; p.x = d.arrive.x; p.y = d.arrive.y; p.dir = d.arrive.dir;
            fading.phase = 'in';
            doorCooldown = 0.4;
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
      if (!blocked && !fading) {
        const k = keys.current;
        if (k['arrowleft'] || k['a']) vx -= 1;
        if (k['arrowright'] || k['d']) vx += 1;
        if (k['arrowup'] || k['w']) vy -= 1;
        if (k['arrowdown'] || k['s']) vy += 1;
      }
      const speed = 6;
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
      if (!fading && !blocked && doorCooldown <= 0 && p.moving) {
        for (const d of map.doors) {
          if (p.dir !== d.enterDir) continue;
          const hit = d.tiles.some(([tx, ty]) => Math.abs(p.x - (tx + 0.5)) < 0.9 && Math.abs(p.y - (ty + 0.5)) < 1.0);
          if (hit) { fading = { door: d, phase: 'out' }; break; }
        }
      }

      // NPC 갱신
      npcRetarget -= dt;
      const present = presentNpcs(st.day);
      if (npcRetarget <= 0) {
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
      for (const id of present) {
        const n = npcs.current[id];
        if (!n) continue;
        if (n.path.length && !blocked) {
          const [px, py] = n.path[0];
          const gx = px + 0.5, gy = py + 0.5;
          const dx = gx - n.x, dy = gy - n.y;
          const d = Math.hypot(dx, dy);
          const sp = 4 * dt;
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
          if (!blocked && n.map === p.map) {
            const dd = Math.hypot(p.x - n.x, p.y - n.y);
            if (dd < 2.5) n.dir = Math.abs(p.x - n.x) > Math.abs(p.y - n.y) ? (p.x > n.x ? 'right' : 'left') : p.y > n.y ? 'down' : 'up';
          }
        }
      }

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
      const zoom = map.indoor
        ? Math.max(1, Math.min(1.7, Math.min(w / mw, (h - 60) / mh) * 0.92))
        : w < 700 ? 0.8 : 1;
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
      g.font = 'bold 13px "Jua", sans-serif';
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

      // 엔티티 (y 정렬, 같은 맵만)
      const ents: { y: number; draw: () => void }[] = [];
      for (const id of present) {
        const n = npcs.current[id];
        if (!n || n.map !== p.map) continue;
        const sk = NPC_SKINS[st.branch][id];
        ents.push({
          y: n.y,
          draw: () => {
            drawMonster(g, sk.look, n.x * TILE, n.y * TILE + 12, 34, { dir: n.dir, t: t + id.length, walking: n.moving, cap: npcCap(st.branch, id) });
            g.font = '11px "Jua", sans-serif';
            const nm = sk.name;
            const tw = g.measureText(nm).width + 8;
            g.fillStyle = NPC_ROLES[id].officer ? 'rgba(60,50,20,0.8)' : 'rgba(20,30,40,0.7)';
            g.fillRect(n.x * TILE - tw / 2, n.y * TILE - 44, tw, 14);
            g.fillStyle = NPC_ROLES[id].officer ? '#ffe08a' : '#ffffff';
            g.fillText(nm, n.x * TILE, n.y * TILE - 33);
          },
        });
      }
      ents.push({
        y: p.y,
        draw: () => {
          drawMonster(g, look, p.x * TILE, p.y * TILE + 12, 36, { dir: p.dir, t, walking: p.moving, cap: b.cap });
          g.fillStyle = '#ffe14a';
          g.beginPath();
          g.moveTo(p.x * TILE - 5, p.y * TILE - 46 + Math.sin(t * 4) * 2);
          g.lineTo(p.x * TILE + 5, p.y * TILE - 46 + Math.sin(t * 4) * 2);
          g.lineTo(p.x * TILE, p.y * TILE - 39 + Math.sin(t * 4) * 2);
          g.fill();
        },
      });
      ents.sort((a, c) => a.y - c.y).forEach((e) => e.draw());
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
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [world, look, b.cap, npcTarget, findInteractable]);

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
      <Hud onNotebook={() => setOverlay({ type: 'notebook' })} fast={fast} onToggleFast={() => setFast((v) => !v)} />
      <div className="location-badge">📍 {location === 'outdoor' ? `${b.unit} 야외` : MAP_NAMES[location]}</div>
      {location !== 'outdoor' && <div key={location} className="location-banner">{MAP_NAMES[location]}</div>}
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
      {rollcall && <RollcallModal />}
      <div className="rank-hint">{rankIdxForDay(day) >= 3 ? '병장 · 전역이 코앞!' : ''}</div>
    </div>
  );
}

const QUEST_STEPS = Object.fromEntries(Object.entries(QUESTS).map(([k, v]) => [k, v.steps]));
