import { type Ink, type Point, pixelText, seeded } from './pixels';
import { type Brush, brush, vignette } from './hd';

/** 신문지 빛깔: 앞쪽일수록 자주 나온다 (끝의 둘은 가끔 섞인 색지) */
const PAPER = ['#c9bfa0', '#b8b297', '#aaa58d', '#d4cbae', '#beb69a', '#a9b3a6', '#c8ad98'];

/** 봉투 빛깔: 해마다 다른 종이 (새것 · 바랜 것 · 누렇게 뜬 것) */
const ENVELOPE = [
  { base: '#c6ae8b', flap: '#dcc6a2', line: '#96806a', lit: '#ead8b6' },
  { base: '#b7a087', flap: '#cdb697', line: '#8a7662', lit: '#dbc8a8' },
  { base: '#d2bea0', flap: '#e4d2b2', line: '#a48e78', lit: '#f1e3c6' },
  { base: '#d6cfbc', flap: '#e7e1d0', line: '#a09988', lit: '#f6f1e2' },
  { base: '#a89274', flap: '#bca585', line: '#7c6954', lit: '#ccb795' },
];

/**
 * 철사로 묶은 폐지 뭉치 (x, y = 앞면의 왼쪽 위). 켜켜이 쌓인 신문 단면이 보이고, 위에서 살짝 내려다본 윗면이 붙는다.
 * cut 을 주면 그쪽 끝은 잘린 단면이다: 종이가 들쭉날쭉 삐져나온다.
 */
function bale(B: Brush, x: number, y: number, bw: number, bh: number, seed: number, cut: -1 | 0 | 1 = 0) {
  const rand = seeded(seed);
  B.poly('#cbc3a7', [[x + 5, y - 5], [x + bw - 2, y - 5], [x + bw, y], [x, y]]);
  B.box('#e6dec3', x + 5, y - 5, bw - 7, 1);
  for (let i = 0; i < 5; i++) B.box('#a9a48c', x + 7 + rand() * (bw - 30), y - 4 + Math.floor(rand() * 3), 6 + rand() * 14, 1);
  B.box('#3f423d', x, y, bw, bh);
  for (let r = 1; r < bh - 2; r += 3) {
    const a = cut < 0 ? -rand() * 10 : Math.floor(rand() * 3), b = cut > 0 ? -rand() * 10 : Math.floor(rand() * 3);
    const end = x + bw - b;
    for (let px = x + a; px < end;) {
      const len = Math.min(end - px, 8 + rand() * 38);
      B.box(PAPER[Math.floor(rand() ** 1.7 * PAPER.length)], px, y + r, len, 2);
      B.box('#fff8e030', px, y + r, len, 1);
      px += len + (rand() > 0.6 ? 1 : 0);
    }
    if (rand() > 0.45) B.box('#6d7267', x + bw * (0.12 + rand() * 0.6), y + r, bw * (0.06 + rand() * 0.14), 2);
  }
  // 빛은 왼쪽 위에서 온다: 오른쪽 끝과 아래쪽이 그늘진다
  if (cut >= 0) B.box('#fff3d020', x, y, 3, bh);
  if (cut <= 0) B.box('#1f262330', x + bw * 0.87, y, bw * 0.13, bh);
  B.box('#1f262326', x, y + bh - 7, bw, 7);
  for (const t of [0.23, 0.76]) {
    B.box('#3d4641', x + bw * t, y - 4, 3, bh + 4);
    B.box('#c4c7a9', x + bw * t, y - 4, 1, bh + 3);
  }
  // 묶이지 않고 삐져나온 귀퉁이
  for (let i = 0; i < 4; i++) {
    const yy = y + 4 + rand() * (bh - 10), left = i % 2 === 0, reach = 3 + rand() * 3;
    if (left ? cut < 0 : cut > 0) continue;
    const ex = left ? x : x + bw, d = left ? -1 : 1;
    B.poly(left ? '#ddd4b8' : '#a39d86', [[ex, yy], [ex + d * reach, yy - 2], [ex, yy + 3]]);
  }
}

/**
 * 바닥에 떨어진 신문지 한 장: 바닥에 누운 채 제멋대로 돌아가 있다 (세로는 원근으로 눌린다).
 * 제목 · 두 단의 기사 줄 · 사진 칸이 보이고, 어떤 것은 반으로 접혔거나 귀퉁이가 접혀 있다.
 */
function scrap(g: Ink, x: number, y: number, k: number, rand: () => number) {
  const B = brush(g, Math.round(x), Math.round(y), k);
  const a = (rand() - 0.5) * 1.3, c = Math.cos(a), sn = Math.sin(a);
  const hw = 13 + rand() * 5, hd = 9 + rand() * 3;
  const at = (fu: number, fv: number): Point => [fu * hw * c - fv * hd * sn, (fu * hw * sn + fv * hd * c) * 0.45];
  const tone = ['#d8cfb4', '#c9c0a4', '#b9b49c', '#e0d6bb'][Math.floor(rand() * 4)];
  const quad = [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)];
  B.poly('#5c5b4f80', quad.map(([px, py]) => [px + 1.4, py + 1.2] as Point));
  B.poly(tone, quad);
  const kind = rand();
  // 반으로 접혀 한쪽이 살짝 들렸다: 들린 쪽이 그늘지고 접힌 금이 밝다
  if (kind < 0.28) B.poly('#0000001a', [at(0, -1), at(1, -1), at(1, 1), at(0, 1)]);
  const line = (fu0: number, fu1: number, fv: number, color: string, t: number) => {
    const p = at(fu0, fv), q = at(fu1, fv);
    B.seg(color, p[0], p[1], q[0], q[1], t);
  };
  line(-0.82, -0.2 + rand() * 0.9, -0.62, '#6f6c5c', 0.9);
  const rows = hd * 0.45 * k > 5 ? [-0.18, 0.18, 0.54] : [0.1];
  const photo = rand() > 0.5;
  for (const fv of rows) {
    line(-0.82, -0.08, fv, '#948f79', 0.4);
    if (!photo) line(0.08, 0.5 + rand() * 0.3, fv, '#948f79', 0.4);
  }
  if (photo) B.poly('#8d8a78', [at(0.1, -0.32), at(0.82, -0.32), at(0.82, 0.72), at(0.1, 0.72)]);
  if (kind < 0.28) { const p = at(0, -1), q = at(0, 1); B.seg('#f1e9d2', p[0], p[1], q[0], q[1], 0.4); }
  // 접힌 귀퉁이
  if (kind > 0.72) {
    B.poly('#00000022', [at(0.62, 1), at(1, 1), at(1, 0.3)]);
    B.poly('#efe7cf', [at(0.62, 1), at(1, 0.3), at(0.72, 0.42)]);
  }
  const p = at(-1, -1), q = at(1, -1);
  B.seg('#efe7cf', p[0], p[1], q[0], q[1], 0.4);
}

/** 구겨서 버린 종이 뭉치: 빛은 왼쪽 위에서 온다 */
function crumple(g: Ink, x: number, y: number, k: number) {
  const B = brush(g, Math.round(x), Math.round(y), k);
  B.oval('#5c5b4f70', 1.5, 0.5, 6.5, 2);
  B.poly('#b7b096', [[-5.5, -2], [-4.5, -6.5], [-1, -8.5], [3, -8], [6, -4.5], [5.5, -0.5], [1, 0.6], [-3.5, 0.2]]);
  B.poly('#e2dac0', [[-4.5, -6.5], [-1, -8.5], [1, -5.5], [-2.5, -3.6]]);
  B.poly('#cec6aa', [[1, -5.5], [3, -8], [6, -4.5], [2.2, -2.6]]);
  B.poly('#d5cdb2', [[-5.5, -2], [-4.5, -6.5], [-2.5, -3.6], [-3.5, 0.2]]);
  B.poly('#9e987f', [[2.2, -2.6], [6, -4.5], [5.5, -0.5], [1, 0.6]]);
  B.seg('#8f8a74', -2.5, -3.6, 2.2, -2.6, 0.4);
  B.seg('#8f8a74', 1, -5.5, -1, -8.5, 0.4);
  B.seg('#8f8a74', 1, -5.5, 2.2, -2.6, 0.4);
}

/** 노끈 타래: 세워 둔 원통에 줄이 감겨 있고, 풀린 끝이 바닥에 늘어져 있다 */
function twine(g: Ink, x: number, y: number, k: number) {
  const B = brush(g, Math.round(x), Math.round(y), k);
  B.oval('#5c5b4f80', 3, 0.5, 10, 2.6);
  B.oval('#8d7344', 0, 0, 7, 2.2);
  B.box('#a88c58', -7, -10, 14, 10);
  B.box('#c8ab72', -7, -10, 3, 10);
  B.box('#806838', 4, -10, 3, 10);
  for (let yy = -8.6; yy < 0; yy += 1.8) B.seg('#7d653c', -6.6, yy + 0.9, 6.6, yy, 0.4);
  B.oval('#c4a86e', 0, -10, 7, 2.2);
  B.oval('#e0c891', -1.2, -10.4, 4.6, 1.3);
  B.oval('#3f3524', 0, -10, 2, 0.9);
  B.seg('#a88e5e', 6.4, -4, 10, 0.4, 0.6);
  B.seg('#a88e5e', 10, 0.4, 16, 1.6, 0.6);
  B.seg('#a88e5e', 16, 1.6, 22, 0, 0.6);
}

/** 봉투 (정면): 가운데가 (cx, cy), a 만큼 기울었다. back 이면 접힌 날개 쪽, 아니면 아무것도 적히지 않은 앞면 */
function envelope(B: Brush, cx: number, cy: number, ew: number, eh: number, a: number, tone: number, back = true, shadow = true) {
  const c = Math.cos(a), sn = Math.sin(a), hw = ew / 2, hh = eh / 2, e = ENVELOPE[tone];
  const P = (x: number, y: number, dx = 0, dy = 0): Point => [cx + x * c - y * sn + dx, cy + x * sn + y * c + dy];
  if (shadow) B.poly('#2f312a66', [P(-hw, -hh, 3, 5), P(hw, -hh, 3, 5), P(hw, hh, 3, 5), P(-hw, hh, 3, 5)]);
  B.poly(e.line, [P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)]);
  B.poly(e.base, [P(-hw + 1, -hh + 1), P(hw - 1, -hh + 1), P(hw - 1, hh - 1), P(-hw + 1, hh - 1)]);
  const line = (p: Point, q: Point, color: string) => B.seg(color, p[0], p[1], q[0], q[1], 0.6);
  if (back) {
    const tip = P(0, eh * 0.1);
    B.poly('#0000000f', [P(-hw + 1, hh - 1), P(hw - 1, hh - 1), P(0, eh * 0.06)]);
    line(P(-hw + 1, hh - 1), P(0, eh * 0.06), e.line);
    line(P(hw - 1, hh - 1), P(0, eh * 0.06), e.line);
    B.poly(e.flap, [P(-hw + 1, -hh + 1), P(hw - 1, -hh + 1), tip]);
    line(P(-hw + 1, -hh + 1), tip, e.line);
    line(P(hw - 1, -hh + 1), tip, e.line);
  } else {
    // 앞면: 우표 자리도 주소 줄도 비어 있다. 종이 결과 눌린 자국만
    B.poly('#0000000c', [P(-hw + 1, hh * 0.3), P(hw - 1, hh * 0.3), P(hw - 1, hh - 1), P(-hw + 1, hh - 1)]);
    line(P(-hw + 4, -hh + 4), P(-hw * 0.2, -hh + 4), e.flap);
  }
  line(P(-hw + 1, -hh + 1), P(hw - 1, -hh + 1), e.lit);
}

/** 노끈으로 열십자로 묶은 봉투 뭉치: 맨 위 봉투 밑으로 해마다 다른 종이의 가장자리가 켜켜이 보인다 */
function bundle(B: Brush, cx: number, cy: number, ew: number, eh: number, n: number, a: number) {
  const c = Math.cos(a), sn = Math.sin(a), hw = ew / 2, hh = eh / 2, step = 1.5;
  const P = (x: number, y: number, dy = 0): Point => [cx + x * c - y * sn, cy + x * sn + y * c + dy];
  const quad = (d: number, ox = 0) => [P(-hw, -hh, d), P(hw, -hh, d), P(hw, hh, d), P(-hw, hh, d)].map(([x, y]) => [x + ox, y] as Point);
  B.poly('#2f312a70', quad(n * step + 4, 3));
  for (let i = n; i >= 1; i--) {
    const e = ENVELOPE[(i * 2 + 1) % ENVELOPE.length];
    B.poly(e.base, quad(i * step));
    const [p, q] = [P(-hw, hh, i * step), P(hw, hh, i * step)];
    B.seg(e.line, p[0], p[1], q[0], q[1], 0.5);
  }
  envelope(B, cx, cy, ew, eh, a, 3, false, false);
  // 노끈: 가로 · 세로로 한 바퀴씩 감고, 엇갈린 자리에 매듭
  const string = (p: Point, q: Point) => { B.seg('#7d6a48', p[0] + 0.5, p[1] + 0.6, q[0] + 0.5, q[1] + 0.6, 0.6); B.seg('#c8ad78', p[0], p[1], q[0], q[1], 0.6); };
  const kx = -ew * 0.12, ky = eh * 0.08;
  string(P(-hw, ky), P(hw, ky));
  string(P(kx, -hh), P(kx, hh));
  string(P(kx, hh), P(kx, hh, n * step));
  const [kxp, kyp] = P(kx, ky);
  B.oval('#a88e5e', kxp, kyp, 2, 1.5);
  B.oval('#d8c090', kxp - 0.5, kyp - 0.5, 1, 0.7);
  B.seg('#c8ad78', kxp, kyp, kxp - 5, kyp - 3, 0.6);
  B.seg('#c8ad78', kxp, kyp, kxp + 4, kyp - 4, 0.6);
  B.seg('#c8ad78', kxp, kyp, kxp - 2, kyp + 6, 0.6);
}

/** 바닥에 납작하게 떨어진 봉투 */
function lyingEnvelope(g: Ink, x: number, y: number, k: number, tone: number, lean: number) {
  const B = brush(g, Math.round(x), Math.round(y), k), e = ENVELOPE[tone];
  const wd = 44, d = 17, sk = lean * 7;
  const quad: Point[] = [[0, 0], [wd, 0], [wd + sk, d], [sk, d]];
  B.poly('#2f312a80', quad.map(([px, py]) => [px + 2, py + 3] as Point));
  B.poly(e.base, quad);
  const tip: Point = [wd / 2 + sk * 0.56, d * 0.56];
  B.poly(e.flap, [[0, 0], [wd, 0], tip]);
  B.seg(e.line, 0, 0, tip[0], tip[1], 0.5);
  B.seg(e.line, wd, 0, tip[0], tip[1], 0.5);
  B.seg(e.line, sk, d, wd + sk, d, 0.5);
  B.seg(e.lit, 0, 0, wd, 0, 0.5);
}

/** 열린 봉투에서 비어져 나온 편지지: 눌러 쓴 손글씨 몇 줄 */
function letter(g: Ink, x: number, y: number, k: number, rand: () => number) {
  lyingEnvelope(g, x - 14 * k, y + 12 * k, k, 1, -1);
  const B = brush(g, Math.round(x), Math.round(y), k);
  const sheet: Point[] = [[0, 0], [54, -6], [59, 25], [5, 31]];
  B.poly('#2f312a80', sheet.map(([px, py]) => [px + 3, py + 3] as Point));
  B.poly('#e8dcc0', sheet);
  B.poly('#d6c9aa', [[2.5, 15.5], [56.5, 9.5], [56.7, 11], [2.7, 17]]);
  B.seg('#f6eed8', 0, 0, 54, -6, 0.5);
  for (let i = 0; i < 5; i++) {
    const until = i === 4 ? 24 : 40 + rand() * 6;
    for (let t = 0; t < until;) {
      const len = 2 + rand() * 4;
      B.box('#5f5e6e', 6 + i * 0.8 + t, 3.5 + i * 5 - t * 0.11 + (rand() > 0.6 ? 1 : 0), len, 1);
      t += len + 1.5;
    }
  }
}

/**
 * 분리수거장의 배경: 흐린 오후 하늘, 담장 너머 동네, 골함석 담장.
 * top = 담장 윗선, ground = 담장이 바닥에 닿는 줄. 바닥은 부르는 쪽이 칠한다.
 */
function backdrop(g: Ink, w: number, h: number, s: number, rand: () => number, top: number, ground: number) {
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };

  // ── 하늘: 해가 구름 뒤에서 번진다 ──
  const skyFill = g.createLinearGradient(0, 0, 0, top);
  ['#7c9f9f', '#93aea6', '#bcc3aa', '#dccfaa'].forEach((c, i, a) => skyFill.addColorStop(i / (a.length - 1), c));
  g.fillStyle = skyFill;
  g.fillRect(0, 0, w, top);
  const sx = Math.round(w * 0.22), sy = Math.round(top * 0.45), sr = Math.round(240 * s);
  const sun = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
  sun.addColorStop(0, '#fff4d470'); sun.addColorStop(0.25, '#fff0c838'); sun.addColorStop(1, '#fff0c800');
  g.fillStyle = sun;
  g.fillRect(sx - sr, sy - sr, sr * 2, Math.min(sr * 2, top - sy + sr));
  for (let i = 0; i < 18; i++) {
    const x = rand() * w - 40 * s, y = top * (0.1 + rand() * 0.72), span = (50 + rand() * 130) * s;
    for (let j = 0; j < 22; j++) {
      const t = rand();
      fill(j % 4 ? '#f1ead230' : '#ffffff2c', x + t * span, y - Math.sin(t * Math.PI) * 5 * s + rand() * 6 * s, (8 + rand() * 30) * s, 1);
    }
  }

  // ── 담장 너머 동네: 먼 줄은 옅고, 가까운 줄은 창과 옥상 물탱크가 보인다 ──
  for (let x = -u(6); x < w;) {
    const bw = u(12 + rand() * 20), bh = u(22 + rand() * 46);
    fill('#9db1a6', x, top - bh, bw, bh);
    fill('#abbdb0', x, top - bh, u(2), bh);
    x += bw + (rand() > 0.7 ? u(4) : 0);
  }
  for (let x = -u(10); x < w;) {
    const bw = u(18 + rand() * 26), bh = u(10 + rand() * 38), y = top - bh;
    fill('#7f9488', x, y, bw, bh);
    fill('#8fa396', x, y, u(3), bh);
    fill('#6b8177', x + bw - u(4), y, u(4), bh);
    fill('#a8b8a5', x, y, bw, 1);
    for (let i = u(5); i < bw - u(6); i += u(5)) {
      for (let j = u(4); j < bh - u(3); j += u(6)) {
        const r = rand();
        if (r > 0.42) fill(r > 0.94 ? '#e9dfb4' : '#667c73', x + i, y + j, u(2), u(3));
      }
    }
    const r = rand();
    if (r > 0.64) {
      const tx = x + Math.round(bw * 0.25);
      fill('#667c73', tx + 1, y - u(3), 1, u(3)); fill('#667c73', tx + u(7) - 2, y - u(3), 1, u(3));
      fill('#b5b08c', tx, y - u(9), u(7), u(6));
      fill('#d8d2ac', tx, y - u(9), u(7), 1);
      fill('#8f8d72', tx + u(7) - u(2), y - u(8), u(2), u(5));
    } else if (r > 0.36) {
      const ax = x + Math.round(bw * 0.62);
      fill('#667c73', ax, y - u(13), 1, u(13));
      fill('#667c73', ax - u(3), y - u(11), u(7), 1);
      fill('#667c73', ax - u(2), y - u(8), u(5), 1);
    }
    x += bw + (rand() > 0.6 ? u(3) : 0);
  }
  const haze = g.createLinearGradient(0, top - 70 * s, 0, top);
  haze.addColorStop(0, '#d6cdac00'); haze.addColorStop(1, '#d6cdac66');
  g.fillStyle = haze;
  g.fillRect(0, Math.round(top - 70 * s), w, Math.round(70 * s));

  // ── 전봇대와 늘어진 전선 ──
  const px = Math.round(w * 0.31), wireY = top - u(60);
  for (const [dy, sag] of [[0, 15], [6, 20]]) {
    for (let x = 0; x < w; x++) {
      const t = x < px ? x / Math.max(1, px) : (w - x) / Math.max(1, w - px);
      fill('#4f5d57', x, wireY + u(dy) + sag * s * 4 * t * (1 - t) * (x < px ? 0.6 : 1), 1, 1);
    }
  }
  fill('#56615a', px, top - u(68), u(4), u(68));
  fill('#7d8a80', px, top - u(68), 1, u(68));
  fill('#56615a', px - u(13), wireY - u(2), u(30), u(3));
  fill('#7d8a80', px - u(13), wireY - u(2), u(30), 1);
  for (const dx of [-11, -4, 8, 14]) fill('#d5d8c6', px + u(dx), wireY - u(5), u(2), u(3));
  fill('#65736b', px + u(5), top - u(46), u(9), u(14));
  fill('#8b988d', px + u(5), top - u(46), u(2), u(14));
  fill('#4a5650', px + u(5), top - u(33), u(9), 1);

  // ── 골함석 담장 ──
  fill('#87968b', 0, top, w, ground - top);
  const pitch = Math.max(6, Math.round(12 * s)), q = Math.max(1, Math.round(pitch / 6));
  for (let x = 0, i = 0; x < w; x += pitch, i++) {
    fill('#5e726e', x, top, q, ground - top);
    fill('#75887f', x + q, top, q, ground - top);
    fill('#99a595', x + pitch - q * 3, top, q, ground - top);
    fill('#b4b9a5', x + pitch - q * 2, top, q, ground - top);
    if (i % 8 === 0) fill('#3f524f', x, top, 1, ground - top);
    if ((i >> 3) % 2) fill('#2c3a3610', x, top, pitch, ground - top);
  }
  const grime = g.createLinearGradient(0, top, 0, ground);
  grime.addColorStop(0, '#fff6d81a'); grime.addColorStop(0.45, '#56696400'); grime.addColorStop(1, '#2f3f3b5c');
  g.fillStyle = grime;
  g.fillRect(0, top, w, ground - top);
  // 가로대에 박은 못 줄과 거기서 흘러내린 녹물
  for (const f of [0.2, 0.7]) {
    const y = Math.round(top + (ground - top) * f);
    for (let x = Math.round(pitch / 2); x < w; x += pitch) {
      fill('#4c5f5b', x, y, q + 1, q + 1);
      fill('#c9ccb6', x, y, 1, 1);
      if (rand() > 0.82) {
        const len = (8 + rand() * 30) * s;
        fill('#8c7a5a50', x, y + q + 1, q, len);
        fill('#8c7a5a2c', x + q, y + q + 1, 1, len * 0.6);
      }
    }
  }
  fill('#c5c5ab', 0, top - u(4), w, u(4));
  fill('#e5e3cb', 0, top - u(4), w, 1);
  fill('#8f927d', 0, top - 1, w, 1);
  fill('#3f524f70', 0, top, w, u(2));
  return { u, fill };
}

/** 마당 바닥: 다진 흙과 시멘트. 가까울수록 얼룩이 길어진다 */
function yardFloor(g: Ink, w: number, h: number, s: number, rand: () => number, ground: number, stops: string[]) {
  const floor = g.createLinearGradient(0, ground, 0, h);
  stops.forEach((c, i) => floor.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = floor;
  g.fillRect(0, ground, w, h - ground);
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh))); };
  const depth = h - ground;
  for (let i = 0; i < w * depth / 110; i++) {
    const t = rand() ** 0.8, y = ground + t * depth;
    fill(i % 3 ? '#6f736766' : '#d9cba677', rand() * w, y, (2 + rand() * 7) * s * (0.4 + t), 1);
  }
  // 잔돌
  for (let i = 0; i < w * depth / 5200; i++) {
    const t = rand(), x = rand() * w, y = ground + (0.04 + t * 0.94) * depth, k = Math.max(1, Math.round((1 + t * 2) * s));
    fill('#5f6258a0', x, y + 1, k + 1, 1);
    fill('#c9c2a6', x, y, k, 1);
  }
  // 갈라진 금
  for (let i = 0; i < Math.max(2, Math.round(w / 300)); i++) {
    let x = (0.1 + rand() * 0.8) * w, y = ground + (0.12 + rand() * 0.5) * depth;
    for (let j = 0; j < 9; j++) {
      const k = (y - ground) / depth, dx = (6 + rand() * 12) * s * (0.5 + k) * (i % 2 ? 1 : -1), dy = (rand() - 0.3) * 4 * s * (0.5 + k);
      const n = Math.max(1, Math.ceil(Math.abs(dx)));
      for (let m = 0; m <= n; m++) {
        fill('#6a6c5fb0', x + dx * m / n, y + dy * m / n, 1, 1);
        fill('#c4bc9f60', x + dx * m / n, y + dy * m / n + 1, 1, 1);
      }
      x += dx; y += dy;
    }
  }
}

/** 담장 밑에 늘어선 폐지 뭉치: 양 끝으로 갈수록 높이 쌓였다 */
function wallBales(g: Ink, w: number, s: number, rand: () => number, ground: number, skip?: (x: number) => boolean) {
  const B = brush(g, 0, ground, s);
  for (let x = -36, i = 0; x * s < w + 20; x += 104, i++) {
    const lift = Math.round(rand() * 5) * 2, top = -32 + lift, mid = (x + 51) * s / w;
    const tiers = mid < 0.2 || mid > 0.86 ? 3 : mid < 0.34 || mid > 0.7 ? 2 : 1;
    if (skip?.((x + 51) * s)) continue;
    // 담장과 바닥에 지는 그림자
    B.box('#2f3f3b38', x + 100, top - (tiers - 1) * 24, 10, 36 + (tiers - 1) * 24);
    B.poly('#55574b88', [[x + 4, top + 36], [x + 104, top + 36], [x + 114, top + 42], [x + 8, top + 42]]);
    bale(B, x, top, 102, 36, 31 + i * 7);
    if (tiers > 1) bale(B, x + 12, top - 5 - 26, 80, 26, 57 + i * 11);
    if (tiers > 2) bale(B, x + 26, top - 5 - 26 - 5 - 20, 56, 20, 83 + i * 13);
  }
}

/**
 * 분리수거장 (고해상도): 흐린 오후, 담장 밑에 폐지 뭉치가 산처럼 쌓여 있고 마당에는 신문지가 흩어져 있다.
 * 담장 윗선 · 바닥선(화면 높이의 54%) · 손수레 자리(폭의 76%)는 예전 그림과 같다.
 */
export function paperYardHd(g: Ink, w: number, h: number) {
  const rand = seeded(610);
  const s = Math.min(h / 480, w / 420);
  const ground = Math.round(h * 0.54), top = Math.round(h * 0.39) - Math.round(24 * s);
  const { u, fill } = backdrop(g, w, h, s, rand, top, ground);

  // 담장에 붙은 팻말
  const signX = Math.round(w * 0.52), signY = top + Math.round((ground - top) * 0.36);
  fill('#3f524f80', signX - 29, signY - 9, 62, 22);
  fill('#d9d6bf', signX - 31, signY - 11, 62, 22);
  fill('#f0eeda', signX - 31, signY - 11, 62, 1);
  fill('#4f6f66', signX - 29, signY - 9, 58, 18);
  fill('#9c9a86', signX - 29, signY - 9, 2, 2); fill('#9c9a86', signX + 27, signY - 9, 2, 2);
  pixelText(g, '분리수거', signX, signY, '#e9e6d0');

  yardFloor(g, w, h, s, rand, ground, ['#a8a38c', '#9d9884', '#8f8b79']);
  // 담장 밑은 그늘지고 풀이 조금 나 있다
  fill('#4f544880', 0, ground, w, u(3));
  for (let i = 0; i < w / (26 * s); i++) {
    const x = rand() * w, n = 2 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) fill(j % 2 ? '#6f8062' : '#586b52', x + j * u(2), ground - u(2 + rand() * 6), 1, u(4 + rand() * 5));
  }
  wallBales(g, w, s, rand, ground);

  // 묶어서 세워 둔 골판지: 뭉치가 낮게 쌓인 가운데 쪽에 기대어 있다
  const C = brush(g, Math.round(w * 0.4), ground + u(12), s);
  C.poly('#55574b88', [[-30, 0], [44, 0], [56, 6], [-22, 6]]);
  for (let i = 4; i >= 0; i--) {
    C.poly(i % 2 ? '#8f724e' : '#a98a60', [[-30 + i * 3.5, 0], [26 + i * 3.5, 0], [33 + i * 3.5, -60 + i], [-23 + i * 3.5, -60 + i]]);
  }
  C.poly('#b89a6e', [[-30, 0], [26, 0], [33, -60], [-23, -60]]);
  C.poly('#cdb083', [[-23, -60], [33, -60], [32.8, -58.5], [-23.2, -58.5]]);
  for (let x = -24; x < 24; x += 6) C.seg('#a58759', x, -2, x + 6.6, -57, 0.4);
  // 상자에 찍혀 있던 "이쪽이 위" 화살표
  for (const ax of [-13, 15]) {
    C.seg('#7d6444', ax, -31, ax + 1.2, -42, 1.6);
    C.poly('#7d6444', [[ax - 2.6, -41], [ax + 4.6, -41], [ax + 1.4, -47]]);
  }
  C.seg('#7d6444', -17, -28, 20, -28, 1.2);
  C.seg('#e3d9b4', -27.5, -22, 29, -22, 1);
  C.seg('#e3d9b4', 0, 0, 6.5, -60, 1);
  C.seg('#8f8870', -27.5, -21, 29, -21, 0.4);

  // ── 앞마당: 흩어진 신문지 · 노끈 타래 · 폐지를 실은 손수레. 세로로 긴 화면에서도 바닥이 비지 않게 깊이별로 흩는다 ──
  const items: [number, () => void][] = [];
  const depth = h - ground;
  for (let i = 0; i < Math.round(w * 0.03 + depth * 0.04); i++) {
    const v = rand(), y = ground + 16 * s + v * (depth - 20 * s), k = (0.7 + v * 1.3) * s, x = rand() * w;
    items.push([y, () => (i % 7 === 3 ? crumple(g, x, y, k * 1.1) : scrap(g, x, y, k, rand))]);
  }
  for (const f of [0.18, 0.47]) {
    const y = ground + depth * (0.3 + f * 0.5), k = (0.8 + (y - ground) / depth) * s;
    items.push([y, () => twine(g, w * f, y, k)]);
  }
  {
    const cy = Math.round(ground + Math.min(depth, w * 0.5) * 0.62), k = Math.max(1, Math.min(1.6, w / 600));
    items.push([cy, () => {
      const K = brush(g, Math.round(w * 0.76), cy, k);
      K.oval('#4a4a4066', 4, 2, 62, 5);
      K.oval('#4a4a4050', -98, 1, 8, 2);
      // 끌채와 받침 다리
      K.seg('#3e392e', -46, -28, -100, -40, 3);
      K.seg('#7b7361', -46, -29.5, -100, -41.5, 1);
      K.box('#3e392e', -103, -45, 4, 10);
      K.box('#7b7361', -103, -45, 1, 10);
      K.seg('#3e392e', -38, -24, -42, -1, 2.4);
      K.box('#3e392e', -45, -2, 7, 2);
      // 짐칸
      K.box('#3e3a30', -48, -29, 96, 8);
      K.box('#6d6452', -48, -32, 96, 3);
      K.box('#8f8672', -48, -32, 96, 1);
      K.box('#2b2822', -48, -22, 96, 1);
      for (const x of [-48, 45]) { K.box('#4a4436', x, -44, 3, 13); K.box('#7b7361', x, -44, 1, 13); }
      bale(K, -43, -32 - 34, 86, 34, 211);
      bale(K, -32, -32 - 34 - 5 - 24, 62, 24, 223);
      K.seg('#ded5b0', -12, -96, -16, -32, 0.8);
      K.seg('#ded5b0', 10, -96, 16, -32, 0.8);
      // 바퀴
      const hub: [number, number] = [6, -15];
      K.oval('#2b2d2c', hub[0], hub[1], 15, 15, (dx, dy) => dx * dx + dy * dy > 0.56);
      K.oval('#4f5250', hub[0], hub[1], 15, 15, (dx, dy) => dx * dx + dy * dy > 0.8 && dx + dy < -0.7);
      K.oval('#8d8d82', hub[0], hub[1], 11.4, 11.4, (dx, dy) => dx * dx + dy * dy > 0.78);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.2;
        K.seg('#77776d', hub[0], hub[1], hub[0] + Math.cos(a) * 10.5, hub[1] + Math.sin(a) * 10.5, 0.6);
      }
      K.oval('#9a9a8e', hub[0], hub[1], 3.4, 3.4);
      K.oval('#4a4a44', hub[0], hub[1], 1.4, 1.4);
    }]);
  }
  items.sort((a, b) => a[0] - b[0]).forEach(([, draw]) => draw());

  vignette(g, w, h, '#1a211e', 0.3);
}

/**
 * 부치지 못한 편지 (고해상도): 같은 마당을 가까이서 내려다본다.
 * 줄자를 따라 반으로 가른 폐지 더미 한가운데서 봉투 뭉치가 쏟아져 앞바닥까지 흩어졌다. 우표도 주소도 없다.
 * 더미 가운데는 화면 높이의 38% 근처, 쏟아진 봉투는 대화창 위(72% 위쪽)에 모여 있다.
 */
export function unsentLettersHd(g: Ink, w: number, h: number) {
  const rand = seeded(611);
  const s = Math.min(h / 480, w / 420);
  const cx = Math.round(w / 2), base = Math.round(h * 0.38 + 62 * s);
  const ground = Math.round(h * 0.44), top = ground - Math.round(h * 0.15) - Math.round(24 * s);
  const { u, fill } = backdrop(g, w, h, s, rand, top, ground);
  yardFloor(g, w, h, s, rand, ground, ['#9a957f', '#858270', '#6c6c5e', '#5b5d52']);
  fill('#4f544880', 0, ground, w, u(3));
  // 멀리 담장 밑에 남은 뭉치들 (가른 더미 뒤쪽은 비운다)
  wallBales(g, w, s, rand, ground, (x) => Math.abs(x - cx) < 215 * s);
  fill('#262e2b3c', 0, 0, w, ground + u(8));

  // 바닥의 이음매: 가까울수록 간격이 벌어진다
  for (let d = 26 * s; ground + d < h; d = d * 1.6 + 6 * s) {
    fill('#4b4e44a0', 0, ground + d, w, 1);
    fill('#b3ad9340', 0, ground + d + 1, w, 1);
  }

  const P = brush(g, cx, base, s);
  // 더미를 가른 줄자: 틈을 지나 발치까지 이어진다
  const end = (h - base) / s + 4, tx = -Math.min(110, w * 0.2 / s);
  P.poly('#2f312a66', [[1, -6], [5, -6], [tx + 14, end], [tx + 1, end]]);
  P.poly('#c7a84a', [[-2, -8], [2, -8], [tx + 8, end], [tx - 4, end]]);
  P.poly('#e2c869', [[-2, -8], [-1, -8], [tx - 1, end], [tx - 4, end]]);
  for (let t = 0.06; t < 1; t += 0.035 + t * 0.05) {
    const y = -8 + (end + 8) * t, x = tx * t, half = 2 + 4 * t;
    P.box('#5a4a20', x - half * 0.2, y, half * 1.1, Math.max(1, t * 1.6));
  }

  // 반으로 갈린 더미: 양쪽 뭉치의 잘린 단면이 틈을 향한다
  P.oval('#2f312a70', 0, 4, 190, 12);
  bale(P, -166, -46, 142, 46, 401, 1);
  bale(P, -156, -46 - 5 - 40, 116, 40, 409, 1);
  bale(P, 26, -46, 140, 46, 419, -1);
  bale(P, 42, -46 - 5 - 37, 112, 37, 431, -1);
  // 끊어진 철사와 틈으로 흘러내린 신문지
  P.seg('#3d4641', -52, -92, -44, -108, 1.2); P.seg('#3d4641', -44, -108, -34, -104, 1.2);
  P.seg('#3d4641', 62, -89, 54, -102, 1.2); P.seg('#3d4641', 54, -102, 47, -98, 1.2);
  for (const [x, y, d, c] of [[-26, -30, 1, '#d4cbae'], [-40, -74, 1, '#c9bfa0'], [28, -36, -1, '#b8b297'], [44, -70, -1, '#d4cbae'], [-24, -8, 1, '#beb69a']] as const) {
    P.poly(c, [[x, y], [x + d * 14, y + 4], [x + d * 11, y + 13], [x - d * 2, y + 7]]);
    P.seg('#8f8a74', x + d * 2, y + 5, x + d * 10, y + 8, 0.5);
  }

  // ── 쏟아진 봉투: 틈에 끼어 있던 것부터 발치로 흘러내린 것까지. 봉투 한 통은 뭉치 폭의 절반이 안 된다 ──
  envelope(P, -2, -82, 30, 17, -0.62, 1);
  envelope(P, 6, -68, 33, 18, 0.5, 3, false);
  envelope(P, -7, -55, 36, 20, -0.28, 0);
  envelope(P, 8, -43, 38, 21, 0.4, 4);
  envelope(P, -10, -31, 42, 23, 0.12, 2, false);
  envelope(P, 14, -20, 44, 24, -0.46, 1);
  P.glow('#ffe0a730', 2, -30, 120);
  envelope(P, -34, -10, 46, 25, 0.3, 3);
  envelope(P, 38, -6, 48, 26, 0.22, 0, false);
  envelope(P, -60, 12, 50, 27, -0.2, 4);
  envelope(P, 62, 16, 50, 27, -0.34, 2);
  envelope(P, -36, 27, 52, 28, -0.4, 0, false);
  envelope(P, 38, 29, 52, 28, 0.22, 1);
  bundle(P, 0, 9, 58, 31, 7, -0.07);

  // 앞바닥까지 흩어진 봉투들. 한 통은 열려서 편지지가 비어져 나왔다
  const y0 = base + 74 * s, reach = Math.max(40 * s, Math.min(h - y0 - 24 * s, 190 * s)), spread = Math.min(w, 1000 * s);
  const items: [number, () => void][] = [];
  if (w / 2 > 250 * s) {
    items.push([base + 4 * s, () => lyingEnvelope(g, cx - 262 * s, base + 4 * s, 0.8 * s, 3, 1)]);
    items.push([base + 30 * s, () => lyingEnvelope(g, cx + 196 * s, base + 30 * s, 0.95 * s, 0, -1)]);
    items.push([base + 44 * s, () => lyingEnvelope(g, cx - 200 * s, base + 44 * s, 1.05 * s, 4, -1)]);
  }
  for (const [f, v, tone, lean] of [[0.05, 0.08, 0, -1], [0.38, 0.2, 2, 1], [0.8, 0.02, 1, -1], [0.63, 0.4, 4, 1], [0.9, 0.56, 0, 1], [0.44, 0.7, 3, -1], [0.07, 0.86, 1, 1]] as const) {
    const y = y0 + v * reach, k = (0.9 + v * 0.9) * s;
    items.push([y, () => lyingEnvelope(g, cx + (f - 0.5) * spread - 22 * k, y, k, tone, lean)]);
  }
  items.push([y0 + 0.34 * reach, () => letter(g, cx - 0.33 * spread, y0 + 0.34 * reach, 1.35 * s, rand)]);
  for (let i = 0; i < Math.round(w * 0.008 + (h - y0) * 0.012); i++) {
    const v = rand(), y = y0 + v * (h - y0 - 12 * s), k = (0.9 + v * 1.1) * s, x = rand() * w;
    items.push([y - 1, () => scrap(g, x, y, k, rand)]);
  }
  items.sort((a, b) => a[0] - b[0]).forEach(([, draw]) => draw());

  vignette(g, w, h, '#141a17', 0.45);
}
