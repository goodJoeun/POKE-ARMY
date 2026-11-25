import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

/** Early light from the louvers falls across the communal washstand. */
export function washroom(g: Ink, w: number, h: number) {
  const rand = seeded(2831);
  const cx = Math.round(w / 2), counter = Math.round(h * 0.56);
  const mw = Math.min(126, Math.round(w * 0.54)), mh = Math.min(86, Math.round(h * 0.36));
  const mx = Math.round(cx - mw / 2), my = Math.round(h * 0.32 - mh / 2);
  sky(g, w, h, ['#627f83', '#839998', '#3f585c']);

  const tileSize = Math.max(13, Math.round(mh / 4));
  for (let row = 0; row * tileSize <= counter; row++) {
    for (let x = cx % tileSize - tileSize; x < w; x += tileSize) {
      const y = row * tileSize;
      const pool = y > counter - 2 * tileSize ? ['#668787', '#628484', '#648686'] : ['#9cafa8', '#a2b3aa', '#99ada7'];
      rect(g, pool[Math.floor(rand() * 3)], x + 1, y + 1, tileSize - 1, tileSize - 1);
      rect(g, '#e4e6ce48', x + 2, y + 2, tileSize - 3, 1);
      if (rand() > 0.58) rect(g, '#e7ebcf5c', x + 2, y + 3, 1, 3 + rand() * 4);
    }
  }
  const wx = mx - Math.min(70, w * 0.16) - 14, wy = my + 3;
  const ww = mx - wx - 19, wh = mh - 5;
  rect(g, '#5c7378', wx - 2, wy - 2, ww + 6, wh + 7);
  rect(g, '#c5c9b4', wx, wy, ww, wh);
  rect(g, '#516f79', wx + 3, wy + 3, ww - 6, wh - 6);
  for (let y = wy + 4; y < wy + wh - 5; y += 9) {
    rect(g, '#9bb9b4', wx + 4, y, ww - 8, 6);
    rect(g, '#d9dfbe', wx + 4, y, ww - 8, 2);
    rect(g, '#799a9c', wx + 4, y + 5, ww - 8, 2);
    polygon(g, '#f6e3b314', [[wx + 6, y], [wx + ww - 5, y], [wx + ww + 27, y + 18], [wx + 36, y + 18]]);
  }
  rect(g, '#677a7a', wx - 3, wy + wh, ww + 6, 3);
  // A hanging hand towel and the dark folds beneath its metal rail.
  const tx = mx + mw + Math.min(24, w * 0.045), ty = my + mh * 0.36;
  rect(g, '#697f7e', tx - 2, ty, 30, 5);
  rect(g, '#cdd5bf', tx - 2, ty, 30, 2);
  rect(g, '#536d73', tx + 4, ty + 2, 20, 33);
  rect(g, '#8da7a7', tx + 2, ty, 18, 32);
  rect(g, '#acc0b5', tx + 4, ty + 2, 3, 27);
  rect(g, '#728e94', tx + 12, ty + 1, 3, 31);
  rect(g, '#d1d4bf', tx + 2, ty + 27, 18, 2);
  rect(g, '#69878b', tx + 2, ty + 30, 18, 1);

  // Recessed medicine cabinet, a luminous tube, and the cold mist on the glass.
  rect(g, '#536b6c', mx - 2, my - 1, mw + 6, mh + 6);
  rect(g, '#d0d3ba', mx - 1, my - 2, mw + 2, mh + 3);
  rect(g, '#53676c', mx + 1, my, mw - 2, mh - 1);
  const glass = g.createLinearGradient(mx, my, mx + mw, my + mh);
  glass.addColorStop(0, '#a4c4bc');
  glass.addColorStop(0.55, '#708f97');
  glass.addColorStop(1, '#9fb8af');
  g.fillStyle = glass;
  g.fillRect(mx + 3, my + 2, mw - 6, mh - 5);
  rect(g, '#e1e5cb65', mx + 4, my + 3, mw - 9, 1);
  for (let i = 0; i < mw * 2; i++) {
    const side = i % 2 ? 1 : -1, inset = rand() ** 2 * mw * 0.27;
    const x = side > 0 ? mx + 5 + inset : mx + mw - 6 - inset;
    const y = my + 5 + rand() * (mh - 12);
    rect(g, i % 4 ? '#d8e4cd55' : '#577e8266', x, y, 1, 1 + rand() ** 3 * 5);
  }
  rect(g, '#53696a', cx - mw * 0.31, my - 9, mw * 0.62, 4);
  rect(g, '#e2e1bf', cx - mw * 0.28, my - 10, mw * 0.56, 3);
  rect(g, '#fff4cf', cx - mw * 0.26, my - 10, mw * 0.52, 1);
  rect(g, '#b8c5b2', mx - 3, my + mh, mw + 6, 2);

  rect(g, '#597275', 0, counter - 2, w, 4);
  rect(g, '#b6c6b6', 0, counter + 2, w, h * 0.14);
  const edge = Math.round(counter + h * 0.14);
  rect(g, '#e0dfc6', 0, edge, w, 2);
  rect(g, '#53686b', 0, edge + 2, w, 6);
  rect(g, '#40595d', 0, edge + 8, w, h - edge);
  for (let x = cx - Math.ceil(cx / (mw + 24)) * (mw + 24); x < w + mw / 2; x += mw + 24) {
    const bowl = Math.round(mw * 0.37), y = counter + 7;
    const outline = (dy: number, color: string, half: number, deep: number) =>
      polygon(g, color, [[x - half + 5, y + dy], [x + half - 5, y + dy], [x + half, y + dy + 3], [x + half - 4, y + dy + deep - 3], [x + half - 10, y + dy + deep], [x - half + 10, y + dy + deep], [x - half + 4, y + dy + deep - 3], [x - half, y + dy + 3]]);
    outline(1, '#e2e4d1', bowl, 17);
    outline(1, '#697f80', bowl - 2, 14);
    outline(5, '#9fb5b1', bowl - 6, 10);
    rect(g, '#728c8d', x - 3, y + 10, 6, 2);
    // Bent chrome tap with separate taps on either side.
    line(g, '#516c71', x - 3, y, 0, -11, 3);
    line(g, '#546e72', x - 2, y - 11, 7, -1, 3);
    rect(g, '#516c71', x + 4, y - 11, 3, 6);
    line(g, '#e2e6cf', x - 3, y - 1, 0, -9);
    line(g, '#eef0d9', x - 2, y - 11, 7, -1);
    for (const dx of [-10, 11]) {
      rect(g, '#637c7e', x + dx - 2, y - 5, 5, 6);
      rect(g, '#d9dfc9', x + dx - 4, y - 5, 9, 2);
      rect(g, dx < 0 ? '#b99582' : '#7496a2', x + dx - 1, y - 6, 3, 2);
    }
    rect(g, '#314b50', x - bowl + 5, edge + 8, 5, h - edge);
    line(g, '#7e9994', x, edge + 8, 0, 13, 5);
    line(g, '#718c89', x, edge + 21, 11, 2, 5);
    line(g, '#718c89', x + 11, edge + 23, 0, -8, 5);
  }
  wash(g, wx + ww / 2, wy + 10, ww * 1.15, '#f2df9e36');
}
