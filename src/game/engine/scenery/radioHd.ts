import { type Ink, pixelText, seeded } from './pixels';
import { type Brush, brush } from './hd';

/**
 * 수신기가 놓이는 자리. 작업대 선은 화면 높이의 66%, 수신기는 화면 가운데이고
 * 설계 좌표의 (0, 0)이 수신기 밑면 한가운데다. 작은 화면(브라운관)은 (-18, -58)에서 60×34칸.
 */
function layout(w: number, h: number) {
  const s = Math.min(1.38, w / 490, h / 400);
  const bench = Math.round(h * 0.66), cx = Math.round(w / 2);
  const oy = bench - Math.round(10 * s);
  const X = (x: number) => Math.round(cx + x * s), Y = (y: number) => Math.round(oy + y * s);
  return { s, bench, cx, oy, screen: { x0: X(-18), y0: Y(-58), x1: X(42), y1: Y(-24) } };
}

/** 심전도처럼 뛰는 신호 한 주기 (아래가 +) */
const BEAT = [0, 0, -1, 0, 1, -5, 3, -1, 0, 0, 0, -1, 0];

/**
 * 수신기의 작은 화면만 다시 칠한다: 눈금 위로 초록 신호가 왼쪽으로 흘러간다.
 * phase는 125ms마다 1씩 늘어나는 정수. radioHd도 이 함수로 (phase 0) 화면을 그리므로 자리가 똑같다.
 */
export function radioSignalHd(g: Ink, w: number, h: number, phase: number) {
  const { s, screen: { x0, y0, x1, y1 } } = layout(w, h);
  const sw = x1 - x0, sh = y1 - y0;
  const px = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(x, y, bw, bh); };
  px('#1b332d', x0, y0, sw, sh);
  // 형광면 가운데가 은은하게 밝다
  const cx = x0 + sw / 2, cy = y0 + sh / 2;
  const bloom = g.createRadialGradient(cx, cy, 0, cx, cy, sw * 0.55);
  bloom.addColorStop(0, '#2b5446'); bloom.addColorStop(1, '#2b544600');
  g.fillStyle = bloom; g.fillRect(x0, y0, sw, sh);
  // 눈금: 가운데 기준선에서 같은 간격
  const step = Math.max(4, Math.round(10 * s));
  const mid = y0 + Math.round(sh * 0.56);
  for (let x = x0 + (step >> 1); x < x1 - 1; x += step) px('#2c4a3d', x, y0 + 1, 1, sh - 2);
  for (let y = mid - Math.floor((mid - y0 - 1) / step) * step; y < y1 - 1; y += step) px('#2c4a3d', x0 + 1, y, sw - 2, 1);
  px('#36594a', x0 + 1, mid, sw - 2, 1);
  // 신호: 번진 빛 → 밝은 심
  const n = BEAT.length, lead = 2 * s, amp = sh / 17;
  const start = ((phase % n) + n) % n;
  const core = Math.max(1, Math.round(1.1 * s));
  const at = (i: number) => {
    const p = start + i / lead, k = Math.floor(p), f = p - k;
    return mid + Math.round((BEAT[k % n] * (1 - f) + BEAT[(k + 1) % n] * f) * amp);
  };
  for (const [color, grow] of [['#3f7a54', 1], ['#b4e09c', 0]] as const) {
    let prev = at(2);
    for (let i = 2; i < sw - 2; i++) {
      const y = at(i), top = Math.max(y0 + 1, Math.min(y, prev) - grow), bottom = Math.min(y1 - 1, Math.max(y, prev) + core + grow);
      if (bottom > top) px(color, x0 + i, top, 1, bottom - top);
      prev = y;
    }
  }
  // 유리 안쪽 그늘과 비친 빛
  px('#10221e', x0, y0, sw, 1);
  px('#10221e', x0, y0, 1, sh);
  px('#ffffff14', x0 + 2, y0 + 2, Math.max(2, Math.round(sw * 0.18)), 1);
  px('#ffffff14', x0 + 2, y0 + 3, 1, Math.max(2, Math.round(sh * 0.2)));
}

/** 손잡이 (다이얼): 왼쪽 위에서 빛을 받는다 */
function knob(R: Brush, x: number, y: number, r: number) {
  R.oval('#141a1c', x + 1.5, y + 2.5, r + 1.5, r + 1.5);
  R.oval('#8f876f', x, y, r, r);
  R.oval('#c9bf9f', x, y, r, r, (dx, dy) => dx + dy < -0.55);
  R.oval('#5d5947', x, y, r, r, (dx, dy) => dx + dy > 0.95);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    R.box('#4b4a3c', x + Math.cos(a) * (r - 1) - 0.5, y + Math.sin(a) * (r - 1) - 0.5, 1, 1);
  }
  R.oval('#3c4540', x, y, r - 3, r - 3);
  R.oval('#5d6860', x, y, r - 4, r - 4);
  R.oval('#7c887d', x, y, r - 4, r - 4, (dx, dy) => dx + dy < -0.5);
  R.seg('#efe1bc', x + 1, y - 1, x + r * 0.5, y - r * 0.5, Math.max(1, r / 8));
}

/** 벽에 붙은 배선도 (x, y = 왼쪽 위 캔버스 픽셀) */
function diagram(g: Ink, x: number, y: number, bw: number, bh: number, u: (v: number) => number) {
  const px = (c: string, a: number, b: number, cw: number, ch: number) => { g.fillStyle = c; g.fillRect(Math.round(a), Math.round(b), Math.round(cw), Math.round(ch)); };
  px('#10181890', x + u(4), y + u(4), bw, bh);
  px('#8f9a8c', x, y, bw, bh);
  px('#a5af9f', x, y, bw, 1);
  px('#74806f', x, y + bh - u(2), bw, u(2));
  px('#2f4a4f', x + u(6), y + u(6), bw - u(12), u(7));
  const rows = Math.max(2, Math.floor((bh - u(24)) / u(16)));
  for (let i = 0; i < rows; i++) {
    const ly = y + u(24) + i * (bh - u(30)) / rows, a = bw * (0.3 + (i % 2) * 0.12);
    px('#3f5251', x + u(8), ly, a, 1);
    px('#3f5251', x + u(8) + a, ly - u(4), u(9), u(8));
    px('#8f9a8c', x + u(10) + a, ly - u(2), u(5), u(4));
    px('#3f5251', x + u(17) + a, ly, bw - a - u(26), 1);
    if (i < rows - 1) px('#3f5251', x + bw - u(14) - (i % 2) * u(18), ly, 1, (bh - u(30)) / rows);
  }
  px('#b3443a', x + bw / 2 - u(2), y - u(2), u(5), u(5));
  px('#d9695c', x + bw / 2 - u(2), y - u(2), u(2), u(2));
}

/**
 * 정비실 작업대 위의 먼지 쌓인 라디오 수신기 (고해상도). 왼쪽의 스탠드가 수신기와 작업대를 비춘다.
 * 왼쪽 벽에는 공구판, 오른쪽에는 부품 서랍장. 세로로 긴 화면에서는 위쪽 빈 벽에 선반과 배선도가 걸린다.
 * 수신기의 작은 화면은 맨 마지막에 radioSignalHd로 그린다 (그 위에는 아무것도 덧칠하지 않는다).
 */
export function radioHd(g: Ink, w: number, h: number) {
  const rand = seeded(8181);
  const { s, bench, cx, oy } = layout(w, h);
  const t = Math.min(h / 480, w / 420); // 벽과 작업대의 굵기
  const u = (v: number) => Math.max(1, Math.round(v * t));
  const tall = h > w * 1.2;
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };
  const P = brush(g, 0, 0, 1); // 캔버스 픽셀 그대로
  const R = brush(g, cx, oy, s); // 수신기
  const B = brush(g, cx, bench, s); // 작업대 위 물건
  const L = brush(g, Math.round(cx - 162 * s), bench, s); // 스탠드
  const benchTop = bench - u(14);

  // ── 벽: 거친 시멘트 벽돌 ──
  const wall = g.createLinearGradient(0, 0, 0, bench);
  wall.addColorStop(0, '#19252a'); wall.addColorStop(0.55, '#36433f'); wall.addColorStop(1, '#565b4b');
  g.fillStyle = wall; g.fillRect(0, 0, w, bench);
  for (let y = benchTop - u(30), row = 0; y > 0; y -= u(30), row++) {
    fill('#0d151722', 0, y, w, 1);
    fill('#ffffff07', 0, y + 1, w, 1);
    for (let x = (row % 2 ? u(42) : 0) + u(10); x < w; x += u(84)) fill('#0d15171c', x, y, 1, u(30));
  }
  for (let i = 0; i < w * 1.4; i++) fill(i % 3 ? '#00000012' : '#ffffff09', rand() * w, rand() * bench, 1 + rand() * 4, 1);

  const pipeY = Math.round(h * 0.05);

  // ── 공구판: 구멍 뚫린 판에 스패너가 크기 순으로 걸려 있다 ──
  const boardW = Math.round(w * 0.31), boardTop = bench - u(206), boardBottom = bench - u(26);
  fill('#141e1f', 0, boardTop, boardW, boardBottom - boardTop);
  fill('#3b4945', 0, boardTop + u(4), boardW - u(4), boardBottom - boardTop - u(8));
  fill('#52605a', 0, boardTop + u(4), boardW - u(4), 1);
  fill('#2c3936', 0, boardBottom - u(6), boardW - u(4), u(2));
  const hole = Math.max(1, Math.round(1.6 * t));
  for (let y = boardTop + u(12); y < boardBottom - u(10); y += u(9)) {
    for (let x = u(5); x < boardW - u(8); x += u(10)) {
      fill('#25322e', x, y, hole, hole);
      fill('#4a5852', x, y + hole, hole, 1);
    }
  }
  // 스패너는 스탠드 갓에 머리가 가리지 않는 만큼만 (좁은 화면에서도 두 개는)
  const wrenchX = (i: number) => Math.round(w * 0.055) + i * u(18);
  let wrenches = 2;
  while (wrenches < 4 && wrenchX(wrenches) + u(8) < L.X(-30)) wrenches++;
  for (let i = 0; i < wrenches; i++) {
    const W = brush(g, wrenchX(i), boardTop + u(34 + (i % 2) * 8), t);
    const len = 46 - i * 5;
    for (const [dx, dy, body, lit] of [[3, 3, '#1c2927', '#1c2927'], [0, 0, '#7f8c83', '#b9c2b3']] as const) {
      W.seg(body, dx, dy + 4, dx - 8, dy + 4 + len, 3.4);
      W.seg(body, dx - 1, dy + 5, dx - 5, dy - 5, 3);
      W.seg(body, dx + 1, dy + 5, dx + 6, dy - 4, 3);
      W.oval(body, dx - 8.5, dy + 8 + len, 4.6, 4.6);
      W.seg(lit, dx - 1, dy + 6, dx - 8.6, dy + 2 + len, 1);
      W.seg(lit, dx - 2, dy + 4, dx - 6, dy - 5, 1);
    }
    W.oval('#3b4945', -8.5, 8 + len, 2, 2);
    W.box('#c9c3a8', -1, 0, 2.4, 2.4);
  }
  // 쪽지는 스탠드 팔꿈치보다 왼쪽에만 꽂는다: 자리가 없으면 (좁은 화면) 스탠드 뒤에 가려지므로 그리지 않는다
  const noteX = Math.round(Math.min(w * 0.19, L.X(-60) - u(38))), noteY = boardTop + u(30);
  const wrenchEnd = wrenchX(wrenches - 1) + u(9);
  // 공구판이 넓으면 드라이버와 펜치도 걸린다
  if (noteX - (w * 0.055 + u(80)) > u(60)) {
    const W = brush(g, Math.round((w * 0.055 + u(80) + noteX) / 2), boardTop + u(34), t);
    W.box('#1c2927', -15, 3, 7, 26); W.box('#1c2927', -13, 29, 3, 30);
    W.box('#a7783f', -18, 0, 7, 26); W.box('#cf9d5c', -18, 0, 2, 26); W.box('#7c5730', -13, 0, 2, 26);
    W.box('#8f9a91', -16, 26, 3, 30); W.box('#c3ccc0', -16, 26, 1, 30);
    W.seg('#1c2927', 15, 4, 11, 40, 3); W.seg('#1c2927', 15, 4, 21, 40, 3);
    W.seg('#8f9a91', 12, -8, 12, 6, 3); W.seg('#8f9a91', 16, -8, 12, 6, 2);
    W.seg('#7a3f36', 12, 6, 7, 40, 3.4); W.seg('#7a3f36', 13, 6, 18, 40, 3.4);
    W.seg('#a85b4e', 11, 8, 6, 38, 1);
  }
  // 핀으로 꽂아 둔 쪽지
  if (noteX >= wrenchEnd + u(6)) {
    P.poly('#141e1f90', [[noteX + u(3), noteY + u(4)], [noteX + u(39), noteY + u(8)], [noteX + u(37), noteY + u(46)], [noteX + u(1), noteY + u(42)]]);
    P.poly('#9d9c86', [[noteX, noteY], [noteX + u(36), noteY + u(4)], [noteX + u(34), noteY + u(42)], [noteX - u(2), noteY + u(38)]]);
    P.poly('#b3b29b', [[noteX, noteY], [noteX + u(36), noteY + u(4)], [noteX + u(36), noteY + u(6)], [noteX, noteY + u(2)]]);
    fill('#c2ab82', noteX + u(12), noteY - u(3), u(12), u(6));
    fill('#dcc79d', noteX + u(12), noteY - u(3), u(12), 1);
    for (let i = 0; i < 5; i++) P.seg('#5f6b62', noteX + u(5), noteY + u(12 + i * 6), noteX + u(27 - (i % 3) * 5), noteY + u(14 + i * 6), Math.max(1, u(1.4)));
  }

  // ── 부품 서랍장 ──
  const rack = Math.round(w * 0.79), rackTop = bench - u(154), rackBottom = bench - u(14);
  fill('#0f181a80', rack - u(6), rackTop + u(8), u(6), rackBottom - rackTop - u(8));
  fill('#1c2729', rack, rackTop, w - rack, rackBottom - rackTop);
  fill('#3d4a4a', rack, rackTop, w - rack, u(3));
  fill('#56635f', rack, rackTop, w - rack, 1);
  fill('#2c393a', rack, rackTop, u(2), rackBottom - rackTop);
  for (let y = rackTop + u(9); y + u(22) <= rackBottom - u(2); y += u(26)) {
    for (let x = rack + u(7); x < w; x += u(44)) {
      fill('#4b564f', x, y, u(40), u(22));
      fill('#74837a', x, y, u(40), 1);
      fill('#5c6860', x, y + 1, 1, u(22) - 1);
      fill('#353f3a', x, y + u(22) - Math.max(1, u(2)), u(40), Math.max(1, u(2)));
      fill('#343e3a', x + u(40) - 1, y, 1, u(22));
      fill('#70705e', x + u(5), y + u(4), u(18), u(8));
      fill('#b3aa8e', x + u(6), y + u(5), u(16), u(6));
      fill('#6b6a58', x + u(8), y + u(7), u(6 + Math.floor(rand() * 7)), 1);
      fill('#232c29', x + u(12), y + u(15), u(16), u(3));
      fill('#8e9889', x + u(12), y + u(15), u(16), 1);
    }
  }
  // 서랍장 위의 상자와 전선 타래
  {
    const C = brush(g, rack + u(12), rackTop, t);
    C.box('#4f4234', 0, -30, 58, 30);
    C.box('#7a6650', 0, -30, 58, 3);
    C.box('#3b3128', 52, -27, 6, 27);
    C.box('#c4b893', 16, -20, 22, 10);
    C.box('#8a8068', 19, -16, 14, 1);
    C.box('#a08d68', 26, -30, 7, 6);
    for (const [r, c] of [[13, '#1a1f1e'], [10, '#3b2f2a'], [7, '#1a1f1e']] as const) C.oval(c, 84, -9, r, r * 0.7, (dx, dy) => dx * dx + dy * dy > 0.5);
    C.oval('#5b4840', 84, -9, 10, 7, (dx, dy) => dx * dx + dy * dy > 0.5 && dx + dy < -0.6);
  }

  // ── 세로로 긴 화면: 공구판 위 빈 벽에 천장 배관 · 선반(유류통 · 상자 · 전선 뭉치) · 배선도 ──
  if (tall) {
    // 천장 배관과 늘어진 전선
    fill('#121a1c', 0, pipeY, w, u(10));
    fill('#4c5852', 0, pipeY + u(1), w, u(2));
    fill('#0a1012', 0, pipeY + u(9), w, 1);
    for (let x = u(24); x < w; x += u(92)) {
      fill('#232d2e', x, pipeY - u(6), u(7), u(18));
      fill('#46524d', x, pipeY - u(6), 1, u(18));
    }
    for (let x = 0; x < w * 0.45; x++) fill('#141c1c', x, pipeY + u(12) + Math.round(Math.sin(x / w * 7) * u(6) + x * 0.04), 1, u(2));
    const shelfY = Math.round(boardTop - Math.max(u(68), (boardTop - pipeY) * 0.38));
    const S = brush(g, 0, shelfY, t);
    const span = w / t;
    S.box('#12191a70', 0, 6, span, 5);
    S.box('#5d655a', 0, 0, span, 6);
    S.box('#8a8f7c', 0, 0, span, 1);
    S.box('#3d443c', 0, 5, span, 1);
    for (const k of [0.12, 0.88]) {
      S.poly('#28322f', [[span * k, 6], [span * k + 4, 6], [span * k + 4, 22]]);
      S.seg('#3b4743', span * k + 3, 20, span * k + 17, 7, 2);
    }
    for (const x of [span * 0.06, span * 0.06 + 35]) {
      S.box('#2a3729', x, -38, 30, 38);
      S.box('#4b5c44', x + 2, -36, 26, 34);
      S.box('#61735a', x + 2, -36, 2, 34);
      S.box('#3a4936', x + 24, -36, 4, 34);
      S.seg('#34432f', x + 5, -32, x + 25, -6, 2);
      S.seg('#34432f', x + 25, -32, x + 5, -6, 2);
      S.box('#2a3729', x + 6, -46, 16, 8);
      S.box('#6c7a5c', x + 8, -44, 12, 2);
      S.box('#1d261c', x + 22, -44, 5, 5);
    }
    const boxX = span * 0.46;
    S.box('#4f4234', boxX, -30, 60, 30);
    S.box('#7a6650', boxX, -30, 60, 3);
    S.box('#3b3128', boxX + 54, -27, 6, 27);
    S.box('#a08d68', boxX + 27, -30, 7, 8);
    S.box('#c4b893', boxX + 14, -18, 24, 10);
    S.box('#8a8068', boxX + 17, -14, 16, 1); S.box('#8a8068', boxX + 17, -11, 10, 1);
    for (const [r, c] of [[16, '#1a1f1e'], [13, '#3b2f2a'], [10, '#1a1f1e'], [7, '#3b2f2a']] as const) S.oval(c, span * 0.78, -10, r, r * 0.62, (dx, dy) => dx * dx + dy * dy > 0.55);
    S.oval('#5b4840', span * 0.78, -10, 13, 8, (dx, dy) => dx * dx + dy * dy > 0.55 && dx + dy < -0.6);
    const sy = shelfY + u(32), sh = Math.round(Math.min(u(92), (boardTop - sy) * 0.8));
    if (sh > u(36)) diagram(g, Math.round(w * 0.56), sy, Math.round(w * 0.3), sh, u);
  }

  // ── 작업대: 오래 쓴 나무 널 ──
  fill('#4b4039', 0, benchTop, w, h - benchTop);
  for (let y = benchTop, row = 0; y < h; row++) {
    const depth = u(row ? 24 + row * 5 : 14);
    fill(row % 2 ? '#463b35' : '#4d4139', 0, y, w, depth);
    for (let i = 0; i < w / 5; i++) {
      fill(i % 3 ? '#66534838' : '#2b272560', rand() * w, y + 2 + Math.floor(rand() * Math.max(1, depth - 3)), (6 + rand() * 34) * t, 1);
    }
    fill('#6a5647', 0, y, w, 1);
    fill('#262422', 0, y + depth - Math.max(1, u(2)), w, Math.max(1, u(2)));
    const plank = u(230 + row * 40);
    for (let x = (row * 97) % plank; x < w; x += plank) {
      fill('#262422', x, y + 1, 1, depth - 2);
      fill('#6b574850', x + 1, y + 1, 1, depth - 2);
      for (const dx of [-u(7), u(6)]) { fill('#1f1d1c', x + dx, y + (depth >> 1), u(2), u(2)); fill('#8a7460', x + dx, y + (depth >> 1), 1, 1); }
    }
    y += depth;
  }
  fill('#8a705a', 0, benchTop, w, 1);
  fill('#0e151680', 0, benchTop - u(3), w, u(3));

  // ── 넓은 화면: 수신기와 서랍장 사이에 배선도와 공구함 ──
  const gapL = cx + 150 * s;
  if (rack - gapL > u(170)) {
    const mid = Math.round((gapL + rack) / 2);
    diagram(g, mid - u(56), bench - u(196), u(112), u(78), u);
    const T = brush(g, mid, bench - u(4), t);
    T.oval('#14121180', 6, 3, 62, 6);
    T.box('#55302b', -52, -34, 104, 34);
    T.box('#6d3b33', -52, -34, 104, 22);
    T.box('#8a4d42', -52, -34, 104, 2);
    T.box('#3d2320', 46, -32, 6, 32);
    T.box('#2a1917', -52, -13, 104, 2);
    T.poly('#6d3b33', [[-52, -34], [-44, -48], [44, -48], [52, -34]]);
    T.poly('#8a4d42', [[-44, -48], [44, -48], [45, -46], [-45, -46]]);
    for (const x of [-34, 26]) { T.box('#9ea392', x, -18, 8, 10); T.box('#c9ccb9', x, -18, 8, 1); T.box('#5d6257', x + 2, -12, 4, 2); }
    T.box('#1d2423', -20, -58, 4, 10); T.box('#1d2423', 16, -58, 4, 10);
    T.box('#2b3433', -20, -60, 40, 5); T.box('#5d6a66', -20, -60, 40, 1);
  }

  // ── 스탠드 ──
  L.oval('#14121180', -58, -8, 24, 5);
  L.box('#1c2828', -80, -20, 32, 8);
  L.box('#3f4f4c', -80, -20, 32, 2);
  L.seg('#1c2828', -64, -20, -52, -108, 5);
  L.seg('#869185', -65, -20, -53, -108, 1.4);
  L.seg('#1c2828', -52, -108, -8, -156, 5);
  L.seg('#98a093', -53, -110, -9, -157, 1.4);
  L.oval('#55625c', -52, -108, 5, 5);
  L.oval('#a9b0a0', -53, -109, 2, 2);
  L.poly('#22312f', [[-22, -146], [-8, -164], [8, -158], [20, -138], [24, -128], [-28, -134]]);
  L.poly('#3b4d49', [[-22, -146], [-8, -164], [-3, -162], [-17, -144]]);
  L.seg('#efd295', -25, -133, 21, -128, 3);
  L.seg('#fff0c4', -16, -132, 12, -129, 1.4);
  L.poly('#f7c78a14', [[-24, -130], [22, -126], [104, 8], [-62, 12]]);
  L.poly('#f7c78a0e', [[-12, -130], [14, -127], [70, 8], [-30, 12]]);
  L.glow('#f7c78a5a', 0, -122, 112);

  // ── 수신기: 주물 케이스, 스피커 망, 주파수 눈금, 작은 화면, 다이얼 ──
  R.poly('#16141399', [[-136, 2], [128, 0], [160, 8], [168, 16], [-128, 16]]);
  R.box('#1d2524', -112, -2, 20, 12); R.box('#1d2524', 92, -2, 20, 12);
  R.box('#37413f', -112, -2, 20, 2); R.box('#37413f', 92, -2, 20, 2);
  R.poly('#232e2d', [[-134, -108], [-124, -123], [118, -123], [132, -110], [132, -8], [124, 0], [-128, 0], [-134, -6]]);
  // 윗면 (먼지가 앉았다)
  R.poly('#7d8272', [[-130, -108], [-120, -121], [114, -121], [128, -108]]);
  R.poly('#989c88', [[-124, -116], [-120, -121], [114, -121], [119, -116]]);
  for (let i = 0; i < 70; i++) {
    const y = -120 + rand() * 11, half = 118 + (y + 121) * 0.8;
    R.box(i % 3 ? '#c6b99b80' : '#d9d0b8a0', -half + rand() * half * 2, y, 1 + rand() * 2.5, 1);
  }
  // 앞면
  R.box('#414b45', -127, -107, 252, 102);
  R.box('#8d9380', -127, -107, 252, 2);
  R.box('#59645b', -127, -105, 2, 100);
  R.box('#2c3633', 123, -105, 2, 100);
  R.box('#2c3633', -127, -7, 252, 2);
  R.box('#5e685b', -120, -99, 238, 88);
  R.box('#6f7969', -120, -99, 238, 1);
  R.box('#4d574d', -120, -12, 238, 1);
  for (let i = 0; i < 40; i++) R.box(i % 2 ? '#7a836f50' : '#4a544a50', -118 + rand() * 232, -97 + rand() * 84, 2 + rand() * 6, 1);
  // 손잡이
  for (const x of [-56, 48]) { R.box('#1f2a2a', x, -139, 8, 18); R.box('#3e4b49', x, -139, 2, 18); }
  R.box('#262f2f', -58, -143, 116, 9);
  R.box('#8a9180', -56, -143, 112, 1);
  R.box('#121a1a', -58, -135, 116, 1);
  for (let x = -40; x < 40; x += 6) { R.box('#3f4a44', x, -141, 2, 5); R.box('#161d1d', x + 2, -141, 1, 5); }
  // 안테나: 세 마디
  R.seg('#1f2929', 73, -122, 128, -193, 3.4);
  R.seg('#8f9888', 72, -123, 92, -149, 2.4);
  R.seg('#a9b19f', 92, -149, 110, -172, 1.8);
  R.seg('#c3cab6', 110, -172, 126, -193, 1.2);
  R.oval('#d6dcc8', 127, -194, 2.4, 2.4);
  R.box('#2a3434', 66, -126, 14, 5); R.box('#59655f', 66, -126, 14, 1);
  // 거미줄
  R.seg('#c9cfbf30', 78, -128, 100, -160, 0.6);
  R.seg('#c9cfbf30', 58, -134, 100, -160, 0.6);
  R.seg('#c9cfbf26', 64, -131, 88, -142, 0.6);
  R.seg('#c9cfbf26', 70, -129, 94, -151, 0.6);
  // 스피커
  R.box('#1e2a27', -116, -93, 88, 76);
  R.box('#151f1d', -116, -93, 88, 2);
  R.box('#151f1d', -116, -93, 2, 76);
  R.box('#7b8573', -114, -19, 86, 2);
  R.box('#6b7566', -30, -91, 2, 74);
  R.box('#3d4a42', -112, -89, 80, 68);
  for (let row = 0, y = -86; y < -36; y += 5, row++) {
    for (let x = -109 + (row % 2) * 2.5; x < -36; x += 5) {
      R.box('#1b2723', x, y, 2.4, 2.4);
      R.box('#55645a', x, y + 2.4, 2.4, 1);
    }
  }
  R.box('#8f8263', -108, -33, 34, 9);
  R.box('#c9b381', -108, -33, 34, 7);
  R.box('#e0c992', -108, -33, 34, 1);
  for (let i = 0; i < 7; i++) R.box('#6b654e', -104 + i * 4, -30, 2, 3);
  for (let i = 0; i < 3; i++) { R.box('#27322e', -66 + i * 10, -32, 6, 8); R.box('#7c8778', -66 + i * 10, -32 + (i === 1 ? 4 : 0), 6, 4); }
  // 주파수 눈금: 안쪽 등이 켜져 있다
  R.box('#262f2a', -24, -95, 136, 30);
  R.box('#161d1b', -24, -95, 136, 2);
  R.box('#7b8573', -24, -67, 136, 2);
  R.box('#9c7f50', -20, -91, 128, 22);
  R.box('#e6c07a', -18, -89, 124, 18);
  R.box('#f3d596', -18, -85, 124, 8);
  R.box('#c9a05c', -18, -73, 124, 2);
  for (let i = 0; i <= 40; i++) R.box('#5b563f', -8 + i * 2.6, -88, 1, i % 5 === 0 ? 6 : 3);
  g.font = '12px Galmuri11, sans-serif';
  if (26 * s - g.measureText('108').width >= 7) { // 세 자리 숫자 사이가 붙지 않을 만큼 넓을 때만 글씨로
    ['76', '84', '92', '100', '108'].forEach((label, i) => pixelText(g, label, R.X(-7.6 + i * 26), R.Y(-73) - 5, '#5b4c2c', 'Galmuri11', 12));
  } else {
    for (let i = 0; i < 5; i++) R.box('#7a6a44', -12 + i * 26, -78, 8, 2);
  }
  R.box('#a8402f', 37, -90, 1.6, 20);
  R.glow('#f7d08a40', 44, -80, 70);
  R.poly('#ffffff12', [[-18, -89], [6, -89], [-8, -71], [-18, -71]]);
  // 작은 화면의 테
  R.box('#262f2a', -24, -63, 72, 46);
  R.box('#161d1b', -24, -63, 72, 2);
  R.box('#7b8573', -24, -19, 72, 2);
  R.box('#6c7f6d', -21, -61, 66, 40);
  R.box('#8d9f8a', -21, -61, 66, 1);
  R.box('#10221e', -19, -59, 62, 36);
  R.glow('#8fd09a22', 12, -41, 46);
  // 다이얼과 표시등 · 스위치
  for (let i = 0; i < 11; i++) {
    const a = (-225 + i * 27) * Math.PI / 180;
    R.box('#b9b199', 78 + Math.cos(a) * 20.5 - 0.6, -42 + Math.sin(a) * 20.5 - 0.6, i % 5 === 0 ? 2 : 1.3, i % 5 === 0 ? 2 : 1.3);
  }
  knob(R, 78, -42, 16);
  knob(R, 108, -28, 7.5);
  R.box('#3a2a1c', 103, -58, 8, 8);
  R.box('#eaad6d', 104, -57, 6, 6);
  R.box('#ffe2ad', 105, -56, 2, 2);
  R.glow('#eaad6d50', 107, -54, 16);
  // 귀퉁이 보강쇠와 나사
  for (const x of [-129, 117]) for (const y of [-109, -15]) {
    R.box('#2c3531', x, y, 12, 12);
    R.box(y < -50 ? '#9b9d8a' : '#4a554e', x, y, 12, 1);
    R.box('#a2a490', x + 4, y + 4, 4, 4);
    R.box('#39433c', x + 4, y + 6, 4, 1);
  }
  // 다이얼 옆에 붙여 놓은 쪽지
  R.poly('#16141360', [[92, -122], [120, -124], [123, -98], [95, -96]]);
  R.poly('#d6c47c', [[90, -125], [117, -127], [120, -101], [93, -99]]);
  R.poly('#b9a763', [[92.6, -102], [119.6, -104], [120, -101], [93, -99]]);
  R.box('#e9e2c060', 98, -129, 12, 6);
  for (let i = 0; i < 3; i++) R.seg('#5f5536', 95 + i * 0.4, -119 + i * 6, 113 - (i === 2 ? 8 : 0), -120.4 + i * 6, 1);
  // 스탠드 쪽은 밝고 반대쪽은 그늘진다
  const shadeX = g.createLinearGradient(R.X(-20), 0, R.X(132), 0);
  shadeX.addColorStop(0, '#0c141600'); shadeX.addColorStop(1, '#0c141666');
  g.fillStyle = shadeX; g.fillRect(R.X(-20), R.Y(-123), R.X(132) - R.X(-20), R.Y(0) - R.Y(-123));
  R.glow('#f7c78a2c', -120, -112, 150);

  // ── 작업대 앞쪽: 감아 둔 측정선, 접힌 정비 기록지, 드라이버와 나사 ──
  for (let i = 0; i < 4; i++) {
    const x = -168 + i * 4, y = 14 + i * 2;
    B.oval('#12100f70', x + 2, y + 3, 31, 9, (dx, dy) => dx * dx + dy * dy > 0.6);
    B.oval(i % 2 ? '#34302b' : '#23211f', x, y, 30, 8.4, (dx, dy) => dx * dx + dy * dy > 0.6);
    B.oval('#5f574c', x, y, 30, 8.4, (dx, dy) => dx * dx + dy * dy > 0.84 && dy < -0.35 && dx < 0.5);
  }
  B.seg('#23211f', -136, 22, -112, 30, 2);
  B.seg('#9a3c33', -112, 30, -96, 34, 3);
  B.seg('#c9cdbd', -96, 34, -88, 36, 1.2);
  B.poly('#16141370', [[142, 12], [202, 8], [226, 34], [162, 40]]);
  B.poly('#aaa387', [[138, 8], [198, 4], [220, 30], [156, 36]]);
  B.poly('#c2bb9e', [[138, 8], [198, 4], [199, 6], [139, 10]]);
  B.poly('#948d74', [[147, 22], [209, 17], [220, 30], [156, 36]]);
  B.seg('#7f7964', 147, 22, 209, 17, 0.8);
  for (let i = 0; i < 3; i++) B.seg('#6a6d5d', 148 + i * 3, 12 + i * 3.4, 180 + i * 3 + (i % 2) * 8, 9.6 + i * 3.4, 0.9);
  for (let i = 0; i < 3; i++) B.seg('#6a6d5d', 158 + i * 3, 25 + i * 3.4, 190 + i * 3 - (i % 2) * 10, 22.4 + i * 3.4, 0.9);
  B.box('#8a3a30', 186, 8, 8, 5);
  B.seg('#12100f70', 22, 31, 96, 25, 3);
  B.seg('#a7783f', 20, 27, 48, 24.6, 6);
  B.seg('#d3a468', 20, 25.4, 48, 23, 1.4);
  B.seg('#6f4d28', 20, 29.4, 48, 27, 1.2);
  B.seg('#8f9a91', 50, 24.4, 94, 21, 2);
  B.seg('#c9d0c4', 50, 23.6, 94, 20.2, 0.8);
  for (const [x, y] of [[104, 30], [112, 24], [-44, 30]]) { B.box('#12100f80', x + 1, y + 1, 4, 3); B.box('#a2a490', x, y, 4, 3); B.box('#d0d2bf', x, y, 2, 1); }

  // 불빛이 작업대에 고이고, 빛줄기 안에 먼지가 떠 있다
  g.save();
  g.translate(0, bench + u(8)); g.scale(1, 0.3); g.translate(0, -(bench + u(8)));
  B.glow('#f7c78a30', -120, 8, 250);
  g.restore();
  for (let i = 0; i < 26; i++) {
    const k = rand(), x = -24 + (rand() - 0.4) * (40 + k * 110), y = -124 + k * 118;
    L.box(i % 3 ? '#f7dcae50' : '#fff0cc80', x, y, 1, 1);
  }
  B.glow('#e4c58818', -80, -56, 180);

  // 구석진 방: 가장자리로 갈수록 어둡다
  const shade = g.createRadialGradient(cx - 24 * s, bench - 64 * s, w * 0.14, cx, bench - 96 * s, Math.max(w * 0.65, h * 0.5));
  shade.addColorStop(0, '#101a2000'); shade.addColorStop(1, '#0c14188c');
  g.fillStyle = shade; g.fillRect(0, 0, w, h);

  radioSignalHd(g, w, h, 0);
}
