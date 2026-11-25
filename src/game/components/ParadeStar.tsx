'use client';
import { useSyncExternalStore } from 'react';
import type { MonsterLook } from '../types';
import { getSprite, onSpritesLoaded } from '../engine/sprites';
import { line, polygon, rect } from '../engine/scenery/pixels';
import MonsterCanvas from './MonsterCanvas';

const jirachi: MonsterLook = { sprite: 'jirachi', body: '#f8f4d0', belly: '#ffffff', accent: '#f2d050', shape: 'round', ears: 'tuft', tail: 'none', eyes: 'sleepy', mouth: 'smile' };
const hasPortrait = () => !!getSprite('jirachi', 'front');

// A small backlit sprite for the same installation that uses the procedural cast.
function drawStar(canvas: HTMLCanvasElement | null) {
  const g = canvas?.getContext('2d');
  if (!g) return;
  polygon(g, '#be934e', [[17, 23], [17, 28], [12, 34], [5, 35], [10, 31], [12, 25]]);
  polygon(g, '#f0cc6e', [[25, 23], [27, 29], [34, 32], [30, 33], [24, 31], [21, 26]]);
  polygon(g, '#626f76', [[16, 21], [24, 21], [26, 25], [29, 26], [28, 28], [24, 27], [24, 30], [22, 33], [20, 31], [17, 33], [15, 31], [16, 27], [12, 28], [11, 26], [15, 24]]);
  polygon(g, '#f3eed9', [[17, 22], [23, 22], [25, 25], [27, 26], [23, 26], [22, 30], [21, 31], [20, 29], [17, 31], [17, 26], [14, 26], [17, 24]]);
  polygon(g, '#907652', [[20, 2], [25, 11], [37, 11], [32, 17], [27, 19], [25, 24], [15, 24], [11, 19], [3, 13], [14, 11]]);
  polygon(g, '#f2cd65', [[20, 3], [24, 12], [35, 12], [29, 16], [26, 17], [24, 21], [16, 21], [13, 17], [5, 13], [15, 12]]);
  line(g, '#fff0a5', 8, 13, 8, -1);
  polygon(g, '#eae9d7', [[14, 16], [18, 15], [20, 17], [22, 15], [26, 16], [25, 21], [22, 23], [18, 23], [15, 21]]);
  rect(g, '#46515b', 16, 17, 2, 2); rect(g, '#46515b', 22, 17, 2, 2);
  rect(g, '#6c9b9f', 16, 20, 1, 2); rect(g, '#6c9b9f', 24, 19, 1, 2);
  for (const [x, y, len] of [[19, 4, 6], [6, 14, 7], [32, 13, 8]]) {
    rect(g, '#518f98', x, y, 3, len);
    rect(g, '#96c8bc', x, y, 2, len - 1);
  }
}

export default function ParadeStar() {
  const hasArt = useSyncExternalStore(onSpritesLoaded, hasPortrait, () => false);
  return hasArt ? <MonsterCanvas look={jirachi} size={120} /> :
    <canvas ref={drawStar} className="parade-star-art" width={40} height={38} aria-hidden="true" />;
}
