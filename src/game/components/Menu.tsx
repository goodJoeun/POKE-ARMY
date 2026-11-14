'use client';
import { useEffect, useState } from 'react';

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); setSel((v) => (v + 1) % options.length); }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); setSel((v) => (v - 1 + options.length) % options.length); }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        const o = options[sel];
        if (o && !o.disabled) o.onSelect();
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        const o = options[n - 1];
        if (o && !o.disabled) { e.preventDefault(); o.onSelect(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, sel, onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
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
