import { type Ink, rect, polygon, line, wash, seeded, sky, gleam } from './pixels';

// Short, broken horizontal clusters give the cloud banks the same grain as the terrain.
function nightSky(g: Ink, w: number, horizon: number, dream: boolean) {
  const rand = seeded(dream ? 141 : 728);
  sky(g, w, horizon, dream
    ? ['#101631', '#252850', '#555080', '#a480a2', '#efb697']
    : ['#0b142b', '#182946', '#334863', '#696581', '#b39092']);
  if (dream) {
    for (let i = 0; i < w * 9; i++) {
      const x = rand() * w;
      const y = horizon * (0.85 - x / w * 0.9) + (rand() + rand() + rand() - 1.5) * 26 + Math.sin(x / 27) * 5;
      rect(g, ['#a19aca20', '#b3a2d623', '#8ebdce1a'][i % 3], x, y, 1 + rand() * 5, 1);
    }
  }
  for (let i = 0; i < w * 0.8; i++) {
    const x = rand() * w, y = rand() ** 1.3 * horizon;
    if (i % 31 === 0) gleam(g, x, y, 1, '#b7cad7');
    else rect(g, ['#f1dac9', '#a7b7ce', '#9fa1bc', '#8884a9'][i % 4], x, y, 1, 1);
  }
  for (let i = 0; i < 22; i++) {
    const x = rand() * w, y = horizon * (0.42 + rand() * 0.54), span = 10 + rand() * 42;
    for (let j = 0; j < 19; j++) {
      const u = rand();
      rect(g, j % 5 ? '#51496b55' : '#f6c5ab65', x + u * span, y - Math.sin(u * Math.PI) * 4 + rand() * 4, 3 + rand() * 14, 1);
    }
  }
}

function mountains(g: Ink, w: number, y: number, height: number, color: string, phase: number) {
  for (let x = 0; x < w; x++) {
    const ridge = Math.sin(x / 39 + phase) + 0.54 * Math.sin(x / 19 - phase) + 0.19 * Math.sin(x / 6 + phase);
    rect(g, color, x, y + ridge * height, 1, g.canvas.height);
  }
}

function pine(g: Ink, x: number, y: number, h: number, color: string) {
  rect(g, color, x, y - h, 1, h);
  for (let i = 1; i < h - 1; i++) {
    const b = Math.floor(i / 4) - (i % 4 === 0 ? 1 : 0);
    rect(g, color, x - b, y - h + i, b * 2 + 1, 1);
  }
}

function homeWindow(g: Ink, x: number, y: number, scale: number) {
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(scale, scale);
  wash(g, 0, 0, 48, '#ffd59b55');
  // The open casements frame a glimpse of the desk and curtains in the player's room.
  rect(g, '#342b49', -17, -21, 34, 41);
  rect(g, '#b58775', -16, -21, 32, 39);
  rect(g, '#5e424f', -14, -19, 28, 36);
  rect(g, '#ffd291', -12, -17, 24, 32);
  rect(g, '#ffeab6', -11, -16, 10, 25);
  polygon(g, '#be786b', [[-12, -17], [-5, -17], [-7, -9], [-11, -3], [-9, 11], [-12, 12]]);
  polygon(g, '#cd8874', [[12, -17], [7, -17], [7, -10], [11, -4], [9, 10], [12, 12]]);
  rect(g, '#ac7565', -11, 10, 22, 4);
  rect(g, '#a87860', 3, 5, 1, 5);
  polygon(g, '#edaa6f', [[1, 2], [6, 2], [8, 6], [-1, 6]]);
  rect(g, '#805754', -1, -17, 2, 32);
  rect(g, '#9b6857', -12, -7, 24, 2);
  for (const side of [-1, 1]) {
    g.save(); g.scale(side, 1);
    polygon(g, '#765062', [[17, -19], [26, -24], [26, 15], [17, 18]]);
    polygon(g, '#d3ada1', [[18, -17], [24, -20], [24, 13], [18, 15]]);
    polygon(g, '#8b8298', [[19, -14], [23, -16], [23, -7], [19, -5]]);
    polygon(g, '#b49aa2', [[19, -3], [23, -5], [23, 11], [19, 12]]);
    line(g, '#f3c899', 16, -20, 10, -5);
    g.restore();
  }
  rect(g, '#805963', -20, 17, 40, 4);
  rect(g, '#ffdfaa', -20, 16, 40, 1);
  for (let i = 0; i < 7; i++) rect(g, '#c99c86', -16 + i * 5, 19, 2, 1);
  g.restore();
}

export function dreamHill(g: Ink, w: number, h: number, day: number) {
  const rand = seeded(4997);
  const horizon = h * 0.53;
  nightSky(g, w, horizon, true);
  mountains(g, w, horizon + 3, 7, '#726886', 1);
  mountains(g, w, horizon + 12, 6, '#575b80', 2);
  mountains(g, w, horizon + 22, 7, '#414968', 5);
  for (let x = -2; x < w; x += 2) pine(g, x, horizon + 34 + 5 * Math.sin(x / 38), 7 + rand() * 9, '#38435f');
  const ground = (x: number) => h * 0.60 + Math.sin(x / w * 6.2 - 1.8) * h * 0.075;
  for (let x = 0; x < w; x++) {
    const y = ground(x);
    rect(g, '#817680', x, y - rand() * 2, 1, h);
    rect(g, '#45546a', x, y + 1, 1, h);
    rect(g, '#2e4358', x, y + 7 + 3 * Math.sin(x / 15), 1, h);
  }
  // A winding footpath catches the sky colour as it turns over the crest.
  const trail = (v: number) => w * (0.67 - 0.24 * v + 0.075 * Math.sin(v * 6));
  const start = ground(w * 0.67);
  for (let y = Math.floor(start); y < h; y++) {
    const t = (y - start) / (h - start), half = 1 + t * t * w * 0.12;
    rect(g, '#6f6979', trail(t) - half, y, half * 2, 1);
    rect(g, '#988393', trail(t) - half, y, 1 + rand() * half * 0.6, 1);
  }
  const grasses = ['#657981', '#526b75', '#344855', '#81908a', '#29394f'];
  const petals = ['#e7b0a8', '#c59cc8', '#e6c894', '#93baca'];
  for (let i = 0; i < w * 7; i++) {
    const x = rand() * w, depth = rand() ** 1.35, y = ground(x) + depth * h * 0.44;
    const v = (y - start) / (h - start);
    if (v >= 0 && Math.abs(x - trail(v)) < 2 + v * v * w * 0.12) continue;
    const len = 1 + depth * 6;
    line(g, grasses[i % grasses.length], x, y, len * 0.55, -len);
    if (i % 8 === 0) {
      rect(g, petals[Math.floor(rand() * petals.length)], x + len / 2 - 1, y - len, 2, 1);
      if (depth > 0.5) rect(g, '#c6a4aa', x + len / 2, y - len - 1, 1, 2);
    }
  }
  // Taller campanulas at the edges frame the view down the path.
  for (let i = 0; i < 38; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side > 0 ? w * rand() * 0.19 : w * (1 - rand() * 0.17);
    const y = ground(x) + 7 + rand() * h * 0.26, stem = 7 + rand() * 14;
    line(g, '#4a626a', x, y, side * 3, -stem);
    line(g, '#78928b', x + side, y - 4, side * 4, -4);
    for (let j = 0; j < 3; j++) {
      const fx = x + side * (3 - j), fy = y - stem + j * 3;
      rect(g, '#9992b4', fx, fy, 3, 2); rect(g, '#d5b7cd', fx + side, fy + 1, 2, 2);
    }
  }
  const far = Math.min(1, (day - 1) / 11);
  homeWindow(g, w * 0.75, h * (0.28 + far * 0.075), 1 - far * 0.46);
}

export function roof(g: Ink, w: number, h: number, day: number) {
  const rand = seeded(963);
  const deck = Math.round(h * 0.64);
  nightSky(g, w, deck - 8, false);
  mountains(g, w, deck - 32, 4, '#616780', 3);
  mountains(g, w, deck - 25, 4, '#444e65', 5);
  // Barracks beyond the parapet, with a few occupied rooms after lights-out.
  for (let x = -12; x < w;) {
    const breadth = Math.round(15 + rand() * 37), y = deck - 9 - rand() * 15;
    rect(g, '#354355', x, y, breadth, 36);
    polygon(g, '#293547', [[x - 2, y], [x + 4, y - 4], [x + breadth - 6, y - 4], [x + breadth + 2, y]]);
    line(g, '#99858a', x + 4, y - 4, breadth - 10, 0);
    for (let i = 3; i < breadth - 3; i += 6) {
      for (let row = 0; row < 2; row++) rect(g, rand() > 0.62 ? '#d6ae84' : '#647080', x + i, y + 3 + row * 6, 3, 2);
    }
    x += breadth + 2;
  }
  rect(g, '#384551', 0, deck, w, h);
  for (let x = -w; x < w * 2; x += 96) line(g, '#2d3945', w / 2 + (x - w / 2) * 0.65, deck, (x - w / 2) * 0.35, h - deck);
  for (let i = 2; i < h - deck; i = Math.ceil(i * 1.7)) rect(g, '#293642', 0, deck + i, w, 1);
  for (let i = 0; i < w * 1.5; i++) rect(g, '#64707765', rand() * w, deck + rand() * (h - deck), rand() * 5 + 1, 1);
  rect(g, '#192632', 0, deck - 12, w, 2);
  rect(g, '#afb0a4', 0, deck - 13, w, 1);
  rect(g, '#53616a', 0, deck - 6, w, 1);
  for (let x = 3; x < w; x += 23) {
    rect(g, '#1c2a39', x, deck - 12, 2, 14);
    rect(g, '#78858a', x, deck - 12, 1, 12);
  }
  // Riveted tank, bands, ladder, access platform and return pipe.
  g.save(); g.translate(Math.round(w * 0.13), deck + 7);
  rect(g, '#1a2634', -21, -22, 4, 23); rect(g, '#1a2634', 16, -22, 4, 23);
  line(g, '#28384a', -19, -20, 36, 18, 2); line(g, '#28384a', 17, -20, -36, 18, 2);
  polygon(g, '#283a4a', [[-24, -50], [-21, -54], [-14, -56], [12, -56], [21, -54], [24, -51], [24, -25], [19, -22], [-16, -22], [-24, -25]]);
  rect(g, '#415363', -19, -51, 29, 26); rect(g, '#536675', -14, -51, 10, 26);
  for (const y of [-50, -42, -32, -25]) {
    line(g, '#98a1a2', -20, y, 38, 0); rect(g, '#223140', -21, y + 1, 42, 2);
  }
  rect(g, '#a99994', -14, -56, 26, 1); rect(g, '#354557', -4, -60, 8, 4);
  for (const x of [11, 17]) rect(g, '#1b2837', x, -55, 2, 55);
  for (let y = -52; y < 0; y += 4) rect(g, '#77818a', 11, y, 7, 1);
  rect(g, '#263341', -30, -34, 3, 35); rect(g, '#667482', -30, -35, 8, 2);
  g.restore();
  const mast = Math.round(w * 0.88), top = deck - 83;
  line(g, '#26384c', mast, top, 0, 82, 2);
  for (let i = 0; i < 4; i++) line(g, '#384658', mast - 12 + i * 6, top + 7 - i, 4, 5);
  line(g, '#b6a8a4', mast - 15, top + 9, 28, -5);
  line(g, '#45556b', mast, top + 19, 22, 57); line(g, '#45556b', mast, top + 19, -17, 57);
  for (let x = mast; x < w; x++) rect(g, '#344253', x, top + 18 + Math.sin((x - mast) / (w - mast) * 2) * 8, 1, 1);
  const k = Math.max(0, Math.min(1, (day - 4) / 8));
  const sx = w * 0.62, sy = h * (0.16 + k * 0.18);
  wash(g, sx, sy, 13 + k * 28, '#ffdda38c');
  const radius = 3 + k * 7;
  polygon(g, '#f4d4a4', [[sx, sy - radius * 1.5], [sx + 1, sy - 1], [sx + radius, sy], [sx + 1, sy + 1], [sx, sy + radius * 1.5], [sx - 1, sy + 1], [sx - radius, sy], [sx - 1, sy - 1]]);
  gleam(g, sx, sy, Math.round(radius * 0.7), '#fff2c0');
  rect(g, '#fff8d8', sx - 1, sy - 1, 3, 3);
}
