import { type Ink, seeded } from './pixels';
import { brush, vignette } from './hd';

/**
 * 막사 옥상의 밤 (고해상도). 난간 너머로 부대 건물과 산, 그 위로 별.
 * 바닥이 시작되는 줄(화면 높이의 64%)은 예전 그림과 같다: 그 위에 선 인물은 CSS로 따로 얹힌다.
 * day가 지날수록 별 하나가 커지고 낮아진다.
 */
export function roofHd(g: Ink, w: number, h: number, day: number) {
  const rand = seeded(963);
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const deck = Math.round(h * 0.64);
  const horizon = deck - u(18);
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };

  // ── 하늘 ──
  const skyFill = g.createLinearGradient(0, 0, 0, horizon);
  ['#060b20', '#0d1a3a', '#1c3059', '#414c7a', '#866f93', '#c8978f'].forEach((c, i, a) => skyFill.addColorStop(i / (a.length - 1), c));
  g.fillStyle = skyFill;
  g.fillRect(0, 0, w, deck);
  // 은하수: 왼쪽 위에서 오른쪽으로 비스듬히 흐르는 옅은 띠
  for (let i = 0; i < w * 7; i++) {
    const x = rand() * w;
    const y = horizon * (0.5 - x / w * 0.42) + (rand() + rand() + rand() - 1.5) * 46 * s + Math.sin(x / (60 * s)) * 9 * s;
    if (y < 0 || y > horizon * 0.8) continue;
    fill(['#9aa8dc18', '#b9a8e016', '#8fc0d412', '#ffffff14'][i % 4], x, y, 1 + rand() * 3, 1);
  }
  // 별: 지평선 쪽으로 갈수록 드물고 흐리다
  for (let i = 0; i < w * 1.9; i++) {
    const x = rand() * w, depth = rand() ** 1.5, y = depth * horizon * 0.94;
    const c = ['#ffffff', '#f3dcc8', '#b3c2e4', '#9aa3cc', '#7f86b4'][Math.floor(rand() * 5)];
    if (i % 41 === 0) {
      const r = u(2);
      fill(c, x - r, y, r * 2 + 1, 1); fill(c, x, y - r, 1, r * 2 + 1); fill('#ffffff', x, y, 1, 1);
    } else if (i % 9 === 0 && depth < 0.6) fill(c, x, y, 2, 2);
    else fill(depth > 0.7 ? c + '90' : c, x, y, 1, 1);
  }
  // 구름: 지평선 가까이 얇게 깔린 띠, 아래쪽이 노을빛
  for (let i = 0; i < 20; i++) {
    const x = rand() * w, y = horizon * (0.5 + rand() * 0.46), span = (30 + rand() * 90) * s;
    for (let j = 0; j < 26; j++) {
      const t = rand();
      fill(j % 5 ? '#4b4670' + '4c' : '#f2bfa8' + '55', x + t * span, y - Math.sin(t * Math.PI) * 6 * s + rand() * 7 * s, (6 + rand() * 26) * s, 1);
    }
  }

  // ── 산: 멀수록 옅다 ──
  const range = (base: number, height: number, color: string, phase: number, lit?: string) => {
    for (let x = 0; x < w; x++) {
      const k = x / s;
      const y = Math.round(base + (Math.sin(k / 78 + phase) + 0.54 * Math.sin(k / 38 - phase) + 0.19 * Math.sin(k / 12 + phase) + 0.07 * Math.sin(k / 4.3)) * height);
      fill(color, x, y, 1, deck - y);
      if (lit) fill(lit, x, y, 1, 1);
    }
  };
  range(deck - 70 * s, 8 * s, '#6d6c90', 3, '#8a84a6');
  range(deck - 58 * s, 8 * s, '#535c7c', 5.2);
  range(deck - 44 * s, 7 * s, '#3d4763', 1.1);
  for (let x = 0; x < w; x += u(3)) {
    const y = deck - 42 * s + Math.sin(x / (30 * s)) * 4 * s, t = (3 + rand() * 7) * s;
    fill('#333d57', x, y - t, u(2), t + 6 * s);
  }

  // ── 난간 너머의 부대 건물들 ──
  for (let x = -20 * s; x < w;) {
    const breadth = Math.round((34 + rand() * 76) * s), top = Math.round(deck - (22 + rand() * 30) * s);
    fill('#2f3c50', x, top, breadth, deck - top);
    fill('#3b4a60', x, top, u(5), deck - top);
    fill('#243042', x + breadth - u(4), top, u(4), deck - top);
    fill('#1f2a3b', x - u(3), top - u(4), breadth + u(6), u(4));
    fill('#8f8690', x - u(3), top - u(4), breadth + u(6), 1);
    for (let i = u(8); i < breadth - u(10); i += u(11)) {
      for (let row = 0; row < 3; row++) {
        const wy = top + u(6) + row * u(11);
        if (wy > deck - u(14)) break;
        const on = rand() > 0.68;
        fill(on ? '#e2b684' : '#56637a', x + i, wy, u(6), u(5));
        if (on) { fill('#f6d9a8', x + i, wy, u(6), 1); fill('#b98d66', x + i + u(3), wy, 1, u(5)); }
        else fill('#6c7990', x + i, wy, u(6), 1);
      }
    }
    if (rand() > 0.5) { const ax = x + breadth * (0.3 + rand() * 0.4); fill('#1f2a3b', ax, top - u(16), 1, u(12)); fill('#1f2a3b', ax - u(3), top - u(14), u(7), 1); }
    else { const bx = x + breadth * 0.6; fill('#273346', bx, top - u(11), u(12), u(8)); fill('#3a475c', bx, top - u(11), u(12), 1); }
    x += breadth + u(4);
  }
  const haze = g.createLinearGradient(0, deck - 60 * s, 0, deck);
  haze.addColorStop(0, '#1a243a00'); haze.addColorStop(1, '#1a243a70');
  g.fillStyle = haze; g.fillRect(0, deck - 60 * s, w, 60 * s);

  // ── 옥상 바닥: 방수 페인트를 칠한 콘크리트, 소실점으로 모이는 줄눈 ──
  const floor = g.createLinearGradient(0, deck, 0, h);
  floor.addColorStop(0, '#34424f'); floor.addColorStop(1, '#27333f');
  g.fillStyle = floor; g.fillRect(0, deck, w, h - deck);
  for (let i = 0; i < w * 3; i++) {
    const y = deck + rand() ** 0.8 * (h - deck);
    fill(i % 3 ? '#5d6a7448' : '#1c273240', rand() * w, y, (2 + rand() * 9) * s * (0.4 + (y - deck) / (h - deck)), 1);
  }
  for (let x = -w; x < w * 2; x += 150 * s) {
    const x0 = w / 2 + (x - w / 2) * 0.6, x1 = x0 + (x - w / 2) * 0.55;
    for (let y = deck; y < h; y++) {
      const t = (y - deck) / (h - deck), px = x0 + (x1 - x0) * t;
      fill('#212d39', px, y, 1 + Math.round(t * 1.6), 1);
      fill('#4a586650', px + 1 + Math.round(t * 1.6), y, 1, 1);
    }
  }
  for (let d = 5 * s; deck + d < h; d = d * 1.75 + 2) {
    fill('#212d39', 0, deck + d, w, Math.max(1, Math.round(d / (60 * s))));
    fill('#4a586640', 0, deck + d + Math.max(1, Math.round(d / (60 * s))), w, 1);
  }
  // 별빛이 고인 듯한 얼룩
  for (let i = 0; i < 5; i++) {
    const px = rand() * w, py = deck + (0.2 + rand() * 0.7) * (h - deck), r = (40 + rand() * 60) * s;
    const pool = g.createRadialGradient(px, py, 0, px, py, r);
    pool.addColorStop(0, '#7f93ac1c'); pool.addColorStop(1, '#7f93ac00');
    g.save(); g.translate(0, py); g.scale(1, 0.28); g.translate(0, -py);
    g.fillStyle = pool; g.fillRect(px - r, py - r, r * 2, r * 2);
    g.restore();
  }

  // ── 난간 ──
  fill('#1b2733', 0, deck - u(5), w, u(6));
  fill('#4f5c68', 0, deck - u(5), w, 1);
  fill('#0f1822', 0, deck + u(1), w, u(2));
  const railTop = deck - u(26);
  for (let x = u(6); x < w; x += u(46)) {
    fill('#16222f', x, railTop, u(4), u(22));
    fill('#7d8a90', x, railTop, 1, u(22));
    fill('#16222f', x - u(2), deck - u(6), u(8), u(2));
  }
  fill('#16222f', 0, railTop - u(1), w, u(4));
  fill('#b4b6ab', 0, railTop - u(1), w, 1);
  fill('#3d4b58', 0, railTop + u(2), w, 1);
  fill('#16222f', 0, deck - u(15), w, u(2));
  fill('#5b6972', 0, deck - u(15), w, 1);

  // ── 물탱크: 띠 · 사다리 · 받침대 · 배관 ──
  const T = brush(g, Math.round(w * 0.13), deck + u(14), s);
  T.oval('#0e161f88', 0, 2, 56, 5);
  for (const x of [-42, -6, 30]) { T.box('#15202c', x, -46, 7, 48); T.box('#2c3a49', x, -46, 2, 48); }
  T.seg('#223140', -38, -42, 34, -6, 3); T.seg('#223140', 34, -42, -38, -6, 3);
  T.box('#15202c', -46, -48, 88, 5); T.box('#44525f', -46, -48, 88, 1);
  T.poly('#27394a', [[-48, -104], [-42, -112], [-28, -116], [24, -116], [42, -112], [48, -104], [48, -52], [40, -46], [-40, -46], [-48, -52]]);
  T.box('#3e5162', -40, -104, 60, 54);
  T.box('#516677', -30, -104, 22, 54);
  T.box('#6a7f8e', -26, -104, 6, 54);
  T.box('#1f2f3e', 30, -104, 14, 54);
  for (const y of [-102, -86, -68, -52]) {
    T.box('#9aa4a6', -44, y, 88, 1);
    T.box('#1c2a38', -45, y + 1, 90, 4);
    for (let x = -40; x < 42; x += 9) T.box('#6f7d86', x, y + 2, 2, 2);
  }
  T.box('#aa9b96', -28, -116, 52, 1);
  T.box('#33455a', -8, -124, 16, 8); T.box('#5a6d80', -8, -124, 16, 1);
  for (const x of [22, 35]) { T.box('#141f2b', x, -112, 3, 114); T.box('#56636f', x, -112, 1, 114); }
  for (let y = -106; y < 0; y += 8) { T.box('#7a858e', 23, y, 14, 1); T.box('#141f2b', 23, y + 1, 14, 1); }
  T.box('#223040', -60, -70, 6, 72); T.box('#55626f', -60, -70, 1, 72);
  T.box('#223040', -60, -72, 18, 5); T.box('#6a7786', -60, -72, 18, 1);
  T.box('#7a4a44', -62, -30, 10, 5);

  // ── 안테나 기둥과 당김줄 ──
  const M = brush(g, Math.round(w * 0.88), deck, s);
  M.oval('#0e161f88', 0, 2, 20, 3);
  M.box('#1c2a3a', -10, -6, 20, 6); M.box('#4a5868', -10, -6, 20, 1);
  M.seg('#3e4d62', 0, -128, 46, -8, 1); M.seg('#3e4d62', 0, -128, -36, -8, 1);
  M.box('#22344a', -2, -166, 4, 166); M.box('#5f7085', -2, -166, 1, 166);
  for (let i = 0; i < 4; i++) {
    const y = -152 + i * 9, half = 26 - i * 5;
    M.box('#30405a', -half, y, half * 2, 2);
    M.box('#8996a8', -half, y, half * 2, 1);
    for (const x of [-half, half - 2]) M.box('#30405a', x, y - 3, 2, 7);
  }
  M.box('#b9aaa6', -30, -150, 60, 1);
  M.oval('#c8584e', 0, -168, 2.5, 2.5);
  M.glow('#e0605038', 0, -168, 14);
  for (let x = M.X(0); x < w; x++) {
    const t = (x - M.X(0)) / Math.max(1, w - M.X(0));
    fill('#2e3c50', x, M.Y(-130) + Math.sin(t * 2.1) * 16 * s, 1, 1);
  }

  // ── 그 별 ──
  const k = Math.max(0, Math.min(1, (day - 4) / 8));
  const sx = Math.round(w * 0.62), sy = Math.round(h * (0.16 + k * 0.18));
  const S = brush(g, sx, sy, s);
  S.glow('#ffdda390', 0, 0, 26 + k * 56);
  S.glow('#fff4d0a0', 0, 0, 8 + k * 16);
  const r = 6 + k * 14;
  S.poly('#f6d8a8', [[0, -r * 1.7], [1.6, -1.6], [r * 1.15, 0], [1.6, 1.6], [0, r * 1.7], [-1.6, 1.6], [-r * 1.15, 0], [-1.6, -1.6]]);
  S.poly('#fff3c8', [[0, -r], [1, -1], [r * 0.7, 0], [1, 1], [0, r], [-1, 1], [-r * 0.7, 0], [-1, -1]]);
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) S.seg('#ffe9bc', dx * 2, dy * 2, dx * r * 0.5, dy * r * 0.5, 1);
  S.oval('#fffbe6', 0, 0, 2.6 + k * 2, 2.6 + k * 2);

  vignette(g, w, h, '#03050c', 0.5);
}
