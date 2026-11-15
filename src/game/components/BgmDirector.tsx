'use client';
import { useEffect } from 'react';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import { runtime } from '../engine/runtime';
import { dreamPending } from '../data/story';
import { TOTAL_DAYS } from '../data/branches';
import type { MapId } from '../engine/map';
import {
  audioState, playBgm, playJingle, playSfx, rewindBgm, setAudioPaused, setBgmVolume, setSfxVolume, unlockAudio,
  type BgmId, type JingleId,
} from '../engine/audio';

type GameState = ReturnType<typeof useGame.getState>;

/** 느긋한 곡이 어울리는 곳: 식당·조리실·PX·휴게실 */
const RELAX_MAPS = new Set<MapId>(['mess', 'kitchen', 'messyard', 'px', 'pxyard', 'lounge']);
/** 떡밥을 캐는 곳: 도서관 */
const MYSTERY_MAPS = new Set<MapId>(['library']);

const LUNCH: [number, number] = [12 * 60, 13 * 60 + 30];
const EVENING: [number, number] = [17 * 60 + 30, 21 * 60 + 30];
const within = (m: number, [a, b]: [number, number]) => m >= a && m < b;

/** 부대 화면에서 지금 상황에 맞는 곡 */
function worldBgm(s: GameState): BgmId {
  const ev = s.currentEvent();
  // 점호: 의식이 시작되면 행진곡
  if (s.rollcall || (s.eventBegun && (ev?.kind === 'rollcall_am' || ev?.kind === 'rollcall_pm'))) return 'bgm_05_rollcall_march';
  // 밤: 소등 뒤 · 불침번 · 야간 위병소 · 야간 순찰
  if (s.nightDuty || s.patrol || s.minute >= 22 * 60 || s.minute < 6 * 60) return 'bgm_08_night_duty_fog';
  // 전역일: 작별 인사를 다니는 동안은 메인 테마
  if (s.day >= TOTAL_DAYS && ev?.kind === 'farewell') return 'bgm_01_title';
  const map = runtime.player.map;
  if (MYSTERY_MAPS.has(map)) return 'bgm_09_mystery_clues';
  // 식사·개인정비 시간, 또는 쉬는 장소
  if (within(s.minute, LUNCH) || within(s.minute, EVENING) || RELAX_MAPS.has(map)) return 'bgm_06_messhall_free';
  return 'bgm_04_barracks_day';
}

/** 게임 상태 → 곡. [곡, 반복 여부] */
export function pickBgm(s: GameState): [BgmId, boolean] {
  switch (s.scene) {
    case 'title': return ['bgm_01_title', true];
    case 'home':
    case 'intro': return ['bgm_02_bedroom_night', true];
    case 'quiz':
    case 'transform': return ['bgm_03_dream_star_hill', true];
    case 'world': return [worldBgm(s), true];
    case 'minigame': {
      const g = s.minigame?.game;
      // 불침번·야간 위병소는 밤 분위기 그대로, 오버로크(바느질)는 느긋하게, 나머지 훈련은 빠른 곡
      if (g === 'night' || (g === 'guard' && s.nightDuty)) return ['bgm_08_night_duty_fog', true];
      if (g === 'overlock') return ['bgm_06_messhall_free', true];
      return ['bgm_07_training_minigame', true];
    }
    case 'promotion': return ['bgm_05_rollcall_march', true];
    case 'dayEnd': return [dreamPending(s) ? 'bgm_03_dream_star_hill' : 'bgm_02_bedroom_night', true];
    case 'ending': return ['bgm_11_ending_same_star', false];
    default: return ['bgm_04_barracks_day', true];
  }
}

/**
 * 화면에는 아무것도 그리지 않는다. 게임 상태를 지켜보다가
 * - 상황에 맞는 BGM으로 바꾸고 (0.3초마다 확인: 플레이어가 있는 맵은 React 상태가 아니라서)
 * - 단서·별 조각·퀘스트·지각·미니게임 결과·진급·취침에 징글을 울린다
 */
export default function BgmDirector() {
  const bgmVolume = useSettings((s) => s.bgmVolume);
  const sfxVolume = useSettings((s) => s.sfxVolume);

  useEffect(() => { setBgmVolume(bgmVolume / 100); }, [bgmVolume]);
  useEffect(() => { setSfxVolume(sfxVolume / 100); }, [sfxVolume]);

  useEffect(() => {
    const sync = () => {
      const [id, loop] = pickBgm(useGame.getState());
      playBgm(id, loop);
    };
    sync();
    const timer = window.setInterval(sync, 300);

    // 첫 입력에서 오디오 깨우기 (브라우저 자동 재생 정책)
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    // 버튼 누르는 소리
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.('button')) playSfx('sfx_confirm', 0.6);
    };
    window.addEventListener('click', onClick, true);

    const onVis = () => setAudioPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);

    // 징글이 한꺼번에 겹치면(꿈에서 단서 + 별 조각 등) 가장 중요한 것 하나만 울린다
    let pending: { id: JingleId; prio: number } | null = null;
    let pendingTimer = 0;
    const jingle = (id: JingleId, prio: number) => {
      if (!pending || prio > pending.prio) pending = { id, prio };
      if (pendingTimer) return;
      pendingTimer = window.setTimeout(() => {
        pendingTimer = 0;
        if (pending) void playJingle(pending.id);
        pending = null;
      }, 80);
    };

    const unsub = useGame.subscribe((s, p) => {
      if (s.scene !== p.scene) {
        // 새 게임을 시작하면 곡들을 처음부터
        if (p.scene === 'title' && s.scene === 'home') rewindBgm();
        if (s.scene === 'promotion') jingle('jingle_promotion', 6);
        if (s.scene === 'dayEnd') jingle(dreamPending(s) ? 'jingle_dream_enter' : 'jingle_day_end_sleep', 4);
        if (s.scene === 'ending') rewindBgm('bgm_11_ending_same_star');
        sync();
      }
      // 불러오기·새 게임·날짜가 넘어갈 때 한꺼번에 바뀌는 값에는 반응하지 않는다
      if (p.scene === 'title' || s.scene === 'title' || s.day !== p.day) return;
      if (s.stars.length > p.stars.length) jingle('jingle_star_fragment', 9);
      else if (s.clues.length > p.clues.length) jingle('jingle_clue_found', 8);
      else if (s.doneQuests.length > p.doneQuests.length) jingle('jingle_quest_complete', 5);
      if (s.lateCall && !p.lateCall) jingle('jingle_late_scolded', 7);
      if (s.grades.length > p.grades.length) {
        const g = s.grades[s.grades.length - 1];
        jingle(g.score >= 50 ? 'jingle_minigame_clear' : 'jingle_minigame_fail', 3);
      }
    });

    if (process.env.NODE_ENV === 'development') {
      (window as unknown as Record<string, unknown>).__audio = { state: audioState, pick: () => pickBgm(useGame.getState())[0] };
    }

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(pendingTimer);
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onVis);
      unsub();
    };
  }, []);

  return null;
}
