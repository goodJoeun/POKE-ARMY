import type { SpotId } from '../types';

/**
 * 메인 스토리 「별이 지기 전에」 데이터
 * 설정: docs/lore/ (world · characters · map · story · missions)
 * - 단서(C-xx): 떡밥 수첩에 기록. 하나당 🌟 인간의 기억 +4
 * - 별 조각(★1~7): 다 모아야 마지막 밤 소원을 거둘 수 있다
 * - 꿈: 하루 끝 결산 화면 전에 보는 "별의 언덕" 장면
 */

export const MEMORY_START = 100;
/** 하루가 지날 때마다 흐려지는 인간의 기억 (2일차부터) */
export const MEMORY_DECAY = 8;
/** 단서 하나를 찾을 때 되살아나는 기억 */
export const MEMORY_PER_CLUE = 4;
/** 꿈에서 되살아나는 기억 */
export const MEMORY_PER_DREAM = 3;

export interface ClueDef {
  id: string;
  title: string;
  place: string;
  /** 떡밥 수첩 문구 */
  text: string;
  chapter: 1 | 2 | 3 | 4;
}

export const CLUES: ClueDef[] = [
  { id: 'C-01', chapter: 1, title: '반짝이는 별 조각', place: '1생활관 내 침상', text: '손에 쥐자 엄마 목소리가 들렸다. "…일어나야지, 늦겠다."' },
  { id: 'C-02', chapter: 1, title: '거울 속의 나', place: '막사 화장실', text: '거울 속에 1초 동안, 까까머리 인간이 서 있었다.' },
  { id: 'C-03', chapter: 1, title: '생일자 명단', place: '막사 복도 게시판', text: '명단 맨 아래, 흐린 글씨로 내 이름. 생일 칸엔 "입대일".' },
  { id: 'C-08', chapter: 1, title: '별똥별 부대사', place: '막사 2층 도서관', text: '"천 년에 한 번 별이 깨어날 때, 소원은 부대가 된다." 나머지 페이지는 물에 젖어 있다.' },
  { id: 'C-04', chapter: 1, title: '안개 너머', place: '위병소 정문', text: '정문 밖은 끝없는 안개. 나가도 다시 초소 앞이었다. "…나가지 않아도 돼…"' },
  { id: 'C-05', chapter: 2, title: '보낸 날짜가 없는 편지', place: '싸지방', text: '"아무리 깨워도 안 일어나서 병원에 왔어." 답장이 안 된다.' },
  { id: 'C-06', chapter: 2, title: '낯선 명찰', place: '세탁실', text: '낡은 전투복의 명찰 "이준서". 동기가 이유 없이 울었다.' },
  { id: 'C-07', chapter: 2, title: '멈춘 시계', place: '지휘통제실', text: '자정마다 1분씩 멈추는 시계. "별이 질 때까지 D-7".' },
  { id: 'C-09', chapter: 2, title: '부치지 못한 편지', place: '분리수거장', text: '해마다 다른 필체로 "집에 가고 싶다."' },
  { id: 'C-10', chapter: 2, title: '잡음 속의 목소리', place: '정비실', text: '"같은 날 밤 쓰러진 청년이 또 한 명…"' },
  { id: 'C-11', chapter: 2, title: '불 꺼진 서가', place: '도서관 (밤)', text: '글자들이 모여 말했다. "별이 지기 전에."' },
  { id: 'C-12', chapter: 3, title: '단체 사진', place: '기록 보관실', text: '해마다 같은 자리에 같은 얼굴.' },
  { id: 'C-13', chapter: 3, title: '병장의 일기', place: '2생활관', text: '"별 조각 일곱 개… 마지막 밤… 나는 겁이 나서 거두지 못했다."' },
  { id: 'C-14', chapter: 3, title: '진자 자국', place: '탄약고·격납고·부두', text: '잠긴 상자 주변의 둥근 자국.' },
  { id: 'C-15', chapter: 3, title: '소원을 거둬라', place: '도서관 (밤)', text: '글자들이 끝까지 모였다. "소원을 거둬라."' },
];
export const clueDef = (id: string) => CLUES.find((c) => c.id === id);

export const CHAPTERS: { n: number; title: string; days: [number, number] }[] = [
  { n: 1, title: '눈을 떠 보니', days: [1, 3] },
  { n: 2, title: '이상한 부대', days: [4, 6] },
  { n: 3, title: '떡밥을 따라서', days: [7, 9] },
  { n: 4, title: '별이 지기 전에', days: [10, 12] },
];

export interface StoryMission {
  id: string;
  chapter: number;
  title: string;
  /** 퀘스트 창 · 트래커에 보이는 안내 */
  hint: string;
  /** 이 날부터 할 수 있다 */
  from: number;
  /** 끝나면 얻는 단서 (완료 판정) */
  clue: string;
  /** 지도·월드의 ✨ 표시 위치 (없으면 표시 안 함) */
  spot?: SpotId;
  /** 낮엔 안 되고 그날 밤(22시 이후)부터만 되는 미션 */
  nightFrom?: number;
}

/** 1장 미션 (2~4장은 이후 업데이트) */
export const STORY_MISSIONS: StoryMission[] = [
  { id: 'M-01', chapter: 1, title: '반짝이는 베개', hint: '첫날 밤, 침상에서 잠들기 전', from: 1, clue: 'C-01' },
  { id: 'M-02', chapter: 1, title: '거울 속의 나', hint: '막사 화장실에서 세면하기', from: 2, clue: 'C-02', spot: 'wc1' },
  { id: 'M-03', chapter: 1, title: '생일자 명단', hint: '막사 복도 게시판의 "이번 달 생일자" 보기', from: 3, clue: 'C-03', spot: 'board1' },
  { id: 'M-04', chapter: 1, title: '낡은 책 한 권', hint: '막사 2층 도서관의 관리병 네이티오에게 말 걸기', from: 3, clue: 'C-08', spot: 'library' },
  { id: 'N-01', chapter: 1, title: '안개 너머', hint: '3일차 밤 야간 위병소 근무 때, 위병소 정문 밖으로 나가 보기', from: 3, nightFrom: 3, clue: 'C-04', spot: 'gate' },
];

export type MissionState = 'done' | 'open' | 'locked';
export function missionState(m: StoryMission, s: { day: number; minute: number; clues: string[] }): MissionState {
  if (s.clues.includes(m.clue)) return 'done';
  if (s.day < m.from) return 'locked';
  if (m.nightFrom && s.day === m.nightFrom && s.minute < 22 * 60) return 'locked';
  return 'open';
}
/** 지금 할 수 있는 다음 스토리 미션 (트래커용) */
export function nextStoryMission(s: { day: number; minute: number; clues: string[] }): StoryMission | null {
  return STORY_MISSIONS.find((m) => missionState(m, s) === 'open') ?? null;
}
export function chapterDone(n: number, clues: string[]): boolean {
  const ms = STORY_MISSIONS.filter((m) => m.chapter === n);
  return ms.length > 0 && ms.every((m) => clues.includes(m.clue));
}

// ───────── 꿈: 별의 언덕 ─────────
export type DreamWho = 'narr' | 'voice' | 'mom' | 'me';
export interface DreamLine { who: DreamWho; text: string }
export interface DreamScript {
  /** 처음 몇 줄은 생활관(어두운 방)에서, 그 뒤로 별의 언덕 */
  room?: DreamLine[];
  hill: DreamLine[];
  /** 꿈이 끝나면 얻는 것 */
  clue?: string;
  star?: number;
}

export const DREAMS: Record<number, DreamScript> = {
  1: {
    room: [
      { who: 'narr', text: '소등 직전. 베개 밑에서 뭔가 반짝인다.' },
      { who: 'narr', text: '손톱만 한 별 조각이다. 따뜻하다.' },
      { who: 'narr', text: '쥐는 순간 — 아주 먼 곳에서 목소리가 들렸다.' },
      { who: 'mom', text: '…일어나야지. 늦겠다.' },
      { who: 'me', text: '(…엄마?)' },
      { who: 'narr', text: '눈꺼풀이 무거워진다…' },
    ],
    hill: [
      { who: 'narr', text: '별이 쏟아지는 언덕. 저 멀리… 입대 전날 밤의 내 방 창문이 떠 있다.' },
      { who: 'voice', text: '…찾았구나. 그건 네 별의 조각이야.' },
      { who: 'voice', text: '일곱 개. 별이 지기 전까지야. 기억해.' },
      { who: 'me', text: '잠깐, 너는 누구야? 여긴 어디야?!' },
      { who: 'voice', text: '…졸려. 내일 또 와.' },
      { who: 'narr', text: '[떡밥 수첩(Tab)에 🔍 단서 탭이 생겼다. 부대 곳곳에서 단서를 찾아보자. 인간이었던 기억(🌟)은 매일 조금씩 흐려진다.]' },
    ],
    clue: 'C-01',
    star: 1,
  },
  2: {
    hill: [
      { who: 'narr', text: '다시 별의 언덕. 창문이 어제보다 조금 멀어 보인다.' },
      { who: 'voice', text: '거울은 거짓말을 못 해. 너도 알잖아.' },
      { who: 'me', text: '너 대체 누구야. 왜 나한테 이러는 건데?' },
      { who: 'voice', text: '…네가 빌었잖아. 기억 안 나?' },
    ],
  },
  3: {
    hill: [
      { who: 'narr', text: '언덕 위로 별똥별 하나가 길게 꼬리를 끈다.' },
      { who: 'voice', text: '넌 이제 겨우 첫 장을 넘겼어.' },
      { who: 'voice', text: '안개 너머로는 못 가. 아직은.' },
      { who: 'voice', text: '…내일부턴 더 이상한 일이 생길 거야. 겁먹지 마.' },
    ],
  },
};
/** 오늘 밤 꿈을 꿔야 하는지 */
export function dreamPending(s: { day: number; flags: Record<string, boolean> }): boolean {
  return !!DREAMS[s.day] && !s.flags[`dream_${s.day}`];
}
