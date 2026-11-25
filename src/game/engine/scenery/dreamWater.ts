import { type Ink, gleam, line, polygon, rect, seeded, sky, wash } from './pixels';

/** An unbounded night reflected in still water. The voice has no visible body yet. */
export function dreamWater(g: Ink, w: number, h: number) {
  const rand = seeded(7602), horizon = Math.round(h * 0.51);
  const cx = Math.round(w / 2), cy = Math.round(h * 0.29);
  sky(g, w, horizon, ['#0c102b', '#202547', '#39395d', '#746784']);
  // Broken veils of starlight; their lower edges catch the most light.
  for (let x = 0; x < w; x++) {
    const u = x / w, wave = Math.sin(u * 6.5 - 0.8);
    const y = horizon * (0.50 - wave * 0.29) + 4 * Math.sin(x / 21);
    const length = 8 + 14 * (0.5 + 0.5 * Math.cos(x / 37));
    for (let j = 0; j < length; j++) {
      const t = j / length;
      rect(g, t < 0.23 ? '#a0c7c125' : '#8795bd12', x, y - j, 1, 1);
    }
    if (rand() < 0.37) rect(g, '#bed8cf51', x, y, 2, 1);
  }
  for (let i = 0; i < w * 1.25; i++) {
    const x = rand() * w, y = rand() * horizon;
    if (i % 56 === 0) gleam(g, x, y, 1, '#c5cce5');
    else rect(g, ['#b4bfd2', '#8a8ca9', '#d2c4bd', '#8588a9'][i % 4], x, y, 1, 1);
  }
  // Mist softens the horizon until sky and water almost meet.
  for (let i = 0; i < 72; i++) {
    const y = horizon - 3 - rand() ** 2 * 17;
    rect(g, '#d1b6c12b', rand() * w, y, 3 + rand() * 22, 1);
  }
  const water = g.createLinearGradient(0, horizon, 0, h);
  water.addColorStop(0, '#69637d'); water.addColorStop(0.35, '#383c60'); water.addColorStop(1, '#111c37');
  g.fillStyle = water; g.fillRect(0, horizon, w, h - horizon);
  for (let i = 0; i < w * 3; i++) {
    const v = rand(), y = horizon + v * (h - horizon);
    const x = rand() * w, shimmer = Math.abs(x - cx) < w * (0.018 + 0.12 * v);
    rect(g, shimmer && rand() > 0.40 ? '#d2bcb494' : i % 2 ? '#9a97b454' : '#434b6b', x, y, 1 + rand() * (2 + v * 10), 1);
  }
  // Shale banks reflected along the margins leave open water below the voice.
  for (const side of [-1, 1]) {
    g.save();
    g.translate(side < 0 ? w : 0, horizon); g.scale(side, 1);
    for (let i = 0; i < 7; i++) {
      const x = i * w * 0.038 - 8, base = 4 + rand() * 4 - i * 0.5;
      const span = 12 + rand() * 15, rise = 2 + rand() * 7;
      polygon(g, '#343b54', [[x, base], [x + span * 0.25, base - rise], [x + span * 0.7, base - rise * .7], [x + span, base]]);
      line(g, '#9d8c9f', x + span * .25, base - rise, span * .45, rise * .3);
      rect(g, '#424961', x + 2, base + 2, span - 2, 1);
    }
    g.restore();
  }
  wash(g, cx, cy, 28, '#e8cdaa88');
  wash(g, cx, cy, 10, '#ffeabdaf');
  polygon(g, '#fff4ce', [[cx, cy - 7], [cx + 2, cy - 2], [cx + 6, cy], [cx + 2, cy + 1], [cx, cy + 7], [cx - 1, cy + 2], [cx - 5, cy], [cx - 1, cy - 1]]);
  rect(g, '#fffdf3', cx - 1, cy - 1, 3, 3);
  for (let i = 0; i < 15; i++) {
    const a = rand() * Math.PI * 2, r = 8 + rand() * 17;
    rect(g, '#f5d7b77d', cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1);
  }
}
