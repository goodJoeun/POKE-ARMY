import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

/** The road disappears beyond the gate. All the warm light stays on this side. */
export function fogGate(g: Ink, w: number, h: number) {
  const rand = seeded(2340);
  const vx = Math.round(w * .57), horizon = Math.round(h * .44);
  sky(g, w, horizon, ['#202d40', '#586a7d', '#a5b5be', '#d2d8d5']);
  // The ridge and the pines fade into the low cloud in the middle of the pass.
  for (let x = 0; x < w; x++) {
    const u = x / w, flank = Math.min(1, Math.abs(u - .57) * 3);
    const y = horizon - flank * (16 + 8 * Math.sin(u * 10 + .4) + 4 * Math.cos(u * 24));
    rect(g, '#8296a4', x, y, 1, horizon - y + 2);
  }
  for (let x = -4; x < w; x += 2 + rand() * 3) {
    const flank = Math.min(1, Math.abs(x - vx) / (w * .29));
    const tall = (7 + rand() * 18) * flank, y = horizon + 3;
    for (let k = 0; k < tall; k++) {
      const half = Math.floor((k / tall) * tall * .18) + (Math.floor(k / 3) % 2);
      rect(g, '#728794', x - half, y - tall + k, half * 2 + 1, 1);
    }
  }
  const mist = g.createLinearGradient(0, horizon - 23, 0, horizon + 7);
  mist.addColorStop(0, '#d6dddc00');
  mist.addColorStop(1, '#d6dddc');
  g.fillStyle = mist;
  g.fillRect(0, horizon - 23, w, 31);
  const ground = g.createLinearGradient(0, horizon + 7, 0, h * .96);
  ground.addColorStop(0, '#d6dddc');
  ground.addColorStop(.30, '#8c9da5');
  ground.addColorStop(1, '#394956');
  g.fillStyle = ground;
  g.fillRect(0, horizon + 7, w, h);
  for (const side of [-1, 1]) {
    const edge = side < 0 ? 0 : w, toe = vx + side * w * .66;
    const verge = g.createLinearGradient(0, horizon + 6, 0, h);
    verge.addColorStop(0, '#cbd3d2');
    verge.addColorStop(.26, '#86979b');
    verge.addColorStop(1, '#475964');
    const bank: [number, number][] = [[edge, horizon + 6], [vx + side * 7, horizon + 8], [toe, h], [edge, h]];
    g.fillStyle = verge;
    g.beginPath();
    bank.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    g.fill();
    line(g, '#c4cece', vx + side * 11, horizon + 10, toe - vx - side * 11, h - horizon - 10, 2);
    for (let i = 0; i < 105; i++) {
      const d = rand(), y = horizon + 10 + d * (h - horizon);
      const x = vx + side * (10 + w * (.65 * d + rand() * .44));
      rect(g, '#d3dbd466', x, y, 1 + rand() * d * 9, 1);
    }
    for (let i = 0; i < 28; i++) {
      const d = rand() ** 1.5;
      const x = vx + side * (14 + w * (.68 * d + .02 + rand() * .19));
      const y = horizon + 9 + d * (h - horizon);
      const tall = 2 + d * 8;
      line(g, '#60737b88', x, y, -2, -tall);
      line(g, '#60737b88', x, y, 3, -tall * .65);
      rect(g, '#cbd3cb', x - 2, y - tall, 2, 1);
    }
  }
  for (let i = 1; i < 6; i++) {
    const d = i * i / 27, x = vx - w * .10 * d, y = horizon + 8 + d * (h - horizon);
    line(g, '#cbc6ab88', x, y, -w * .012 * d, 1 + 7 * d, 1 + Math.floor(d * 2));
  }
  // Fence along the verge. The far posts almost vanish into the fog.
  const near = w * .99, nearY = h * .66;
  for (let i = 1; i <= 9; i++) {
    const d = i * i / 81, x = vx + (near - vx) * d + 5;
    const y = horizon + 5 + (nearY - horizon) * d, tall = Math.max(2, 30 * d);
    const prev = (i - 1) ** 2 / 81;
    const px = vx + (near - vx) * prev + 5, py = horizon + 5 + (nearY - horizon) * prev;
    const ink = i < 5 ? '#a8b5b6' : '#647680';
    for (const v of [.26, .79]) line(g, ink, px, py - prev * 30 * v, x - px, y - tall * v - py + prev * 30 * v);
    rect(g, ink, x, y - tall, Math.max(1, 3 * d), tall + 2);
    rect(g, '#ccd2ca', x, y - tall, Math.max(1, 3 * d), 1);
  }
  // The gate lamp casts a short amber reflection on cold asphalt.
  const lx = Math.round(w * .76), ly = Math.round(h * .60);
  const tall = Math.min(66, Math.round(h * .29));
  rect(g, '#52616b', lx, ly - tall, 3, tall + 2);
  rect(g, '#889495', lx, ly - tall, 1, tall);
  line(g, '#576773', lx, ly - tall, -7, -4, 2);
  rect(g, '#3e4a56', lx - 16, ly - tall - 5, 11, 3);
  rect(g, '#ffe3a3', lx - 15, ly - tall - 2, 8, 1);
  wash(g, lx - 12, ly - tall, 25, '#ffcf884f');
  for (let i = 0; i < 42; i++) {
    const d = rand(), x = lx - 13 + (rand() - .5) * (4 + d * 22);
    rect(g, '#deb77e68', x, ly + 3 + d * 24, 2 + rand() * 4, 1);
  }
  // Close view of the booth's timber frame, cold panes and weathered shutter.
  const jamb = Math.round(w * .16);
  rect(g, '#222e37', 0, 0, jamb, h);
  for (let x = 2; x < jamb; x += 7) {
    rect(g, '#34424b', x, 0, 1, h);
    rect(g, '#1b2831', x + 1, 0, 1, h);
  }
  rect(g, '#53606a', jamb - 6, 0, 6, h);
  rect(g, '#899298', jamb - 2, 0, 2, h);
  const eave = Math.round(h * .065);
  polygon(g, '#28353f', [[0,0],[w,0],[w,eave*.38],[jamb,eave+4],[0,eave+5]]);
  line(g, '#63737c', jamb, eave + 4, w - jamb, -eave * .62 - 4);
  // Barrier slats have short faded red sections and a heavy pivot housing.
  const gateY = Math.round(h * .61), gx = Math.round(w * .24), length = Math.round(w * .37);
  rect(g, '#52616a', gx, gateY + 1, length + 2, 5);
  rect(g, '#d6d3bc', gx, gateY, length, 4);
  for (let x = gx + 6; x < gx + length - 6; x += 15)
    polygon(g, '#a16e64', [[x,gateY],[x+6,gateY],[x+4,gateY+4],[x-2,gateY+4]]);
  rect(g, '#47565e', gx - 5, gateY - 3, 10, Math.round(h * .16));
  rect(g, '#768385', gx - 4, gateY - 3, 3, Math.round(h * .16));
  rect(g, '#bfaa8c', gx - 2, gateY, 3, 3);
  const sill = Math.round(h * .75);
  polygon(g, '#4c5961', [[0,sill-1],[w,sill+4],[w,sill+10],[0,sill+6]]);
  polygon(g, '#25323c', [[0,sill+6],[w,sill+10],[w,h],[0,h]]);
}

/** A thin bank of mist moves only in the empty gap beyond the barrier. */
export function gateMist(g: Ink, w: number, h: number, seconds: number) {
  const cx = w * .55, y = h * .44;
  for (let i = 0; i < 5; i++) {
    const drift = Math.sin(seconds * .38 + i) * w * .018;
    rect(g, '#f0f1e932', cx - w * .10 + i * 2 + drift, y - 4 + i * 2, w * (.14 - i * .013), 1);
  }
}
