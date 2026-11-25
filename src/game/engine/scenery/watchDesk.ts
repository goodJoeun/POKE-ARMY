import { type Ink, type Point, line, polygon, rect, seeded, sky, wash } from './pixels';

/** A recruit's view over the open ledger at the midnight reporting desk. */
export function watchDesk(g: Ink, w: number, h: number) {
  const rand = seeded(1470);
  const cx = Math.round(w / 2), rail = Math.round(h * 0.48);
  sky(g, w, h, ['#16252f', '#39494b', '#263238']);
  const boardW = Math.min(191, w * 0.57), boardH = Math.min(79, h * 0.32);
  const bx = cx - boardW * 0.68, by = rail - boardH - 7;
  rect(g, '#19272b', bx - 4, by - 3, boardW + 8, boardH + 9);
  rect(g, '#737b73', bx - 3, by - 3, boardW + 6, boardH + 6);
  rect(g, '#394d4d', bx, by, boardW, boardH);
  const mapW = boardW * 0.68;
  g.save();
  g.beginPath();
  g.rect(bx + 4, by + 4, mapW, boardH - 8);
  g.clip();
  rect(g, '#69796b', bx + 4, by + 4, mapW, boardH - 8);
  // Nested contour lines bend around two ridges, with a stream in the valley.
  for (const [ox, oy] of [[0.18, 0.25], [0.86, 0.83]]) {
    for (let ring = 1; ring <= 8; ring++) {
      let last: Point | undefined;
      for (let step = 0; step <= 64; step++) {
        const a = step * Math.PI / 32;
        const r = ring * (3.7 + 0.42 * Math.sin(3 * a + ring * 0.09) + 0.62 * Math.sin(5 * a));
        const p: Point = [bx + mapW * ox + r * 1.5 * Math.cos(a), by + boardH * oy + r * Math.sin(a)];
        if (last) line(g, ring % 3 ? '#778671' : '#566d62', last[0], last[1], p[0] - last[0], p[1] - last[1]);
        last = p;
      }
    }
  }
  for (let y = 0; y < boardH; y++) {
    const x = bx + mapW * (0.58 - 0.25 * y / boardH) + 4 * Math.sin(y / 8);
    rect(g, '#95a69b', x, by + y, 2, 1);
  }
  for (const [u, v] of [[.28, .48], [.58, .32], [.70, .72]]) {
    rect(g, '#714f49', bx + u * mapW, by + v * boardH, 3, 3);
    rect(g, '#d2a98a', bx + u * mapW, by + v * boardH, 2, 1);
  }
  g.restore();
  const sx = bx + mapW + 8;
  rect(g, '#a0a18c', sx, by + 7, boardW - mapW - 12, boardH - 15);
  for (let i = 0; i < 9; i++) {
    const y = by + 13 + i * (boardH - 24) / 9;
    rect(g, '#727e71', sx + 2, y, boardW - mapW - 16, 1);
    rect(g, '#6c7167', sx + 3, y + 2, 2 + rand() * 5, 1);
  }
  for (const side of [0.24, 0.67]) rect(g, '#798375', sx + (boardW - mapW - 12) * side, by + 11, 1, boardH - 21);
  rect(g, '#5d6e69', 0, rail - 1, w, 2);
  rect(g, '#455255', 0, rail + 1, w, h - rail);
  // Folders on the high shelf behind the lamp.
  const shelf = rail - 11;
  for (let x = bx + boardW + 10; x < w + 5; x += 7) {
    const bh = 15 + Math.floor(rand() * 6);
    rect(g, rand() < .6 ? '#415354' : '#5b5252', x, shelf - bh, 6, bh);
    rect(g, '#a0a69a', x + 1, shelf - bh + 4, 3, 5);
    rect(g, '#28383c', x + 2, shelf - 4, 2, 2);
  }
  rect(g, '#727871', bx + boardW + 7, shelf, w, 2);
  const desk = Math.round(h * .56);
  rect(g, '#786556', 0, desk, w, h - desk);
  for (let i = 0; i < w * 1.25; i++)
    rect(g, i % 2 ? '#926f552f' : '#443f402f', rand() * w, desk + rand() * (h - desk), 3 + rand() * 27, 1);
  const lightX = cx + w * .27;
  wash(g, lightX, desk + 5, Math.min(130, w * .44), '#efc47f65');
  // The shade, elbow joints, and the hot underside of a switched-on task lamp.
  const ly = desk - Math.min(41, h * .17), arm = Math.min(w * .08, 27);
  rect(g, '#3e4340', lightX, desk + 1, arm, 4);
  line(g, '#313d3e', lightX + arm * .66, desk + 1, arm * .32, -20, 3);
  line(g, '#89938c', lightX + arm * .66, desk, arm * .32, -20);
  line(g, '#374447', lightX + arm, desk - 20, -arm, ly - desk + 20, 3);
  polygon(g, '#404f4d', [[lightX - 11, ly + 1], [lightX - 4, ly - 5], [lightX + 2, ly - 6], [lightX + 8, ly + 1], [lightX + 8, ly + 8], [lightX - 13, ly + 8]]);
  rect(g, '#ffe4a0', lightX - 13, ly + 8, 22, 2);
  wash(g, lightX - 3, ly + 11, 19, '#ffd29155');

  // A dark cloth binding and two ruled pages curling up at the spine.
  const bw = Math.min(w * .30, 83), top = desk + 3, bh = Math.min(41, h * .17);
  polygon(g, '#48423d', [[cx - bw, top + 6], [cx + bw * .83, top - 2], [cx + bw + 6, top + bh - 2], [cx - bw - 9, top + bh + 8]]);
  polygon(g, '#354646', [[cx - bw, top + 2], [cx + bw * .83, top - 5], [cx + bw + 4, top + bh - 5], [cx - bw - 10, top + bh + 5]]);
  for (const side of [-1, 1]) {
    const outer = side < 0 ? -bw : bw * .82, slope = side < 0 ? 3 : -5;
    polygon(g, side < 0 ? '#c3b799' : '#dfcfab', [[cx, top + 1], [cx + outer, top + slope], [cx + outer + side * 7, top + bh + slope - 3], [cx - 1, top + bh]]);
    for (let i = 1; i < 8; i++) {
      const y = top + bh * i / 8;
      line(g, '#998f7c', cx + side * 4, y, outer - side * 7, slope - 1);
      if (i < 5) for (let j = 0; j < 4; j++) {
        const offset = .14 + j * .16;
        rect(g, '#656861', cx + offset * outer, y - 2 + slope * offset, 2 + rand() * 4, 1);
      }
    }
  }
  line(g, '#80755e', cx, top + 1, -1, bh - 1);
  line(g, '#474c50', cx + bw * .52, top + bh * .76, bw * .28, -9, 2);
  rect(g, '#d3c7a9', cx + bw * .52 - 1, top + bh * .76 + 1, 2, 1);
}
