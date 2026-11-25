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
  // Foreground sorting bench, its ruler and the shadow under the warped lip.
  const bench = Math.round(h * .62);
  polygon(g, '#5d6053', [[0, bench + 9], [w, bench - 9], [w, h], [0, h]]);
  for (let i = 0; i < 8; i++) {
    const y = bench + 10 + i * (h - bench) / 7;
    line(g, '#393f39', 0, y, w, -18, 2);
    line(g, '#878774', 0, y + 2, w, -18);
  }
  line(g, '#d2b679', 0, bench + 10, w, -18, 3);
  for (let x = 3; x < w; x += 5) rect(g, '#655937', x, bench + 10 - x / w * 18, 1, x % 25 === 3 ? 3 : 1);
}

export function unsentLetters(g: Ink, w: number, h: number) {
  paperYard(g, w, h);
  rect(g, '#262e2b4d', 0, 0, w, h);
  // A close view of the opened bale lifts the envelopes above the dialogue box.
  const cx = Math.round(w / 2), cy = Math.round(h * .38);
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
  wash(g, cx + 3, cy - 12, 58, '#ffe0a726');
}
