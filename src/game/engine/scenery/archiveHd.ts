import { type Ink, type Point, seeded } from './pixels';
import { brush, vignette } from './hd';

/** 사진 밑에 적힌 연도 숫자 (3×5) */
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

/** 사진틀의 설계 크기 */
const FW = 124, FH = 82;

/** 사진의 빛깔: 새것은 회색에 가깝고, 오래될수록 누렇게 바랜다 */
const TONE = [
  { mat: '#d8c9a8', sky: '#bcb7a3', far: '#98978a', hall: '#858679', ground: '#8f8875', uni: '#55564c', lit: '#707165', dark: '#3a3a34', light: '#ddd5bf', fur: ['#77726a', '#a39c8b', '#64625b', '#8e897c'] },
  { mat: '#d0bc95', sky: '#c4b493', far: '#9d9073', hall: '#8b7f66', ground: '#94846b', uni: '#594f41', lit: '#74695b', dark: '#40372e', light: '#e3d2ab', fur: ['#7c6e5d', '#a8957b', '#685e51', '#93816b'] },
  { mat: '#c7b28d', sky: '#cdbc96', far: '#a89775', hall: '#97866b', ground: '#9d8b6d', uni: '#685b48', lit: '#827361', dark: '#53483a', light: '#e7d6ae', fur: ['#877862', '#b09d7f', '#75695a', '#9c8b71'] },
];

/** 다각형을 줄 단위로 채운다 (pts 는 캔버스 픽셀). 색 대신 그러데이션도 받는다: 멀어질수록 옅어지는 빛줄기 */
function sweep(g: Ink, style: string | CanvasGradient, pts: Point[]) {
  const y0 = Math.round(Math.min(...pts.map((p) => p[1]))), y1 = Math.round(Math.max(...pts.map((p) => p[1])));
  g.fillStyle = style;
  for (let y = y0; y < y1; y++) {
    const yc = y + 0.5, xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
      if (b > a) g.fillRect(a, y, b - a, 1);
    }
  }
}

/** 작은 숫자를 한 칸에 한 픽셀씩 찍는다 (cx, cy = 글씨 한가운데) */
function digits(g: Ink, text: string, cx: number, cy: number, color: string) {
  let x = Math.round(cx - (text.length * 4 - 1) / 2);
  const y = Math.round(cy - 2.5);
  g.fillStyle = color;
  for (const ch of text) {
    DIGITS[ch]?.forEach((bits, r) => [...bits].forEach((b, c) => { if (b === '1') g.fillRect(x + c, y + r, 1, 1); }));
    x += 4;
  }
}

/** 꺾은선 위에서 x 자리의 높이 */
function along(pts: Point[], x: number) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    if ((x >= ax && x <= bx) || (x <= ax && x >= bx)) return bx === ax ? ay : ay + (x - ax) / (bx - ax) * (by - ay);
  }
  return pts[x < pts[0][0] ? 0 : pts.length - 1][1];
}

/** 타원으로 눌린 빛 웅덩이 (책상 위에 고인 불빛) */
function pool(g: Ink, cx: number, cy: number, rx: number, ry: number, c: string) {
  g.save();
  g.translate(0, cy); g.scale(1, ry / rx); g.translate(0, -cy);
  const light = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
  light.addColorStop(0, c);
  light.addColorStop(1, c.slice(0, 7) + '00');
  g.fillStyle = light;
  g.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
  g.restore();
}

/**
 * 해마다 찍은 부대 단체 사진 한 장 (x, y = 액자 왼쪽 위 캔버스 픽셀, k = 설계 1칸의 픽셀 수).
 * 세 줄로 선 열두 얼굴. 둘째 줄 왼쪽 끝에는 해마다 같은 부엉이가 서 있고, 가슴의 계급장만 바뀐다.
 */
function groupPrint(g: Ink, x: number, y: number, k: number, idx: number, year: number) {
  const rand = seeded(841 + idx);
  const P = brush(g, Math.round(x), Math.round(y), k);
  const t = TONE[idx % 3];
  // 못과 걸이 철사
  P.seg('#2c2620', 62, -6, 30, 1, 0.5);
  P.seg('#2c2620', 62, -6, 94, 1, 0.5);
  P.box('#9a8a6c', 61, -7, 2, 2);
  // 벽에 지는 그림자: 빛은 왼쪽 위 창에서 온다
  P.box('#16120e40', 3, 4, FW, FH);
  P.box('#16120e26', 6, 8, FW, FH);
  // 나무 액자틀: 위 · 왼쪽 면이 빛을 받는다
  P.box('#33251d', 0, 0, FW, FH);
  P.box('#624534', 1, 1, FW - 2, FH - 2);
  P.box('#7b5940', 1, 1, FW - 2, 3);
  P.box('#bb9165', 1, 1, FW - 2, 1);
  P.box('#94704e', 1, 1, 1, FH - 2);
  P.box('#4c3528', FW - 4, 4, 3, FH - 5);
  P.box('#4c3528', 4, FH - 4, FW - 5, 3);
  for (let i = 0; i < 6; i++) P.box('#5a4130', 6 + rand() * 90, i % 2 ? 2.5 : FH - 2.5, 10 + rand() * 20, 0.5);
  P.box('#2a1f19', 6, 6, FW - 12, FH - 12);
  // 매트: 틀이 위 · 왼쪽으로 그늘을 드리운다
  P.box(t.mat, 7, 7, FW - 14, FH - 14);
  P.box('#0000001f', 7, 7, FW - 14, 2);
  P.box('#00000016', 7, 9, 2, FH - 16);
  P.box('#f1e7cc', 13, 11, 98, 54);

  // ── 사진: 막사 앞에 세 줄로 선 부대원들 ──
  P.clip(14, 12, 96, 52, () => {
    P.fade([t.light, t.sky], 14, 12, 96, 16);
    P.ridge(t.far, 14, 110, (px) => 24 - 3.5 * Math.sin(px / 9 + idx) - 2 * Math.sin(px / 4), () => 30);
    // 막사 벽과 처마
    P.box(t.sky, 14, 26, 96, 12);
    P.box(t.far, 14, 25, 96, 1);
    P.box(t.ground, 14, 37, 96, 28);
    P.box(t.lit + '66', 14, 37, 96, 1);
    // 현수막: 장대가 얼굴 사이에 선다
    P.box(t.dark, 35, 13, 0.7, 14); P.box(t.dark, 87, 13, 0.7, 14);
    P.box(t.light, 35.5, 14, 51.5, 6);
    P.box(t.lit + '55', 35.5, 19, 51.5, 1);
    for (let bx = 39; bx < 84; bx += 4.2) P.box(t.dark + 'aa', bx, 16, 2.4, 2);
    // 세 줄: 뒷줄이 위에 작게, 앞줄이 아래에 크게
    for (let row = 0; row < 3; row++) {
      const f = 0.84 + row * 0.08, hy = 30 + row * 10.5;
      for (let col = 0; col < 4; col++) {
        const cx = 26 + col * 24 + (row % 2 ? 2.5 : -1);
        const owl = row === 1 && col === 0;
        const fur = owl ? t.dark : t.fur[Math.floor(rand() * 4)];
        const ears = owl ? -1 : Math.floor(rand() * 5);
        // 군복 입은 어깨
        P.oval(t.uni, cx, hy + 8 * f, 9.5 * f, 4.5 * f);
        P.box(t.uni, cx - 9.5 * f, hy + 8 * f, 19 * f, 14 * f);
        P.oval(t.lit, cx - 4 * f, hy + 6.8 * f, 4 * f, 1.4 * f);
        P.poly(t.light, [[cx - 2.4 * f, hy + 4.6 * f], [cx + 2.4 * f, hy + 4.6 * f], [cx, hy + 8.4 * f]]);
        // 귀
        if (ears === 0) { P.oval(fur, cx - 4.2 * f, hy - 4.2 * f, 2.2 * f, 2.2 * f); P.oval(fur, cx + 4.2 * f, hy - 4.2 * f, 2.2 * f, 2.2 * f); }
        if (ears === 1) {
          P.poly(fur, [[cx - 5.4 * f, hy - 1], [cx - 4.8 * f, hy - 8 * f], [cx - 1 * f, hy - 4 * f]]);
          P.poly(fur, [[cx + 5.4 * f, hy - 1], [cx + 4.8 * f, hy - 8 * f], [cx + 1 * f, hy - 4 * f]]);
        }
        if (ears === 2) { P.oval(fur, cx - 2.4 * f, hy - 7 * f, 1.4 * f, 4.4 * f); P.oval(fur, cx + 2.6 * f, hy - 7.4 * f, 1.4 * f, 4.4 * f); }
        if (ears === 3) { P.oval(fur, cx - 5.4 * f, hy + 0.5 * f, 1.8 * f, 3.6 * f); P.oval(fur, cx + 5.4 * f, hy + 0.5 * f, 1.8 * f, 3.6 * f); }
        if (owl) {
          P.poly(fur, [[cx - 5.6 * f, hy - 1 * f], [cx - 6.4 * f, hy - 8 * f], [cx - 1.6 * f, hy - 4.4 * f]]);
          P.poly(fur, [[cx + 5.6 * f, hy - 1 * f], [cx + 6.4 * f, hy - 8 * f], [cx + 1.6 * f, hy - 4.4 * f]]);
        }
        // 머리: 오른쪽이 그늘진다
        P.oval(fur, cx, hy, 5.6 * f, 5.1 * f);
        P.oval(t.dark + '55', cx, hy, 5.6 * f, 5.1 * f, (dx, dy) => dx + dy * 0.3 > 0.42);
        if (owl) {
          P.oval(t.light, cx - 2.2 * f, hy, 2.2 * f, 2.3 * f);
          P.oval(t.light, cx + 2.2 * f, hy, 2.2 * f, 2.3 * f);
          P.poly(t.ground, [[cx - 1 * f, hy + 1.6 * f], [cx + 1 * f, hy + 1.6 * f], [cx, hy + 3.6 * f]]);
          // 계급장: 해마다 한 줄씩 는다
          for (let i = 0; i <= idx % 4; i++) P.box(t.light, cx - 6 * f + i * 1.6 * f, hy + 11 * f, 0.8, 2);
        } else if (rand() > 0.5) P.oval(t.light + 'aa', cx, hy + 2 * f, 2.4 * f, 1.6 * f);
        g.fillStyle = '#1c1b18';
        g.fillRect(P.X(cx - 2.2 * f), P.Y(hy - 0.4 * f), 1, 1);
        g.fillRect(P.X(cx + 2.2 * f), P.Y(hy - 0.4 * f), 1, 1);
      }
    }
    // 바랜 자국
    for (let i = 0; i < 10 + (idx % 3) * 8; i++) P.box(i % 3 ? t.light + '44' : t.dark + '22', 14 + rand() * 96, 12 + rand() * 52, 0.8, 0.8);
    P.box('#00000014', 14, 12, 96, 2);
    P.box('#00000012', 14, 62, 96, 2);
  });
  digits(g, String(year), P.X(62), P.Y(70), '#6b5c47');
  // 유리에 비친 창빛
  P.poly('#fff6e00d', [[2, 2], [34, 2], [10, FH - 2], [2, FH - 2]]);
  P.poly('#fff6e009', [[44, 2], [54, 2], [30, FH - 2], [20, FH - 2]]);
}

/**
 * 방의 뼈대: 벽 · 책상 줄과 블라인드 창, 그 살 사이로 든 빛줄기. 그림과 먼지 알갱이가 같이 쓴다.
 * 빛줄기는 창(왼쪽 12%)에서 시작해 기울기 0.3으로 내려가며 폭의 58%에서 사라진다.
 */
function room(w: number, h: number) {
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const wall = Math.round(h * 0.64), rail = wall - u(48);
  const deskY = Math.round(h * 0.68), front = deskY + u(38);
  const shutter = Math.round(w * 0.12);
  const winTop = u(14), sill = rail - u(3), trim = Math.max(3, u(8));
  const glassR = shutter - trim, glassTop = winTop + trim, glassBot = sill - u(2);
  const pitch = Math.max(5, Math.round(16 * s)), slat = Math.max(3, Math.round(pitch * 0.55)), head = u(9);
  const gaps: [number, number][] = [];
  for (let y = glassTop + head + u(2); y + pitch < glassBot - u(4); y += pitch) gaps.push([y + slat, y + pitch]);
  const lastY = gaps.length ? gaps[gaps.length - 1][1] : glassTop + head;
  const reach = w * 0.58, slope = 0.3;
  return { s, u, wall, rail, deskY, front, shutter, winTop, sill, glassR, glassTop, glassBot, pitch, slat, head, gaps, lastY, reach, slope };
}

/**
 * 빛줄기 속을 떠도는 먼지 (멈춘 그림 위에 125ms마다 다시 찍는다, t = 초).
 * 알갱이는 블라인드 틈에서 든 빛의 띠 안에서만 떠다니고, 빛을 따라 천천히 오른쪽 아래로 흘러간다. 창에 가까울수록 밝다.
 */
export function archiveDust(g: Ink, w: number, h: number, t: number) {
  const { s, shutter, glassTop, lastY, front, reach, slope } = room(w, h);
  const run = reach - shutter, k = Math.max(1, h / 240);
  for (let i = 0; i < 44; i++) {
    const d = (i * 97.3 + t * k * (1.2 + (i % 3) * 0.8)) % run;
    const v = (i * 0.618) % 1;
    const x = shutter + d;
    const y = glassTop + (lastY - glassTop) * v + d * slope * (1 + v * 0.1) + Math.sin(t * 0.5 + i * 1.7) * 3 * k;
    if (y < glassTop || y > front) continue;
    const big = i % 4 === 0 && s >= 0.9;
    g.fillStyle = d / run < 0.45 ? '#fff1cca8' : '#fff1cc60';
    g.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1);
  }
}

/**
 * 기록 보관실 (고해상도): 도서관 안쪽 방. 블라인드 틈으로 오후 햇빛이 비스듬히 들고,
 * 벽에는 해마다 찍은 부대 단체 사진이 빼곡하다. 책상 위에는 스탠드와 펼친 「별똥별 부대사」.
 * 벽이 책상에 닿는 줄(높이의 64%) · 블라인드 창(왼쪽 12%) · 사진 줄 수(휴대폰은 네 줄까지)는 예전 그림과 같다.
 * 떠다니는 먼지는 archiveDust 가 이 그림 위에 따로 찍는다.
 */
export function archiveHd(g: Ink, w: number, h: number) {
  const rand = seeded(2741);
  const R = room(w, h);
  const { s, u, wall, rail, deskY, front, shutter, winTop, sill, glassR, glassTop, glassBot, pitch, slat, head, gaps, lastY } = R;
  const fill = (c: string | CanvasGradient, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };

  // ── 벽: 칠이 바랜 회벽. 아래로 갈수록 스탠드 불빛을 받아 따뜻하다 ──
  const paint = g.createLinearGradient(0, 0, 0, rail);
  ['#30362f', '#4b5042', '#6c6d55', '#938463'].forEach((c, i, a) => paint.addColorStop(i / (a.length - 1), c));
  fill(paint, 0, 0, w, rail);
  for (let i = 0; i < 7; i++) {
    const bx = rand() * w, by = rand() * rail * 0.8, r = (60 + rand() * 120) * s;
    const blot = g.createRadialGradient(bx, by, 0, bx, by, r);
    blot.addColorStop(0, i % 2 ? '#c9b98f12' : '#1b1f1a1a'); blot.addColorStop(1, '#1b1f1a00');
    fill(blot, bx - r, by - r, r * 2, r * 2);
  }
  for (let i = 0; i < w * rail / 240; i++) fill(i % 4 ? '#d0c19913' : '#1a1e1920', rand() * w, rand() * rail, 1 + rand() * 5 * s, 1);
  const sun = g.createRadialGradient(shutter, rail * 0.4, 0, shutter, rail * 0.4, w * 0.55);
  sun.addColorStop(0, '#ffd99a30'); sun.addColorStop(1, '#ffd99a00');
  fill(sun, 0, 0, w, rail);

  // ── 사진: 벽에 들어가는 만큼 온전한 장수로, 가운데 맞춰 건다 (세로로 긴 벽은 네 줄까지) ──
  const ps = Math.min(h / 426, w / 520);
  const pw = FW * ps, ph = FH * ps, gx = 9 * ps, gy = 8 * ps;
  const left = shutter + u(16), right = w - u(16), top = Math.round(h * 0.06), bottom = rail - u(12);
  const cols = Math.max(1, Math.floor((right - left + gx) / (pw + gx)));
  const rows = Math.max(2, Math.min(4, Math.floor((bottom - top + gy) / (ph + gy))));
  const x0 = left + (right - left - (cols * (pw + gx) - gx)) / 2;
  const y0 = top + (bottom - top - (rows * (ph + gy) - gy)) / 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = col * rows + row, k = ps * (1 - (idx % 3) * 0.03);
      groupPrint(g, x0 + col * (pw + gx) + (pw - FW * k) / 2, y0 + row * (ph + gy) + (ph - FH * k) / 3, k, idx, 2025 - idx);
    }
  }

  // 세로로 긴 벽: 사진 위 빈자리에 멈춘 벽시계
  if (y0 - top > 66 * s) {
    const C = brush(g, Math.round(x0 + (cols * (pw + gx) - gx) / 2), Math.round((top + y0) / 2 - 4 * s), s);
    C.oval('#16120e40', 3, 4, 26, 26);
    C.oval('#3a2a20', 0, 0, 26, 26);
    C.oval('#6e5039', 0, 0, 25, 25);
    C.oval('#a07a54', 0, 0, 25, 25, (dx, dy) => dx + dy < -0.7 && dx * dx + dy * dy > 0.72);
    C.oval('#2e231c', 0, 0, 21, 21);
    C.oval('#e0d4b4', 0, 0, 20, 20);
    C.oval('#c9bb98', 0, 0, 20, 20, (dx, dy) => dx + dy > 0.5);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, r = i % 3 ? 17 : 16;
      C.seg('#4a3e30', Math.sin(a) * r, -Math.cos(a) * r, Math.sin(a) * 18, -Math.cos(a) * 18, i % 3 ? 0.6 : 1.4);
    }
    const hand = (a: number, len: number, t: number) => C.seg('#2b241d', 0, 0, Math.sin(a) * len, -Math.cos(a) * len, t);
    hand((4 + 47 / 60) * Math.PI / 6, 10, 1.6);
    hand(47 * Math.PI / 30, 15, 1);
    C.oval('#8a6a3c', 0, 0, 1.6, 1.6);
    C.oval('#ffffff22', -6, -8, 9, 5, (dx, dy) => dy < 0.2);
  }

  // ── 블라인드를 내린 창: 왼쪽 끝에서 잘려 보인다. 살 사이로 오후 햇빛이 샌다 ──
  fill('#22261f', 0, winTop - u(2), shutter + u(2), sill - winTop + u(2));
  fill('#3b4239', 0, winTop, shutter, sill - winTop);
  fill('#566050', 0, winTop, shutter, 1);
  fill('#2b3029', shutter - 1, winTop, 1, sill - winTop);
  const glass = g.createLinearGradient(0, glassTop, 0, glassBot);
  ['#fde8b6', '#f3d195', '#e0b277'].forEach((c, i, a) => glass.addColorStop(i / (a.length - 1), c));
  fill(glass, 0, glassTop, glassR, glassBot - glassTop);
  fill('#ffefc8', glassR, glassTop, 1, glassBot - glassTop);
  // 살: 위는 하늘빛을 받아 밝고 아래는 그늘, 그 사이 틈이 빛난다
  for (const [a] of gaps) {
    const y = a - slat, half = Math.ceil((slat - 2) / 2);
    fill('#dfd2a6', 0, y, glassR, 1);
    fill('#a39b77', 0, y + 1, glassR, half);
    fill('#86805f', 0, y + 1 + half, glassR, slat - 2 - half);
    fill('#5b5e4c', 0, y + slat - 1, glassR, 1);
    fill('#fff4d4', 0, y + slat + Math.floor((pitch - slat) / 2), glassR, 1);
  }
  // 아래 가로대 · 위 머리상자
  fill('#8c8566', 0, lastY, glassR, u(6));
  fill('#cfc29a', 0, lastY, glassR, 1);
  fill('#4f5243', 0, lastY + u(6) - 1, glassR, 1);
  fill('#857f62', 0, glassTop, glassR, head);
  fill('#b9b28f', 0, glassTop + 1, glassR, 1);
  fill('#4f5243', 0, glassTop + head - 1, glassR, 1);
  // 사다리 끈과 당김줄
  for (const f of [0.28, 0.76]) fill('#ece2bf55', Math.round(glassR * f), glassTop + head, Math.max(1, u(1.4)), lastY - glassTop - head);
  const cordX = Math.round(glassR * 0.52), cordEnd = Math.round(glassTop + (lastY - glassTop) * 0.82);
  fill('#4c4e40', cordX, glassTop + head, 1, cordEnd - glassTop - head);
  fill('#6c6a54', cordX - u(1.5), cordEnd, u(3), u(7));
  fill('#a49d7d', cordX - u(1.5), cordEnd, 1, u(7));
  // 창턱
  fill('#b4a882', 0, sill, shutter + u(8), u(3));
  fill('#e2d6aa', 0, sill, shutter + u(8), 1);
  fill('#6c654c', 0, sill + u(3), shutter + u(8), u(2));

  // ── 징두리 판벽 ──
  fill('#4a4e41', 0, rail, w, wall - rail);
  const board = Math.max(8, Math.round(28 * s));
  for (let x = Math.round(board / 2); x < w; x += board) {
    fill('#363a31', x, rail + u(4), 1, wall - rail - u(4));
    fill('#696b54', x + 1, rail + u(4), 1, wall - rail - u(4));
  }
  const base = g.createLinearGradient(0, rail, 0, wall);
  base.addColorStop(0, '#1a1c1600'); base.addColorStop(1, '#1a1c1670');
  fill(base, 0, rail, w, wall - rail);
  fill('#b1a07e', 0, rail - u(1), w, u(3));
  fill('#d8c9a0', 0, rail - u(1), w, 1);
  fill('#3d4035', 0, rail + u(2), w, u(3));

  // ── 책상 윗면: 길게 이어 붙인 널빤지 ──
  const desk = g.createLinearGradient(0, wall, 0, front);
  ['#6e523d', '#896a4e', '#9c7a5a'].forEach((c, i, a) => desk.addColorStop(i / (a.length - 1), c));
  fill(desk, 0, wall, w, front - wall);
  for (const f of [0.34, 0.68]) {
    const y = Math.round(wall + (front - wall) * f);
    fill('#5d4636', 0, y, w, 1);
    fill('#b28e6a44', 0, y + 1, w, 1);
  }
  for (let i = 0; i < w * (front - wall) / 70; i++) {
    const y = wall + u(3) + rand() * (front - wall - u(4));
    fill(i % 3 ? '#b38e6a40' : '#5a463a48', rand() * w, y, (4 + rand() * 40) * s, 1);
  }
  fill('#2a201a99', 0, wall, w, u(3));

  // ── 블라인드 틈으로 든 햇빛: 벽 · 사진 · 책상 위로 비스듬히 눕는다 ──
  const { reach, slope } = R, run = reach - shutter;
  const ray = g.createLinearGradient(shutter, 0, reach, 0);
  ray.addColorStop(0, '#ffe2a240'); ray.addColorStop(0.55, '#ffe2a224'); ray.addColorStop(1, '#ffe2a200');
  const haze = g.createLinearGradient(shutter, 0, reach, 0);
  haze.addColorStop(0, '#ffdc9a18'); haze.addColorStop(1, '#ffdc9a00');
  g.save();
  g.beginPath(); g.rect(shutter, 0, w - shutter, front); g.clip();
  sweep(g, haze, [[shutter, glassTop], [reach, glassTop + run * slope], [reach, lastY + run * slope * 1.1], [shutter, lastY]]);
  for (const [a, b] of gaps) sweep(g, ray, [[shutter, a], [reach, a + run * slope], [reach, b + run * slope * 1.12], [shutter, b]]);
  g.restore();
  // 빛줄기 속에 멈춰 있는 먼지
  for (let i = 0; i < Math.round(w * h / 9000) && gaps.length; i++) {
    const [a, b] = gaps[Math.floor(rand() * gaps.length)], t = rand() ** 1.3, x = shutter + t * run;
    const y = a + (b - a) * rand() + t * run * slope;
    if (y > front) continue;
    const big = i % 5 === 0 && s >= 0.9;
    fill(t < 0.5 ? '#fff3d4c0' : '#fff3d470', x, y, big ? 2 : 1, big ? 2 : 1);
  }

  // ── 책상 앞판과 납작한 서류 서랍 ──
  fill('#c49d74', 0, front, w, 1);
  fill('#a58260', 0, front + 1, w, u(3));
  fill('#3b302a', 0, front + 1 + u(3), w, u(5));
  fill('#4c3a31', 0, front + 1 + u(8), w, h - front);
  const dw = 140 * s, dStep = 150 * s, dRow = u(48);
  const count = Math.max(1, Math.floor((w - u(10) + (dStep - dw)) / dStep));
  const dx0 = Math.round((w - (count * dStep - (dStep - dw))) / 2);
  for (let y = front + u(16), r = 0; y < h; y += dRow, r++) {
    const D = brush(g, 0, y, s);
    for (let i = 0; i < count; i++) {
      const x = (dx0 + i * dStep) / s;
      D.box('#2f2520', x - 2, -2, 144, 44);
      D.box('#6b5040', x, 0, 140, 40);
      D.box('#84634e', x, 0, 140, 2);
      D.box('#a27e60', x, 0, 140, 1);
      D.box('#54402f', x, 37, 140, 3);
      D.box('#5f4738', x + 137, 2, 3, 35);
      for (let j = 0; j < 3; j++) D.box('#5d4536', x + 8 + ((i * 37 + j * 53 + r * 19) % 110), 8 + j * 10, 14 + (j * 7) % 12, 0.6);
      // 이름표 꽂이와 놋쇠 손잡이
      D.box('#8a7350', x + 16, 9, 26, 14);
      D.box('#d8cdb0', x + 18, 11, 22, 10);
      D.box('#8f8471', x + 21, 15, 15, 1);
      D.box('#504536', x + 52, 15, 36, 10);
      D.box('#ab9263', x + 54, 13, 32, 10);
      D.box('#e0c58c', x + 54, 13, 32, 1);
      D.box('#6d5a3c', x + 57, 18, 26, 3);
    }
  }

  // ── 책상 위 ──
  const bookX = Math.round(w * 0.54 - 18 * s);
  const lampX = Math.round(Math.min(w * 0.26, bookX - 132 * s));
  const ledX = Math.round(w * 0.79);
  g.save();
  g.beginPath(); g.rect(0, wall, w, front - wall); g.clip();
  pool(g, lampX + 30 * s, deskY + 4 * s, 170 * s, 34 * s, '#ffd98a3a');
  g.restore();

  // 펼친 「별똥별 부대사」 원본: 이번엔 바싹 마른 종이
  const B = brush(g, bookX, deskY, s);
  B.poly('#24190f60', [[-68, -4], [72, -7], [96, 26], [-78, 33]]);
  B.poly('#4a3d2b', [[-76, -11], [0, -8], [68, -11], [82, 24], [0, 23], [-92, 27]]);
  B.seg('#7f6c4e', -92, 27, 0, 23, 1);
  B.seg('#7f6c4e', 0, 23, 82, 24, 1);
  const farL: Point[] = [[-70, -9], [-50, -13], [-28, -15], [-12, -14], [-4, -10], [0, -6]];
  const nearL: Point[] = [[-84, 20], [-66, 17], [-44, 14], [-20, 12], [-6, 13], [0, 16]];
  const farR: Point[] = [[0, -6], [4, -10], [12, -14], [28, -15], [48, -13], [62, -9]];
  const nearR: Point[] = [[0, 16], [4, 13], [16, 12], [34, 12], [56, 15], [74, 18]];
  const down = (pts: Point[], d: number) => pts.map(([px, py]) => [px, py + d] as Point);
  // 종이 묶음의 두께
  B.poly('#bca17a', [...nearL, ...down(nearL, 5).reverse()]);
  B.poly('#c9b089', [...nearR, ...down(nearR, 5).reverse()]);
  for (const d of [1.6, 3.2]) {
    for (let i = 0; i + 1 < nearL.length; i++) B.seg('#e0cba3', nearL[i][0], nearL[i][1] + d, nearL[i + 1][0], nearL[i + 1][1] + d, 0.4);
    for (let i = 0; i + 1 < nearR.length; i++) B.seg('#e6d3ad', nearR[i][0], nearR[i][1] + d, nearR[i + 1][0], nearR[i + 1][1] + d, 0.4);
  }
  // 왼쪽 장 · 오른쪽 장 (오른쪽이 창과 스탠드 쪽을 향해 더 밝다)
  B.poly('#d5bc90', [...farL, ...[...nearL].reverse()]);
  B.poly('#e7d1a6', [...farR, ...[...nearR].reverse()]);
  B.poly('#b99f75', [[-12, -14], [-4, -10], [0, -6], [0, 16], [-6, 13], [-14, 12]]);
  B.poly('#cdb48a', [[0, -6], [4, -10], [8, -12], [8, 12], [4, 13], [0, 16]]);
  B.seg('#f5e6c3', 12, -14, 62, -9, 0.5);
  B.seg('#ead6ae', -70, -9, -28, -15, 0.5);
  // 글줄: 장의 기울기를 따라 눕는다
  const lines = (far: Point[], near: Point[], xa: number, xb: number, v0: number, rows: number, color: string, seed: number) => {
    const r = seeded(seed);
    for (let i = 0; i < rows; i++) {
      const v = v0 + i * (0.86 - v0) / Math.max(1, rows - 1);
      for (let x = xa; x < xb;) {
        const len = 3 + r() * 9, x2 = Math.min(xb, x + len);
        const ya = along(far, x) + v * (along(near, x) - along(far, x)), yb = along(far, x2) + v * (along(near, x2) - along(far, x2));
        B.seg(color, x, ya, x2, yb, 0.5);
        x = x2 + 1.6 + r() * 1.4;
      }
    }
  };
  // 오른쪽 장: 굵은 제목 한 줄과 본문
  for (let x = 20; x < 46; x += 6) {
    const ya = along(farR, x) + 0.14 * (along(nearR, x) - along(farR, x));
    B.box('#6a5638', x, ya - 0.5, 4.4, 1.6);
  }
  lines(farR, nearR, 13, 66, 0.32, 6, '#8d7a5c', 77);
  // 왼쪽 장: 별똥별 그림과 몇 줄
  B.poly('#8b6f45', [[-44, -8], [-42.4, -4.6], [-38.6, -4.4], [-41.6, -2.2], [-40.6, 1.4], [-44, -0.6], [-47.4, 1.4], [-46.4, -2.2], [-49.4, -4.4], [-45.6, -4.6]]);
  B.seg('#a08a64', -38, -6, -24, -12, 0.5);
  B.seg('#a08a64', -38, -4.6, -22, -10, 0.5);
  lines(farL, nearL, -76, -10, 0.56, 4, '#9a8565', 78);
  // 책갈피 끈
  B.seg('#8e3f38', 1, 2, 2, 20, 1.6);
  B.poly('#a14a40', [[0.6, 19], [3.6, 19], [5, 31], [2.6, 28.4], [0.2, 31.4]]);
  B.seg('#c4685a', 1, 2, 1.4, 18, 0.5);

  // 열쇠: 꼬리표를 단 채 책 옆에 놓였다
  const K = brush(g, Math.round(bookX + 104 * s), deskY + Math.round(14 * s), s);
  K.oval('#24190f55', 4, 3, 22, 3);
  K.poly('#d8c9a2', [[-20, -5], [-8, -7], [-6, 1], [-18, 3]]);
  K.poly('#b8a77f', [[-18, 3], [-6, 1], [-6.4, -0.6], [-18.4, 1.4]]);
  K.oval('#7a6a4c', -10, -3, 1.2, 1.2);
  K.seg('#9a4a3c', -10, -3, -2, -1, 0.5);
  K.oval('#7a5c36', 2, -1, 4.6, 4);
  K.oval('#c9a061', 2, -1.6, 4.4, 3.6);
  K.oval('#4a3a26', 2, -1.6, 1.8, 1.4);
  K.box('#c9a061', 6, -2.6, 16, 2.2);
  K.box('#f0d496', 6, -2.6, 16, 0.6);
  K.box('#c9a061', 17, -0.6, 2, 2.4); K.box('#c9a061', 20, -0.6, 2, 3.2);
  K.box('#7a5c36', 6, -0.4, 16, 0.5);

  // 장부 더미: 천으로 싼 등과 가죽 모서리
  const L = brush(g, ledX, deskY, s);
  L.box('#24190f50', 6, 4, 84, 6);
  const ledgers: [number, number, number, string, string][] = [[0, 78, 11, '#69725f', '#879076'], [4, 72, 10, '#a8916c', '#c6ae86'], [-2, 80, 12, '#6e4a42', '#8f665a'], [6, 70, 9, '#4f5867', '#6b7586']];
  let ly = 8;
  for (const [ox, lw, lh, c, lit] of ledgers) {
    ly -= lh;
    L.box('#2b211b', ox - 1, ly, lw + 2, lh);
    L.box(c, ox, ly, lw, lh - 1);
    L.box(lit, ox, ly, lw, 1);
    L.box('#5a3f2e', ox, ly, 9, lh - 1);
    L.box('#7b5a42', ox, ly, 9, 1);
    for (const bx of [22, 30]) L.box('#00000026', ox + bx, ly + 1, 1, lh - 2);
    L.box('#c8ad72', ox + lw * 0.52, ly + lh * 0.3, 14, lh * 0.38);
    L.box('#8f7a52', ox + lw * 0.52 + 2, ly + lh * 0.45, 10, 0.6);
  }
  L.poly('#5a6474', [[6, ly], [76, ly], [70, ly - 5], [12, ly - 5]]);
  L.box('#7d889a', 12, ly - 5, 58, 1);

  // 화면이 넓으면: 장부 옆에 문서 상자
  if (w - (ledX + 96 * s) > 90 * s) {
    const C = brush(g, Math.round(ledX + 96 * s + Math.min(60 * s, (w - ledX - 186 * s) / 2)), deskY, s);
    C.box('#24190f50', 6, 4, 70, 6);
    C.box('#8d7656', 0, -46, 66, 52);
    C.box('#a68c66', 0, -46, 66, 2);
    C.box('#6e5a40', 60, -44, 6, 50);
    C.box('#c9b68e', 0, -52, 66, 7);
    C.box('#e0d0a8', 0, -52, 66, 1);
    C.box('#8f7a58', 0, -46, 66, 1);
    C.box('#6a5434', 14, -36, 30, 14);
    C.box('#ddd1b2', 16, -34, 26, 10);
    C.box('#8a7e66', 19, -30, 18, 1);
    C.oval('#4a3a2a', 30, -12, 7, 3);
  }
  // 스탠드와 책 사이가 넓으면: 잉크병과 펜
  const gap = bookX - 94 * s - (lampX + 36 * s);
  if (gap > 44 * s) {
    const I = brush(g, Math.round(lampX + 36 * s + gap / 2), deskY + Math.round(4 * s), s);
    I.oval('#24190f55', 6, 1, 14, 2.6);
    I.box('#2a332f', -7, -12, 14, 12);
    I.box('#455049', -7, -12, 3, 12);
    I.box('#1b211e', 4, -12, 3, 12);
    I.box('#3a2c22', -4, -16, 8, 4);
    I.box('#5c4636', -4, -16, 8, 1);
    I.seg('#2b211b', 10, -1, 30, -5, 1);
    I.seg('#b5975f', 28, -4.6, 33, -5.6, 0.8);
  }

  // ── 초록 갓을 쓴 스탠드: 불빛이 책상으로 쏟아진다 ──
  const T = brush(g, lampX, deskY, s);
  T.glow('#ffdf9c30', 0, -40, 120);
  T.oval('#24190f66', 18, 2, 26, 3.5);
  T.oval('#22271f', 0, 0, 19, 3.5);
  T.box('#30382c', -18, -6, 36, 6);
  T.oval('#434c3b', 0, -6, 18, 3);
  T.box('#6b745c', -15, -8, 11, 1);
  T.box('#a4834f', -5, -11, 10, 5);
  T.box('#e6c88e', -5, -11, 3, 1);
  T.box('#8f6f43', -1.5, -58, 3, 48);
  T.box('#e3c68c', -1.5, -58, 1, 48);
  T.box('#5e4a2c', 1, -58, 0.6, 48);
  T.oval('#21372d', 0, -56, 33, 16, (_dx, dy) => dy < 0);
  T.oval('#335244', 0, -56, 31, 14.6, (_dx, dy) => dy < 0);
  T.oval('#4c735e', -7, -58, 20, 10, (dx, dy) => dy < 0 && dx < 0.4);
  T.seg('#a8d6b6', -22, -62, -10, -68, 0.8);
  T.box('#b8925c', -33, -57, 66, 2);
  T.box('#e8cc8e', -33, -57, 30, 0.6);
  T.box('#ffe9b4', -30, -55, 60, 2);
  T.oval('#fff8dc', 0, -53, 7, 2);
  T.seg('#c9a86a', 16, -55, 16, -42, 0.5);
  T.oval('#e0c48a', 16, -41, 1.4, 1.4);

  vignette(g, w, h, '#120d08', 0.45);
}
