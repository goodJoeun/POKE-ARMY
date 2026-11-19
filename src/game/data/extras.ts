import type { BranchId, Effects, MonsterLook } from '../types';
import type { MapId } from '../engine/map';

/**
 * 부대 엑스트라: 호감도·퀘스트 없이 부대를 채우는 등장인물.
 * 자기 자리를 지키거나(wander) 정해진 길을 돌며(route), 말을 걸면 짧은 대사를 한다.
 * 일부는 하루 한 번 작은 도움(daily)을 준다.
 */
export interface ExtraDef {
  id: string;
  /** 포켓몬 키 (스프라이트) */
  sprite: string;
  /** 포켓몬 이름 (호칭) */
  name: string;
  /** 직책 + 계급 */
  title: string;
  map: MapId;
  x: number;
  y: number;
  /** 집 주변을 돌아다니는 반경(타일). 0이면 제자리 */
  wander?: number;
  /** 같은 맵 안에서 순서대로 도는 지점들 */
  route?: [number, number][];
  /** 이미지가 없을 때 그리는 몸 색 */
  color: string;
  officer?: boolean;
  /** 군견 등: 모자 없음 */
  noCap?: boolean;
  lines: string[];
  daily?: { label: string; hint: string; effects: Effects; text: string };
  /** 이 날짜부터는 없다 (전역 등) */
  until?: number;
  /** 이 날짜부터 있다 (전입·스토리 등장) */
  from?: number;
  /** 1분대 선임 */
  squad1Senior?: boolean;
}

/** 엑스트라 외형: 포켓몬 스프라이트, 없으면 단색 몬스터 */
export function extraLook(def: ExtraDef): MonsterLook {
  return { sprite: def.sprite, body: def.color, belly: '#f2ead8', accent: def.color, shape: 'round', ears: 'none', tail: 'none', eyes: 'dot', mouth: 'smile' };
}

/** 그날 부대에 있는 엑스트라 */
export function extrasForDay(branch: BranchId, day: number): ExtraDef[] {
  return EXTRAS[branch].filter((d) => (!d.until || day < d.until) && (!d.from || day >= d.from));
}

const MEDIC_DAILY = {
  label: '컨디션 체크 받기', hint: '1일 1회',
  effects: { hp: 8, mental: 2 },
  text: '"의무대에 어서 오세요! 체력을 회복시켜 드릴까요?" …♪ 띠리리링~ "건강해졌습니다! 또 오세요!"',
};
const DOG_DAILY = {
  label: '쓰다듬기', hint: '1일 1회',
  effects: { mental: 4 },
  text: '군견이 꼬리를 세차게 흔든다. 마음이 사르르 녹는다.',
};

// 지점 메모: 조리실 (5,3) / PX 계산대 옆 (6,2) / 1층 복도 (10,3) / 지통실 (8,4) / 행정반 (8,4)
//          싸지방 (6,2) / 2생활관 (12,5) / 휴게실 (8,6) / 체단실 (6,6) / 위병소 구역 (16,26) / 탄약고 구역 (9,19) / 연병장 둘레 길
const PARADE_LAP: [number, number][] = [[12, 19], [28, 19], [28, 28], [12, 28]];

export const EXTRAS: Record<BranchId, ExtraDef[]> = {
  army: [
    { id: 'cook', sprite: 'snorlax', name: '잠만보', title: '취사병 상병', map: 'kitchen', x: 5, y: 3, wander: 2, color: '#3a5a6a',
      lines: ['오늘 메뉴는 제육볶음이다. 많이 먹어라!', '짬밥 맛없다는 소리는 우리 식당에선 금지다.', '남기면… 내가 먹는다.', '쿨… 쿨… (잠만보가 조리실 한가운데를 막고 자고 있다. 깨우려면 포켓몬의 피리가 필요할 것 같다.)'] },
    { id: 'px', sprite: 'pachirisu', name: '파치리스', title: 'PX병 일병', map: 'px', x: 6, y: 2, color: '#e8e8f0',
      lines: ['어서 와! 냉동은 3500원, 초코파이는 정(情)이야.', '월급날엔 줄이 엄청 길어. 미리 와.', '신상 냉동 들어왔다! 비밀이다.'] },
    { id: 'medic', sprite: 'chansey', name: '럭키', title: '의무병 상병', map: 'hq1', x: 10, y: 3, wander: 2, color: '#f8b8c8',
      lines: ['아프면 참지 말고 의무대 와라.', '물집 잡히면 터뜨리지 말고 보여줘.', '감기 유행이다. 손 잘 씻어!'], daily: MEDIC_DAILY },
    { id: 'nco', sprite: 'lucario', name: '루카리오', title: '당직부사관 중사', map: 'command', x: 8, y: 4, officer: true, color: '#4a6aa8',
      lines: ['오늘 밤 근무자들 졸지 마라.', '상황판은 함부로 만지지 마라.', '보고는 정확하게, 짧게.'] },
    { id: 'clerk', sprite: 'smeargle', name: '루브도', title: '행정병 상병', map: 'admin', x: 8, y: 4, color: '#f2f2e8',
      lines: ['휴가 신청서는 3일 전까지!', '서류 정리가 군생활의 반이다.', '도장 찍을 거 있으면 줄 서.'] },
    { id: 'guard', sprite: 'machop', name: '알통몬', title: '위병 일병', map: 'depot', x: 16, y: 26, color: '#8a9ab8',
      lines: ['위병소는 부대의 얼굴이다. 복장 단정!', '외출 나가는 날만 기다린다…', '수상한 사람 보면 바로 보고!'] },
    { id: 'runner', sprite: 'ponyta', name: '포니타', title: '2분대 일병', map: 'outdoor', x: 12, y: 19, route: PARADE_LAP, color: '#f8e0a0',
      lines: ['헉헉… 체력검정 특급이 목표다!', '같이 뛸래? 세 바퀴만 더!', '뛰고 나면 밥이 꿀맛이야.'] },
    { id: 'gym', sprite: 'tyrogue', name: '배루키', title: '3분대 이병', map: 'gymroom', x: 6, y: 6, wander: 1, color: '#c8a8b8',
      lines: ['팔굽혀펴기 100개 도전 중!', '턱걸이는 반동 쓰면 안 돼.', '근손실 오기 전에 운동하자.'] },
    { id: 'cyber', sprite: 'porygon', name: '폴리곤', title: '2분대 상병', map: 'cyber', x: 6, y: 2, color: '#f08aa8',
      lines: ['자격증 인강, 3배속으로 듣는 중.', '인터넷 편지 쓰는 법? 여기 누르면 돼.', '전역 전에 정보처리기사 딴다!'] },
    { id: 'room2a', sprite: 'geodude', name: '꼬마돌', title: '2분대 병장', map: 'room2', x: 12, y: 5, wander: 2, color: '#9a8a7a',
      lines: ['우리 2분대는 다음 주 혹한기다…', '1분대 신병이냐? 반갑다.', '말년엔 떨어지는 낙엽도 조심해야 해.', '………… (아무 말이 없다. 눈 덮인 산 정상에서 도전자를 기다리는 누군가 같은 포스가 느껴진다…)'] },
    { id: 'lounge', sprite: 'cubone', name: '탕구리', title: '2분대 일병', map: 'lounge', x: 8, y: 6, wander: 1, color: '#c8a868',
      lines: ['리모컨은 병장님 거다. 건드리지 마.', '이 드라마 다음 화가 휴가 중에 나온대…', '자판기 커피 마실래?'] },
    { id: 'dog', sprite: 'rockruff', name: '암멍이', title: '군견', map: 'depot', x: 9, y: 19, wander: 3, noCap: true, color: '#c89868',
      lines: ['멍! (꼬리를 흔든다)', '킁킁… (내 손 냄새를 맡는다)', '왈! (공을 물고 왔다)'], daily: DOG_DAILY },
  ],
  navy: [
    { id: 'cook', sprite: 'kingler', name: '킹크랩', title: '조리병 상병', map: 'kitchen', x: 5, y: 3, wander: 2, color: '#e86848',
      lines: ['오늘은 해물짬뽕이다. 집게로 직접 손질했지!', '배 위에서 먹는 밥은 두 배로 맛있어.', '흘리지 말고 먹어라.'] },
    { id: 'px', sprite: 'minun', name: '마이농', title: '매점병 일병', map: 'px', x: 6, y: 2, color: '#f0e8a0',
      lines: ['어서 와! 오늘 냉동 재고 넉넉해.', '출항 전엔 간식 미리 사 둬.', '초코파이 사면 동기랑 나눠 먹어.'] },
    { id: 'medic', sprite: 'blissey', name: '해피너스', title: '의무병 상병', map: 'hq1', x: 10, y: 3, wander: 2, color: '#f8c8d8',
      lines: ['뱃멀미 나면 바로 말해. 약 있어.', '물 많이 마셔라. 탈수 조심!', '다치면 참지 말고 와.'], daily: MEDIC_DAILY },
    { id: 'nco', sprite: 'kingdra', name: '킹드라', title: '당직하사관 중사', map: 'command', x: 8, y: 4, officer: true, color: '#4a8ac8',
      lines: ['현문 당직 교대 시간 꼭 지켜라.', '함정 출항 일정은 보안이다.', '보고는 결론부터.'] },
    { id: 'clerk', sprite: 'smeargle', name: '루브도', title: '행정병 상병', map: 'admin', x: 8, y: 4, color: '#f2f2e8',
      lines: ['휴가 신청서는 3일 전까지!', '출항 기간엔 휴가 못 나가는 거 알지?', '서류 정리가 군생활의 반이다.'] },
    { id: 'guard', sprite: 'starmie', name: '아쿠스타', title: '위병 일병', map: 'depot', x: 16, y: 26, color: '#a878c8',
      lines: ['위병소는 부대의 얼굴이다. 복장 단정!', '바닷바람에 모자 날아가지 않게 조심해.', '수상한 사람 보면 바로 보고!'] },
    { id: 'runner', sprite: 'buizel', name: '브이젤', title: '갑판병 일병', map: 'outdoor', x: 12, y: 19, route: PARADE_LAP, color: '#f09838',
      lines: ['헉헉… 해군 체력검정 준비 중!', '수영 테스트도 있다던데…', '같이 뛸래?'] },
    { id: 'gym', sprite: 'machop', name: '알통몬', title: '기관병 이병', map: 'gymroom', x: 6, y: 6, wander: 1, color: '#8a9ab8',
      lines: ['배 안에선 운동할 데가 없어서 지금 몰아서 해!', '팔굽혀펴기 100개 도전 중!', '근손실 오기 전에!'] },
    { id: 'cyber', sprite: 'porygon', name: '폴리곤', title: '전탐병 상병', map: 'cyber', x: 6, y: 2, color: '#f08aa8',
      lines: ['레이더 보다가 눈이 침침해…', '자격증 인강 3배속으로 듣는 중.', '인터넷 편지 쓰는 법? 여기 누르면 돼.'] },
    { id: 'room2a', sprite: 'carvanha', name: '샤크니아', title: '2분대 병장', map: 'room2', x: 12, y: 5, wander: 2, color: '#c84848',
      lines: ['다음 출항은 우리 분대 차례다…', '1분대 신병이냐? 반갑다.', '말년엔 파도도 조심해야 해.', '………… (아무 말이 없다. 눈 덮인 산 정상에서 도전자를 기다리는 누군가 같은 포스가 느껴진다…)'] },
    { id: 'lounge', sprite: 'corsola', name: '코산호', title: '2분대 일병', map: 'lounge', x: 8, y: 6, wander: 1, color: '#f8a8b8',
      lines: ['리모컨은 병장님 거다. 건드리지 마.', '이 드라마 다음 화가 출항 중에 나온대…', '자판기 커피 마실래?'] },
    { id: 'dog', sprite: 'rockruff', name: '암멍이', title: '군견', map: 'depot', x: 9, y: 19, wander: 3, noCap: true, color: '#c89868',
      lines: ['멍! (꼬리를 흔든다)', '킁킁… (갯내음을 맡는다)', '왈! (갈매기를 쫓아간다)'], daily: DOG_DAILY },
  ],
  air: [
    { id: 'cook', sprite: 'snorlax', name: '잠만보', title: '조리병 상병', map: 'kitchen', x: 5, y: 3, wander: 2, color: '#3a5a6a',
      lines: ['오늘 메뉴는 돈가스다. 조종사들도 먹는 메뉴지!', '짬밥 맛없다는 소리는 우리 식당에선 금지다.', '남기면… 내가 먹는다.', '쿨… 쿨… (잠만보가 조리실 한가운데를 막고 자고 있다. 깨우려면 포켓몬의 피리가 필요할 것 같다.)'] },
    { id: 'px', sprite: 'pachirisu', name: '파치리스', title: 'BX병 일병', map: 'px', x: 6, y: 2, color: '#e8e8f0',
      lines: ['어서 와! 공군은 PX를 BX라고 불러.', '냉동은 3500원, 초코파이는 정(情)이야.', '월급날엔 줄이 엄청 길어.'] },
    { id: 'medic', sprite: 'chansey', name: '럭키', title: '의무병 상병', map: 'hq1', x: 10, y: 3, wander: 2, color: '#f8b8c8',
      lines: ['활주로 소음에 귀 아프면 말해.', '물집 잡히면 터뜨리지 말고 보여줘.', '아프면 참지 말고 와라.'], daily: MEDIC_DAILY },
    { id: 'nco', sprite: 'staraptor', name: '찌르호크', title: '당직부사관 중사', map: 'command', x: 8, y: 4, officer: true, color: '#6a6a7a',
      lines: ['비상대기 인원 위치 파악 확실히!', '상황판은 함부로 만지지 마라.', '보고는 정확하게, 짧게.'] },
    { id: 'clerk', sprite: 'smeargle', name: '루브도', title: '행정병 상병', map: 'admin', x: 8, y: 4, color: '#f2f2e8',
      lines: ['휴가 신청서는 3일 전까지!', '서류 정리가 군생활의 반이다.', '도장 찍을 거 있으면 줄 서.'] },
    { id: 'guard', sprite: 'skarmory', name: '무장조', title: '헌병 일병', map: 'depot', x: 16, y: 26, color: '#9aa8b8',
      lines: ['기지 출입은 신분 확인이 먼저다.', '외출 나가는 날만 기다린다…', '수상한 사람 보면 바로 보고!'] },
    { id: 'runner', sprite: 'doduo', name: '두두', title: '정비병 일병', map: 'outdoor', x: 12, y: 19, route: PARADE_LAP, color: '#c8a878',
      lines: ['날지는 못해도 뛰는 건 자신 있다!', '체력검정 특급이 목표다!', '같이 뛸래?'] },
    { id: 'gym', sprite: 'machop', name: '알통몬', title: '무장병 이병', map: 'gymroom', x: 6, y: 6, wander: 1, color: '#8a9ab8',
      lines: ['미사일 장착하려면 힘이 필요해!', '팔굽혀펴기 100개 도전 중!', '근손실 오기 전에!'] },
    { id: 'cyber', sprite: 'porygon', name: '폴리곤', title: '전산병 상병', map: 'cyber', x: 6, y: 2, color: '#f08aa8',
      lines: ['자격증 인강, 3배속으로 듣는 중.', '인터넷 편지 쓰는 법? 여기 누르면 돼.', '전역 전에 정보처리기사 딴다!'] },
    { id: 'room2a', sprite: 'murkrow', name: '니로우', title: '2분대 병장', map: 'room2', x: 12, y: 5, wander: 2, color: '#3a3a5a',
      lines: ['다음 주 비상대기는 우리 분대다…', '1분대 신병이냐? 반갑다.', '말년엔 바람도 조심해야 해.', '………… (아무 말이 없다. 눈 덮인 산 정상에서 도전자를 기다리는 누군가 같은 포스가 느껴진다…)'] },
    { id: 'lounge', sprite: 'togetic', name: '토게틱', title: '2분대 일병', map: 'lounge', x: 8, y: 6, wander: 1, color: '#f2f2ea',
      lines: ['리모컨은 병장님 거다. 건드리지 마.', '에어쇼 영상 보는 중!', '자판기 커피 마실래?'] },
    { id: 'dog', sprite: 'rockruff', name: '암멍이', title: '군견', map: 'depot', x: 9, y: 19, wander: 3, noCap: true, color: '#c89868',
      lines: ['멍! (꼬리를 흔든다)', '킁킁… (내 손 냄새를 맡는다)', '왈! (비행기 소리에 귀를 쫑긋)'], daily: DOG_DAILY },
  ],
};

// ───────── 병영식당 배식병 · 1분대 선임 · 2생활관 사람들 ─────────
const SERVER: ExtraDef = {
  id: 'server', sprite: 'greedent', name: '요씽리스', title: '배식병 일병', map: 'mess', x: 9, y: 2, wander: 1, color: '#c89060',
  lines: [
    '반찬 더 줄까? …솔직히 내가 다 먹고 싶다.',
    '볼에 저장해 둔 건 비상식량이다. 건드리지 마라.',
    '배식은 공평하게! (몰래 하나 더 집어 먹는다)',
    '열매는 꼬리에, 반찬은 볼에. 배식병의 기본이지.',
  ],
};

/** 메인 스토리: 도서관 관리병 네이티오 (3일차부터, 세 군 공통) */
const LIBRARIAN: ExtraDef = {
  id: 'librarian', sprite: 'xatu', name: '네이티오', title: '도서관 관리병 상병', map: 'library', x: 8, y: 5, from: 3, color: '#58b858',
  lines: ['……', '…해가 기울면, 서가의 그림자도 기운다.', '…책은 읽는 사람을 고른다.', '…버려진 종이 곁에, 버려지지 못한 것들이 쌓여 있다. 백 하고도 여덟.'],
};

const MORE: Record<BranchId, ExtraDef[]> = {
  army: [
    SERVER,
    { id: 'sq1', sprite: 'hitmonchan', name: '홍수몬', title: '1분대 상병', map: 'room1', x: 12, y: 6, wander: 1, color: '#b88a5a', until: 8, squad1Senior: true,
      lines: ['펀치 연습은 체단실에서. 생활관에선 조용히.', '분대장님 전역하면 다음은 나다. 각오해라~', '신병, 모르는 거 있으면 나한테 물어봐.'] },
    { id: 'r2b', sprite: 'hitmonlee', name: '시라소몬', title: '2분대 상병', map: 'room2', x: 4, y: 5, wander: 1, color: '#a87a5a',
      lines: ['2분대 생활관은 발차기 금지 구역이다… 내가 정했다.', '1분대 신병이 우리 생활관엔 웬일이냐?', '혹한기 준비하느라 바쁘다.'] },
    { id: 'r2c', sprite: 'houndour', name: '델빌', title: '2분대 일병', map: 'room2', x: 8, y: 4, wander: 1, color: '#3a3a42',
      lines: ['불침번 서다 보면 눈이 빨개진다… 원래 빨갛다고?', '우리 분대장님 잔소리 장난 아니다.', '같은 일병끼리 힘내자.'] },
    { id: 'r2d', sprite: 'sandshrew', name: '모래두지', title: '2분대 이병', map: 'room2', x: 10, y: 6, wander: 1, color: '#e0c060',
      lines: ['이, 이병 모래두지! 아직 다 모르겠습니다…', '전입 온 지 일주일 됐습니다!', '모래주머니 쌓기는 자신 있습니다!'] },
  ],
  navy: [
    SERVER,
    { id: 'sq1', sprite: 'seel', name: '쥬쥬', title: '1분대 상병', map: 'room1', x: 12, y: 6, wander: 1, color: '#e8eef4', until: 8, squad1Senior: true,
      lines: ['겨울 바다 당직도 끄떡없다. 원래 추위에 강하거든.', '분대장님 전역하면 다음은 나다~', '신병, 배 멀미는 괜찮냐?'] },
    { id: 'r2b', sprite: 'krabby', name: '크랩', title: '2분대 상병', map: 'room2', x: 4, y: 5, wander: 1, color: '#e86848',
      lines: ['집게 조심해라. 장난이야~', '2분대는 다음 출항 준비 중이다.', '1분대 신병이 우리 생활관엔 웬일이냐?'] },
    { id: 'r2c', sprite: 'shellder', name: '셀러', title: '2분대 일병', map: 'room2', x: 8, y: 4, wander: 1, color: '#a878c8',
      lines: ['껍데기 속에 숨고 싶은 날이 있지…', '갑판 청소는 내 담당이다.', '같은 일병끼리 힘내자.'] },
    { id: 'r2d', sprite: 'wooper', name: '우파', title: '2분대 이병', map: 'room2', x: 10, y: 6, wander: 1, color: '#7ab8e8',
      lines: ['이병 우파입니다! …헤헤.', '바다는 아직 조금 무섭습니다.', '선임님들 다 좋으십니다!'] },
  ],
  air: [
    SERVER,
    { id: 'sq1', sprite: 'hoothoot', name: '부우부', title: '1분대 상병', map: 'room1', x: 12, y: 6, wander: 1, color: '#a87a4a', until: 8, squad1Senior: true,
      lines: ['야간 비상대기 때 난 눈이 말똥말똥하다.', '분대장님 전역하면 다음은 나다~', '신병, FOD 워크다운 해 봤냐?'] },
    { id: 'r2b', sprite: 'noctowl', name: '야부엉', title: '2분대 상병', map: 'room2', x: 4, y: 5, wander: 1, color: '#a87a4a',
      lines: ['밤눈이 밝아서 야간 비상대기는 내 담당이다.', '2분대는 다음 주 비상대기다.', '1분대 신병이 우리 생활관엔 웬일이냐?'] },
    { id: 'r2c', sprite: 'natu', name: '네이티', title: '2분대 일병', map: 'room2', x: 8, y: 4, wander: 1, color: '#58b858',
      lines: ['…(가만히 먼 곳을 보고 있다) 너, 내일 불침번이다.', '앞으로 일어날 일은… 비밀.', '같은 일병끼리 힘내자.'] },
    { id: 'r2d', sprite: 'farfetchd', name: '파오리', title: '2분대 이병', map: 'room2', x: 10, y: 6, wander: 1, color: '#c8a070',
      lines: ['이병 파오리! 대파는 제 몸의 일부입니다!', '식당에서 대파 남기면 안 됩니다!', '아직 모르는 게 많습니다!'] },
  ],
};
/** 서브 S-02: 탄약고 군견 하데리어 (세 군 공통). 탄약고 문 쪽을 보고 엎드려 있다 */
const AMMO_DOG: ExtraDef = {
  id: 'ammodog', sprite: 'herdier', name: '하데리어', title: '탄약고 군견', map: 'ammoroom', x: 9, y: 7, wander: 0, color: '#8a7a5a', noCap: true,
  lines: ['컹.', '(문 쪽을 보고 엎드려 있다. 꼬리가 한 번 흔들리다 멈춘다.)', '(코를 킁킁거리더니, 다시 문만 본다.)'],
};

for (const b of Object.keys(MORE) as BranchId[]) EXTRAS[b].push(...MORE[b], LIBRARIAN, AMMO_DOG);
