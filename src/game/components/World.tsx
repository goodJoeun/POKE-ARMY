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
import { MAP_H, MAP_W, TILE, buildMap, collides, findPath, renderMapCanvas, type GameMap } from '../engine/map';
import { drawMonster, type Dir } from '../engine/drawMonster';
import { runtime } from '../engine/runtime';
import { npcCap } from '../engine/speakers';
import { fmt } from '../engine/text';
import Hud from './Hud';
import DialogueBox, { type DialogueScript } from './DialogueBox';
import Menu, { type MenuOption } from './Menu';
import Notebook from './Notebook';
import RollcallModal from './RollcallModal';

interface NpcRt {
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  path: [number, number][];
  targetKey: string;
}

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

const FREE_POS: Record<NpcId, [number, number]> = {
  sgt: [12, 7], senior: [5, 26], buddy: [5, 19], junior: [14, 7], junior2: [24, 25],
  lt: [21, 6], sgm: [16, 21], cpt: [23, 4],
};
const MEAL_POS: Partial<Record<NpcId, [number, number]>> = {
  sgt: [34, 7], senior: [35, 7], buddy: [38, 7], junior: [39, 7], junior2: [40, 9],
};
const NIGHT_POS: Partial<Record<NpcId, [number, number]>> = {
  sgt: [12, 7], senior: [13, 8], buddy: [6, 7], junior: [14, 6], junior2: [11, 8],
};
const FORMATION: [number, number][] = [[-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2]];

export default function World() {
  const branch = useGame((s) => s.branch);
  const day = useGame((s) => s.day);
  const speciesId = useGame((s) => s.speciesId);
  const rollcall = useGame((s) => s.rollcall);
  const b = BRANCHES[branch];
  const season = seasonForDay(day);
  const map = useMemo<GameMap>(() => buildMap(branch, b.trainArea), [branch, b.trainArea]);
  const look = findSpecies(speciesId)!.look;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const npcs = useRef<Partial<Record<NpcId, NpcRt>>>({});
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

  // 정적 맵 렌더
  useEffect(() => {
    mapCanvasRef.current = renderMapCanvas(map, season);
  }, [map, season]);

  // 시간 흐름
  useEffect(() => {
    const iv = setInterval(() => {
      const st = useGame.getState();
      if (st.rollcall) return;
      if (!overlayRef.current) st.tick(fastRef.current ? 5 : 1);
    }, 250);
    return () => clearInterval(iv);
  }, []);

  // 첫날 튜토리얼
  useEffect(() => {
    const st = useGame.getState();
    if (st.day === 1 && !st.flags.tutorial) {
      st.applyEffects({ flag: 'tutorial' }, undefined, true);
      setOverlay({
        type: 'dialogue',
        script: {
          lines: [
            { who: 'narr', text: `${b.unit}에 전입 온 첫날 아침. 기상 나팔 소리가 울린다!` },
            { who: 'narr', text: '[조작] WASD/방향키 이동 · E/Space 상호작용 · Tab 수첩 · F 빨리감기' },
            { who: 'narr', text: '상단의 일정을 확인하고, 집합 시간까지 표시된 장소로 이동해 E를 눌러 보고하자. 늦으면 지각!' },
            { who: 'narr', text: '쉬는 시간엔 선후임·간부와 대화하고, PX·싸지방·체력단련장을 이용할 수 있다. 체력·멘탈이 25 미만이면 훈련 점수가 깎이니 밥과 휴식도 챙기자. 첫 집합: 06:15 연병장 아침 점호!' },
          ],
        },
      });
    }
  }, [b.unit, setOverlay]);

  // NPC 목표 위치
  const npcTarget = useCallback((id: NpcId): [number, number] => {
    const st = useGame.getState();
    const m = st.minute;
    const ev = st.currentEvent();
    const officer = NPC_ROLES[id].officer;
    if (st.day >= TOTAL_DAYS) {
      const pos = FREE_POS[id];
      return id === 'lt' || id === 'cpt' || id === 'sgm' ? [map.spots.gate.x + (id === 'lt' ? -2 : id === 'cpt' ? 2 : 3), map.spots.gate.y - 2] : pos;
    }
    if (ev && !st.eventBegun && m >= ev.start && ev.spot) {
      const sp = map.spots[ev.spot];
      if (!officer) {
        const soldiers = presentNpcs(st.day).filter((n) => !NPC_ROLES[n].officer);
        const i = soldiers.indexOf(id);
        const [dx, dy] = FORMATION[i % FORMATION.length];
        return [sp.x + dx, sp.y + dy];
      }
      if (id === 'lt' || (id === 'cpt' && ev.kind === 'rollcall_am')) return [sp.x + (id === 'cpt' ? 1 : -1), sp.y - 4];
    }
    if (!officer) {
      if (isMealTime(m) && MEAL_POS[id]) return MEAL_POS[id]!;
      if (m >= 21 * 60 && NIGHT_POS[id]) return NIGHT_POS[id]!;
    }
    return FREE_POS[id];
  }, [map]);

  // 상호작용 찾기
  const findInteractable = useCallback((): Interactable | null => {
    const st = useGame.getState();
    const p = runtime.player;
    const ev = st.currentEvent();
    const dist = (x: number, y: number) => Math.hypot(p.x - x, p.y - y);
    if (ev && !st.eventBegun && ev.spot && (st.minute >= ev.start || ev.kind === 'farewell')) {
      const sp = map.spots[ev.spot];
      if (dist(sp.x + 0.5, sp.y + 0.5) < 2.2) {
        return { key: `ev_${ev.id}`, kind: 'event', label: ev.kind === 'farewell' ? '위병소를 나선다 (전역!)' : `집합 완료 보고: ${ev.label}`, spot: ev.spot };
      }
    }
    let best: Interactable | null = null;
    let bd = 1.5;
    for (const id of presentNpcs(st.day)) {
      const n = npcs.current[id];
      if (!n) continue;
      const d = dist(n.x, n.y);
      if (d < bd) {
        bd = d;
        best = { key: `npc_${id}`, kind: 'npc', npc: id, label: `대화: ${npcDisplayName(st.branch, id, st.day)}` };
      }
    }
    if (best) return best;
    const spotNames: Partial<Record<SpotId, string>> = { bed: '내 침상', mess: '식당 배식대', px: 'PX', admin: '행정반', cyber: '싸지방 PC', gym: '체력단련 기구' };
    for (const [id, label] of Object.entries(spotNames) as [SpotId, string][]) {
      const sp = map.spots[id];
      if (dist(sp.x + 0.5, sp.y + 0.5) < 1.4) return { key: `spot_${id}`, kind: 'spot', spot: id, label };
    }
    return null;
  }, [map]);

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

    // NPC 초기 배치
    for (const id of presentNpcs(useGame.getState().day)) {
      const [tx, ty] = npcTarget(id);
      npcs.current[id] = { x: tx + 0.5, y: ty + 0.5, dir: 'down', moving: false, path: [], targetKey: `${tx},${ty}` };
    }

    let npcRetarget = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const st = useGame.getState();
      const p = runtime.player;
      const blocked = !!overlayRef.current || !!st.rollcall;

      // 플레이어 이동
      let vx = 0, vy = 0;
      if (!blocked) {
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

      // NPC 갱신
      npcRetarget -= dt;
      const present = presentNpcs(st.day);
      if (npcRetarget <= 0) {
        npcRetarget = 0.5;
        for (const id of present) {
          let n = npcs.current[id];
          const [tx, ty] = npcTarget(id);
          const key = `${tx},${ty}`;
          if (!n) { n = npcs.current[id] = { x: tx + 0.5, y: ty + 0.5, dir: 'down', moving: false, path: [], targetKey: key }; continue; }
          if (n.targetKey !== key) {
            n.targetKey = key;
            n.path = findPath(map, Math.floor(n.x), Math.floor(n.y), tx, ty).slice(1);
          }
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
        } else {
          n.moving = false;
          if (!blocked) {
            const dd = Math.hypot(p.x - n.x, p.y - n.y);
            if (dd < 2.5) n.dir = Math.abs(p.x - n.x) > Math.abs(p.y - n.y) ? (p.x > n.x ? 'right' : 'left') : p.y > n.y ? 'down' : 'up';
          }
        }
      }

      // 상호작용 프롬프트
      const it = blocked ? null : findInteractable();
      if ((it?.key ?? null) !== (promptRef.current?.key ?? null)) {
        promptRef.current = it;
        setPrompt(it);
      }

      // ── 그리기 ──
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#2a2a2a';
      g.fillRect(0, 0, w, h);
      const zoom = w < 700 ? 0.8 : 1;
      const vw = w / zoom, vh = h / zoom;
      let camX = p.x * TILE - vw / 2;
      let camY = p.y * TILE - vh / 2;
      camX = Math.max(0, Math.min(MAP_W * TILE - vw, camX));
      camY = Math.max(0, Math.min(MAP_H * TILE - vh, camY));
      if (MAP_W * TILE < vw) camX = (MAP_W * TILE - vw) / 2;
      if (MAP_H * TILE < vh) camY = (MAP_H * TILE - vh) / 2;
      g.save();
      g.scale(zoom, zoom);
      g.translate(-Math.round(camX), -Math.round(camY));
      if (mapCanvasRef.current) g.drawImage(mapCanvasRef.current, 0, 0);

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

      // 목표 지점 표시
      const ev = st.currentEvent();
      let target: { x: number; y: number } | null = null;
      if (ev && !st.eventBegun && ev.spot && (st.minute >= ev.start || ev.kind === 'farewell')) {
        const sp = map.spots[ev.spot];
        target = { x: sp.x + 0.5, y: sp.y + 0.5 };
      }
      const qTargets: { x: number; y: number }[] = [];
      for (const q of st.quests) {
        const step = (QUEST_STEPS[q.id] ?? [])[q.step];
        if (!step) continue;
        if (step.spot) qTargets.push({ x: map.spots[step.spot].x + 0.5, y: map.spots[step.spot].y + 0.5 });
        if (step.npc && npcs.current[step.npc]) qTargets.push({ x: npcs.current[step.npc]!.x, y: npcs.current[step.npc]!.y - 1.3 });
      }
      for (const qt of qTargets) {
        g.fillStyle = '#f2c230';
        g.font = 'bold 18px sans-serif';
        g.fillText('❗', qt.x * TILE, qt.y * TILE - 6 + Math.sin(t * 4) * 3);
      }
      if (target) {
        const pulse = (Math.sin(t * 5) + 1) / 2;
        g.strokeStyle = `rgba(255,80,60,${0.5 + pulse * 0.5})`;
        g.lineWidth = 3;
        g.beginPath(); g.arc(target.x * TILE, target.y * TILE, 26 + pulse * 10, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(255,80,60,0.18)';
        g.beginPath(); g.arc(target.x * TILE, target.y * TILE, 26, 0, Math.PI * 2); g.fill();
      }

      // 엔티티 (y 정렬)
      const ents: { y: number; draw: () => void }[] = [];
      for (const id of present) {
        const n = npcs.current[id];
        if (!n) continue;
        const sk = NPC_SKINS[st.branch][id];
        ents.push({
          y: n.y,
          draw: () => {
            drawMonster(g, sk.look, n.x * TILE, n.y * TILE + 12, 34, { dir: n.dir, t: t + id.length, walking: n.moving, cap: npcCap(st.branch, id) });
            g.font = '11px "Jua", sans-serif';
            const nm = sk.name;
            const tw = g.measureText(nm).width + 8;
            g.fillStyle = NPC_ROLES[id].officer ? 'rgba(60,50,20,0.8)' : 'rgba(20,30,40,0.7)';
            g.fillRect(n.x * TILE - tw / 2, n.y * TILE - 38, tw, 14);
            g.fillStyle = NPC_ROLES[id].officer ? '#ffe08a' : '#ffffff';
            g.fillText(nm, n.x * TILE, n.y * TILE - 27);
          },
        });
      }
      ents.push({
        y: p.y,
        draw: () => {
          drawMonster(g, look, p.x * TILE, p.y * TILE + 12, 36, { dir: p.dir, t, walking: p.moving, cap: b.cap });
          g.fillStyle = '#ffe14a';
          g.beginPath();
          g.moveTo(p.x * TILE - 5, p.y * TILE - 40 + Math.sin(t * 4) * 2);
          g.lineTo(p.x * TILE + 5, p.y * TILE - 40 + Math.sin(t * 4) * 2);
          g.lineTo(p.x * TILE, p.y * TILE - 33 + Math.sin(t * 4) * 2);
          g.fill();
        },
      });
      ents.sort((a, c) => a.y - c.y).forEach((e) => e.draw());
      g.restore();

      // 밤 조명
      const m = st.minute;
      let dark = 0;
      if (m < 7 * 60) dark = 0.28 * (1 - (m - 360) / 60);
      if (m > 18 * 60 + 30) dark = Math.min(0.42, ((m - (18 * 60 + 30)) / 150) * 0.42);
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

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [map, look, b.cap, npcTarget, findInteractable]);

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

function TouchPad({ keys, onAction }: { keys: React.MutableRefObject<Record<string, boolean>>; onAction: () => void }) {
  const bind = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); keys.current[k] = true; },
    onPointerUp: () => { keys.current[k] = false; },
    onPointerLeave: () => { keys.current[k] = false; },
    onPointerCancel: () => { keys.current[k] = false; },
  });
  return (
    <div className="touchpad">
      <div className="dpad">
        <button className="up" {...bind('arrowup')}>▲</button>
        <button className="left" {...bind('arrowleft')}>◀</button>
        <button className="right" {...bind('arrowright')}>▶</button>
        <button className="down" {...bind('arrowdown')}>▼</button>
      </div>
      <button className="action" onPointerDown={(e) => { e.preventDefault(); onAction(); }}>E</button>
    </div>
  );
}
