import { type Ink, pixelText, seeded } from './pixels';
import { type Brush, brush, vignette } from './hd';

/** 계산대 표시창 숫자 (3×5) */
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
};

/** 칠판 메뉴: 분류와 그 아래 세 줄 (이름, 값) */
const MENU: [string, [string, string][]][] = [
  ['커피', [['아메리카노', '3.0'], ['카페라떼', '3.5'], ['바닐라라떼', '4.0']]],
  ['음료', [['레몬에이드', '4.0'], ['복숭아티', '3.5'], ['튼튼밀크', '3.0']]],
  ['디저트', [['치즈케이크', '5.0'], ['크루아상', '3.0'], ['초코쿠키', '2.0']]],
];

/**
 * 4. 아르바이트 · 화난 손님 (고해상도): 손님 쪽에서 본 카페 카운터.
 * 카운터 윗면은 예전 그림처럼 화면 높이의 50%에 있고, 그 아래로 나무 앞판과 타일 바닥이 이어진다 (손님 포켓몬이 그 앞에 선다).
 * 칠판 · 조명은 가운데 위, 계산대는 왼쪽, 커피 머신은 오른쪽 기준점에 붙어 있어서 화면이 넓어지면 사이가 벌어지고 소품이 더 놓인다.
 */
export function quizCounterHd(g: Ink, w: number, h: number) {
  const rand = seeded(5404);
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };
  const cx = Math.round(w / 2), counterY = Math.round(h * 0.5), floorY = counterY + Math.round(104 * s);
  const half = w / 2 / s; // 설계 칸으로 잰 화면 반폭
  const lift = Math.round(Math.max(0, counterY - 240 * s) * 0.45); // 세로로 긴 화면: 칠판과 조명을 조금 올려 단다
  const C = brush(g, cx, counterY, s);
  const B = brush(g, cx, counterY - lift, s);
  const cols = half >= 250 ? 3 : 2;
  const boardHalf = cols * 55 + 6;
  const lampX = boardHalf + 42;
  const off = Math.min(half * 0.6, 270); // 계산대 · 머신이 가운데에서 떨어진 거리
  const lamps = [-lampX, lampX];
  if (half > lampX + 230) lamps.push(-lampX - 200, lampX + 200);

  // ── 벽: 회반죽 ──
  const wall = g.createLinearGradient(0, 0, 0, counterY);
  wall.addColorStop(0, '#b3a48a');
  wall.addColorStop(0.3, '#d3c7b0');
  wall.addColorStop(1, '#cbbda4');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, counterY);
  for (let i = 0; i < w * 0.7; i++) fill(i % 2 ? '#fff8e812' : '#6a503012', rand() * w, rand() * counterY, (3 + rand() * 12) * s, 1);

  // ── 벽 아래쪽: 엇갈려 붙인 타일 ──
  const tw = u(24), th = u(12), tileTop = counterY - th * 10;
  fill('#c4b7a0', 0, tileTop, w, counterY - tileTop);
  for (let y = tileTop, row = 0; y < counterY; y += th, row++) {
    for (let x = (cx % tw) - tw - (row % 2 ? tw >> 1 : 0); x < w; x += tw) {
      const t = rand();
      fill(t > 0.86 ? '#e0d6c2' : t < 0.12 ? '#f1eadc' : '#eae2d2', x + 1, y + 1, tw - 1, th - 1);
      fill('#f9f4ea', x + 1, y + 1, tw - 1, 1);
      fill('#d7cdb9', x + 1, y + th - 1, tw - 1, 1);
    }
  }
  fill('#8a6a4a', 0, tileTop - u(4), w, u(4));
  fill('#b48e66', 0, tileTop - u(4), w, 1);
  fill('#5a4030', 0, tileTop - 1, w, 1);

  // 조명이 벽과 타일에 떨어뜨린 빛
  const drop = lift / s;
  for (const x of lamps) {
    B.glow('#fff0c066', x, -164, 120);
    B.poly('#fff0c010', [[x - 16, -172], [x + 16, -172], [x + 92, drop], [x - 92, drop]]);
    B.poly('#fff0c010', [[x - 12, -172], [x + 12, -172], [x + 56, drop], [x - 56, drop]]);
  }

  // ── 칠판 메뉴 ──
  const bt = -234, bh = 100, bw = boardHalf * 2;
  B.box('#3a2a1a24', -boardHalf + 4, bt + 6, bw, bh);
  B.box('#6a4a32', -boardHalf, bt, bw, bh);
  B.box('#93704c', -boardHalf, bt, bw, 2);
  B.box('#93704c', -boardHalf, bt, 2, bh);
  B.box('#4a3222', -boardHalf, bt + bh - 2, bw, 2);
  B.box('#4a3222', boardHalf - 2, bt, 2, bh);
  const ix = -boardHalf + 6, iy = bt + 6, iw = bw - 12, ih = bh - 12;
  B.box('#2c302c', ix, iy, iw, ih);
  B.box('#1c1f1c', ix, iy, iw, 1);
  B.box('#1c1f1c', ix, iy, 1, ih);
  for (let i = 0; i < 12; i++) B.box(i % 2 ? '#ffffff07' : '#ffffff0b', ix + 2 + rand() * (iw - 60), iy + 2 + rand() * (ih - 10), 20 + rand() * 36, 2 + rand() * 5); // 지우개 자국
  // 글씨는 캔버스 픽셀에 맞춰 쓴다 (글꼴 한 칸 = 한 픽셀)
  const px0 = B.X(ix), py0 = B.Y(iy), pw = B.X(ix + iw) - px0, ph = B.Y(iy + ih) - py0;
  const colW = Math.floor((pw - 6) / cols), pitch = (ph - 6) / 4;
  g.font = '12px Galmuri11, sans-serif';
  const chalk = (text: string, x: number, y: number, color: string, right = false) => {
    const span = Math.ceil(g.measureText(text).width) - 1;
    pixelText(g, text, right ? x - span / 2 : x + span / 2, y, color);
    return span;
  };
  for (let c = 0; c < cols; c++) {
    const [title, rows] = MENU[c];
    const x0 = px0 + 3 + c * colW + 5, x1 = x0 + colW - 10, ty = Math.round(py0 + 3 + pitch * 0.5);
    if (c) for (let y = py0 + 6; y < py0 + ph - 6; y += 3) fill('#d8d4c450', x0 - 6, y, 1, 2);
    // 분필로 그린 잔
    fill('#f2ead8', x0, ty - 2, 8, 5); fill('#f2ead8', x0 + 1, ty + 3, 6, 1);
    fill('#2c302c', x0 + 1, ty - 1, 6, 1);
    fill('#f2ead8', x0 + 8, ty - 1, 2, 1); fill('#f2ead8', x0 + 9, ty, 1, 2); fill('#f2ead8', x0 + 8, ty + 1, 1, 1);
    fill('#f2ead890', x0 + 2, ty - 6, 1, 3); fill('#f2ead890', x0 + 5, ty - 7, 1, 3);
    chalk(title, x0 + 14, ty, '#f2ead8');
    fill('#d8d4c4a0', x0, ty + 8, colW - 10, 1);
    rows.forEach(([name, price], r) => {
      const y = Math.round(py0 + 3 + pitch * (r + 1.5));
      const a = chalk(name, x0, y, '#d8d4c4'), b = chalk(price, x1, y, '#f2c84a', true);
      for (let x = x0 + a + 4; x < x1 - b - 3; x += 3) fill('#d8d4c466', x, y + 4, 1, 1);
    });
  }
  // 분필 받침
  B.box('#5a3f2a', -boardHalf + 12, bt + bh, bw - 24, 3);
  B.box('#8a6a4a', -boardHalf + 12, bt + bh, bw - 24, 1);
  B.box('#f4f0e6', -boardHalf + 30, bt + bh - 2, 8, 2);
  B.box('#f2c84a', -boardHalf + 42, bt + bh - 2, 6, 2);
  B.box('#e89aa8', -boardHalf + 51, bt + bh - 2, 5, 2);
  B.box('#8a6a4a', boardHalf - 46, bt + bh - 5, 18, 3);
  B.box('#3a3a3a', boardHalf - 46, bt + bh - 2, 18, 2);

  // ── 벽시계와 액자: 넓은 화면이면 칠판 양옆, 세로로 긴 화면이면 칠판 아래 빈 벽에 ──
  const decor = (P: Brush, kx: number, fx: number, y: number) => {
    P.oval('#3a2a1a24', kx + 3, y + 4, 19, 19);
    P.oval('#4a3a30', kx, y, 19, 19);
    P.oval('#6a5444', kx, y, 19, 19, (dx, dy) => dx + dy < -0.9);
    P.oval('#f2ead8', kx, y, 15.5, 15.5);
    P.oval('#dcd2bc', kx, y, 15.5, 15.5, (dx, dy) => dx + dy > 1);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) P.box('#4a3a30', kx + dx * 12.5 - 1, y + dy * 12.5 - 1, 2, 2);
    P.seg('#2a2a2a', kx, y, kx + 6, y - 5, 2);
    P.seg('#2a2a2a', kx, y, kx - 3, y + 11, 1);
    P.oval('#b84a40', kx, y, 1.6, 1.6);
    // 액자: 김이 오르는 잔 그림
    const t = y - 30;
    P.box('#3a2a1a24', fx - 20, t + 4, 46, 60);
    P.box('#6a4a32', fx - 23, t, 46, 60);
    P.box('#93704c', fx - 23, t, 46, 2);
    P.box('#93704c', fx - 23, t, 2, 60);
    P.box('#efe6d0', fx - 19, t + 4, 38, 52);
    P.box('#d8c8a8', fx - 15, t + 8, 30, 44);
    P.poly('#8a5a3a', [[fx - 9, t + 30], [fx + 7, t + 30], [fx + 5, t + 44], [fx - 7, t + 44]]);
    P.box('#6a4028', fx - 8, t + 30, 14, 2);
    P.box('#8a5a3a', fx + 7, t + 32, 4, 2); P.box('#8a5a3a', fx + 10, t + 32, 2, 8); P.box('#8a5a3a', fx + 6, t + 38, 5, 2);
    P.box('#6a4028', fx - 12, t + 45, 22, 2);
    for (const dx of [-5, 0, 5]) { P.box('#a88a6a', fx + dx - 1, t + 20, 1, 6); P.box('#a88a6a', fx + dx, t + 15, 1, 5); }
  };
  if (half >= lampX + 120) decor(B, -lampX - 78, lampX + 78, -186);
  else if (drop >= 64) decor(C, -Math.min(76, half - 30), Math.min(76, half - 32), (bt + bh + 4 - drop - 124) / 2);

  // ── 펜던트 조명 ──
  for (const x of lamps) {
    fill('#3a2e28', B.X(x) - (u(2) >> 1), 0, u(2) > 1 ? 2 : 1, B.Y(-200));
    B.box('#2a332c', x - 3, -201, 6, 6);
    B.poly('#3a4a3a', [[x - 5, -195], [x + 5, -195], [x + 19, -175], [x - 19, -175]]);
    B.poly('#52685a', [[x - 5, -195], [x - 1, -195], [x - 9, -175], [x - 19, -175]]);
    B.poly('#2e3c30', [[x + 2, -195], [x + 5, -195], [x + 19, -175], [x + 11, -175]]);
    B.box('#26322a', x - 19, -175, 38, 3);
    B.box('#7a947c', x - 19, -175, 38, 1);
    B.box('#fff3c8', x - 13, -172, 26, 2);
    B.oval('#fffbe6', x, -170, 5, 4);
    B.glow('#fff6d8b0', x, -168, 18);
  }

  // ── 선반: 잔 · 원두 병 · 시럽 · 화분 ──
  const shelfY = C.Y(-88), shelfT = u(5);
  fill('#4a36222e', 0, shelfY + shelfT, w, u(5));
  fill('#7a5a3e', 0, shelfY, w, shelfT);
  fill('#aa8862', 0, shelfY, w, 1);
  fill('#553b27', 0, shelfY + shelfT - 1, w, 1);
  for (let x = -Math.ceil(half / 124) * 124 + 62; x < half; x += 124) {
    C.box('#3a2e28', x, -83, 3, 15);
    C.poly('#3a2e28', [[x + 3, -83], [x + 15, -83], [x + 3, -71]]);
    C.box('#5c4c42', x, -83, 1, 15);
  }
  const mug = (x: number, y: number, band: string | null) => {
    C.poly('#f4f0e6', [[x, y - 8], [x + 11, y - 8], [x + 10, y], [x + 1, y]]);
    C.box('#ffffff', x, y - 8, 11, 1);
    C.box('#d2cabb', x + 8, y - 7, 2, 7);
    if (band) C.box(band, x + 1, y - 5, 9, 2);
    C.box('#e0d9cb', x + 11, y - 6, 3, 1); C.box('#e0d9cb', x + 13, y - 6, 1, 4); C.box('#e0d9cb', x + 11, y - 3, 3, 1);
  };
  const shelfItem = (kind: number, x: number): number => {
    const y = -88;
    if (kind <= 1) { // 포개 쌓은 머그잔
      const n = 2 + (kind ? 1 : 0), band = [null, '#b0704a', '#6a8a8a'][Math.floor(rand() * 3)];
      for (let k = 0; k < n; k++) mug(x, y - k * 6, band);
      return 15;
    }
    if (kind === 2) { // 원두 병
      C.box('#d5dcd2', x, y - 19, 13, 19);
      C.box('#7a4e32', x, y - 14, 13, 14);
      for (let i = 0; i < 9; i++) C.box(i % 2 ? '#5a3620' : '#9c6a46', x + 1 + rand() * 10, y - 13 + rand() * 11, 2, 1);
      C.box('#ffffff70', x + 1, y - 18, 1, 16);
      C.box('#5a362080', x + 11, y - 18, 2, 18);
      C.box('#efe6d0', x + 3, y - 10, 7, 5); C.box('#8a5a3a', x + 4, y - 8, 5, 1);
      C.box('#d8c8a8', x - 1, y - 22, 15, 3); C.box('#f0e2c4', x - 1, y - 22, 15, 1);
      return 16;
    }
    if (kind === 3) { // 시럽 병 셋
      ['#b8703a', '#5a7a4a', '#a84a3a'].forEach((c, i) => {
        const bx = x + i * 9;
        C.box(c, bx, y - 15, 7, 15);
        C.box(c, bx + 2, y - 21, 3, 6);
        C.box('#2a2a2a', bx + 2, y - 23, 3, 2);
        C.box('#ffffff50', bx + 1, y - 14, 1, 12);
        C.box('#00000030', bx + 5, y - 15, 2, 15);
        C.box('#efe6d0', bx + 1, y - 10, 5, 5);
      });
      return 26;
    }
    if (kind === 4) { // 늘어지는 화분
      C.seg('#5a7a4a', x + 10, y - 8, x + 15, y + 12, 1);
      for (const [dx, dy] of [[12, 0], [14, 6], [15, 12]]) C.oval('#6c8c56', x + dx, y + dy, 2.4, 1.6);
      C.oval('#4c6a40', x + 6, y - 14, 8, 6);
      C.oval('#5a7a4a', x + 2, y - 15, 5, 4);
      C.oval('#7a9a5a', x + 5, y - 17, 4, 3);
      C.oval('#7a9a5a', x + 11, y - 13, 3, 2);
      C.poly('#b0704a', [[x, y - 9], [x + 12, y - 9], [x + 10, y], [x + 2, y]]);
      C.box('#c88a5a', x - 1, y - 11, 14, 3);
      C.box('#8a5236', x + 8, y - 8, 2, 8);
      return 18;
    }
    if (kind === 5) { // 찻통
      C.box('#6a8a8a', x, y - 16, 12, 16);
      C.box('#a8c4be', x + 1, y - 16, 1, 16);
      C.box('#4e6c6c', x + 10, y - 16, 2, 16);
      C.box('#efe6d0', x + 2, y - 11, 8, 6);
      C.box('#8aa8a4', x - 1, y - 19, 14, 3); C.box('#b8d2cc', x - 1, y - 19, 14, 1);
      return 15;
    }
    // 엎어 쌓은 종이컵
    C.poly('#f4f0e6', [[x + 2, y - 22], [x + 9, y - 22], [x + 11, y], [x, y]]);
    C.poly('#d2cabb', [[x + 7, y - 22], [x + 9, y - 22], [x + 11, y], [x + 8, y]]);
    for (let k = 4; k < 22; k += 4) C.box('#c8c0b0', x + 1, y - k, 9, 1);
    return 14;
  };
  for (let x = -half + 6 + rand() * 8; x < half - 26;) x += shelfItem(Math.floor(rand() * 7), x) + 5 + rand() * 9;

  // ── 바닥: 두 빛깔 타일이 카운터 가운데 뒤의 소실점으로 모인다 ──
  fill('#a4845f', 0, floorY, w, h - floorY);
  const vp = floorY - 60 * s;
  for (let row = 0, y0 = floorY; y0 < h; row++) {
    const y1 = Math.round(vp + (y0 - vp) * 1.42), k0 = (y0 - vp) / (60 * s), k1 = (y1 - vp) / (60 * s);
    const n = Math.ceil(w / 2 / (46 * s * k0)) + 1;
    for (let i = -n; i < n; i++) {
      if ((i + row) & 1) continue;
      const a = i * 46 * s, b = (i + 1) * 46 * s;
      const F = brush(g, cx, 0, 1);
      F.poly('#b3946e', [[a * k0, y0], [b * k0, y0], [b * k1, y1], [a * k1, y1]]);
    }
    y0 = y1;
  }
  const under = g.createLinearGradient(0, floorY, 0, floorY + u(22));
  under.addColorStop(0, '#2a1c1470'); under.addColorStop(1, '#2a1c1400');
  g.fillStyle = under; g.fillRect(0, floorY, w, u(22));

  // ── 카운터: 윗면 · 모서리 · 세로 널 앞판 ──
  const top = u(8), edge = u(6), frontTop = counterY + top + edge, frontH = floorY - frontTop;
  fill('#8a5a3a', 0, frontTop, w, frontH);
  const plank = u(30);
  for (let x = (cx % plank) - plank; x < w; x += plank) {
    const t = rand();
    fill(t > 0.62 ? '#905f3d' : t < 0.3 ? '#845535' : '#8a5a3a', x, frontTop, plank, frontH);
    for (let i = 0; i < 3; i++) fill('#7a4e3290', x + 3 + rand() * (plank - 6), frontTop + rand() * frontH * 0.75, 1, (10 + rand() * 28) * s);
    fill('#9e6c48', x + 1, frontTop, 1, frontH);
    fill('#683f27', x, frontTop, 1, frontH);
  }
  for (const x of lamps) C.glow('#ffd89a26', x, 26, 120);
  const lipShade = g.createLinearGradient(0, frontTop, 0, frontTop + u(16));
  lipShade.addColorStop(0, '#3a200e80'); lipShade.addColorStop(1, '#3a200e00');
  g.fillStyle = lipShade; g.fillRect(0, frontTop, w, u(16));
  const low = g.createLinearGradient(0, frontTop, 0, floorY);
  low.addColorStop(0, '#2a160a00'); low.addColorStop(1, '#2a160a48');
  g.fillStyle = low; g.fillRect(0, frontTop, w, frontH);
  fill('#4a3222', 0, floorY - u(10), w, u(10));
  fill('#6e4e36', 0, floorY - u(10), w, 1);
  fill('#2a1c14', 0, floorY - 1, w, 1);
  fill('#d8b080', 0, counterY, w, top);
  for (let i = 0; i < w / 14; i++) fill('#c69c6c', rand() * w, counterY + 1 + Math.floor(rand() * (top - 1)), (16 + rand() * 60) * s, 1);
  fill('#f4d6a8', 0, counterY, w, 1);
  fill('#b68858', 0, counterY + top, w, edge);
  fill('#ecc898', 0, counterY + top, w, 1);
  fill('#5e3922', 0, frontTop - 1, w, 1);

  // ── 계산대 (왼쪽) ──
  const L = brush(g, C.X(-off), counterY + u(3), s);
  L.oval('#5a361f55', 2, 0, 32, 3);
  L.box('#2c3038', -26, -12, 52, 12);
  L.box('#4c525e', -26, -12, 52, 1);
  L.box('#1c1f26', -26, -2, 52, 2);
  L.box('#1c1f26', -22, -8, 44, 1);
  L.box('#8a909a', -4, -6, 8, 2);
  L.box('#3a3e48', -22, -34, 44, 22);
  L.poly('#4c525e', [[-22, -34], [22, -34], [18, -40], [-18, -40]]);
  L.box('#5a606c', -22, -34, 1, 22);
  L.box('#2a2d36', 20, -34, 2, 22);
  L.box('#20242a', -18, -32, 36, 11);
  L.box('#8ac89a', -16, -30, 32, 8);
  L.box('#b4e0bc', -16, -30, 32, 1);
  let tx = L.X(15) - 16;
  for (const ch of '4500') {
    g.fillStyle = '#2f5c44';
    DIGITS[ch].forEach((bits, r) => [...bits].forEach((b, c) => { if (b === '1') g.fillRect(tx + c, L.Y(-28) + r, 1, 1); }));
    tx += 4;
  }
  for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) L.box(k === 5 ? (r ? '#6ab06a' : '#c85a4a') : '#c8ccd2', -17 + k * 6, -19 + r * 3.5, 4, 2);
  // 손님 쪽 표시창
  L.box('#2a2e36', 11, -52, 3, 12);
  L.box('#20242a', 1, -63, 23, 12);
  L.box('#3c424e', 1, -63, 23, 1);
  L.box('#6ad0a0', 3, -61, 19, 8);
  L.box('#a8ecc8', 3, -61, 19, 1);
  L.box('#2a6a50', 6, -58, 5, 1); L.box('#2a6a50', 13, -58, 6, 1); L.box('#2a6a50', 6, -56, 9, 1);
  // 영수증
  L.box('#20242a', -18, -42, 13, 2);
  L.poly('#f4f0e6', [[-16, -42], [-7, -42], [-6, -55], [-15, -56]]);
  L.box('#b8b0a0', -14, -53, 5, 1); L.box('#b8b0a0', -14, -50, 4, 1); L.box('#b8b0a0', -14, -47, 6, 1);
  L.glow('#8ac89a2c', 2, -40, 34);
  // 팁 병
  L.oval('#5a361f44', 48, 0, 11, 2);
  L.box('#c8e4ec66', 39, -20, 16, 20);
  L.box('#eef8fab0', 39, -20, 1, 20);
  L.box('#8eaab480', 54, -20, 1, 20);
  L.box('#8eaab470', 39, -1, 16, 1);
  L.box('#e4f2f6', 38, -22, 18, 2);
  L.poly('#6ab06a', [[47, -5], [52, -5], [53, -15], [48, -14]]);
  L.box('#8cd08c', 48, -14, 1, 9);
  L.oval('#d8a83a', 44, -2.5, 4, 1.6); L.oval('#f2c84a', 50, -3.5, 4, 1.6); L.oval('#f6dc7a', 45, -5.5, 3.5, 1.4);
  L.box('#ffffffa0', 41, -18, 1, 12);
  // 호출 종
  L.oval('#5a361f44', 74, 0, 11, 2);
  L.oval('#d8b060', 73, -3, 8, 7.5, (_dx, dy) => dy < 0);
  L.oval('#b08a3c', 73, -3, 8, 7.5, (dx, dy) => dy < 0 && dx > 0.45);
  L.oval('#f8e6b0', 70, -7, 2.6, 1.6);
  L.box('#8a6a30', 72, -13, 2, 3);
  L.box('#3a2a22', 64, -3, 18, 3);
  L.box('#6a4a3a', 64, -3, 18, 1);
  // 케이크 진열 (자리가 있으면)
  if (half - off >= 100) {
    L.oval('#5a361f44', -72, 0, 20, 2);
    L.box('#d8d0c0', -75, -6, 6, 6);
    L.box('#c8c0b0', -80, -1, 16, 1);
    L.box('#eee8da', -93, -8, 42, 2);
    L.box('#ffffff', -93, -8, 42, 1);
    L.box('#f4e6c8', -85, -21, 26, 13);
    L.box('#c88a5a', -85, -15, 26, 2);
    L.box('#e2cfa8', -63, -21, 4, 13);
    L.box('#fff8ec', -85, -22, 26, 3);
    for (const x of [-81, -72, -63]) { L.oval('#d85a5a', x, -24, 2.2, 2.2); L.box('#f6a0a0', x - 1, -25, 1, 1); }
    L.oval('#e8f6f62c', -72, -8, 20, 27, (_dx, dy) => dy < 0);
    L.oval('#ffffff66', -72, -8, 20, 27, (dx, dy) => dy < 0 && dx * dx + dy * dy > 0.88);
    L.oval('#ffffff80', -72, -8, 20, 27, (dx, dy) => dy < -0.2 && dx < -0.3 && dx * dx + dy * dy > 0.5 && dx * dx + dy * dy < 0.62);
    L.oval('#e8f4f4', -72, -37, 2.6, 2.6);
  }

  // ── 커피 머신 (오른쪽) ──
  const R = brush(g, C.X(off), counterY + u(3), s);
  const steam = (bx: number, by: number, len: number, phase: number) => {
    const n = Math.round(len * s);
    for (let i = 0; i < n; i++) {
      const t = i / s, a = Math.round(0x60 * (1 - i / n) * Math.min(1, i / 4)).toString(16).padStart(2, '0');
      fill('#ffffff' + a, R.X(bx + Math.sin(t / 5 + phase) * (1.5 + t / 9)), R.Y(by) - i, u(2), 1);
    }
  };
  R.oval('#5a361f55', 2, 0, 52, 3);
  for (const x of [-40, 34]) R.box('#2a2a2a', x, -4, 6, 4);
  R.box('#343a40', -38, -38, 76, 28);
  R.box('#20242a', -38, -38, 76, 5);
  R.box('#5a6268', -43, -11, 86, 7);
  R.box('#8a9298', -43, -11, 86, 1);
  R.box('#3a4046', -43, -5, 86, 1);
  for (let x = -38; x < 40; x += 5) R.box('#3a4046', x, -9, 2, 3);
  R.box('#8a9298', -44, -38, 7, 27); R.box('#b4bcc4', -44, -38, 2, 27);
  R.box('#7c848c', 37, -38, 7, 27); R.box('#646c74', 42, -38, 2, 27);
  R.box('#9aa2aa', -46, -62, 92, 24);
  R.box('#c8d0d6', -46, -62, 92, 3);
  R.box('#b4bcc4', -46, -59, 2, 21);
  R.box('#7c848c', 43, -59, 3, 21);
  R.box('#6c747c', -46, -40, 92, 2);
  R.box('#aab2ba', -40, -45, 80, 1);
  // 명판 · 압력계 · 단추
  R.box('#b84a40', -10, -55, 20, 7);
  R.box('#d8726a', -10, -55, 20, 1);
  R.box('#f2ead8', -6, -52, 12, 1);
  R.oval('#5a6268', 30, -51, 6.5, 6.5);
  R.oval('#f4f0e6', 30, -51, 5, 5);
  R.seg('#b84a40', 30, -51, 33, -54, 1);
  R.glow('#f2a04a50', -36, -51, 9);
  for (let k = 0; k < 3; k++) R.box(k ? '#5a6268' : '#f2a04a', -38 + k * 7, -53, 4, 4);
  // 추출구 둘: 잔에 커피가 떨어지는 중
  for (const x of [-18, 14]) {
    R.box('#6c747c', x - 8, -38, 16, 6);
    R.box('#9aa2aa', x - 8, -38, 16, 1);
    R.box('#2a2a2a', x - 7, -32, 14, 3);
    R.box('#2a2a2a', x - 3, -29, 2, 3); R.box('#2a2a2a', x + 1, -29, 2, 3);
    R.seg('#1e1e1e', x + 7, -31, x + 16, -27, 3);
    R.oval('#4a3a30', x + 17, -26.5, 2.4, 2.4);
    R.box('#6a4028', x - 2, -26, 1, 7); R.box('#6a4028', x + 2, -26, 1, 7);
    R.poly('#f4f0e6', [[x - 6, -20], [x + 6, -20], [x + 4, -11], [x - 4, -11]]);
    R.box('#ffffff', x - 6, -20, 12, 1);
    R.box('#6a4028', x - 4, -19, 8, 1);
    R.box('#d2cabb', x + 2, -18, 2, 7);
    R.box('#e0d9cb', x + 6, -18, 3, 1); R.box('#e0d9cb', x + 8, -18, 1, 4); R.box('#e0d9cb', x + 5, -15, 4, 1);
  }
  // 스팀 노즐
  R.seg('#c8d0d6', -33, -38, -31, -17, 1.5);
  R.box('#eef2f4', -32, -18, 2, 3);
  // 위에 데우는 잔들
  R.box('#c8d0d6', -44, -67, 88, 1);
  for (const x of [-44, 0, 43]) R.box('#aab2ba', x, -67, 1, 5);
  [2, 1, 2, 0, 1, 2].forEach((n, i) => {
    for (let k = 0; k < n; k++) {
      const x = -41 + i * 14, y = -62 - k * 6;
      R.poly('#f4f0e6', [[x, y - 7], [x + 11, y - 7], [x + 10, y], [x + 1, y]]);
      R.box('#ffffff', x, y - 7, 11, 1);
      R.box('#d2cabb', x + 8, y - 6, 2, 6);
    }
  });
  steam(-31, -40, 42, 0.4);
  steam(-16, -22, 30, 2.1);
  steam(16, -22, 30, 4);
  // 우유 주전자와 종이컵
  R.oval('#5a361f44', -66, 0, 22, 2);
  R.poly('#b4bcc4', [[-64, -17], [-52, -17], [-51, 0], [-65, 0]]);
  R.box('#e6ecf0', -64, -17, 12, 1);
  R.box('#dce2e6', -63, -16, 2, 15);
  R.box('#8a9298', -55, -16, 3, 16);
  R.poly('#b4bcc4', [[-68, -18], [-64, -17], [-64, -12]]);
  R.box('#8a9298', -51, -14, 4, 1); R.box('#8a9298', -48, -14, 1, 8); R.box('#8a9298', -51, -7, 4, 1);
  R.poly('#f4f0e6', [[-84, -30], [-76, -30], [-74, 0], [-86, 0]]);
  R.poly('#d2cabb', [[-78, -30], [-76, -30], [-74, 0], [-77, 0]]);
  for (let y = -26; y < -1; y += 4) R.box('#c8c0b0', -85, y, 10, 1);
  // 그라인더 (자리가 있으면)
  if (half - off >= 100) {
    R.oval('#5a361f55', 76, 0, 20, 2.5);
    R.box('#2e3238', 62, -34, 24, 34);
    R.box('#4a5058', 62, -34, 2, 34);
    R.box('#1e2126', 84, -34, 2, 34);
    R.box('#5a6268', 60, -3, 28, 3);
    R.box('#7a828a', 60, -3, 28, 1);
    R.poly('#dcd2b880', [[58, -62], [90, -62], [84, -34], [64, -34]]);
    R.poly('#5a3a26', [[61, -50], [87, -50], [84, -34], [64, -34]]);
    for (let i = 0; i < 12; i++) R.box(i % 2 ? '#7a5236' : '#3e2616', 65 + rand() * 17, -48 + rand() * 12, 2, 1);
    R.poly('#ffffff60', [[59, -62], [61, -62], [66, -34], [64.5, -34]]);
    R.box('#2e3238', 56, -65, 36, 3);
    R.box('#4a5058', 56, -65, 36, 1);
    R.box('#5a6268', 69, -22, 10, 5);
    R.box('#3a4046', 71, -17, 6, 2);
    R.oval('#c8d0d6', 74, -28, 3, 3);
    R.box('#f2a04a', 66, -8, 2, 2);
  }

  // ── 아주 넓은 화면: 카운터 양끝의 쿠키 병 · 크루아상 바구니, 냅킨 통 · 화분 ──
  if (half - off >= 190) {
    for (const x of [-128, -150]) {
      L.oval('#5a361f44', x + 2, 0, 11, 2);
      L.box('#d8e8ec40', x - 9, -22, 18, 22);
      for (let k = 0; k < 5; k++) { // 눕혀 쌓은 쿠키의 옆면
        const ky = -4 - k * 3.6, kx = x + [-1, 1, 0, 1.5, -0.5][k];
        L.box(k % 2 ? '#b8783e' : '#a86a36', kx - 6, ky - 1.5, 12, 3);
        L.box(k % 2 ? '#b8783e' : '#a86a36', kx - 7, ky - 0.5, 14, 1);
        L.box('#dca464', kx - 5, ky - 1.5, 10, 1);
        L.box('#4a2c18', kx - 3 + k % 3, ky, 1, 1); L.box('#4a2c18', kx + 3 - k % 2, ky - 1, 1, 1);
      }
      L.box('#eef8fab0', x - 9, -22, 1, 22);
      L.box('#8eaab480', x + 8, -22, 1, 22);
      L.box('#ffffff90', x - 6, -19, 1, 13);
      L.box('#c8a070', x - 10, -26, 20, 4);
      L.box('#e8c890', x - 10, -26, 20, 1);
      L.box('#9a7448', x - 10, -23, 20, 1);
      L.oval('#b88c58', x, -27, 3, 1.6);
    }
    const bx = -190;
    L.oval('#5a361f44', bx + 2, 0, 23, 2.4);
    for (const [dx, dy] of [[-9, -12], [9, -12], [0, -15]]) {
      L.oval('#b87a34', bx + dx, dy, 9, 4.6);
      L.oval('#d8a050', bx + dx - 0.5, dy - 0.6, 8, 3.6);
      L.oval('#f2c878', bx + dx - 2, dy - 2, 4, 1.2);
      for (const ox of [-4, 0, 4]) L.box('#9c6228', bx + dx + ox, dy - 3, 1, 5);
    }
    L.poly('#a8743e', [[bx - 21, -10], [bx + 21, -10], [bx + 17, 0], [bx - 17, 0]]);
    for (const [y, o] of [[-7, 0], [-4, 2], [-1, 0]]) for (let x = bx - 18 + o; x < bx + 17; x += 4) L.box('#8a5a2e', x, y, 2, 1);
    L.box('#c8945a', bx - 21, -11, 42, 2);
    L.box('#e0b07a', bx - 21, -11, 42, 1);
    L.box('#7a4e26', bx + 13, -9, 3, 9);

    const nx = 116;
    R.oval('#5a361f44', nx + 10, 0, 15, 2);
    R.box('#d85a4a', nx + 11, -27, 1, 14); R.box('#4a8ad0', nx + 13, -25, 1, 12); R.box('#f2c84a', nx + 15, -28, 1, 15);
    R.box('#f4f0e6', nx + 2, -20, 8, 7); R.box('#d2cabb', nx + 8, -20, 2, 7);
    R.box('#2e3238', nx, -14, 19, 14);
    R.box('#4a5058', nx, -14, 19, 1);
    R.box('#1e2126', nx + 17, -14, 2, 14);
    R.box('#c8d0d6', nx + 3, -9, 8, 3);
    const px = 162;
    R.oval('#5a361f55', px + 2, 0, 16, 2.4);
    for (const [dx, tall, lean, c] of [[-6, 36, -9, '#3e6838'], [6, 32, 10, '#3e6838'], [-2, 46, -3, '#4c7a44'], [3, 42, 4, '#5e8c4e'], [0, 26, 1, '#6a9a58']] as const) { // 산세베리아
      const tx = px + dx + lean, ty = -24 - tall;
      R.poly(c, [[px + dx - 3, -24], [px + dx + 3, -24], [tx + 3, ty + 9], [tx, ty], [tx - 3, ty + 9]]);
      R.poly('#c8c070', [[px + dx + 2, -24], [px + dx + 3, -24], [tx + 3, ty + 9], [tx + 2, ty + 9]]);
      for (let k = 0.3; k < 0.9; k += 0.2) R.box('#2e5430', px + dx + lean * k - 2, -24 - tall * k, 3, 1);
    }
    R.poly('#b0704a', [[px - 11, -22], [px + 11, -22], [px + 9, 0], [px - 9, 0]]);
    R.box('#8a5236', px + 5, -21, 4, 21);
    R.box('#c88a5a', px - 12, -25, 24, 4);
    R.box('#e0a878', px - 12, -25, 24, 1);
  }

  // ── 엎질러진 잔 (손님이 화난 까닭): 가운데는 손님 포켓몬이 가리므로 호출 종 옆에 ──
  const M = brush(g, C.X(Math.max(-off + 130, -off * 0.5 - 6)), counterY + u(4), s);
  M.oval('#6a4028b0', 26, 1, 22, 2.6);
  M.oval('#9c6a4690', 22, 0.4, 9, 1);
  M.box('#6a4028', 40, 3, 2, 9);
  M.box('#6a4028', 40, 13, 2, 2);
  M.oval('#5a361f44', -2, 0, 14, 2);
  M.poly('#f4f0e6', [[-12, -11], [8, -13], [8, 0], [-12, -2]]);
  M.poly('#b08a5a', [[-6, -11.6], [2, -12.4], [2, -0.6], [-6, -1.4]]);
  M.seg('#ffffff', -12, -10.5, 8, -12.5, 1);
  M.poly('#d2cabb', [[-12, -4], [8, -2.5], [8, 0], [-12, -2]]);
  M.oval('#3a2418', 8.5, -6.5, 1.6, 6.5);
  M.oval('#5a361f44', -30, 1, 9, 1.6);
  M.oval('#e8e2d4', -30, -1, 8, 2.2);
  M.oval('#ffffff', -31, -1.6, 5, 1);

  // ── 긴장감: 가장자리가 살짝 붉다 ──
  const tense = g.createRadialGradient(w / 2, h * 0.35, Math.min(w, h) * 0.2, w / 2, h * 0.35, Math.max(w, h) * 0.7);
  tense.addColorStop(0, '#e8404000'); tense.addColorStop(1, '#e8404034');
  g.fillStyle = tense; g.fillRect(0, 0, w, h);
  vignette(g, w, h, '#2a0c10', 0.25);
}
