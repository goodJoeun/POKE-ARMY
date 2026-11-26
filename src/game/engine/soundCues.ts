'use client';
import { useEffect, useRef } from 'react';
import { holdHush, isEerie, playCue, playSfx, releaseHush, setBgmMood, type BgmMood, type CueId } from './audio';

/**
 * 글에 어울리는 소리를 고른다.
 * 대사·지문·알림은 수천 줄이라 줄마다 소리를 적어 두지 않고, 글 속의 낱말(똑똑 · 똑딱 · 📢 …)을 보고 고른다.
 * 꼭 필요한 줄에는 Line.sfx 로 직접 적어 둘 수 있다 (그쪽이 먼저다).
 */
const LINE_CUES: [RegExp, CueId][] = [
  // 놀람 · 비명
  [/으아아|으악|아아악|\?!\?!/, 'jingle_shock'],
  // 진자 (슬리퍼)
  [/똑딱|진자가|진자 소리/, 'sfx_pendulum_ticktock'],
  // 포켓몬센터풍 회복
  [/띠리리링|건강해졌습니다/, 'jingle_heal'],
  // 노크
  [/똑똑(?![하한히])/, 'sfx_knock'],
  // 방송 · 스피커
  [/^📢|스피커에서|방송이 (울|나온|흘러)|전파합니다/, 'sfx_pa_chime'],
  // 라디오 · TV 잡음
  [/지직|치직|(?<![붙손])잡음|^📺|^📻/, 'sfx_radio_static'],
  [/^📱|진동이 울|휴대폰이 울/, 'sfx_phone'],
  [/^🎮/, 'sfx_save'],
  // 스위치 · 손전등
  [/딸깍|손전등을 (켜|껐|끄)|불을 껐/, 'sfx_switch'],
  // 물
  [/수도꼭지|물을 얼굴에|세수를 했|찬물|차가운 물|물소리|🚿/, 'sfx_water'],
  // 종이 · 편지 · 책
  [/^📜|^✉️|^💌|^📖|^📄|^📋|봉투를 (열|뜯)|책장을 넘|페이지를 넘|종이가|쪽지를 펼|편지를 펼|일기장을 (꺼|펼)/, 'sfx_paper'],
  // 하얘짐 · 안개
  [/새하얘|하얗게 (변|번|덮)|사방이 하얗|안개가 (밀려|덮|삼)/, 'sfx_fog_whiteout'],
  // 별 · 반짝임
  [/별똥별|반짝인다|반짝이는|별빛이|별 조각 하나가|빛이 점점 커지/, 'sfx_star_twinkle'],
  // 호루라기 · 집합
  [/호루라기|삐익|집합!|기상!/, 'sfx_whistle'],
  // 심장 · 긴장
  [/심장이|가슴이 두근|숨이 멎|소름이|등골이|오싹|뒤통수가 서늘/, 'sfx_heartbeat'],
  // 식판 · 수저
  [/식판을 (받|들|내려|반납|앞에)|식판 반납|배식병이|수저를 (내려|놓)|숟가락을 (내려|놓)/, 'sfx_tray'],
  // 물건을 받음
  [/을 받았다!|를 받았다!|손에 넣었다|을 건넨다|를 건넨다|올려놓는다|주머니에 넣/, 'sfx_item'],
  // 문
  // (지금 실제로 여닫힐 때만: "잠겨 있다" · "곧 열릴 거야" · 창문 · 질문은 제외. 철문은 묵직한 소리, 나머지는 실내 문)
  [/철문이 (열린다|열렸다|열리고|닫힌다|닫혔다)/, 'sfx_door_iron'],
  [/(?<![창질소주])문을 (벌컥|열었|닫았)|(?<![창질소주])문이 (열린다|열렸다|열리고|닫힌다|닫혔다)/, 'sfx_door'],
  // 쎄한 깨달음 · 거울 속의 무언가
  [/거울 속에[…,]|눈은 웃지 않는다|말문이 막혔다/, 'sfx_suspicion'],
  [/\(……!\)|\(…!\)|\(……\?\)|^\(…[^)]{1,16}\?\)$|❓/, 'sfx_suspicion'],
];

/** 말소리 그 자체인 소리: 인물의 대사 속에서도 울린다 */
const SPOKEN_CUES = new Set<CueId>(['jingle_shock', 'jingle_heal']);

/**
 * 대사·지문 한 줄에 어울리는 소리 (없으면 null).
 * spoken = 인물이 하는 말: "똑딱 소리 말입니까?"처럼 소리를 입에 올린 것뿐이면 울리지 않고,
 * 괄호 속 행동 묘사 "(똑똑)"만 실제로 일어난 일로 본다.
 */
export function lineCue(text: string, spoken = false): CueId | null {
  if (!spoken) {
    for (const [re, id] of LINE_CUES) if (re.test(text)) return id;
    return null;
  }
  for (const [re, id] of LINE_CUES) if (SPOKEN_CUES.has(id) && re.test(text)) return id;
  const acts = text.match(/\([^)]*\)/g);
  if (acts) for (const a of acts) for (const [re, id] of LINE_CUES) if (re.test(a)) return id;
  return null;
}

/** 화면 위 알림(토스트) 한 줄에 어울리는 소리 */
const TOAST_CUES: [RegExp, CueId][] = [
  [/^💾/, 'sfx_save'],
  [/^📢/, 'sfx_pa_chime'],
  [/^🔦/, 'sfx_switch'],
  [/^(👟|🔑|🍬|🎁)/, 'sfx_item'],
  [/^(💰|🛒)/, 'sfx_purchase'],
  [/^💸/, 'sfx_wrong'],
  [/^🍚 (점심시간|식사 시간\.)|^🌇/, 'sfx_pa_chime'],
  [/^📖 \d장/, 'jingle_quest_complete'],
  [/^(✨|🔍|\[🔍)/, 'sfx_star_twinkle'],
  [/🍬 별사탕 \+/, 'sfx_item'],
  [/🌟 기억 \+/, 'sfx_star_twinkle'],
  [/^🍱|^🥄/, 'sfx_tray'],
  [/^🏥/, 'jingle_minigame_fail'],
  [/^(✅|🏠|🍳)/, 'sfx_confirm'],
  [/^(📋|🏃|🌙|🛏️|🔎|🚶|🎖️|🎊)/, 'sfx_alert'],
];
export function toastCue(text: string, tone: 'info' | 'good' | 'bad' | 'alert'): CueId | null {
  for (const [re, id] of TOAST_CUES) if (re.test(text)) return id;
  if (tone === 'alert') return 'sfx_alert';
  if (tone === 'bad') return 'sfx_wrong';
  return null;
}

/** 화자·배경으로 장면의 곡을 고른다 (World의 대화 · 퍼즐 · 연출이 떠 있는 동안) */
export interface SceneHint {
  type: 'dialogue' | 'puzzle' | 'resist' | 'mirror' | 'notice' | 'menu' | 'other';
  /** 대화: 스토리 배경 */
  bg?: string;
  /** 대화: 주요 인물이 아닌 화자 이름 · 설명 */
  speaker?: string;
  speakerSub?: string;
  /** 퍼즐 ID */
  puzzle?: string;
  /** 대화: 장면이 직접 고른 곡 */
  bgm?: BgmMood;
  /** 저항 게이지: 방식 (still = 가만히 서 있기 → 대결이 아니다) */
  resistMode?: string;
}
export function sceneMood(h: SceneHint | null): BgmMood | null {
  if (!h) return null;
  if (h.bgm) return h.bgm;
  // 슬리퍼 · 팬텀이 나오는 장면은 밝은 대결곡 대신 스산한 곡으로 (대화 · 최면 저항 · 대결 퍼즐 모두)
  if (h.type === 'resist') return h.resistMode === 'still' ? null : 'bgm_12_unease';
  if (h.type === 'mirror') return 'none';
  if (h.type === 'puzzle') {
    const id = h.puzzle ?? '';
    // 슬리퍼와의 대결 · 최면 저항
    if (id.startsWith('P-20') || id === 'P-14') return 'bgm_12_unease';
    // 별의 창문 (첫 조각 · 마지막 조각)
    if (id === 'P-01' || id === 'P-21') return 'bgm_03_dream_star_hill';
    // 안개 너머: 어느 길로 가도 초소 앞
    if (id === 'P-05') return 'bgm_12_unease';
    return 'bgm_09_mystery_clues';
  }
  if (h.type === 'dialogue') {
    if (h.speaker === '슬리퍼') return 'bgm_12_unease';
    if (h.speaker === '당직부관' && h.speakerSub?.includes('???')) return 'bgm_12_unease';
    if (h.speaker?.includes('지라치') || h.speaker?.includes('별빛')) return 'bgm_03_dream_star_hill';
    if (h.speaker && /팬텀|거울 속|안개 속|화강돌/.test(h.speaker)) return 'bgm_12_unease';
    switch (h.bg) {
      case 'roof': return 'bgm_13_rooftop_stars';
      case 'parade': return 'bgm_03_dream_star_hill';
      case 'archive':
      case 'patrolBoard':
      case 'library': return 'bgm_09_mystery_clues';
      case 'radio': return 'bgm_12_unease';
    }
  }
  return null;
}

/**
 * 대사가 한 줄씩 나오는 화면(대화창 · 꿈 · 오프닝)이 쓰는 소리:
 * - 새 줄이 나올 때: 그 줄에 어울리는 소리, 없으면 넘기는 소리
 * - 글자가 찍히는 동안: 타자 소리 (너무 촘촘하지 않게)
 * key 는 줄이 바뀔 때마다 달라지는 값(줄 번호 등), cue 는 줄에 직접 적어 둔 소리.
 */
export function useLineSound(key: string | number, text: string, typed: number, opts?: { cue?: CueId | null; voice?: number; silent?: boolean; spoken?: boolean; hush?: boolean }) {
  const first = useRef(true);
  const cue = opts?.cue;
  const silent = opts?.silent;
  const spoken = opts?.spoken;
  const voice = opts?.voice ?? 1;
  useEffect(() => {
    if (silent || !text) return;
    // 🔇 음악이 뚝 끊기는 줄: 정적 위에 효과음만 남는다
    if (opts?.hush) setBgmMood('none');
    const c = cue ?? lineCue(text, spoken);
    if (c) playCue(c, 0.9);
    else if (!first.current) playSfx('sfx_cursor', 0.35);
    first.current = false;
    // 쎄한 소리가 울린 줄: 그 줄이 떠 있는 동안 곡이 멎고, 다음 줄로 넘어가면 천천히 돌아온다
    if (c && isEerie(c)) {
      holdHush();
      return releaseHush;
    }
    // 줄(key)이 바뀔 때만 울린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, silent]);
  const lastBlip = useRef(0);
  useEffect(() => {
    if (silent || typed <= 0 || typed >= text.length) return;
    const now = performance.now();
    if (now - lastBlip.current < 62) return;
    lastBlip.current = now;
    playSfx('sfx_text_blip', 0.28, voice);
  }, [typed, text.length, silent, voice]);
}
