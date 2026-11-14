'use client';
import { create } from 'zustand';

/** 게임 설정 (세이브 데이터와 별도로 브라우저에 저장) */
export interface Settings {
  /** 게임 시간 흐름 속도 */
  timeSpeed: 'slow' | 'normal' | 'fast';
  /** 대사 출력 속도 */
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  /** 집합 허용 시간 (지각 판정) */
  gatherWindow: 'relaxed' | 'normal' | 'strict';
  /** 미니게임 난이도 (점수 보정) */
  difficulty: 'easy' | 'normal' | 'hard';
  /** 화면 흔들림 연출 */
  screenShake: boolean;
  /** 대화 후 군대 상식 카드 표시 (끄더라도 수첩에는 모인다) */
  showTips: boolean;
  /** 부대 맵 확대 배율 (마우스 휠로 조절, 1 = 기본) */
  mapZoom: number;
}

export const MAP_ZOOM_MIN = 0.6;
export const MAP_ZOOM_MAX = 1.8;
export const clampMapZoom = (v: number) => Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, Math.round(v * 100) / 100));

export const DEFAULT_SETTINGS: Settings = {
  timeSpeed: 'normal',
  textSpeed: 'normal',
  gatherWindow: 'normal',
  difficulty: 'normal',
  screenShake: true,
  showTips: true,
  mapZoom: 1,
};

/** 실제 시간으로 게임 1분이 흐르는 데 걸리는 시간(ms) */
export const MS_PER_MINUTE: Record<Settings['timeSpeed'], number> = { slow: 600, normal: 400, fast: 250 };
/** 집합 허용 시간(게임 분) */
export const GATHER_MINUTES: Record<Settings['gatherWindow'], number> = { relaxed: 30, normal: 20, strict: 15 };
/** 미니게임 점수 배율 */
export const DIFFICULTY_MUL: Record<Settings['difficulty'], number> = { easy: 1.15, normal: 1, hard: 0.9 };
/** 대사 타자 속도: [간격 ms, 한 번에 나오는 글자 수] */
export const TEXT_SPEED: Record<Settings['textSpeed'], [number, number]> = {
  slow: [35, 1], normal: [18, 2], fast: [12, 4], instant: [0, 9999],
};

const KEY = 'poke-army-settings-v1';

function loadSettings(): Settings {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* 저장 불가 환경 */ }
  return { ...DEFAULT_SETTINGS };
}

interface SettingsStore extends Settings {
  /** 설정 창 열림 여부 (UI 상태, 저장 안 함) */
  open: boolean;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
  openMenu: () => void;
  closeMenu: () => void;
}

function persist(s: Settings) {
  try {
    const data: Settings = {
      timeSpeed: s.timeSpeed, textSpeed: s.textSpeed, gatherWindow: s.gatherWindow,
      difficulty: s.difficulty, screenShake: s.screenShake, showTips: s.showTips, mapZoom: s.mapZoom,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* noop */ }
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...loadSettings(),
  open: false,
  set: (key, value) => {
    set({ [key]: value } as Partial<SettingsStore>);
    persist(get());
  },
  reset: () => {
    set({ ...DEFAULT_SETTINGS });
    persist(get());
  },
  openMenu: () => set({ open: true }),
  closeMenu: () => set({ open: false }),
}));
