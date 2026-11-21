// 생활관 타일셋(시제품) 아틀라스를 만든다.
//   node scripts/tileset/build.mjs [--preview <png 경로>]
// 결과: public/tiles/barracks.png (16px 격자 원본 도트) + src/game/data/tilesets/barracks.json (조각 위치표)
// 만들어진 PNG는 Aseprite 등에서 그대로 열어 고칠 수 있다. 조각 위치·크기만 유지하면 게임에 바로 반영된다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ───────────── 그리기 도구 ─────────────
const rgba = (s) => {
  const n = s.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).concat(n.length === 8 ? parseInt(n.slice(6, 8), 16) : 255);
};
const tone = (s, amt) => '#' + rgba(s).slice(0, 3).map((v) => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0')).join('');

class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  alpha(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  px(x, y, col) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = typeof col === 'string' ? rgba(col) : col;
    const i = (y * this.w + x) * 4, d = this.d;
    if (a === 255 || d[i + 3] === 0) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; return; }
    const sa = a / 255, da = d[i + 3] / 255, oa = sa + da * (1 - sa);
    d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }
  rect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col); }
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (src.d[i + 3]) this.px(dx + x, dy + y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]);
    }
  }
}

/** 글자 한 칸 = 픽셀 하나. '.'은 투명 */
function art(rows, pal) {
  const w = rows[0].length;
  const im = new Img(w, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`줄 길이가 다르다 (${y}번째 줄: ${row.length} ≠ ${w}) "${row}"`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if (!pal[ch]) throw new Error(`팔레트에 없는 글자 '${ch}' (${y}번째 줄)`);
      im.px(x, y, pal[ch]);
    });
  });
  return im;
}

/** 오른쪽 아래로 떨어지는 그림자: 붙은 1px은 짙게, 그 바깥 1px은 옅게 (빛은 왼쪽 위에서 온다) */
function withShadow(src) {
  const im = new Img(src.w + 2, src.h + 2);
  const a = new Map();
  const mark = (x, y, v) => { if (!src.alpha(x, y)) a.set(y * 4096 + x, Math.max(a.get(y * 4096 + x) ?? 0, v)); };
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (!src.alpha(x, y)) continue;
    mark(x + 1, y + 1, 0x52); mark(x + 2, y + 1, 0x22); mark(x + 1, y + 2, 0x22); mark(x + 2, y + 2, 0x14);
  }
  for (const [k, v] of a) im.px(k % 4096, Math.floor(k / 4096), [40, 24, 30, v]);
  im.blit(src, 0, 0);
  return im;
}

const mirror = (src) => {
  const im = new Img(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const i = (y * src.w + x) * 4;
    if (src.d[i + 3]) im.px(src.w - 1 - x, y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]);
  }
  return im;
};

/** 결정적 난수 */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const sprites = [];
/** ox·oy: 타일 왼쪽 위에서 얼마나 벗어나 그리는지 (위로 솟는 가구는 oy가 음수) */
const add = (name, img, ox = 0, oy = 0) => sprites.push({ name, img, ox, oy });

// ───────────── 마루 (4x4 타일 = 64x64, 이음매가 줄마다 어긋나는 긴 널빤지) ─────────────
{
  const im = new Img(64, 64);
  const tones = ['#dcb47c', '#d6ac73', '#e1ba83'];
  const seam = '#c0965d';
  const joints = [[10, 38], [24, 54], [4, 30, 50], [16, 44], [8, 34, 58], [22, 48], [2, 28, 42], [14, 36, 60]];
  const rnd = rng(77);
  for (let r = 0; r < 8; r++) {
    const y0 = r * 8, js = joints[r];
    const segOf = (x) => { let k = js.length - 1; for (let i = 0; i < js.length; i++) if (x >= js[i]) k = i; return x < js[0] ? js.length - 1 : k; };
    for (let x = 0; x < 64; x++) {
      const t = tones[(r * 2 + segOf(x)) % tones.length];
      im.px(x, y0, tone(t, 10));
      im.rect(x, y0 + 1, 1, 6, t);
      im.px(x, y0 + 7, seam);
    }
    js.forEach((j, i) => {
      const t = tones[(r * 2 + i) % tones.length];
      const len = ((js[(i + 1) % js.length] - j + 64) % 64) || 64;
      // 결: 어두운 줄 둘 + 밝은 줄 하나
      for (let k = 0; k < 2; k++) {
        const gl = 4 + Math.floor(rnd() * 5), gx = j + 3 + Math.floor(rnd() * Math.max(1, len - gl - 6)), gy = y0 + 2 + Math.floor(rnd() * 4);
        for (let q = 0; q < gl; q++) im.px((gx + q) % 64, gy, tone(t, -8));
      }
      {
        const gl = 3 + Math.floor(rnd() * 4), gx = j + 3 + Math.floor(rnd() * Math.max(1, len - gl - 6)), gy = y0 + 2 + Math.floor(rnd() * 4);
        for (let q = 0; q < gl; q++) im.px((gx + q) % 64, gy, tone(t, 7));
      }
      // 옹이 (가끔)
      if (rnd() > 0.6 && len > 14) {
        const kx = (j + 6 + Math.floor(rnd() * (len - 12))) % 64, ky = y0 + 3;
        im.rect(kx, ky, 3, 2, tone(t, -18)); im.px((kx + 1) % 64, ky, '#9c7242'); im.px(kx, ky + 2, tone(t, 9)); im.px((kx + 1) % 64, ky + 2, tone(t, 9));
      }
      // 이음매 + 못
      im.rect(j, y0 + 1, 1, 6, seam);
      im.rect((j + 1) % 64, y0 + 1, 1, 6, tone(t, 5));
      im.px((j + 62) % 64, y0 + 3 + (i % 2), tone(t, -22));
    });
  }
  add('floor', im);
}

// ───────────── 정면 벽 (회벽 + 국방색 허리띠 + 걸레받이) ─────────────
function wallFace(variant) {
  const im = new Img(16, 16);
  im.rect(0, 0, 16, 1, '#2a222c');
  im.rect(0, 1, 16, 1, '#a39682');
  im.rect(0, 2, 16, 1, '#d6ccb2');
  im.rect(0, 3, 16, 7, '#f0e9d4');
  const dots = variant === 0 ? [[3, 5], [11, 7], [7, 4]] : [[5, 8], [12, 4], [2, 6], [9, 6]];
  for (const [x, y] of dots) im.px(x, y, '#e4dcc4');
  if (variant === 1) { im.rect(9, 7, 3, 1, '#e8e0c9'); im.rect(10, 8, 3, 1, '#e8e0c9'); }
  im.rect(0, 9, 16, 1, '#e2d9c0');
  im.rect(0, 10, 16, 1, '#4c5d43');
  im.rect(0, 11, 16, 1, '#a6ba97');
  im.rect(0, 12, 16, 2, '#7f9372');
  im.rect(0, 13, 16, 1, '#718565');
  im.rect(variant === 0 ? 7 : 15, 12, 1, 2, '#64785a');
  im.rect(0, 14, 16, 1, '#6f6156');
  im.rect(0, 15, 16, 1, '#463c36');
  return im;
}
add('wall_face_a', wallFace(0));
add('wall_face_b', wallFace(1));

// 벽 장식 (정면 벽 위에 덧그린다)
add('decor_clock', art([
  '..KKK..',
  '.KWWWK.',
  'KWWHWWK',
  'KWWHHRK',
  'KWWWWWK',
  '.KWWWK.',
  '..KKK..',
], { K: '#4a3c38', W: '#fbfaf4', H: '#2a2230', R: '#de4a4a' }), 5, 2);
add('decor_frame', art([
  'KKKKKKKKKKKK',
  'KWRRRRRRWWWK',
  'KWWWWWWWWWWK',
  'KWggggggggWK',
  'KWWWWWWWWWWK',
  'KWgggggWWWWK',
  'KKKKKKKKKKKK',
], { K: '#7c5230', W: '#fbfaf4', R: '#de4a4a', g: '#b4b6c6' }), 2, 2);
add('decor_switch', art([
  'KKKK',
  'KWWK',
  'KWtK',
  'KWtK',
  'KKKK',
], { K: '#8a8690', W: '#f1eee4', t: '#b9b6ac' }), 3, 4);

// ───────────── 위쪽 벽의 문 (양쪽 여닫이 · 외짝) ─────────────
function door(frameL, frameR) {
  const im = new Img(16, 16);
  const OUT = '#2e2018', FRAME = '#6e4826', base = '#a9733f', hi = '#cf9a62', hi2 = '#c08a52', lo = '#8a5a30';
  im.rect(0, 0, 16, 16, base);
  const dx0 = frameL ? 2 : 0, dx1 = frameR ? 13 : 14;
  im.rect(dx0, 2, dx1 - dx0 + 1, 1, hi);
  im.rect(dx0, 3, 1, 13, hi2);
  im.rect(dx1, 3, 1, 13, lo);
  // 유리창
  const wx0 = dx0 + 2, wx1 = dx1 - 2;
  im.rect(wx0, 4, wx1 - wx0 + 1, 5, '#5a3a20');
  im.rect(wx0 + 1, 5, wx1 - wx0 - 1, 3, '#86bcd8');
  im.rect(wx0 + 1, 5, wx1 - wx0 - 1, 1, '#c6e8f4');
  im.px(wx0 + 2, 6, '#eaf8fc'); im.px(wx0 + 1, 7, '#b4dcec');
  // 아래 널판
  im.rect(wx0, 10, wx1 - wx0 + 1, 4, '#b27c46');
  im.rect(wx0, 10, wx1 - wx0 + 1, 1, lo); im.rect(wx0, 10, 1, 4, lo);
  im.rect(wx0, 13, wx1 - wx0 + 1, 1, hi2); im.rect(wx1, 11, 1, 3, hi2);
  // 발판 (맨 아래 줄)
  im.rect(dx0, 15, dx1 - dx0 + 1, 1, '#7c5230');
  // 손잡이: 경첩 반대쪽
  const hx = frameR && !frameL ? dx0 + 1 : dx1 - 1;
  im.px(hx, 9, '#f6e08a'); im.px(hx, 10, '#a8842c');
  // 문틀
  im.rect(0, 0, 16, 1, OUT); im.rect(0, 1, 16, 1, FRAME);
  if (frameL) { im.rect(0, 0, 1, 16, OUT); im.rect(1, 1, 1, 15, FRAME); } else im.rect(0, 2, 1, 14, '#4a301c');
  if (frameR) { im.rect(15, 0, 1, 16, OUT); im.rect(14, 1, 1, 15, FRAME); } else im.rect(15, 2, 1, 14, '#4a301c');
  return im;
}
add('door_l', door(true, false));
add('door_r', door(false, true));
add('door_single', door(true, true));

// ───────────── 위에서 내려다본 벽 윗면 + 방 쪽 모서리 띠 ─────────────
{
  const BASE = '#322b3a', MID = '#443b50', LIGHT = '#5d516b', OUT = '#17121c';
  const base = new Img(16, 16); base.rect(0, 0, 16, 16, BASE);
  add('wtop', base);
  const e = new Img(16, 16);
  e.rect(12, 0, 1, 16, MID); e.rect(13, 0, 2, 16, LIGHT); e.rect(15, 0, 1, 16, OUT);
  add('wtop_e', e); add('wtop_w', mirror(e));
  const n = new Img(16, 16);
  n.rect(0, 0, 16, 1, OUT); n.rect(0, 1, 16, 2, LIGHT); n.rect(0, 3, 16, 1, MID);
  add('wtop_n', n);
  const ne = new Img(16, 16);
  ne.rect(12, 0, 4, 4, MID); ne.rect(13, 0, 2, 3, LIGHT); ne.rect(13, 1, 3, 2, LIGHT); ne.px(15, 0, OUT);
  add('wtop_ne', ne); add('wtop_nw', mirror(ne));
}

// ───────────── 침상 (철제 틀 · 베개 · 접어 넘긴 홑이불 · 줄무늬 국방색 모포) ─────────────
const BED = {
  K: '#2b303a', h: '#d3d9e2', s: '#9aa2ae', l: '#646c78',
  w: '#f4f2ea', v: '#d6d4c8', P: '#9ea3b8', W: '#ffffff', p: '#d5d9e6',
  H: '#8aa66f', c: '#6f8d58', b: '#5d7a4a', D: '#465c3a', d: '#33452c', y: '#c2bb8c', Y: '#9c9668',
};
const BLANKET = [
  '.KHcbbbbbbbbbDK.',
  '.KHcbbbbbcbbbDK.',
  '.KHcbbbbcDbbbDK.',
  '.KHcbbbcDbbbbDK.',
  '.KHcbbbbbbbbbDK.',
  '.KHcbbbbbbbcbDK.',
  '.KHcbcbbbbcDbDK.',
  '.KHccDbbbbbbbDK.',
];
add('bed_head', withShadow(art([
  '................',
  '..KKKKKKKKKKKK..',
  '.KhhhhhhhhhhhhK.',
  '.KssssssssssslK.',
  '.KKKKKKKKKKKKKK.',
  '.KwwwwwwwwwwwvK.',
  '.KwwPPPPPPPPwvK.',
  '.KwPWWWWWWWWPvK.',
  '.KwPWWWWWWWpPvK.',
  '.KwPWpppppppPvK.',
  '.KwwPPPPPPPPvvK.',
  '.KwvvvvvvvvvvvK.',
  '.KWWWWWWWWWWWwK.',
  '.KwwwwwwwwwwwvK.',
  '.KddddddddddddK.',
  '.KHccbbbbbbbbDK.',
], BED)));
add('bed_mid', withShadow(art([...BLANKET, ...BLANKET], BED)));
add('bed_foot', withShadow(art([
  ...BLANKET,
  '.KyyyyyyyyyyyYK.',
  '.KHcbbbbbbbbbDK.',
  '.KyyyyyyyyyyyYK.',
  '.KDDDDDDDDDDDdK.',
  '.KKKKKKKKKKKKKK.',
  '.KhhhhhhhhhhhsK.',
  '.KllllllllllllK.',
  '..KKKKKKKKKKKK..',
], BED)));

// 침상 발치에 가지런히 둔 전투화 (바닥 장식, 지나다닐 수 있다)
add('boots', withShadow(art([
  '....KK....KK....',
  '...KBbK..KBbK...',
  '...KBBK..KBBK...',
  '...KBBK..KBBK...',
  '...KKKK..KKKK...',
], { K: '#1c1814', B: '#3a332c', b: '#6a6056' })), 0, 1);

// ───────────── 관물대 (위 여닫이 두 짝 + 아래 서랍, 이름표) ─────────────
const LOCKER = {
  K: '#2e1e12', i: '#dcb483', t: '#c29763', e: '#5e3f22',
  F: '#a87a4c', f: '#93683c', o: '#74502c', g: '#4a3018',
  n: '#f6f3e6', m: '#8a8690', a: '#eef1f5', A: '#7a828e',
  // 위에 올려 둔 물건
  G: '#5a6e48', L: '#7f9568', S: '#3f5034', w: '#f4f2ea', v: '#cfd0c8', O: '#4f6a40',
};
const LOCKER_BODY = [
  'KKKKKKKKKKKKKKKK',
  'KiiiiiiiiiiiiiiK',
  'KttttttttttttttK',
  'KttttttttttttttK',
  'KeeeeeeeeeeeeeeK',
  'KFfffffoFfffffoK',
  'KFnnnnfoFnnnnfoK',
  'KFnmmnfoFnmnnfoK',
  'KFfffffoFfffffoK',
  'KFffffaoFaffffoK',
  'KFffffaoFaffffoK',
  'KFffffAoFAffffoK',
  'KFfffffoFfffffoK',
  'KFfffffoFfffffoK',
  'KggggggggggggggK',
  'KFFFFFFoFFFFFFoK',
  'KFffaafoFfaaffoK',
  'KFfffffoFfffffoK',
  'KooooooooooooooK',
  'KKKKKKKKKKKKKKKK',
];
const LOCKER_TOPS = {
  // 맨 위: 아무것도 없음
  a: ['................', '................', '................'],
  // 방탄헬멧
  b: ['....KKKKKK......', '...KLGGGGGK.....', '..KLGGGGGGSK....'],
  // 개어 둔 수건과 활동복
  c: ['................', '.....KKKKKKKK...', '.....KwwwwwwvK..'],
};
const LOCKER_TOP_ROW = {
  a: null,
  b: ['..KGGGGGGSSK....', '..KKKKKKKKKK....'],
  c: ['.....KKKKKKKK...', '.....KOOOOOOSK..', '.....KKKKKKKK...'],
};
for (const k of ['a', 'b', 'c']) {
  const im = new Img(16, 23);
  im.blit(art(LOCKER_BODY, LOCKER), 0, 3);
  im.blit(art(LOCKER_TOPS[k], LOCKER), 0, 0);
  if (LOCKER_TOP_ROW[k]) im.blit(art(LOCKER_TOP_ROW[k], LOCKER), 0, 3);
  add(`locker_${k}`, withShadow(im), 0, -7);
}

// ───────────── TV + TV장 ─────────────
add('tv', withShadow(art([
  '.KKKKKKKKKKKKKK.',
  '.KBBBBBBBBBBBBK.',
  '.KB1g11111111BK.',
  '.KBg122222222BK.',
  '.KB2222222222BK.',
  '.KB2233333322BK.',
  '.KB3333333333BK.',
  '.KBRRWWWWWWWWBK.',
  '.KB4444444444BK.',
  '.KBBBBBBBBBBLBK.',
  '.KKKKKKKKKKKKKK.',
  '......KKKK......',
  '.OOOOOKKKKOOOOO.',
  '.OTTTTTTTTTTTTO.',
  '.OttttttttttttO.',
  '.OuuuuuuuuuuuuO.',
  '.OFffffdFffffdO.',
  '.OFfyyfdFfyyfdO.',
  '.OFffffdFffffdO.',
  '.OddddddddddddO.',
  '.OOOOOOOOOOOOOO.',
], {
  K: '#1c1a22', B: '#2e2e3a', 1: '#7cc0ee', 2: '#4f9be0', 3: '#3a78c8', 4: '#2c5c9c', g: '#e8f6ff',
  R: '#de4a4a', W: '#f4f6fa', L: '#68f0a0',
  O: '#3a2618', T: '#c08e5c', t: '#a97448', u: '#6a4326', F: '#96623a', f: '#855430', d: '#663d20', y: '#f0d060',
})), 0, -5);

// ───────────── 세워 둔 게시판 ─────────────
add('board', withShadow(art([
  'KKKKKKKKKKKKKKKK',
  'KwwwwwwwwwwwwwwK',
  'KWggggggggggggWK',
  'KWGPPPPPGGYYYGWK',
  'KWGPRPPPGGYBYGWK',
  'KWGPpppPGGYyYGWK',
  'KWGPPPPPGGYYYGWK',
  'KWGPpppPGGGGGGWK',
  'KWGPPPPPGNNNNGWK',
  'KWGGGGGGGNRNNGWK',
  'KWGPPPPGGNNNNGWK',
  'KWGPppPGGGGGGGWK',
  'KWhhhhhhhhhhhhWK',
  'KWWWWWWWWWWWWWWK',
  'KKKKKKKKKKKKKKKK',
  '..KLK......KLK..',
  '..KLK......KLK..',
  '..KLK......KLK..',
  '.KKLKK....KKLKK.',
  '.KKKKK....KKKKK.',
], {
  K: '#3a2a1c', w: '#c89a64', W: '#a87a48', G: '#4f7a58', g: '#62906a', h: '#3e6347',
  P: '#fbfaf4', p: '#b9bccb', Y: '#fff2b0', y: '#c8a850', R: '#de4a4a', B: '#4f7ac8', N: '#f6c2cf', L: '#8a6238',
})), 0, -4);

// ═════════════ 여기부터 생활관 밖의 실내 (복도 · 사무 · 식당 · 주방 · 세탁 · 화장실 · 탄약고) ═════════════

/** 타일 위로 top줄만큼 솟을 수 있는 그리기판. 좌표는 타일 왼쪽 위가 (0,0) — 위로 솟는 부분은 y가 음수 */
function canvas(top = 0, h = 16, w = 16) {
  const im = new Img(w, h + top);
  const R = (x, y, ww, hh, c) => im.rect(x, y + top, ww, hh, c);
  const box = (x, y, ww, hh, fill, out) => { R(x, y, ww, hh, out); R(x + 1, y + 1, ww - 2, hh - 2, fill); };
  /** 가운데 맞춘 가로줄 묶음 (둥근 모양) */
  const rows = (cx, y, ws, c) => ws.forEach((w2, i) => R(cx - w2 / 2, y + i, w2, 1, c));
  return { im, R, box, rows, top };
}
/** 바닥에 놓인 물건: 그림자를 붙여 등록한다 */
const addObj = (name, c, shadow = true) => add(name, shadow ? withShadow(c.im) : c.im, 0, -c.top);

/** 윗면 + 앞면이 보이는 덩어리 */
function block(c, x, y, w, h, topH, m) {
  const { R } = c;
  R(x, y, w, h, m.out);
  R(x + 1, y + 1, w - 2, topH - 1, m.top); R(x + 1, y + 1, w - 2, 1, m.topHi);
  R(x + 1, y + topH, w - 2, h - topH - 1, m.front);
  R(x + 1, y + topH, w - 2, 1, m.frontLo);
  R(x + 1, y + topH + 1, 1, h - topH - 2, m.frontHi);
  R(x + w - 2, y + topH + 1, 1, h - topH - 2, m.frontLo);
  R(x + 1, y + h - 2, w - 2, 1, m.frontLo);
}

// ───────────── 바닥: 타일 · 장판 · 콘크리트 (모두 4x4 타일 = 64x64 무늬) ─────────────
function tileFloor(name, a, b, grout, seed) {
  const im = new Img(64, 64), rnd = rng(seed);
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
    const c = (tx + ty) % 2 ? b : a, x = tx * 16, y = ty * 16;
    im.rect(x, y, 16, 16, c);
    im.rect(x, y, 15, 1, tone(c, 11)); im.rect(x, y, 1, 15, tone(c, 11));
    im.rect(x, y + 15, 16, 1, grout); im.rect(x + 15, y, 1, 16, grout);
    im.px(x + 3, y + 3, tone(c, 15)); im.px(x + 4, y + 3, tone(c, 15)); im.px(x + 3, y + 4, tone(c, 15));
    im.rect(x + 9, y + 11, 3, 1, tone(c, -6));
    const r = rnd();
    if (r > 0.82) for (let k = 0; k < 5; k++) im.px(x + 5 + k, y + 7 + (k >> 1), tone(c, -20));
    else if (r > 0.6) im.rect(x + 7 + Math.floor(rnd() * 4), y + 5 + Math.floor(rnd() * 4), 2, 1, tone(c, -9));
  }
  add(name, im);
}
tileFloor('floor_tile_cool', '#e4ecf0', '#cfdbe3', '#b3c1cb', 11);
tileFloor('floor_tile_warm', '#ede8db', '#dcd5c3', '#c1b8a3', 23);

function linoFloor(name, base, seed) {
  const im = new Img(64, 64), rnd = rng(seed);
  im.rect(0, 0, 64, 64, base);
  for (let i = 0; i < 110; i++) im.rect(Math.floor(rnd() * 63), Math.floor(rnd() * 64), 1 + Math.floor(rnd() * 2), 1, tone(base, rnd() > 0.5 ? -8 : 7));
  for (let i = 0; i < 5; i++) { const x = Math.floor(rnd() * 50) + 4, y = Math.floor(rnd() * 54) + 4; for (let k = 0; k < 4; k++) im.px(x + k, y + k, tone(base, 11)); }
  for (const o of [0, 32]) {
    im.rect(0, o + 31, 64, 1, tone(base, -15)); im.rect(o + 31, 0, 1, 64, tone(base, -15));
    im.rect(0, o, 64, 1, tone(base, 6)); im.rect(o, 0, 1, 64, tone(base, 6));
  }
  add(name, im);
}
linoFloor('floor_lino_green', '#b9c2aa', 5);
linoFloor('floor_lino_gray', '#c5cad1', 9);

{
  const base = '#a9a9a1', im = new Img(64, 64), rnd = rng(41);
  im.rect(0, 0, 64, 64, base);
  for (let i = 0; i < 46; i++) im.rect(Math.floor(rnd() * 60), Math.floor(rnd() * 62), 2 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 2), tone(base, rnd() > 0.5 ? -5 : 5));
  for (let i = 0; i < 70; i++) im.px(Math.floor(rnd() * 64), Math.floor(rnd() * 64), tone(base, rnd() > 0.5 ? -14 : 12));
  // 실금
  for (let i = 0; i < 3; i++) {
    let x = Math.floor(rnd() * 44) + 6, y = Math.floor(rnd() * 44) + 6;
    for (let k = 0; k < 9 + Math.floor(rnd() * 6); k++) { im.px(x, y, tone(base, -30)); im.px(x, y + 1, tone(base, 9)); x += 1; if (rnd() > 0.55) y += rnd() > 0.5 ? 1 : -1; }
  }
  // 기름 얼룩
  im.rect(40, 22, 6, 3, tone(base, -11)); im.rect(41, 21, 4, 5, tone(base, -11)); im.rect(42, 23, 2, 1, tone(base, -18));
  // 신축 줄눈
  im.rect(0, 0, 64, 1, tone(base, -20)); im.rect(0, 1, 64, 1, tone(base, 7)); im.rect(0, 0, 1, 64, tone(base, -20)); im.rect(1, 1, 1, 63, tone(base, 7));
  add('floor_concrete', im);
}

// ───────────── 물 쓰는 방의 타일 벽 · 벽 장식 추가 ─────────────
{
  const im = new Img(16, 16);
  im.rect(0, 0, 16, 1, '#2a222c'); im.rect(0, 1, 16, 1, '#aab6be');
  for (let y = 2; y < 14; y++) for (let x = 0; x < 16; x++) {
    const band = y >= 6 && y <= 9, gx = x % 4 === 3, gy = (y - 2) % 4 === 3;
    const c = band ? '#9cc6da' : '#f3f7f9';
    im.px(x, y, gx || gy ? (band ? '#7fb0c8' : '#c8d3db') : x % 4 === 0 && (y - 2) % 4 === 0 ? tone(c, 12) : c);
  }
  im.rect(0, 14, 16, 1, '#8794a0'); im.rect(0, 15, 16, 1, '#4a525c');
  add('wall_face_tile', im);
}
add('decor_poster', art([
  'KKKKKKKK',
  'KBBBBBBK',
  'KBwwBBBK',
  'KBBBwwBK',
  'KGGGGGGK',
  'KGyGGyGK',
  'KKKKKKKK',
], { K: '#2a2230', B: '#5d86b8', w: '#dfe6ee', G: '#3f6a4a', y: '#f0d060' }), 4, 2);
add('decor_sign', art([
  'KKKKKKKKKK',
  'KGGGwGGGGK',
  'KGwwwwGwGK',
  'KGGGwGGGGK',
  'KKKKKKKKKK',
], { K: '#1e3a26', G: '#2f8a4a', w: '#f4fff6' }), 3, 3);

// ───────────── 벽 윗면: 아래쪽이 트인 자리 (옆벽 문 위 · 계단 위) ─────────────
{
  const MID = '#443b50', LIGHT = '#5d516b', OUT = '#17121c';
  const s2 = new Img(16, 16);
  s2.rect(0, 12, 16, 1, MID); s2.rect(0, 13, 16, 2, LIGHT); s2.rect(0, 15, 16, 1, OUT);
  add('wtop_s', s2);
  const se = new Img(16, 16);
  se.rect(12, 12, 4, 4, MID); se.rect(13, 13, 2, 3, LIGHT); se.rect(13, 13, 3, 2, LIGHT); se.px(15, 15, OUT);
  add('wtop_se', se); add('wtop_sw', mirror(se));
}

// ───────────── 아래·옆 벽 문 앞의 발매트 ─────────────
{
  const h = canvas();
  h.box(1, 3, 14, 10, '#b04a44', '#4a1c1c');
  h.R(2, 4, 12, 1, '#cf6a5e'); h.R(3, 5, 10, 6, '#c55a50'); h.R(3, 5, 10, 1, '#de8072');
  for (const x of [5, 8, 11]) h.R(x, 6, 1, 4, '#9c3c38');
  h.R(3, 10, 10, 1, '#9c3c38');
  for (let x = 2; x < 14; x += 2) { h.R(x, 2, 1, 1, '#e8dcc0'); h.R(x, 13, 1, 1, '#e8dcc0'); }
  add('mat_h', h.im);
  const v = canvas();
  v.box(3, 1, 10, 14, '#b04a44', '#4a1c1c');
  v.R(4, 2, 1, 12, '#cf6a5e'); v.R(5, 3, 6, 10, '#c55a50'); v.R(5, 3, 6, 1, '#de8072');
  for (const y of [5, 8, 11]) v.R(6, y, 4, 1, '#9c3c38');
  for (let y = 2; y < 14; y += 2) { v.R(2, y, 1, 1, '#e8dcc0'); v.R(13, y, 1, 1, '#e8dcc0'); }
  add('mat_v', v.im);
}

// ───────────── 계단 (오른쪽으로 올라간다: 디딤판 넷 + 미끄럼 방지 띠 + 난간) ─────────────
{
  const c = canvas();
  for (let i = 0; i < 4; i++) {
    const t = tone('#8f8f99', i * 9);
    c.R(i * 4, 0, 4, 16, t);
    c.R(i * 4, 0, 1, 16, '#d8c050');
    c.R(i * 4 + 1, 0, 1, 16, tone(t, 16));
    c.R(i * 4 + 3, 0, 1, 16, tone(t, -34));
  }
  c.R(0, 0, 16, 1, '#17121c'); c.R(0, 1, 16, 1, '#6c7480'); c.R(0, 2, 16, 1, '#3a4048');
  c.R(0, 15, 16, 1, '#17121c'); c.R(0, 14, 16, 1, '#3a4048'); c.R(0, 13, 16, 1, '#6c7480');
  add('stairs', c.im);
}

// ───────────── 이어 붙는 상판 가구 (책상 · 식탁 · 조리대 · 세면대 · 화구) ─────────────
// 이름 뒤 숫자 = 끝나는 방향의 합 (왼쪽 1 · 오른쪽 2 · 위 4 · 아래 8). 15면 한 칸짜리
const SLABS = {
  desk: { out: '#2e1e12', top: '#b07c4c', topHi: '#cf9c68', topLo: '#96683c', front: '#84562e', frontHi: '#96663a', frontLo: '#663f20', wood: true, knob: '#f0d060' },
  table: { out: '#3a2a1c', top: '#e2c594', topHi: '#f3deb4', topLo: '#c9a873', front: '#a8804c', frontHi: '#ba9260', frontLo: '#876235', wood: true },
  counter: { out: '#2b303a', top: '#cfd6de', topHi: '#eef2f6', topLo: '#aab3be', front: '#8d96a2', frontHi: '#a3acb7', frontLo: '#69727f' },
  sink: { out: '#3a4250', top: '#f1f4f7', topHi: '#ffffff', topLo: '#d6dde5', front: '#c2cad4', frontHi: '#d6dde5', frontLo: '#99a4b1' },
  stage: { out: '#2a2620', top: '#b8a890', topHi: '#d6c8b2', topLo: '#a09078', front: '#8a7c68', frontHi: '#9c8e7a', frontLo: '#685c4c' },
  stove: { out: '#17191d', top: '#6f757d', topHi: '#8e949c', topLo: '#575d65', front: '#4a5058', frontHi: '#5c626a', frontLo: '#33383f' },
};
for (const [name, m] of Object.entries(SLABS)) for (let mask = 0; mask < 16; mask++) {
  const L = mask & 1, Rt = mask & 2, U = mask & 4, D = mask & 8;
  const c = canvas(), { R } = c;
  const y0 = U ? 2 : 0, yb = D ? 15 : 16, topEnd = D ? 10 : 16;
  R(0, y0, 16, yb - y0, m.top);
  if (m.wood) { R(3 + (mask % 3) * 2, y0 + 3, 6, 1, m.topLo); R(6 - (mask % 2) * 3, Math.min(topEnd - 3, y0 + 6), 5, 1, m.topHi); }
  else { for (let k = 0; k < 3; k++) R(10 + k, Math.min(topEnd - 3, y0 + 2) + k, 1, 1, m.topHi); }
  if (L) R(1, y0, 1, topEnd - y0, m.topHi);
  if (Rt) R(14, y0, 1, topEnd - y0, m.topLo);
  if (U) { R(0, y0, 16, 1, m.out); R(0, y0 + 1, 16, 1, m.topHi); }
  if (D) {
    R(0, 9, 16, 1, m.topHi);
    R(0, 10, 16, 1, m.frontLo); R(0, 11, 16, 3, m.front); R(0, 11, 16, 1, m.frontHi); R(0, 13, 16, 1, m.frontLo);
    R(0, 14, 16, 1, m.out);
    if (L) R(1, 11, 1, 2, m.frontHi);
    if (Rt) R(14, 11, 1, 3, m.frontLo);
    if (m.knob) { R(7, 12, 2, 1, m.knob); }
  }
  if (L) R(0, y0, 1, yb - y0, m.out);
  if (Rt) R(15, y0, 1, yb - y0, m.out);
  addObj(`${name}_${mask}`, c);
}

// 상판 위에 올리는 것들 (그림자 없이 덧그린다)
{
  let c = canvas();
  c.box(3, 3, 7, 6, '#fbfaf4', '#8a8690'); c.R(4, 5, 5, 1, '#b4b6c6'); c.R(4, 7, 4, 1, '#b4b6c6'); c.R(4, 4, 2, 1, '#de4a4a');
  c.R(11, 4, 1, 5, '#2b4c8c'); c.R(11, 3, 1, 1, '#e8b04c');
  add('desk_paper', c.im);
  c = canvas();
  c.box(8, 3, 5, 6, '#4f7ac8', '#22345e'); c.R(9, 4, 3, 1, '#9cb8ec'); c.R(9, 7, 3, 1, '#f4f2ea');
  c.box(3, 5, 5, 4, '#c8503c', '#5e2218'); c.R(4, 6, 3, 1, '#e88a70');
  add('desk_book', c.im);
  c = canvas();
  c.box(4, 3, 8, 6, '#3a3e4a', '#17191d'); c.R(5, 4, 2, 4, '#6a7080'); c.R(5, 4, 2, 1, '#9aa2ae');
  for (const [x, y] of [[8, 4], [10, 4], [8, 6], [10, 6]]) c.R(x, y, 1, 1, '#c4cad4');
  c.R(3, 6, 1, 3, '#17191d'); c.R(2, 8, 1, 1, '#17191d');
  add('desk_phone', c.im);
  c = canvas();
  c.box(3, 3, 10, 6, '#c9ccd8', '#5a5e6e'); c.R(4, 4, 8, 1, '#e8eaf2');
  c.R(4, 5, 3, 3, '#fbfaf4'); c.R(4, 5, 3, 1, '#ffffff'); c.R(8, 5, 2, 2, '#e08a4a'); c.R(10, 5, 2, 2, '#d0402a'); c.R(8, 7, 4, 1, '#58b058');
  add('table_tray', c.im);
  // PC: 모니터 + 키보드
  for (const [k, scr, line] of [['a', '#5ac0f2', '#3a98d0'], ['b', '#6ad0a8', '#3a9a78']]) {
    c = canvas(3);
    c.R(6, 5, 4, 2, '#3a4250'); c.R(4, 7, 8, 1, '#17191d');
    c.box(2, -3, 12, 9, '#3a4250', '#17191d'); c.R(3, -2, 10, 6, scr); c.R(3, -2, 10, 1, tone(scr, 40));
    c.R(4, -1, 5, 1, '#eafaff'); c.R(4, 1, 7, 1, line); c.R(4, 2, 4, 1, line); c.R(11, 4, 1, 1, '#68f0a0');
    c.box(3, 8, 10, 3, '#e4e6ee', '#5a5e6e'); c.R(4, 9, 8, 1, '#b9bdcc');
    add(`pc_top_${k}`, c.im, 0, -3);
  }
  // 세면대: 수전 + 물 고인 대야
  c = canvas();
  c.rows(8, 4, [8, 10, 10, 8], '#8f98a2'); c.R(4, 5, 8, 2, '#a8d0e8'); c.R(5, 5, 3, 1, '#d8eefa'); c.R(8, 6, 1, 1, '#6c7480');
  c.R(7, 1, 2, 4, '#6c7480'); c.R(7, 1, 2, 1, '#d6dde5'); c.R(6, 3, 4, 1, '#6c7480'); c.R(6, 3, 1, 1, '#d6dde5');
  add('sink_top', c.im);
  // 거울 (세면대 위 벽)
  c = canvas(9, 0);
  c.box(3, -9, 10, 8, '#bfe4f4', '#4a525c'); c.R(4, -8, 8, 1, '#e4f6fc'); c.R(5, -7, 1, 4, '#ffffff'); c.R(7, -6, 1, 2, '#e4f6fc'); c.R(4, -3, 8, 1, '#9ccadc');
  add('mirror', c.im, 0, -9);
  // 화구: 냄비 / 프라이팬
  c = canvas(6);
  c.box(3, 3, 10, 7, '#2a2e34', '#101216'); c.R(5, 5, 6, 3, '#4a4f58'); c.R(6, 6, 4, 1, '#f08838'); c.R(7, 6, 2, 1, '#ffd070');
  c.box(4, -3, 8, 6, '#c4ccd6', '#3a4250'); c.R(5, -2, 6, 1, '#f4f6f8'); c.R(5, -1, 1, 3, '#e4e9ee'); c.R(10, -1, 1, 3, '#9aa4b0');
  c.R(2, -1, 2, 1, '#17191d'); c.R(12, -1, 2, 1, '#17191d');
  c.R(6, -5, 1, 2, '#ffffff99'); c.R(9, -6, 1, 2, '#ffffff66');
  c.R(3, 12, 2, 1, '#de4a4a'); c.R(7, 12, 2, 1, '#c4ccd6'); c.R(11, 12, 2, 1, '#c4ccd6');
  add('stove_top_a', c.im, 0, -6);
  c = canvas(3);
  c.box(3, 3, 10, 7, '#2a2e34', '#101216'); c.R(5, 5, 6, 3, '#4a4f58');
  c.rows(8, 2, [6, 8, 8, 8, 6], '#17191d'); c.rows(8, 3, [6, 6, 6], '#3a3e46'); c.R(6, 4, 3, 1, '#e8c060'); c.R(8, 5, 2, 1, '#f4f2ea');
  c.R(12, 4, 3, 1, '#17191d');
  c.R(3, 12, 2, 1, '#c4ccd6'); c.R(7, 12, 2, 1, '#de4a4a'); c.R(11, 12, 2, 1, '#c4ccd6');
  add('stove_top_b', c.im, 0, -3);
}

// ───────────── 철제 캐비닛 (행정반 서류함 · 정비실 공구함): 관물대와 같은 틀, 다른 재질 ─────────────
{
  const im = new Img(16, 23);
  im.blit(art(LOCKER_BODY, {
    K: '#262b33', i: '#e2e7ec', t: '#c2c9d1', e: '#59626d',
    F: '#a9b2bc', f: '#939da8', o: '#737d89', g: '#4a525c',
    n: '#f6f3e6', m: '#8a8690', a: '#f4f6f8', A: '#59626d',
  }), 0, 3);
  add('cabinet', withShadow(im), 0, -7);
}

// ───────────── 선반 (책 · 물건 · 공구) ─────────────
const WALNUT = { out: '#2e1e12', top: '#b98558', topHi: '#d6a678', front: '#4e3018', frontHi: '#5e3a20', frontLo: '#3a2210' };
function shelf(kind) {
  const c = canvas(4), { R, box } = c;
  block(c, 1, -4, 14, 19, 4, WALNUT);
  const rnd = rng(kind.length * 31 + 3);
  [[0, 4], [5, 9], [10, 13]].forEach(([y0, yb], row) => {
    const hgt = yb - y0;
    if (kind === 'books') {
      const cols = ['#de4a4a', '#f0b030', '#4f7ac8', '#58b058', '#f08838', '#9858d0', '#48b0b0', '#e8e4d8'];
      let x = 2;
      while (x < 13) {
        const w = rnd() > 0.7 ? 2 : 1, bh = Math.max(2, hgt - Math.floor(rnd() * 2)), col = cols[Math.floor(rnd() * cols.length)];
        R(x, yb - bh, w, bh, col); R(x, yb - bh, 1, 1, tone(col, 50));
        if (w === 2) R(x + 1, yb - bh, 1, bh, tone(col, -30));
        x += w + (rnd() > 0.8 ? 1 : 0);
      }
    } else if (kind === 'goods') {
      const cols = ['#e8503c', '#f0c030', '#48a0e0', '#58b058', '#f08838', '#e070a0'];
      for (let i = 0; i < 4; i++) {
        const col = cols[(row * 2 + i * 3 + Math.floor(rnd() * 2)) % cols.length], bh = hgt - (i + row) % 2;
        box(2 + i * 3, yb - bh, 3, bh, col, tone(col, -70)); R(3 + i * 3, yb - bh + 1, 1, 1, '#ffffff');
      }
    } else {
      // 공구·세제통
      box(2, yb - hgt + 1, 5, hgt - 1, row === 1 ? '#c8402a' : '#6c7480', '#17191d'); R(3, yb - hgt + 2, 3, 1, row === 1 ? '#e87058' : '#aab3be');
      box(8, yb - hgt, 2, hgt, '#58a0d8', '#1e3c5c'); R(8, yb - hgt, 2, 1, '#f4f2ea');
      box(11, yb - hgt + 1, 3, hgt - 1, '#e8c040', '#5c4a10');
    }
    R(2, yb, 12, 1, '#c48e5c'); if (row < 2) R(2, yb + 1, 12, 1, '#2a180c');
  });
  return c;
}
for (const k of ['books', 'goods', 'tools']) addObj(`shelf_${k}`, shelf(k));

// ───────────── 화분 ─────────────
{
  const c = canvas(3), { R, box } = c;
  for (const [dx, dy, w, h, col] of [[3, -1, 4, 7, '#3a8a46'], [9, -2, 4, 8, '#4da858'], [1, 3, 5, 5, '#4da858'], [10, 4, 5, 5, '#3a8a46'], [6, 1, 4, 8, '#6cc477']]) {
    R(dx - 1, dy, w + 2, h, '#1c4a26'); R(dx, dy - 1, w, h + 2, '#1c4a26'); R(dx, dy, w, h, col);
    R(dx, dy, 1, 2, '#a4e6a8'); R(dx + w - 1, dy + h - 2, 1, 2, tone(col, -34)); R(dx + 1, dy + Math.floor(h / 2), w - 2, 1, tone(col, -18));
  }
  box(4, 8, 8, 7, '#c8683a', '#4a2010'); R(5, 9, 6, 1, '#e89466'); R(5, 10, 1, 4, '#dc7c4c'); R(10, 10, 1, 4, '#9c4a26'); R(5, 13, 6, 1, '#9c4a26');
  R(3, 8, 10, 2, '#4a2010'); R(4, 8, 8, 1, '#e89466');
  addObj('plant', c);
}

// ───────────── 소파 (이어 붙는다) ─────────────
for (const [name, L, Rt] of [['sofa_l', 1, 0], ['sofa_m', 0, 0], ['sofa_r', 0, 1], ['sofa_single', 1, 1]]) {
  const c = canvas(), { R, box } = c;
  const OUT = '#3a1826', x0 = L ? 1 : 0, w = 16 - (L ? 1 : 0) - (Rt ? 1 : 0);
  R(0, 1, 16, 14, OUT);
  R(x0, 2, w, 5, '#b06a80'); R(x0, 2, w, 1, '#d090a6'); R(x0, 6, w, 1, '#8e4c62');
  R(x0, 7, w, 4, '#955068'); R(x0, 7, w, 1, '#a45e76'); R(x0, 10, w, 1, '#7c3e54');
  R(x0, 11, w, 3, '#6a3246'); R(x0, 13, w, 1, '#552638');
  if (!L) R(0, 3, 1, 8, '#7c3e54');
  if (L) { box(0, 5, 4, 10, '#b06a80', OUT); R(1, 6, 2, 1, '#d090a6'); R(2, 7, 1, 7, '#955068'); }
  if (Rt) { box(12, 5, 4, 10, '#b06a80', OUT); R(13, 6, 2, 1, '#d090a6'); R(14, 7, 1, 7, '#8e4c62'); }
  addObj(name, c);
}

// ───────────── 정수기 ─────────────
{
  const c = canvas(5), { R, box } = c;
  box(4, -5, 8, 8, '#7ab8e8', '#22405e'); R(5, -4, 2, 5, '#c4e2f8'); R(5, -1, 6, 3, '#5a9ad8'); R(10, -4, 1, 6, '#4a86c4'); R(6, -5, 4, 1, '#22405e');
  box(3, 2, 10, 13, '#e8eef4', '#3a4250'); R(4, 3, 8, 1, '#ffffff'); R(4, 4, 1, 10, '#f6f9fb'); R(11, 4, 1, 10, '#c4ccd6'); R(4, 11, 8, 3, '#c4ccd6');
  R(5, 6, 2, 2, '#3a6aa8'); R(9, 6, 2, 2, '#d04a3a'); R(5, 6, 1, 1, '#7aa8dc'); R(9, 6, 1, 1, '#f08a7a'); R(5, 9, 6, 1, '#6c7480'); R(5, 10, 6, 1, '#8f98a2');
  addObj('cooler', c);
}

// ───────────── 세탁기 · 건조기 ─────────────
const WHITE = { out: '#3a4250', top: '#f1f4f7', topHi: '#ffffff', front: '#e2e7ec', frontHi: '#f4f6f8', frontLo: '#bcc5cf' };
for (const [name, glass, glint, led] of [['washer', '#7ab0d8', '#d8eefa', '#58c8f0'], ['dryer', '#57505c', '#e8a868', '#f0a030']]) {
  const c = canvas(1), { R, rows } = c;
  block(c, 1, -1, 14, 16, 4, WHITE);
  R(3, 1, 3, 1, led); R(11, 1, 2, 1, '#de4a4a'); R(8, 1, 2, 1, '#8f98a2');
  rows(8, 5, [4, 6, 8, 8, 8, 8, 6, 4], '#3a4250'); rows(8, 6, [4, 6, 6, 6, 6, 4], '#9aa4b0'); rows(8, 7, [4, 4, 4, 4], glass);
  R(6, 7, 2, 1, glint); R(6, 8, 1, 1, glint);
  if (name === 'washer') R(6, 10, 4, 1, '#5a90c0');
  addObj(name, c);
}

// ───────────── 화장실 칸 (칸막이 + 양변기) ─────────────
{
  const c = canvas(), { R, box, rows } = c;
  R(0, 0, 2, 16, '#c4ccd6'); R(0, 0, 1, 16, '#3a4250'); R(1, 0, 1, 16, '#e4e9ee');
  R(14, 0, 2, 16, '#8f98a2'); R(15, 0, 1, 16, '#3a4250');
  box(4, 0, 8, 5, '#ffffff', '#59626d'); R(5, 1, 6, 1, '#eef1f5'); R(5, 3, 6, 1, '#d6dde5'); R(10, 2, 1, 1, '#8f98a2');
  R(4, 13, 9, 1, '#28181e40');
  rows(8, 5, [6, 8, 10, 10, 10, 10, 8, 6], '#59626d'); rows(8, 6, [6, 8, 8, 8, 8, 6], '#ffffff'); rows(8, 10, [8, 6], '#dfe5ec');
  R(6, 7, 4, 3, '#a8d0e8'); R(5, 8, 6, 1, '#a8d0e8'); R(6, 7, 2, 1, '#e0f2fb');
  add('toilet', c.im);
}

// ───────────── 탄약 상자 더미 ─────────────
const OLIVE = { out: '#232a18', top: '#8a9660', topHi: '#a6b27c', front: '#5f6e3f', frontHi: '#6f7e4c', frontLo: '#48552f' };
for (const k of ['a', 'b']) {
  const c = canvas(3), { R } = c, ink = '#e8d070';
  block(c, 1, -3, 14, 18, 4, OLIVE);
  R(2, 7, 12, 1, '#3a4526'); R(2, 8, 12, 1, '#6f7e4c');
  R(3, 3, 4, 1, ink); R(9, 3, 3, 1, ink); R(3, 11, 5, 1, ink); R(10, 11, 2, 1, ink);
  for (const y of [4, 11]) { R(2, y, 1, 2, '#2e3420'); R(13, y, 1, 2, '#2e3420'); }
  for (const [x, y] of [[2, 2], [13, 2], [2, 9], [13, 9]]) R(x, y, 1, 1, '#aab3be');
  if (k === 'b') { R(9, 4, 3, 2, '#c8402a'); R(10, 3, 1, 4, '#c8402a'); R(10, 4, 1, 2, '#f4f2ea'); R(3, 5, 3, 1, ink); }
  addObj(`crate_${k}`, c);
}

// ───────────── 체단실 기구: 벤치프레스 · 아령 거치대 ─────────────
{
  let c = canvas(), { R, box } = c;
  box(4, 6, 8, 8, '#2f3a56', '#14182a'); R(5, 7, 6, 2, '#5a6a94'); R(5, 10, 6, 1, '#c8402a'); R(5, 12, 6, 1, '#222a40');
  R(1, 4, 14, 1, '#17191d'); R(1, 5, 14, 1, '#d6dde5'); R(1, 6, 14, 1, '#17191d');
  for (const x of [0, 12]) { box(x, 1, 4, 9, '#3e3e46', '#101014'); R(x + 1, 2, 1, 7, '#787882'); R(x + 2, 4, 1, 3, '#c8402a'); }
  addObj('gym_bench', c);
  c = canvas(2); ({ R, box } = c);
  R(1, 0, 14, 15, '#17191d'); R(2, 1, 12, 13, '#4a5058');
  for (const y of [1, 7]) {
    R(2, y, 12, 5, '#30343a'); R(2, y + 5, 12, 1, '#8f98a2');
    for (let i = 0; i < 3; i++) { const x = 2 + i * 4; box(x, y + 1, 4, 4, '#3e3e46', '#101014'); R(x + 1, y + 2, 1, 1, '#9a9aa4'); R(x + 1, y + 3, 2, 1, i === 1 ? '#c8402a' : '#58a0d8'); }
  }
  R(2, -2, 2, 2, '#17191d'); R(12, -2, 2, 2, '#17191d');
  addObj('gym_rack', c);
}

// ───────────── 밥차 (이어 붙는다) + 반찬통 ─────────────
for (const [name, L, Rt] of [['foodcart_l', 1, 0], ['foodcart_m', 0, 0], ['foodcart_r', 0, 1], ['foodcart_single', 1, 1]]) {
  const c = canvas(3), { R } = c, OUT = '#2b303a';
  R(0, 5, 16, 9, '#9aa2ae'); R(0, 5, 16, 1, '#59626d'); R(0, 6, 16, 1, '#c8ced6'); R(0, 9, 16, 1, '#737d89'); R(0, 10, 16, 1, '#b4bcc6'); R(0, 13, 16, 1, '#59626d');
  for (const [x, y] of [[3, 7], [9, 7], [3, 11], [9, 11]]) { R(x, y, 4, 1, '#3a4250'); R(x, y + 1, 4, 1, '#c8ced6'); }
  R(0, -3, 16, 8, '#d8dce4'); R(0, -3, 16, 1, OUT); R(0, -2, 16, 1, '#f4f6f8'); R(0, 4, 16, 1, '#aab3be');
  if (L) { R(0, -3, 1, 17, OUT); R(1, 14, 3, 2, '#17191d'); R(1, -2, 1, 6, '#f4f6f8'); }
  if (Rt) { R(15, -3, 1, 17, OUT); R(12, 14, 3, 2, '#17191d'); R(14, -1, 1, 5, '#aab3be'); }
  R(0, 14, 16, 1, OUT);
  addObj(name, c);
}
{
  const foods = [['#fbfaf4', '#e2e0d6'], ['#e8b048', '#c08828'], ['#a0682a', '#7a4a18'], ['#d0402a', '#a02a18']];
  for (const [k, i0] of [['a', 0], ['b', 2]]) {
    const c = canvas(6), { R, box } = c;
    [[1, i0], [8, i0 + 1]].forEach(([bx, fi]) => {
      const [f, fl] = foods[fi];
      box(bx, -1, 7, 5, '#8a929e', '#3a4250'); R(bx + 1, 0, 5, 3, f); R(bx + 1, 0, 5, 1, tone(f, 26)); R(bx + 4, 2, 2, 1, fl); R(bx + 2, 1, 1, 1, fl);
      R(bx + 2, -5, 1, 2, '#ffffff8c'); R(bx + 4, -6, 1, 2, '#ffffff66'); R(bx + 3, -3, 1, 1, '#ffffff55');
    });
    add(`foodcart_pans_${k}`, c.im, 0, -6);
  }
}

// ───────────── 상황판 (지휘통제실): 작전 지도 ─────────────
add('board_map', withShadow(art([
  'KKKKKKKKKKKKKKKK',
  'KssssssssssssssK',
  'KSbbbbbbggggbbSK',
  'KSbbggggggggbbSK',
  'KSbgggggRgggggSK',
  'KSbggggRRRgggbSK',
  'KSggggggRggggbSK',
  'KSgggYggggggbbSK',
  'KSggYYYgggBBbbSK',
  'KSgggYgggBBBbbSK',
  'KSbgggggggBbbbSK',
  'KSbbbggggbbbbbSK',
  'KSwwwwwwwwwwwwSK',
  'KSSSSSSSSSSSSSSK',
  'KKKKKKKKKKKKKKKK',
  '..KLK......KLK..',
  '..KLK......KLK..',
  '..KLK......KLK..',
  '.KKLKK....KKLKK.',
  '.KKKKK....KKKKK.',
], {
  K: '#262b33', s: '#d6dde5', S: '#939da8', b: '#6fa8d8', g: '#a8c88a', R: '#de4a4a', Y: '#f0c030', B: '#3a5a9c', w: '#f4f6f8', L: '#737d89',
})), 0, -4);

// ═════════════ 여기부터 야외 (계절별 땅 · 나무 · 울타리 · 훈련장 시설 · 건물 외관) ═════════════

/** 시계 방향으로 90도 돌린다 (위쪽 가장자리 그림 → 오른쪽 가장자리 그림) */
function rot90(src) {
  const im = new Img(src.h, src.w);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const i = (y * src.w + x) * 4;
    if (src.d[i + 3]) im.px(src.h - 1 - y, x, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]);
  }
  return im;
}

const SEASONS = {
  spring: { grass: '#8cc46a', dot: '#6aa850', hi: '#aadc8a', leaf: ['#3f9a4a', '#6cc470', '#2a7438', '#143f20'] },
  summer: { grass: '#6fae54', dot: '#57963f', hi: '#8ec870', leaf: ['#2f8a3e', '#56b85c', '#1f6630', '#123a1c'] },
  autumn: { grass: '#b8a860', dot: '#9a8844', hi: '#d0c27c', leaf: ['#d0782a', '#eeaa4c', '#a4541c', '#5a2a0c'] },
  winter: { grass: '#e8f0f4', dot: '#c8d9e5', hi: '#ffffff', leaf: ['#e2ecf1', '#ffffff', '#b2c8d5', '#566f80'] },
};

for (const [name, s] of Object.entries(SEASONS)) {
  // 풀밭 (64x64 무늬)
  const im = new Img(64, 64), rnd = rng(name.length * 97 + 13);
  const P = (x, y, c) => im.px(((x % 64) + 64) % 64, ((y % 64) + 64) % 64, c);
  im.rect(0, 0, 64, 64, s.grass);
  for (let i = 0; i < 16; i++) { const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64); for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) if ((a + b) % 4) P(x + a, y + b, tone(s.grass, -5)); }
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64);
    if (name === 'winter') { P(x, y, s.dot); P(x + 1, y, s.dot); P(x + 2, y, s.dot); P(x + 1, y + 1, tone(s.dot, 14)); }
    else { P(x, y + 1, s.dot); P(x + 1, y, s.dot); P(x + 2, y + 1, s.dot); P(x + 1, y + 2, s.dot); }
  }
  for (let i = 0; i < 46; i++) { const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64); P(x, y, s.hi); P(x + 1, y, s.hi); }
  if (name === 'spring') for (let i = 0; i < 7; i++) { const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64); P(x, y, i % 2 ? '#fff6c0' : '#ffffff'); P(x + 1, y + 1, '#f0d060'); }
  if (name === 'autumn') for (let i = 0; i < 16; i++) { const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64); P(x, y, i % 2 ? '#d0782a' : '#a4541c'); P(x + 1, y, '#e09a48'); }
  add(`grass_${name}`, im);

  // 풀이 길·흙 위로 번지는 가장자리 (위 → 오른쪽 → 아래 → 왼쪽 순으로 돌려 쓴다) + 대각선 모서리
  const hts = [2, 3, 2, 1, 2, 3, 3, 2, 1, 2, 2, 3, 2, 1, 2, 3];
  let e = new Img(16, 16);
  hts.forEach((h, x) => { e.rect(x, 0, 1, h, s.grass); e.px(x, h, s.dot); if (x % 5 === 1) e.px(x, 0, s.hi); });
  let c = new Img(16, 16);
  for (const [x, y] of [[13, 0], [14, 0], [15, 0], [14, 1], [15, 1], [15, 2]]) c.px(x, y, s.grass);
  for (const [x, y] of [[12, 0], [13, 1], [14, 2], [15, 3]]) c.px(x, y, s.dot);
  for (const d of ['n', 'e', 's', 'w']) { add(`fringe_${name}_${d}`, e); e = rot90(e); }
  for (const d of ['ne', 'se', 'sw', 'nw']) { add(`fringe_${name}_${d}`, c); c = rot90(c); }

  // 나무: 타일보다 크게 (옆으로 2px, 위로 11px 솟는다)
  const t = new Img(20, 27), [leaf, lhi, llo, lout] = s.leaf;
  t.rect(3, 23, 14, 3, '#1e141e30'); t.rect(5, 22, 10, 5, '#1e141e30');
  t.rect(7, 13, 6, 12, '#3a2412'); t.rect(8, 13, 4, 12, '#7a5230'); t.rect(8, 13, 1, 12, '#9a6c44'); t.rect(11, 13, 1, 12, '#5c3c20'); t.rect(6, 24, 8, 1, '#3a2412'); t.rect(7, 24, 6, 1, '#6a4628');
  const ws = [8, 12, 16, 18, 20, 20, 20, 20, 20, 20, 18, 18, 16, 12, 8];
  ws.forEach((w, y) => t.rect(10 - w / 2, y, w, 1, lout));
  ws.forEach((w, y) => { if (y > 0 && y < ws.length - 1) t.rect(11 - w / 2, y, w - 2, 1, leaf); });
  for (const [x, y, w, h] of [[5, 2, 5, 2], [3, 4, 6, 3], [4, 7, 3, 2], [10, 3, 3, 1], [11, 6, 4, 2], [7, 9, 2, 1]]) t.rect(x, y, w, h, lhi);
  for (const [x, y, w, h] of [[11, 10, 6, 3], [8, 12, 7, 1], [14, 7, 4, 3], [4, 11, 3, 2], [9, 5, 2, 1], [6, 6, 1, 1]]) t.rect(x, y, w, h, llo);
  for (const [x, y] of [[6, 3], [8, 5], [12, 4], [5, 9], [13, 9], [9, 11]]) t.px(x, y, leaf);
  if (name === 'winter') for (const [x, y] of [[12, 11], [14, 9], [9, 12], [15, 8], [5, 12]]) t.px(x, y, '#3f6a50');
  add(`tree_${name}`, t, -2, -11);
}

// 길 · 연병장 모래 · 흙 (겨울에는 눈을 치운 회갈색)
function groundTex(name, base, seed, pebbles) {
  const im = new Img(64, 64), rnd = rng(seed);
  const P = (x, y, c) => im.px(x % 64, y % 64, c);
  im.rect(0, 0, 64, 64, base);
  for (let i = 0; i < 22; i++) { const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64), w = 3 + Math.floor(rnd() * 4); for (let a = 0; a < w; a++) for (let b = 0; b < 2; b++) P(x + a, y + b, tone(base, rnd() > 0.5 ? -5 : 5)); }
  for (let i = 0; i < 120; i++) { const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64); P(x, y, tone(base, -18)); if (i % 3 === 0) P(x + 1, y, tone(base, -18)); }
  for (let i = 0; i < 60; i++) P(Math.floor(rnd() * 64), Math.floor(rnd() * 64), tone(base, 14));
  for (let i = 0; i < pebbles; i++) { const x = Math.floor(rnd() * 62), y = Math.floor(rnd() * 62); P(x, y, tone(base, 24)); P(x + 1, y, tone(base, 24)); P(x, y + 1, tone(base, -30)); P(x + 1, y + 1, tone(base, -30)); }
  add(name, im);
}
groundTex('road', '#c9b38a', 3, 6); groundTex('road_winter', '#a69f94', 4, 6);
groundTex('sand', '#dcc89c', 5, 0); groundTex('sand_winter', '#ddd6c9', 6, 0);
groundTex('dirt', '#b89a72', 7, 14); groundTex('dirt_winter', '#c6bcae', 8, 14);
groundTex('court', '#c8703c', 9, 0);
groundTex('runway', '#5a5e64', 10, 4);

// 물 + 물가
{
  const im = new Img(64, 64), rnd = rng(19);
  im.rect(0, 0, 64, 64, '#3a7ac0');
  for (let i = 0; i < 12; i++) { const x = Math.floor(rnd() * 56), y = Math.floor(rnd() * 60); im.rect(x, y, 8, 3, '#3472b8'); }
  for (let i = 0; i < 40; i++) { const x = Math.floor(rnd() * 58), y = Math.floor(rnd() * 63), w = 3 + Math.floor(rnd() * 3); im.rect(x, y, w, 1, i % 3 ? '#6aa8e0' : '#5a9ad8'); if (i % 5 === 0) im.rect(x + 1, y - 1 < 0 ? 0 : y - 1, 2, 1, '#b4d8f4'); }
  add('water', im);
  let e = new Img(16, 16);
  e.rect(0, 0, 16, 1, '#1e4a80'); e.rect(0, 1, 16, 1, '#2c62a4');
  for (const x of [1, 2, 3, 7, 8, 12, 13, 14]) e.px(x, 2, '#cfe6f6');
  for (const d of ['n', 'e', 's', 'w']) { add(`shore_${d}`, e); e = rot90(e); }
  const p = canvas();
  p.R(0, 0, 16, 16, '#a07850');
  for (let i = 0; i < 4; i++) { p.R(0, i * 4, 16, 1, '#bc9064'); p.R(0, i * 4 + 3, 16, 1, '#74522f'); p.R((i * 5 + 3) % 13 + 1, i * 4 + 1, 1, 2, '#74522f'); p.R((i * 7 + 9) % 13 + 1, i * 4 + 1, 3, 1, '#8c6842'); }
  add('pier', p.im);
}

// 꽃 (두 가지 배치)
for (const [k, off] of [['a', 0], ['b', 2]]) {
  const c = canvas(), cols = ['#f25a7a', '#f2d24a', '#ffffff', '#c47af2'];
  for (let i = 0; i < 3; i++) {
    const fx = 2 + i * 5, fy = 3 + ((i * 7 + off * 3) % 8), col = cols[(i + off) % cols.length];
    c.R(fx + 1, fy + 2, 1, 4, '#2f7a3c'); c.R(fx, fy + 4, 1, 1, '#4da858');
    c.R(fx, fy, 3, 3, '#2a1c2a'); c.R(fx + 1, fy - 1, 1, 5, '#2a1c2a'); c.R(fx - 1, fy + 1, 5, 1, '#2a1c2a');
    c.R(fx, fy, 3, 3, col); c.R(fx, fy, 1, 1, tone(col, 40)); c.R(fx + 1, fy + 1, 1, 1, '#f0b030');
  }
  add(`flower_${k}`, c.im);
}

// 울타리: 가로대 · 세로대 · 기둥을 겹쳐 쓴다
{
  const m = '#9aa0aa', hi = '#c8ced8', lo = '#5c626c', OUT = '#22262e';
  let c = canvas();
  for (const ry of [5, 10]) { c.R(0, ry - 1, 16, 3, OUT); c.R(0, ry, 16, 1, hi); }
  for (let x = 0; x < 16; x += 2) for (let y = 6; y < 10; y++) if ((x / 2 + y) % 2) c.R(x, y, 1, 1, '#5a606c66');
  c.R(0, 12, 16, 1, '#1e141e30');
  add('fence_rails', c.im);
  c = canvas(); c.R(6, 0, 4, 16, OUT); c.R(7, 0, 2, 16, m); c.R(7, 0, 1, 16, hi);
  add('fence_vbar', c.im);
  c = canvas(); c.box(6, 2, 4, 13, m, OUT); c.R(7, 3, 1, 11, hi); c.R(8, 12, 1, 2, lo); c.R(6, 1, 4, 1, OUT); c.R(7, 1, 2, 1, hi);
  addObj('fence_post', c);
}

// 사격 표적 · 모래주머니
{
  let c = canvas(1);
  c.R(4, 15, 9, 1, '#1e141e38'); c.box(7, 9, 2, 6, '#7a5230', '#3a2412');
  c.rows(8, -1, [4, 8, 10, 12, 12, 12, 12, 10, 8, 4], '#22262e'); c.rows(8, 0, [6, 8, 10, 10, 10, 10, 8, 6], '#f4f2ea');
  c.rows(8, 1, [6, 8, 8, 8, 8, 6], '#d03a3a'); c.rows(8, 2, [4, 4, 4, 4], '#f4f2ea'); c.R(7, 3, 2, 2, '#d03a3a'); c.R(5, 1, 2, 1, '#ffffff');
  add('target', c.im, 0, -1);
  c = canvas();
  c.R(1, 15, 15, 1, '#1e141e38');
  for (let i = 0; i < 3; i++) for (const k of i % 2 ? [0, 1, 2] : [0, 1]) {
    const xx = k * 8 - (i % 2 ? 4 : 0), by = 1 + i * 5, cx = Math.max(0, xx), cw = Math.min(16, xx + 8) - cx;
    c.R(cx, by, cw, 5, '#5c5032');
    const ix = cx + (xx >= 0 ? 1 : 0), iw = cw - (xx >= 0 ? 1 : 0) - (xx + 8 <= 16 ? 1 : 0);
    c.R(ix, by + 1, iw, 3, '#c4b47e'); c.R(ix, by + 1, iw, 1, '#dccf9c'); c.R(ix, by + 3, iw, 1, '#a89868');
    if (iw > 4) c.R(ix + Math.floor(iw / 2), by + 2, 1, 1, '#a89868');
  }
  add('sandbag', c.im);
}

// 초소 · 격납고 (이어 붙는 덩어리, 이름 뒤 숫자는 상판 가구와 같은 규칙)
for (let mask = 0; mask < 16; mask++) {
  const L = mask & 1, Rt = mask & 2, U = mask & 4, D = mask & 8, OUT = '#181c14';
  let c = canvas();
  c.R(0, 0, 16, 16, '#7a8a6a'); c.R(0, 0, 16, 1, '#8a9a7a');
  if (U) { c.R(0, 0, 16, 5, '#56684c'); c.R(0, 0, 16, 1, OUT); c.R(0, 1, 16, 1, '#72866a'); c.R(0, 4, 16, 1, '#3e4c36'); c.R(0, 5, 16, 1, OUT); }
  if (D) { c.R(0, 12, 16, 3, '#5f6f52'); c.R(0, 12, 16, 1, '#4a5840'); c.R(0, 15, 16, 1, OUT); }
  if (!U || D) { c.box(3, U ? 7 : 2, 10, 5, '#a8c8e8', '#2a3424'); c.R(4, U ? 8 : 3, 4, 1, '#e4f2ff'); c.R(8, U ? 7 : 2, 1, 5, '#2a3424'); }
  if (L) c.R(0, 0, 1, 16, OUT);
  if (Rt) c.R(15, 0, 1, 16, OUT);
  addObj(`booth_${mask}`, c);
  c = canvas();
  c.R(0, 0, 16, 16, '#8a929a');
  for (let i = 0; i < 4; i++) { c.R(0, i * 4, 16, 1, '#aab2ba'); c.R(0, i * 4 + 3, 16, 1, '#6e767e'); }
  if (U) { c.R(0, 0, 16, 1, OUT); c.R(0, 1, 16, 2, '#c4ccd4'); }
  if (D) { c.R(0, 12, 16, 3, '#565e66'); c.R(0, 12, 16, 1, '#3e454c'); c.R(0, 15, 16, 1, OUT); }
  if (L) { c.R(0, 0, 1, 16, OUT); c.R(1, U ? 3 : 0, 1, D ? 9 : 16, '#aab2ba'); }
  if (Rt) { c.R(15, 0, 1, 16, OUT); c.R(14, U ? 3 : 0, 1, D ? 9 : 16, '#6e767e'); }
  addObj(`hangar_${mask}`, c);
  // 흙을 덮은 탄약고 벙커
  c = canvas();
  c.R(0, 0, 16, 16, '#6a7a52');
  c.R(3 + (mask % 4) * 2, 3, 4, 1, '#869a6c'); c.R(5 + (mask % 3) * 2, 8, 3, 1, '#536442'); c.R(1 + (mask % 5) * 2, 6, 2, 1, '#869a6c');
  if (U) { c.R(0, 0, 16, 1, OUT); c.R(0, 1, 16, 1, '#8ea274'); }
  if (L) { c.R(0, 0, 1, 16, OUT); c.R(1, 1, 1, 14, '#7c8e62'); }
  if (Rt) { c.R(15, 0, 1, 16, OUT); c.R(14, 1, 1, 14, '#56664a'); }
  if (D) { c.R(0, 11, 16, 4, '#8a8e7a'); c.R(0, 11, 16, 1, '#aaae9a'); c.R(0, 14, 16, 1, '#6a6e5c'); c.R(0, 15, 16, 1, OUT); }
  addObj(`bunker_${mask}`, c);
}
{
  // 벙커 철문 (늘 조금 열려 있다)
  const c = canvas();
  c.box(2, 2, 12, 13, '#4a5058', '#14161a'); c.R(3, 3, 10, 1, '#70777f'); c.R(3, 4, 1, 10, '#5c636b'); c.R(7, 3, 1, 11, '#2e3238'); c.R(8, 4, 1, 10, '#0c0c10');
  c.box(3, 0, 10, 3, '#e8c040', '#5c4a10'); c.R(5, 1, 6, 1, '#5c4a10'); c.R(10, 8, 2, 2, '#c4cad4'); c.R(4, 8, 1, 1, '#8f98a2'); c.R(4, 12, 1, 1, '#8f98a2');
  add('bunker_door', c.im);
}

// 농구 골대 · 돌탑 · 분리수거함
for (const top of [1, 0]) {
  const c = canvas();
  c.R(7, top ? 0 : 8, 2, 8, '#5a5a62'); c.R(7, top ? 0 : 8, 1, 8, '#9a9aa2');
  c.box(2, 4, 12, 8, '#ffffff', '#2a2a34'); c.R(3, 5, 10, 1, '#f4f6fa'); c.box(5, 6, 6, 4, '#ffffff', '#d04a2a');
  c.R(5, top ? 12 : 3, 6, 1, '#f08838'); c.R(6, top ? 13 : 2, 4, 1, '#e8e8f0'); c.R(7, top ? 14 : 1, 2, 1, '#c8c8d4');
  addObj(top ? 'hoop_top' : 'hoop_bot', c);
}
{
  const stone = '#8a8a90', dark = '#5e5e66', hi = '#b4b4bc', moss = '#5a7a3e', OUT = '#22222a';
  let c = canvas();
  c.box(4, 10, 8, 6, stone, OUT); c.R(5, 11, 3, 1, hi); c.R(9, 13, 2, 1, moss); c.R(10, 11, 1, 4, dark);
  c.box(5, 5, 6, 5, '#84848a', OUT); c.R(6, 6, 2, 1, hi); c.R(9, 6, 1, 3, dark);
  c.box(6, 0, 4, 5, '#6e6a78', OUT); c.R(8, 1, 1, 3, '#8a5ab8'); c.R(7, 2, 1, 1, '#b48ae0');
  add('cairn_top', c.im);
  c = canvas();
  c.R(1, 14, 14, 2, '#1e141e38');
  c.box(1, 7, 14, 8, dark, OUT); c.R(2, 8, 5, 1, stone); c.R(9, 9, 4, 1, stone);
  c.box(2, 0, 12, 7, stone, OUT); c.R(3, 1, 4, 1, hi); c.R(10, 2, 2, 1, hi); c.R(12, 1, 1, 5, dark);
  c.R(1, 12, 3, 2, moss); c.R(11, 5, 3, 2, moss); c.R(6, 13, 2, 1, moss); c.R(2, 12, 1, 1, '#7a9a58');
  c.R(5, 3, 1, 1, dark); c.R(9, 11, 1, 1, '#3e3e46');
  add('cairn_bot', c.im);
}
['#3a8a3a', '#e0b030', '#3a6ac8', '#8a8a8a', '#c87a3a', '#6a4a2a'].forEach((col, i) => {
  const c = canvas(), OUT = tone(col, -90);
  c.box(2, 3, 12, 12, col, OUT); c.R(3, 4, 1, 10, tone(col, 34)); c.R(12, 4, 1, 10, tone(col, -34)); c.R(3, 12, 10, 2, tone(col, -34));
  c.box(1, 1, 14, 4, tone(col, 26), OUT); c.R(2, 2, 12, 1, tone(col, 60)); c.R(6, 0, 4, 1, OUT);
  c.box(5, 7, 6, 4, '#f4f2ea', tone(col, -60)); c.R(6, 8, 4, 1, tone(col, -20));
  c.R(3, 14, 2, 1, '#17191d'); c.R(11, 14, 2, 1, '#17191d');
  addObj(`bin_${i}`, c);
});

// ───────────── 건물 외관: 지붕(색 셋) · 처마 · 눈 · 정면 벽 · 창 · 현관문 ─────────────
for (const [k, col] of [['green', '#5a7a4a'], ['red', '#a0503a'], ['orange', '#c08a3a']]) {
  const r = new Img(16, 16);
  r.rect(0, 0, 16, 16, col);
  for (const [y0, xs] of [[0, [3, 11]], [8, [7, 15]]]) {
    r.rect(0, y0, 16, 1, tone(col, 16)); r.rect(0, y0 + 7, 16, 1, tone(col, -30)); r.rect(0, y0 + 6, 16, 1, tone(col, -10));
    for (const x of xs) { r.rect(x, y0 + 1, 1, 6, tone(col, -20)); r.px((x + 1) % 16, y0 + 1, tone(col, 26)); }
  }
  add(`roof_${k}`, r);
  const e = new Img(16, 5);
  e.rect(0, 0, 16, 1, tone(col, -70)); e.rect(0, 1, 16, 2, tone(col, -46)); e.rect(0, 3, 16, 1, tone(col, -60)); e.rect(0, 4, 16, 1, '#181018');
  add(`eave_${k}`, e);
}
{
  const s = new Img(16, 16);
  s.rect(0, 0, 16, 16, '#f8fbff');
  for (const [x, y] of [[3, 4], [9, 2], [12, 9], [5, 11], [1, 13], [14, 5]]) s.rect(x, y, 2, 1, '#e0eaf4');
  add('roof_snow', s);
  const d = new Img(16, 4);
  [3, 2, 1, 2, 3, 4, 3, 2, 1, 1, 2, 3, 4, 3, 2, 2].forEach((h, x) => { d.rect(x, 0, 1, h, '#f8fbff'); d.px(x, h - 1, '#d0deec'); });
  add('roof_snow_edge', d);

  const wall = (win) => {
    const f = new Img(16, 32);
    f.rect(0, 0, 16, 32, '#ece2c8');
    for (const [x, y] of [[3, 6], [11, 9], [6, 18], [13, 20], [2, 14]]) f.px(x, y, '#ddd2b6');
    f.rect(0, 2, 16, 2, '#00000022');
    f.rect(0, 23, 16, 1, '#56684c'); f.rect(0, 24, 16, 5, '#7d9070'); f.rect(0, 24, 16, 1, '#96aa88'); f.rect(0, 28, 16, 1, '#6c8060');
    f.rect(0, 29, 16, 2, '#5c564e'); f.rect(0, 29, 16, 1, '#7a7268'); f.rect(0, 31, 16, 1, '#181018');
    if (win) {
      f.rect(2, 5, 12, 11, '#2a2230'); f.rect(3, 6, 10, 9, '#6a9cc8'); f.rect(3, 6, 10, 3, '#a8d0f0'); f.rect(4, 7, 3, 1, '#e8f6ff'); f.rect(3, 12, 10, 3, '#5a8ab8');
      f.rect(8, 6, 1, 9, '#f4f2ea'); f.rect(3, 10, 10, 1, '#f4f2ea');
      f.rect(1, 15, 14, 1, '#d6dde5'); f.rect(1, 16, 14, 1, '#2a2230'); f.rect(2, 17, 12, 1, '#00000022');
    }
    return f;
  };
  add('facade', wall(false)); add('facade_win', wall(true));

  const leaf = (left) => {
    const im = new Img(16, 26);
    im.rect(0, 0, 16, 26, '#2e2018');
    const x0 = left ? 2 : 0, x1 = left ? 15 : 13;
    im.rect(left ? 1 : 0, 1, left ? 15 : 15, 24, '#6e4826');
    im.rect(x0, 2, x1 - x0 + 1, 23, '#a9733f'); im.rect(x0, 2, x1 - x0 + 1, 1, '#cf9a62'); im.rect(x0, 3, 1, 22, '#c08a52'); im.rect(x1, 3, 1, 22, '#8a5a30');
    im.rect(x0 + 2, 4, x1 - x0 - 3, 8, '#5a3a20'); im.rect(x0 + 3, 5, x1 - x0 - 5, 6, '#86bcd8'); im.rect(x0 + 3, 5, x1 - x0 - 5, 2, '#c6e8f4');
    im.rect(x0 + 2, 15, x1 - x0 - 3, 8, '#b27c46'); im.rect(x0 + 2, 15, x1 - x0 - 3, 1, '#8a5a30'); im.rect(x0 + 2, 15, 1, 8, '#8a5a30'); im.rect(x0 + 2, 22, x1 - x0 - 3, 1, '#c08a52');
    const hx = left ? x1 - 1 : x0 + 1;
    im.rect(hx, 13, 1, 2, '#f6e08a'); im.px(hx, 14, '#a8842c');
    im.rect(left ? 15 : 0, 2, 1, 23, '#4a301c');
    im.rect(0, 25, 16, 1, '#8a8478');
    return im;
  };
  add('bdoor_l', leaf(true)); add('bdoor_r', leaf(false));
}

// ───────────── 아틀라스로 묶기 ─────────────
const ATLAS_W = 256;
let cx = 0, cy = 0, rowH = 0;
const placed = {};
for (const s of sprites) {
  if (cx + s.img.w > ATLAS_W) { cx = 0; cy += rowH + 1; rowH = 0; }
  placed[s.name] = { x: cx, y: cy, w: s.img.w, h: s.img.h, ox: s.ox, oy: s.oy };
  s.at = [cx, cy];
  cx += s.img.w + 1;
  rowH = Math.max(rowH, s.img.h);
}
const atlas = new Img(ATLAS_W, cy + rowH);
for (const s of sprites) atlas.blit(s.img, s.at[0], s.at[1]);

// ───────────── PNG 쓰기 ─────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(im) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(im.w, 0); ihdr.writeUInt32BE(im.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((im.w * 4 + 1) * im.h);
  for (let y = 0; y < im.h; y++) Buffer.from(im.d.buffer, y * im.w * 4, im.w * 4).copy(raw, y * (im.w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const outPng = path.join(ROOT, 'public/tiles/barracks.png');
const outJson = path.join(ROOT, 'src/game/data/tilesets/barracks.json');
fs.mkdirSync(path.dirname(outPng), { recursive: true });
fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outPng, png(atlas));
fs.writeFileSync(outJson, JSON.stringify({ image: '/tiles/barracks.png', tile: 16, sprites: placed }, null, 2) + '\n');
console.log(`아틀라스 ${atlas.w}x${atlas.h}px, 조각 ${sprites.length}개, ${fs.statSync(outPng).size}바이트 → ${path.relative(ROOT, outPng)}`);

// 확인용 확대본 (회색 바탕)
const pi = process.argv.indexOf('--preview');
if (pi > 0 && process.argv[pi + 1]) {
  const S = 6, pv = new Img(atlas.w * S, atlas.h * S);
  pv.rect(0, 0, pv.w, pv.h, '#6a6a78');
  for (let y = 0; y < atlas.h; y++) for (let x = 0; x < atlas.w; x++) {
    const i = (y * atlas.w + x) * 4;
    if (atlas.d[i + 3]) pv.rect(x * S, y * S, S, S, [atlas.d[i], atlas.d[i + 1], atlas.d[i + 2], atlas.d[i + 3]]);
  }
  fs.writeFileSync(process.argv[pi + 1], png(pv));
}
