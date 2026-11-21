'use client';
import { useEffect } from 'react';
import type { NpcId } from '../types';
import { useGame, presentNpcs } from '../state/store';
import { BRANCHES, fmtTime } from '../data/branches';
import { NPC_SKINS, npcDisplayName } from '../data/npcs';
import { QUESTS } from '../data/quests';
import { getWorld, type MapId } from '../engine/map';
import { runtime } from '../engine/runtime';
import { STORY_MISSIONS, missionReady } from '../data/story';

/** 지도(M): 야외 구역과 막사 층별 방을 도식으로 보여 주고, 내 위치·퀘스트 목적지·일정 장소·NPC 위치를 표시 */
export default function MapView({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const world = getWorld(s.branch, BRANCHES[s.branch].trainArea);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const me = runtime.player.map;
  // 퀘스트 목적지 (장소 또는 NPC가 있는 맵)
  const quest = new Map<MapId, string[]>();
  const addQ = (m: MapId | undefined, label: string) => { if (m) quest.set(m, [...(quest.get(m) ?? []), label]); };
  for (const q of s.quests) {
    const d = QUESTS[q.id];
    const step = d?.steps[q.step];
    if (!step) continue;
    if (step.spot) addQ(world.spots[step.spot]?.map, d.title);
    if (step.npc) addQ(runtime.npcLoc[step.npc]?.map, `${d.title} (${NPC_SKINS[s.branch][step.npc].name})`);
  }
  if (s.patrol) {
    for (const sp of ['board1', 'laundry1', 'wc1', 'board2', 'laundry2', 'wc2'] as const) {
      if (!s.patrol.done.includes(sp)) addQ(world.spots[sp].map, '야간 순찰');
    }
    if (s.patrol.done.length >= 6) addQ('command', '순찰 결과 보고');
  }
  if (s.clues.length > 0) {
    for (const m of STORY_MISSIONS) {
      if (!m.spot || !missionReady(m, s)) continue;
      addQ(m.id === 'M-04' ? 'library' : world.spots[m.spot].map, `📖 ${m.title}`);
    }
  }
  // 다음 일정 장소
  const ev = s.currentEvent();
  const evMap = ev?.spot ? world.spots[ev.spot]?.map : undefined;
  // NPC 위치
  const npcAt = new Map<MapId, NpcId[]>();
  for (const id of presentNpcs(s.day)) {
    const loc = runtime.npcLoc[id];
    if (loc) npcAt.set(loc.map, [...(npcAt.get(loc.map) ?? []), id]);
  }

  const Node = ({ id, note, children }: { id: MapId; note?: string; children?: React.ReactNode }) => {
    const qs = quest.get(id);
    const npcs = npcAt.get(id) ?? [];
    return (
      <div className={`mv-node ${me === id ? 'me' : ''} ${qs ? 'quest' : ''} ${evMap === id ? 'event' : ''}`}>
        <div className="mv-name">
          {world.maps[id]?.name ?? id}
          <span className="mv-badges">
            {me === id && <span title="현재 위치">📍</span>}
            {qs && <span title={qs.join(', ')}>❗</span>}
            {evMap === id && <span title={ev?.label}>📢</span>}
          </span>
        </div>
        {note && <div className="mv-note">{note}</div>}
        {npcs.length > 0 && <div className="mv-npcs">{npcs.map((n) => NPC_SKINS[s.branch][n].name).join(' · ')}</div>}
        {children}
      </div>
    );
  };
  const facility = world.spots.ammo?.label ?? '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="mapview" onClick={(e) => e.stopPropagation()}>
        <div className="ql-head">
          <div className="menu-title">🗺️ {BRANCHES[s.branch].unit} 지도</div>
          <button className="nb-close" onClick={onClose}>✕</button>
        </div>
        <div className="mv-body">
          <div className="mv-legend">📍 내 위치 · ❗ 퀘스트 목적지 · 📢 {ev ? `${fmtTime(ev.start)} ${ev.label}` : '다음 일정'} · 이름 = 선후임·간부 위치</div>
          <h4>야외 (길 끝 표지판으로 이동)</h4>
          <div className="mv-outdoor">
            <Node id="pxyard" note="건물 문으로 매점 입장"><Node id="px" /></Node>
            <div className="mv-link">↔</div>
            <Node id="outdoor" note="막사 입구 · 연병장 · 농구장" />
            <div className="mv-link">↔</div>
            <Node id="messyard"><Node id="mess" note="안쪽 문 → 조리실" /><Node id="kitchen" /></Node>
            <div /><div /><div className="mv-link v">↕</div><div /><div className="mv-link v">↕</div>
            <div /><div />
            <Node id="depot" note={`${facility} · ${BRANCHES[s.branch].trainArea} · 위병소 · 정문`} />
            <div />
            <Node id="recycle" />
          </div>
          <h4>막사 (계단으로 1층 ↔ 2층)</h4>
          <div className="mv-floors">
            <Node id="hq2" note="복도: 정수기 · 게시판">
              <div className="mv-rooms">
                <Node id="lounge" /><Node id="gymroom" /><Node id="library" /><Node id="wc2" />
                <Node id="room2" /><Node id="cyber" /><Node id="laundry2" />
              </div>
            </Node>
            <Node id="hq1" note="복도: 정수기 · 게시판 · 현관(밖으로)">
              <div className="mv-rooms">
                <Node id="admin" /><Node id="command" /><Node id="maint" /><Node id="wc1" />
                <Node id="room1" note="내 침상" /><Node id="laundry1" />
              </div>
            </Node>
          </div>
          <h4>선후임 · 간부 위치</h4>
          <div className="mv-people">
            {presentNpcs(s.day).map((id) => {
              const loc = runtime.npcLoc[id];
              const where = loc ? (loc.dest !== loc.map ? `${world.maps[loc.map]?.name} → ${world.maps[loc.dest]?.name}` : world.maps[loc.map]?.name) : s.minute >= 22 * 60 ? '퇴근' : '?';
              return <div key={id}>👤 {npcDisplayName(s.branch, id, s.day)} — {where}</div>;
            })}
          </div>
        </div>
        <div className="menu-foot">M / Esc 닫기</div>
      </div>
    </div>
  );
}
