/**
 * 오프닝(사람 시절) 방을 위한 도트 그래픽.
 * - 방은 타일 16px 해상도로 그린 뒤 정수 배율로 확대해 또렷한 도트를 유지한다.
 * - 주인공은 16x21 픽셀 스프라이트 (4방향 × [서기, 걷기A, 걷기B]).
 *   포켓몬 4세대 필드 캐릭터와 같은 비율·화법으로 새로 그린 오리지널 도트다 (기존 캐릭터를 옮겨 그린 것이 아니다).
 * - 배경도 같은 화풍에 맞췄다: 가구는 윗면/앞면을 나눠 칠하고, 바닥에 그림자를 떨어뜨린다.
 */
import type { Dir } from './drawMonster';

export const PX = 16; // 저해상도 타일 크기

// ───────────── 주인공 스프라이트 ─────────────
// 포켓몬 4세대 필드 캐릭터의 문법을 따른다: 몸의 절반이 넘는 큰 머리, 검은 외곽선,
// 점 하나짜리 눈(위에 붉은 그늘 한 점), 옆으로 살짝 벌린 팔, 짧은 다리.
const PALETTE: Record<string, string> = {
  K: '#101018', // 외곽선
  H: '#584028', // 짧은 머리 (그늘)
  h: '#805838', // 짧은 머리
  i: '#a87850', // 짧은 머리 (정수리 윤기)
  S: '#f8d0b8', // 피부
  s: '#d89870', // 피부 그늘
  e: '#783840', // 눈두덩 그늘
  E: '#101018', // 눈
    B: '#9080e0', // 반팔 티
  b: '#6858b0', // 반팔 티 그늘
  L: '#b0a0f0', // 반팔 티 밝은 면
  P: '#b89860', // 반바지
  p: '#907040', // 반바지 그늘
  O: '#e8e8f0', // 운동화
};

const HEAD_TOP = [
  '......KKKK......',
  '....KKhiihKK....',
  '...KhiihhiihK...',
  '...KhhhhhhhhK...',
  '..KhhhhhhhhhhK..',
  '..KhhhhhhhhhhK..',
];
const FRONT_LEGS = [
  '.....KPPPpK.....',
  '.....KSKKSK.....',
  '....KOOKKOOK....',
  '....KKKKKKKK....',
];
const DOWN = [
  ...HEAD_TOP,
  '..KHSSSSSSSSHK..',
  '..KSSSSSSSSSSK..',
  '..KSSeSSSSeSSK..',
  '..KsSESSSSESsK..',
  '...KsSSSSSSsK...',
  '....KKsSSsKK....',
  '....KBBKKBBK....',
  '...KLBBBBBBLK...',
  '...KsBBBBBBsK...',
  '...KSKBBBBKSK...',
  '....KKbBBbKK....',
  ...FRONT_LEGS,
];
const UP = [
  ...HEAD_TOP,
  '..KhhhhhhhhhhK..',
  '..KhhhhhhhhhhK..',
  '..KShhhhhhhhSK..',
  '..KsHhhhhhhHsK..',
  '...KHHhhhhHHK...',
  '....KKSSSSKK....',
  '....KBBBBBBK....',
  '...KLBBBBBBLK...',
  '...KsBBBBBBsK...',
  '...KSKBBBBKSK...',
  '....KKbBBbKK....',
  ...FRONT_LEGS,
];
/** 정면·뒷면 걷기: 한 발은 내딛고 한 발은 든다 */
const FRONT_WALK_LEGS = [
  '.....KPPPpK.....',
  '.....KSKKOOK....',
  '....KOOKKKKK....',
  '....KKKK........',
];
const LEFT = [
  '......KKKK......',
  '....KKiihhKK....',
  '...KhiihhhhhK...',
  '...KhhhhhhhhK...',
  '..KhhhhhhhhhhK..',
  '..KShhhhhhhhHK..',
  '..KSSShhhhhhHK..',
  '..KSSSSShHhhHK..',
  '..KSeSSSsKhHK...',
  '..KSESSSSshK....',
  '...KsSSSSsK.....',
  '....KKsSsK......',
  '......KBBK......',
  '.....KLBBbK.....',
  '.....KBSsbK.....',
  '.....KBSsbK.....',
  '.....KbBBbK.....',
  '.....KPPPpK.....',
  '......KSSsK.....',
  '.....KOOOK......',
  '.....KKKKK......',
];
/** 옆모습 걷기 A: 크게 벌린 보폭 */
const SIDE_STRIDE = [
  '.....KPPPpK.....',
  '.....KSKKSK.....',
  '....KOOK.KOOK...',
  '....KKKK.KKKK...',
];
/** 옆모습 걷기 B: 두 발이 엇갈리는 순간 */
const SIDE_PASS = [
  '.....KPPPpK.....',
  '......KSSK......',
  '......KOOK......',
  '......KKKK......',
];

const mirror = (rows: string[]) => rows.map((r) => r.split('').reverse().join(''));
const withLegs = (body: string[], legs: string[]) => [...body.slice(0, 17), ...legs];

/** dir별 [서기, 걷기A, 걷기B] */
const FRAMES: Record<Dir, string[][]> = {
  down: [DOWN, withLegs(DOWN, FRONT_WALK_LEGS), withLegs(DOWN, mirror(FRONT_WALK_LEGS))],
  up: [UP, withLegs(UP, FRONT_WALK_LEGS), withLegs(UP, mirror(FRONT_WALK_LEGS))],
  left: [LEFT, withLegs(LEFT, SIDE_STRIDE), withLegs(LEFT, SIDE_PASS)],
  right: [mirror(LEFT), mirror(withLegs(LEFT, SIDE_STRIDE)), mirror(withLegs(LEFT, SIDE_PASS))],
};

export const SPRITE_W = 16;
export const SPRITE_H = 21;
const spriteCache = new Map<string, HTMLCanvasElement>();

function spriteCanvas(dir: Dir, frame: number): HTMLCanvasElement {
  const key = `${dir}${frame}`;
  const c0 = spriteCache.get(key);
  if (c0) return c0;
  const rows = FRAMES[dir][frame];
  const c = document.createElement('canvas');
  c.width = SPRITE_W; c.height = SPRITE_H;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => row.split('').forEach((ch, x) => {
    const col = PALETTE[ch];
    if (!col) return;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }));
  spriteCache.set(key, c);
  return c;
}

/** (cx, footY) 기준으로 주인공을 그린다. frame: 0 서기, 1·2 걷기 */
export function drawPixelHuman(g: CanvasRenderingContext2D, cx: number, footY: number, dir: Dir, frame: number) {
  // 둥근 그림자 (걷느라 몸이 떠도 그림자는 바닥에 붙어 있다)
  const sx = Math.round(cx), sy = Math.round(footY + (frame ? 1 : 0));
  g.fillStyle = 'rgba(20,16,40,0.28)';
  g.fillRect(sx - 2, sy - 3, 4, 1);
  g.fillRect(sx - 4, sy - 2, 8, 2);
  g.fillRect(sx - 2, sy, 4, 1);
  g.drawImage(spriteCanvas(dir, frame), Math.round(cx - SPRITE_W / 2), Math.round(footY - SPRITE_H));
}

// ───────────── 방 그리기 ─────────────
type G = CanvasRenderingContext2D;
const OUT = '#181018';
const SHADE = 'rgba(40,24,30,0.22)';
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const box = (g: G, x: number, y: number, w: number, h: number, fill: string, out = OUT) => { R(g, x, y, w, h, out); R(g, x + 1, y + 1, w - 2, h - 2, fill); };

interface Wood { top: string; hi: string; front: string; lo: string }
const OAK: Wood = { top: '#cf9a62', hi: '#e6b680', front: '#a8733f', lo: '#86572c' };
const WALNUT: Wood = { top: '#a97448', hi: '#c48e5c', front: '#855430', lo: '#663d20' };

/**
 * 가구 한 덩이: 윗면(topH) + 앞면, 윗면 가장자리 하이라이트, 바닥에 떨어지는 그림자.
 * 위에서 비스듬히 내려다보는 시점이라 윗면이 보인다.
 */
function block(g: G, x: number, y: number, w: number, h: number, topH: number, m: Wood, shadow = true) {
  if (shadow) R(g, x + 1, y + h, w - 1, 2, SHADE);
  R(g, x, y, w, h, OUT);
  R(g, x + 1, y + 1, w - 2, topH - 1, m.top);
  R(g, x + 1, y + 1, w - 2, 1, m.hi);
  R(g, x + 1, y + topH, w - 2, h - topH - 1, m.front);
  R(g, x + 1, y + topH, w - 2, 1, m.lo);
  R(g, x + 1, y + h - 2, w - 2, 1, m.lo);
}

// 가구 기준 좌표 (정적 배경과 움직이는 부분이 같은 값을 쓴다)
const TV = { x: 6 * PX + 2, y: PX - 1, w: 22, h: 15 };
const MON = { x: PX + 2, y: 2 * PX - 11, w: 13, h: 10 };
const WIN = { x: 8 * PX - 1, y: 5, w: 18, h: 19 };
const NOTICE = { x: 3 * PX + 3, y: 2 * PX + 1 };
const PHONE = { x: 9 * PX + 6, y: 2 * PX + 2 };

/** 움직이지 않는 방 배경 (W x H 타일) */
export function renderRoomStatic(W: number, H: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W * PX; c.height = H * PX;
  const g = c.getContext('2d')!;

  // ── 마루: 가로로 긴 널빤지, 줄마다 이음매가 어긋난다 ──
  for (let ty = 2; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++) {
    const x = tx * PX, y = ty * PX;
    R(g, x, y, PX, PX, '#dba968');
    R(g, x, y, PX, 1, '#e8ba7c'); R(g, x, y + 8, PX, 1, '#e8ba7c');
    R(g, x, y + 7, PX, 1, '#bd8a4c'); R(g, x, y + 15, PX, 1, '#bd8a4c');
    R(g, x + ((tx * 5 + ty * 3) % 11) + 2, y + 1, 1, 6, '#c9965a');
    R(g, x + ((tx * 7 + ty * 5) % 11) + 2, y + 9, 1, 6, '#c9965a');
    if ((tx * 3 + ty * 7) % 5 === 0) R(g, x + 5, y + 3, 4, 1, '#cfa062');
    if ((tx * 5 + ty) % 4 === 0) R(g, x + 9, y + 12, 3, 1, '#e8ba7c');
  }

  // ── 벽지 (위 2줄): 세로 줄무늬 + 몰딩 + 걸레받이 ──
  const wallW = (W - 2) * PX;
  R(g, PX, 0, wallW, 2 * PX, '#f3ead2');
  for (let x = PX + 3; x < (W - 1) * PX; x += 8) R(g, x, 3, 2, 2 * PX - 9, '#e8dcbc');
  for (let x = PX + 7; x < (W - 1) * PX; x += 8) R(g, x, 9, 1, 1, '#d9c9a2');
  R(g, PX, 0, wallW, 1, '#6e5440'); R(g, PX, 1, wallW, 2, '#9a7856'); R(g, PX, 3, wallW, 1, '#e0d2b0');
  R(g, PX, 2 * PX - 6, wallW, 1, '#d9c9a2');
  R(g, PX, 2 * PX - 5, wallW, 5, '#a9733f');
  R(g, PX, 2 * PX - 5, wallW, 1, '#cf9a62'); R(g, PX, 2 * PX - 1, wallW, 1, '#6e4826');
  // 벽이 바닥에 드리우는 그림자
  R(g, PX, 2 * PX, wallW, 2, 'rgba(60,36,30,0.28)'); R(g, PX, 2 * PX + 2, wallW, 1, 'rgba(60,36,30,0.12)');
  R(g, PX, 2 * PX, 2, (H - 3) * PX, 'rgba(60,36,30,0.16)');

  // ── 바깥 벽 ──
  R(g, 0, 0, PX, H * PX, '#3b3442'); R(g, (W - 1) * PX, 0, PX, H * PX, '#3b3442');
  R(g, 0, (H - 1) * PX, W * PX, PX, '#3b3442');
  R(g, PX - 3, 0, 2, (H - 1) * PX + 3, '#544a5e'); R(g, (W - 1) * PX + 1, 0, 2, (H - 1) * PX + 3, '#544a5e');
  R(g, PX - 3, (H - 1) * PX + 1, (W - 2) * PX + 6, 2, '#544a5e');
  R(g, PX - 1, 0, 1, (H - 1) * PX + 1, '#231d28'); R(g, (W - 1) * PX, 0, 1, (H - 1) * PX + 1, '#231d28');
  R(g, PX - 1, (H - 1) * PX, (W - 2) * PX + 2, 1, '#231d28');

  // ── 러그 (5~7, 5~6): 테두리 + 마름모 무늬 + 술 ──
  const rx = 5 * PX + 1, ry = 5 * PX + 2, rw = 3 * PX - 2, rh = 2 * PX - 4;
  R(g, rx + 1, ry + rh, rw - 1, 1, SHADE);
  for (let i = 0; i < rh; i += 2) { R(g, rx - 1, ry + i + 1, 1, 1, '#e8e2d0'); R(g, rx + rw, ry + i + 1, 1, 1, '#e8e2d0'); }
  box(g, rx, ry, rw, rh, '#5f7fd0', '#34467e');
  R(g, rx + 2, ry + 2, rw - 4, rh - 4, '#f2efe4'); R(g, rx + 3, ry + 3, rw - 6, rh - 6, '#6f8fdc');
  R(g, rx + 3, ry + 3, rw - 6, 1, '#86a4ea');
  for (let i = 0; i < 4; i++) {
    const dx = rx + 8 + i * 10, dy = ry + rh / 2;
    R(g, dx, dy - 3, 2, 6, '#f2efe4'); R(g, dx - 2, dy - 1, 6, 2, '#f2efe4'); R(g, dx, dy - 1, 2, 2, '#e8b04c');
  }

  // ── 벽 장식 ──
  // 밀리터리 잡지 부록 포스터 (책상 위 벽)
  box(g, 2 * PX + 9, 5, 13, 16, '#34507a', '#2a2230');
  R(g, 2 * PX + 10, 6, 11, 5, '#5d86b8'); R(g, 2 * PX + 10, 15, 11, 5, '#3f6a4a');
  R(g, 2 * PX + 12, 11, 7, 2, '#dfe6ee'); R(g, 2 * PX + 14, 9, 3, 2, '#dfe6ee'); R(g, 2 * PX + 11, 13, 3, 1, '#b8c2cf'); R(g, 2 * PX + 17, 13, 3, 1, '#b8c2cf');
  R(g, 2 * PX + 11, 17, 6, 1, '#f0d060');
  // 전신 거울 (4,1)
  R(g, 4 * PX + 4, 27, 10, 1, SHADE);
  box(g, 4 * PX + 3, 4, 11, 23, '#b98850');
  R(g, 4 * PX + 4, 5, 9, 1, '#d8a868');
  R(g, 4 * PX + 5, 6, 7, 19, '#bfe4f4'); R(g, 4 * PX + 5, 6, 7, 1, '#8fbcd4'); R(g, 4 * PX + 5, 6, 1, 19, '#8fbcd4');
  R(g, 4 * PX + 7, 8, 1, 9, '#ffffff'); R(g, 4 * PX + 9, 8, 1, 4, '#e6f6fc');
  // 달력 (5,1)
  R(g, 5 * PX + 9, 4, 1, 2, '#6e5440');
  box(g, 5 * PX + 3, 6, 12, 15, '#fbfaf4');
  R(g, 5 * PX + 4, 7, 10, 3, '#de4a4a'); R(g, 5 * PX + 6, 8, 2, 1, '#fbfaf4'); R(g, 5 * PX + 10, 8, 2, 1, '#fbfaf4');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) R(g, 5 * PX + 5 + j * 2, 12 + i * 2, 1, 1, '#9a9aa6');
  R(g, 5 * PX + 10, 15, 3, 1, '#de4a4a'); R(g, 5 * PX + 10, 19, 3, 1, '#de4a4a'); R(g, 5 * PX + 9, 16, 1, 3, '#de4a4a'); R(g, 5 * PX + 13, 16, 1, 3, '#de4a4a');
  // 창문 (8,1): 틀 + 커튼 + 창턱 — 유리 안쪽 밤하늘은 애니메이션에서
  box(g, WIN.x - 2, WIN.y - 2, WIN.w + 4, WIN.h + 4, '#9a6a42');
  R(g, WIN.x - 1, WIN.y - 1, WIN.w + 2, 1, '#bd8a58');
  R(g, WIN.x - 4, WIN.y + WIN.h + 2, WIN.w + 8, 2, OUT); R(g, WIN.x - 3, WIN.y + WIN.h + 2, WIN.w + 6, 1, '#cf9a62');
  R(g, WIN.x - 6, WIN.y - 4, WIN.w + 12, 2, '#6e5440');
  for (const cx of [WIN.x - 6, WIN.x + WIN.w + 1]) {
    box(g, cx, WIN.y - 3, 5, WIN.h + 6, '#8fb0d8', '#4a5f86');
    R(g, cx + 1, WIN.y - 2, 1, WIN.h + 4, '#b4cdea'); R(g, cx + 3, WIN.y - 2, 1, WIN.h + 4, '#6f8fbd');
    R(g, cx, WIN.y + WIN.h - 4, 5, 1, '#e8b04c');
  }
  // 벽시계 (침대 위): 22시
  box(g, 10 * PX + 11, 5, 10, 10, '#fbfaf4', '#4a3c38');
  R(g, 10 * PX + 11, 5, 1, 1, '#f3ead2'); R(g, 10 * PX + 20, 5, 1, 1, '#f3ead2'); R(g, 10 * PX + 11, 14, 1, 1, '#f3ead2'); R(g, 10 * PX + 20, 14, 1, 1, '#f3ead2');
  R(g, 10 * PX + 15, 7, 1, 3, '#2a2230'); R(g, 10 * PX + 13, 8, 2, 1, '#2a2230'); R(g, 10 * PX + 15, 9, 1, 1, '#de4a4a');

  // ── 책상 (1~3, 2) ──
  block(g, PX, 2 * PX - 3, 3 * PX, PX + 2, 9, OAK);
  // 서랍
  box(g, 3 * PX - 2, 2 * PX + 7, 15, 6, '#b88048', '#86572c'); R(g, 3 * PX + 4, 2 * PX + 9, 3, 1, '#f0d060');
  R(g, PX + 2, 2 * PX + 7, 1, 6, '#86572c');
  // 모니터 + 키보드
  R(g, MON.x + 4, MON.y + MON.h, 5, 2, '#3a4250'); R(g, MON.x + 2, MON.y + MON.h + 2, 9, 1, '#2a2230');
  box(g, MON.x, MON.y, MON.w, MON.h, '#525c6e', '#2a2230');
  box(g, PX + 3, 2 * PX + 2, 11, 4, '#e4e6ee', '#6c7080'); R(g, PX + 4, 2 * PX + 3, 9, 1, '#b9bdcc');
  // 스탠드 (불이 켜져 있다)
  R(g, 2 * PX + 4, 2 * PX + 3, 6, 2, '#4a4f5c'); R(g, 2 * PX + 6, 2 * PX - 4, 1, 7, '#6c7080'); R(g, 2 * PX + 3, 2 * PX - 5, 4, 1, '#6c7080');
  box(g, 2 * PX, 2 * PX - 10, 7, 5, '#f6e3a0', '#8a7038'); R(g, 2 * PX + 1, 2 * PX - 9, 5, 1, '#fff6cc');
  R(g, 2 * PX - 1, 2 * PX - 4, 9, 5, 'rgba(255,240,170,0.28)');
  // 의자 (책상 밑으로 반쯤 밀어 넣은 등받이)
  R(g, 2 * PX + 3, 3 * PX + 7, 10, 1, SHADE);
  R(g, 2 * PX + 3, 3 * PX + 4, 2, 3, OUT); R(g, 2 * PX + 11, 3 * PX + 4, 2, 3, OUT);
  box(g, 2 * PX + 2, 3 * PX + 1, 12, 4, '#434c5e');
  box(g, 2 * PX + 3, 3 * PX - 3, 10, 6, '#5a6478'); R(g, 2 * PX + 4, 3 * PX - 2, 8, 1, '#7a859a'); R(g, 2 * PX + 5, 3 * PX, 6, 1, '#434c5e');

  // ── TV장 + TV + 게임기 (6~7, 2) ──
  block(g, 6 * PX, 2 * PX + 1, 2 * PX, PX - 2, 6, WALNUT);
  R(g, 6 * PX + 15, 2 * PX + 8, 1, 5, '#663d20'); R(g, 6 * PX + 11, 2 * PX + 10, 2, 1, '#f0d060'); R(g, 6 * PX + 19, 2 * PX + 10, 2, 1, '#f0d060');
  R(g, TV.x + 8, TV.y + TV.h, 6, 2, '#2a2230'); R(g, TV.x + 5, TV.y + TV.h + 2, 12, 1, '#2a2230');
  box(g, TV.x, TV.y, TV.w, TV.h, '#3a3a46', '#1e1a24');
  R(g, TV.x + TV.w - 3, TV.y + TV.h - 2, 1, 1, '#68f0a0');
  // 게임기: 회색 본체 + 패드
  box(g, 7 * PX + 7, 2 * PX + 2, 8, 4, '#c9ccd8', '#5a5e6e'); R(g, 7 * PX + 8, 2 * PX + 3, 2, 1, '#58c8f0');
  R(g, 7 * PX + 4, 2 * PX + 4, 3, 1, '#2a2230'); box(g, 7 * PX + 1, 2 * PX + 3, 4, 3, '#8d92a6', '#3a3e4c');

  // ── 협탁 (9, 2) ──
  block(g, 9 * PX + 1, 2 * PX - 1, 14, PX, 7, OAK);
  box(g, 9 * PX + 3, 2 * PX + 8, 10, 5, '#b88048', '#86572c'); R(g, 9 * PX + 7, 2 * PX + 10, 2, 1, '#f0d060');

  // ── 침대 (10~11, 2~3): 머리판 · 베개 · 이불 · 발판 ──
  const bx = 10 * PX, by = 2 * PX - 6, bw = 2 * PX, bh = 2 * PX + 6;
  R(g, bx + 1, by + bh, bw - 1, 2, SHADE); R(g, bx - 2, by + 8, 2, bh - 8, 'rgba(40,24,30,0.14)');
  R(g, bx, by, bw, bh, OUT);
  R(g, bx + 1, by + 1, bw - 2, 6, '#a9733f'); R(g, bx + 1, by + 1, bw - 2, 1, '#cf9a62'); R(g, bx + 1, by + 5, bw - 2, 1, '#86572c');
  R(g, bx + 1, by + 7, bw - 2, bh - 12, '#f6f4ee');
  box(g, bx + 4, by + 8, bw - 8, 8, '#ffffff', '#b4b6c8'); R(g, bx + 5, by + 14, bw - 10, 1, '#dcdde8'); R(g, bx + 6, by + 10, 5, 1, '#eceef6');
  R(g, bx + 1, by + 18, bw - 2, bh - 23, '#5078c8');
  R(g, bx + 1, by + 18, bw - 2, 3, '#e8eefa'); R(g, bx + 1, by + 21, bw - 2, 1, '#35579e'); R(g, bx + 1, by + 22, bw - 2, 1, '#7ea6ea');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const px = bx + 4 + i * 9 + (j % 2) * 4, py = by + 25 + j * 5;
    R(g, px, py, 2, 2, '#f0d060'); R(g, px - 1, py, 1, 2, '#7ea6ea');
  }
  R(g, bx + bw - 4, by + 23, 3, bh - 28, '#35579e');
  R(g, bx + 1, by + bh - 5, bw - 2, 4, '#a9733f'); R(g, bx + 1, by + bh - 5, bw - 2, 1, '#cf9a62'); R(g, bx + 1, by + bh - 2, bw - 2, 1, '#86572c');

  // ── 책장 (1, 6~7) ──
  const sx = PX + 1, sy = 6 * PX - 9, sw = 14, sh = 2 * PX + 8;
  R(g, sx + 1, sy + sh, sw - 1, 2, SHADE); R(g, sx + sw, sy + 6, 2, sh - 6, 'rgba(40,24,30,0.14)');
  R(g, sx, sy, sw, sh, OUT);
  R(g, sx + 1, sy + 1, sw - 2, 4, WALNUT.top); R(g, sx + 1, sy + 1, sw - 2, 1, WALNUT.hi);
  R(g, sx + 1, sy + 5, sw - 2, sh - 6, '#5e3a20');
  const books = ['#de4a4a', '#4f7ac8', '#f0b030', '#58b058', '#9858d0', '#f08838', '#48b0b0'];
  for (let r = 0; r < 4; r++) {
    const y0 = sy + 6 + r * 8;
    for (let i = 0; i < 4; i++) {
      const k = (r * 3 + i * 5) % books.length, bh2 = 5 + ((r + i) % 2);
      R(g, sx + 2 + i * 3, y0 + 6 - bh2, 2, bh2, books[k]); R(g, sx + 2 + i * 3, y0 + 6 - bh2, 1, 1, '#ffffff');
    }
    R(g, sx + 1, y0 + 6, sw - 2, 2, WALNUT.front); R(g, sx + 1, y0 + 6, sw - 2, 1, WALNUT.hi);
  }

  // ── 화분 (11, 8) ──
  R(g, 11 * PX + 4, 9 * PX - 1, 9, 1, SHADE);
  for (const [dx, dy, w2, h2, col] of [
    [3, -5, 4, 6, '#3f8f4a'], [8, -6, 4, 7, '#4da858'], [0, -1, 5, 5, '#4da858'], [10, 0, 5, 5, '#3f8f4a'], [5, -2, 5, 7, '#66c070'],
  ] as const) {
    R(g, 11 * PX + dx, 8 * PX + dy + 4, w2, h2, col); R(g, 11 * PX + dx, 8 * PX + dy + 4, 1, 1, '#9be0a0');
  }
  box(g, 11 * PX + 3, 8 * PX + 8, 10, 7, '#c8683a'); R(g, 11 * PX + 4, 8 * PX + 9, 8, 1, '#e28a58'); R(g, 11 * PX + 4, 8 * PX + 13, 8, 1, '#9c4a26');

  // ── 방문 (6, 9) + 발매트 ──
  box(g, 6 * PX, (H - 1) * PX - 1, PX, PX + 1, '#8a5a34');
  R(g, 6 * PX + 1, (H - 1) * PX, PX - 2, 1, '#cf9a62');
  box(g, 6 * PX + 2, (H - 1) * PX + 2, 12, 5, '#a9733f', '#6e4826'); box(g, 6 * PX + 2, (H - 1) * PX + 8, 12, 6, '#a9733f', '#6e4826');
  R(g, 6 * PX + 12, (H - 1) * PX + 7, 2, 2, '#f0d060');
  box(g, 6 * PX + 1, (H - 2) * PX + 9, 14, 6, '#c2504a', '#6e2a2a'); R(g, 6 * PX + 3, (H - 2) * PX + 11, 10, 2, '#e07a6a');
  return c;
}

/** 깜빡이는 TV, 휴대폰, 별똥별, 입영통지서 반짝임 */
export function drawRoomAnimated(g: G, t: number, noticeRead: boolean) {
  // TV 화면: 일기예보 (유성우 소식)
  const flick = Math.floor(t * 8) % 3;
  R(g, TV.x + 2, TV.y + 2, TV.w - 4, TV.h - 4, ['#203a78', '#24408a', '#1e3670'][flick]);
  R(g, TV.x + 2, TV.y + TV.h - 5, TV.w - 4, 3, '#e8eefa'); R(g, TV.x + 4, TV.y + TV.h - 4, 8, 1, '#de4a4a');
  const st = Math.floor(t * 3) % 4;
  for (const [i, sxy] of ([[4, 4], [9, 3], [14, 5], [17, 3]] as const).entries()) {
    R(g, TV.x + sxy[0], TV.y + sxy[1], 1, 1, i === st ? '#ffffff' : '#8fb0e8');
  }
  R(g, TV.x + 3, TV.y + 3, 3, 1, 'rgba(255,255,255,0.35)');
  // 모니터 화면: 영상 목록
  R(g, MON.x + 1, MON.y + 1, MON.w - 2, MON.h - 3, '#dff2fb');
  R(g, MON.x + 2, MON.y + 2, 4, 3, '#de4a4a'); R(g, MON.x + 7, MON.y + 2, 4, 1, '#6c7080'); R(g, MON.x + 7, MON.y + 4, 3, 1, '#a9abbd');
  R(g, MON.x + 2, MON.y + 6, 9, 1, Math.floor(t * 1.5) % 2 ? '#a9abbd' : '#6c7080');
  // 휴대폰 (알림이 깜빡인다)
  box(g, PHONE.x, PHONE.y, 5, 8, '#30303a', '#16141c');
  if (Math.floor(t * 2) % 2 === 0) { R(g, PHONE.x + 1, PHONE.y + 1, 3, 5, '#bff5d6'); R(g, PHONE.x + 2, PHONE.y + 2, 1, 1, '#38c078'); }
  // 입영통지서
  box(g, NOTICE.x, NOTICE.y, 10, 7, '#fbfaf4', '#8a8690');
  R(g, NOTICE.x + 2, NOTICE.y + 2, 4, 1, '#de4a4a'); R(g, NOTICE.x + 2, NOTICE.y + 4, 6, 1, '#a9abbd');
  if (!noticeRead && Math.floor(t * 3) % 2 === 0) {
    for (const [dx, dy] of [[0, -3], [10, -2], [-2, 4], [12, 5], [5, -5]]) R(g, NOTICE.x + dx, NOTICE.y + dy, 1, 1, '#ffe048');
  }
  // 창밖 밤하늘 + 별똥별
  const wx = WIN.x, wy = WIN.y;
  R(g, wx, wy, WIN.w, WIN.h, '#1c2858'); R(g, wx, wy + WIN.h - 6, WIN.w, 6, '#28386e'); R(g, wx, wy + WIN.h - 2, WIN.w, 2, '#34467e');
  R(g, wx + 12, wy + 2, 3, 3, '#f8f0c0'); R(g, wx + 12, wy + 2, 1, 1, '#1c2858');
  for (const [sx, sy] of [[2, 3], [6, 12], [3, 15], [14, 9], [9, 5], [15, 14]]) {
    R(g, wx + sx, wy + sy, 1, 1, Math.floor(t * 2 + sx) % 3 ? '#ffffff' : '#a0a8d0');
  }
  const ph = (t * 0.3) % 1;
  if (ph < 0.3) {
    const k = ph / 0.3;
    const sx = Math.round(wx + 1 + k * 14), sy = Math.round(wy + 1 + k * 11);
    R(g, sx, sy, 1, 1, '#ffffff'); R(g, sx - 1, sy - 1, 1, 1, '#f8f0a0'); R(g, sx - 2, sy - 2, 1, 1, '#c0b870');
  }
  // 창살
  R(g, wx + 8, wy, 2, WIN.h, '#9a6a42'); R(g, wx, wy + 9, WIN.w, 2, '#9a6a42');
  R(g, wx + 8, wy, 1, WIN.h, '#bd8a58'); R(g, wx, wy + 9, WIN.w, 1, '#bd8a58');
}

/** 머리 위 느낌표 말풍선 */
export function drawExclaim(g: G, cx: number, topY: number) {
  const x = Math.round(cx - 4), y = Math.round(topY - 12);
  box(g, x, y, 9, 10, '#ffffff');
  R(g, x + 3, y + 10, 3, 1, OUT); R(g, x + 4, y + 11, 1, 1, OUT); R(g, x + 4, y + 9, 1, 1, '#ffffff');
  R(g, x + 4, y + 2, 1, 4, '#de4a4a'); R(g, x + 4, y + 7, 1, 1, '#de4a4a');
}
