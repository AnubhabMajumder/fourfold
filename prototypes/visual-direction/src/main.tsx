// PROTOTYPE for #8 "Visual direction": three variants of how far the hand-drawn feel extends,
// switchable via ?variant=A|B|C|D, plus ?strike=zigzag|loose|rough|ink|css for the Completed Task strike-through.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { STRIKES, useTasks, type StrikeStyle } from './store';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import * as A from './variants/A_MatrixOnly';
import * as B from './variants/B_InkMatrix';
import * as C from './variants/C_Notebook';
import * as D from './variants/D_Picks';

const VARIANTS = { A, B, C, D };
type Key = keyof typeof VARIANTS;

function readParams(): { variant: Key; strike: StrikeStyle } {
  const p = new URLSearchParams(location.search);
  const v = p.get('variant') ?? '';
  const s = p.get('strike') as StrikeStyle;
  return { variant: v in VARIANTS ? (v as Key) : 'D', strike: STRIKES.includes(s) ? s : 'zigzag' };
}

function App() {
  const [params, setParams] = useState(readParams);
  const store = useTasks();
  const update = (next: Partial<typeof params>) => {
    const merged = { ...params, ...next };
    const url = new URL(location.href);
    url.searchParams.set('variant', merged.variant);
    url.searchParams.set('strike', merged.strike);
    history.replaceState(null, '', url);
    setParams(merged);
  };
  const { Variant } = VARIANTS[params.variant];
  return (
    <>
      <Variant key={params.variant + params.strike} store={store} strike={params.strike} />
      {import.meta.env.DEV && (
        <PrototypeSwitcher
          variants={Object.entries(VARIANTS).map(([key, m]) => ({ key, name: m.name }))}
          current={params.variant}
          onVariant={(k) => update({ variant: k as Key })}
          strike={params.strike}
          onStrike={(s) => update({ strike: s })}
        />
      )}
    </>
  );
}

// Load the web fonts up front: a late font swap re-wraps Task text under already-measured strikes.
const FONTS = ['14px Inter', '600 14px Inter', '700 26px Caveat', '19px Kalam', '21px "Patrick Hand"'];
const timeout = new Promise((r) => setTimeout(r, 3000));
Promise.race([Promise.all(FONTS.map((f) => document.fonts.load(f))), timeout]).finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
