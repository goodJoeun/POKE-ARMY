import { type Ink, type Point, line, polygon, rect, seeded, sky, wash } from './pixels';

function dial(g: Ink, x: number, y: number, size: number) {
  for (const [r, color, dy] of [[size + 1, '#191f21', 1], [size, '#b0a68c', 0], [size - 2, '#555e57', 0], [size - 4, '#768077', 0]] as const) {
    if (r < 1) continue;
    for (let i = -r; i <= r; i++) {
      const half = Math.round(Math.sqrt(r * r - i * i));
      rect(g, color, x - half, y + i + dy, half * 2 + 1, 1);
    }
  }
  line(g, '#efe1bc', x + 1, y - 1, Math.floor(size / 2), -Math.floor(size / 2));
}

export function radio(g: Ink, w: number, h: number) {
  const rand = seeded(8181);
  const bench = Math.round(h * 0.66), cx = Math.round(w * 0.5);
  sky(g, w, bench, ['#1d292d', '#3c4947', '#5d6150']);
  // Perforated tool board, outlines of hanging wrenches and a small parts cabinet.
  rect(g, '#202d2d', 0, bench - 103, w * 0.31, 90);
  rect(g, '#3e4c48', 0, bench - 101, w * 0.31 - 2, 86);
  for (let y = bench - 97; y < bench - 15; y += 4) for (let x = 2; x < w * 0.31 - 3; x += 5) rect(g, '#2c3a36', x, y, 1, 1);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(w * 0.055 + i * 10), y = bench - 86 + i % 2 * 4;
    line(g, '#263833', x + 2, y + 3, -4, 23 - i * 2, 3);
    line(g, '#89968b', x, y + 3, -4, 21 - i * 2, 2);
    line(g, '#b0b5a2', x - 3, y, 2, 4, 2); line(g, '#7c8d81', x + 3, y - 1, -2, 5, 2);
    rect(g, '#263531', x - 4, y + 21 - i * 2, 1, 1);
  }
  const notice = w * 0.19;
  polygon(g, '#93927e', [[notice, bench - 87], [notice + 18, bench - 85], [notice + 17, bench - 66], [notice - 1, bench - 68]]);
  rect(g, '#c2ab82', notice + 6, bench - 89, 6, 3);
  for (let i = 0; i < 4; i++) rect(g, '#626e65', notice + 3, bench - 81 + i * 3, 10 - i, 1);
  const rack = Math.round(w * 0.79);
  rect(g, '#202b2d', rack, bench - 77, w - rack + 3, 70);
  for (let y = bench - 73; y < bench - 12; y += 13) for (let x = rack + 3; x < w; x += 22) {
    rect(g, '#505b54', x, y, 20, 11); rect(g, '#718075', x, y, 20, 1);
    rect(g, '#a89f84', x + 3, y + 3, 8, 3); rect(g, '#313c37', x + 6, y + 8, 8, 2);
  }
  // 휴대폰처럼 세로가 긴 화면: 공구판 위 빈 벽에 천장 배관 · 선반(유류통 · 상자 · 전선 뭉치) · 배선도를 건다
  if (h > w * 1.2) {
    const pipeY = Math.round(h * 0.05);
    rect(g, '#141c1e', 0, pipeY, w, 5);
    rect(g, '#55605a', 0, pipeY, w, 1);
    for (let x = 12; x < w; x += 46) rect(g, '#2a3434', x, pipeY - 3, 3, 9);
    for (let x = 0; x < w * 0.45; x++) rect(g, '#1a2222', x, pipeY + 6 + Math.round(Math.sin(x / w * 7) * 3 + x * 0.04), 1, 1);
    const shelfY = Math.round(bench - 103 - Math.max(34, (bench - 103 - pipeY) * 0.38));
    rect(g, '#1b2526', 0, shelfY + 3, w, 2);
    rect(g, '#5d655a', 0, shelfY, w, 3);
    rect(g, '#8a8f7c', 0, shelfY, w, 1);
    for (const u of [0.12, 0.88]) line(g, '#28322f', w * u, shelfY + 10, 7, -7, 2);
    for (const x of [w * 0.06, w * 0.06 + 17]) {
      rect(g, '#2d3a2c', x, shelfY - 19, 15, 19);
      rect(g, '#4b5c44', x + 1, shelfY - 18, 13, 17);
      line(g, '#34432f', x + 2, shelfY - 16, 10, 13);
      line(g, '#34432f', x + 12, shelfY - 16, -10, 13);
      rect(g, '#2d3a2c', x + 3, shelfY - 23, 8, 4);
      rect(g, '#6c7a5c', x + 4, shelfY - 22, 6, 1);
    }
    const boxX = Math.round(w * 0.46);
    rect(g, '#4f4234', boxX, shelfY - 15, 30, 15);
    rect(g, '#7a6650', boxX, shelfY - 15, 30, 2);
    rect(g, '#c4b893', boxX + 9, shelfY - 10, 12, 5);
    const coilX = Math.round(w * 0.78), coilY = shelfY - 6;
    for (let r = 7; r >= 3; r -= 2) for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      rect(g, r % 4 === 3 ? '#1b1f1e' : '#3b2f2a', coilX + Math.cos(t) * r * 1.3, coilY + Math.sin(t) * r * 0.8, 1, 1);
    }
    const sx = Math.round(w * 0.56), sy = Math.round(shelfY + 16), sw = Math.round(w * 0.3), sh = Math.round(Math.min(46, (bench - 103 - sy) * 0.8));
    if (sh > 18) {
      rect(g, '#141c1c', sx + 2, sy + 2, sw, sh);
      rect(g, '#8f9a8c', sx, sy, sw, sh);
      rect(g, '#2f4a4f', sx + 3, sy + 3, sw - 6, 4);
      for (let i = 0; i < 4; i++) {
        const y = sy + 11 + i * ((sh - 14) / 4);
        line(g, '#3f5251', sx + 4, y, sw * 0.4, 0);
        rect(g, '#3f5251', sx + 4 + sw * 0.4, y - 2, 4, 4);
        line(g, '#3f5251', sx + 8 + sw * 0.4, y, sw * 0.3, 0);
      }
      rect(g, '#b3443a', sx + sw / 2 - 1, sy - 1, 3, 3);
    }
  }
  rect(g, '#4b4039', 0, bench - 7, w, h);
  for (let i = 0; i < w * 2; i++) rect(g, i % 3 ? '#665348' : '#393432', rand() * w, bench - 6 + rand() * (h - bench + 6), 2 + rand() * 15, 1);
  for (let y = bench + 8; y < h; y += 16) { rect(g, '#2c2c2a', 0, y, w, 2); rect(g, '#7b6451', 0, y + 2, w, 1); }
  // Swing-arm lamp: the shade casts a pool of amber across the receiver and worktop.
  const lamp = cx - 81 * receiverScale(w);
  line(g, '#1c2828', lamp - 32, bench - 9, 6, -45, 4);
  line(g, '#869185', lamp - 32, bench - 9, 6, -45);
  line(g, '#253232', lamp - 26, bench - 54, 22, -24, 4);
  line(g, '#98a093', lamp - 25, bench - 55, 20, -22);
  polygon(g, '#293a3a', [[lamp - 10, bench - 73], [lamp - 4, bench - 81], [lamp + 3, bench - 78], [lamp + 9, bench - 69], [lamp + 11, bench - 65], [lamp - 13, bench - 67]]);
  line(g, '#efd295', lamp - 12, bench - 67, 23, 2, 2);
  polygon(g, '#f7c78a13', [[lamp - 11, bench - 65], [lamp + 10, bench - 64], [lamp + 48, bench + 4], [lamp - 29, bench + 6]]);
  wash(g, lamp, bench - 60, 53, '#f7c78a52');
  // Cast metal suitcase receiver. Its scale, speaker grille and CRT are separate surfaces.
  g.save(); g.translate(cx, bench - 6);
  const scale = receiverScale(w);
  g.scale(scale, scale);
  polygon(g, '#302e2b', [[-70, 0], [65, -1], [76, 3], [79, 6], [-66, 6]]);
  rect(g, '#242c2b', -55, -2, 9, 5); rect(g, '#242c2b', 47, -2, 9, 5);
  polygon(g, '#2a3534', [[-67, -54], [-62, -61], [59, -61], [66, -55], [66, -4], [62, 0], [-64, 0], [-67, -3]]);
  polygon(g, '#818676', [[-65, -54], [-59, -60], [56, -60], [64, -54]]);
  rect(g, '#454f48', -63, -53, 125, 50); rect(g, '#8d9380', -63, -53, 125, 2);
  rect(g, '#626b5e', -60, -49, 118, 43);
  rect(g, '#9a9a80', -56, -61, 22, 2);
  rect(g, '#263131', -27, -68, 4, 9); rect(g, '#263131', 23, -68, 4, 9);
  rect(g, '#2d3635', -27, -69, 54, 4); rect(g, '#8a9180', -25, -69, 50, 1);
  for (let i = -19; i < 20; i += 3) rect(g, '#4c5348', i, -68, 1, 2);
  line(g, '#2a3434', 36, -61, 27, -35, 2); line(g, '#bcc3af', 38, -62, 25, -34);
  rect(g, '#293532', -58, -46, 43, 37); rect(g, '#414e46', -56, -44, 39, 33);
  for (let y = -43; y < -11; y += 3) for (let x = -55 + (y % 2); x < -18; x += 3) rect(g, '#202d29', x, y, 2, 1);
  rect(g, '#c0ad83', -52, -17, 14, 3);
  rect(g, '#d7ba82', -52, -17, 14, 1);
  for (let i = 0; i < 5; i++) rect(g, '#6b654e', -50 + i * 2, -16, 1, 1);
  rect(g, '#333c35', -11, -47, 66, 14); rect(g, '#a98b5a', -9, -45, 62, 10); rect(g, '#e3bd79', -8, -44, 60, 6);
  for (let i = 0; i < 29; i++) rect(g, '#615e48', -6 + i * 2, -44, 1, i % 5 === 0 ? 4 : 2);
  rect(g, '#f7ddad', -7, -38, 59, 1); rect(g, '#a84c3b', 18, -45, 1, 10);
  rect(g, '#323e37', -11, -31, 34, 21); rect(g, '#738673', -10, -30, 32, 19); rect(g, '#243d36', -9, -29, 30, 17);
  for (let x = -7; x < 21; x += 5) rect(g, '#364d40', x, -28, 1, 15);
  for (let y = -27; y < -13; y += 4) rect(g, '#364d40', -8, y, 28, 1);
  dial(g, 37, -21, 8); dial(g, 52, -20, 4);
  for (const x of [-60, 58]) for (const y of [-49, -6]) {
    rect(g, '#a2a490', x, y, 2, 2); rect(g, '#39433c', x, y + 1, 1, 1);
  }
  rect(g, '#eaad6d', 49, -29, 2, 2);
  for (const x of [-64, 59]) {
    rect(g, '#333c37', x, -53, 5, 5); rect(g, '#9b9d8a', x, -53, 4, 1);
    rect(g, '#333c37', x, -7, 5, 5);
  }
  for (let i = 0; i < 34; i++) rect(g, '#c6b99b70', -58 + rand() * 114, -53 + rand() * 2, 1, 1);
  g.restore();
  // Coiled test lead and folded service sheet on the near edge of the desk.
  const paper: Point[] = [[cx + 69, bench + 4], [cx + 99, bench + 2], [cx + 110, bench + 15], [cx + 78, bench + 18]];
  polygon(g, '#aaa387', paper);
  for (let i = 0; i < 4; i++) line(g, '#767969', cx + 75 + i * 2, bench + 7 + i * 2, 16 + i % 2 * 4, -1);
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = '#2b302b'; g.lineWidth = 2; g.beginPath();
    g.ellipse(cx - 84 + i * 2, bench + 6 + i, 15, 4, -0.1, 0, Math.PI * 2); g.stroke();
  }
  wash(g, cx - 40, bench - 28, 88, '#e4c58815');
  const shade = g.createRadialGradient(cx - 12, bench - 32, w * 0.14, cx, bench - 48, w * 0.65);
  shade.addColorStop(0, '#101a2000'); shade.addColorStop(1, '#101a208a');
  g.fillStyle = shade; g.fillRect(0, 0, w, h);
}

export const receiverScale = (w: number) => Math.min(1.38, w / 245);

function bookshelf(g: Ink, edge: number, back: number, h: number, seed: number) {
  const rand = seeded(seed);
  // Interpolate along the shelf so each book's spine follows the aisle perspective.
  const at = (u: number, v: number): Point => [
    Math.round(edge + (back - edge) * u),
    Math.round(h * (0.49 + (v - 0.49) * (1.27 - u * 0.88))),
  ];
  const panel = (color: string, u: number, v: number, width: number, height: number) =>
    polygon(g, color, [at(u, v), at(u + width, v), at(u + width, v + height), at(u, v + height)]);
  panel('#29282f', 0, 0, 1, 0.94);
  const spine = ['#515c60', '#645354', '#4f5057', '#665d5c', '#404854', '#5b6868', '#70605b', '#535d67', '#4c4049'];
  for (let row = 0; row < 5; row++) {
    const bottom = 0.195 + row * 0.175;
    panel('#1b202a', 0, bottom - 0.152, 1, 0.15);
    for (let u = 0.015; u < 0.98;) {
      const width = (0.016 + rand() * 0.027) * (1 - u * 0.6), height = 0.068 + rand() * 0.081;
      panel(spine[Math.floor(rand() * spine.length)], u, bottom - height, width, height);
      panel('#a298834d', u, bottom - height + 0.005, width, 0.006);
      if (rand() > 0.38) panel('#a99e87', u + width * 0.17, bottom - 0.024, width * 0.6, 0.008);
      if (rand() > 0.65) panel('#c7b99d55', u + width * 0.3, bottom - height + 0.025, width * 0.23, height * 0.35);
      u += width + 0.004 + (rand() > 0.93 ? 0.035 : 0);
    }
    panel('#5c514d', 0, bottom, 1, 0.022);
    panel('#88776a', 0, bottom, 1, 0.004);
    panel('#262631', 0, bottom + 0.022, 1, 0.013);
  }
  for (const u of [0.015, 0.42, 0.73, 0.97]) {
    panel('#423d40', u, 0, 0.017, 0.93); panel('#766b65', u, 0, 0.004, 0.93);
  }
  panel('#4d4648', 0, 0, 1, 0.035); panel('#8b7e74', 0, 0.031, 1, 0.005);
}

export function library(g: Ink, w: number, h: number) {
  const rand = seeded(2009), cx = Math.round(w / 2), win = Math.round(h * 0.32);
  sky(g, w, h, ['#171e2a', '#364551', '#252c37']);
  const glass = Math.min(30, w * 0.083);
  // High arched window, recessed surround, mullions and moonlit trees beyond the glass.
  for (let x = -glass - 4; x <= glass + 4; x++) {
    const arch = Math.sqrt(Math.max(0, (glass + 4) ** 2 - x * x));
    rect(g, '#192731', cx + x, win - arch, 1, arch + 36);
    if (Math.abs(x) > glass) continue;
    const arc = Math.sqrt(glass * glass - x * x);
    rect(g, '#799698', cx + x, win - arc, 1, arc + 32);
    const trees = win + 15 + Math.sin(x / 7) * 3 + Math.sin(x * 0.7) * 2;
    rect(g, '#536e75', cx + x, trees, 1, win + 32 - trees);
  }
  wash(g, cx + 4, win - 9, 26, '#c5d4b766');
  // Crescent moon and a few bright flecks in the transom.
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    if (x * x + y * y < 38 && (x - 3) ** 2 + (y + 2) ** 2 > 28) rect(g, '#d4d6bc', cx + glass * 0.28 + x, win - 11 + y, 1, 1);
  }
  for (const offset of [-0.52, 0, 0.52]) {
    const x = offset * glass, top = win - Math.sqrt(glass * glass - x * x);
    rect(g, '#354952', cx + x, top, 2, win + 33 - top);
  }
  for (const dy of [0, 16, 32]) rect(g, '#34454d', cx - glass, win + dy, glass * 2, 2);
  rect(g, '#697979', cx - glass - 5, win + 34, glass * 2 + 10, 2);
  const floor = h * 0.62;
  rect(g, '#45474c', 0, floor, w, h);
  for (let x = -w; x < w * 2; x += 30) line(g, '#2d333c', cx + (x - cx) * 0.18, floor, (x - cx) * 0.82, h - floor);
  for (let i = 1; i < h - floor; i = Math.ceil(i * 1.55) + 1) rect(g, '#353a41', 0, floor + i, w, 1);
  polygon(g, '#84989038', [[cx - glass, win + 34], [cx + glass, win + 34], [cx + glass + w * 0.15, h], [cx - w * 0.13, h]]);
  bookshelf(g, -w * 0.02, cx - w * 0.15, h, 33);
  bookshelf(g, w * 1.02, cx + w * 0.15, h, 57);
  const shadow = g.createLinearGradient(0, 0, w, 0);
  for (const [stop, color] of [[0, '#09111d99'], [0.29, '#17202718'], [0.48, '#17202700'], [0.65, '#17202708'], [1, '#090f1b99']] as const) shadow.addColorStop(stop, color);
  g.fillStyle = shadow; g.fillRect(0, 0, w, h);
  // An unlit pendant and a book still open in the near aisle.
  rect(g, '#19232c', cx, 0, 1, h * 0.085);
  polygon(g, '#232c33', [[cx - 3, h * 0.084], [cx + 3, h * 0.084], [cx + 9, h * 0.11], [cx - 9, h * 0.11]]);
  rect(g, '#778080', cx - 9, h * 0.11, 18, 1);
  const tx = cx - w * 0.20, ty = h * 0.70;
  polygon(g, '#73625b', [[tx + 4, ty - 1], [tx + 36, ty - 1], [tx + 47, ty + 7], [tx - 6, ty + 7]]);
  rect(g, '#493f40', tx - 6, ty + 7, 53, 3); rect(g, '#35333b', tx - 3, ty + 10, 3, 22); rect(g, '#35333b', tx + 42, ty + 10, 3, 18);
  polygon(g, '#b1a18a', [[tx + 7, ty], [tx + 16, ty - 1], [tx + 21, ty + 1], [tx + 19, ty + 5], [tx + 11, ty + 3], [tx + 4, ty + 4]]);
  polygon(g, '#908879', [[tx + 21, ty + 1], [tx + 29, ty - 1], [tx + 33, ty], [tx + 29, ty + 4], [tx + 19, ty + 5]]);
  for (let i = 0; i < 45; i++) rect(g, '#dfd7ae52', cx + (rand() - 0.5) * w * 0.36, h * (0.24 + rand() * 0.55), 1, 1);
}
