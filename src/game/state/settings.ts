'use client';
import { create } from 'zustand';

/** 게임 설정 (세이브 데이터와 별도로 브라우저에 저장) */
export interface Settings {
  /** 대사 출력 속도 */
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  /** 화면 흔들림 연출 */
  screenShake: boolean;
  /** 대화 후 군대 상식 카드 표시 (끄더라도 수첩에는 모인다) */
  showTips: boolean;
  /** 부대 맵 확대 배율 (마우스 휠로 조절, 1 = 기본) */
  mapZoom: number;
  /** 테스터 모드: F9(또는 `)로 진행 중인 미션을 즉시 종료 */
  testerMode: boolean;
  /** 배경음악 음량 (0~100, 0 = 끔) */
  bgmVolume: number;
  /** 효과음·징글 음량 (0~100, 0 = 끔) */
  sfxVolume: number;
  /** 시제품: 실내 맵을 그림 파일(타일셋)로 그린다. 끄면 기존처럼 코드로 그린다 */
  tilesetProto: boolean;
  /** 📱 안드로이드: 페이지를 열고 처음 화면을 누를 때 전체 화면으로 (engine/fullscreen.ts) */
  autoFullscreen: boolean;
}

export const MAP_ZOOM_MIN = 0.6;
export const MAP_ZOOM_MAX = 1.8;
export const clampMapZoom = (v: number) => Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, Math.round(v * 100) / 100));

/**
 * 도트가 고르게 보이는 확대 단계의 간격 (mapZoom 단위).
 * 부대 맵은 도트 한 칸이 화면 픽셀 정수 개가 되는 배율로만 그리므로, 그 간격을 화면 크기에 맞춰 여기에 알려 둔다.
 */
let mapZoomUnit = 0;
export const setMapZoomUnit = (u: number) => { mapZoomUnit = u; };
/** 한 단계 확대(+1) · 축소(-1)한 mapZoom. 단계 간격을 아직 모르면(맵을 띄우기 전) 10%씩 */
export function stepMapZoom(cur: number, dir: 1 | -1): number {
  if (!(mapZoomUnit > 0)) return clampMapZoom(cur * (dir > 0 ? 1.1 : 1 / 1.1));
  return clampMapZoom(Math.max(1, Math.round(cur / mapZoomUnit) + dir) * mapZoomUnit);
}

export const DEFAULT_SETTINGS: Settings = {
  textSpeed: 'normal',
  screenShake: true,
  showTips: true,
  mapZoom: 1,
  testerMode: false,
  bgmVolume: 60,
  sfxVolume: 70,
  tilesetProto: true,
  autoFullscreen: true,
};

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
      textSpeed: s.textSpeed,
      screenShake: s.screenShake, showTips: s.showTips, mapZoom: s.mapZoom,
      testerMode: s.testerMode, bgmVolume: s.bgmVolume, sfxVolume: s.sfxVolume,
      tilesetProto: s.tilesetProto, autoFullscreen: s.autoFullscreen,
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
