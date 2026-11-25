import { type Ink, line, polygon, rect, wash } from './pixels';

/** Facing the locked duty room. The tiny wire-glass pane is the only light left on. */
export function emptyDutyHall(g: Ink, w: number, h: number) {
  const cx = Math.round(w * .49), vanY = Math.round(h * .39);
  const farL = cx - 30, farR = cx + 32, ceil = vanY - 42, sill = vanY + 19;
  rect(g, '#18252d', 0, 0, w, h);
  polygon(g, '#293841', [[0, 0], [farL, ceil], [farL, sill], [0, h * .87]]);
  polygon(g, '#34454b', [[w, 0], [farR, ceil], [farR, sill], [w, h * .87]]);
  rect(g, '#39484d', farL, ceil, farR - farL, sill - ceil);
  polygon(g, '#243238', [[0, h * .87], [farL, sill], [farR, sill], [w, h * .87], [w, h], [0, h]]);
  for (const [near, far] of [[0, farL], [w, farR]]) {
    const slope = near - far;
    for (const d of [.14, .40, .78]) {
      const x = far + slope * d, y = sill + (h * .87 - sill) * d;
      const x2 = far + slope * (d + .10), y2 = sill + (h * .87 - sill) * (d + .10);
      const top = ceil + 9 - d * h * .13, top2 = top - h * .013;
      polygon(g, '#17282f', [[x, top], [x2, top2], [x2, y2], [x, y]]);
      line(g, '#64716c', x, top, x2 - x, top2 - top);
      rect(g, '#92998a', x + (x2 - x) * .7, (top + y) / 2, 2, 1);
    }
    line(g, '#73817b', far, vanY, slope, h * .50 - vanY);
    line(g, '#15252d', far, sill, slope, h * .87 - sill, 2);
  }
  rect(g, '#18282e', cx - 12, sill - 44, 25, 44);
  rect(g, '#485954', cx - 10, sill - 42, 21, 41);
  rect(g, '#a2a48a', cx - 7, sill - 37, 14, 12);
  for (let i = 0; i < 3; i++) line(g, '#646f64', cx - 7, sill - 35 + i * 3, 13, -2);
  rect(g, '#cbc4a2', cx + 5, sill - 17, 4, 1);
  rect(g, '#c4c2a6', cx - 8, ceil + 4, 16, 3);
  wash(g, cx, vanY - 12, 35, '#dbd4a526');
  for (const d of [.14, .32, .62, .92]) {
    const y = sill + (h - sill) * d;
    line(g, '#415052', 0, y, w, 0);
    rect(g, '#85887355', cx - 6 - d * 9, y - 3, 13 + d * 18, 1);
  }
  // Scratches on the wax trace the arc after the visitor has gone.
  for (let x = -28; x <= 28; x++) {
    const y = sill + h * .12 + 5 * (1 - (x / 28) ** 2);
    rect(g, '#929180', cx + x, y, 1, 1);
  }
}

export function pendulumHall(g: Ink, w: number, h: number) {
  emptyDutyHall(g, w, h);
  const x = Math.round(w * .58), y = Math.round(h * .36);
  // Sleeve and curled fingers end at the fine chain. The officer stays out of frame.
  polygon(g, '#252631', [[w, 0], [w, h * .19], [x + 26, y - 46], [x + 16, y - 61], [w * .86, 0]]);
  line(g, '#596069', x + 18, y - 61, 10, 14, 3);
  polygon(g, '#b6a37e', [[x + 18, y - 59], [x + 25, y - 49], [x + 14, y - 45],
    [x + 11, y - 39], [x + 6, y - 40], [x + 9, y - 48], [x + 2, y - 44], [x, y - 47]]);
  line(g, '#e5ce9e', x + 11, y - 44, 3, -6);
  line(g, '#675c4a', x + 9, y - 40, -9, 36, 2);
  for (let i = 0; i < 12; i++) rect(g, '#d1bc88', x + 9 - i * .75, y - 40 + i * 3, 1, 2);
  wash(g, x, y + 4, 22, '#f2c97d32');
  polygon(g, '#5d503e', [[x, y - 7], [x + 10, y], [x + 10, y + 9], [x, y + 20], [x - 10, y + 8], [x - 10, y]]);
  polygon(g, '#b99b69', [[x, y - 5], [x + 8, y + 1], [x + 8, y + 8], [x, y + 16], [x - 8, y + 7], [x - 8, y + 1]]);
  polygon(g, '#e8d095', [[x, y - 4], [x + 1, y + 4], [x, y + 15], [x - 6, y + 6]]);
  rect(g, '#fff0bf', x - 5, y, 4, 2);
}
