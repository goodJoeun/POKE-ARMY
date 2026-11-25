import { ORDERS } from './orders';
import type { SpotId } from '../types';

/**
 * 메인 스토리 「별이 지기 전에」 데이터
 * 설정: docs/lore/ (world · characters · map · story · missions)
 * - 단서(C-xx): 수첩의 「기억의 실마리」에 기록. 하나당 🌟 인간의 기억 +4
 * - 별 조각(★1~7): 다 모아야 마지막 밤 소원을 거둘 수 있다
 * - 꿈: 하루 끝 결산 화면 전에 보는 "별의 언덕" 장면
 */

/**
 * 시작 기억. 상한(100)보다 조금 낮게 둬서, 첫날 밤 첫 조각·첫 꿈으로 되살린 기억이 상한에 막혀 사라지지 않게 한다.
 */
export const MEMORY_START = 90;
/** 하루가 지날 때마다 흐려지는 인간의 기억 (2일차부터) */
export const MEMORY_DECAY = 14;
/** 단서 하나를 찾을 때 되살아나는 기억 */
export const MEMORY_PER_CLUE = 4;
/** 꿈에서 되살아나는 기억 */
export const MEMORY_PER_DREAM = 3;

export interface ClueDef {
  id: string;
  title: string;
  place: string;
  /** 기억의 실마리 문구 */
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
  { id: 'C-09', chapter: 2, title: '부치지 못한 편지', place: '분리수거장', text: '해마다 다른 필체로 "집에 가고 싶다." 그리고 한 장 — "다음에 오는 사람에게. 도서관 안쪽 방을 봐라. — 강"' },
  { id: 'C-10', chapter: 2, title: '잡음 속의 목소리', place: '정비실', text: '"같은 날 밤 쓰러진 청년이 또 한 명…"' },
  { id: 'C-16', chapter: 2, title: '백여덟 개의 돌', place: '분리수거장 구석 돌탑', text: '돌아오지 못한 사람들의 소원이 돌이 되어 쌓였다. 자리는 백여덟, 돌은 백일곱. 비어 있는 한 자리는 "다음에 남는 사람"의 것이다.' },
  { id: 'C-11', chapter: 2, title: '불 꺼진 서가', place: '도서관 (밤)', text: '글자들이 모여 말했다. "별이 지기 전에."' },
  { id: 'C-12', chapter: 3, title: '단체 사진', place: '기록 보관실', text: '해마다 같은 자리에 같은 얼굴. 10년 전 사진 속 이병은 2분대의 말 없는 병장이었다.' },
  { id: 'C-13', chapter: 3, title: '병장의 일기', place: '2생활관', text: '"별 조각 일곱 개… 마지막 밤… 나는 겁이 나서 거두지 못했다."' },
  { id: 'C-17', chapter: 3, title: '2인 1조', place: '탄약고', text: '수불 대장에 기록 없이 빈 상자 하나. 그날 금요일 줄의 두 번째 서명 칸도 비어 있다. 인식표의 이름은 한도윤. 군견은 오늘도 문만 본다.' },
  { id: 'C-14', chapter: 3, title: '진자 자국', place: '탄약고·격납고·부두', text: '잠긴 상자 주변의 둥근 자국. 누군가 별 조각을 숨기고 있었다. 자국은 분리수거장 쓰레기통까지 이어졌다.' },
  { id: 'C-15', chapter: 3, title: '소원을 거둬라', place: '도서관 (밤)', text: '글자들이 끝까지 모였다. "소원을 거둬라."' },
];
export const clueDef = (id: string) => CLUES.find((c) => c.id === id);

export const CHAPTERS: { n: number; title: string; days: [number, number] }[] = [
  { n: 1, title: '눈을 떠 보니', days: [1, 3] },
  { n: 2, title: '이상한 부대', days: [4, 6] },
  { n: 3, title: '별빛을 따라서', days: [7, 9] },
  { n: 4, title: '별이 지기 전에', days: [10, 12] },
];

export interface StoryMission {
  id: string;
  chapter: number;
  title: string;
  /** 퀘스트 창 · 트래커에 보이는 안내 */
  hint: string;
  /** 그날 밤을 놓쳤을 때(다음 날부터)의 안내 */
  hintLate?: string;
  /** 이 날부터 할 수 있다 */
  from: number;
  /** 끝나면 얻는 단서 (완료 판정) */
  clue?: string;
  /** 단서 대신 이 플래그로 완료 판정 (추리 정리 · 보스 · 최종 선택 등) */
  flag?: string;
  /** 먼저 갖고 있어야 하는 단서 (needMin개 이상, 없으면 전부) */
  needClues?: string[];
  needMin?: number;
  /** 지도·월드의 ✨ 표시 위치 (없으면 표시 안 함) */
  spot?: SpotId;
  /** 낮엔 안 되고 그날 밤(22시 이후)부터만 되는 미션 */
  nightFrom?: number;
  /** 놓쳐도 장(章) 완료에 지장 없는 사건 */
  optional?: boolean;
}

/** 스토리 미션 (docs/lore/missions.md) */
export const STORY_MISSIONS: StoryMission[] = [
  { id: 'M-01', chapter: 1, title: '반짝이는 베개', hint: '첫날 밤, 침상에서 잠들기 전', from: 1, clue: 'C-01' },
  { id: 'M-02', chapter: 1, title: '거울 속의 나', hint: '막사 화장실에서 세면하기', from: 2, clue: 'C-02', spot: 'wc1' },
  { id: 'M-03', chapter: 1, title: '생일자 명단', hint: '막사 복도 게시판의 "이번 달 생일자" 보기', from: 3, clue: 'C-03', spot: 'board1' },
  { id: 'M-04', chapter: 1, title: '낡은 책 한 권', hint: '막사 2층 도서관의 관리병 네이티오에게 말 걸기', from: 3, clue: 'C-08', spot: 'library' },
  { id: 'N-01', chapter: 1, title: '안개 너머', hint: '3일차 밤 야간 위병소 근무 때, 위병소 정문 밖으로 나가 보기', from: 3, nightFrom: 3, clue: 'C-04', spot: 'gate' },
  // ── 2장 「이상한 부대」 (4~6일차)
  { id: 'M-05', chapter: 2, title: '보낸 날짜가 없는 편지', hint: '막사 2층 싸지방에서 인터넷 편지 확인 (점심·개인정비 시간)', from: 4, clue: 'C-05', spot: 'cyber' },
  { id: 'M-06', chapter: 2, title: '낯선 명찰', hint: '동기에게 "같이 빨래하러 가자"고 말 걸기 (점심·개인정비 시간)', from: 4, clue: 'C-06' },
  { id: 'M-07', chapter: 2, title: '멈춘 시계', hint: '막사 1층 지휘통제실 상황판에서 근무 일지 보기', from: 5, clue: 'C-07', spot: 'command' },
  { id: 'D-01', chapter: 2, title: '추리 정리 1 「우리는 왜?」', hint: '19:00~21:20, 동기에게 "남아서 같이 정리하자" → 체단실', from: 5, flag: 'd01', needClues: ['C-01', 'C-02', 'C-03', 'C-05'] },
  { id: 'N-02', chapter: 2, title: '불 꺼진 서가', hint: '5일차 밤 순찰 때 2층 복도 게시판을 조사해 ‘손전등 끄기’ 선택 (L)', hintLate: '도서관 관리병 네이티오에게 "밤의 서가"에 대해 묻기', from: 5, nightFrom: 5, clue: 'C-11', spot: 'board2' },
  { id: 'M-08', chapter: 2, title: '부치지 못한 편지', hint: '분리수거장에서 분리수거하기', from: 6, clue: 'C-09', spot: 'recycle' },
  { id: 'M-09', chapter: 2, title: '잡음 속의 목소리', hint: '막사 1층 정비실 구석의 라디오 켜기', from: 6, clue: 'C-10', spot: 'maint' },
  // 서브: 분리수거장 구석의 돌탑과 화강돌 (부치지 못한 편지를 읽은 뒤부터 · 놓쳐도 장 완료에 지장 없음)
  { id: 'S-01', chapter: 2, title: '백여덟 개의 돌', hint: '분리수거장 구석의 이끼 낀 돌탑 살펴보기 (점심·개인정비 시간)', from: 6, clue: 'C-16', needClues: ['C-09'], spot: 'cairn', optional: true },
  // ── 3장 「별빛을 따라서」 (7~9일차)
  { id: 'M-10', chapter: 3, title: '서고의 열쇠', hint: '기록 보관실 열쇠로 도서관 안쪽 방 열기 (열쇠: 진급 신고 때 중대장 / 행정반 루브도)', from: 7, clue: 'C-12', needClues: ['C-09'], spot: 'library' },
  { id: 'N-03', chapter: 3, title: '똑딱, 똑딱', hint: '7일차 밤 위병소 근무 가는 길, 막사 1층 복도', from: 7, nightFrom: 7, flag: 'n03', optional: true },
  { id: 'M-11', chapter: 3, title: '말 없는 병장', hint: '2생활관의 말 없는 병장에게 단체 사진 보여 드리기', from: 8, clue: 'C-13', needClues: ['C-12'] },
  { id: 'D-02', chapter: 3, title: '추리 정리 2 「돌아가지 못한 사람들」', hint: '19:00~21:20, 막사 2층 계단 옆 옥상 철문 → 동기와 별 보기', from: 8, flag: 'd02', needClues: ['C-07', 'C-09', 'C-13'] },
  // 서브: 탄약고 안의 수불 대장과 군견 하데리어 (놓쳐도 장 완료에 지장 없음)
  { id: 'S-02', chapter: 3, title: '2인 1조', hint: '탄약고(위병소 구역) 안 책상의 수불 대장 살펴보기 (점심·개인정비 시간)', from: 7, clue: 'C-17', spot: 'ammoledger', optional: true },
  { id: 'M-12', chapter: 3, title: '진자 자국', hint: `${'탄약고·격납고·부두'}의 잠긴 상자 살펴보기 → 자국 따라가기`, from: 9, clue: 'C-14', spot: 'ammo' },
  { id: 'N-04', chapter: 3, title: '소원을 거둬라', hint: '9일차 밤 순찰 때 2층 휴게실 TV를 조사해 ‘손전등 끄기’ 선택 (L)', hintLate: '도서관 관리병 네이티오에게 말 걸기', from: 9, nightFrom: 9, clue: 'C-15', spot: 'tv' },
  // ── 4장 「별이 지기 전에」 (10~12일차)
  { id: 'M-13', chapter: 4, title: '잊혀 가는 이름', hint: '동기와 함께 행정반 분실물함 → 싸지방 → 농구장 → 막사 옥상 (점심·개인정비 시간)', from: 10, flag: 'buddyBack' },
  { id: 'D-03', chapter: 4, title: '추리 정리 3 「돌아가는 방법」', hint: '19:00~21:20, 막사 옥상에서 동기와', from: 10, flag: 'd03', needClues: ['C-11', 'C-13', 'C-14', 'C-15'] },
  { id: 'B-01', chapter: 4, title: '꿈을 먹는 자', hint: '11일차 밤 야간 위병소 근무, 초소에서', from: 11, nightFrom: 11, flag: 'b01' },
  { id: 'F-01', chapter: 4, title: '별이 지기 전에', hint: '전역일, 연병장 구령대에 내려온 별에게', from: 12, flag: 'f01', spot: 'parade' },
];

export type MissionState = 'done' | 'open' | 'locked' | 'missed';
export interface StoryProgress { day: number; minute: number; clues: string[]; flags: Record<string, boolean> }
export const missionDone = (m: StoryMission, s: { clues: string[]; flags: Record<string, boolean> }) =>
  (m.clue ? s.clues.includes(m.clue) : false) || (m.flag ? !!s.flags[m.flag] : false);
export function cluesMet(m: StoryMission, clues: string[]): boolean {
  if (!m.needClues) return true;
  const have = m.needClues.filter((c) => clues.includes(c)).length;
  return have >= (m.needMin ?? m.needClues.length);
}
export function missionState(m: StoryMission, s: StoryProgress): MissionState {
  if (missionDone(m, s)) return 'done';
  if (s.day < m.from) return 'locked';
  if (m.nightFrom && s.day === m.nightFrom && s.minute < 22 * 60) return 'locked';
  // 그날 밤에만 있는 사건 (놓치면 대체 경로가 없는 것)
  if (m.optional && m.nightFrom && s.day > m.nightFrom) return 'missed';
  if (m.id === 'B-01' && s.day > 11) return 'missed';
  if (!cluesMet(m, s.clues)) return 'locked';
  return 'open';
}
/** 안내 문구 (밤 미션을 놓쳤으면 대체 경로) */
export const missionHint = (m: StoryMission, s: { day: number; flags?: Record<string, boolean> }) =>
  s.flags && needsOrder(m, { flags: s.flags })
    ? '점심·저녁 자유 시간에 임무를 맡길 사람의 호출을 기다리자'
    : m.hintLate && m.nightFrom && s.day > m.nightFrom ? m.hintLate : m.hint;
/** 누군가의 명령으로 가는 임무인데, 아직 그 명령을 받지 못했다 (받기 전에는 그 자리에 가도 문제를 풀 수 없다) */
export const needsOrder = (m: StoryMission, s: { flags: Record<string, boolean> }) => !!ORDERS[m.id] && !s.flags[`order_${m.id}`];
/** 지금 실제로 할 수 있는 미션: 열려 있고, 명령이 필요한 일이면 그 명령을 받았다 */
export const missionReady = (m: StoryMission, s: StoryProgress) => missionState(m, s) === 'open' && !needsOrder(m, s);
/** 지금 할 수 있는 다음 스토리 미션 (트래커용) */
export function nextStoryMission(s: StoryProgress): StoryMission | null {
  // 서브(낮에 아무 때나 할 수 있는 선택 미션)는 메인 미션이 없을 때만 트래커에 올린다
  const side = (m: StoryMission) => !!m.optional && !m.nightFrom;
  const open = STORY_MISSIONS.filter((m) => missionState(m, s) === 'open');
  return open.find((m) => !side(m)) ?? open[0] ?? null;
}
export function chapterDone(n: number, s: { clues: string[]; flags: Record<string, boolean> }): boolean {
  const ms = STORY_MISSIONS.filter((m) => m.chapter === n && !m.optional);
  return ms.length > 0 && ms.every((m) => missionDone(m, s));
}

// ───────── 엔딩 ─────────
export type StoryEnding = 'true' | 'normal' | 'bad';
/** 마지막 밤 선택 → 엔딩. 남겠다 · 별 조각 7개 미만 · 기억 0 이면 배드 */
export function storyEnding(s: { stars: number[]; memory: number; flags: Record<string, boolean> }, giveBack: boolean): StoryEnding {
  if (!giveBack || s.stars.length < 7 || s.memory <= 0) return 'bad';
  return s.flags.buddyBack ? 'true' : 'normal';
}
/** 진 엔딩에서 말 없는 병장도 함께 돌아가는지 */
export const sergeantJoins = (s: { clues: string[]; memory: number }) => s.clues.includes('C-13') && s.memory >= 60;

// ───────── 꿈: 별의 언덕 ─────────
export type DreamWho = 'narr' | 'voice' | 'mom' | 'me' | 'jirachi';
export interface DreamLine {
  who: DreamWho;
  text: string;
  /** 빛이 모습을 드러내는 연출: gather 빛이 한 점으로 모인다 → flash 눈부시게 터진다 → reveal 그 자리에 지라치가 떠 있다 (이 줄부터 지라치가 보인다) */
  fx?: 'gather' | 'flash' | 'reveal';
}
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
      { who: 'voice', text: '아, 하나만. 여기 사람들한테 "왜 여기 있냐"고는 묻지 마. 다들 대답을 못 해.' },
      { who: 'voice', text: '대답을 못 하는데도 웃고 있을 거야. …그게 이 부대야.' },
      { who: 'voice', text: '…졸려. 내일 또 와.' },
      { who: 'narr', text: '[수첩(Tab)에 🔍 기억의 실마리 탭이 생겼다. 부대 곳곳에서 단서를 찾아보자. 인간이었던 기억(🌟)은 매일 조금씩 흐려진다.]' },
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
      { who: 'me', text: '내가 빌었다고? 난 그냥… 가기 싫다고 했을 뿐인데.' },
      { who: 'voice', text: '응. 그게 소원이야. 별은 말한 그대로만 들어.' },
      { who: 'voice', text: '네 이름이 적힌 데가 한 군데 더 있어. 다들 지나치기만 하는 벽을 잘 봐.' },
    ],
  },
  3: {
    hill: [
      { who: 'narr', text: '언덕 위로 별똥별 하나가 길게 꼬리를 끈다.' },
      { who: 'voice', text: '넌 이제 겨우 첫 장을 넘겼어.' },
      { who: 'voice', text: '안개 너머로는 못 가. 아직은.' },
      { who: 'me', text: '안개 너머엔 뭐가 있는데?' },
      { who: 'voice', text: '아무것도. 소원에 그려 넣지 않은 곳은, 없는 곳이야.' },
      { who: 'voice', text: '…내일부턴 더 이상한 일이 생길 거야. 겁먹지 마.' },
      { who: 'voice', text: '떠나는 사람을 잘 봐 둬. 그리고 다음 날, 누가 그 사람을 기억하는지도.' },
    ],
  },
  4: {
    hill: [
      { who: 'narr', text: '언덕 아래로 하얀 병실 불빛이 아른거린다.' },
      { who: 'voice', text: '현실의 너도 꿈을 꾸고 있어. 엄마 손을 잡고.' },
      { who: 'me', text: '…엄마가 옆에 있는 거야?' },
      { who: 'voice', text: '응. 계속. …그러니까 잊지 마.' },
      { who: 'voice', text: '여기랑 거기는 시간이 다르게 흘러. 여기의 며칠이 거기선 몇 시간이야.' },
      { who: 'voice', text: '자정의 시계를 잘 봐. 1분이 비는 건… 내가 한 일이 아니야.' },
    ],
  },
  5: {
    hill: [
      { who: 'narr', text: '오늘은 언덕에 발자국이 둘이다.' },
      { who: 'voice', text: '친구가 생겼네. 다행이다.' },
      { who: 'voice', text: '혼자 끌려온 줄 알았지? 같은 밤에, 같은 별을 본 애가 있었어.' },
      { who: 'me', text: '…그 애도 돌아갈 수 있어?' },
      { who: 'voice', text: '돌아가려면 자기 이름을 알아야 해. 여기선 이름부터 잊거든.' },
      { who: 'voice', text: '그다음엔 왜 돌아가야 하는지를 잊어. …옆에서 자꾸 불러 줘.' },
    ],
  },
  6: {
    hill: [
      { who: 'narr', text: '바람에 종이 몇 장이 날아간다. 전부 같은 글씨다.' },
      { who: 'voice', text: '돌아가지 못한 사람들의 편지, 읽었어? …나도 읽었어.' },
      { who: 'voice', text: '다들 집에 가고 싶어 했어. 그런데 마지막 밤엔… 아무 말도 못 했어.' },
      { who: 'me', text: '왜 못 했는데?' },
      { who: 'voice', text: '그 밤에 누가 찾아왔거든. 똑딱, 똑딱 소리를 내면서.' },
      { who: 'voice', text: '겁을 주진 않아. 아주 다정하게 물어. "여기 있으면 편하잖아" 하고.' },
    ],
  },
  7: {
    hill: [
      { who: 'narr', text: '어디선가 똑딱, 똑딱… 시계추 소리가 들린다.' },
      { who: 'voice', text: '똑딱 소리를 조심해. 꿈을 좋아하는 아이가 있어.' },
      { who: 'voice', text: '그 아이는 네가 여기 계속 있기를 바라. 꿈이 맛있거든.' },
      { who: 'voice', text: '그 아이가 못 건드리는 게 하나 있어. 네가 직접 붙잡고 있는 이름.' },
      { who: 'voice', text: '그리고 거울 속의 그림자. 그건 그 아이 편이 아니야. 네 편도 아니지만.' },
      { who: 'me', text: '(…내 편이 아닌 게 둘이라는 거네.)' },
    ],
  },
  8: {
    hill: [
      { who: 'narr', text: '별이 어제보다 크다. 낮아졌다.' },
      { who: 'voice', text: '겁이 나는 건 이상한 게 아니야.' },
      { who: 'voice', text: '그 병장도 겁이 났던 거야. 너만 그런 게 아니야.' },
      { who: 'me', text: '그분은… 여기 얼마나 있었던 거야?' },
      { who: 'voice', text: '별이 열 번 졌어. 그 사람은 열 번 다 "다음에"라고 했어.' },
      { who: 'voice', text: '…너는 몇 번째에 대답할 거야?' },
    ],
  },
  9: {
    hill: [
      { who: 'narr', text: '언덕 위 창문이 이제 손바닥만 하게 보인다.' },
      { who: 'voice', text: '이제 반. 나머지 반은 네 마음.' },
      { who: 'me', text: '내 마음이 반이라니, 무슨 뜻이야.' },
      { who: 'voice', text: '조각을 다 모아도 내가 대신 골라 주진 못해. 지난번에 내가 골랐다가 이렇게 됐잖아.' },
      { who: 'voice', text: '그리고 곧, 네 옆자리가 조금 낯설어 보일 거야. 놀라지 마. 아직 늦지 않았어.' },
    ],
  },
  10: {
    hill: [
      { who: 'narr', text: '언덕에 이름 모를 꽃이 피었다가, 금세 진다.' },
      { who: 'voice', text: '잊는 건 무서워. 그래도 다시 기억해 낼 수 있어.' },
      { who: 'voice', text: '네 친구도. …너도.' },
      { who: 'voice', text: '내일 밤엔 그 아이가 올 거야. 네가 혼자 깨어 있는 곳으로.' },
      { who: 'voice', text: '졸리면 지는 거야. 그 아이의 추는 "편한 것"만 보여 주거든.' },
      { who: 'me', text: '(편한 것. …여기가 편하긴 했다.)' },
    ],
  },
  11: {
    hill: [
      { who: 'narr', text: '오늘은 빛이 평소보다 가깝다. 손을 뻗으면 닿을 것 같다.' },
      { who: 'voice', text: '…열한 번째 밤이네. 이제 숨어 있을 필요가 없겠지.' },
      { who: 'me', text: '숨어 있었다고? 너, 계속 거기 있었던 거야?' },
      { who: 'voice', text: '응. 처음부터. …눈 감지 마. 한 번만 보여 줄 거니까.' },
      { who: 'narr', text: '빛이 안쪽으로 접힌다. 한 겹, 또 한 겹. 언덕의 별빛이 전부 그 한 점으로 빨려 들어간다.', fx: 'gather' },
      { who: 'narr', text: '눈을 뜰 수 없을 만큼 환해졌다가 —', fx: 'flash' },
      { who: 'narr', text: '빛이 있던 자리에 작은 포켓몬이 떠 있다. 별 모양 머리, 소원 쪽지처럼 늘어진 세 장의 띠, 그리고 졸린 눈.', fx: 'reveal' },
      { who: 'me', text: '(…별이다. 그날 밤 창밖으로 떨어지던, 그 별.)' },
      { who: 'jirachi', text: '…안녕. 이 모습으로는 처음이지.' },
      { who: 'jirachi', text: '나는 지라치. 네 소원을 들어준 별이야.' },
      { who: 'jirachi', text: '미안해. 가기 싫다길래, 대신 가게 해 주면 될 줄 알았어.' },
      { who: 'jirachi', text: '돌아가면 여기 일은 꿈처럼 흐려질 거야. 남으면, 거기 일이 흐려지고.' },
      { who: 'jirachi', text: '어느 쪽이든 하나는 놓아야 해. 이번엔 내가 아니라, 네 입으로 말해 줘.' },
      { who: 'jirachi', text: '내일, 별이 져. 그때 다시 물어볼게.' },
    ],
  },
};
/** 기억이 30 이하인 밤엔 꿈이 흐려진다 */
export const DREAM_FADED: DreamLine[] = [
  { who: 'narr', text: '언덕이 뿌옇다. 별빛도, 창문도 잘 보이지 않는다…' },
  { who: 'voice', text: '…들려? …기억해…' },
];
/**
 * 야간 근무 중 만나는 의문의 별빛 (지라치). 근무가 있는 밤(불침번 2·4·6·8·10일 / 위병소 3·7·11일)마다 한마디.
 * 꿈속 "빛"과 같은 목소리지만, 깨어 있을 때는 짧게만 말한다.
 */
export const NIGHT_STAR_LINES: Record<number, string[]> = {
  2: ['…쉿. 다들 자고 있어. 깨어 있는 건 너뿐이네.', '난 별이 지기 전에만 보이는 빛이야. 놀라지 마.', '거울 봤지? …괜찮아. 아직은 네 이름을 기억하잖아, {me}.'],
  3: ['추운 밤이네. 초소 불빛 말고… 저기 안개 쪽은 보지 마.', '거긴 아직 네가 갈 곳이 아니야.', '사수 옆에 꼭 붙어 있어. 혼자가 되면… 잊어버리기 쉬우니까.'],
  4: ['네 번째 밤. 소원은 밤마다 조금씩 무거워져.', '…도서관의 그 새. 나를 알고 있을지도 몰라.'],
  6: ['다들 꿈을 꾸고 있어. 포켓몬의 꿈을.', '너는 무슨 꿈을 꾸고 싶어? 사람의 꿈? 포켓몬의 꿈?'],
  7: ['또 만났네. 위병소의 밤은 길지?', '별 조각은 일곱 개. 다 모으면… 소원 하나를 되돌릴 수 있어.', '…하지만 되돌린다는 건, 여기를 잊는다는 뜻이기도 해.'],
  8: ['네 동기도 가끔 창밖을 봐. 너처럼.', '같은 밤에 빈 소원은 서로 닮아 있대.'],
  10: ['별이 많이 기울었어. 시간이 얼마 안 남았어.', '네가 여기서 만든 기억도… 진짜야. 그걸 잊지 마.'],
  11: ['마지막 위병소 근무구나.', '안개가 옅어지고 있어. 곧 문이 열릴 거야.', '그때 네가 고르는 거야. 돌아갈지, 남을지.'],
};

/** 오늘 밤 꿈을 꿔야 하는지 */
export function dreamPending(s: { day: number; flags: Record<string, boolean> }): boolean {
  return !!DREAMS[s.day] && !s.flags[`dream_${s.day}`];
}
