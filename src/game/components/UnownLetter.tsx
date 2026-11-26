'use client';
import { useEffect, useRef } from 'react';
import { getSprite, onSpritesLoaded } from '../engine/sprites';
import { contentBox } from '../engine/drawMonster';
import { type Point, line, rect } from '../engine/scenery/pixels';

// Six silhouettes for installations without the optional battle sprites.
const strokes: Point[][] = [
  [[3, 18], [10, 3], [18, 18]],
  [[5, 4], [15, 4], [10, 9], [10, 18], [15, 20]],
  [[17, 4], [5, 4], [5, 17], [16, 17]],
  [[4, 3], [10, 10], [17, 3], [10, 10], [10, 20]],
  [[4, 5], [15, 5], [15, 11], [6, 11], [6, 18], [16, 18]],
  [[10, 2], [15, 6], [10, 10], [10, 17], [5, 20]],
];

export default function UnownLetter({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    const draw = () => {
      g.clearRect(0, 0, 24, 24);
      const sprite = getSprite('unown', 'front');
      if (sprite) {
        // 전투 그림은 둘레가 투명해서 그대로 줄이면 글자가 콩알만 해진다: 실제 그림 영역만 잘라 칸을 채운다
        const box = contentBox(sprite, sprite.width, sprite.height);
        const scale = Math.min(23 / box.w, 23 / box.h);
        g.imageSmoothingEnabled = false;
        g.drawImage(sprite, box.x, box.y, box.w, box.h, (24 - box.w * scale) / 2, (24 - box.h * scale) / 2, box.w * scale, box.h * scale);
        return;
      }
      const form = strokes[index];
      for (let i = 1; i < form.length; i++) {
        const [x, y] = form[i - 1], [endX, endY] = form[i];
        line(g, '#697789', x, y, endX - x, endY - y, 3);
        line(g, '#182330', x + 1, y + 1, endX - x, endY - y, 2);
      }
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
        const r = x * x + y * y;
        if (r <= 26) rect(g, r > 14 ? '#1c2632' : r > 3 ? '#e2e2cc' : '#27303d', 11 + x, 11 + y, 1, 1);
      }
    };
    draw();
    return onSpritesLoaded(draw);
  }, [index]);
  return <canvas ref={ref} width={24} height={24} aria-hidden="true" />;
}
