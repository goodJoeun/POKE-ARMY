import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

// Baling wire bites into the newspapers, leaving their loose corners turned up.
function bale(g: Ink, x: number, y: number, w: number, h: number) {
  rect(g, '#494c47', x, y, w, h);
  for (let i = 1; i < h - 1; i += 2) {
    const inset = (i * 7 + w) % 4;
    rect(g, i % 3 ? '#aaa58d' : '#c9bfa0', x + inset, y + i, w - inset - 1, 1);
    rect(g, '#72776b', x + w / 3 + i % 5, y + i, w / 5, 1);
  }
  for (const u of [.23, .76]) {
    rect(g, '#525c55', x + w * u, y, 2, h);
    rect(g, '#bdc0a0', x + w * u, y + 1, 1, h - 3);
  }
}

/** 바닥에 떨어진 신문지 한 장: 비스듬히 누워 있고, 인쇄된 줄 몇 개와 그늘이 있다 */
function scrap(g: Ink, x: number, y: number, k: number, rand: () => number) {
  const w = 9 * k, d = 4 * k, tilt = (rand() - 0.5) * 6 * k;
  const shade = ['#d8cfb4', '#c9c0a4', '#b9b49c', '#e0d6bb'][Math.floor(rand() * 4)];
  polygon(g, '#6c695c', [[x + 1, y + 1], [x + w + 1, y + tilt + 1], [x + w + 1 - d * 0.4, y + tilt + d + 1], [x + 1 - d * 0.4, y + d + 1]]);
  polygon(g, shade, [[x, y], [x + w, y + tilt], [x + w - d * 0.4, y + tilt + d], [x - d * 0.4, y + d]]);
  for (let i = 1; i < 3; i++) line(g, '#8f8a74', x + 1 - i * 0.3, y + i * d / 3, w * (0.4 + rand() * 0.4), tilt * 0.5);
}

/** 바닥에 떨어진 봉투: 납작하게 눕혀 보이고, 접힌 날개 선이 있다 */
function lyingEnvelope(g: Ink, x: number, y: number, k: number, shade: string) {
  const w = 22 * k, d = 9 * k, sk = 3 * k;
  polygon(g, '#3e4038', [[x + 1, y + 2], [x + w + 1, y + 2], [x + w + 1 - sk, y + d + 2], [x + 1 - sk, y + d + 2]]);
  polygon(g, shade, [[x, y], [x + w, y], [x + w - sk, y + d], [x - sk, y + d]]);
  line(g, '#9a846c', x, y, w / 2 - sk / 2, d * 0.6);
  line(g, '#9a846c', x + w / 2 - sk / 2, y + d * 0.6, w / 2 + sk / 2, -d * 0.6);
}

export function paperYard(g: Ink, w: number, h: number) {
  const rand = seeded(610), fence = Math.round(h * .39), ground = Math.round(h * .54);
  sky(g, w, h, ['#8caaa6', '#d6caa9', '#b7a383']);
  for (let x = -8; x < w; x += 7) {
    const crown = fence - 12 - rand() * 23;
    rect(g, '#809588', x, crown, 12, fence - crown);
    rect(g, '#667d73', x + 2, crown + 6, 6, fence - crown);
  }
  rect(g, '#87968b', 0, fence - 10, w, ground - fence + 10);
  for (let x = 0; x < w; x += 6) {
    rect(g, '#5e726e', x, fence - 10, 1, ground - fence + 10);
    rect(g, '#b1b6a2', x + 1, fence - 10, 1, ground - fence + 10);
  }
  rect(g, '#c5c5ab', 0, fence - 12, w, 2);
  rect(g, '#9d9884', 0, ground, w, h - ground);
  for (let i = 0; i < w * 1.6; i++) {
    rect(g, i % 3 ? '#777b6f77' : '#d6c7a288', rand() * w, ground + rand() * (h - ground), 1 + rand() * 3, 1);
  }
  for (let x = -18; x < w + 10; x += 52) {
    const top = ground - 16 + Math.round(rand() * 5);
    bale(g, x, top, 51, 18);
    if (x < w * .34 || x > w * .7) bale(g, x + 7, top - 13, 40, 14);
  }
  // 앞마당: 흩어진 신문지 · 노끈 뭉치 · 폐지를 실은 손수레. 세로로 긴 화면에서도 바닥이 비지 않게 깊이별로 흩는다
  const items: [number, () => void][] = [];
  for (let i = 0; i < Math.round(w * 0.06 + (h - ground) * 0.08); i++) {
    const v = rand(), y = ground + 8 + v * (h - ground - 10), k = 0.7 + v * 1.3, x = rand() * w;
    items.push([y, () => scrap(g, x, y, k, rand)]);
  }
  for (const u of [0.18, 0.47]) {
    const y = ground + (h - ground) * (0.3 + u * 0.5), x = w * u, r = 3 + (y - ground) / (h - ground) * 4;
    items.push([y, () => {
      for (let a = 0; a < 3; a++) {
        rect(g, '#7a6a48', x - r + a, y - a, (r - a) * 2, 1);
        rect(g, '#b49a68', x - r + a + 1, y - a, (r - a) * 2 - 2, 1);
      }
    }]);
  }
  {
    const cy = Math.round(ground + Math.min(h - ground, w * 0.5) * 0.62), k = Math.max(1, Math.min(1.6, w / 300));
    const cx = Math.round(w * 0.76);
    items.push([cy, () => {
      const bw = Math.round(46 * k), wr = Math.round(7 * k);
      line(g, '#4a4436', cx - bw / 2 - 26 * k, cy - 18 * k, 28 * k, 6 * k, 2);
      rect(g, '#3e3a30', cx - bw / 2, cy - 14 * k, bw, 4 * k);
      rect(g, '#5d5544', cx - bw / 2, cy - 15 * k, bw, 2);
      bale(g, cx - bw / 2 + 2, cy - 31 * k, bw - 4, Math.round(16 * k));
      bale(g, cx - bw / 2 + 6, cy - 43 * k, bw - 14, Math.round(12 * k));
      for (let y = -wr; y <= wr; y++) for (let x = -wr; x <= wr; x++) {
        const d = x * x + y * y;
        if (d <= wr * wr && d >= (wr - 2) * (wr - 2)) rect(g, '#2f3130', cx + x, cy - wr + y, 1, 1);
      }
      rect(g, '#8a8a80', cx - 1, cy - wr - 1, 3, 3);
      rect(g, '#00000030', cx - bw / 2, cy + 1, bw + 4, 2);
    }]);
  }
  items.sort((a, b) => a[0] - b[0]).forEach(([, draw]) => draw());
}

export function unsentLetters(g: Ink, w: number, h: number) {
  paperYard(g, w, h);
  rect(g, '#262e2b4d', 0, 0, w, h);
  // A close view of the opened bale lifts the envelopes above the dialogue box.
  const cx = Math.round(w / 2), cy = Math.round(h * .38);
  const lip = Math.round(h * .66);
  polygon(g, '#807c69', [[cx - 96, cy + 12], [cx + 93, cy + 12], [w, lip], [0, lip]]);
  rect(g, '#565a4d', 0, lip, w, h - lip);
  line(g, '#ad9f7b', 0, lip, w, 0, 2);
  for (let i = 1; i < 6; i++) {
    const y = cy + 12 + (lip - cy - 12) * (i / 6) ** 1.5;
    const edge = (lip - y) / (lip - cy - 12);
    const left = (cx - 96) * edge;
    line(g, '#5a6053', left, y, w - left - (w - cx - 93) * edge, 0);
  }
  rect(g, '#595d50', cx - 73, cy + 28, 154, 6);
  bale(g, cx - 77, cy - 17, 154, 48);
  for (const [dx, dy, shade] of [[-54, -18, '#b7a087'], [-36, -27, '#c6ae8b'], [-17, -15, '#d2bea0']] as const) {
    const x = cx + dx, y = cy + dy;
    rect(g, '#534d43', x + 2, y + 3, 65, 33);
    rect(g, shade, x, y, 65, 32);
    line(g, '#9a846c', x + 1, y + 30, 24, -16);
    line(g, '#9a846c', x + 63, y + 30, -24, -16);
    polygon(g, '#e0cbaa', [[x, y], [x + 64, y], [x + 33, y + 19]]);
    line(g, '#ac957b', x, y, 32, 19);
    line(g, '#ac957b', x + 32, y + 19, 32, -19);
  }
  // 쏟아진 봉투들이 앞바닥까지 흩어져 있고, 한 통은 열려서 편지지가 비어져 나왔다
  for (const [u, v, shade] of [[0.08, 0.1, '#c6ae8b'], [0.3, 0.32, '#d2bea0'], [0.62, 0.14, '#b7a087'], [0.8, 0.42, '#c6ae8b'], [0.46, 0.62, '#b7a087']] as const) {
    const y = lip + 6 + v * Math.min(h - lip - 12, 90), k = 0.9 + v * 0.9;
    lyingEnvelope(g, w * u, y, k, shade);
  }
  {
    const lx = w * 0.18, ly = lip + 6 + 0.5 * Math.min(h - lip - 12, 90);
    polygon(g, '#3e4038', [[lx + 2, ly + 2], [lx + 30, ly - 1], [lx + 32, ly + 15], [lx + 4, ly + 18]]);
    polygon(g, '#e8dcc0', [[lx, ly], [lx + 28, ly - 3], [lx + 30, ly + 13], [lx + 2, ly + 16]]);
    for (let i = 0; i < 4; i++) for (let x = 0; x < 22; x += 2) rect(g, '#6b6a78', lx + 4 + x, ly + 1 + i * 3.4 - x * 0.1 + (x % 4 ? 0 : 1), 2, 1);
  }
  wash(g, cx + 3, cy - 12, 58, '#ffe0a726');
}
