import { type Ink, seeded } from './pixels';
import { brush, vignette } from './hd';

/**
 * 낯선 생활관에서 눈을 뜬 순간 (고해상도): 베개에 누운 채 발치 쪽을 본다.
 * 위에서부터 천장(28%) · 맞은편 벽(창 · 시계 · 관물대) · 옆 침상 · 내 모포(능선이 80%)로, 자리는 예전 그림과 같다.
 * 창과 관물대는 각자의 칸 크기를 지킨다: 화면이 넓어지면 창 칸과 관물대 수가 늘 뿐 늘어나지 않는다.
 */
export function wakingBarracksHd(g: Ink, w: number, h: number) {
  const rand = seeded(1784);
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const wall = Math.round(h * 0.28), floor = Math.round(h * 0.64);
  const joint = floor + u(18); // 벽과 바닥이 만나는 줄
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };
  const P = brush(g, 0, 0, 1);

  // ── 천장: 들보가 맞은편 벽 쪽 소실점으로 모인다 ──
  const ceil = g.createLinearGradient(0, 0, 0, wall);
  ceil.addColorStop(0, '#43555c'); ceil.addColorStop(1, '#5a6c70');
  g.fillStyle = ceil; g.fillRect(0, 0, w, wall);
  const vp = w * 0.54, near = 0.57; // 벽에 닿는 곳은 머리 위의 57% 폭으로 좁아진다
  for (const z of [1.1, 1.22, 1.36, 1.52, 1.68]) { // 천장판 이음매 (멀수록 촘촘하다)
    const y = Math.round(wall * (1 - 1 / z) / (1 - near));
    fill('#3f5158', 0, y, w, 1); fill('#67797b70', 0, y + 1, w, 1);
  }
  for (let i = 0; i < w / 5; i++) fill(i % 2 ? '#6a7c7e30' : '#35464d30', rand() * w, rand() * wall, (4 + rand() * 14) * s, 1);
  const gap = Math.max(90 * s, w * 0.28);
  for (let x = vp - gap * Math.ceil((vp + w) / gap); x < w * 2; x += gap) {
    const end = vp + (x - vp) * near, b0 = 16 * s, b1 = 8 * s;
    P.poly('#2f4047', [[x + b0, 0], [x + b0 + 7 * s, 0], [end + b1 + 3 * s, wall], [end + b1, wall]]); // 들보 옆 그늘
    P.poly('#394b54', [[x, 0], [x + b0, 0], [end + b1, wall], [end, wall]]);
    P.poly('#4a5d63', [[x, 0], [x + b0 * 0.4, 0], [end + b1 * 0.4, wall], [end, wall]]);
    P.seg('#81908a', x, 0, end, wall, 1);
  }
  // 꺼진 형광등
  {
    const T = brush(g, Math.round(w * 0.57), Math.round(h * 0.12), s);
    const len = Math.min(w * 0.24 / s, 210);
    T.box('#2b3b42', 2, 11, len, 3);
    T.box('#34474e', 0, 0, len, 11);
    T.box('#4f6268', 0, 0, len, 1);
    T.box('#24343a', 0, 10, len, 1);
    for (const y of [3, 7]) { T.box('#8d9d94', 6, y, len - 12, 2); T.box('#c5c8aa', 8, y, len - 16, 1); }
    T.box('#5d7074', 3, 2, 4, 8); T.box('#5d7074', len - 7, 2, 4, 8);
  }

  // ── 맞은편 벽 ──
  const paint = g.createLinearGradient(0, wall, 0, joint);
  paint.addColorStop(0, '#5f7177'); paint.addColorStop(0.55, '#808d86'); paint.addColorStop(1, '#929988');
  g.fillStyle = paint; g.fillRect(0, wall, w, joint - wall);
  for (let i = 0; i < w / 3; i++) fill(i % 2 ? '#a3aa9828' : '#4f616528', rand() * w, wall + rand() * (joint - wall), (3 + rand() * 9) * s, 1);
  fill('#3c5056', 0, wall, w, u(5));
  fill('#2f4248', 0, wall, w, 1);
  fill('#9da494', 0, wall + u(5), w, 1);
  fill('#4f626670', 0, wall + u(5) + 1, w, u(3));

  // 창의 자리: 왼쪽 벽 가까이, 폭은 화면의 36%쯤 (칸 수로 맞춘다)
  const wx = Math.round(w * 0.055), sillY = Math.round(wall + 20 * s + (floor - wall - 20 * s) * 0.77);
  const WH = Math.min((sillY - wall) / s - 20, 170), wy = sillY - Math.round(WH * s);
  const panes = Math.max(2, Math.round(w * 0.36 / s / 95)), PW = Math.min(118, w * 0.36 / s / panes), WW = PW * panes;
  const W = brush(g, wx, wy, s);
  W.glow('#ffe6c02c', WW * 0.6, WH * 0.6, WH * 1.5);

  // ── 바닥 ──
  const boards = g.createLinearGradient(0, joint, 0, h * 0.82);
  boards.addColorStop(0, '#586a6a'); boards.addColorStop(1, '#4a5c5f');
  g.fillStyle = boards; g.fillRect(0, joint, w, h - joint);
  for (let d = 5 * s; joint + d < h * 0.82; d = d * 1.8 + 2) { fill('#40525680', 0, joint + d, w, 1); fill('#6e807c50', 0, joint + d + 1, w, 1); }
  for (let x = -w; x < w * 2; x += 110 * s) {
    const x0 = vp + (x - vp) * 0.8, x1 = vp + (x - vp) * 1.5;
    P.seg('#40525690', x0, joint, x1, h * 0.82, 1);
  }
  fill('#4a5c60', 0, joint - u(6), w, u(6)); // 걸레받이
  fill('#74857f', 0, joint - u(6), w, 1);
  fill('#33454a', 0, joint - 1, w, 1);

  // 창살 무늬대로 벽과 바닥에 눕는 아침 볕
  for (let i = 0; i < panes; i++) {
    const left = W.X(PW * i + 4), right = W.X(PW * (i + 1) - 4), y = sillY + u(12);
    const reach = joint + 52 * s, shift = (w * 0.37 - wx) + (right - left) * 0.1;
    P.poly('#ffdfa826', [[left, y], [right, y], [right + shift + w * 0.04, reach], [left + shift, reach]]);
  }

  // ── 창 ──
  W.box('#2f4248', -8, -8, WW + 16, WH + 16);
  W.box('#43565b', -6, -6, WW + 12, WH + 12);
  W.box('#62757a', -6, -6, WW + 12, 1);
  W.box('#62757a', -6, -6, 1, WH + 12);
  W.clip(0, 0, WW, WH, () => {
    W.fade(['#7f99ae', '#a9b0bb', '#e1b9a4', '#f5d9b1', '#fbe6c0'], 0, 0, WW, WH);
    const sunX = WW * 0.6;
    W.glow('#ffeec090', sunX, WH * 0.72, WH * 0.62);
    for (let i = 0; i < 12 * panes; i++) { // 새벽 구름
      const x = rand() * WW, y = WH * (0.12 + rand() * 0.48);
      W.box(i % 3 ? '#f6dcc070' : '#8f9cb260', x, y, 8 + rand() * 30, 1);
    }
    W.oval('#fff6d8', sunX, WH * 0.76, 9, 9);
    // 먼 능선 · 가까운 능선 · 연병장 가의 나무
    W.ridge('#9a9fb2', 0, WW, (x) => WH * 0.7 + Math.sin(x / 34 + 2) * 5 + Math.sin(x / 13) * 2, () => WH);
    W.ridge('#788598', 0, WW, (x) => WH * 0.76 + Math.sin(x / 28) * 6 + Math.sin(x / 14) * 2.6, () => WH);
    W.ridge('#8f98a6', 0, WW, (x) => WH * 0.76 + Math.sin(x / 28) * 6 + Math.sin(x / 14) * 2.6, (x) => WH * 0.76 + Math.sin(x / 28) * 6 + Math.sin(x / 14) * 2.6 + 1);
    for (let x = 0; x < WW; x += 3) {
      const top = WH * 0.9 + Math.sin(x / 12) * 3 - rand() * 5;
      W.box('#576d77', x, top, 3, WH - top);
      W.box('#6b8087', x, top, 1, 2);
    }
    // 국기 게양대
    const px = WW * 0.2;
    W.box('#4a5d66', px, WH * 0.36, 2, WH);
    W.box('#8c9aa0', px, WH * 0.36, 1, WH);
    W.oval('#c9c0a4', px + 1, WH * 0.36 - 1, 2, 2);
    W.poly('#d9cdb8', [[px + 2, WH * 0.39], [px + 17, WH * 0.41], [px + 16, WH * 0.5], [px + 2, WH * 0.48]]);
    W.box('#b0717a', px + 7, WH * 0.43, 4, 3);
    // 유리에 비친 빛
    for (let i = 0; i < panes; i++) {
      W.poly('#ffffff16', [[PW * i + 10, 0], [PW * i + 26, 0], [PW * i + 4, WH * 0.5], [PW * i + 4, WH * 0.32]]);
      W.poly('#ffffff0e', [[PW * i + 40, 0], [PW * i + 48, 0], [PW * i + 18, WH * 0.7], [PW * i + 10, WH * 0.7]]);
    }
  });
  W.box('#566a6c', 0, WH * 0.28, WW, 4);
  W.box('#7f8f8b', 0, WH * 0.28, WW, 1);
  for (let i = 0; i <= panes; i++) {
    const x = Math.min(WW - 2, Math.max(-2, PW * i - 2));
    W.box('#566a6c', x, 0, 4, WH);
    W.box('#c3bca5', x + 3, 0, 1, WH);
  }
  for (let i = 0; i < panes; i++) { W.box('#3b4d52', PW * i + PW / 2 - 4, WH - 5, 8, 3); W.box('#9aa59a', PW * i + PW / 2 - 4, WH - 5, 8, 1); } // 창 손잡이
  W.box('#cdc3a8', -11, WH + 6, WW + 22, 4);
  W.box('#ece2c4', -11, WH + 6, WW + 22, 1);
  W.box('#5c6c6b', -9, WH + 10, WW + 18, 5);
  W.box('#4c5d5f60', -9, WH + 15, WW + 18, 3);
  // 한쪽으로 묶어 둔 커튼
  {
    const tie = WH * 0.56, top = -12, end = WH + 8;
    const breadth = (y: number) => y < tie ? 34 - 18 * ((y - top) / (tie - top)) ** 0.7 : 16 + 10 * ((y - tie) / (end - tie)) ** 0.6;
    for (let j = W.Y(top); j < W.Y(end); j++) {
      const y = (j + 0.5 - wy) / s, span = Math.max(3, Math.round(breadth(y) * s)), x0 = W.X(WW + 9) - span;
      for (let k = 0; k < 4; k++) {
        const a = Math.round(span * k / 4), b = Math.round(span * (k + 1) / 4), n = b - a;
        const lit = Math.max(1, Math.round(n * 0.3)), mid = Math.max(1, Math.round(n * 0.4));
        g.fillStyle = '#c0c2ad'; g.fillRect(x0 + a, j, lit, 1);
        g.fillStyle = '#8f9c98'; g.fillRect(x0 + a + lit, j, mid, 1);
        g.fillStyle = '#6b7c7e'; g.fillRect(x0 + a + lit + mid, j, Math.max(0, n - lit - mid), 1);
      }
      g.fillStyle = '#e6dcc0'; g.fillRect(x0, j, 1, 1);
    }
    W.box('#d6caa6', WW - 8, tie - 3, 18, 5);
    W.box('#9d9477', WW - 8, tie + 1, 18, 1);
    W.box('#33454b', -14, top - 3, WW + 30, 3);
    W.box('#6f8283', -14, top - 3, WW + 30, 1);
  }

  // ── 벽시계 (기상 시각)와 생활관 수칙 ──
  {
    const C = brush(g, Math.round(w * 0.5), wy + u(18), s);
    C.oval('#42545860', 2, 3, 15, 15);
    C.oval('#34454a', 0, 0, 15.5, 15.5);
    C.oval('#52656a', 0, 0, 14, 14);
    C.oval('#d6cbb1', 0, 0, 11.5, 11.5);
    C.oval('#bdb49b', 0, 0, 11.5, 11.5, (dx, dy) => dx + dy > 0.75);
    C.oval('#efe6cc', 0, 0, 11.5, 11.5, (dx, dy) => dx + dy < -0.95);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, r = i % 3 ? 9.5 : 8.8;
      C.box('#59645f', Math.sin(a) * r - 0.5, -Math.cos(a) * r - 0.5, i % 3 ? 1 : 1.6, i % 3 ? 1 : 1.6);
    }
    C.box('#3f4b49', -0.5, -8.5, 1.4, 9);
    C.seg('#3f4b49', 0, 0, -1, 5.5, 2);
    C.box('#a8554a', -1, -1, 2, 2);
    const N = brush(g, Math.round(w * 0.5), wy + u(48), s);
    N.box('#4a5c5f70', -15, 2, 34, 44);
    N.box('#44575b', -17, 0, 34, 44);
    N.box('#c9c5a9', -15, 2, 30, 40);
    N.box('#dedabd', -15, 2, 30, 1);
    N.box('#8e5f5a', -9, 6, 18, 3);
    for (let i = 0; i < 7; i++) N.box('#7f897c', -11, 13 + i * 4, i % 3 === 2 ? 14 : 22, 1);
  }

  // ── 관물대: 이름표 · 통풍구 · 손잡이, 위에는 각 잡아 갠 장구류 ──
  const lx = Math.round(w * 0.58), LW = 68;
  const lockerTop = Math.max(wall + u(38), joint - u(4) - u(200)), LH = (joint - u(4) - lockerTop) / s;
  for (let i = 0; lx + i * LW * s < w; i++) {
    const L = brush(g, Math.round(lx + i * LW * s), lockerTop, s);
    L.box('#3e5258', 0, 0, LW, LH);
    L.box('#566a6e', 0, 0, LW, 1);
    L.box('#2c3d43', LW - 1, 0, 1, LH);
    L.box(i % 2 ? '#65797a' : '#71817e', 3, 3, LW - 6, LH - 9);
    L.fade(['#00000000', '#1f303426'], 3, LH * 0.4, LW - 6, LH * 0.6 - 6);
    L.box('#93a297', 3, 3, LW - 6, 1);
    L.box('#8a9990', 3, 3, 1.5, LH - 9);
    L.box('#4f6468', LW - 4.5, 3, 1.5, LH - 9);
    L.box('#4f6468', 3, LH - 7.5, LW - 6, 1.5);
    // 이름표
    L.box('#8a8f7c', 21, 10, 26, 9);
    L.box('#c2c0a2', 22, 11, 24, 7);
    L.box('#5d6a66', 25, 13, 5 + (i * 7) % 6, 1); L.box('#5d6a66', 25, 15, 12 + (i * 5) % 5, 1);
    // 통풍구
    for (let j = 0; j < 4; j++) { L.box('#435a5e', 16, 26 + j * 5, 36, 2); L.box('#8f9e94', 16, 28 + j * 5, 36, 1); }
    // 손잡이와 자물쇠
    const hy = LH * 0.55;
    L.box('#40565b', 8, hy, 8, 15);
    L.box('#566b6e', 8, hy + 14, 8, 1);
    L.box('#a7b0a5', 10, hy + 2, 2, 10);
    L.box('#d4d6c3', 10, hy + 2, 1, 6);
    L.box('#3a4c50', 9, hy + 17, 1, 4); L.box('#3a4c50', 13, hy + 17, 1, 4); L.box('#3a4c50', 9, hy + 16, 5, 1);
    L.box('#b9a66c', 8, hy + 20, 7, 6);
    L.box('#dccb8f', 8, hy + 20, 7, 1);
    // 경첩
    for (const y of [24, LH - 30]) { L.box('#4c6265', LW - 9, y, 3, 8); L.box('#8a9990', LW - 9, y, 1, 8); }
    if (i % 3 === 0) { // 문에 붙인 점검표
      L.box('#4f646870', 33, 49, 20, 26);
      L.box('#b3b296', 32, 47, 20, 26);
      L.box('#cfcbac', 32, 47, 20, 1);
      L.box('#c6b797', 38, 45, 8, 4);
      for (let k = 0; k < 5; k++) L.box('#79877c', 35, 53 + k * 4, k === 4 ? 8 : 14, 1);
    }
    L.box('#33464c', 0, LH - 4, LW, 4);
    L.box('#2a3a40', 4, LH, 5, 4); L.box('#2a3a40', LW - 9, LH, 5, 4);
    // 관물대 위
    if (i % 3 === 0) {
      for (let k = 0; k < 3; k++) { // 갠 모포와 전투복
        L.box(k % 2 ? '#5d7166' : '#52665f', 7, -9 - k * 8, 50, 8);
        L.box('#8f9c86', 7, -9 - k * 8, 50, 1);
        L.box('#3f5250', 7, -2 - k * 8, 50, 1);
        L.box('#46595a', 53, -9 - k * 8, 4, 8);
      }
      L.box('#c9c5a9', 12, -22, 10, 4);
    } else if (i % 3 === 2) { // 방탄모와 세면 가방
      L.oval('#566a5c', 22, -2, 17, 15, (_dx, dy) => dy < 0);
      L.oval('#73856f', 17, -9, 7, 4, (_dx, dy) => dy < 0.4);
      L.box('#3d4f48', 3, -4, 38, 3);
      L.box('#6f8272', 3, -4, 38, 1);
      L.poly('#4b5f63', [[45, -1], [64, -1], [62, -13], [47, -13]]);
      L.box('#7a8c8a', 47, -13, 15, 1);
      L.box('#2f4248', 52, -16, 5, 3);
    } else {
      L.box('#5f6f62', 10, -8, 30, 7);
      L.box('#8f9c86', 10, -8, 30, 1);
      L.box('#877f66', 44, -12, 16, 11);
      L.box('#a59c80', 44, -12, 16, 1);
      L.box('#6c6552', 44, -7, 16, 1);
    }
  }
  // 창 쪽 관물대에 걸리는 볕
  {
    const span = Math.min(w - lx, 240 * s), warm = g.createLinearGradient(lx, 0, lx + span, 0);
    warm.addColorStop(0, '#ffe2b01c'); warm.addColorStop(1, '#ffe2b000');
    g.fillStyle = warm; g.fillRect(lx, lockerTop, span, joint - lockerTop);
  }
  // 볕 속에 뜬 먼지
  for (let i = 0; i < 26; i++) {
    const t = rand(), x = wx + WW * s * (0.2 + rand() * 0.8) + t * w * 0.2, y = sillY + t * (joint + 30 * s - sillY) * rand();
    fill('#fff2cc80', x, y, 1, 1);
  }

  // ── 옆 침상: 각 잡아 갠 모포와 베개 ──
  {
    const CW = Math.min(w * 0.39 / s, 400);
    const B = brush(g, 0, floor - u(6), s);
    B.poly('#3c4e5290', [[0, 58], [CW * 0.98, 52], [CW * 1.04, 66], [0, 74]]); // 침상 밑 그늘
    // 쇠파이프 다리
    for (const x of [CW * 0.06, CW * 0.9]) {
      B.box('#33474d', x, 30, 6, 36);
      B.box('#6f8385', x + 4, 30, 1, 36);
      B.box('#2a3a40', x - 1, 64, 8, 3);
    }
    // 매트리스 윗면: 팽팽히 당겨 깐 홑이불
    B.poly('#84918a', [[0, -8], [CW * 0.56, -8], [CW, 18], [0, 24]]);
    B.poly('#96a297', [[0, -8], [CW * 0.56, -8], [CW * 0.66, -3], [0, 0]]);
    B.seg('#b1b9a6', 0, -8, CW * 0.56, -8, 1);
    for (const [x0, y0, x1, y1] of [[CW * 0.05, 14, CW * 0.3, 10], [CW * 0.3, 18, CW * 0.48, 15]]) B.seg('#77857f', x0, y0, x1, y1, 1);
    // 옆면: 접어 넣은 홑이불 자락 · 매트리스 천 · 쇠틀
    B.poly('#6d7f7b', [[0, 24], [CW, 18], [CW, 23], [0, 29]]);
    B.seg('#a3ae9f', 0, 24, CW, 18, 1);
    B.poly('#566968', [[0, 29], [CW, 23], [CW, 27], [0, 33]]);
    for (let x = 6; x < CW; x += 14) B.seg('#4b5e5e', x, 29.5 - x * 6 / CW, x, 32.5 - x * 6 / CW, 1); // 매트리스 누빔
    B.poly('#3a5056', [[0, 33], [CW + 2, 27], [CW + 2, 33], [0, 39]]);
    B.seg('#8a9c9a', 0, 33, CW + 2, 27, 1);
    B.seg('#2b3d43', 0, 39, CW + 2, 33, 1);
    // 베개: 네모난 솜베개, 윗면이 볕을 받는다
    {
      const pr = Math.min(CW * 0.13, 40), px = CW * 0.04 + pr;
      B.poly('#6f7f78a0', [[px - pr + 2, 3], [px + pr + 6, 1], [px + pr + 3, 5], [px - pr, 7]]);
      B.poly('#9a9c86', [[px - pr, -1], [px - pr + 3, -11], [px + pr - 3, -12], [px + pr, -3], [px + pr - 2, 2], [px - pr + 2, 3]]);
      B.poly('#bab9a1', [[px - pr + 2, -3], [px - pr + 4, -11], [px + pr - 4, -12], [px + pr - 1, -4]]);
      B.poly('#d3d0b5', [[px - pr + 6, -6], [px - pr + 7, -11], [px + pr - 9, -11.5], [px + pr - 6, -6.5]]);
      B.box('#ebe6cc', px - pr * 0.5, -11, pr * 0.9, 1);
      B.seg('#8a8c78', px - pr + 2, 2, px + pr - 2, 1, 1);
      for (const [cx, cy] of [[px - pr + 1, -1], [px + pr - 1, -3]]) B.oval('#a8aa93', cx, cy, 2.5, 2);
    }
    // 각 잡아 갠 모포: 네 겹이 보이는 옆면, 모서리가 반듯하다
    {
      const x0 = CW * 0.44, x1 = CW * 0.78, back = -10, front = 2, th = 10;
      B.poly('#3f525080', [[x0 + 14, front + th], [x1 + 10, front + th - 1], [x1 + 6, front + th + 4], [x0 + 10, front + th + 4]]);
      B.poly('#64796f', [[x0, back], [x1 - 26, back], [x1, front], [x0 + 10, front]]);
      B.poly('#7d8f80', [[x0, back], [x1 - 26, back], [x1 - 22, back + 2.5], [x0 + 2, back + 2.5]]);
      B.seg('#a0a68b', x0 + 10, front, x1, front, 1);
      B.poly('#53685f', [[x0 + 10, front], [x1, front], [x1, front + th], [x0 + 10, front + th]]);
      B.poly('#3f5250', [[x1, front], [x1 - 26, back], [x1 - 26, back + th], [x1, front + th]]);
      for (let k = 1; k < 4; k++) {
        const y = front + th * k / 4;
        B.box('#3d504c', x0 + 10, y - 1, x1 - x0 - 10, 1);
        B.box('#6f8476', x0 + 10, y, x1 - x0 - 10, 1);
      }
      B.box('#7a8c7e', x0 + 10, front, 1.5, th);
    }
  }

  // ── 내 모포: 저 끝에 두 발이 솟은 둔덕, 발에서 내 쪽으로 퍼지는 주름, 턱밑에는 접어 내린 흰 홑이불 ──
  const base = h * 0.8;
  const bump = (x: number, at: number, half: number, tall: number) => {
    const v = (x - at) / half;
    return Math.abs(v) < 1 ? tall * (1 + Math.cos(v * Math.PI)) / 2 : 0;
  };
  const sep = Math.max(64 * s, Math.min(112 * s, w * 0.12)), feetL = w * 0.5 - sep / 2, feetR = w * 0.5 + sep / 2;
  const quilt = (x: number) => base - bump(x, feetL, 40 * s, 27 * s) - bump(x, feetR, 40 * s, 23 * s)
    - bump(x, w * 0.5, Math.max(w * 0.3, 150 * s), h * 0.025) + Math.sin(x / w * 9) * 3 * s;
  const fold = Math.round(h - Math.max(20 * s, h * 0.05)); // 홑이불 접힌 자락의 윗선
  for (let x = 0; x < w; x++) {
    const y = Math.round(quilt(x)), slope = quilt(x + 2) - quilt(x - 2);
    fill('#63776d', x, y, 1, h - y);
    fill(slope < -0.6 ? '#93a08a' : slope > 0.6 ? '#566a62' : '#7f8f80', x, y, 1, u(slope < -0.6 ? 7 : 5)); // 창 쪽 비탈은 밝고 반대쪽은 어둡다
    fill(slope > 0.6 ? '#8f9c86' : '#b7b996', x, y, 1, u(1.6));
  }
  const body = g.createLinearGradient(0, base, 0, h);
  body.addColorStop(0, '#2c3f3c00'); body.addColorStop(1, '#2c3f3c40');
  g.fillStyle = body; g.fillRect(0, base, w, h - base);
  // 모포 밑의 두 다리: 발끝에서 내 쪽으로 벌어지며 넓어진다
  for (const [fx, dir] of [[feetL, -1], [feetR, 1]] as const) {
    const top = quilt(fx) + 12 * s, hip = fx + dir * Math.min(w * 0.14, 120 * s);
    P.poly('#73867866', [[fx - 14 * s, top], [fx + 14 * s, top], [hip + 60 * s, fold], [hip - 60 * s, fold]]);
    P.poly('#8a9a8440', [[fx - 14 * s, top], [fx - 4 * s, top], [hip - 30 * s, fold], [hip - 60 * s, fold]]);
  }
  P.poly('#4f645c70', [[w * 0.5 - 5 * s, base - h * 0.02], [w * 0.5 + 5 * s, base - h * 0.02], [w * 0.5 + 34 * s, fold], [w * 0.5 - 34 * s, fold]]); // 다리 사이 골
  // 발끝에서 내 쪽으로 퍼지는 주름: 그늘 진 쪽과 빛 받는 쪽
  for (const [fx, spread] of [[feetL, -1], [feetL, -0.42], [feetR, 0.46], [feetR, 1.1]] as const) {
    const top = quilt(fx) + 8 * s, endX = fx + spread * w * 0.32;
    P.poly('#4f645c80', [[fx - 3 * s, top], [fx + 3 * s, top], [endX + 16 * s, fold], [endX - 10 * s, fold]]);
    P.poly('#93a18a55', [[fx - 6 * s, top], [fx - 3 * s, top], [endX - 10 * s, fold], [endX - 24 * s, fold]]);
  }
  // 창으로 든 아침 볕이 모포 왼쪽 위에 따뜻하게 걸린다
  P.glow('#ffdfa830', Math.round(w * 0.3), Math.round(base + h * 0.04), w * 0.24);
  // 모직의 보풀
  for (let i = 0; i < w * 3; i++) {
    const x = rand() * w, q = quilt(x), y = q + 6 * s + rand() * (fold - q - 6 * s);
    fill(i % 3 ? '#b6ba9924' : '#3f524f2c', x, y, 2 + rand() * 3 * s, 1);
  }
  // 턱밑까지 덮은 홑이불의 접힌 자락
  for (let x = 0; x < w; x++) {
    const y = fold + Math.round(Math.sin(x / (46 * s)) * 3 * s);
    fill('#3f525090', x, y - u(4), 1, u(4));
    fill('#d2d0b8', x, y, 1, h - y);
    fill('#f0ead4', x, y, 1, u(2));
    fill('#bfbea6', x, y + u(11), 1, h);
  }
  for (let x = u(12); x < w; x += u(34)) fill('#a9a892', x, fold + u(7), u(10), 1);

  vignette(g, w, h, '#14222a', 0.3);
}
