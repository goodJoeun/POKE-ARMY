import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

/** The same bedroom as the playable opening, seen from beside the desk after lights out. */
export function bedtime(g: Ink, w: number, h: number) {
  const rand = seeded(2214);
  const sill = Math.round(h * 0.39);
  const wx = Math.round(w * 0.46), ww = Math.min(w * 0.36, 120);
  const wh = Math.min(h * 0.32, 79), wy = sill - wh;
  sky(g, w, h, ['#172338', '#36455a', '#19283a']);
  const floorY = Math.round(h * 0.65);
  for (let x = 4; x < w; x += 7) rect(g, '#7f869011', x, 0, 1, floorY);
  rect(g, '#495360', 0, floorY - 4, w, 1);
  rect(g, '#263240', 0, floorY - 3, w, 4);
  rect(g, '#303b4b', 0, floorY + 1, w, h - floorY);
  for (let y = floorY + 4, row = 0; y < h; row++) {
    const depth = 5 + row * 2;
    rect(g, '#263342', 0, y, w, 1);
    for (let x = (row % 3) * 23; x < w; x += 91) {
      line(g, '#2a3645', x, y + 1, -depth * 0.7, depth);
      rect(g, '#55607055', x + 15, y + 3, 18, 1);
    }
    y += depth;
  }
  polygon(g, '#9da9b01c', [[w * .34, floorY + 4], [w * .64, floorY + 4], [w * .38, h], [0, h]]);
  rect(g, '#121e31', wx - 4, wy - 4, ww + 9, wh + 11);
  const glass = g.createLinearGradient(0, wy, 0, sill);
  glass.addColorStop(0, '#1a294d'); glass.addColorStop(1, '#977e8c');
  g.fillStyle = glass; g.fillRect(wx, wy, ww, wh);
  for (let i = 0; i < 42; i++) rect(g, '#c3d1d3', wx + rand() * ww, wy + rand() * wh * 0.68, 1, 1);
  const mx = wx + ww * 0.69, my = wy + wh * 0.25;
  wash(g, mx, my, 14, '#ffebba34');
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
    if (x * x + y * y <= 25 && (x - 3) ** 2 + (y + 2) ** 2 > 19) rect(g, '#fff0c7', mx + x, my + y, 1, 1);
  }
  for (let x = 0; x < ww;) {
    const bw = 8 + Math.floor(rand() * 14), roof = sill - 5 - Math.floor(rand() * 12);
    const visible = Math.min(bw, ww - x);
    rect(g, '#364156', wx + x, roof, visible, sill - roof);
    for (let j = 2; j < visible - 1; j += 4) if (rand() > 0.4) rect(g, '#c9a58c', wx + x + j, roof + 3, 2, 2);
    x += bw;
  }
  for (const x of [wx, wx + ww / 2, wx + ww]) {
    rect(g, '#334355', x, wy, 3, wh);
    rect(g, '#8896a3', x, wy, 1, wh);
  }
  rect(g, '#51616e', wx, wy + wh * 0.27, ww, 2);
  rect(g, '#abb4b4', wx - 4, sill, ww + 9, 2);
  rect(g, '#4b5968', wx - 3, sill + 2, ww + 7, 3);
  for (const side of [0, 1]) {
    const x = side ? wx + ww + 2 : wx - 1, d = side ? -1 : 1;
    polygon(g, '#556078', [[x - d * 4, wy - 3], [x + d * ww * 0.23, wy - 3], [x + d * ww * 0.19, wy + 9], [x + d * 3, sill - wh * 0.36], [x + d * 8, sill + 5], [x - d * 5, sill + 8]]);
    line(g, '#9293a5', x + d * ww * 0.17, wy - 2, -d * ww * 0.14, wh * 0.62);
    line(g, '#a49a8a', x - d * 3, sill - wh * 0.36, d * 7, -1);
  }
  line(g, '#9a9ca5', wx - 6, wy - 5, ww + 15, 0);

  // Shelved paperbacks and the notice, left on the desk when the lamp went out.
  const deskY = h * 0.48, shelfY = h * 0.20;
  for (let x = 4; x < w * 0.26;) {
    const bh = 9 + rand() * 9, bw = 2 + rand() * 4;
    rect(g, ['#545c6a', '#716370', '#646f74', '#455365'][Math.floor(rand() * 4)], x, shelfY - bh, bw, bh);
    rect(g, '#9e9b925c', x, shelfY - 4, bw - 1, 1);
    x += bw + 1;
  }
  rect(g, '#697481', 0, shelfY, w * 0.29, 2);
  rect(g, '#243145', 0, shelfY + 2, w * 0.29, 3);
  for (const x of [w * 0.04, w * 0.24]) line(g, '#364353', x, shelfY + 9, 6, -6, 2);
  polygon(g, '#716a6c', [[0, deskY - 4], [w * 0.29, deskY - 4], [w * 0.35, deskY + 5], [0, deskY + 8]]);
  rect(g, '#393b49', 0, deskY + 8, w * 0.35, 5);
  rect(g, '#222d3c', w * 0.30, deskY + 12, 4, h * 0.23);
  rect(g, '#354151', w * 0.03, deskY + 12, w * .115, h * .18);
  for (let drawer = 0; drawer < 2; drawer++) {
    const dy = deskY + 14 + drawer * h * .081;
    rect(g, '#444c5a', w * .035, dy, w * .103, h * .072);
    rect(g, '#848487', w * .07, dy + 4, w * .033, 1);
  }
  const lx = w * 0.09;
  rect(g, '#303b48', lx - 7, deskY - 2, 14, 3);
  line(g, '#86909a', lx, deskY - 4, -3, -12, 2);
  line(g, '#657584', lx - 3, deskY - 16, 7, -9, 2);
  polygon(g, '#38495a', [[lx, deskY - 25], [lx + 5, deskY - 28], [lx + 11, deskY - 23], [lx + 13, deskY - 18], [lx - 1, deskY - 20]]);
  line(g, '#889196', lx - 1, deskY - 20, 14, 2);
  const paperX = w * 0.17;
  polygon(g, '#c0b5a0', [[paperX, deskY - 2], [paperX + 20, deskY - 3], [paperX + 26, deskY + 2], [paperX + 4, deskY + 4]]);
  line(g, '#827e78', paperX + 2, deskY - 2, 10, 3);
  rect(g, '#946e69', paperX + 17, deskY - 2, 3, 2);
  // Pillow, cropped hair, turned-up quilt and the rail nearest the viewer.
  // The head is drawn at a fixed pixel size, so the bed length is fixed in pixels too (about six heads
  // of body under the quilt, counting the pillow) instead of stretching with the screen width.
  const headX = w * 0.77, bedY = h * 0.54, foot = Math.max(w * 0.29, headX - 92);
  polygon(g, '#202c3c', [[foot - 11, bedY + 43], [w * .88, bedY + 25], [w * .96, bedY + 32], [foot, bedY + 53]]);
  rect(g, '#313444', w * .938, bedY + 7, 5, h * .135);
  polygon(g, '#4b4955', [[foot - 12, bedY + 29], [w * .96, bedY + 6], [w * .96, bedY + 11], [foot - 12, bedY + 36]]);
  rect(g, '#2b3545', w * 0.87, bedY - 18, 5, h * 0.24);
  polygon(g, '#737c87', [[foot + 12, bedY + 4], [w * 0.87, bedY - 6], [w * 0.96, bedY + 7], [foot - 10, bedY + 24]]);
  polygon(g, '#afb0a7', [[headX - 11, bedY - 5], [headX + 13, bedY - 8], [headX + 22, bedY - 2], [headX + 12, bedY + 4], [headX - 13, bedY + 5], [headX - 19, bedY]]);
  polygon(g, '#c79e87', [[headX - 7, bedY - 6], [headX - 4, bedY - 9], [headX + 3, bedY - 9], [headX + 8, bedY - 4], [headX + 6, bedY], [headX - 4, bedY + 1], [headX - 8, bedY - 2]]);
  polygon(g, '#3c3844', [[headX - 5, bedY - 9], [headX + 2, bedY - 11], [headX + 8, bedY - 7], [headX + 9, bedY - 3], [headX + 5, bedY], [headX + 2, bedY - 4], [headX - 4, bedY - 6]]);
  line(g, '#715d60', headX - 6, bedY - 3, 2, 0);
  polygon(g, '#556881', [[foot + 17, bedY + 1], [headX - 24, bedY - 7], [headX - 13, bedY - 5], [headX - 6, bedY + 3], [headX + 7, bedY + 7], [headX + 6, bedY + 17], [foot - 9, bedY + 34], [foot - 14, bedY + 20]]);
  line(g, '#a4adad', foot + 17, bedY + 1, headX - foot - 40, -8, 2);
  const folds = Math.max(3, Math.round((headX - foot) / 22));
  for (let i = 0; i < folds; i++) {
    const u = i / folds, x = foot + 17 + (headX - foot - 36) * u, y = bedY + 2 - 8 * u;
    polygon(g, '#41546c', [[x, y], [x + 4, y + 3], [x - 8, y + 20], [x - 13, y + 23]]);
  }
  line(g, '#656377', foot - 12, bedY + 32, w * 0.95 - foot, -16, 3);
  rect(g, '#303344', foot - 11, bedY + 35, 5, h * 0.22);
}
