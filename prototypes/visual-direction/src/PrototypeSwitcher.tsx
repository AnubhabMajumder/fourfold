// PROTOTYPE: floating variant switcher. Deliberately not styled like any variant.
import { useEffect } from 'react';
import type { StrikeStyle } from './store';

type Props = {
  variants: { key: string; name: string }[];
  current: string;
  onVariant: (key: string) => void;
  strike: StrikeStyle;
  onStrike: (s: StrikeStyle) => void;
};

const STRIKES: StrikeStyle[] = ['rough', 'ink', 'css'];

export function PrototypeSwitcher({ variants, current, onVariant, strike, onStrike }: Props) {
  const i = variants.findIndex((v) => v.key === current);
  const step = (d: number) => onVariant(variants[(i + d + variants.length) % variants.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="proto-switcher">
      <button onClick={() => step(-1)} aria-label="Previous variant">←</button>
      <span className="proto-label">
        {current} ({variants[i].name})
      </span>
      <button onClick={() => step(1)} aria-label="Next variant">→</button>
      <span className="proto-sep" />
      <span className="proto-hint">strike:</span>
      {STRIKES.map((s) => (
        <button key={s} className={s === strike ? 'on' : ''} onClick={() => onStrike(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
