import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

/** CRT at the end of a row of desks, just after the evening meal. */
function terminal(g: Ink, w: number, h: number, dated: boolean) {
  const rand = seeded(1104);
  const desk = Math.round(h * .55), cx = Math.round(w / 2);
  sky(g, w, h, ['#283846', '#627171', '#36474a']);
  // Venetian blinds and the warm stripes they throw across the wall.
  const sill = desk - 17, wx = w * .025, ww = w * .21;
  rect(g, '#26383e', wx - 2, 2, ww + 4, sill);
  for (let y = 5; y < sill - 3; y += 7) {
    rect(g, '#8c9890', wx, y, ww, 5);
    rect(g, '#cfb59c', wx, y + 4, ww, 1);
    polygon(g, '#ebceaa12', [[wx + ww, y + 2], [wx + ww, y + 5], [wx + ww + 37, y + 15], [wx + ww + 37, y + 12]]);
  }
  rect(g, '#465257', wx - 3, sill, ww + 6, 3);
  rect(g, '#444f50', 0, desk - 7, w, 6);
  rect(g, '#786c60', 0, desk - 1, w, h - desk + 1);
  for (let i = 0; i < w; i++) rect(g, '#b396772e', rand() * w, desk + rand() * (h - desk), 3 + rand() * 23, 1);

  // Keep the envelope and its empty date cell legible on both phones and desktops.
  const scale = Math.min(1.1, w / 216, h / 200);
  g.save();
  g.translate(cx, desk);
  g.scale(scale, scale);
  // Fan-fold paper feeding out of a dot-matrix printer on the next desk.
  rect(g, '#3b4546', 84, -23, 51, 22);
  rect(g, '#85877c', 84, -25, 51, 17);
  rect(g, '#394444', 90, -19, 38, 4);
  rect(g, '#ccc5a8', 92, -17, 33, 15);
  polygon(g, '#b6b299', [[92,-2],[125,-2],[132,8],[98,8]]);
  for (let y = -15; y < -3; y += 3) {
    rect(g, '#606765', 94, y, 1, 1);
    rect(g, '#606765', 122, y, 1, 1);
    rect(g, '#8d917f', 97, y, 10 + rand() * 10, 1);
  }
  line(g, '#d5c5ac', 91, -2, 35, 0);
  // Monitor housing, glass lip and phosphor screen.
  wash(g, 0, -41, 93, '#b3dbbd25');
  polygon(g, '#414c50', [[-73,-84],[71,-84],[81,-76],[81,-10],[70,-4],[-73,-4]]);
  rect(g, '#b9b7a5', -74, -84, 146, 78);
  rect(g, '#d9cfb7', -74, -84, 146, 2);
  rect(g, '#888e83', -74, -9, 146, 4);
  rect(g, '#666f69', -68, -79, 134, 62);
  rect(g, '#253d41', -66, -78, 130, 59);
  rect(g, '#426467', -64, -76, 126, 55);
  rect(g, '#899d92', -20, -5, 41, 6);
  rect(g, '#525e5c', -29, 1, 59, 2);
  for (let x = -64; x < -44; x += 3) rect(g, '#737d74', x, -14, 1, 3);
  rect(g, '#75966d', 57, -14, 4, 2);
  rect(g, '#d4f2aa', 58, -14, 2, 1);
  // The first row is mother's letter. Only its date changes after solving P-06.
  rect(g, '#b6c3b0', -58, -72, 114, 47);
  rect(g, '#476770', -57, -71, 112, 11);
  g.fillStyle = '#eef0d7';
  g.font = '10px Galmuri11, sans-serif';
  g.fillText('받은 편지함', -53, -62);
  rect(g, '#e2cfa0', -56, -57, 110, 13);
  for (let i = 0; i < 3; i++) {
    const y = [-55,-41,-32][i];
    rect(g, '#65746b', -53, y + 1, 9, 6);
    rect(g, '#e5dfba', -52, y + 2, 7, 4);
    line(g, '#89917e', -52, y + 1, 3, 3);
    line(g, '#89917e', -49, y + 4, 4, -3);
    if (i > 0) {
      rect(g, '#819085', -38, y + 3, i === 1 ? 36 : 23, 2);
      rect(g, '#8f9a8a', 26, y + 3, 20, 2);
    }
  }
  g.fillStyle = '#384f51';
  g.fillText('엄마', -39, -47);
  rect(g, '#bba980', 21, -56, 31, 11);
  rect(g, '#e9dcb3', 22, -55, 29, 9);
  if (dated) g.fillText('11:00', 23, -47);
  // Keyboard and coiled mouse lead pick up the light from the glass.
  polygon(g, '#4a5251', [[-55,6],[43,6],[53,24],[-64,24]]);
  polygon(g, '#a7aa99', [[-55,5],[42,5],[50,21],[-62,21]]);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 16; col++) rect(g, '#697870', -52 + col * 6 - row, 7 + row * 4, 4, 2);
  rect(g, '#728078', -32, 19, 36, 2);
  line(g, '#4f5c56', 61, 9, 4, -5);
  line(g, '#4f5c56', 65, 4, -9, -6);
  polygon(g, '#aeb09e', [[57,9],[64,9],[68,13],[67,19],[55,19],[54,14]]);
  line(g, '#6d7971', 61, 9, 0, 5);
  g.restore();
}

export function mailbox(g: Ink, w: number, h: number) { terminal(g, w, h, false); }
export function datedMailbox(g: Ink, w: number, h: number) { terminal(g, w, h, true); }
