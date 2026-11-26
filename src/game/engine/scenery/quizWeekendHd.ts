import { type Ink, type Point, seeded } from './pixels';
import { type Brush, brush, vignette } from './hd';
import { type Ellipse, cumulus, lens } from './paradeHd';

/** 빛이 오는 쪽 (오른쪽 위) */
const LX = 0.55, LY = -0.83;

/**
 * 활엽수 한 그루: 붓 B의 원점이 밑동, 키 ht · 수관 반폭 rx (설계 칸).
 * 수관은 잎 덩이를 겹쳐 쌓는다. 해를 등진 덩이부터 칠해서, 오른쪽 위 덩이가 밝게 앞으로 나온다.
 */
function broadleaf(g: Ink, B: Brush, ht: number, rx: number, seed: number) {
  const rand = seeded(seed), s = B.s;
  const ry = Math.min(ht * 0.36, rx * 0.86), cy = -ht + ry, tw = Math.max(2.5, rx * 0.1);
  // 잔디에 눕는 그림자 (왼쪽 아래)
  B.oval('#2c6a3148', -rx * 0.6, 2, rx * 1.3, Math.max(3, rx * 0.11));
  B.oval('#2c6a3140', -tw, 1.5, tw * 3, Math.max(1.5, tw * 0.5));
  // 줄기 · 뿌리 · 가지
  B.poly('#5d3f2c', [[-tw * 1.6, 1], [-tw * 0.75, -3], [-tw * 0.5, -ht * 0.5], [-tw * 0.3, cy], [tw * 0.3, cy], [tw * 0.5, -ht * 0.5], [tw * 0.75, -3], [tw * 1.6, 1]]);
  B.poly('#8d6846', [[tw * 0.05, -2], [tw * 0.1, -ht * 0.5], [tw * 0.3, cy], [tw * 0.5, -ht * 0.5], [tw * 0.75, -3], [tw * 1.4, 1], [tw * 0.4, 1]]);
  B.box('#b08a62', tw * 0.42, -ht * 0.5, 1 / s, ht * 0.5 - 3);
  for (let i = 0; i < 5; i++) B.box('#4a3224', -tw * 0.5 + rand() * tw * 0.6, -ht * (0.08 + rand() * 0.3), 1 / s, ht * (0.04 + rand() * 0.05));
  B.seg('#5d3f2c', 0, -ht * 0.46, -rx * 0.5, cy - ry * 0.05, Math.max(1, tw * 0.45));
  B.seg('#5d3f2c', 0, -ht * 0.52, rx * 0.45, cy - ry * 0.3, Math.max(1, tw * 0.4));
  // 수관: 큰 잎 덩이 몇 개로 부피를 잡고, 그 위에 작은 잎 뭉치를 얹어 결을 낸다
  type Lobe = [number, number, number]; // x, y, 반지름 (설계 칸)
  const E = ([x, y, r]: Lobe, k = 0, shrink = 1, grow = 0): Ellipse =>
    [B.X(x + LX * r * k), B.Y(y + LY * r * k), r * 1.1 * s * shrink + grow, r * 0.9 * s * shrink + grow];
  const masses: Lobe[] = [[0, cy, rx * 0.5]];
  const m = 5 + Math.round(rx / 30);
  for (let i = 0; i < m; i++) {
    const a = Math.PI * 2 * (i + 0.3 + rand() * 0.4) / m, r = rx * (0.36 + rand() * 0.14), d = 0.86 + rand() * 0.14;
    masses.push([Math.cos(a) * (rx - r * 1.1) * d, cy + Math.sin(a) * (ry - r * 0.9) * d, r]);
  }
  // 바깥 테두리가 울퉁불퉁하도록 덩이 가장자리에 붙는 작은 덩이들
  const rim: Lobe[] = [];
  for (let i = 0; i < m * 2.4; i++) {
    const a = Math.PI * 2 * (i + rand() * 0.7) / (m * 2.4), r = rx * (0.15 + rand() * 0.12);
    rim.push([Math.cos(a) * (rx - r * 1.1) * (0.94 + rand() * 0.1), cy + Math.sin(a) * (ry - r * 0.9) * (0.94 + rand() * 0.1), r]);
  }
  const face = ([x, y]: Lobe) => LX * x / rx + LY * (y - cy) / ry;
  const order = [...masses, ...rim].sort((a, b) => face(a) - face(b));
  for (const l of order) lens(g, '#1b4527', E(l, 0, 1, 1));
  for (const l of order) {
    const f = face(l), body = E(l);
    lens(g, f < -0.3 ? '#1f4d2f' : '#25583a', body);
    lens(g, f < -0.3 ? '#2b6337' : '#33733e', body, E(l, 0.3));
    if (f > -0.35) lens(g, '#468f43', body, E(l, 0.6, 0.92));
    if (f > 0.3) lens(g, '#5fa64c', body, E(l, 0.82, 0.8));
  }
  // 잎 뭉치: 그 자리를 덮은 덩이 안에서 빛을 향한 쪽은 밝게, 등진 쪽은 어둡게
  const leaves = Math.round(rx * 0.9);
  for (let i = 0; i < leaves; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 0.86, x = Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry;
    let host: Lobe | null = null;
    for (const l of order) if (((x - l[0]) / (l[2] * 1.1)) ** 2 + ((y - l[1]) / (l[2] * 0.9)) ** 2 < 0.8) host = l;
    if (!host) continue;
    const f = (LX * (x - host[0]) + LY * (y - host[1])) / host[2] + face([x, y, 0]) * 0.5;
    const leaf: Lobe = [x, y, rx * (0.07 + rand() * 0.05)];
    if (f > 0.15) { lens(g, '#5fa64c', E(leaf)); lens(g, '#8cc962', E(leaf), E(leaf, 0.5)); if (f > 0.5) lens(g, '#b4e07e', E(leaf), E(leaf, 0.85, 0.7)); }
    else if (f > -0.5) { lens(g, '#33733e', E(leaf)); lens(g, '#468f43', E(leaf), E(leaf, 0.45)); }
    else { lens(g, '#1f4d2f', E(leaf)); lens(g, '#2b6337', E(leaf), E(leaf, 0.5)); }
  }
}

/**
 * 꿈속 퀴즈 5. 주말에 갑자기 시간이 빔 (고해상도): 햇살 좋은 공원.
 * 잔디가 시작되는 지평선은 예전 그림처럼 화면 높이의 48%. 산책길은 가운데 아래에서 시작해, 멀어질수록 오른쪽으로 굽어 언덕 밑으로 사라진다
 * (질문 창 위에 선 포켓몬들이 그 길 위에 선 것으로 보인다). 해는 오른쪽 위: 덩이마다 오른쪽 위가 밝고, 그림자는 왼쪽 아래로 눕는다.
 * 큰 나무 둘은 화면 양 끝, 벤치는 길 오른쪽, 가로등과 돗자리는 길 왼쪽 기준점에 붙어 있어서 화면이 넓어지면 사이가 벌어지고 나무가 더 선다.
 * 등장 포켓몬은 질문 창 위(가운데 아래)에 따로 서므로, 알아볼 것들은 하늘과 양옆, 지평선 근처에 둔다.
 */
export function quizWeekendHd(g: Ink, w: number, h: number) {
  const rand = seeded(5505);
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const cx = Math.round(w / 2), groundY = Math.round(h * 0.48);
  const half = w / 2 / s; // 설계 칸으로 잰 화면 반폭
  const top = -groundY / s; // 화면 위 끝 (지평선 기준 설계 칸)
  const G = brush(g, cx, groundY, s);
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh))); };

  // ── 하늘과 해 ──
  const sky = g.createLinearGradient(0, 0, 0, groundY);
  ['#3d95da', '#58aee8', '#86c8ef', '#bfe2f5', '#e6f5f3'].forEach((c, i, a) => sky.addColorStop(i / (a.length - 1), c));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, groundY + 1);
  const sunX = Math.round(cx + Math.min(w * 0.3, 262 * s)), sunY = Math.round(groundY - Math.min(groundY * 0.78, 205 * s));
  const S = brush(g, sunX, sunY, s);
  S.glow('#fffbe066', 0, 0, 180);
  S.glow('#fffce8c0', 0, 0, 46);
  S.oval('#fffbe430', 0, 0, 24, 24, (dx, dy) => dx * dx + dy * dy > 0.72);
  S.oval('#ffeeb0', 0, 0, 14.5, 14.5);
  S.oval('#fff8da', 0, 0, 12.5, 12.5);
  S.oval('#fffef4', 1.5, -1.5, 8, 8);

  // 뭉게구름: 해가 오른쪽에 있어서 오른쪽 위가 밝다
  const tones = ['#afcfe8', '#e3eff8', '#f6fafd', '#ffffff'];
  const far = ['#bcd9ec', '#e4f0f6', '#f2f7fa', '#fbfdfe'];
  const clouds: [number, number, number, number, number, string[]][] = [
    [-340, -168, 190, 30, 11, tones], [-96, -192, 130, 20, 23, tones], [-226, -116, 124, 13, 35, far], [178, -110, 104, 11, 47, far],
    [-640, -150, 170, 24, 59, tones], [440, -178, 176, 26, 71, tones], [620, -122, 130, 13, 83, far],
    [-80, -330, 160, 24, 91, tones], [70, -262, 110, 15, 97, tones],
  ];
  for (const [x, y, span, rise, seed, t] of clouds) {
    if (y - rise < top - 10) continue;
    const x0 = cx + x * s;
    if (x0 > w || x0 + span * s < 0) continue;
    cumulus(g, x0, groundY + y * s, Math.round(span * s), rise * s, seed, t, 1);
  }
  // 멀리 나는 새 셋
  for (const [x, y] of [[44, -150], [58, -158], [70, -144]]) {
    G.seg('#46627c', x - 3, y - 1.5, x, y, 1);
    G.seg('#46627c', x, y, x + 3, y - 2, 1);
  }

  // ── 연: 꼬리를 흔들며 왼쪽 아래 누군가의 손으로 줄이 내려간다 ──
  const kx = -Math.min(150, half - 70), ky = -150;
  const K = brush(g, G.X(kx), G.Y(ky), s);
  for (let x = 0; x < K.X(0); x++) {
    const t = x / Math.max(1, K.X(0));
    fill('#f7f3e690', x, K.Y(2) + (1 - t) * (groundY - K.Y(2)) * 0.55 - Math.sin(t * Math.PI) * 18 * s, 1, 1);
  }
  let tx = 0, ty = 14;
  for (let i = 1; i <= 36; i++) {
    const nx = -i * 0.45 + 3.5 * Math.sin(i / 5.5), ny = 14 + i * 0.95;
    K.seg('#6a5844', tx, ty, nx, ny, 1);
    if (i % 9 === 0) {
      const c = ['#e2474f', '#3f7fd0', '#ffd65a', '#e2474f'][i / 9 - 1];
      K.poly(c, [[nx, ny], [nx - 4, ny - 2.2], [nx - 4, ny + 2.2]]);
      K.poly(c, [[nx, ny], [nx + 4, ny - 2.2], [nx + 4, ny + 2.2]]);
    }
    tx = nx; ty = ny;
  }
  K.poly('#e2474f', [[0, -17], [0, -3], [-11.5, -3]]);
  K.poly('#ffd65a', [[0, -17], [11.5, -3], [0, -3]]);
  K.poly('#e0ac36', [[-11.5, -3], [0, -3], [0, 14]]);
  K.poly('#b83440', [[0, -3], [11.5, -3], [0, 14]]);
  K.poly('#ffffff40', [[0, -17], [11.5, -3], [8, -3], [0, -12]]);
  K.seg('#7a4a2a', 0, -16, 0, 13, 1);
  K.seg('#7a4a2a', -10.5, -3, 10.5, -3, 1);
  K.seg('#fff2bc', 0, -17, 11.5, -3, 1);

  // ── 먼 도시: 언덕 너머로 빌딩과 아파트가 옅게 보인다 (오른쪽 면이 볕을 받는다) ──
  for (let x = -half - 12; x < half + 12;) {
    const bw = 9 + Math.floor(rand() * 17), bh = 12 + rand() * 26 * (0.7 + 0.3 * Math.cos(x / 120)), y0 = -6 - bh;
    const tall = rand() > 0.85;
    const yt = tall ? y0 - 12 : y0;
    G.box('#a4c4da', x, yt, bw, -yt);
    G.box('#bdd7e7', x + bw - 3, yt, 3, -yt);
    G.box('#cfe3ee', x, yt, bw, 1);
    for (let yy = yt + 3; yy < -6; yy += 4) for (let xx = x + 2; xx < x + bw - 4; xx += 3) if (rand() > 0.35) G.box('#90b2cb', xx, yy, 1.2, 1.4);
    if (rand() > 0.8) { G.box('#a4c4da', x + bw * 0.5, yt - 7, 1, 7); }
    else if (rand() > 0.8) { G.box('#9ebfd5', x + 2, yt - 4, 6, 4); G.box('#c4dcea', x + 2, yt - 4, 6, 1); }
    x += bw + (rand() > 0.7 ? 5 : 1);
  }
  // 산 위의 전망 타워
  const tw = -Math.min(250, half - 40);
  G.ridge('#a5cdbf', tw - 80, tw + 80, (x) => -6 - 36 * Math.exp(-(((x - tw) / 36) ** 2)), () => 0);
  G.box('#98b9d0', tw - 1.2, -88, 2.4, 50);
  G.box('#b9d4e6', tw, -88, 1.2, 50);
  G.poly('#98b9d0', [[tw - 5, -78], [tw + 5, -78], [tw + 4, -72], [tw - 4, -72]]);
  G.box('#c9dff0', tw - 5, -78, 10, 1);
  G.box('#98b9d0', tw - 0.5, -104, 1, 16);
  G.box('#98b9d0', tw - 3, -46, 6, 8);
  const haze = g.createLinearGradient(0, groundY - 60 * s, 0, groundY);
  haze.addColorStop(0, '#e6f5f300'); haze.addColorStop(1, '#e6f5f3b0');
  g.fillStyle = haze;
  g.fillRect(0, groundY - 60 * s, w, 60 * s);

  // ── 언덕: 먼 언덕은 옅고, 가까운 언덕에는 나무가 줄지어 섰다 ──
  const hill = (base: number, amp: number, phase: number, color: string, lit: string) => {
    let prev = 0;
    for (let x = 0; x < w; x++) {
      const k = (x - cx) / s;
      const y = Math.round(groundY + (base - amp * (0.5 + 0.5 * Math.sin(k / 96 + phase) + 0.35 * Math.sin(k / 41 + phase * 2))) * s);
      fill(color, x, y, 1, groundY - y + 1);
      if (y <= prev) fill(lit, x, y, 1, y < prev ? u(2) : 1);
      prev = y;
    }
  };
  hill(-8, 12, 1.4, '#a9d69a', '#c4e6b2');
  hill(-1, 8, 4.2, '#8fca79', '#acdc92');
  for (let x = -half - 6; x < half + 6;) {
    const k = x, y = -1 - 8 * (0.5 + 0.5 * Math.sin(k / 96 + 4.2) + 0.35 * Math.sin(k / 41 + 8.4)) + 2, r = 2.5 + rand() * 2.5;
    if (Math.abs(x - 30) > 30 || rand() > 0.6) {
      G.oval('#5e9f58', x, y - r * 0.8, r * 1.1, r);
      G.oval('#7fbd68', x + r * 0.3, y - r * 1.15, r * 0.6, r * 0.5);
    }
    x += r * 1.6 + rand() * 6;
  }

  // ── 잔디밭: 깎은 줄무늬가 가까울수록 넓어진다 ──
  const lawn = g.createLinearGradient(0, groundY, 0, h);
  lawn.addColorStop(0, '#8fcd72'); lawn.addColorStop(0.35, '#77bf61'); lawn.addColorStop(1, '#5aa84b');
  g.fillStyle = lawn;
  g.fillRect(0, groundY + 1, w, h - groundY);
  for (let d = 2 * s, i = 0; groundY + d < h; i++) {
    const next = d * 1.32 + s;
    if (i % 2) fill('#ffffff14', 0, groundY + d, w, next - d);
    d = next;
  }
  for (let i = 0; i < w * 3.2; i++) {
    const y = groundY + 2 + rand() ** 1.25 * (h - groundY), v = (y - groundY) / (h - groundY);
    fill(['#5c9e4a', '#9ad67c', '#4d8f40', '#86c96c'][i % 4], rand() * w, y, Math.max(1, Math.round(v * 1.6 * s)), 1 + v * 5 * s);
  }

  // ── 산책길: 앞은 넓고 가운데, 멀어질수록 오른쪽으로 굽는다 ──
  const pathAt = (y: number) => { const d = (y - groundY) / s; return [cx + 30 * Math.exp(-d / 34) * s, (2 + 0.62 * d) * s]; };
  for (let y = groundY + 1; y < h; y++) {
    const [c, hw] = pathAt(y), a = Math.round(c - hw), b = Math.round(c + hw);
    // 가운데가 밟혀 밝고, 길섶 쪽으로 갈수록 흙이 짙다 (오른쪽이 한 톤 더 짙다)
    fill('#ddc795', a, y, b - a, 1);
    fill('#e4d0a0', c - hw * 0.78, y, hw * 1.42, 1);
    fill('#e9d8aa', c - hw * 0.5, y, hw * 0.8, 1);
    fill('#d4bc8a', c + hw * 0.64, y, hw * 0.36, 1);
    fill('#bea474', a, y, Math.max(1, hw * 0.035), 1);
    fill('#b99f6e', b - Math.max(1, Math.round(hw * 0.035)), y, Math.max(1, hw * 0.035), 1);
  }
  for (let i = 0; i < w * 1.6; i++) {
    const y = groundY + 2 + rand() ** 0.9 * (h - groundY - 2), [c, hw] = pathAt(y), v = (y - groundY) / (h - groundY);
    const x = c + (rand() * 2 - 1) * hw * 0.96, r = Math.max(1, Math.round(v * 2.4 * s));
    if (i % 3) fill(i % 2 ? '#c4aa7a' : '#cfb688', x, y, r, Math.max(1, r * 0.6));
    else { fill('#a88f62', x + 1, y + 1, r, Math.max(1, r * 0.6)); fill('#f6ead0', x, y, r, Math.max(1, r * 0.6)); }
  }
  // 길섶의 풀: 가장자리를 덮는다
  for (let y = groundY + 2; y < h; y += Math.max(1, Math.round(1 + (y - groundY) / (h - groundY) * 3 * s))) {
    const [c, hw] = pathAt(y), v = (y - groundY) / (h - groundY);
    for (const e of [c - hw, c + hw]) if (rand() > 0.35) fill(rand() > 0.5 ? '#6fb35c' : '#4f9442', e - (1 + v * 4 * s) * rand(), y - v * 3 * s, 1 + v * 2 * s, 1 + v * 5 * s);
  }

  // ── 꽃: 멀리는 점, 가까이는 꽃잎과 꽃술 ──
  const flower = (x: number, y: number, c: string) => {
    const v = (y - groundY) / (h - groundY), [pc, ph] = pathAt(y);
    if (Math.abs(x - pc) < ph + 3) return;
    const r = Math.max(1, Math.round(v * 3 * s));
    if (r < 2) { fill(c, x, y, 1, 1); return; }
    fill('#4d8f40', x, y + r, 1, r * 1.5);
    fill(c, x - r, y, r * 3, r); fill(c, x, y - r, r, r * 3);
    fill('#f6c640', x, y, r, r);
  };
  for (let i = 0; i < w / 5; i++) flower(rand() * w, groundY + 3 + rand() ** 1.6 * (h - groundY), ['#ffe25a', '#ffffff', '#f48ab4', '#fff4a8'][i % 4]);

  // ── 지평선 근처의 작은 나무들 ──
  const distant: [number, number, number][] = [[-Math.min(232, half - 30), 6, 42], [Math.min(232, half - 30) - 6, 5, 38]];
  if (half > 420) distant.push([-half + 120, 8, 50], [half - 150, 7, 46], [-half * 0.62, 4, 34], [half * 0.58, 4, 30]);
  for (const [x, y, ht] of distant) if (Math.abs(x) < half - 40) broadleaf(g, brush(g, G.X(x), G.Y(y), s), ht, ht * 0.4, 300 + ht);

  // ── 돗자리: 바구니와 몬스터볼 ──
  if (half > 300) {
    const P = brush(g, G.X(-Math.min(262, half - 150)), G.Y(15), s);
    P.oval('#2c6a3140', -2, 4, 22, 3);
    const quad = (r0: number, r1: number, c0: number, c1: number): Point[] => {
      const at = (r: number, c: number): Point => { const y = -4 + r * 8, wd = 15 + r * 4; return [-wd + c * wd * 2, y]; };
      return [at(r0, c0), at(r0, c1), at(r1, c1), at(r1, c0)];
    };
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) P.poly((r + c) % 2 ? '#d9474f' : '#f6efe4', quad(r / 3, (r + 1) / 3, c / 6, (c + 1) / 6));
    P.box('#a8343e', -19, 4, 38, 1);
    P.box('#9a6834', -12, -6, 9, 5);
    P.box('#c4884a', -12, -7, 9, 1.4);
    for (let x = -11; x < -3; x += 2) P.box('#ad7740', x, -5, 1, 3);
    P.seg('#8a5a30', -11, -7, -9, -10.5, 1); P.seg('#8a5a30', -9, -10.5, -6, -10.5, 1); P.seg('#8a5a30', -6, -10.5, -4, -7, 1);
    P.box('#e8d6a8', -10, -8.4, 4, 1.4);
    P.oval('#f4f1ea', 8, 0, 2.6, 2.6);
    P.oval('#e04848', 8, 0, 2.6, 2.6, (_dx, dy) => dy < -0.1);
    P.box('#2a2a30', 5.4, -0.4, 5.2, 0.8);
    P.box('#ffffff', 7.5, -0.5, 1, 1);
  }

  // ── 가로등: 낮이라 꺼져 있다 ──
  if (half > 240) {
    const P = brush(g, G.X(-Math.min(190, half - 92)), G.Y(20), s);
    P.oval('#2c6a3150', -16, 1, 17, 1.8);
    P.box('#2c4238', -3.5, -4, 7, 5); P.box('#4f6a5c', -3.5, -4, 7, 1); P.box('#5f7d6c', 2.5, -4, 1, 5);
    P.box('#2c4238', -1.3, -50, 2.6, 46); P.box('#6f8f7d', 0.4, -50, 0.9, 46);
    for (const y of [-34, -12]) { P.box('#2c4238', -2.2, y, 4.4, 2); P.box('#6f8f7d', 1.2, y, 1, 2); }
    P.box('#2c4238', -2.2, -52, 4.4, 2.4);
    P.poly('#2c4238', [[-5.5, -61], [5.5, -61], [3.6, -52], [-3.6, -52]]);
    P.poly('#e4e6d0', [[-4.2, -60], [4.2, -60], [2.8, -53], [-2.8, -53]]);
    P.poly('#ffffffa0', [[1.6, -60], [4.2, -60], [2.8, -53], [1.2, -53]]);
    P.box('#2c4238', -0.5, -60, 1, 7);
    P.poly('#2c4238', [[-7, -61], [7, -61], [0, -67]]);
    P.seg('#5f7d6c', 0, -67, 7, -61, 1);
    P.oval('#2c4238', 0, -68, 1.2, 1.2);
  }

  // ── 벤치: 앉는 판 위에 읽다 둔 책과 커피 ──
  const Bn = brush(g, G.X(Math.min(120, half - 100)), G.Y(26), s);
  Bn.oval('#2c6a3150', -8, 0.5, 30, 2.6);
  for (const x of [-21, 18]) {
    Bn.box('#2f3238', x - 1, -10, 2, 10);
    Bn.box('#3c4048', x + 1, -10, 2.6, 10); Bn.box('#6a717d', x + 2.6, -10, 1, 10);
    Bn.box('#3c4048', x - 0.5, -20, 2.4, 10);
    Bn.seg('#3c4048', x - 1, -14, x + 3, -12, 1);
  }
  Bn.box('#a86a3a', -23, -20, 46, 2.6); Bn.box('#d6955a', -23, -20, 46, 0.9); Bn.box('#7d4a28', -23, -17.6, 46, 0.6);
  Bn.box('#a86a3a', -23, -16.2, 46, 2.6); Bn.box('#d6955a', -23, -16.2, 46, 0.9); Bn.box('#7d4a28', -23, -13.8, 46, 0.6);
  Bn.poly('#c8844a', [[-22, -12.6], [22, -12.6], [24, -10], [-24, -10]]);
  Bn.box('#e2a468', -22, -12.6, 44, 0.8);
  Bn.box('#8a5530', -24, -10, 48, 1.8);
  Bn.box('#6a3f22', -24, -8.4, 48, 0.6);
  Bn.box('#2c5aa0', -14, -14, 8, 1.8); Bn.box('#f3eedf', -14, -12.4, 8, 0.6); Bn.box('#4f7fc4', -14, -14, 8, 0.6);
  Bn.box('#f4f1ea', 9, -16.4, 3, 4); Bn.box('#8a5a36', 9, -15, 3, 1.4); Bn.box('#ffffff', 8.6, -16.8, 3.8, 0.8);

  // ── 양 끝의 큰 나무: 화면 가장자리에 붙는다 ──
  if (half > 560) {
    broadleaf(g, brush(g, G.X(-half + 250), G.Y(16), s), 104, 46, 41);
    broadleaf(g, brush(g, G.X(half - 270), G.Y(18), s), 110, 48, 43);
  }
  broadleaf(g, brush(g, Math.round(54 * s), G.Y(44), s), 176, 74, 17);
  broadleaf(g, brush(g, Math.round(w - 66 * s), G.Y(36), s), 196, 82, 29);

  vignette(g, w, h, '#1d3a4a', 0.22);
}
