import type { Line, LineWho, NpcId } from '../types';
import type { MapId } from '../engine/map';
import type { Dir } from '../engine/drawMonster';

/**
 * 명령 · 임무 (docs/lore/scenario.md)
 * 퍼즐이 있는 공간에는 늘 누군가의 명령이나 맡은 임무로 간다. 일은 평범하고 밝다. 어긋난 것은 그 일을 하다 보인다.
 * - order: 임무를 받는 장면 (자유 시간에 시킨 사람이 부른다)
 * - report: 일을 마치고 돌아가 보고하는 장면. 시킨 사람은 대개 이상한 점을 보지 못한다
 * - 시킨 사람이 그사이 전역해 부대에 없으면 absent 문구로 대신한다
 * 키는 스토리 미션 ID (data/story.ts).
 */
/** 장면의 무대: 화면이 이 맵으로 바뀌고, 나와 시킨 사람이 이 자리에 선 다음 대화가 시작된다 */
export interface Stage {
  map: MapId;
  me: [number, number, Dir];
  giver: [number, number, Dir];
}
/** 1생활관 통로 (분대장 · 맞선임) */
const ROOM1: Stage = { map: 'room1', me: [7.8, 5.5, 'left'], giver: [6.3, 5.5, 'right'] };
/** 지휘통제실 책상 앞 (소대장) */
const COMMAND: Stage = { map: 'command', me: [5.5, 4.6, 'up'], giver: [5.5, 2.5, 'down'] };
/** 행정반 책상 앞 (행보관 · 중대장) */
const ADMIN_SGM: Stage = { map: 'admin', me: [6.5, 4.6, 'up'], giver: [6.5, 2.5, 'down'] };
const ADMIN_CPT: Stage = { map: 'admin', me: [5.5, 4.6, 'up'], giver: [5.5, 2.5, 'down'] };
/** 행정반 책상 앞 (소대장이 행정반으로 불렀을 때) */
const ADMIN_LT: Stage = { map: 'admin', me: [4.5, 4.6, 'up'], giver: [4.5, 2.5, 'down'] };
/** 2층 복도: 체단실 문 앞 / 옥상 철문(계단) 앞 */
const HQ2_GYM: Stage = { map: 'hq2', me: [9.3, 1.6, 'right'], giver: [10.8, 1.6, 'left'] };
const HQ2_ROOF: Stage = { map: 'hq2', me: [20.2, 3.5, 'right'], giver: [21.7, 3.5, 'left'] };
/** 시킨 사람이 부대에 없을 때: 생활관 문 옆 당번표 앞 */
export const DUTY_BOARD: Stage = { map: 'room1', me: [6.5, 1.6, 'up'], giver: [6.5, 1.6, 'up'] };

export interface OrderDef {
  mission: string;
  giver: NpcId;
  /** 명령을 받는 자리 · 보고하는 자리 */
  orderAt: Stage;
  reportAt: Stage;
  /** 퀘스트 알림에 뜨는 한 줄 */
  brief: string;
  /** 심부름: 명령을 받으면 시킨 곳에 닿을 때까지 곧장 그리로 간다 (다른 문은 열리지 않는다) */
  errand?: boolean;
  order: Line[];
  report: Line[];
}

const say = (who: LineWho, text: string): Line => ({ who, text });
const narr = (text: string) => say('narr', text);
const me = (text: string) => say('me', text);

export const ORDERS: Record<string, OrderDef> = {
  'M-02': {
    mission: 'M-02', giver: 'sgt', orderAt: ROOM1, reportAt: ROOM1, errand: true, brief: '용모 점검 전에 1층 화장실에서 세면하기',
    order: [
      say('sgt', '신병. 오후에 용모 점검이 있다. 눈곱 낀 얼굴로 서 있을 거냐.'),
      say('sgt', '1층 화장실 가서 세면하고 와라. 3분 준다. 시계 보고 정확히 맞춰 와.'),
      me('"예! 다녀오겠습니다!"'),
    ],
    report: [
      narr('생활관으로 뛰어 돌아와 분대장 앞에 섰다.'),
      say('sgt', '2분 50초. 합격. …얼굴이 왜 그렇게 하얗게 질렸냐. 물이 찼냐.'),
      me('(거울에서 본 걸 말할 틈은 없었다.)'),
    ],
  },
  'M-03': {
    mission: 'M-03', giver: 'senior', orderAt: ROOM1, reportAt: ROOM1, errand: true, brief: '1층 복도 게시판에서 이번 달 생일자와 초의 개수 세어 오기',
    order: [
      say('senior', '야, 좋은 소식. 이번 달 생일 파티 준비를 우리 분대가 맡았다. 다들 엄청 기대하고 있어.'),
      say('senior', '1층 복도 게시판에 명단 붙어 있거든. 몇 명인지, 초가 몇 개 필요한지 세어 와라. 행정반 메모도 같이 보고.'),
      me('"세어 오겠습니다."'),
    ],
    report: [
      me('"생일자는 네 명, 초는 쉰아홉 개입니다."'),
      say('senior', '오, 계산 빠르네! 좋아, 케이크는 내가 알아볼게. 다들 좋아하겠다.'),
      me('"그런데 명단에 줄이 하나 더 있었습니다. 제 이름이…"'),
      say('senior', '줄이 하나 더? 에이, 게시판에 낙서하는 놈이 있나 보네. 신경 쓰지 마.'),
    ],
  },
  'M-04': {
    mission: 'M-04', giver: 'lt', orderAt: ADMIN_LT, reportAt: ADMIN_LT, errand: true, brief: '2층 도서관 관리병에게서 정훈 교재 다섯 권 받아 오기',
    order: [
      say('lt', '왔나. 행정반으로 부른 건 다름이 아니라, 내일 있을 정훈 교육 준비 때문이다.'),
      say('lt', '교육 때 쓸 교재가 2층 도서관에 있다. 관리병한테 가서 다섯 권을 받아 와라.'),
      say('lt', '순서대로 꽂혀 있을 거다. 순서 흐트러뜨리지 말고. 교육은 순서가 생명이다.'),
      me('"교재 다섯 권, 받아 오겠습니다."'),
    ],
    report: [
      narr('책을 들고 행정반의 소대장에게 갔다. 다섯 권이었던 것이 한 권이 되어 있다.'),
      say('lt', '음? 이게 아닌데. 다섯 권이라고 했잖나. …뭐, 내가 다시 알아보지. 그건 네가 갖고 있어라.'),
      narr('소대장은 표지를 한참 보다가 돌려준다. 제목을 읽지 못하는 눈치다.'),
    ],
  },
  'M-05': {
    mission: 'M-05', giver: 'sgm', orderAt: ADMIN_SGM, reportAt: ADMIN_SGM, errand: true, brief: '싸지방에서 분대 앞으로 온 인터넷 편지를 날짜순으로 뽑아 오기',
    order: [
      say('sgm', '오~ 한가하지? 싸지방 가서 우리 분대 앞으로 온 인터넷 편지 좀 뽑아 와라.'),
      say('sgm', '날짜순으로 정리해서. 편지 받고 웃는 얼굴 보는 게 내 낙이다, 허허.'),
      me('"날짜순으로 뽑아 오겠습니다."'),
    ],
    report: [
      narr('편지를 날짜순으로 묶어 행보관에게 건넸다. 내 앞으로 온 한 통은 맨 위에 올렸다.'),
      say('sgm', '수고했다. …이건 뭐냐. 빈 종이잖냐. 이런 건 버려라.'),
      me('(빈 종이가 아니다. 행보관님 눈에는 글자가 안 보이는 거다.)'),
    ],
  },
  'M-06': {
    mission: 'M-06', giver: 'senior', orderAt: ROOM1, reportAt: ROOM1, brief: '동기와 함께 1층 세탁실에서 빨래 당번 (동기에게 말 걸기)',
    order: [
      say('senior', '자, 분대장으로서 첫 지시다. 빨래 당번! 동기랑 둘이 가라.'),
      say('senior', '…분대장은 원래 이런 걸 시키는 거 맞지? 누가 하던 걸 본 것 같은데.'),
      me('(누가 하던 건지, 이 사람은 기억하지 못한다.)'),
    ],
    report: [
      me('"빨래 마쳤습니다. 그런데 세탁기에서 주인 없는 전투복이 나왔습니다. 이준서라는 병사가 있습니까?"'),
      say('senior', '이준서? (명부를 넘겨 본다) 없는데? 옛날 거겠지. 걸레로 써라.'),
      narr('그는 웃으며 명부를 덮는다. 명찰은 주머니에 넣어 두었다.'),
    ],
  },
  'M-07': {
    mission: 'M-07', giver: 'lt', orderAt: COMMAND, reportAt: COMMAND, errand: true, brief: '지휘통제실에서 근무 일지를 베껴 오기 (시각은 벽시계 기준으로 정확히)',
    order: [
      say('lt', '주간 근무 결산을 해야 한다. 지휘통제실 가서 근무 일지를 베껴 와라.'),
      say('lt', '시각은 벽시계 기준으로 정확히 적고. 나는 이런 서류가 딱 맞아떨어질 때가 제일 좋다.'),
      me('"정확히 베껴 오겠습니다."'),
    ],
    report: [
      me('"사본입니다. 그런데 일지에 매일 밤 시계가 1분씩 멈춘다고 적혀 있습니다."'),
      say('lt', '정지? 그런 줄은 없는데. (원본을 편다) 봐라, 여긴 빈 줄이다.'),
      narr('소대장이 가리키는 줄에는 분명히 글씨가 있다. 그의 눈에만 비어 있다.'),
    ],
  },
  'D-01': {
    mission: 'D-01', giver: 'sgm', orderAt: ROOM1, reportAt: HQ2_GYM, brief: '저녁 체력단련 뒤 체단실 기구 정리 (동기에게 "남아서 같이 정리하자")',
    order: [
      say('sgm', '오~ 오늘 저녁 체력단련은 체단실이다. 다들 땀 좀 빼라!'),
      say('sgm', '그리고 마지막에 나가는 놈이 기구 정리해라. 누가 남을지는 알아서들 정하고.'),
      me('(…마지막까지 남으면, 체단실에는 둘만 있게 된다.)'),
    ],
    report: [
      narr('불을 끄고 체단실을 나서는데 행보관이 지나간다.'),
      say('sgm', '오~ 정리 잘했네. 둘이 사이가 좋아서 보기 좋다. 여기선 다들 그렇게 지내는 거다.'),
    ],
  },
  'M-08': {
    mission: 'M-08', giver: 'senior', orderAt: ROOM1, reportAt: ROOM1, brief: '맞선임 대신 분리수거장에서 분리수거 당번 서기',
    order: [
      say('senior', '야. 내일 전역인데 오늘 분리수거 당번이 나다.'),
      say('senior', '…한 번만 대신 가 주라. 마지막 부탁이다. 종이는 종류별로 묶어서 버려야 한다.'),
      me('"다녀오겠습니다."'),
    ],
    report: [
      me('"당번 마쳤습니다. 폐지 속에서 이런 게 나왔습니다."'),
      narr('봉투를 본 맞선임이 잠깐 굳는다.'),
      say('senior', '…그거, 나도 쓴 적 있는 것 같다. 언제였더라. …아니다, 기분 탓이겠지. 고맙다.'),
    ],
  },
  'M-09': {
    mission: 'M-09', giver: 'sgm', orderAt: ADMIN_SGM, reportAt: ADMIN_SGM, brief: '정비실 구석의 시끄러운 라디오를 끄거나 치우기',
    order: [
      say('sgm', '정비실 구석에 고장 난 라디오가 있다. 밤마다 삐삐거린다고 민원이 들어왔어.'),
      say('sgm', '쥐가 건드렸겠지. 끄든지 버리든지 해라.'),
      me('"조용히 시키겠습니다."'),
    ],
    report: [
      me('"라디오, 조용해졌습니다."'),
      say('sgm', '오~ 수고했다. 역시 맡기면 한다니까.'),
      narr('무엇이 들렸는지는 묻지 않는다. 묻지 않아서 다행인지, 아닌지 모르겠다.'),
    ],
  },
  'M-10': {
    mission: 'M-10', giver: 'cpt', orderAt: ADMIN_CPT, reportAt: ADMIN_CPT, brief: '도서관 안쪽 기록 보관실의 단체 사진을 해 순서대로 정리하기',
    order: [
      say('cpt', '상병. 도서관 안쪽 방의 기록이 엉망이다. 사진을 해 순서대로 정리해 놓아라.'),
      say('cpt', '기록은 거짓말을 하지 않는다. 다만 읽는 사람이 겁을 낼 뿐이지.'),
      me('"정리해 놓겠습니다."'),
    ],
    report: [
      me('"사진 정리 마쳤습니다."'),
      say('cpt', '봤나.'),
      narr('중대장은 대답을 기다리지 않고 서류로 눈을 돌린다.'),
    ],
  },
  'M-11': {
    mission: 'M-11', giver: 'lt', orderAt: COMMAND, reportAt: COMMAND, brief: '2생활관의 2분대 선임 병장에게 근무표를 전달하고 서명 받기',
    order: [
      say('lt', '다음 주 근무표다. 2분대 선임 병장에게 직접 전달해라. 서명도 받아 오고.'),
      say('lt', '그 병장은 말이 없어서 다들 어려워하더군. 그래도 서명은 받아야 한다.'),
      me('"전달하고 서명 받아 오겠습니다."'),
    ],
    report: [
      narr('병장은 근무표의 계급 칸에 "이병"이라고 쓰려다, 고쳐 썼다.'),
      me('"서명 받아 왔습니다."'),
      say('lt', '수고했다. …글씨가 참 옛날 글씨네. 요즘은 이렇게 안 쓰는데.'),
    ],
  },
  'D-02': {
    mission: 'D-02', giver: 'sgm', orderAt: ADMIN_SGM, reportAt: HQ2_ROOF, brief: '저녁에 동기와 옥상에 널어 둔 이불 걷어 오기 (2층 계단 옆 옥상 철문)',
    order: [
      say('sgm', '옥상에 이불 널어 놓은 거 있다. 해 지고 이슬 맞기 전에 걷어 와라.'),
      say('sgm', '둘이 가라, 무거우니까. 옥상 문은 이불 당번한테만 열어 주는 거다.'),
      me('"동기와 다녀오겠습니다."'),
    ],
    report: [
      narr('이불을 메고 내려오자 행보관이 기다리고 있다.'),
      say('sgm', '오~ 수고했다. 별 봤냐? 여기 별이 참 좋지. 나는 여기서 평생 봐도 안 질린다.'),
      me('(평생. …이 사람은 정말로 평생 여기 있는 거다.)'),
    ],
  },
  'M-12': {
    mission: 'M-12', giver: 'lt', orderAt: COMMAND, reportAt: COMMAND, brief: '{ammo}의 출입 기록을 근무 일지와 대조하고 주변 살피기',
    order: [
      say('lt', '{ammo} 출입 기록이 근무 일지와 안 맞는다. 밤마다 누가 드나든 흔적은 있는데 이름이 없어.'),
      say('lt', '가서 대조하고, 주변에 이상 없는지도 봐라. 서류가 안 맞는 건 못 참겠다.'),
      me('"확인해 보겠습니다."'),
    ],
    report: [
      me('"출입자는 확인하지 못했습니다."'),
      say('lt', '그럼 기록 착오겠지. (줄을 긋는다) 이걸로 맞아떨어졌다. 수고했다.'),
      narr('그의 서류는 이제 딱 맞아떨어진다. 주머니 속 별 조각 이야기는 하지 않았다.'),
    ],
  },
  'M-13': {
    mission: 'M-13', giver: 'sgm', orderAt: ADMIN_SGM, reportAt: ADMIN_SGM, brief: '동기와 함께 행정반 분실물함 정리하기',
    order: [
      say('sgm', '모레 전역이지? 전역자는 가기 전에 행정반 분실물함을 정리하는 게 전통이다.'),
      say('sgm', '주인 없는 건 버려라. 동기도 데려가고. 요즘 그 녀석 좀 멍하더라.'),
      me('(분실물함. …동기가 그 명찰을 거기 맡겼다고 했었다.)'),
    ],
    report: [
      me('"분실물함 정리 마쳤습니다."'),
      say('sgm', '수고했다. 그런데 그 낡은 명찰은 왜 안 버렸냐?'),
      me('"주인이 있습니다."'),
    ],
  },
};
