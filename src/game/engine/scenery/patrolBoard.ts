import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

/** The second-floor landing after lights-out. A single exit lamp lights the notices. */
export function patrolBoard(g: Ink, w: number, h: number) {
  const rand = seeded(2205), cx = Math.round(w / 2);
  const floor = Math.round(h * .62), rail = Math.round(h * .49);
  sky(g, w, h, ['#182532', '#52626a', '#303c4a']);
  rect(g, '#384e54', 0, rail, w, floor - rail);
  rect(g, '#687776', 0, rail, w, 1);
  const corner = Math.round(w * .18);
  polygon(g, '#243640', [[0, 0], [corner, h * .10], [corner, floor], [0, h * .88]]);
  polygon(g, '#2d4248', [[0, h * .57], [corner, rail], [corner, floor], [0, h * .88]]);
  line(g, '#516563', 0, h * .57, corner, rail - h * .57);
  // Closed doors along the side passage, with thin glints on the wired glass.
  for (const [u, v] of [[.03, .50], [.62, .24]]) {
    const x = corner * u, dw = corner * v;
    const bottom = h * .88 - x / corner * (h * .88 - floor), top = h * (.13 + u * .055);
    const slope = -dw / corner * (h * .88 - floor);
    polygon(g, '#172831', [[x, top], [x + dw, top + 3], [x + dw, bottom + slope], [x, bottom]]);
    polygon(g, '#33444c', [[x + 2, top + 3], [x + dw - 2, top + 5], [x + dw - 2, bottom + slope - 2], [x + 2, bottom - 3]]);
    polygon(g, '#50646b', [[x + dw * .20, top + 8], [x + dw * .76, top + 9], [x + dw * .76, top + 20], [x + dw * .20, top + 21]]);
    line(g, '#758486', x + dw * .22, top + 18, dw * .29, -9);
    rect(g, '#91938a', x + dw * .72, (top + bottom) / 2, 3, 1);
  }
  const floorShade = g.createLinearGradient(0, floor, 0, h);
  floorShade.addColorStop(0, '#34474e'); floorShade.addColorStop(1, '#1d2b37');
  g.save();
  g.fillStyle = floorShade;
  g.beginPath(); g.moveTo(0, h * .88); g.lineTo(corner, floor); g.lineTo(w, floor); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.clip();
  for (let x = -w * .4; x < w * 1.5; x += Math.max(35, w / 7)) {
    line(g, '#2b3b45', cx + (x - cx) * .44, floor + 2, (x - cx) * .56, h - floor);
  }
  for (const d of [.12, .31, .63]) rect(g, '#43535b', corner * (1 - d), floor + d * (h - floor), w, 1);
  g.restore();
  line(g, '#1e2e36', corner, floor - 2, w - corner, 0, 3);

  const bw = Math.round(Math.min(196, w * .62)), bh = Math.round(Math.min(77, h * .34));
  const x = cx - Math.round(bw / 2), y = Math.round(h * .32 - bh / 2);
  rect(g, '#22343a', x - 4, y - 3, bw + 9, bh + 9);
  rect(g, '#88908a', x - 3, y - 3, bw + 6, bh + 6);
  rect(g, '#435656', x - 2, y - 2, bw + 4, bh + 4);
  rect(g, '#645c53', x, y, bw, bh);
  for (let i = 0; i < bw * 2; i++) rect(g, i % 2 ? '#8b776040' : '#383f3940', x + rand() * bw, y + rand() * bh, 2, 1);
  // An empty patch of cork and old pinholes remain between the two current notices.
  rect(g, '#756c5e', x + bw * .28, y + bh * .12, bw * .12, bh * .24);
  for (const [u, v] of [[.30, .14], [.38, .14], [.28, .63], [.73, .76]]) rect(g, '#393e38', x + bw * u, y + bh * v, 1, 1);
  function sheet(u: number, v: number, width: number, height: number, tint: string) {
    const px = Math.round(x + bw * u), py = Math.round(y + bh * v);
    rect(g, '#3d423e', px + 2, py + 2, width, height);
    rect(g, tint, px, py, width, height);
    polygon(g, '#c0c0ac', [[px + width - 5, py + height], [px + width, py + height - 5], [px + width - 5, py + height - 5]]);
    rect(g, '#76675b', px + width / 2, py, 2, 2);
    return [px, py];
  }
  const tableW = Math.round(bw * .20), [tx, ty] = sheet(.045, .22, tableW, bh * .60, '#9da497');
  rect(g, '#607476', tx + 3, ty + 5, tableW - 6, 3);
  for (let i = 0; i < 5; i++) rect(g, '#718182', tx + 3, ty + 12 + i * 5, tableW - 6, 1);
  for (let i = 1; i <= 3; i++) rect(g, '#788482', tx + tableW * i / 4, ty + 12, 1, 20);
  const pw = Math.round(bw * .32), [px, py] = sheet(.42, .11, pw, bh * .73, '#c1bda6');
  rect(g, '#727e77', px + pw * .20, py + 6, pw * .60, 2);
  for (let i = 0; i < 7; i++) {
    const inkY = py + 13 + i * 4;
    // Gaps in the typesetting hint at where the six letters came from.
    rect(g, '#909385', px + 4, inkY, pw * .23, 1);
    if (i % 2) rect(g, '#939789', px + pw * .42, inkY, pw * .12, 1);
    rect(g, '#909385', px + pw * .64, inkY, pw * .22, 1);
  }
  const [sx, sy] = sheet(.80, .30, bw * .14, bh * .40, '#929ea0');
  rect(g, '#667b80', sx + 3, sy + 6, bw * .14 - 6, 4);
  rect(g, '#748688', sx + 3, sy + 14, bw * .14 - 7, 1);
  rect(g, '#949b8c', x - 4, y + bh + 1, bw + 8, 1);
  // A small evacuation pictogram beside the board and its reflection in the waxed tile.
  const ex = x + bw + Math.max(6, w * .018), ey = y + 2;
  rect(g, '#243b3d', ex - 2, ey - 1, 18, 10);
  rect(g, '#8cb2a0', ex, ey, 14, 7);
  rect(g, '#d6debc', ex + 2, ey + 3, 8, 1);
  line(g, '#d6debc', ex + 7, ey + 1, 3, 2);
  line(g, '#d6debc', ex + 10, ey + 3, -3, 2);
  wash(g, ex + 6, ey + 3, 19, '#a1d2ad45');
  for (let i = 0; i < 18; i++) rect(g, '#a8c4aa22', ex - 5 + rand() * 14, floor + 3 + rand() * 14, 2 + rand() * 7, 1);
}
