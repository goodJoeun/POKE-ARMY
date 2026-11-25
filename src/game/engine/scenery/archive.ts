import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

// The prints use the same three rows as the five photographs in the puzzle.
// A familiar owl keeps its place as the rest of the company changes.
function groupPrint(g: Ink, x: number, y: number, scale: number, year: number) {
  const rand = seeded(841 + year);
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(scale, scale);
  rect(g, '#362d29', 2, 3, 62, 41);
  rect(g, '#624534', 0, 0, 62, 41);
  rect(g, '#bb9165', 1, 0, 60, 1);
  rect(g, '#3c302b', 2, 2, 58, 37);
  rect(g, ['#cdb890', '#d9caaa', '#c1b59a'][Math.abs(year) % 3], 3, 3, 56, 35);
  rect(g, '#9c9681', 6, 5, 50, 28);
  polygon(g, '#7d8072', [[6, 16], [16, 9], [22, 11], [34, 7], [40, 12], [50, 8], [56, 12], [56, 31], [6, 31]]);
  rect(g, '#bab099', 8, 13, 46, 12);
  rect(g, '#7b7969', 7, 12, 48, 2);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const ax = 10 + col * 12 + (row % 2) * 2, ay = 12 + row * 7;
      const owl = row === 1 && col === 0;
      const fur = owl ? '#544c46' : ['#71675c', '#9c8971', '#5e594f', '#887963'][Math.floor(rand() * 4)];
      rect(g, '#59574e', ax, ay + 3, 7, 3);
      rect(g, fur, ax + 1, ay, 5, 4);
      const ears = Math.floor(rand() * 3);
      if (owl || rand() > 0.42) {
        rect(g, fur, ax, ay - 1, owl ? 2 : 1, 2);
        rect(g, fur, ax + 5, ay - (owl ? 1 : ears), 2, 2);
      }
      if (!owl && ears === 2) rect(g, fur, ax + 7, ay + 2, 2, 3);
      rect(g, owl ? '#d5bd8d' : '#bbae98', ax + 1, ay + 1, 1, 1);
      rect(g, '#d4c0a1', ax + 3, ay + 1, 1, 1);
    }
  }
  rect(g, '#a18c6b', 22, 35, 18, 1);
  for (let i = 0; i < 17; i++) rect(g, '#ead7b344', 6 + rand() * 49, 5 + rand() * 27, 1, 1);
  g.restore();
}

export function archive(g: Ink, w: number, h: number) {
  const rand = seeded(2741), cx = Math.round(w * 0.54), wall = Math.round(h * 0.64);
  sky(g, w, wall, ['#3b423b', '#676c55', '#9b8b69']);
  // Painted plaster above tongue-and-groove wainscoting.
  for (let i = 0; i < w * 4; i++) rect(g, '#d0c19919', rand() * w, rand() * wall, rand() * 4 + 1, 1);
  rect(g, '#4d5144', 0, wall - 22, w, 25);
  for (let x = 2; x < w; x += 14) {
    rect(g, '#3e433a', x, wall - 20, 1, 22);
    rect(g, '#6a6b54', x + 1, wall - 20, 1, 22);
  }
  rect(g, '#b1a080', 0, wall - 24, w, 2);
  rect(g, '#434538', 0, wall - 22, w, 3);
  // Space for the shutters at left, then as many prints as the wall will hold.
  const shutter = Math.round(w * 0.12), s = Math.min(1.25, w / 260, h / 213);
  const photoY = Math.round(h * 0.23), step = 66 * s;
  for (let col = -Math.ceil(w / step); col < Math.ceil(w / step); col++) {
    const x = cx - 31 * s + col * step;
    if (x < shutter + 4 || x > w - 6) continue;
    for (let row = 0; row < 2; row++) {
      const y = photoY + (row - 0.5) * 44 * s;
      const year = col * 2 + row, inset = Math.abs(year) % 3 * 1.6;
      groupPrint(g, x + inset, y + inset, s - inset * 0.018, year);
    }
  }
  rect(g, '#373e36', 0, 8, shutter, wall - 28);
  rect(g, '#e9c28a', 0, 11, shutter - 4, wall - 35);
  for (let y = 12; y < wall - 25; y += 8) {
    rect(g, '#8a8668', 0, y, shutter - 3, 3);
    rect(g, '#5e6554', 0, y + 3, shutter - 3, 1);
    polygon(g, '#ffdd9621', [[shutter, y + 3], [shutter, y + 6], [w * 0.56, y + 56], [w * 0.55, y + 52]]);
  }
  rect(g, '#666953', shutter / 2, 10, 2, wall - 30);
  rect(g, '#aba17c', 0, wall - 23, shutter + 3, 2);
  // Desktop, brass-handled flat files, and a bound regimental history opened under the lamp.
  const desk = Math.round(h * 0.68);
  rect(g, '#554139', 0, wall + 3, w, h);
  polygon(g, '#967354', [[0, wall + 1], [w, wall + 1], [w, desk + 19], [0, desk + 19]]);
  for (let i = 0; i < w * 2; i++) rect(g, i % 3 ? '#b08b665c' : '#5c483d55', rand() * w, wall + 1 + rand() * (desk + 18 - wall), 2 + rand() * 15, 1);
  rect(g, '#bd9570', 0, desk + 19, w, 2);
  rect(g, '#3d332e', 0, desk + 21, w, 4);
  for (let x = cx - 225; x < w; x += 75) {
    rect(g, '#392f2a', x, desk + 28, 70, 21);
    rect(g, '#705443', x + 2, desk + 30, 66, 17);
    rect(g, '#ab9263', x + 27, desk + 34, 16, 5);
    rect(g, '#504536', x + 29, desk + 36, 12, 2);
  }
  const bx = cx - 9, by = desk - 1;
  polygon(g, '#4c3c36', [[bx - 37, by - 4], [bx + 32, by - 5], [bx + 41, by + 10], [bx - 45, by + 13]]);
  polygon(g, '#d1b68c', [[bx - 34, by - 5], [bx - 8, by - 7], [bx, by - 3], [bx, by + 9], [bx - 10, by + 7], [bx - 41, by + 10]]);
  polygon(g, '#e2c99f', [[bx, by - 3], [bx + 8, by - 7], [bx + 30, by - 7], [bx + 36, by + 7], [bx + 9, by + 6], [bx, by + 9]]);
  for (let i = 0; i < 5; i++) {
    line(g, '#978368', bx - 32 - i, by - 2 + i * 2, 19, -1);
    line(g, '#ac9475', bx + 7, by - 3 + i * 2, 18 + i % 2 * 3, -1);
  }
  line(g, '#94594a', bx + 2, by + 1, -1, 12, 2);
  const lamp = cx - w * 0.28, ly = desk - 34;
  rect(g, '#393e33', lamp - 9, desk, 18, 3);
  rect(g, '#bf9a65', lamp - 6, desk - 2, 12, 2);
  line(g, '#66563d', lamp, desk - 3, 0, -26, 3);
  line(g, '#c3a774', lamp, desk - 3, 0, -26);
  polygon(g, '#364c43', [[lamp - 15, ly], [lamp - 9, ly - 6], [lamp + 10, ly - 6], [lamp + 15, ly], [lamp + 16, ly + 4], [lamp - 16, ly + 4]]);
  rect(g, '#718676', lamp - 10, ly - 5, 20, 1);
  rect(g, '#ffe2a1', lamp - 15, ly + 3, 30, 2);
  wash(g, lamp, ly + 9, 38, '#efc57c45');
  for (let i = 0; i < 4; i++) {
    const x = cx + w * 0.25 + (i % 2) * 3, y = desk - i * 4;
    rect(g, '#504641', x, y, 37, 4);
    rect(g, i % 2 ? '#b9a17b' : '#869080', x + 1, y + 1, 34, 2);
    rect(g, '#7d5e48', x + 5, y, 2, 4);
  }
  for (let i = 0; i < 55; i++) rect(g, '#eed9a86b', rand() * w * 0.64, rand() * desk, 1, 1);
}
