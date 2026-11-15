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
import { useGame, presentNpcs } from '../state/store';
import { BRANCHES, FACILITY_NAME, TOTAL_DAYS, rankIdxForDay } from '../data/branches';
import { NPC_IDS, NPC_ROLES, npcPresent } from '../data/npcs';
import { extraLook, extrasForDay } from '../data/extras';
import { isFreeTimeEvening, isMealTime } from '../data/schedule';
import { memberName } from '../engine/whereabouts';
import { STORY_MISSIONS, missionState, sergeantJoins, storyEnding, type StoryEnding } from '../data/story';

// ───────── 연결 (World가 넘겨준다) ─────────
export type StoryBg = 'roof' | 'archive' | 'library' | 'parade' | 'radio';
export interface StoryScene { script: DialogueScript; bg?: StoryBg; onChoice?: (c: Choice) => void; onDone?: () => void }
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
  resist: (o: ResistOpts, done: (ok: boolean) => void) => void;
  flash: () => void;
}

const G = () => useGame.getState();
const storyOn = () => G().clues.length > 0;
const mission = (id: string) => STORY_MISSIONS.find((m) => m.id === id)!;
const isOpen = (id: string) => storyOn() && missionState(mission(id), G()) === 'open';
const flag = (k: string) => !!G().flags[k];
const freeNow = () => { const m = G().minute; return isFreeTimeEvening(m) || isMealTime(m); };
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

const say = (who: LineWho, text: string): Line => ({ who, text });
const narr = (text: string) => say('narr', text);
const me = (text: string) => say('me', text);

// ═════════════════════════ 2장 「이상한 부대」 ═════════════════════════

/** M-05 싸지방: 보낸 날짜가 없는 편지 */
function m05(ctx: StoryCtx) {
  G().spend(20);
  ctx.play({
    script: { lines: [
      narr('싸지방 컴퓨터로 인터넷 편지함을 열었다.'),
      narr('받은 편지함 맨 위에, 날짜 칸이 비어 있는 편지가 한 통 있다. 보낸 사람: 엄마.'),
      narr('『아들, 어디 아프니? 아침에 아무리 깨워도 안 일어나서 병원에 왔어.』'),
      narr('『의사 선생님은 그냥 깊이 잠든 거래. 엄마가 계속 옆에 있을게.』'),
      narr('답장 버튼을 눌러 본다. …딸깍. 딸깍. 눌리지 않는다.'),
      me('(현실의 나는… 자고 있구나. 입대 날 아침에도 못 일어난 채로.)'),
    ] },
    onDone: () => G().findClue('C-05'),
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
      onDone: () => G().findClue('C-06'),
    });
  });
}

/** M-07 지휘통제실: 멈춘 시계 */
function m07(ctx: StoryCtx) {
  const s = G();
  const left = TOTAL_DAYS - s.day;
  s.spend(5);
  ctx.play({
    script: { lines: [
      narr('상황판 옆에 걸린 지휘통제실 근무 일지를 넘겨 본다.'),
      narr('「00:00 시계 정지 (1분)」 「00:00 시계 정지 (1분)」 「00:00 시계 정지 (1분)」…'),
      narr('날짜만 다를 뿐, 매일 같은 줄이 적혀 있다. 그리고 마지막 칸엔 낯선 필체로 —'),
      narr(`「별이 질 때까지 D-${left}」`),
      me(`(D-${left}… 별이 지는 날이 전역일이라면.)`),
      narr('벽시계를 올려다본다. 초침이 아주 잠깐, 멈췄다 간 것 같다.'),
    ] },
    onDone: () => G().findClue('C-07'),
  });
}

/** D-01 추리 정리 1 「우리는 왜?」 (1생활관, 동기와 침상에 걸터앉아) */
function d01(ctx: StoryCtx, retry = false) {
  const lines: Line[] = retry
    ? [narr('다시 단서 카드를 하나씩 짚어 본다. 별 조각 · 거울 · 생일자 명단 · 엄마의 편지.'), me('"우리가 포켓몬이 된 건…"')]
    : [
      me(`"…${buddyName()}. 할 얘기가 있어."`),
      narr('침상에 걸터앉아 그동안 모은 것들을 하나씩 늘어놓았다. 별 조각 · 거울 · 생일자 명단 · 엄마의 편지.'),
      say('buddy', '이게… 다 뭐야?'),
      me('"우리가 포켓몬이 된 건…"'),
    ];
  ctx.play({
    script: {
      npc: 'buddy',
      lines,
      choices: [
        { text: '입대 스트레스 때문에 꾸는 악몽이다', grade: 'bad', reply: [say('buddy', '악몽이라기엔… 밥이 너무 맛있잖아. 그건 좀 아닌 것 같아.')] },
        { text: '입대 전날 밤, 별똥별에게 빈 소원 때문이다', grade: 'good', reply: [
          say('buddy', '……'),
          say('buddy', '나도… 그날 밤 별을 봤어.'),
          say('buddy', '엄마 곁을 떠나기 싫다고 빌었어. 그거 하나는 확실히 기억나.'),
          narr(`(${josa(buddyName(), '이', '가')} 주머니에서 꺼낸 별 조각이, 내 것과 똑같이 반짝인다.)`),
          say('buddy', '이거, 네가 가져. 너라면 끝까지 갈 것 같아.'),
          say('buddy', '…아, 그리고. 2층 계단 옆 옥상 문이 열려 있더라. 나중에 별 보러 가자.'),
        ] },
        { text: '부대에 숨겨진 비밀 실험 때문이다', grade: 'bad', reply: [say('buddy', '실험이면 간부님들이 저렇게 태평하겠어? 행보관님은 오늘도 제초 얘기만 하셨는데.')] },
      ],
    },
    onChoice: (c) => {
      const s = G();
      if (c.grade === 'good') {
        s.applyEffects({ memory: 6, affinity: { buddy: 3 }, flag: 'roof' }, '추리 정리 1');
        s.gainStar(2);
        setFlag('d01');
        s.log('🧩 추리 정리 1: 우리가 포켓몬이 된 건 입대 전날 밤 별에 빈 소원 때문이다.');
      } else s.applyEffects({ memory: -2 }, '추리 정리 1');
    },
    onDone: () => { if (!flag('d01')) d01(ctx, true); else G().toast('🔓 막사 2층 계단 옆 옥상 철문이 열렸다 (19:00~21:20).', 'info'); },
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
  ctx.play({
    bg: 'library',
    script: {
      custom: natu,
      lines: [
        byDay ? narr('네이티오가 말없이 스위치를 내린다. 도서관이 깜깜해진다.') : narr('손전등을 껐다. 불 꺼진 도서관이 완전한 어둠에 잠긴다.'),
        narr('어둠 속에서 종이 조각 같은 것들이 사르르 모여든다. 글자다. 아니, 포켓몬이다 — 안농.'),
        narr(second ? '이번엔 끝까지 모인다. 서가 위에 한 줄이 완성된다.' : '서가 위에 안농들이 한 줄로 늘어선다.'),
        narr(words),
        ...(second
          ? [narr(byDay ? '어느새 네이티오가 서가 꼭대기에 올라앉아, 어두운 창밖을 보고 있다.' : '서가 꼭대기에 네이티오가 앉아 있다. 해가 없는 밤인데도, 창밖을 보고 있다.'), say('npc', '…이제 반은 왔다. 나머지 반은, 네 마음이다.')]
          : [narr(byDay ? '네이티오가 스위치를 다시 올리자, 안농들이 흩어진다.' : '손전등을 다시 켜자 안농들이 흩어진다.'), narr('그 자리에 별 조각 하나가 떨어져 있다.')]),
      ],
    },
    onDone: () => {
      const s2 = G();
      if (!second) { s2.findClue('C-11'); s2.gainStar(3); }
      else s2.findClue('C-15');
    },
  });
  return true;
}

/** M-08 분리수거장: 부치지 못한 편지 */
function m08(ctx: StoryCtx) {
  G().spend(15);
  ctx.play({
    script: { lines: [
      narr('폐지 더미를 정리하다 손이 멈췄다. 종이 사이로 봉투들이 쏟아진다. 우표도, 주소도 없다.'),
      narr('해마다 다른 필체로 쓴 편지들. 내용은 전부 같다.'),
      narr('『집에 가고 싶다』 『집에 가고 싶다』 『집에 가고 싶다』'),
      narr('한 장만 내용이 다르다.'),
      narr('『다음에 오는 사람에게. 도서관 안쪽 방을 봐라. — 강』'),
      me('(…나보다 먼저 온 사람이 있었어. 그것도 여러 명.)'),
    ] },
    onDone: () => G().findClue('C-09'),
  });
}

/** M-09 정비실: 라디오 다이얼 맞추기 (3번) */
function m09(ctx: StoryCtx, step = 0, seq = Array.from({ length: 3 }, () => (Math.random() < 0.5 ? 0 : 1)), retry = false) {
  if (step === 0 && !retry) G().spend(15);
  const noise = ['치이익…', '지지직… 치익…', '…삐… 치이…'][step];
  ctx.play({
    bg: 'radio',
    script: {
      lines: retry
        ? [narr(`${noise} 다이얼을 반대로 돌려 보자.`)]
        : step === 0
        ? [narr('공구함 뒤 구석에 먼지 쌓인 라디오가 있다. 전원을 켜자 잡음이 쏟아진다.'), narr(`${noise} 다이얼을 천천히 돌려 보자.`)]
        : [narr(`${noise} 조금만 더…`)],
      choices: [
        { text: '◀ 다이얼을 왼쪽으로', grade: 'ok', reply: [narr(seq[step] === 0 ? '…잡음이 줄어든다!' : '지지직! 오히려 시끄러워졌다.')] },
        { text: '다이얼을 오른쪽으로 ▶', grade: 'ok', reply: [narr(seq[step] === 1 ? '…잡음이 줄어든다!' : '지지직! 오히려 시끄러워졌다.')] },
      ],
    },
    onChoice: (c) => { (ctx as unknown as { _ok?: boolean })._ok = (c.text.startsWith('◀') ? 0 : 1) === seq[step]; },
    onDone: () => {
      const ok = (ctx as unknown as { _ok?: boolean })._ok;
      if (!ok) { m09(ctx, step, seq, true); return; }
      if (step < 2) { m09(ctx, step + 1, seq); return; }
      ctx.play({
        bg: 'radio',
        script: { lines: [
          narr('잡음이 걷히고, 규칙적인 소리가 들린다. 삐… 삐… 심전도 소리다.'),
          narr('『…아직 깨어나지 않았습니다. 같은 날 밤 쓰러진 청년이 또 한 명…』'),
          narr('치이익. 다시 잡음.'),
          me(`(또 한 명… ${josa(buddyName(), '이', '')}다.)`),
        ] },
        onDone: () => G().findClue('C-10'),
      });
    },
  });
}

// ═════════════════════════ 3장 「떡밥을 따라서」 ═════════════════════════

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
      narr('…이상하다. 사진마다 맨 앞줄 같은 자리에, 같은 얼굴의 이병이 서 있다.'),
      narr(`10년 전 사진. 그 이병은 — 2분대의 말 없는 병장, ${sg?.name ?? '그 병장'}이다.`),
      narr('바닥 먼지 위에 누군가의 발자국이 있다. 오래된 것과… 오늘 것.'),
      me('(사진을 한 장 챙겼다. 직접 물어봐야겠어.)'),
    ] },
    onDone: () => G().findClue('C-12'),
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
        narr('[졸음을 버텨라! Space 연타]'),
      ],
    },
    onDone: () => ctx.resist({ title: '🌀 똑딱, 똑딱…', sub: 'Space 연타! 눈을 감으면 안 된다', mode: 'mash', secs: 5, rise: 0.45 }, (ok) => {
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
    }),
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
        narr('『별 조각을 일곱 개 모았다. 마지막 밤, 별이 물었다. 돌아가겠느냐고.』'),
        narr('『나는 겁이 났다. 돌아가면, 다시 가야 하니까. 그래서 아무 말도 못 했다.』'),
        say('npc', '지휘통제실 일지에 날짜를 적은 것도, 분리수거장에 편지를 둔 것도 나다. …다음 사람에게 주려고.'),
        say('npc', '너는… 가라. 내 몫까지.'),
        narr('일기장 사이에 별 조각 하나가 끼워져 있다.'),
      ],
    },
    onDone: () => { const s = G(); s.findClue('C-13'); s.gainStar(4); },
  });
}

/** 옥상 메뉴 (2층 계단 옆 철문) — World의 옥상 문에서 부른다 */
export function roofOptions(ctx: StoryCtx): MenuOption[] {
  const s = G();
  const opts: MenuOption[] = [];
  const ev = eveningNow();
  const withBuddy = (then: () => void) => { if (npcPresent('buddy', s.day)) ctx.place('buddy', 'hq2', 21.5, 1.5, 'up'); then(); };
  if (isOpen('D-02')) opts.push({ label: '🌌 동기와 별 보기 (추리 정리 2)', hint: ev ? '' : '19:00~21:20', disabled: !ev, onSelect: () => withBuddy(() => d02(ctx)) });
  if (flag('m13') && !flag('buddyBack')) {
    const visited = ['m13_laundry', 'm13_cyber', 'm13_court'].filter(flag).length;
    opts.push({
      label: '💭 동기와 옥상에 오르기 (잊혀 가는 이름)', hint: visited < 3 ? `먼저 추억의 장소 ${visited}/3` : !freeNow() ? '점심·개인정비 시간' : '',
      disabled: visited < 3 || !freeNow() || !ctx.near('buddy', 3.5), onSelect: () => m13Roof(ctx),
    });
  }
  if (isOpen('D-03')) opts.push({ label: '🌌 돌아가는 방법 (추리 정리 3)', hint: ev ? '' : '19:00~21:20', disabled: !ev, onSelect: () => withBuddy(() => d03(ctx)) });
  if (!opts.length || opts.every((o) => o.disabled)) {
    opts.push({
      label: '옥상에서 하늘 보기', hint: ev ? '10분 · 멘탈+3 (1일 1회)' : '19:00~21:20',
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

/** D-02 추리 정리 2 「돌아가지 못한 사람들」 */
function d02(ctx: StoryCtx, retry = false) {
  ctx.play({
    bg: 'roof',
    script: {
      npc: 'buddy',
      lines: retry ? [me('"…다시 생각해 보자. 그 사람들은 왜…"')] : [
        narr('옥상 난간에 동기와 나란히 기댔다. 별이 어제보다 크다. 낮아졌다.'),
        say('buddy', '편지, 명찰, 사진, 일기장… 다 같은 얘기 같아.'),
        me('"이 부대에 갇힌 사람들은 왜 돌아가지 못했을까."'),
      ],
      choices: [
        { text: '탈출구를 끝내 못 찾아서', grade: 'bad', reply: [say('buddy', '병장님은 별 조각을 일곱 개나 모았다잖아. 길은 찾았던 거야.')] },
        { text: '별이 지기 전에 소원을 거두지 못했고, 돌아가길 포기해서', grade: 'good', reply: [
          say('buddy', '……응. 겁이 나서.'),
          say('buddy', '…나도 사실 조금 무서워.'),
          say('buddy', '돌아가면 엄마가 울고 있을 것 같아서. 여기선 그냥… 엄마가 날 기다린다고 믿으면 되잖아.'),
          me('"그래도 진짜 엄마는 지금 옆에서 기다리고 있어. 편지 봤잖아."'),
          say('buddy', '……. 응.'),
        ] },
        { text: '간부들이 몰래 막고 있어서', grade: 'bad', reply: [say('buddy', '중대장님이 열쇠까지 주셨는데? 막을 생각이면 그러진 않았겠지.')] },
      ],
    },
    onChoice: (c) => {
      const s = G();
      if (c.grade === 'good') { s.applyEffects({ memory: 6, affinity: { buddy: 2 } }, '추리 정리 2'); setFlag('d02'); s.log('🧩 추리 정리 2: 돌아가지 못한 사람들은 마지막 밤, 겁이 나서 소원을 거두지 못했다.'); }
      else s.applyEffects({ memory: -2 }, '추리 정리 2');
    },
    onDone: () => { if (!flag('d02')) d02(ctx, true); },
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
      narr('자국이 위병소 쪽으로 이어진다.'),
    ] },
    onDone: () => { setFlag('trail1'); G().toast('👣 자국이 위병소 초소 쪽으로 이어진다.', 'info'); },
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
    onDone: () => { const s = G(); s.findClue('C-14'); s.gainStar(5); },
  });
}

// ═════════════════════════ 4장 「별이 지기 전에」 ═════════════════════════

/** M-13 시작: 10일차, 동기가 내 이름을 잊었다 */
export function buddyForgets(ctx: StoryCtx) {
  const s = G();
  if (flag('m13') || !npcPresent('buddy', s.day)) return false;
  ctx.play({
    script: {
      npc: 'buddy',
      lines: [
        say('buddy', '…아, 안녕하십니까. 저… 누구셨더라?'),
        me('(……!)'),
        say('buddy', '어… 죄송합니다. 분명 아는 얼굴 같은데, 이름이…'),
        narr('달력이 한 장 거꾸로 넘어가 있다. 동기의 눈이 낯선 사람을 보듯 흔들린다.'),
        me('(기억이 먼저 사라진다더니… 이렇게 빨리.)'),
        narr('[동기와 함께했던 곳을 다시 찾아가자: 세탁실 → 싸지방 → 농구장 → 막사 옥상. 동기가 뒤따라온다.]'),
      ],
    },
    onDone: () => { setFlag('m13'); G().addTip('잊힌 기억은 함께한 장소에서 되살아나기도 한다. "추억이 약이야." — 의무병'); },
  });
  return true;
}

const M13_SPOT: Partial<Record<SpotId, { key: string; lines: () => Line[]; bonus: () => Line[] | null }>> = {
  laundry1: {
    key: 'm13_laundry',
    lines: () => [narr('세탁기 앞. 그날 나온 낡은 전투복이 아직 선반에 개켜져 있다.'), say('buddy', '이 명찰… 준서. 이준서.'), say('buddy', '…이준서. 이거, 내 이름이야.')],
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
  ctx.play({
    script: { npc: 'buddy', lines: [...def.lines(), ...(bonus ?? [])] },
    onDone: () => { setFlag(def.key); G().applyEffects({ memory: bonus ? 5 : 2, affinity: { buddy: 2 } }, '잊혀 가는 이름'); },
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
    onDone: () => { const s = G(); s.applyEffects({ memory: 5, affinity: { buddy: 5 } }, '잊혀 가는 이름'); s.gainStar(7); setFlag('buddyBack'); s.log('💭 동기가 내 이름을, 그리고 자기 이름을 되찾았다.'); },
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
        choices: [
          { text: '정문 밖 안개를 뚫고 나가면 된다', grade: 'bad', reply: [narr('(정문 밖으로 나가도 초소 앞이었다. 그 길은 아니다.)')] },
          { text: '별 조각 일곱 개, 그리고 소원을 스스로 거두는 것', grade: 'good', reply: [say('buddy', '병장님은 조각은 다 모았는데, 거두지 못했지. …마지막은 우리 마음이구나.')] },
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
      choices: [
        { text: '말 없는 병장', grade: 'bad', reply: [narr('(병장님은 오히려 단서를 남겼다. 숨길 이유가 없다.)')] },
        { text: '밤마다 나타난 가짜 당직부관', grade: 'good', reply: [
          say('buddy', '그 똑딱거리는 녀석… 그럼 내일 밤 위병소에 또 오겠네.'),
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
    // 군기·호감이 높을수록 졸음이 천천히 찬다
    const avg = NPC_IDS.reduce((a, id) => a + s.affinity[id], 0) / NPC_IDS.length;
    const rise = Math.max(0.3, 0.62 - s.stats.discipline / 400 - Math.max(0, avg) / 300);
    ctx.play({ script: { custom: slipperSpeaker(true), lines: [say('npc', '그럼 그냥… 자. 푹 자. 아무도 안 깨울게…'), narr('[3라운드: 버텨라! Space 연타]')] }, onDone: () =>
      ctx.resist({ title: '💤 3라운드: 버티기', sub: 'Space 연타! 잠들면 끝이다', mode: 'mash', secs: 6, rise }, (ok) => { if (ok) wins++; finish(); }) });
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
        narr('[1라운드: 진자를 보지 마라! ←→ 번갈아 눌러 시선 돌리기]'),
      ],
    },
    onDone: () => ctx.resist({ title: '🌀 1라운드: 진자를 보지 마라', sub: '← → 번갈아 누르기', mode: 'alt', secs: 5, rise: 0.5 }, (ok1) => {
      if (ok1) wins++;
      ctx.play({
        script: {
          custom: slipperSpeaker(true),
          lines: [say('npc', '여기 친구들도 다 있잖아. 돌아가면 다 잊혀. 어차피 꿈이었으니까.'), narr('[2라운드: 반박하라]')],
          choices: [
            ...mates.map((id) => ({
              text: `"${josa(memberName(s.branch, id), '이랑', '랑')} 쌓은 건 안 잊혀. 그게 날 여기까지 데려왔어."`, grade: 'good' as const,
              reply: [say('npc', '…쳇. 기억이 단단하군.')],
            })),
            { text: '"…그건, 그렇네. 어차피 꿈이니까."', grade: 'bad' as const, reply: [say('npc', '그래, 그래. 그렇게 생각하면 편하지.')] },
          ],
        },
        onChoice: (c) => { if (c.grade === 'good') wins++; },
        onDone: round3,
      });
    }),
  });
}

/** F-01 별이 지기 전에 — 전역일, 연병장 구령대 */
export function finalStar(ctx: StoryCtx) {
  const s = G();
  const sgJoin = sergeantJoins(s);
  const sgName = extrasForDay(s.branch, s.day).find((d) => d.id === 'room2a')?.name ?? '말 없는 병장';
  const n = s.stars.length;
  if (npcPresent('buddy', s.day)) ctx.place('buddy', 'outdoor', 19.5, 19.5, 'up');
  if (sgJoin) ctx.place('x:room2a', 'outdoor', 21.5, 19.5, 'up');
  ctx.flash();
  ctx.play({
    bg: 'parade',
    script: {
      custom: jirachiSpeaker(true),
      lines: [
        narr('대낮인데 별 하나가 천천히 내려와, 구령대 위에 내려앉는다.'),
        narr(`${sgJoin ? josa(flag('buddyBack') ? buddyName() : '동기', '과', '와') + ' ' + sgName : flag('buddyBack') ? buddyName() : '동기'}도 말없이 곁에 섰다.`),
        say('npc', n >= 7 ? '별 조각 일곱 개. 다 모았구나.' : `별 조각… ${n}개. 조금 모자라네.`),
        say('npc', '소원을 거둘래? 돌아가면 넌 내일 아침, 진짜 훈련소에 가야 해.'),
        say('npc', '여기 남으면, 다신 아무 데도 안 가도 돼.'),
      ],
      choices: [
        { text: '"소원을 거둘게. …가기 싫었던 거 맞아. 그래도 내 발로 갈래."', grade: 'good', reply: [say('npc', n >= 7 && s.memory > 0 ? '…응. 그 말 듣고 싶었어.' : '…미안. 그 마음이면 충분한데, 별빛이 모자라…')] },
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
    opts.push({ label, hint: needFree && !free ? '점심·개인정비 시간에' : '📖 스토리', disabled: needFree && !free, onSelect: run });
  };
  switch (spot) {
    case 'cyber': add('M-05', '🔍 인터넷 편지함 확인', () => m05(ctx)); break;
    case 'command': add('M-07', '🔍 근무 일지 살펴보기', () => m07(ctx), false); break;
    case 'recycle': add('M-08', '🔍 폐지 더미 속 봉투들', () => m08(ctx), false); break;
    case 'maint': add('M-09', '📻 구석의 라디오 켜기', () => m09(ctx)); break;
    case 'library': {
      if (isOpen('M-10')) {
        const key = flag('archiveKey');
        opts.push({
          label: key ? '🔑 안쪽 방 문 열기 (기록 보관실)' : '🔒 도서관 안쪽의 잠긴 문',
          hint: !key ? '열쇠가 필요하다 (중대장 / 행정반 루브도)' : !free ? '점심·개인정비 시간에' : '📖 스토리',
          disabled: !key || !free, onSelect: () => m10(ctx),
        });
      }
      break;
    }
    case 'ammo': if (isOpen('M-12') && !flag('trail1')) add('M-12', '🔍 잠긴 상자 주변 살펴보기', () => m12Box(ctx)); break;
    case 'post': if (isOpen('M-12') && flag('trail1') && !flag('trail2') && !s.nightDuty) add('M-12', '👣 진자 자국 따라가기', () => m12Post(ctx)); break;
    default: break;
  }
  if (spot === 'recycle' && isOpen('M-12') && flag('trail2')) add('M-12', '👣 자국 끝까지 따라가기', () => m12End(ctx));
  // 잊혀 가는 이름: 동기와 함께 추억의 장소
  const m13 = M13_SPOT[spot];
  if (m13 && flag('m13') && !flag('buddyBack') && !flag(m13.key)) {
    const near = ctx.near('buddy', 3.5);
    opts.push({ label: '💭 동기와 추억 떠올리기', hint: !free ? '점심·개인정비 시간에' : !near ? '동기가 곁에 있어야 한다' : '📖 스토리', disabled: !free || !near, onSelect: () => m13Spot(ctx, spot) });
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
    if (isOpen('M-06')) opts.push({ label: '🧺 "같이 빨래하러 가자"', hint: free ? '📖 스토리' : '점심·개인정비 시간에', disabled: !free, onSelect: () => m06(ctx) });
    if (isOpen('D-01')) {
      const ev = eveningNow();
      opts.push({ label: '🗣️ "할 얘기가 있어" (추리 정리 1)', hint: ev ? '1생활관에서' : '19:00~21:20', disabled: !ev, onSelect: () => ctx.goTo('room1', 3.5, 4.5, 'right', () => { ctx.place('buddy', 'room1', 4.5, 4.5, 'left'); d01(ctx); }) });
    }
  }
  // 7일차 밤 당직 간부: "어젯밤 당직부관?"
  if (s.day === 8 && flag('n03') && !flag('n03ask') && id === dutyOfficerOf(7)) {
    opts.push({
      label: '🌀 "어젯밤 당직부관님은 누구셨습니까?"', hint: '📖',
      onSelect: () => {
        G().spend(5);
        ctx.play({ script: { npc: id, lines: [say('npc', '어젯밤 당직부관? 어젯밤 당직은 나 혼자였는데.'), say('npc', '…누굴 봤다고? 근무 서다 졸았구먼. 오늘은 일찍 자라.'), me('(…역시. 그건 사람이 아니었어.)')] }, onDone: () => setFlag('n03ask') });
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
  if (id === 'clerk' && s.day >= 7 && !flag('archiveKey') && s.clues.includes('C-09')) {
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
    opts.push({ label: '🖼️ 단체 사진 이야기를 꺼낸다', hint: free ? '📖 스토리' : '점심·개인정비 시간에', disabled: !free, onSelect: () => m11(ctx) });
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
