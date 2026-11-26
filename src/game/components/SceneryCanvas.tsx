'use client';
import { useEffect, useRef } from 'react';
import { dreamHill, roof } from '../engine/scenery/night';
import { library, radio, receiverScale } from '../engine/scenery/interiors';
import { archive } from '../engine/scenery/archive';
import { parade } from '../engine/scenery/parade';
import { wakingBarracks } from '../engine/scenery/barracks';
import { bedtime } from '../engine/scenery/bedtime';
import { dreamWater } from '../engine/scenery/dreamWater';
import { washroom } from '../engine/scenery/washroom';
import { watchDesk } from '../engine/scenery/watchDesk';
import { fogGate, gateMist } from '../engine/scenery/fogGate';
import { mailbox, datedMailbox } from '../engine/scenery/mailbox';
import { patrolBoard } from '../engine/scenery/patrolBoard';
import { paperYard, unsentLetters } from '../engine/scenery/paperYard';
import { emptyDutyHall, pendulumHall } from '../engine/scenery/pendulumHall';
import { rect, wash } from '../engine/scenery/pixels';
import { quizCounter, quizGate, quizParty, quizProject, quizTrip, quizWeekend } from '../engine/scenery/quizVisions';

const paintings = { hill: dreamHill, roof, library, radio, archive, parade, wakingBarracks, bedtime, dreamWater, washroom, watchDesk, fogGate, mailbox, datedMailbox, patrolBoard, paperYard, unsentLetters, pendulumHall, emptyDutyHall, quizTrip, quizProject, quizParty, quizCounter, quizWeekend, quizGate };

export default function SceneryCanvas({ scene, day = 1 }: { scene: keyof typeof paintings; day?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext('2d', { alpha: false });
    if (!g) return;
    const still = scene === 'archive' || scene === 'parade' || scene === 'fogGate' ? document.createElement('canvas') : null;
    const paint = () => {
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      if (!aspect) return;
      // Keep square art pixels across screen shapes, with enough room for the receiver on phones.
      canvas.width = Math.min(720, Math.max(210, Math.round(240 * aspect)));
      canvas.height = Math.max(1, Math.round(canvas.width / aspect));
      paintings[scene](g, canvas.width, canvas.height, day);
      if (still) {
        still.width = canvas.width;
        still.height = canvas.height;
        still.getContext('2d')?.drawImage(canvas, 0, 0);
      }
    };
    paint();
    // 글씨가 들어간 그림(정문 현판 등): 픽셀 글꼴이 아직 안 들어왔으면 준비된 뒤 다시 그린다
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) paint(); });
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    // The radio refreshes only its phosphor trace.
    const signal = () => {
      g.save();
      g.translate(Math.round(canvas.width / 2), Math.round(canvas.height * 0.66) - 6);
      const scale = receiverScale(canvas.width);
      g.scale(scale, scale);
      const x = -9, y = -29;
      rect(g, '#243d36', x, y, 30, 17);
      for (let i = 2; i < 30; i += 5) rect(g, '#364d40', x + i, y + 1, 1, 15);
      for (let i = 2; i < 16; i += 4) rect(g, '#364d40', x + 1, y + i, 28, 1);
      const phase = Math.floor(performance.now() / 110);
      const beat = [0, 0, -1, 0, 1, -5, 3, -1, 0, 0, 0, -1, 0];
      let prev = 0;
      for (let i = 0; i < 26; i++) {
        const v = beat[(phase + i) % beat.length];
        rect(g, '#a9d094', x + i + 2, y + 8 + Math.min(v, prev), 1, Math.abs(v - prev) + 1);
        prev = v;
      }
      g.restore();
    };
    let timer: number | undefined;
    if (scene === 'radio') {
      signal();
      timer = window.setInterval(signal, 125);
    } else if (still && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer = window.setInterval(() => {
        const t = performance.now() / 1000, w = still.width, h = still.height;
        g.drawImage(still, 0, 0);
        if (scene === 'fogGate') {
          gateMist(g, w, h, t);
        } else if (scene === 'parade') {
          wash(g, w / 2, h * 0.49, 16 + 3 * Math.sin(t * 1.5), '#fff0ad46');
        } else {
          for (let i = 0; i < 24; i++) {
            const x = (i * 41 + t * (1 + i % 3)) % (w * 0.58);
            const y = (i * 19 + Math.sin(t * 0.4 + i) * 2 + t * 0.9) % (h * 0.65);
            rect(g, '#f8e4b57a', x, y, 1, 1);
          }
        }
      }, 125);
    }
    return () => { alive = false; observer.disconnect(); window.clearInterval(timer); };
  }, [scene, day]);
  return <canvas className="scenery-canvas" aria-hidden="true" ref={ref} />;
}
