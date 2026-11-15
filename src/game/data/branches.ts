import type { BranchId, GameId, Season } from '../types';

export const TOTAL_DAYS = 12; // 압축된 복무 기간 (1일 ≈ 1.5개월)
export const DAYS_PER_RANK = 3;
export const RANKS = ['이병', '일병', '상병', '병장'] as const;

export interface BranchInfo {
  id: BranchId;
  name: string;
  type: string;
  typeColor: string;
  salute: string;
  months: number;
  unit: string;
  trainArea: string;
  tagline: string;
  cap: 'army' | 'navy' | 'air';
  games: Record<Exclude<GameId, 'overlock'>, string>;
  skillName: string;
  skillDesc: string;
  wildlife: string;
  /** 입영통지서의 입영 부대 */
  noticePlace: string;
  /** 통지서를 보고 떠올리는 밀덕 주인공의 기억 */
  recall: string[];
  cptTitle: string;
  sgmTitle: string;
}

export const BRANCHES: Record<BranchId, BranchInfo> = {
  army: {
    id: 'army',
    name: '육군',
    type: '불꽃',
    typeColor: '#e0603a',
    salute: '충성',
    months: 18,
    unit: '제77보병사단 불꽃연대',
    trainArea: '사격장',
    tagline: '땅을 지키는 뜨거운 심장',
    cap: 'army',
    games: {
      env: '환경정리',
      night: '불침번 근무',
      combat: '전투준비태세',
      guard: '위병소 경계근무',
      specialty: '주특기: 사격 훈련',
      sandbag: '진지 구축',
    },
    skillName: '불꽃 기술',
    skillDesc: '뜨거운 불꽃으로 눈을 녹이고, 집중력을 끌어올린다.',
    wildlife: '야생 꼬렛',
    noticePlace: '육군훈련소 (논산)',
    recall: [
      '맞다, 육군이었지. 논산 육군훈련소.',
      '경례 구호는 "충성!", 복무 기간 18개월. 유튜브에서 수백 번 본 그 연병장이다.',
    ],
    cptTitle: '중대장',
    sgmTitle: '행정보급관',
  },
  navy: {
    id: 'navy',
    name: '해군',
    type: '물',
    typeColor: '#3a8fe0',
    salute: '필승',
    months: 20,
    unit: '제9함대 물결전대',
    trainArea: '부두',
    tagline: '바다를 지키는 푸른 파도',
    cap: 'navy',
    games: {
      env: '갑판·부두 환경정리',
      night: '불침번 근무',
      combat: '전투배치 훈련',
      guard: '현문 당직',
      specialty: '주특기: 손상통제 훈련',
      sandbag: '태풍 대비 방호벽 쌓기',
    },
    skillName: '물 기술',
    skillDesc: '물줄기를 다루고, 넘치는 물을 흡수한다.',
    wildlife: '야생 갈모매',
    noticePlace: '해군 교육사령부 (진해)',
    recall: [
      '맞다, 해군이었지. 진해 해군 교육사령부.',
      '경례 구호는 "필승!", 복무 기간 20개월. 벌써부터 바다 냄새가 나는 것 같다.',
    ],
    cptTitle: '부서장',
    sgmTitle: '주임원사',
  },
  air: {
    id: 'air',
    name: '공군',
    type: '비행',
    typeColor: '#5aa9a0',
    salute: '필승',
    months: 21,
    unit: '제99전투비행단 바람대대',
    trainArea: '활주로',
    tagline: '하늘을 지키는 날카로운 눈',
    cap: 'air',
    games: {
      env: '활주로 주변 환경정리',
      night: '불침번 근무',
      combat: '비상대기 전투준비',
      guard: '기지 초소 경계근무',
      specialty: '주특기: FOD 워크다운',
      sandbag: '방호진지 보수',
    },
    skillName: '바람 기술',
    skillDesc: '날갯짓으로 돌풍을 일으키고, 하늘에서 넓게 내려다본다.',
    wildlife: '야생 나옹',
    noticePlace: '공군 교육사령부 (진주)',
    recall: [
      '맞다, 공군이었지. 진주 공군 교육사령부.',
      '경례 구호는 "필승!", 복무 기간 21개월… 길지만, 하늘을 지키는 거니까.',
    ],
    cptTitle: '중대장',
    sgmTitle: '주임원사',
  },
};

export function rankIdxForDay(day: number, offset = 0): number {
  return Math.max(0, Math.min(3, Math.floor((day - 1 + offset) / DAYS_PER_RANK)));
}

export function seasonForDay(day: number): Season {
  if (day <= 3) return 'winter';
  if (day <= 6) return 'spring';
  if (day <= 9) return 'summer';
  if (day <= 11) return 'autumn';
  return 'winter';
}

export const SEASON_LABEL: Record<Season, string> = {
  winter: '❄️ 겨울',
  spring: '🌸 봄',
  summer: '☀️ 여름',
  autumn: '🍂 가을',
};

export function serviceMonth(day: number, branch: BranchId): number {
  const months = BRANCHES[branch].months;
  return Math.min(months, Math.max(1, Math.round(((day - 1) / (TOTAL_DAYS - 1)) * (months - 1)) + 1));
}

/** 2025년 기준 병 봉급 (원) */
export const MONTHLY_PAY = [750000, 900000, 1200000, 1500000];

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

/** 위병소 옆 군별 핵심 시설: 육군 탄약고 / 공군 격납고 / 해군 함정 부두 */
export const FACILITY_NAME: Record<BranchId, string> = { army: '탄약고', navy: '함정 부두', air: '격납고' };
/** 부대 매점 이름: 공군은 BX(Base Exchange) */
export const STORE_NAME: Record<BranchId, string> = { army: 'PX', navy: 'PX', air: 'BX' };
