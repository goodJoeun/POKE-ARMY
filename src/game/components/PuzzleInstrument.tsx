'use client';
import { useEffect, useRef } from 'react';
import { gleam, line, rect, seeded, sky } from '../engine/scenery/pixels';

export default function PuzzleInstrument({ kind, frequency }: { kind: 'dial' | 'ring'; frequency?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    if (kind === 'dial') {
      sky(g, 260, 32, ['#303b37', '#6f7363', '#343d36']);
      rect(g, '#262d28', 5, 4, 250, 24);
      rect(g, '#b89a67', 7, 5, 246, 21);
      rect(g, '#e8c887', 8, 7, 244, 16);
      rect(g, '#f3d699', 9, 21, 242, 1);
      g.font = '7px monospace';
      g.textAlign = 'center';
      for (let i = 0; i <= 100; i++) {
        const x = 15 + i * 2.3;
        rect(g, '#665b43', x, 15, 1, i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2);
        if (i % 10 === 0) {
          g.fillStyle = '#514b38';
          g.fillText(String(88 + i / 5), x, 13);
        }
      }
      // 주파수를 넣기 전에는 바늘을 눈금 왼쪽 바깥(88 글자보다 앞)에 세워 둔다: 눈금 0 위에 세우면 "88"을 가린다
      const tuned = frequency !== undefined && frequency >= 88 && frequency <= 108;
      const needle = tuned ? 15 + 230 * ((frequency - 88) / 20) : 9;
      rect(g, '#ad4e3c', needle, 5, 2, 19);
      rect(g, '#663e34', needle - 1, 23, 4, 2);
    } else {
      const rand = seeded(632);
      sky(g, 116, 116, ['#18242e', '#344855', '#192734']);
      for (let i = 0; i < 125; i++) rect(g, '#94afa84a', rand() * 116, rand() * 116, 1, 1);
      const cx = 58, cy = 63;
      for (const radius of [36, 43, 49]) {
        g.strokeStyle = radius === 43 ? '#b0a58b' : '#667877';
        g.lineWidth = 0.55;
        g.beginPath(); g.arc(cx, cy, radius, 0, Math.PI * 2); g.stroke();
      }
      for (let i = 0; i < 72; i++) {
        const a = Math.PI * i / 36, x = Math.cos(a), y = Math.sin(a), depth = i % 6 === 0 ? 4 : 1;
        line(g, '#b9ad90', cx + x * 47, cy + y * 47, -x * depth, -y * depth);
      }
      for (const x of [5, 110]) for (const y of [5, 110]) gleam(g, x, y, 2, '#c5b391');
    }
  }, [kind, frequency]);
  return <canvas className={kind === 'dial' ? 'pz-tuning-scale' : 'pz-orbit'} width={kind === 'dial' ? 260 : 116} height={kind === 'dial' ? 32 : 116} ref={ref} aria-hidden="true" />;
}
