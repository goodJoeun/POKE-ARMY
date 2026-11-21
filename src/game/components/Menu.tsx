'use client';
import { useEffect, useState } from 'react';
import { playSfx } from '../engine/audio';

export interface MenuOption {
  label: string;
  hint?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface Props {
  title: string;
  subtitle?: string;
  options: MenuOption[];
  onClose: () => void;
}

export default function Menu({ title, subtitle, options, onClose }: Props) {
  const [sel, setSel] = useState(() => Math.max(0, options.findIndex((o) => !o.disabled)));
  // 🔊 메뉴가 열리는 소리 (닫는 소리는 Esc · 바깥 클릭으로 그냥 닫을 때만)
  useEffect(() => { playSfx('sfx_cursor', 0.5); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') { e.preventDefault(); playSfx('sfx_cancel', 0.4); onClose(); return; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); playSfx('sfx_cursor', 0.5); setSel((v) => (v + 1) % options.length); }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); playSfx('sfx_cursor', 0.5); setSel((v) => (v - 1 + options.length) % options.length); }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        const o = options[sel];
        if (o && !o.disabled) { playSfx('sfx_confirm', 0.6); o.onSelect(); }
        else playSfx('sfx_bump', 0.5);
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        const o = options[n - 1];
        if (o && !o.disabled) { e.preventDefault(); playSfx('sfx_confirm', 0.6); o.onSelect(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, sel, onClose]);

  return (
    <div className="modal-backdrop" onClick={() => { playSfx('sfx_cancel', 0.4); onClose(); }}>
      <div className="menu" onClick={(e) => e.stopPropagation()}>
        <div className="menu-title">{title}</div>
        {subtitle && <div className="menu-sub">{subtitle}</div>}
        {options.map((o, i) => (
          <button
            key={i}
            className={`menu-opt ${i === sel ? 'sel' : ''}`}
            disabled={o.disabled}
            onMouseEnter={() => setSel(i)}
            onClick={() => !o.disabled && o.onSelect()}
          >
            <span className="choice-num">{i + 1}</span>
            <span className="menu-label">{o.label}</span>
            {o.hint && <span className="menu-hint">{o.hint}</span>}
          </button>
        ))}
        <div className="menu-foot">Esc 닫기 · 숫자키 선택</div>
      </div>
    </div>
  );
}
