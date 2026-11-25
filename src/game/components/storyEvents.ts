/**
 * 메인 스토리 「별이 지기 전에」 2~4장 장면 모음.
 * World는 장소·인물·밤 근무 순간에 여기 함수를 불러 메뉴 선택지나 장면을 받는다.
 * (대본 원안: docs/lore/story.md · missions.md)
 *
 * 개연성 규칙
 * - 낮 미션은 "자유 시간(점심 12:00~13:00 · 개인정비 17:30~21:30)"에만, 추리 정리·옥상은 19:00~21:20(저녁 점호 전)에만.
 * - 동기와 함께 하는 장면은 동기를 불러 같은 곳으로 데려간 뒤(페이드) 진행한다.
 * - 밤 사건은 그날 실제로 서는 근무(5·9일 순찰 / 7·11일 위병소)에서만 일어난다.
 * - 당직 간부는 홀수일 소대장, 짝수일 행보관 (World의 nightDutyOfficer와 같다).
 */
import type { Choice, Line, LineWho, MonsterLook, NpcId, SpotId } from '../types';
import type { MapId } from '../engine/map';
import type { Dir } from '../engine/drawMonster';
import type { SpeakerInfo } from '../engine/speakers';
import type { DialogueScript } from './DialogueBox';
import type { MenuOption } from './Menu';
import { useGame, presentNpcs, eventDue } from '../state/store';
import { BRANCHES, FACILITY_NAME, TOTAL_DAYS, rankIdxForDay } from '../data/branches';
import { NPC_IDS, NPC_ROLES, npcPresent } from '../data/npcs';
import { extraLook, extrasForDay } from '../data/extras';
import { isFreeTimeEvening, isMealTime } from '../data/schedule';
import { memberName } from '../engine/whereabouts';
import { DUTY_BOARD, ORDERS } from '../data/orders';
import { npcDisplayName } from '../data/npcs';
import { MAP_NAMES } from '../engine/map';
import type { BgmMood } from '../engine/audio';
import { STORY_MISSIONS, missionState, sergeantJoins, storyEnding, type StoryEnding, missionReady } from '../data/story';

// ───────── 연결 (World가 넘겨준다) ─────────
export type StoryBg = 'roof' | 'archive' | 'library' | 'parade' | 'radio' | 'watchDesk' | 'fogGate' | 'mailbox' | 'datedMailbox';
export interface StoryScene {
  script: DialogueScript; bg?: StoryBg; onChoice?: (c: Choice) => void; onDone?: () => void;
  /** 🔊 이 장면 동안 흐를 곡. null = 평소 곡 그대로 (tone으로 정한 곡도 쓰지 않는다) */
  bgm?: BgmMood | null;
}
export interface ResistOpts {
  title: string;
  sub: string;
  /** mash: Space 연타 / alt: ←→ 번갈아 / still: 아무 키도 누르지 않기 */
  mode: 'mash' | 'alt' | 'still';
  secs: number;
  /** 졸음(게이지)이 차오르는 속도 (1초에 얼마나 · 1이면 1초 만에 가득) */
  rise?: number;
}
export interface StoryCtx {
  play: (s: StoryScene) => void;
  /** 페이드로 그 자리에 옮긴 뒤 then */
  goTo: (map: MapId, x: number, y: number, dir: Dir, then: () => void) => void;
  /** 사람(주요 NPC 또는 'x:엑스트라')을 그 자리로 바로 옮긴다 */
  place: (key: string, map: MapId, x: number, y: number, dir: Dir) => void;
  /** 그 사람이 나와 같은 맵, d칸 안에 있는지 */
  near: (key: string, d: number) => boolean;
  /** 🚶 장면 속에서 실제로 걸어간다: 'me' 또는 사람 키('x:엑스트라' · NpcId)가 지금 맵의 그 칸까지 걸어가 dir을 보고 선다 → then */
  walk: (key: string, x: number, y: number, dir: Dir, then?: () => void) => void;
  /** 내가 서 있는 칸 [x, y] */
  meTile: () => [number, number];
  /** 이 방에 keep(사람 키)만 남긴다: 다른 사람들은 내가 이 방을 나설 때까지 자리를 비운다 */
  alone: (map: MapId, keep: string[]) => void;
  resist: (o: ResistOpts, done: (ok: boolean) => void) => void;
  flash: () => void;
  /** 🧩 두뇌 퍼즐을 띄운다. 풀면 solved(되살아날 기억). 미루고 닫으면 아무 일도 없다 (다시 와서 풀 수 있다) */
  puzzle: (id: string, solved: (reward: number) => void, failed?: () => void) => void;
}

const G = () => useGame.getState();
/** 🔊 이 이야기의 장면들에 흐를 곡을 정해 둔다 (장면이 직접 고른 곡이 있으면 그쪽이 먼저) */
const tone = (ctx: StoryCtx, bgm: BgmMood): StoryCtx => ({ ...ctx, play: (sc) => ctx.play({ ...sc, bgm: sc.bgm === undefined ? bgm : sc.bgm }) });
const storyOn = () => G().clues.length > 0;
const mission = (id: string) => STORY_MISSIONS.find((m) => m.id === id)!;
/** 지금 할 수 있는 미션인지 (명령으로 가는 일이면 그 명령을 받은 뒤에만) */
const isOpen = (id: string) => storyOn() && missionReady(mission(id), G());
const flag = (k: string) => !!G().flags[k];
/** 명령으로 가는 일인데 아직 그 명령(호출 → 지시)을 받지 못했다: 그 자리에 가도 아무 일도 일어나지 않는다 */
const awaitingOrder = (id: string) => !!ORDERS[id] && !flag(`order_${id}`);
/** 분대와 아직 밥을 먹지 않았다 (식사 시간엔 생활관부터 들러야 스토리가 진행된다) */
const mealPending = () => { const mc = G().mealCheck; return !!mc && !mc.done; };
const freeNow = () => { const m = G().minute; return !mealPending() && (isFreeTimeEvening(m) || isMealTime(m)); };
/** 추리 정리·옥상: 저녁 개인정비 시간 (점호 준비 전) */
const eveningNow = () => { const m = G().minute; return m >= 19 * 60 && m < 21 * 60 + 20; };
const buddyName = () => memberName(G().branch, 'buddy');
/** 받침에 맞는 조사: josa('고라파덕', '이', '가') → '고라파덕이' */
export function josa(word: string, withB: string, noB: string): string {
  const c = word.charCodeAt(word.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return word + (has ? withB : noB);
}
/** 그 밤의 당직 간부 (World의 nightDutyOfficer와 같다) */
export const dutyOfficerOf = (day: number): NpcId => (day % 2 === 1 ? 'lt' : 'sgm');

/** 엑스트라 화자 */
function extraSpeaker(id: string): SpeakerInfo | undefined {
  const s = G();
  const def = extrasForDay(s.branch, s.day).find((d) => d.id === id);
  if (!def) return undefined;
  const words = def.title.split(' ');
  return { name: `${def.name} ${words[words.length - 1]}`, sub: words.slice(0, -1).join(' '), look: extraLook(def), cap: BRANCHES[s.branch].cap };
}
/** 슬리퍼(가짜 당직부관): 처음엔 중사로 변장 */
export const SLIPPER_LOOK: MonsterLook = { sprite: 'hypno', body: '#f2d050', belly: '#f2e2a0', accent: '#8a6a30', shape: 'tall', ears: 'tuft', tail: 'none', eyes: 'sleepy', mouth: 'smile' } as MonsterLook;
const slipperSpeaker = (unmasked: boolean): SpeakerInfo => {
  const cap = BRANCHES[G().branch].cap;
  return unmasked
    ? { name: '슬리퍼', sub: '꿈을 먹는 자', look: SLIPPER_LOOK, cap: null }
    : { name: '당직부관', sub: '??? 중사', look: SLIPPER_LOOK, cap: `officer-${cap}` as SpeakerInfo['cap'] };
};
const jirachiSpeaker = (named: boolean): SpeakerInfo => ({
  name: named ? '지라치' : '??? (별빛)', sub: named ? '소원의 별' : '',
  look: named ? ({ sprite: 'jirachi', body: '#f8f4d0', belly: '#ffffff', accent: '#f2d050', shape: 'round', ears: 'tuft', tail: 'none', eyes: 'sleepy', mouth: 'smile' } as MonsterLook) : null,
  cap: null,
});
/** 단서와 함께 오는 장(章) 완료 체크까지 하는 플래그 */
const setFlag = (k: string) => G().storyFlag(k);

/**
 * 📋 임무 보고: 명령을 받고 한 일이면, 끝난 뒤 시킨 사람에게 돌아가 보고하는 짧은 장면을 보여 준다.
 * 시킨 사람이 그사이 전역해 부대에 없으면 지문 한 줄로 대신한다. 명령 없이 스스로 찾아간 일은 보고하지 않는다.
 */
export function withReport(ctx: StoryCtx, id: string, done?: () => void) {
  const o = ORDERS[id];
  const s = G();
  if (!o || !s.flags[`order_${id}`] || s.flags[`report_${id}`]) { done?.(); return; }
  const present = npcPresent(o.giver, s.day);
  const at = present ? o.reportAt : DUTY_BOARD;
  // 🚶 찾아가 보고하는 일: 화면이 옮겨 주지 않는다. 내가 직접 걸어가 그 사람 앞에 서면 보고 장면이 시작된다 (World)
  if (!at.passing) {
    s.applyEffects({ flag: `toReport_${id}` }, undefined, true);
    s.toast(
      present
        ? `📋 일을 마쳤다. ${MAP_NAMES[at.map]}의 ${npcDisplayName(s.branch, o.giver, s.day)}에게 보고하러 가자.`
        : '📋 일을 마쳤다. 1생활관 당번표에 적으러 가자.',
      'alert',
    );
    done?.();
    return;
  }
  // 🎬 일을 마치고 나오는 길에 마주치는 장면: 그 자리로 화면이 바뀌고 곧바로 이어진다
  ctx.goTo(at.map, at.me[0], at.me[1], at.me[2], () => {
    if (present) ctx.place(o.giver, at.map, at.giver[0], at.giver[1], at.giver[2]);
    ctx.play({
      bgm: null,
      script: present
        ? { npc: o.giver, lines: o.report }
        : { lines: [{ who: 'narr', text: '보고하러 갔지만, 일을 시킨 사람의 자리는 비어 있다. 당번표에 "완료"라고만 적어 두었다. 아무도 그 이름을 묻지 않는다.' }] },
      onDone: () => {
        G().applyEffects({ flag: `report_${id}`, discipline: 1, affinity: present ? { [o.giver]: 2 } : undefined }, '임무 보고', true);
        G().log(`📋 임무를 마치고 보고했다: ${o.brief.replace('{ammo}', FACILITY_NAME[G().branch])}`);
        done?.();
      },
    });
  });
}

const say = (who: LineWho, text: string): Line => ({ who, text });
const narr = (text: string) => say('narr', text);
const me = (text: string) => say('me', text);

// ═════════════════════════ 2장 「이상한 부대」 ═════════════════════════

/** M-05 싸지방: 보낸 날짜가 없는 편지 */
function m05(ctx: StoryCtx) {
  G().spend(20);
  ctx.play({
    bg: 'mailbox',
    script: { lines: [
      narr('싸지방 컴퓨터로 인터넷 편지함을 열었다.'),
      narr('받은 편지함 맨 위에, 날짜 칸이 비어 있는 편지가 한 통 있다. 보낸 사람: 엄마.'),
      narr('『아들, 어디 아프니? 어젯밤이 네가 집에서 자는 마지막 밤이었는데, 아침에 아무리 깨워도 안 일어나서 병원에 왔어.』'),
      narr('『의사 선생님은 그냥 깊이 잠든 거래. 입영 시간까지 아직 세 시간 남았다는데, 병무청에는 엄마가 전화해 둘게. 엄마가 계속 옆에 있을게.』'),
      me('(…이 편지, 언제 쓴 거지?)'),
    ] },
    // 🧩 P-06: 편지를 쓴 날과 시각을 알아내야 현실의 시간이 보인다
    onDone: () => ctx.puzzle('P-06', (reward) => ctx.play({
      bg: 'datedMailbox',
      script: { lines: [
        narr('비어 있던 날짜 칸에 글자가 떠오른다. 입대일, 오전 11시.'),
        me('(나는 여기서 며칠을 보냈는데… 현실은 아직 그날 오전이야.)'),
        narr('답장 버튼을 눌러 본다. …딸깍. 딸깍. 눌리지 않는다.'),
        me('(현실의 나는… 자고 있구나. 입대 날 아침에도 못 일어난 채로.)'),
      ] },
      onDone: () => { G().findClue('C-05', reward); withReport(ctx, 'M-05'); },
    })),
  });
}

/** M-06 세탁실: 동기와 빨래하다 나온 낯선 명찰 */
function m06(ctx: StoryCtx) {
  const s = G();
  s.spend(20);
  ctx.goTo('laundry1', 4.5, 3.5, 'down', () => {
    ctx.place('buddy', 'laundry1', 5.5, 3.5, 'down');
    ctx.play({
      script: {
        npc: 'buddy',
        lines: [
          narr('동기와 나란히 세탁기 앞에 섰다. 탈수가 끝난 세탁기 뚜껑을 열자—'),
          narr('우리 것이 아닌 낡은 전투복 한 벌이 섞여 나왔다. 빛바랜 명찰이 붙어 있다.'),
          narr('명찰은 다 해져서, 글자가 실밥 조각으로 흩어져 있다.'),
        ],
      },
      // 🧩 P-07: 명찰 조각을 맞춰야 이름이 돌아온다
      onDone: () => ctx.puzzle('P-07', (reward) => ctx.play({
      script: {
        npc: 'buddy',
        lines: [
          narr('「이준서」'),
          say('buddy', '……'),
          narr(`(${buddyName()}의 눈에서 갑자기 눈물이 뚝뚝 떨어진다.)`),
          say('buddy', '어, 어? 왜 이러지. 모르는 이름인데… 왜 눈물이 나지?'),
          me('(…모르는 이름이 아닌 것 같은데.)'),
        ],
        choices: [
          { text: '(어깨를 토닥인다) "괜찮아. 천천히 생각해."', grade: 'good', effects: { affinity: { buddy: 3 } },
            reply: [say('buddy', '…응. 고마워. 이상하지? 그냥, 누가 날 부르는 것 같았어.')] },
          { text: '"…혹시 그거, 네 이름 아니야?"', grade: 'ok', effects: { affinity: { buddy: 1 } },
            reply: [say('buddy', '내 이름…? 내 이름은… 어, 그러니까…'), narr(`(${josa(buddyName(), '이', '가')} 머리를 감싸 쥔다. 고라파덕처럼 두통이 오는 모양이다.)`), say('buddy', '…모르겠어. 머리 아파.')] },
        ],
      },
      onChoice: (c) => { if (c.effects) G().applyEffects(c.effects, '낯선 명찰'); },
      onDone: () => { G().findClue('C-06', reward); withReport(ctx, 'M-06'); },
      })),
    });
  });
}

/** M-07 지휘통제실: 근무 일지의 찢겨 나간 한 장 → 멈춘 시계 */
function m07(ctx: StoryCtx) {
  const s = G();
  const left = TOTAL_DAYS - s.day;
  s.spend(5);
  ctx.play({
    script: { lines: [
      narr('상황판 옆에 걸린 지휘통제실 근무 일지를 베끼려고 한 장씩 넘겨 본다.'),
      narr('쪽 번호를 따라 적다가 손이 멈췄다. 한 장이 찢겨 나가고 없다. 찢긴 자국은 새것처럼 깨끗하다.'),
      me('(소대장님은 서류가 딱 맞아떨어져야 한다고 했다. 어느 장이 없는 건지부터 알아내야 해.)'),
    ] },
    // 🧩 P-08: 찢겨 나간 장을 알아내면, 그 장에 적혀 있던 것이 눈에 들어온다
    onDone: () => ctx.puzzle('P-08', (reward) => ctx.play({
      script: { lines: [
        narr('37쪽이 있어야 할 자리를 펴자, 뒤표지 안쪽에 접힌 종이 한 장이 끼워져 있다. 찢겨 나간 바로 그 장이다.'),
        narr('「00:00 시계 정지 (1분)」 「00:00 시계 정지 (1분)」 「00:00 시계 정지 (1분)」… 날짜만 다를 뿐, 매일 밤 같은 줄이 적혀 있다.'),
        narr('그리고 맨 아래에, 낯선 필체로 —'),
        narr(`「별이 질 때까지 D-${left}」`),
        me(`(자정마다 시계가 1분씩 멈춘다고…? 그리고 D-${left}. 별이 지는 날이 전역일이라면.)`),
        narr('벽시계를 올려다본다. 초침이 아주 잠깐, 멈췄다 간 것 같다.'),
      ] },
      onDone: () => { G().findClue('C-07', reward); withReport(ctx, 'M-07'); },
    })),
  });
}

/** D-01 추리 정리 1 「우리는 왜?」 (1생활관, 동기와 침상에 걸터앉아) */
function d01(ctx: StoryCtx, retry = false) {
  const lines: Line[] = retry
    ? [narr('다시 단서 카드를 하나씩 짚어 본다. 별 조각 · 거울 · 생일자 명단 · 엄마의 편지.'), me('"우리가 포켓몬이 된 건…"')]
    : [
      me(`"…${buddyName()}. 할 얘기가 있어."`),
      narr('체력단련이 끝나고 다들 나갔다. 아령을 제자리에 놓고, 매트 위에 그동안 모은 것들을 하나씩 늘어놓았다.'),
      say('buddy', '이게… 다 뭐야?'),
      me('"우리가 포켓몬이 된 건…"'),
    ];
  ctx.play({
    script: { npc: 'buddy', lines },
    // 🧩 P-09 추리 보드: 단서 카드를 이야기의 빈칸에 놓는다 (찍을 수 없다)
    onDone: () => ctx.puzzle('P-09', (reward) => ctx.play({
      script: {
        npc: 'buddy',
        lines: [
          me('"…입대 전날 밤, 별똥별에 빈 소원 때문이야."'),
          say('buddy', '……'),
          say('buddy', '나도… 그날 밤 별을 봤어.'),
          say('buddy', '엄마 곁을 떠나기 싫다고 빌었어. 그거 하나는 확실히 기억나.'),
          narr(`(${josa(buddyName(), '이', '가')} 주머니에서 꺼낸 별 조각이, 내 것과 똑같이 반짝인다.)`),
          say('buddy', '이거, 네가 가져. 너라면 끝까지 갈 것 같아.'),
          say('buddy', '…아, 그리고. 2층 계단 옆 옥상 문이 열려 있더라. 나중에 별 보러 가자.'),
        ],
      },
      onDone: () => {
        const s = G();
        s.applyEffects({ memory: reward, affinity: { buddy: 3 }, flag: 'roof' }, '추리 정리 1');
        s.gainStar(2);
        setFlag('d01');
        s.log('🧩 추리 정리 1: 우리가 포켓몬이 된 건 입대 전날 밤 별에 빈 소원 때문이다.');
        s.toast('🔓 막사 2층 계단 옆 옥상 철문이 열렸다 (19:00~21:20).', 'info');
        withReport(ctx, 'D-01');
      },
    })),
  });
}

/** N-02 · N-04 불 꺼진 서가: 손전등을 끄면 안농들이 모여 글자가 된다 */
export function libraryLightsOut(ctx: StoryCtx, byDay: boolean) {
  const s = G();
  const second = s.clues.includes('C-11');
  if (second && s.clues.includes('C-15')) return false;
  if (second && s.day < 9) return false;
  const words = second ? '『소 · 원 · 을 · 거 · 둬 · 라』' : '『별 · 이 · 지 · 기 · 전 · 에』';
  const natu = extraSpeaker('librarian');
  if (!second) {
    // 🧩 P-10: 밤 순찰 중 2층 복도 게시판 (놓쳤으면 낮에 도서관에서 네이티오가 불을 꺼 준다)
    ctx.play({
      bg: 'library',
      script: {
        custom: natu,
        lines: byDay
          ? [
            narr('네이티오가 말없이 스위치를 내린다. 도서관이 깜깜해진다.'),
            narr('어둠 속에서 종이 조각 같은 것들이 사르르 모여든다. 글자다. 아니, 포켓몬이다 — 안농.'),
            narr('안농들이 둥글게 맴돈다. 무슨 말을 하려는 것 같은데, 순서가 뒤죽박죽이다.'),
          ]
          : [
            narr('게시판 공지를 확인하려는데, 손전등 빛 속에서 글자들이 종이를 떠나 떠오른다. 손전등을 껐다.'),
            narr('어둠 속에서 더 또렷하다. 공지문에서 떨어져 나온 글자들. 아니, 포켓몬이다 — 안농.'),
            narr('안농들이 둥글게 맴돈다. 무슨 말을 하려는 것 같은데, 순서가 뒤죽박죽이다.'),
          ],
      },
      onDone: () => ctx.puzzle('P-10', (reward) => ctx.play({
        bg: 'library',
        script: {
          custom: natu,
          lines: [
            narr(byDay ? '서가 위에 안농들이 한 줄로 늘어선다.' : '게시판 앞 허공에 안농들이 한 줄로 늘어선다.'),
            narr(words),
            narr(byDay ? '네이티오가 스위치를 다시 올리자, 안농들이 흩어진다.' : '손전등을 다시 켜자, 글자들은 공지문 속으로 돌아간다. 공지문에는 원래 그런 문장이 없다.'),
            narr('그 자리에 별 조각 하나가 떨어져 있다.'),
          ],
        },
        onDone: () => { const s2 = G(); s2.findClue('C-11', reward); s2.gainStar(3); },
      })),
    });
    return true;
  }
  // 🧩 P-18: 밤 순찰 중 휴게실 (놓쳤으면 낮에 도서관에서)
  ctx.play({
    bg: 'library',
    script: {
      custom: natu,
      lines: byDay
        ? [
          narr('네이티오가 말없이 스위치를 내린다. 도서관이 깜깜해진다.'),
          narr('어둠 속에서 안농들이 다시 모여든다. 지난번보다 급하게 맴돈다.'),
          narr('두 마리는 거꾸로 뒤집힌 채다.'),
        ]
        : [
          narr('휴게실. 켜져 있다던 TV는 꺼져 있다. 그런데 검은 화면 앞 허공에 글자들이 떠 있다. 손전등을 껐다.'),
          narr('지난번의 안농들이다. 이번에는 더 급하게 맴돈다.'),
          narr('두 마리는 거꾸로 뒤집힌 채다.'),
        ],
    },
    onDone: () => ctx.puzzle('P-18', (reward) => ctx.play({
      bg: 'library',
      script: {
        custom: natu,
        lines: [
          narr(byDay ? '이번엔 끝까지 모인다. 서가 위에 한 줄이 완성된다.' : '이번엔 끝까지 모인다. 꺼진 화면 앞에 한 줄이 완성된다.'),
          narr(words),
          narr(byDay ? '어느새 네이티오가 서가 꼭대기에 올라앉아, 어두운 창밖을 보고 있다.' : '소파 등받이 위에 네이티오가 앉아 있다. 도서관에 있어야 할 관리병이, 언제 왔는지.'),
          say('npc', '…이제 반은 왔다. 나머지 반은, 네 마음이다.'),
        ],
      },
      onDone: () => G().findClue('C-15', reward),
    })),
  });
  return true;
}

/** 화강돌: 돌탑의 쐐기돌에 묶인, 돌아오지 못한 사람들의 목소리 */
const SPIRITOMB_LOOK: MonsterLook = { sprite: 'spiritomb', body: '#5a3a7a', belly: '#7a5aa0', accent: '#5ac850', shape: 'round', ears: 'none', tail: 'none', eyes: 'sharp', mouth: 'fang', extra: 'spots' } as MonsterLook;
const spiritombSpeaker = (named: boolean): SpeakerInfo => ({
  name: named ? '화강돌' : '??? (돌탑)', sub: named ? '쐐기돌에 묶인 목소리들' : '여러 목소리', look: named ? SPIRITOMB_LOOK : null, cap: null,
});

/** S-01 분리수거장 구석 돌탑: 백여덟 개의 돌 (서브) */
function s01(ctx: StoryCtx) {
  G().spend(15);
  ctx.play({
    script: { lines: [
      narr('폐지 더미 뒤, 분리수거장 구석. 무릎 높이부터 가슴 높이까지 돌을 층층이 쌓은 탑이 서 있다.'),
      narr('이 부대는 어디나 반들반들한데, 이 탑에만 이끼가 껴 있다. 지나가는 사람들은 누구도 이쪽을 보지 않는다.'),
      me('(편지 봉투들이 버려져 있던 바로 옆이다.)'),
      narr('맨 위에는 쐐기처럼 깎은 돌 하나. 금 간 틈으로 보랏빛이 아주 조금 새어 나온다.'),
    ] },
    // 🧩 P-22: 돌이 놓일 자리와 놓인 돌을 센다
    onDone: () => ctx.puzzle('P-22', (reward) => {
      ctx.flash();
      ctx.play({
        script: { custom: spiritombSpeaker(false), lines: [
          narr('답을 떠올린 순간, 주변 소리가 꺼진다. 멀리 연병장의 구령도, 바람 소리도.'),
          say('npc', '……백일곱.'),
          say('npc', '……백일곱이야. 하나 모자라.'),
          narr('한 목소리가 아니다. 늙은 목소리, 앳된 목소리, 울먹이는 목소리가 수십 겹으로 포개져 있다.'),
        ] },
        onDone: () => ctx.play({
          script: {
            custom: spiritombSpeaker(true),
            lines: [
              narr('쐐기돌의 금이 벌어지고, 보랏빛 소용돌이가 흘러나와 웃는 얼굴 모양으로 엉긴다. 화강돌이다.'),
              say('npc', '우리도 빌었어. 가기 싫다고. 별이 들어줬어. 여긴 따뜻하고, 다들 웃고, 아무도 혼내지 않았어.'),
              say('npc', '그런데 별이 지던 밤, 아무도 손을 놓지 못했어. 그래서 돌이 됐어. "집에 가고 싶다"는 말만 남은 돌.'),
              say('npc', '…너, 아직 이름이 있구나. 이름이 있는 사람은 따뜻해.'),
              say('npc', '빈자리, 봤지? 거기 네 돌이 들어가면 백여덟. 그러면 우리도 조용히 잘 수 있어.'),
            ],
            choices: [
              {
                text: '(빈자리에서 손을 뗀다) "난 돌아갈 거야. 대신, 여기 새겨진 이름은 내가 기억할게."', grade: 'good',
                effects: { mental: 2, flag: 'cairnPromise' },
                reply: [
                  say('npc', '……기억.'),
                  narr('소용돌이가 잠깐 멈춘다. 돌 하나에 긁힌 글씨가 또렷해진다. 「박태윤 — 입대일」. 모르는 이름인데, 읽는 순간 목이 멘다.'),
                  say('npc', '그럼 가. 별이 질 때, 뒤돌아보지 마. 돌아보면… 자리가 하나 더 생기거든.'),
                ],
              },
              {
                text: '(발밑의 돌을 하나 주워 빈자리에 올려 본다)', grade: 'bad',
                effects: { memory: -5, mental: -3, flag: 'cairnStone' },
                reply: [
                  narr('돌을 올리는 순간 손끝부터 차가워진다. 머릿속에서 내 진짜 이름이 한 글자씩 흐려진다—'),
                  narr('딸깍. 돌이 저절로 굴러떨어졌다.'),
                  say('npc', '……아직 아니야. 넌 아직 이름이 있잖아.'),
                  say('npc', '별이 질 때 와. 그때도 남겠다면, 그 자리는 네 거야.'),
                ],
              },
            ],
          },
          onChoice: (c) => { if (c.effects) G().applyEffects(c.effects, '돌탑'); },
          onDone: () => ctx.play({
            script: { lines: [
              narr('정신을 차리자 소리가 돌아와 있다. 돌탑은 그냥, 이끼 낀 돌무더기다.'),
              me('(돌아오지 못한 사람들. …그 사람들도 나처럼 별에 빌었던 거야.)'),
            ] },
            onDone: () => G().findClue('C-16', reward),
          }),
        }),
      });
    }),
  });
}

/** 돌탑을 그냥 살펴볼 때 (스토리 전 · 끝난 뒤) */
export function cairnLines(): Line[] {
  const s = G();
  if (s.clues.includes('C-16')) {
    return flag('cairnStone')
      ? [narr('이끼 낀 돌탑. 빈자리 아래에, 내가 올렸다가 굴러떨어진 돌이 그대로 놓여 있다.'), me('(…주워 가지 않는 게 좋겠다.)')]
      : [narr('이끼 낀 돌탑. 귀를 기울이면, 아주 작게 백일곱 개의 숨소리가 들리는 것 같다.'), me(`(박태윤. …잊지 않았어.)`)];
  }
  if (s.minute >= 22 * 60 || s.minute < 6 * 60) return [narr('밤의 돌탑. 가까이 가자 누가 내 이름을 부른 것 같다. 돌아봐도 아무도 없다.')];
  return [narr('폐지 더미 뒤 구석의 낡은 돌탑. 누가 쌓았는지 아는 사람은 없다.'), narr('가까이 가면 이상하게 조용하다. 이 부대에서 웃음소리가 들리지 않는 곳은 여기뿐이다.')];
}

/** 탄약고 군견 하데리어 (말은 하지 않는다 · 모자 없음) */
const dogSpeaker = (): SpeakerInfo => {
  const def = extrasForDay(G().branch, G().day).find((d) => d.id === 'ammodog');
  return { name: '하데리어', sub: '탄약고 군견', look: def ? extraLook(def) : null, cap: null };
};

/** S-02 탄약고: 2인 1조 (서브) — 수불 대장의 빈 서명 칸과, 문만 보는 군견 */
function s02(ctx: StoryCtx) {
  G().spend(15);
  ctx.play({
    script: { lines: [
      narr('탄약고 안은 바깥보다 몇 도는 서늘하다. 벽을 따라 국방색 상자가 두 단씩 쌓여 있다.'),
      me('(관계자 외 출입 금지, 2인 1조… 라더니 철문이 그냥 열려 있었다. 들어오는 동안 아무도 붙잡지 않았다.)'),
      narr('문 옆에 군견 하데리어가 엎드려 있다. 나를 한 번 보고는, 다시 문만 본다.'),
      narr('책상 위에 탄약 수불 대장이 펼쳐져 있다. 줄마다 확인자 서명 칸이 두 개씩.'),
    ] },
    // 🧩 P-23: 장부대로라면 있어야 할 상자와, 선반에 실제로 있는 상자
    onDone: () => ctx.puzzle('P-23', (reward) => {
      // 🐕 하데리어가 직접 움직인다: 일어나 가운데 선반으로 걸어가 틈을 긁고 → 내가 다가가 틈에서 인식표를 꺼내고 → 하데리어가 나를 올려다본다
      const DOG = 'x:ammodog';
      let keptTag = false;
      const found = () => ctx.play({
        script: { lines: [
          { who: 'narr', text: '틈에 손을 넣자 차가운 쇠붙이가 잡힌다. 줄에 꿴 인식표 두 장, 「한도윤」. 그리고 접힌 쪽지.', sfx: 'sfx_item' },
          narr('「금요일, 2인 1조. 나는 들어왔는데, 같이 나가지 못했다. 별이 지는 밤이었다.」'),
          narr('「이 녀석 밥 좀 챙겨 줘. 문 앞에서 기다리지 말라고 해도 안 듣는다. — 한」'),
        ] },
        // 하데리어가 내 쪽으로 돌아앉아 올려다본다
        onDone: () => ctx.walk(DOG, 9, 2, 'left', () => ctx.walk('me', 8, 2, 'right', choice)),
      });
      ctx.play({
        script: { lines: [
          narr('장부엔 스물여섯, 선반엔 스물다섯. 기록에 없는 상자 하나가 비었다.'),
          narr('금요일 줄을 다시 본다. 확인자 첫 칸에는 「한도윤」. 두 번째 칸은 하얗게 비어 있다. 지운 자국도 없이, 처음부터 아무것도 쓰이지 않은 것처럼.'),
          narr('그때, 문 옆에 엎드려 있던 하데리어가 일어났다.'),
        ] },
        onDone: () => ctx.walk(DOG, 9, 2, 'up', () => ctx.play({
          script: { lines: [
            { who: 'narr', text: '하데리어가 가운데 선반의 빈자리에 코를 박고 킁킁대더니, 선반과 벽 사이 틈을 앞발로 긁는다. 벅, 벅.', sfx: 'sfx_bump' },
            me('(…거기 뭐가 있어?)'),
          ] },
          // 내가 하데리어 옆으로 걸어간다
          onDone: () => ctx.walk('me', 8, 2, 'up', found),
        })),
      });
      const choice = () => {
        ctx.play({
          script: {
            custom: dogSpeaker(),
            lines: [narr('하데리어가 인식표를 한 번 핥고 나를 올려다본다. 짖지도 않는다.')],
            choices: [
              {
                text: '(인식표를 하데리어 목줄에 걸어 준다) "기다리는 사람 이름, 이제 네가 갖고 있어."', grade: 'good',
                effects: { mental: 2, flag: 'ammoTagDog' },
                reply: [
                  narr('인식표가 목줄에서 짤랑 소리를 낸다. 하데리어는 처음으로 문에서 눈을 떼고, 내 발치에 턱을 괸다.'),
                  say('npc', '……컹.'),
                ],
              },
              {
                text: '(인식표를 주머니에 넣는다) "내가 찾아볼게. 이 사람이 어디로 갔는지."', grade: 'ok',
                effects: { flag: 'ammoTagKept' },
                reply: [
                  narr('주머니 속 인식표가 이상하게 따뜻하다. 하데리어는 잠깐 내 주머니를 보다가, 다시 문 쪽으로 돌아앉는다.'),
                  me('(돌아가면, 이 이름부터 찾아보자. 한도윤.)'),
                ],
              },
            ],
          },
          onChoice: (c) => { if (c.effects) G().applyEffects(c.effects, '탄약고'); keptTag = !!c.effects?.flag && c.effects.flag === 'ammoTagKept'; },
          onDone: () => {
            const last = () => ctx.play({
              script: { lines: [
                me('(2인 1조. 들어간 사람은 둘인데, 나온 기록은 하나.)'),
                me('(별이 지는 밤마다, 이 부대엔 꼭 누군가 남는다.)'),
              ] },
              onDone: () => G().findClue('C-17', reward),
            });
            // 인식표를 내가 가져가면, 하데리어는 다시 문 앞으로 걸어가 문 쪽을 보고 앉는다
            if (keptTag) ctx.walk(DOG, 8, 7, 'down', last);
            else last();
          },
        });
      };
    }),
  });
}

/** 탄약고 수불 대장을 그냥 살펴볼 때 (스토리 전 · 끝난 뒤) */
export function ammoLedgerLines(): Line[] {
  if (G().clues.includes('C-17')) {
    const after = narr('탄약 수불 대장. 금요일 줄의 두 번째 서명 칸은 여전히 비어 있다.');
    return flag('ammoTagDog')
      ? [after, narr('문 옆에서 하데리어의 목줄 인식표가 짤랑, 하고 울린다.')]
      : [after, me('(주머니 속 인식표. 한도윤. …잊지 말자.)')];
  }
  return [
    narr('탄약 수불 대장. 날짜, 입고, 불출, 재고, 그리고 확인자 서명 두 칸.'),
    narr('넘겨도 넘겨도 끝이 안 난다. 맨 앞 장의 글씨는 읽을 수 없을 만큼 바래 있다.'),
    me('(…이 부대, 대체 몇 년째 이 장부를 쓰고 있는 거지?)'),
  ];
}

/** M-08 분리수거장: 폐지 더미를 반으로 가르다 나온, 부치지 못한 편지 */
function m08(ctx: StoryCtx) {
  G().spend(15);
  // 🗑️ 깨봉이가 직접 움직인다: 줄자 끝을 물고 내 옆으로 걸어오고 → 줄을 당기며 마당 끝으로 걸어가고 → 봉투가 쏟아지면 하나를 물어 온다
  const BONG = 'x:recycler';
  const [mx, my] = ctx.meTile();
  // 내 옆 칸(오른쪽이 막혀 있으면 왼쪽) · 줄을 당겨 가는 자리(같은 줄로 네 칸 더)
  const side = mx + 1 <= 16 ? 1 : -1;
  const beside: [number, number] = [mx + side, my];
  const farX = Math.min(16, Math.max(3, mx + side * 5));
  const solved = (reward: number) => ctx.walk(BONG, beside[0], beside[1], side > 0 ? 'left' : 'right', () => ctx.play({
    script: { lines: [
      { who: 'narr', text: '깨봉이가 쏟아진 봉투 하나를 물어다 내 발치에 내려놓는다. 주둥이로 한 번 밀고는, 한 걸음 물러나 앉는다.', sfx: 'sfx_paper' },
      narr('해마다 다른 필체로 쓴 편지들. 내용은 전부 같다.'),
      narr('『집에 가고 싶다』 『집에 가고 싶다』 『집에 가고 싶다』'),
      narr('뒷면마다 다른 종이를 대고 눌러 쓴 자국이 남아 있다. 여섯 장을 포개자, 자국이 겹쳐 한 장의 쪽지가 된다.'),
      narr('『다음에 오는 사람에게. 도서관 안쪽 방을 봐라. — 강』'),
      me('(…나보다 먼저 온 사람이 있었어. 그것도 여러 명.)'),
    ] },
    onDone: () => { G().findClue('C-09', reward); withReport(ctx, 'M-08'); },
  }));
  ctx.play({
    script: { lines: [
      narr('분리수거장. 마당 한쪽에 폐지 더미가 산처럼 쌓여 있다. 오늘은 이걸 종류별로 묶어 내야 한다.'),
    ] },
    onDone: () => ctx.walk(BONG, beside[0], beside[1], side > 0 ? 'left' : 'right', () => ctx.play({
      script: { lines: [
        narr('먼저 와 있던 분리수거 당번 깨봉이가 줄자 끝을 물고 다가왔다. 둘이서 반씩 나눠 맡자는 눈치다.'),
        me('(마당도 반, 폐지 더미도 반. 줄 하나로 공평하게 나누려면…)'),
      ] },
      // 줄자를 문 채 마당 저쪽으로 걸어가 줄을 팽팽하게 당긴다
      onDone: () => ctx.walk(BONG, farX, my, side > 0 ? 'left' : 'right', () =>
        // 🧩 P-11: 마당과 폐지 더미를 한 줄로 반씩 가르면, 더미 한가운데서 봉투가 나온다
        ctx.puzzle('P-11', (reward) => ctx.play({
          script: { lines: [
            narr('줄을 따라 폐지 더미를 반으로 가르자, 한가운데서 봉투 뭉치가 쏟아진다. 우표도, 주소도 없다.'),
          ] },
          onDone: () => solved(reward),
        }))),
    })),
  });
}

/** M-09 정비실: 라디오의 삐 소리를 읽어 주파수를 맞춘다 (🧩 P-12) */
function m09(ctx: StoryCtx) {
  G().spend(15);
  ctx.play({
    bg: 'radio',
    script: { lines: [
      narr('공구함 뒤 구석에 먼지 쌓인 라디오가 있다. 전원을 켜자 잡음이 쏟아진다.'),
      narr('치이익… 잡음 사이로 규칙적인 소리가 섞여 들린다. 삐―, 삐, 삐…'),
    ] },
    onDone: () => ctx.puzzle('P-12', (reward) => ctx.play({
      bg: 'radio',
      script: { lines: [
        narr('잡음이 걷히고, 규칙적인 소리가 또렷해진다. 삐… 삐… 심전도 소리다.'),
        narr('『…아직 깨어나지 않았습니다. 같은 날 밤 쓰러진 청년이 또 한 명…』'),
        narr('치이익. 다시 잡음.'),
        me(`(또 한 명… ${josa(buddyName(), '이', '')}다.)`),
      ] },
      onDone: () => { G().findClue('C-10', reward); withReport(ctx, 'M-09'); },
    })),
  });
}

// ═════════════════════════ 3장 「별빛을 따라서」 ═════════════════════════

/** M-10 기록 보관실 (도서관 안쪽 방) */
function m10(ctx: StoryCtx) {
  const s = G();
  const sg = extrasForDay(s.branch, s.day).find((d) => d.id === 'room2a');
  s.spend(20);
  ctx.play({
    bg: 'archive',
    script: { lines: [
      narr('열쇠를 돌리자 삐걱, 안쪽 방 문이 열린다. 기록 보관실. 종이와 먼지 냄새.'),
      narr('책상 위에 「별똥별 부대사」 원본이 있다. 이번엔 페이지가 바싹 말라 있다.'),
      narr('『별이 깨어난 해마다, 소원을 빈 자가 부대에 온다. 별이 지기 전에 소원을 거두지 못한 자는, 부대가 된다.』'),
      narr('벽에는 해마다 찍은 부대 단체 사진이 빼곡하다.'),
      me('(…뭔가 걸린다. 몇 장을 떼어 나란히 놓아 보자.)'),
    ] },
    // 🧩 P-13: 해마다 같은 자리에 선 같은 얼굴을 찾는다
    onDone: () => ctx.puzzle('P-13', (reward) => ctx.play({
      bg: 'archive',
      script: { lines: [
        narr('…이상하다. 사진마다 둘째 줄 같은 자리에, 같은 얼굴의 이병이 서 있다.'),
        narr(`10년 전 사진. 그 이병은 — 2분대의 말 없는 병장, ${sg?.name ?? '그 병장'}이다.`),
        narr('바닥 먼지 위에 누군가의 발자국이 있다. 오래된 것과… 오늘 것.'),
        me('(사진을 한 장 챙겼다. 직접 물어봐야겠어.)'),
      ] },
      onDone: () => { G().findClue('C-12', reward); withReport(ctx, 'M-10'); },
    })),
  });
}

/** N-03 똑딱, 똑딱 — 7일차 밤 위병소 가는 길, 막사 복도에 처음 보는 당직부관 */
export function slipperCorridor(ctx: StoryCtx, onEnd: (ok: boolean) => void) {
  const s = G();
  const duty = dutyOfficerOf(s.day);
  const nd = s.nightDuty;
  const partner = nd?.partner ? memberName(s.branch, nd.partner) : '사수';
  // 상병부터는 내가 사수: 부사수(후임)는 존댓말
  const iLead = rankIdxForDay(s.day) >= 2;
  ctx.play({
    script: {
      custom: slipperSpeaker(false),
      lines: [
        narr(`막사 복도. 오늘 당직은 {r:${duty}}님인데… 지휘통제실 앞에 처음 보는 당직부관이 서 있다.`),
        narr(`…뒤따라오던 ${josa(partner, '이', '가')} 선 채로 꾸벅꾸벅 졸고 있다. 흔들어도 깨지 않는다.`),
        say('npc', `고생이 많군, ${['이병', '일병', '상병', '병장'][rankIdxForDay(s.day)]}. 좀 쉬어.`),
        narr('똑딱… 똑딱… 어디선가 진자 소리. 손에 든 무언가가 천천히 흔들린다.'),
        say('npc', '눈을 감으면 편해져…'),
        say('npc', '읽지 마. 생각하지 마…'),
        narr('[생각을 멈추지 마라! 글자의 "색"을 답한다]'),
      ],
    },
    // 🧩 P-14: Space 연타 대신, 졸음 속에서도 생각을 놓지 않는 집중 퍼즐
    onDone: () => { const end = (ok: boolean) => {
      const s2 = G();
      setFlag('n03');
      if (ok) {
        s2.applyEffects({ memory: 2 }, '최면 저항');
        ctx.play({
          script: { lines: [
            narr('번쩍 정신이 든다. 복도엔 아무도 없다. 지휘통제실 문은 굳게 닫혀 있다.'),
            narr('바닥에… 동그란 자국이 남아 있다. 진자를 끈 것 같은.'),
            say('narr', iLead ? `${partner}: "{me} {myrank}님, 괜찮으십니까? 갑자기 멈춰 서셔서… 저도 잠깐 졸았나 봅니다."` : `${partner}: "야, 왜 멈춰 서 있어? 근무 늦는다. …나도 잠깐 졸았나."`),
            me('(…방금 그건 뭐였지?)'),
          ] },
          onDone: () => onEnd(true),
        });
      } else {
        s2.applyEffects({ memory: -10 }, '최면');
        ctx.play({
          script: { lines: [
            narr('…눈을 떠 보니 위병소 초소 앞이다. 어떻게 걸어왔는지 기억이 없다.'),
            say('narr', iLead ? `${partner}: "괜찮으십니까? 걸으면서 조시던데요."` : `${partner}: "괜찮냐? 걸으면서 졸더라."`),
            me('(머릿속이 뿌옇다. 뭔가를… 잊어버린 것 같다.)'),
          ] },
          onDone: () => onEnd(false),
        });
      }
    }; ctx.puzzle('P-14', () => end(true), () => end(false)); },
  });
}

/** M-11 말 없는 병장 (2생활관) */
function m11(ctx: StoryCtx) {
  const sp = extraSpeaker('room2a');
  G().spend(20);
  ctx.play({
    script: {
      custom: sp,
      lines: [
        me('"병장님. 이 사진… 병장님이시죠?"'),
        say('npc', '……'),
        say('npc', '…오랜만에… 그 얼굴을 보는군.'),
        say('npc', '강민혁. 그게… 내 이름이었다. 거의 다 잊었지만.'),
        narr('병장이 관물대 깊숙한 곳에서 찢어진 일기장을 꺼낸다.'),
        narr('낱장이 다섯 조각으로 찢겨 뒤섞여 있다.'),
      ],
    },
    // 🧩 P-15: 찢어진 일기를 순서대로 맞춘다
    onDone: () => ctx.puzzle('P-15', (reward) => ctx.play({
    script: {
      custom: sp,
      lines: [
        narr('『별 조각을 일곱 개 모았다. 마지막 밤, 별이 물었다. 돌아가겠느냐고.』'),
        narr('『나는 겁이 났다. 돌아가면, 다시 가야 하니까. 그래서 아무 말도 못 했다.』'),
        say('npc', '지휘통제실 일지에 날짜를 적은 것도, 분리수거장에 편지를 둔 것도 나다. …다음 사람에게 주려고.'),
        say('npc', '너는… 가라. 내 몫까지.'),
        narr('일기장 사이에 별 조각 하나가 끼워져 있다.'),
      ],
    },
    onDone: () => { const s = G(); s.findClue('C-13', reward); s.gainStar(4); withReport(ctx, 'M-11'); },
    })),
  });
}

/** 옥상 메뉴 (2층 계단 옆 철문) — World의 옥상 문에서 부른다 */
export function roofOptions(ctx: StoryCtx): MenuOption[] {
  const s = G();
  const opts: MenuOption[] = [];
  const ev = eveningNow();
  const withBuddy = (then: () => void) => { if (npcPresent('buddy', s.day)) ctx.place('buddy', 'hq2', 21.5, 1.5, 'up'); then(); };
  if (isOpen('D-02')) opts.push({ label: '🌌 동기와 별 보기 (추리 정리 2)', hint: ev ? '' : '19:00~21:20', disabled: !ev, onSelect: () => withBuddy(() => d02(ctx)) });
  // (별에게 대답한 뒤에는 되돌릴 수 없다: 엔딩이 이미 정해졌다)
  if (flag('m13') && !awaitingOrder('M-13') && !flag('buddyBack') && !flag('f01')) {
    const visited = ['m13_laundry', 'm13_cyber', 'm13_court'].filter(flag).length;
    opts.push({
      label: '💭 동기와 옥상에 오르기 (잊혀 가는 이름)', hint: visited < 3 ? `먼저 추억의 장소 ${visited}/3` : !freeNow() ? '점심·개인정비 시간' : '',
      disabled: visited < 3 || !freeNow() || !ctx.near('buddy', 3.5), onSelect: () => m13Roof(ctx),
    });
  }
  if (isOpen('D-03')) opts.push({ label: '🌌 돌아가는 방법 (추리 정리 3)', hint: ev ? '' : '19:00~21:20', disabled: !ev, onSelect: () => withBuddy(() => d03(ctx)) });
  if (!opts.length || opts.every((o) => o.disabled)) {
    opts.push({
      label: '옥상에서 하늘 보기', hint: ev ? '10분 (1일 1회)' : '19:00~21:20',
      disabled: !ev || s.daily.includes('roof'),
      onSelect: () => {
        const s2 = G();
        s2.spend(10); s2.markDaily('roof'); s2.applyEffects({ mental: 3 }, '옥상');
        const big = Math.max(0, s2.day - 5);
        ctx.play({ bg: 'roof', script: { lines: [narr(big > 4 ? '별 하나가 유난히 크다. 손을 뻗으면 닿을 것 같다.' : big > 1 ? '별이 어제보다 조금 크고, 낮아 보인다.' : '옥상 난간에 기대 하늘을 본다. 막사 불빛 너머로 별이 많다.')] } });
      },
    });
  }
  return opts;
}

/** D-02 추리 정리 2 「돌아가지 못한 사람들」 (🧩 P-16 추리 보드) */
function d02(ctx: StoryCtx) {
  ctx.play({
    bg: 'roof',
    script: {
      npc: 'buddy',
      lines: [
        narr('옥상 난간에 동기와 나란히 기댔다. 별이 어제보다 크다. 낮아졌다.'),
        say('buddy', '편지, 명찰, 사진, 일기장… 다 같은 얘기 같아.'),
        me('"이 부대에 갇힌 사람들은 왜 돌아가지 못했을까."'),
      ],
    },
    onDone: () => ctx.puzzle('P-16', (reward) => ctx.play({
      bg: 'roof',
      script: {
        npc: 'buddy',
        lines: [
          me('"길을 못 찾은 게 아니야. 별이 지기 전에 소원을 거두지 못한 거야. 겁이 나서."'),
          say('buddy', '……응. 겁이 나서.'),
          say('buddy', '…나도 사실 조금 무서워.'),
          say('buddy', '돌아가면 엄마가 울고 있을 것 같아서. 여기선 그냥… 엄마가 날 기다린다고 믿으면 되잖아.'),
          me('"그래도 진짜 엄마는 지금 옆에서 기다리고 있어. 편지 봤잖아."'),
          say('buddy', '……. 응.'),
        ],
      },
      onDone: () => {
        const s = G();
        s.applyEffects({ memory: reward, affinity: { buddy: 2 } }, '추리 정리 2');
        setFlag('d02');
        s.log('🧩 추리 정리 2: 돌아가지 못한 사람들은 마지막 밤, 겁이 나서 소원을 거두지 못했다.');
        withReport(ctx, 'D-02');
      },
    })),
  });
}

/** M-12 진자 자국: 탄약고(격납고·부두) → 위병소 → 분리수거장 */
function m12Box(ctx: StoryCtx) {
  const fac = FACILITY_NAME[G().branch];
  G().spend(10);
  ctx.play({
    script: { lines: [
      narr(`${fac} 울타리 옆, 자물쇠가 채워진 낡은 상자.`),
      narr('상자 둘레에 동그란 자국이 겹겹이 나 있다. 무언가를 바닥에 끌며 빙빙 돈 것 같은.'),
      me('(진자… 그날 밤 복도에서 본 그 자국이랑 똑같아.)'),
      narr('자국은 여기서 시작된 게 아니다. 상자를 빙 돌고는 또 어딘가로 뻗어 있다. 수첩을 꺼내 약도를 그렸다.'),
    ] },
    // 🧩 P-17: 약도 위에서 자국을 끝까지 따라가 봐야 어디로 갈지 안다
    onDone: () => ctx.puzzle('P-17', (reward) => ctx.play({
      script: { lines: [
        narr('약도 위의 선이 하나로 이어진다. 막사에서 나와, 분리수거장에서 끝난다.'),
        narr('먼저 위병소 쪽 자국부터 눈으로 확인해 보자.'),
      ] },
      onDone: () => {
        // 단서(+4)는 자국 끝에서 얻는다. 퍼즐 보상의 나머지는 여기서 준다
        if (reward > 4) G().applyEffects({ memory: reward - 4 }, '진자 자국');
        setFlag('trail1');
        G().toast('👣 자국이 위병소 초소 쪽으로 이어진다.', 'info');
      },
    })),
  });
}
function m12Post(ctx: StoryCtx) {
  G().spend(5);
  ctx.play({
    script: { lines: [narr('초소 옆 흙바닥에도 같은 자국. 위병은 아무것도 못 봤다고 고개를 젓는다.'), narr('자국은 분리수거장 쪽으로 이어진다.')] },
    onDone: () => { setFlag('trail2'); G().toast('👣 자국이 분리수거장 쪽으로 이어진다.', 'info'); },
  });
}
function m12End(ctx: StoryCtx) {
  G().spend(10);
  ctx.play({
    script: { lines: [
      narr('자국은 분리수거장을 지나, 병영식당 뒤 음식물 쓰레기통 앞에서 멈췄다.'),
      narr('뚜껑을 열자… 쓰레기 사이에서 별 조각이 반짝인다.'),
      me('(누군가 일부러 숨겼어. 그 당직부관이다.)'),
    ] },
    onDone: () => { const s = G(); s.findClue('C-14'); s.gainStar(5); withReport(ctx, 'M-12'); },
  });
}

// ═════════════════════════ 4장 「별이 지기 전에」 ═════════════════════════

/** M-13 시작: 10일차, 동기가 내 이름을 잊었다 */
export function buddyForgets(ctx: StoryCtx) {
  const s = G();
  if (flag('m13') || !npcPresent('buddy', s.day)) return false;
  ctx.play({
    bgm: 'bgm_12_unease',
    script: {
      npc: 'buddy',
      lines: [
        say('buddy', '…아, 안녕하십니까. 저… 누구셨더라?'),
        me('(……!)'),
        say('buddy', '어… 죄송합니다. 분명 아는 얼굴 같은데, 이름이…'),
        narr('달력이 한 장 거꾸로 넘어가 있다. 동기의 눈이 낯선 사람을 보듯 흔들린다.'),
        me('(기억이 먼저 사라진다더니… 이렇게 빨리.)'),
        narr('[동기가 뒤따라온다. 잊힌 기억은 함께한 자리에서 되살아날지도 모른다. 어디부터 되짚을지는, 자유 시간에 올 호출을 기다려 보자.]'),
      ],
    },
    onDone: () => { setFlag('m13'); G().addTip('잊힌 기억은 함께한 장소에서 되살아나기도 한다. "추억이 약이야." — 의무병'); },
  });
  return true;
}

const M13_SPOT: Partial<Record<SpotId, { key: string; lines: () => Line[]; bonus: () => Line[] | null }>> = {
  admin: {
    key: 'm13_laundry',
    lines: () => [say('buddy', '이 명찰… 준서. 이준서.'), say('buddy', '…이준서. 이거, 내 이름이야.')],
    bonus: () => (G().doneQuests.includes('q_buddy_laundry') ? [say('buddy', '여기서 같이 빨래 갰잖아. 네가 각 잡는 거 알려 줬어. 손바닥으로 탁탁.')] : null),
  },
  cyber: {
    key: 'm13_cyber',
    lines: () => [narr('싸지방 구석 자리. 둘이 나란히 앉던 컴퓨터.'), say('buddy', '여기… 와 본 적 있는 것 같아.')],
    bonus: () => (G().doneQuests.includes('q_buddy_result') ? [say('buddy', '맞다, 합격 발표! 우리 둘 다 붙었잖아. 소리 질렀다가 혼났지…!')] : null),
  },
  court: {
    key: 'm13_court',
    lines: () => [narr('농구장. 골대 그물이 바람에 흔들린다.'), say('buddy', '…너 슛 진짜 못했잖아.'), me('"…그건 기억하냐."')],
    bonus: () => (G().doneQuests.includes('q_junior_court') ? [say('buddy', '후임이랑 셋이서 했을 때, 네가 에어볼 세 번 연속 던졌어. 하하.')] : null),
  },
};
function m13Spot(ctx: StoryCtx, spot: SpotId) {
  const def = M13_SPOT[spot]!;
  const bonus = def.bonus();
  G().spend(15);
  const scene = (reward = 0) => ctx.play({
    script: { npc: 'buddy', lines: [...def.lines(), ...(bonus ?? [])] },
    onDone: () => { setFlag(def.key); G().applyEffects({ memory: Math.max(bonus ? 5 : 2, reward), affinity: { buddy: 2 } }, '잊혀 가는 이름'); },
  });
  if (spot !== 'admin') { scene(); return; }
  const sceneAdmin = scene;
  // 🧩 P-19: 그날의 명찰을 이번엔 동기와 나눠 맞춘다
  ctx.play({
    script: { npc: 'buddy', lines: [
      narr('행정반 분실물함. 주인 없는 장갑, 한 짝뿐인 양말, 그리고 바닥에 그 낡은 명찰.'),
      narr('명찰의 실밥이 다시 풀려 있다. 동기가 조각 몇 개를 집어 들고 한참 들여다본다.'),
      say('buddy', '…이거, 전에 같이 맞췄던 것 같은데. 절반은 제가 해 볼게요.'),
    ] },
    onDone: () => ctx.puzzle('P-19', (reward) => { sceneAdmin(reward); G().toast('💭 동기와 함께했던 곳을 마저 되짚어 보자: 싸지방 → 농구장 → 막사 옥상', 'info'); }),
  });
}
function m13Roof(ctx: StoryCtx) {
  G().spend(15);
  ctx.play({
    bg: 'roof',
    script: { npc: 'buddy', lines: [
      narr('옥상. 처음 별을 보러 왔던 그 난간.'),
      say('buddy', '…{me}.'),
      say('buddy', '미안. 잠깐 잊었어. 이제 안 잊어.'),
      narr('동기가 마지막까지 꼭 쥐고 있던 별 조각을 내 손바닥에 올려놓는다.'),
      say('buddy', '내 것까지 가져가. 그리고… 같이 가자. 이번엔 진짜로.'),
    ] },
    onDone: () => { const s = G(); s.applyEffects({ memory: 5, affinity: { buddy: 5 } }, '잊혀 가는 이름'); s.gainStar(7); setFlag('buddyBack'); s.log('💭 동기가 내 이름을, 그리고 자기 이름을 되찾았다.'); withReport(ctx, 'M-13'); },
  });
}

/** D-03 추리 정리 3 「돌아가는 방법」 (질문 2개) */
function d03(ctx: StoryCtx, q = 1) {
  const back = flag('buddyBack');
  if (q === 1) {
    ctx.play({
      bg: 'roof',
      script: {
        npc: 'buddy',
        lines: [
          narr('옥상. 별이 이제 손 닿을 듯 낮다.'),
          back ? say('buddy', '이제 다 모인 것 같아. 정리해 보자.') : say('buddy', '…저는 잘 모르겠지만, 같이 생각해 볼게요.'),
          me('"돌아가려면 무엇이 필요할까."'),
        ],
        quiz: true,
        choices: [
          { text: '정문 밖 안개를 뚫고 나가면 된다', grade: 'bad', reply: [narr('(정문 밖으로 나가도 초소 앞이었다. 그 길은 아니다.)')] },
          { text: '별 조각 일곱 개, 그리고 소원을 스스로 거두는 것', grade: 'good', reply: [say('buddy', back ? '병장님은 조각은 다 모았는데, 거두지 못했지. …마지막은 우리 마음이구나.' : '그 병장님은 조각을 다 모으고도 거두지 못했다고요? …그럼 마지막은 마음이군요.')] },
          { text: '전역일까지 무사히 버티면 된다', grade: 'bad', reply: [narr('(병장님은 10년을 버텼다. 버티는 것만으론 안 된다.)')] },
        ],
      },
      onChoice: (c) => { if (c.grade !== 'good') G().applyEffects({ memory: -2 }, '추리 정리 3'); else (ctx as unknown as { _q1?: boolean })._q1 = true; },
      onDone: () => { if ((ctx as unknown as { _q1?: boolean })._q1) { (ctx as unknown as { _q1?: boolean })._q1 = false; d03(ctx, 2); } else d03(ctx, 1); },
    });
    return;
  }
  ctx.play({
    bg: 'roof',
    script: {
      npc: 'buddy',
      lines: [me('"그럼… 별 조각을 숨기고, 진자 자국을 남긴 건 누굴까."')],
      quiz: true,
      choices: [
        { text: '말 없는 병장', grade: 'bad', reply: [narr('(병장님은 오히려 단서를 남겼다. 숨길 이유가 없다.)')] },
        { text: '밤마다 나타난 가짜 당직부관', grade: 'good', reply: [
          say('buddy', back ? '그 똑딱거리는 녀석… 그럼 내일 밤 위병소에 또 오겠네.' : '똑딱거리는… 왠지 그 소리, 저도 들어 본 것 같습니다. 내일 밤 위병소에 또 오겠네요.'),
          me('"응. 이번엔 안 넘어가."'),
        ] },
        { text: '도서관 관리병 네이티오', grade: 'bad', reply: [narr('(네이티오는 늘 수수께끼로 길을 알려 줬다. 방해한 적은 없다.)')] },
      ],
    },
    onChoice: (c) => {
      const s = G();
      if (c.grade === 'good') { s.applyEffects({ memory: 6 }, '추리 정리 3'); setFlag('d03'); s.log('🧩 추리 정리 3: 별 조각 일곱 개와 스스로 거두는 마음. 방해꾼은 가짜 당직부관.'); }
      else s.applyEffects({ memory: -2 }, '추리 정리 3');
    },
    onDone: () => { if (!flag('d03')) d03(ctx, 2); },
  });
}

/** B-01 꿈을 먹는 자 — 11일차 밤 위병소 초소. 3라운드 중 2라운드 이상 이기면 승리 */
export function slipperBoss(ctx: StoryCtx, onEnd: () => void, tries = 0) {
  const s = G();
  const rank = ['이병', '일병', '상병', '병장'][rankIdxForDay(s.day)];
  // 2라운드 반박 선택지: 호감이 높은 동료 둘
  const mates = presentNpcs(s.day).filter((id) => !NPC_ROLES[id].officer).sort((a, b) => s.affinity[b] - s.affinity[a]).slice(0, 2);
  let wins = 0;
  const round3 = () => {
    // 🧩 P-20c: 주어진 대답은 모두 오답. 내 이름을 직접 써야 한다
    ctx.play({ script: { custom: slipperSpeaker(true), lines: [say('npc', '그럼 그냥… 자. 푹 자. 아무도 안 깨울게…'), say('npc', '어차피 넌 이름도 없는 병사잖아. 마지막이야. 넌 누구지?'), narr('[3라운드: 대답하라]')] }, onDone: () =>
      ctx.puzzle('P-20c', () => { wins++; finish(); }, () => finish()) });
  };
  const finish = () => {
    const s2 = G();
    if (wins >= 2) {
      ctx.play({
        script: { custom: slipperSpeaker(true), lines: [
          narr('진자가 툭, 멈춘다. 안개가 걷히기 시작한다.'),
          say('npc', '…꿈은 언젠가 깨는 법이지.'),
          say('npc', '다음 별에서 보자, 꼬마.'),
          narr('슬리퍼가 안개 속으로 사라진 자리에, 별 조각이 떨어져 있다.'),
        ] },
        onDone: () => { s2.gainStar(6); setFlag('b01'); s2.applyEffects({ memory: 4, discipline: 3 }, '꿈을 먹는 자'); s2.log('🌀 꿈을 먹는 자, 슬리퍼를 물리쳤다.'); onEnd(); },
      });
      return;
    }
    s2.applyEffects({ memory: -15 }, '꿈을 먹는 자');
    if (tries === 0) {
      ctx.play({
        script: { custom: slipperSpeaker(true), lines: [say('npc', '후후… 벌써 눈꺼풀이 무겁지?'), narr('정신이 아득해진다… 하지만 아직 쓰러지진 않았다. 다시 일어서자!')] },
        onDone: () => slipperBoss(ctx, onEnd, 1),
      });
    } else {
      ctx.play({
        script: { custom: slipperSpeaker(true), lines: [say('npc', '잘 자, 꼬마. 그 조각은 내가 가져가지.'), narr('…눈을 떠 보니 새벽이다. 별 조각 하나를 끝내 되찾지 못했다.')] },
        onDone: () => { setFlag('b01'); setFlag('b01lost'); onEnd(); },
      });
    }
  };
  ctx.flash();
  ctx.play({
    script: {
      custom: slipperSpeaker(true),
      lines: [
        ...(tries === 0 ? [
          narr('초소에 도착하자 안개가 초소까지 밀려온다. 그 안에서 진자가 흔들린다. 똑딱, 똑딱.'),
          narr('옆의 근무자는 선 채로 꾸벅꾸벅 졸고 있다. 깨워도 일어나지 않는다.'),
          say('npc', `오랜만이군, ${rank}. 이제 내 진짜 얼굴을 보여 줄까.`),
          narr('당직부관의 모습이 녹아내리고 — 진자를 든 노란 포켓몬, 슬리퍼가 나타난다.'),
          say('npc', '왜 돌아가? 거기선 또 18개월이야. 새벽 기상, 혹한기, 불침번…'),
          say('npc', '여기선 영원히 편하게 지내면 돼. 저 말 없는 병장처럼.'),
        ] : [say('npc', '아직도 버티는 거야? …좋아, 한 번 더.')]),
        narr('[1라운드: 진자가 가려도 끝까지 세어라]'),
      ],
    },
    // 🧩 P-20a → P-20b → P-20c
    onDone: () => {
      const round2 = () => ctx.play({
        script: {
          custom: slipperSpeaker(true),
          lines: [say('npc', '여기 친구들도 다 있잖아. 돌아가면 다 잊혀. 어차피 꿈이었으니까.'), narr('[2라운드: 거짓을 짚어라]')],
        },
        onDone: () => ctx.puzzle('P-20b', () => {
          wins++;
          // 병장의 일기가 있으면 그것으로, 없으면 가장 가까운 동료와의 추억으로 반박한다
          const rebut = G().clues.includes('C-13')
            ? '"병장님 일기엔 겁이 나서 거두지 못했다고 적혀 있었어. 잘했다고 생각한 적, 한 번도 없어."'
            : `"${josa(memberName(s.branch, mates[0] ?? 'buddy'), '이랑', '랑')} 쌓은 건 안 잊혀. 남은 사람이 행복한지는, 네가 정하는 게 아니야."`;
          ctx.play({ script: { custom: slipperSpeaker(true), lines: [me(rebut), say('npc', '…쳇. 기억이 단단하군.')] }, onDone: round3 });
        }, () => ctx.play({ script: { custom: slipperSpeaker(true), lines: [say('npc', '그래, 그래. 그건 네가 제일 잘 알잖아.')] }, onDone: round3 })),
      });
      ctx.puzzle('P-20a', () => { wins++; round2(); }, () => round2());
    },
  });
}

/** F-01 별이 지기 전에 — 전역일, 연병장 구령대 */
export function finalStar(ctx: StoryCtx) {
  const s = G();
  // 말 없는 병장이 곁에 서는 건 함께 돌아가는 진 엔딩 길에서만 (동기가 이름을 되찾았을 때)
  const sgJoin = sergeantJoins(s) && flag('buddyBack');
  const sgName = extrasForDay(s.branch, s.day).find((d) => d.id === 'room2a')?.name ?? '말 없는 병장';
  const buddyHere = npcPresent('buddy', s.day);
  // 🌙 동기가 끝내 이름을 되찾지 못했다면(M-13 미완): 품고 있던 일곱 번째 조각을, 왜 쥐고 있는지도 모른 채 건넨다.
  //    조각은 일곱 개가 되지만 동기는 함께 돌아가지 못한다 → 노멀 엔딩으로 가는 길
  const handover = buddyHere && !flag('buddyBack') && !s.stars.includes(7);
  if (buddyHere) ctx.place('buddy', 'outdoor', 19.5, 19.5, 'up');
  if (sgJoin) ctx.place('x:room2a', 'outdoor', 21.5, 19.5, 'up');
  ctx.flash();
  const ask = (done: boolean) => {
    const cur = G();
    const enough = cur.stars.length >= 7 && cur.memory > 0;
    ctx.play({
      bg: 'parade',
      script: {
        custom: jirachiSpeaker(true),
        lines: [
          narr(done ? '창문 너머로 입대 전날 밤의 내 방이 보인다. 책상 위에는 입영통지서가 그대로 놓여 있다.' : '창문은 끝내 채워지지 않았다. 빈자리 너머는 안개뿐이다.'),
          say('npc', '소원을 거둘래? 돌아가면 넌 내일 아침, 진짜 훈련소에 가야 해.'),
          say('npc', '여기 남으면, 다신 아무 데도 안 가도 돼.'),
        ],
        choices: [
          { text: '"소원을 거둘게. …가기 싫었던 거 맞아. 그래도 내 발로 갈래."', grade: 'good', reply: [say('npc', enough ? '…응. 그 말 듣고 싶었어.' : '…미안. 그 마음이면 충분한데, 별빛이 모자라…')] },
          { text: '"…여기 남을래."', grade: 'bad', reply: [say('npc', '…그래. 그럼 푹 자.')] },
        ],
      },
      onChoice: (c) => {
        const end: StoryEnding = storyEnding(G(), c.grade === 'good');
        setFlag(`end_${end}`);
        setFlag('f01');
        G().log(end === 'true' ? '🌠 소원을 거뒀다. 함께.' : end === 'normal' ? '🌠 소원을 거뒀다. …혼자서.' : '🌠 별이 졌다.');
      },
      onDone: () => G().toast('🎖️ 이제 위병소 정문으로 가자. 전역이다.', 'info'),
    });
  };
  /** 지라치가 조각을 세고, 첫날 밤의 창문을 내민다 (동기가 조각을 건넸다면 그 뒤에) */
  const count = () => {
    const n = G().stars.length;
    ctx.play({
      bg: 'parade',
      script: {
        custom: jirachiSpeaker(true),
        lines: [
          say('npc', n < 7 ? `별 조각… ${n}개. 조금 모자라네.` : handover ? '별 조각 일곱 개. …마지막 하나는 친구가 끝까지 쥐고 있었구나.' : '별 조각 일곱 개. 다 모았구나.'),
          say('npc', '첫날 밤의 창문, 기억해? 가진 조각을 끼워 봐.'),
        ],
      },
      onDone: () => ctx.puzzle('P-21', () => ask(true), () => ask(false)),
    });
  };
  ctx.play({
    bg: 'parade',
    script: {
      custom: jirachiSpeaker(true),
      lines: [
        narr('대낮인데 별 하나가 천천히 내려와, 구령대 위에 내려앉는다.'),
        narr(`${sgJoin ? josa(flag('buddyBack') ? buddyName() : '동기', '과', '와') + ' ' + sgName : flag('buddyBack') ? buddyName() : '동기'}도 말없이 곁에 섰다.`),
        ...(handover ? [
          narr('동기가 꼭 쥐고 있던 주먹을 편다. 손바닥 위에, 작은 별 조각 하나.'),
          say('buddy', '…저, 이거요. 왜 쥐고 있는지는 모르겠는데, 놓으면 안 될 것 같아서 계속 쥐고 있었습니다.'),
          say('buddy', '그쪽 거 같습니다. 이유는 모르겠지만… 가져가십시오.'),
          me('(…끝내 내 이름은 못 찾았구나.)'),
          narr('조각을 받아 든다. 동기는 여전히, 처음 보는 사람을 보듯 나를 본다.'),
        ] : []),
      ],
    },
    onDone: () => { if (handover) G().gainStar(7); count(); },
  });
}

/** 돌탑의 화강돌을 만났다면, 돌아가는 순간 돌탑에서 일어나는 일 */
function cairnFarewell(): Line[] {
  if (!G().clues.includes('C-16')) return [];
  return flag('cairnPromise')
    ? [narr('분리수거장 쪽에서 돌 굴러떨어지는 소리가 들린다. 작은 보랏빛 하나가 별빛을 따라 올라온다.'), narr('"…박태윤. 기억해 줘서 고마워." 겹겹의 목소리 중 하나가, 처음으로 혼자 말했다.')]
    : [narr('분리수거장 쪽에서 아주 작게, 백일곱 개의 목소리가 "잘 가" 하고 말했다. 아무도 뒤돌아보지 않았다.')];
}

/** 탄약고 군견의 인식표를 찾았다면, 돌아가는 순간 */
function ammoFarewell(): Line[] {
  if (!G().clues.includes('C-17')) return [];
  return flag('ammoTagDog')
    ? [narr('탄약고 쪽에서 컹, 하고 한 번 짖는 소리. 하데리어가 처음으로 문이 아니라 하늘을 보고 있다. 목줄의 인식표가 별빛에 반짝인다.')]
    : [narr('주머니 속 인식표가 따뜻해진다. 「한도윤」. 이 이름은 가지고 간다.')];
}

/** 엔딩 대본 (전역 결산 화면 전에) */
export function endingLines(end: StoryEnding): Line[] {
  const s = G();
  const sgName = extrasForDay(s.branch, s.day).find((d) => d.id === 'room2a')?.name ?? '병장';
  if (end === 'true') {
    const sg = sergeantJoins(s);
    return [
      narr('별빛이 우리를 감싼다.'),
      ...(sg ? [narr(`${josa(sgName, '이', '가')} 처음으로 웃는다.`), narr('"…고맙다. 이번엔, 나도 간다."')] : []),
      ...cairnFarewell(),
      ...ammoFarewell(),
      narr('(암전)'),
      narr('훈련소 생활관. 새벽. 낯선 천장.'),
      me('(…돌아왔다.)'),
      narr('옆 침상에서 누군가 몸을 일으킨다.'),
      narr('"…야. 너, 맞지?"'),
      me(`"…준서야."`),
      ...(sg ? [narr('복도 라디오: "10년간 의식이 없던 강민혁 씨가 오늘 새벽 깨어났습니다—"')] : []),
      narr('조교: "기상! 기상!!"'),
      me('(가기 싫었다. 그래도, 이제 간다.)'),
      narr('🌠 진 엔딩 「같은 날, 같은 별 아래」 — 준서와 함께'),
    ];
  }
  if (end === 'normal') {
    return [
      narr('"…친구는, 아직 대답을 못 찾았나 봐."'),
      ...cairnFarewell(),
      ...ammoFarewell(),
      narr('훈련소 첫날 밤. 옆 침상은 비어 있다.'),
      narr('창밖, 별똥별 하나가 떨어진다.'),
      me('(준서야. 꼭 와라.)'),
      narr('🌙 노멀 엔딩 「혼자 돌아온 밤」'),
    ];
  }
  return [
    narr('기억이 하얗게 흩어진다.'),
    narr('다음 날 아침, 1생활관.'),
    narr('분대장: "오늘 신병 전입 온다. 다들 잘해 줘라."'),
    narr('문이 열리고 — 내 얼굴을 한 신병이 들어온다.'),
    ...(s.clues.includes('C-16') ? [narr('같은 시각, 분리수거장 구석의 돌탑에 이끼 없는 돌 하나가 얹혔다. 백여덟.')] : []),
    ...(s.clues.includes('C-17') ? [narr('탄약 수불 대장 금요일 줄, 비어 있던 두 번째 서명 칸에 내 이름이 적혔다.')] : []),
    me('……'),
    narr('나는 "……"밖에 말할 수 없었다.'),
    narr('🌑 배드 엔딩 「영원한 이병」'),
  ];
}

// ═════════════════════════ 장소 · 사람에 붙는 선택지 ═════════════════════════

/** 장소 메뉴 맨 위에 붙는 스토리 선택지 */
export function storySpotOptions(spot: SpotId, ctx: StoryCtx): MenuOption[] {
  if (!storyOn()) return [];
  const s = G();
  const opts: MenuOption[] = [];
  const free = freeNow();
  const add = (id: string, label: string, run: () => void, needFree = true) => {
    if (!isOpen(id)) return;
    // 식사 시간엔 분대와 먼저 밥을 먹어야 한다 (자유 시간이 아니어도 되는 미션도 마찬가지)
    const due = eventDue(G());
    const locked = mealPending() || due || (needFree && !free);
    opts.push({ label, hint: mealPending() ? '🍚 먼저 분대와 식사' : due ? '⏰ 집합 시간 — 일정부터' : locked ? '점심·개인정비 시간에' : '📖 스토리', disabled: locked, onSelect: run });
  };
  switch (spot) {
    case 'cyber': add('M-05', '🔍 인터넷 편지함 확인', () => m05(tone(ctx, 'bgm_12_unease'))); break;
    case 'command': add('M-07', '🔍 근무 일지 살펴보기', () => m07(tone(ctx, 'bgm_12_unease')), false); break;
    case 'recycle': add('M-08', '🔍 폐지 더미 정리하기', () => m08(tone(ctx, 'bgm_12_unease')), false); break;
    case 'cairn': add('S-01', '🪨 쐐기돌의 금 들여다보기', () => s01(tone(ctx, 'bgm_12_unease'))); break;
    case 'ammoledger': add('S-02', '📒 금요일 줄 맞춰 보기', () => s02(tone(ctx, 'bgm_09_mystery_clues'))); break;
    case 'maint': add('M-09', '📻 구석의 라디오 켜기', () => m09(tone(ctx, 'bgm_12_unease'))); break;
    case 'library': {
      if (isOpen('M-10')) {
        const key = flag('archiveKey');
        opts.push({
          label: key ? '🔑 안쪽 방 문 열기 (기록 보관실)' : '🔒 도서관 안쪽의 잠긴 문',
          hint: !key ? '열쇠가 필요하다 (중대장 / 행정반 루브도)' : !free ? '점심·개인정비 시간에' : '📖 스토리',
          disabled: !key || !free, onSelect: () => m10(tone(ctx, 'bgm_09_mystery_clues')),
        });
      }
      break;
    }
    case 'ammo': if (isOpen('M-12') && !flag('trail1')) add('M-12', '🔍 잠긴 상자 주변 살펴보기', () => m12Box(tone(ctx, 'bgm_09_mystery_clues'))); break;
    case 'post': if (isOpen('M-12') && flag('trail1') && !flag('trail2') && !s.nightDuty) add('M-12', '👣 진자 자국 따라가기', () => m12Post(tone(ctx, 'bgm_09_mystery_clues'))); break;
    default: break;
  }
  if (spot === 'recycle' && isOpen('M-12') && flag('trail2')) add('M-12', '👣 자국 끝까지 따라가기', () => m12End(tone(ctx, 'bgm_09_mystery_clues')));
  // 잊혀 가는 이름: 동기와 함께 추억의 장소
  const m13 = M13_SPOT[spot];
  // (행정보급관에게 분실물함 정리를 지시받은 뒤부터: 호출 전에 그 자리에 가도 장면이 시작되지 않는다)
  if (m13 && flag('m13') && !awaitingOrder('M-13') && !flag('buddyBack') && !flag(m13.key)) {
    const near = ctx.near('buddy', 3.5);
    opts.push({ label: '💭 동기와 추억 떠올리기', hint: !free ? '점심·개인정비 시간에' : !near ? '동기가 곁에 있어야 한다' : '📖 스토리', disabled: !free || !near, onSelect: () => m13Spot(tone(ctx, 'bgm_13_rooftop_stars'), spot) });
  }
  return opts;
}

/** 주요 인물 메뉴에 붙는 스토리 선택지 */
export function storyNpcOptions(id: NpcId, ctx: StoryCtx): MenuOption[] {
  if (!storyOn()) return [];
  const s = G();
  const opts: MenuOption[] = [];
  const free = freeNow();
  if (id === 'buddy') {
    // 📖 동기가 나를 잊은 동안엔, 서로 아는 사이여야 하는 지난 미션을 함께할 수 없다 (기억을 되찾은 뒤에)
    const forgot = flag('m13') && !flag('buddyBack');
    const forgotHint = '동기가 나를 기억하지 못한다';
    if (isOpen('M-06')) opts.push({ label: '🧺 "같이 빨래하러 가자"', hint: forgot ? forgotHint : free ? '📖 스토리' : '점심·개인정비 시간에', disabled: forgot || !free, onSelect: () => m06(tone(ctx, 'bgm_12_unease')) });
    if (isOpen('D-01')) {
      const ev = eveningNow();
      opts.push({ label: '🗣️ "남아서 같이 정리하자" (추리 정리 1)', hint: forgot ? forgotHint : ev ? '체단실에서' : '19:00~21:20', disabled: forgot || !ev, onSelect: () => ctx.goTo('gymroom', 6.5, 6.5, 'right', () => { ctx.alone('gymroom', ['buddy']); ctx.place('buddy', 'gymroom', 7.5, 6.5, 'left'); d01(tone(ctx, 'bgm_09_mystery_clues')); }) });
    }
  }
  // 7일차 밤 당직 간부: "어젯밤 당직부관?"
  if (s.day === 8 && flag('n03') && !flag('n03ask') && id === dutyOfficerOf(7)) {
    opts.push({
      label: '🌀 "어젯밤 당직부관님은 누구셨습니까?"', hint: '📖',
      onSelect: () => {
        G().spend(5);
        ctx.play({ bgm: 'bgm_12_unease', script: { npc: id, lines: [say('npc', '어젯밤 당직부관? 어젯밤 당직은 나 혼자였는데.'), say('npc', '…누굴 봤다고? 근무 서다 졸았구먼. 오늘은 일찍 자라.'), me('(…역시. 그건 사람이 아니었어.)')] }, onDone: () => setFlag('n03ask') });
      },
    });
  }
  return opts;
}

/** 엑스트라 메뉴에 붙는 스토리 선택지 (도서관 관리병 · 행정병 · 말 없는 병장) */
export function storyExtraOptions(id: string, ctx: StoryCtx): MenuOption[] {
  if (!storyOn()) return [];
  const s = G();
  const opts: MenuOption[] = [];
  const free = freeNow();
  if (id === 'librarian') {
    const n02late = !s.clues.includes('C-11') && s.day > 5;
    const n04late = s.clues.includes('C-11') && !s.clues.includes('C-15') && s.day > 9;
    if (n02late || n04late) {
      opts.push({ label: '🌙 "밤의 서가"에 대해 묻기', hint: free ? '📖 스토리' : '점심·개인정비 시간에', disabled: !free, onSelect: () => {
        G().spend(10);
        ctx.play({ script: { custom: extraSpeaker('librarian'), lines: [say('npc', '…밤의 서가는 낮과 다른 말을 한다.'), say('npc', '보고 싶으냐. …불을 끄마.')] }, onDone: () => libraryLightsOut(ctx, true) });
      } });
    }
  }
  // 기록 보관실 열쇠: 중대장에게 보관실 정리를 지시받은 뒤에만 부탁할 수 있다
  if (id === 'clerk' && isOpen('M-10') && !flag('archiveKey')) {
    opts.push({ label: '🎨 "기록 보관실 열쇠 좀…" (그림 모델)', hint: '가만히 서 있기', onSelect: () => {
      ctx.play({
        script: { custom: extraSpeaker('clerk'), lines: [
          say('npc', '보관실 열쇠? 중대장님 거라 함부로는 안 되는데…'),
          say('npc', '…대신 그림 모델 좀 해 줄래? 꼬리로 그림 그리는 중인데 모델이 자꾸 움직여서.'),
          narr('[가만히 서 있자! 아무 키도 누르지 말 것]'),
        ] },
        onDone: () => ctx.resist({ title: '🎨 그림 모델', sub: '아무 키도 누르지 마라… 움직이면 처음부터', mode: 'still', secs: 6 }, (ok) => {
          if (!ok) { ctx.play({ script: { custom: extraSpeaker('clerk'), lines: [say('npc', '아, 움직였잖아! 처음부터 다시 그려야겠다. 나중에 다시 와.')] } }); return; }
          G().spend(30);
          ctx.play({
            script: { custom: extraSpeaker('clerk'), lines: [say('npc', '…완성! 꽤 잘 나왔지? 자, 약속한 거.'), narr('루브도가 주위를 살피더니, 녹슨 열쇠를 슬쩍 건넨다.'), say('npc', '저녁 점호 전까지만 돌려줘. 우리 둘만 아는 거다.')] },
            onDone: () => { setFlag('archiveKey'); G().toast('🔑 기록 보관실 열쇠를 얻었다. 도서관 안쪽 방으로!', 'good'); },
          });
        }),
      });
    } });
  }
  if (id === 'room2a' && isOpen('M-11')) {
    opts.push({ label: '🖼️ 단체 사진 이야기를 꺼낸다', hint: free ? '📖 스토리' : '점심·개인정비 시간에', disabled: !free, onSelect: () => m11(tone(ctx, 'bgm_13_rooftop_stars')) });
  }
  return opts;
}

/** 진급 신고(7일차, 상병) 때 중대장이 서고 열쇠를 건넨다 (군기 60 이상) */
export function promotionKeyLines(): Line[] | null {
  const s = G();
  if (!storyOn() || rankIdxForDay(s.day) !== 2 || flag('archiveKey') || s.stats.discipline < 60) return null;
  return [
    say('npc', '…신고 좋다. 그런데 너, 요즘 도서관에 자주 간다더군.'),
    say('npc', '기록은 거짓말을 하지 않는다. 다만 읽는 사람이 겁을 낼 뿐이지.'),
    narr('중대장이 서랍에서 녹슨 열쇠를 꺼내 건넨다. 도서관 안쪽, 기록 보관실 열쇠다.'),
  ];
}

/** 11일차 저녁 엄마와의 통화 (휴대폰) */
export function phoneCallLines(): Line[] | null {
  const s = G();
  if (!storyOn() || s.day !== 11) return null;
  return [
    narr('"…아들. 의사 선생님이 그러는데, 네가 꿈을 꾸는 것 같대."'),
    narr('"괜찮아. 가기 싫으면 싫다고 해도 돼. 근데 엄마는, 네가 해낼 거 알아."'),
    me('(…엄마.)'),
  ];
}
