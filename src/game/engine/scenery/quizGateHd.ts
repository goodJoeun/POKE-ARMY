import { type Ink, pixelText, seeded } from './pixels';
import { brush, vignette } from './hd';

/** 현판의 별 (15×14) */
const STAR = [
  '.......#.......',
  '.......#.......',
  '......###......',
  '......###......',
  '.....#####.....',
  '###############',
  '.#############.',
  '..###########..',
  '...#########...',
  '...#########...',
  '..#####.#####..',
  '..####...####..',
  '.###.......###.',
  '.#...........#.',
];

/** 현판 글자 한 자: 픽셀 글꼴(갈무리14)로 찍은 작은 캔버스 둘(글자 빛 · 그림자 빛)과 잉크가 차지한 칸 */
function glyph(ch: string, face: string, shade: string) {
  const n = 24;
  const make = (color: string) => {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const m = c.getContext('2d');
    if (m) pixelText(m, ch, n / 2, n / 2, color, 'Galmuri14', 15);
    return c;
  };
  const f = make(face);
  const d = f.getContext('2d')?.getImageData(0, 0, n, n).data;
  let x1 = n, x2 = -1, y1 = n, y2 = -1;
  if (d) for (let i = 0; i < n * n; i++) {
    if (d[i * 4 + 3] < 128) continue;
    const x = i % n, y = (i - x) / n;
    x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y);
  }
  if (x2 < 0) return { face: f, shade: f, x: 0, y: 0, w: 0, h: 0 };
  return { face: f, shade: make(shade), x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
}

/**
 * 6. "군대 가기 싫다…" 그래도 가야 한다면 (고해상도): 해 질 녘의 훈련소 정문.
 * 지평선은 예전 그림처럼 화면 높이의 52%. 정문은 그보다 24칸 아래에 서 있고, 길은 지평선 가운데의 소실점에서 부채꼴로 넓어져
 * 화면 아래를 다 덮는다 (질문 창 위에 선 포켓몬들이 그 길 위, 정문 앞에 선 것으로 보인다).
 * 해는 왼쪽 산 너머: 왼쪽 모서리가 빛을 받고 그림자는 오른쪽으로 눕는다.
 */
export function quizGateHd(g: Ink, w: number, h: number) {
  const rand = seeded(5606);
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };
  const cx = Math.round(w / 2), horizon = Math.round(h * 0.52);
  const half = w / 2 / s; // 설계 칸으로 잰 화면 반폭
  const G = brush(g, cx, horizon, s);
  const base = 24; // 정문과 철책이 선 줄
  const bottom = (h - horizon) / s + 2;
  const sunX = -Math.min(230, half * 0.62);

  // ── 하늘 ──
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  ['#5a6c9a', '#b89aa8', '#f2c8a0', '#f8e0b8'].forEach((c, i, a) => sky.addColorStop(i / (a.length - 1), c));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, horizon + 1);
  G.glow('#fff6d8c0', sunX, -30, 130);
  G.glow('#ffe4b470', sunX, -30, 300);
  for (let i = 0; i < w / 9; i++) {
    const x = rand() * w, y = rand() ** 1.6 * horizon * 0.34;
    const c = '#f4ecdc' + ['ff', 'c0', '90'][i % 3];
    if (i % 17 === 0) { fill(c, x - 1, y, 3, 1); fill(c, x, y - 1, 1, 3); } else fill(c, x, y, 1, 1);
  }
  // 구름: 얇은 띠, 아래쪽이 노을빛
  for (let i = 0; i < 10 + w / 110; i++) {
    const x = rand() * w - 40 * s, y = horizon * (0.2 + rand() * 0.56), span = (50 + rand() * 120) * s;
    for (let j = 0; j < 24; j++) {
      const t = rand(), lit = j % 4 === 0;
      fill(lit ? '#fff0d078' : '#8c84a84a', x + t * span, y - Math.sin(t * Math.PI) * 5 * s + rand() * 5 * s + (lit ? 5 * s : 0), (8 + rand() * 30) * s, 1);
    }
  }

  // ── 겹겹이 산 능선: 멀수록 옅고, 해 쪽 비탈에 빛이 걸린다 ──
  const range = (top: number, amp: number, color: string, phase: number, lit: string) => {
    let prev = 0;
    for (let x = 0; x < w; x++) {
      const k = (x - cx) / s;
      const y = Math.round(horizon + (top - (0.5 + 0.5 * Math.sin(k / 46 + phase) + 0.3 * Math.sin(k / 19 + phase * 2) + 0.1 * Math.sin(k / 6 + phase)) * amp) * s);
      fill(color, x, y, 1, horizon - y + 1);
      if (x && y <= prev) fill(lit, x, y, 1, y < prev ? 2 : 1);
      prev = y;
    }
  };
  const mist = (from: number, color: string) => {
    const m = g.createLinearGradient(0, G.Y(from), 0, horizon);
    m.addColorStop(0, color + '00'); m.addColorStop(1, color + '66');
    g.fillStyle = m; g.fillRect(0, G.Y(from), w, horizon - G.Y(from));
  };
  range(-44, 30, '#8a8aa8', 1.3, '#c2a6b4');
  mist(-60, '#f6d4b0');
  range(-24, 22, '#6a7a8a', 2.1, '#9a98a2');
  mist(-36, '#e8c4a8');
  range(-6, 14, '#4e6a62', 3.7, '#6c8672');
  for (let x = 0; x < w; x += u(3)) {
    const k = (x - cx) / s, t = (2 + rand() * 5) * s;
    const y = horizon + (-6 - (0.5 + 0.5 * Math.sin(k / 46 + 3.7) + 0.3 * Math.sin(k / 19 + 7.4)) * 14) * s;
    fill('#43605a', x, y - t, u(2), t + 3 * s);
  }

  // ── 땅과 길 ──
  const ground = g.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, '#858270'); ground.addColorStop(1, '#6e6e60');
  g.fillStyle = ground;
  g.fillRect(0, horizon, w, h - horizon);
  for (let i = 0; i < w * 1.4; i++) {
    const t = rand() ** 1.3, y = horizon + t * (h - horizon);
    fill(i % 3 ? '#5c5c4e66' : '#a6a28a55', rand() * w, y, (2 + rand() * 8) * s * (0.3 + t), 1);
  }
  const edge = (y: number, at = 110) => at * y / base;
  const strip = (color: string, a: number, b: number) => {
    for (const d of [-1, 1]) G.poly(color, [[0, 0], [d * edge(bottom, a), bottom], [d * edge(bottom, b), bottom]]);
  };
  G.poly('#9a968a', [[-1, 0], [1, 0], [edge(bottom), bottom], [-edge(bottom), bottom]]);
  strip('#a39f9238', 26, 58); // 바퀴가 닳게 한 자리
  strip('#c6c2b2', 110, 117); // 경계석
  strip('#57574c', 117, 120);
  for (let i = 0; i < w * 1.1; i++) {
    const y = 2 + rand() ** 1.2 * (bottom - 2), x = (rand() * 2 - 1) * Math.min(edge(y, 106), half);
    G.box(i % 2 ? '#827e7288' : '#b2ae9e70', x, y, (1.5 + rand() * 5) * (0.3 + y / 50), 1);
  }
  for (let y = 5; y < bottom; y *= 2) { // 가운데 점선
    const y2 = y * 1.45, a = 2.2 * y / base, b = 2.2 * y2 / base;
    G.poly('#e8e0c8', [[-a, y], [a, y], [b, y2], [-b, y2]]);
  }
  G.poly('#e8e0c8d8', [[-edge(35, 104), 35], [edge(35, 104), 35], [edge(39, 104), 39], [-edge(39, 104), 39]]); // 정지선
  const dusk = g.createLinearGradient(0, horizon, 0, h);
  dusk.addColorStop(0, '#f8e0b830'); dusk.addColorStop(1, '#1a1a2a44');
  g.fillStyle = dusk;
  g.fillRect(0, horizon, w, h - horizon);

  // ── 정문 너머: 본부와 막사, 길가의 나무 ──
  const block = (x: number, bw: number, bh: number, y0: number) => {
    G.box('#98948e', x, y0 - bh, bw, bh);
    G.box('#d2bea2', x, y0 - bh, 2, bh);
    G.box('#7c7a78', x + bw - 3, y0 - bh, 3, bh);
    G.poly('#56645a', [[x - 3, y0 - bh], [x + bw + 3, y0 - bh], [x + bw - 2, y0 - bh - 7], [x + 2, y0 - bh - 7]]);
    G.box('#84927e', x + 2, y0 - bh - 7, bw - 4, 1);
    G.box('#3e4a42', x - 3, y0 - bh, bw + 6, 1);
    for (let r = 0; r * 11 + 9 < bh; r++) for (let i = 7; i < bw - 9; i += 10) {
      const on = rand() > 0.58;
      G.box(on ? '#f6dc98' : '#6a7480', x + i, y0 - bh + 4 + r * 11, 5, 5);
      if (!on) G.box('#8a94a0', x + i, y0 - bh + 4 + r * 11, 5, 1);
    }
  };
  for (const d of [-1, 1]) {
    for (let x = 178 + rand() * 24; x < half + 30;) {
      const bw = 92 + Math.floor(rand() * 60), bh = 28 + Math.floor(rand() * 12);
      block(d > 0 ? x : -x - bw, bw, bh, 7);
      x += bw + 22 + rand() * 34;
    }
  }
  block(-34, 68, 22, 3);
  G.box('#d8d8d8', -1, -44, 1, 16);
  G.box('#d84a44', 0, -44, 6, 4);
  for (const k of [0.3, 0.4, 0.52, 0.66, 0.82]) {
    for (const d of [-1, 1]) {
      const x = d * 150 * k, y = base * k;
      G.box('#4a3e38', x - 1.5 * k, y - 16 * k, 3 * k, 16 * k);
      G.oval('#3e5a50', x, y - 32 * k, 13 * k, 18 * k);
      G.oval('#5c7a5e', x - 4 * k, y - 36 * k, 7 * k, 9 * k);
      G.oval('#2a2a3830', x + 8 * k, y, 12 * k, 1.5 * k);
    }
  }
  const far = g.createLinearGradient(0, G.Y(-50), 0, G.Y(8));
  far.addColorStop(0, '#f2c8a000'); far.addColorStop(1, '#f2c8a048');
  g.fillStyle = far;
  g.fillRect(0, G.Y(-50), w, G.Y(8) - G.Y(-50));

  // ── 사람: 뒤에서 본 모습 (k = 정문 줄에서의 크기 대비) ──
  const person = (x: number, k: number, coat: string, bag: string | null, step: number, raise = false, helmet = false) => {
    const P = brush(g, G.X(x), G.Y(base * k), s * k);
    P.oval('#2a2a3848', 6, 0, 10, 1.6);
    P.box('#2c2c36', -3.6, -15, 3.2, 15 - step);
    P.box('#383844', 0.4, -15, 3.2, 14 + step);
    P.box(coat, -4.6, -27, 9.2, 13);
    P.box('#00000030', 2.4, -27, 2.2, 13);
    P.box('#f2d8b0a0', -4.6, -27, 1.4, 13);
    if (raise) P.seg(coat, 4.6, -26, 9, -35, 2.2); else P.box(coat, 4.4, -26, 2, 10);
    P.box(coat, -6.4, -26, 2, 10);
    P.box('#d8b49a', -1.4, -28.4, 2.8, 1.6);
    P.oval(helmet ? '#3e4636' : '#2a2630', 0, -31, 3.5, 3.6);
    if (helmet) P.box('#3e4636', -4.2, -31, 8.4, 1.4);
    if (bag) { P.box(bag, -3.6, -25, 7.2, 8.4); P.box('#ffffff30', -3.6, -25, 7.2, 1); P.box('#00000030', -3.6, -17.6, 7.2, 1); }
  };
  // 정문 안으로 멀어지는 입영 장정들
  person(1, 0.4, '#4a5a6a', null, 0);
  person(-17, 0.5, '#5a4a52', '#3a4a40', 1);
  person(14, 0.62, '#3a3a44', '#6a5a4a', 0);

  // ── 철책 ──
  const mesh = document.createElement('canvas');
  mesh.width = mesh.height = 6;
  const mg = mesh.getContext('2d');
  if (mg) {
    mg.fillStyle = '#4a4e4a9c';
    for (let i = 0; i < 6; i++) { mg.fillRect(i, i, 1, 1); mg.fillRect(5 - i, i, 1, 1); }
  }
  const wire = g.createPattern(mesh, 'repeat');
  const fenceTop = G.Y(base - 44), fenceFoot = G.Y(base - 4);
  for (const d of [-1, 1]) {
    const x0 = d < 0 ? 0 : G.X(164), x1 = d < 0 ? G.X(-164) : w;
    if (x1 <= x0) continue;
    if (wire) { g.fillStyle = wire; g.fillRect(x0, fenceTop, x1 - x0, fenceFoot - fenceTop); }
    fill('#8a887a', x0, fenceFoot, x1 - x0, G.Y(base) - fenceFoot);
    fill('#bcb6a2', x0, fenceFoot, x1 - x0, 1);
    fill('#5e5e54', x0, G.Y(base) - 1, x1 - x0, 1);
    fill('#5a5e5a', x0, fenceTop, x1 - x0, u(2));
    fill('#a8a694', x0, fenceTop, x1 - x0, 1);
    for (const y of [G.Y(base - 54), G.Y(base - 50)]) { // 가시철사
      fill('#4a4e4a', x0, y, x1 - x0, 1);
      for (let x = x0 + (y % 5); x < x1; x += u(7)) fill('#4a4e4a', x, y - 1, 1, 3);
    }
    for (let x = 192; x < half + 10; x += 30) {
      const px = d * x;
      G.seg('#5a5e5a', px + 1, base - 46, px + 1 - d * 4, base - 56, 1.5);
      G.box('#5a5e5a', px, base - 46, 3, 46);
      G.box('#d8c8a8', px, base - 46, 1, 46);
    }
  }

  // ── 그림자: 오른쪽으로 길게 ──
  for (const x of [-162, 138]) G.poly('#2a2a3840', [[x, base], [x + 28, base], [x + 190, base + 15], [x + 150, base + 19]]);

  // ── 아주 넓은 화면: 왼쪽 철책의 두 기둥 사이에 묶어 단 입영 환영 현수막 ──
  const cheer = '입영을 환영합니다';
  g.font = '12px Galmuri11, sans-serif';
  const a = -519, b = -402, t = base - 40, bh = 22;
  if (half >= 530 && G.X(b) - G.X(a) >= Math.ceil(g.measureText(cheer).width) + 16) {
    G.box('#2a2a3830', a + 3, t + 3, b - a, bh);
    G.box('#e8e1d2', a, t, b - a, bh);
    for (const f of [0.28, 0.6, 0.83]) { G.box('#d6cdbb', a + (b - a) * f, t + 1, 3, bh - 2); G.box('#f4eee2', a + (b - a) * f - 1, t + 1, 1, bh - 2); }
    G.box('#f8f2e4', a, t, b - a, 1);
    G.box('#cfc6b4', a, t + bh - 1, b - a, 1);
    G.box('#3a5aa0', a + 3, t + 3, b - a - 6, 1);
    G.box('#3a5aa0', a + 3, t + bh - 4, b - a - 6, 1);
    for (const y of [t + 1, t + bh - 2]) { G.seg('#3a3a3a', a - 3, y, a, y, 1); G.seg('#3a3a3a', b, y, b + 1, y, 1); }
    pixelText(g, cheer, G.X((a + b) / 2), G.Y(t + bh / 2), '#c4302a', 'Galmuri11', 12);
  }

  // ── 안쪽으로 열어 둔 철문 ──
  for (const d of [-1, 1]) {
    const x0 = d * 138, x1 = d * 106, t0 = base - 62, t1 = base * 0.64 - 40, b0 = base - 3, b1 = base * 0.64 - 2;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = x0 + (x1 - x0) * t, top = t0 + (t1 - t0) * t, foot = b0 + (b1 - b0) * t;
      G.box(i % 8 ? '#3e423e' : '#2e322e', x - (i % 8 ? 0.6 : 1.2), top, i % 8 ? 1.2 : 2.4, foot - top);
    }
    G.seg('#2e322e', x0, t0, x1, t1, 2);
    G.seg('#2e322e', x0, b0, x1, b1, 2);
    G.seg('#3e423e', x0, (t0 + b0) / 2, x1, (t1 + b1) / 2, 1.4);
    G.seg('#9a9684', x0, t0 - 1.5, x1, t1 - 1.5, 1);
  }

  // ── 정문 기둥 ──
  for (const d of [-1, 1]) {
    const x = d * 150;
    G.box('#c8c4b8', x - 12, -154, 24, 154 + base - 10);
    for (let i = 0; i < 46; i++) G.box(i % 2 ? '#b6b2a4' : '#d6d2c6', x - 9 + rand() * 17, -150 + rand() * 160, 1 + rand() * 2, 1);
    for (let y = -132; y < base - 36; y += 22) { G.box('#a29e90', x - 12, y, 24, 1); G.box('#dcd8cc', x - 12, y + 1, 24, 1); }
    // 아랫단 경고 띠
    G.clip(x - 12, base - 34, 24, 20, () => {
      G.box('#d8b040', x - 12, base - 34, 24, 20);
      for (let k = -36; k < 24; k += 12) G.poly('#3a3a38', [[x + k, base - 14], [x + k + 6, base - 14], [x + k + 26, base - 34], [x + k + 20, base - 34]]);
    });
    G.box('#eee4cc', x - 12, -154, 3, 154 + base - 10);
    G.box('#8a8678', x + 9, -154, 3, 154 + base - 10);
    G.box('#5e5a5060', x - 12, -152, 24, 7);
    G.box('#a09c90', x - 16, base - 12, 32, 12);
    G.box('#e0d8c4', x - 16, base - 12, 32, 1);
    G.box('#e8dcc4', x - 16, base - 12, 2, 12);
    G.box('#7a766a', x + 13, base - 12, 3, 12);
    G.box('#5e5e54', x - 16, base - 1, 32, 1);
  }

  // ── 들보와 현판 ──
  G.box('#c8c4b8', -168, -200, 336, 48);
  for (let i = 0; i < 100; i++) G.box(i % 2 ? '#b6b2a4' : '#d6d2c6', -164 + rand() * 326, -198 + rand() * 44, 1 + rand() * 3, 1);
  for (const x of [-136, 135]) { G.box('#a29e90', x, -200, 1, 48); G.box('#dcd8cc', x + 1, -200, 1, 48); }
  G.box('#eee4cc', -168, -200, 3, 48);
  G.box('#8a8678', 165, -200, 3, 48);
  G.box('#8a8678', -168, -154, 336, 2);
  G.box('#b4b0a4', -174, -206, 348, 6);
  G.box('#f2ead4', -174, -206, 348, 1);
  G.box('#8a8678', -174, -201, 348, 1);
  G.box('#eee4cc', -174, -206, 2, 6);
  // 현판: 국방색 바탕에 금테
  G.box('#5e5a5048', -121, -195, 244, 42);
  G.box('#16291c', -122, -197, 244, 42);
  G.box('#2a4a32', -120, -195, 240, 38);
  G.box('#335a3d', -120, -192, 240, 10);
  G.box('#d8c070', -120, -195, 240, 2);
  G.box('#f4e4a4', -120, -195, 240, 1);
  G.box('#d8c070', -120, -159, 240, 2);
  G.box('#a48c48', -120, -158, 240, 1);
  for (const x of [-116, 114]) for (const y of [-189, -166]) { G.box('#d8c070', x, y, 2, 2); G.box('#f4e4a4', x, y, 1, 1); }
  // 현판 글씨 (군마다 이름이 다른 정문이라 공통인 "신병교육대"): 픽셀 글꼴 한 칸을 캔버스 k×k 칸으로 키워 찍는다.
  // k는 현판 안에 들어가는 가장 큰 정수배라서 획이 번지지 않는다.
  const letters = [...'신병교육대'].map((ch) => glyph(ch, '#f4eedc', '#0c1c12'));
  const areaH = G.Y(-159) - G.Y(-193) - 4, areaW = G.X(108) - G.X(-108);
  const inkW = letters.reduce((a, l) => a + l.w, 0);
  const k = Math.max(1, Math.min(3, Math.floor(areaH / 14), Math.floor(areaW / (15 + 5 + inkW + 8))));
  const gap = Math.max(2 * k, Math.min(7 * k, Math.floor((areaW * 0.84 - 15 * k - inkW * k) / 5.5)));
  const starGap = Math.max(5 * k, Math.round(gap * 1.5));
  const signY = Math.round((G.Y(-193) + G.Y(-159)) / 2);
  let lx = cx - Math.round((15 * k + starGap + inkW * k + gap * 4) / 2);
  const ink = (c: string, x: number, y: number) => fill(c, x, y, k, k);
  STAR.forEach((bits, r) => [...bits].forEach((b, c) => {
    if (b === '#') ink('#0c1c12', lx + c * k + 1, signY - 7 * k + r * k + 1);
  }));
  STAR.forEach((bits, r) => [...bits].forEach((b, c) => {
    if (b === '#') ink(r < 6 ? '#fbe88a' : r < 10 ? '#f2d24a' : '#d8ae36', lx + c * k, signY - 7 * k + r * k);
  }));
  lx += 15 * k + starGap;
  g.save();
  g.imageSmoothingEnabled = false;
  for (const l of letters) { // 글자들은 모두 글꼴 칸의 같은 줄에서 시작하므로 윗선을 맞춘다
    if (!l.w) continue;
    const y = signY - 7 * k;
    g.drawImage(l.shade, l.x, l.y, l.w, l.h, lx + 1, y + 1, l.w * k, l.h * k);
    g.drawImage(l.face, l.x, l.y, l.w, l.h, lx, y, l.w * k, l.h * k);
    lx += l.w * k + gap;
  }
  g.restore();

  // 기둥 위의 등
  for (const x of [-150, 150]) {
    G.box('#5a5e5a', x - 3, -210, 6, 4);
    G.glow('#ffe6a888', x, -218, 46);
    G.oval('#ffeebc', x, -218, 7.5, 7.5);
    G.oval('#fffbe8', x - 1.5, -219.5, 4, 4);
  }

  // ── 위병소 (왼쪽) ──
  const qx = Math.min(-196, Math.max(-half + 30, -236)); // 좁은 화면에선 화면 끝에 조금 잘려도 기둥에 겹치지 않게
  const Q = brush(g, G.X(qx), G.Y(base), s);
  Q.poly('#2a2a3840', [[-20, 0], [24, 0], [150, 11], [112, 15]]);
  Q.box('#b8b4a4', -22, -58, 44, 58);
  for (let y = -46; y < -16; y += 12) Q.box('#a6a292', -22, y, 44, 1);
  Q.box('#5a6a5a', -22, -14, 44, 14);
  Q.box('#788878', -22, -14, 44, 1);
  Q.box('#ecdfc6', -22, -58, 3, 58);
  Q.box('#00000026', 18, -58, 4, 58);
  Q.box('#5e5e54', -22, -1, 44, 1);
  // 불 켜진 창과 안의 위병
  Q.box('#3a4038', -15, -49, 30, 28);
  Q.fade(['#fff2c4', '#eebf78'], -13, -47, 26, 24);
  Q.oval('#5a4634', 5, -37, 4.5, 4.5);
  Q.box('#4a4a38', -1, -40, 12, 2);
  Q.oval('#4a4a38', 5, -40, 5, 4, (_dx, dy) => dy < 0);
  Q.box('#5a4634', -1, -32, 12, 9);
  Q.box('#3a4038', -1, -47, 2, 24);
  Q.box('#d8d4c8', -18, -22, 36, 3);
  Q.box('#f2ecdc', -18, -22, 36, 1);
  Q.glow('#ffe0a04c', 0, -36, 44);
  Q.poly('#5a6a5a', [[-28, -58], [28, -58], [23, -67], [-23, -67]]);
  Q.poly('#7c8c78', [[-28, -58], [-23, -67], [-18, -67], [-23, -58]]);
  Q.box('#92a28c', -23, -67, 46, 1);
  Q.box('#3a463a', -28, -58, 56, 3);
  Q.box('#00000030', -22, -55, 44, 3);

  // ── 국기 게양대: 정문 오른쪽. 자리가 모자라면(세로 화면) 화면 오른쪽 끝에 더 높이 세우고 깃발을 정문 쪽으로 날린다 ──
  const roomy = half - 50 >= 214;
  const fx = roomy ? Math.min(238, half - 50) : half - 14, dir = roomy ? 1 : -1;
  const pole = roomy ? -238 : -Math.min(300, horizon / s - 14);
  if (roomy || pole <= -262) {
    G.poly('#2a2a3840', [[fx - 2, base + 1], [fx + 4, base + 1], [fx + 170, base + 14], [fx + 160, base + 15]]);
    G.box('#d8d8d8', fx - 1, pole, 3, base - 5 - pole);
    G.box('#f6ecd8', fx - 1, pole, 1, base - 5 - pole);
    G.box('#8e8e96', fx + 1, pole, 1, base - 5 - pole);
    G.box('#a09c90', fx - 7, base - 6, 15, 7);
    G.box('#e0d8c4', fx - 7, base - 6, 15, 1);
    G.box('#7a766a', fx + 5, base - 6, 3, 7);
    G.oval('#e8c860', fx + 0.5, pole - 3, 3.2, 3.2);
    // 깃발: 깃대에서 멀어질수록 크게 펄럭인다
    const sway = (x: number) => 2.4 * Math.sin(Math.abs(x - fx) / 7.5) * Math.min(1, Math.abs(x - fx) / 16);
    const cloth = (c: string, a: number, b: number, top: number, bottom: number) => {
      const p = fx + dir * a, q = fx + dir * b;
      G.ridge(c, Math.min(p, q), Math.max(p, q), (x) => pole + top + sway(x), (x) => pole + bottom + sway(x));
    };
    cloth('#f4efe4', 2, 46, 4, 33);
    for (const [a, b] of [[13, 18], [29, 34]]) cloth('#d6cdc0', a, b, 4, 33);
    cloth('#b8b0a8', 2, 46, 32, 33);
    // 태극과 네 괘 (깃대 쪽 위 건 ☰ · 바깥 위 감 ☵ · 깃대 쪽 아래 리 ☲ · 바깥 아래 곤 ☷)
    const tcx = fx + dir * 24, tcy = pole + 18.5 + sway(tcx);
    G.oval('#d83a3a', tcx, tcy, 7.5, 7.5);
    G.oval('#2a4aa0', tcx, tcy, 7.5, 7.5, (dx, dy) => dy > 0.38 * Math.sin(dir * dx * Math.PI));
    for (const [side, dy, bars] of [[-1, -9, '111'], [1, -9, '010'], [-1, 9, '101'], [1, 9, '000']] as const) {
      const bx = tcx + side * dir * 14, by = tcy + dy + sway(bx) - sway(tcx);
      [...bars].forEach((b, k) => {
        const y = by + (k - 1) * 2 - 0.5;
        if (b === '1') G.box('#2a2a30', bx - 2.5, y, 5, 1);
        else { G.box('#2a2a30', bx - 2.5, y, 2, 1); G.box('#2a2a30', bx + 0.5, y, 2, 1); }
      });
    }
  }

  // ── 넓은 화면: 가로등 ──
  for (const d of [-1, 1]) {
    const x = d * 334;
    if (half < 372) break;
    G.poly('#2a2a3838', [[x - 1, base + 4], [x + 3, base + 4], [x + 120, base + 14], [x + 112, base + 15]]);
    G.box('#4a4e4a', x - 1, -96, 3, 100 + base);
    G.box('#c8b898', x - 1, -96, 1, 100 + base);
    G.box('#4a4e4a', x - (d > 0 ? 20 : -1), -98, 20, 2);
    G.box('#3a3e3a', x - d * 20 - 5, -98, 10, 4);
    G.glow('#ffe6a880', x - d * 20, -90, 50);
    G.box('#fff3cc', x - d * 20 - 4, -94, 8, 3);
    G.box('#6a6a60', x - 3, base, 7, 4);
  }

  // ── 정문 앞의 사람들 ──
  if (qx + 44 < -172) person(qx + 38, 1.04, '#4a5440', null, 0, false, true); // 위병
  person(-44, 0.9, '#5a4a52', '#4a5a6a', 1);
  person(36, 1, '#4a5a6a', '#3a3a44', 0);
  if (roomy) { // 배웅 나온 가족
    person(fx - 44, 1.08, '#7a5a5a', null, 0, true);
    person(fx - 28, 1.02, '#5a5a6a', null, 0);
  }

  // 노을빛
  G.glow('#fff0c820', 0, -30, Math.max(w, h) * 0.4 / s);
  vignette(g, w, h, '#1a1430', 0.3);
}
