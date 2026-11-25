import { type Ink, gleam, line, polygon, rect, seeded, sky, wash } from './pixels';

function cloud(g: Ink, x: number, y: number, span: number, scale: number, seed: number) {
  const rand = seeded(seed);
  // Build one continuous silhouette from overlapping cumulus lobes.
  const lobes = Array.from({ length: 8 }, (_, i) => ({
    x: (i + 0.5) * span / 8, radius: span * (0.10 + rand() * 0.08),
    rise: scale * (0.32 + 0.6 * Math.sin((i + 0.5) * Math.PI / 8) + rand() * 0.5)
  }));
  for (let dx = 0; dx < span; dx++) {
    let top = 0;
    for (const l of lobes) {
      const u = (dx - l.x) / l.radius;
      if (Math.abs(u) < 1) top = Math.max(top, Math.sqrt(1 - u * u) * l.rise);
    }
    const edge = Math.min(1, dx / (span * 0.16), (span - 1 - dx) / (span * 0.16));
    top *= Math.sqrt(edge);
    if (top < 0.7) continue;
    const base = (2 + Math.sin(dx * 0.11) * 1.5) * edge;
    rect(g, '#c1cece', x + dx, y - top, 1, top + base);
    rect(g, '#ece5cf', x + dx, y - top, 1, Math.max(1, top * (0.51 + Math.sin(dx / 7) * 0.13)));
    rect(g, '#fff1d5', x + dx, y - top, 1, Math.min(2, top));
  }
}

function dormitory(g: Ink, x: number, y: number, width: number) {
  rect(g, '#989d8f', x, y, width, 21);
  rect(g, '#d0cbb6', x + 2, y + 2, width - 4, 16);
  polygon(g, '#687674', [[x - 3, y], [x + 3, y - 5], [x + width - 8, y - 5], [x + width + 2, y]]);
  rect(g, '#9ba29a', x + 4, y - 5, width - 13, 1);
  for (let i = 4; i < width - 4; i += 8) for (let row = 0; row < 2; row++) {
    rect(g, '#627776', x + i, y + 3 + row * 8, 5, 4);
    rect(g, '#a3b2a7', x + i + 1, y + 3 + row * 8, 2, 2);
  }
  rect(g, '#92998a', x, y + 9, width, 1);
}

export function parade(g: Ink, w: number, h: number) {
  const rand = seeded(1088), horizon = Math.round(h * 0.51), cx = Math.round(w * 0.5);
  sky(g, w, horizon, ['#4c86a4', '#7cabb7', '#bbcec2', '#eee0bd']);
  wash(g, w * 0.42, h * 0.26, h * 0.39, '#fff2b83c');
  cloud(g, -w * 0.07, h * 0.20, w * 0.38, 15, 51);
  cloud(g, w * 0.68, h * 0.18, w * 0.39, 17, 12);
  cloud(g, w * 0.24, h * 0.32, w * 0.24, 7, 44);
  cloud(g, w * 0.58, h * 0.38, w * 0.22, 6, 39);
  for (let x = 0; x < w; x++) {
    const ridge = Math.sin(x / 37) * 5 + Math.sin(x / 19 + 2) * 3 + Math.sin(x / 8) * 1.5;
    rect(g, '#93aaa2', x, horizon - 12 + ridge, 1, 32);
    rect(g, '#748e81', x, horizon - 3 + Math.sin(x / 27) * 4 + ridge / 2, 1, 25);
  }
  dormitory(g, -8, horizon + 1, w * 0.29);
  dormitory(g, w * 0.79, horizon - 3, w * 0.23);
  // Windbreak trees in front of the barracks. Sun catches only the upper left of each crown.
  for (let x = -4; x < w; x += 5 + rand() * 4) {
    const y = horizon + 13 + rand() * 3, ht = 7 + rand() * 8;
    rect(g, '#625f4c', x, y - 3, 2, 7);
    for (let dx = -4; dx <= 4; dx++) {
      const crown = Math.sqrt(1 - (dx / 4.5) ** 2) * ht;
      rect(g, '#566f5e', x + dx, y - crown, 1, crown);
      rect(g, '#859576', x + dx, y - crown, 1, Math.max(1, crown * (dx < 0 ? 0.46 : 0.15)));
    }
  }
  const yard = horizon + 20, stage = Math.round(h * 0.61), half = Math.min(51, w * 0.19);
  rect(g, '#cbbb96', 0, yard, w, h);
  for (let i = 0; i < w * 4; i++) {
    const y = yard + rand() * (h - yard);
    rect(g, i % 3 ? '#998e724c' : '#f7e2b561', rand() * w, y, 1 + (y - yard) / h * 4, 1);
  }
  for (const side of [-1, 1]) {
    line(g, '#e8ddba', cx + side * w * 0.16, yard, side * w * 0.69, h - yard, 2);
    line(g, '#f1e6c7', cx + side * w * 0.25, yard, side * w * 0.78, h - yard);
  }
  // Timber rostrum on a stone plinth, with nosings on the three central steps.
  polygon(g, '#a5977d', [[cx - half - 5, stage + 12], [cx + half + 3, stage + 11], [cx + half + 22, stage + 19], [cx - half + 3, stage + 22]]);
  polygon(g, '#60716a', [[cx - half + 4, stage - 6], [cx + half - 5, stage - 6], [cx + half + 2, stage], [cx - half - 3, stage]]);
  rect(g, '#52605a', cx - half - 3, stage, half * 2 + 5, 12);
  rect(g, '#bac1aa', cx - half - 4, stage, half * 2 + 7, 2);
  for (let x = cx - half + 2; x < cx + half; x += 5) rect(g, '#718074', x, stage + 3, 1, 8);
  rect(g, '#455953', cx - 10, stage - 3, 20, 2);
  for (let i = 0; i < 3; i++) {
    rect(g, '#747d70', cx - 15 - i * 3, stage + 8 + i * 3, 30 + i * 6, 4);
    rect(g, '#c5c8ae', cx - 15 - i * 3, stage + 8 + i * 3, 30 + i * 6, 1);
  }
  const mic = cx - half + 9;
  line(g, '#394d4e', mic, stage - 4, 0, -13);
  line(g, '#526261', mic, stage - 17, 5, -3);
  rect(g, '#394d4e', mic + 4, stage - 21, 3, 2);
  // Twin public-address horns and the cable sag along the edge of the square.
  const pole = Math.round(w * 0.13), tip = horizon - 32;
  rect(g, '#596960', pole, tip, 3, yard - tip + 3);
  rect(g, '#a5ad96', pole, tip, 1, yard - tip + 3);
  for (const d of [-1, 1]) {
    polygon(g, '#63736e', [[pole, tip + 4], [pole + d * 5, tip + 3], [pole + d * 10, tip - 1], [pole + d * 10, tip + 7], [pole + d * 5, tip + 5], [pole, tip + 6]]);
    rect(g, '#b4b9a3', pole + d * 10, tip - 1, 1, 8);
  }
  for (let x = 0; x < pole; x++) rect(g, '#738680', x, tip + 8 + 7 * Math.sin(Math.PI * x / pole), 1, 1);
  const flagX = Math.round(w * 0.84), flagY = horizon - 44;
  line(g, '#9caa9d', flagX, flagY, 0, yard - flagY);
  rect(g, '#e0d6ad', flagX - 1, flagY - 2, 3, 2);
  polygon(g, '#738e85', [[flagX + 1, flagY + 2], [flagX + 8, flagY + 2], [flagX + 14, flagY + 5], [flagX + 23, flagY + 4], [flagX + 19, flagY + 11], [flagX + 11, flagY + 12], [flagX + 6, flagY + 9], [flagX + 1, flagY + 10]]);
  line(g, '#b7c1a8', flagX + 2, flagY + 3, 6, 0);
  // The daylight star leaves just a few points of light above the rostrum.
  wash(g, cx, h * 0.49, 25, '#fff1bc8c');
  for (let i = 0; i < 12; i++) gleam(g, cx + (rand() - 0.5) * 25, h * 0.48 - i * 3.6, i % 4 ? 0 : 1, '#fff4cf');
}
