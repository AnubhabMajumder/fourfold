// PROTOTYPE for #27 "When the local API isn't running": what does the web app show when the API goes away
// mid-session? Built on variant D. Switch how it's shown with ?note=none|header|strip|paused|overlay, and flip the
// fake API up/down from the bottom bar. While it's down, every change snaps back after a moment, as the real app will.
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { useTasks, type Store } from './store';
import { RoughBox } from './draw';
import { Variant } from './variants/D_Picks';

const NOTES = {
  none: 'Nothing: changes just snap back (Q4 a)',
  header: 'Quiet note in the header (Q4 b)',
  strip: 'Strip under the header (b, louder)',
  paused: 'Header note + page paused (b + no changes)',
  overlay: 'Card over the whole page (Q4 c)',
} as const;
type Note = keyof typeof NOTES;

const SNAP_MS = 450;
const BACK_MS = 2200;

/** While the API is down, a change shows at once (the screen updates first) and then snaps back. */
function useFlakyStore(down: boolean, onFail: () => void): Store {
  const store = useTasks();
  if (!down) return store;
  const wrap =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A) => {
      const before = store.tasks;
      fn(...a);
      onFail();
      setTimeout(() => store.replaceAll(before), SNAP_MS);
    };
  return { ...store, toggle: wrap(store.toggle), place: wrap(store.place), unplace: wrap(store.unplace), move: wrap(store.move), remove: wrap(store.remove), add: wrap(store.add) };
}

type Status = 'ok' | 'down' | 'back';

const DOWN_TEXT = "Fourfold isn't running. Start it and this page will catch up.";
const PAUSED_TEXT = "Fourfold isn't running, so changes are paused. Start it and this page will catch up.";
const BACK_TEXT = 'Back, and up to date ✓';

function HeaderNote({ status, text }: { status: Status; text: string }) {
  if (status === 'ok') return null;
  return (
    <RoughBox seed={status === 'down' ? 61 : 62} className={`un-note ${status}`} roughness={1.4}>
      <span role="status">{status === 'down' ? text : BACK_TEXT}</span>
    </RoughBox>
  );
}

function Strip({ status }: { status: Status }) {
  if (status === 'ok') return null;
  return (
    <div className={`un-strip ${status}`} role="status">
      {status === 'down' ? DOWN_TEXT : BACK_TEXT}
    </div>
  );
}

function Overlay() {
  return (
    <div className="un-overlay">
      <RoughBox seed={71} className="un-card" roughness={1.5}>
        <div role="alertdialog" aria-label="Fourfold isn't running">
          <h2>Fourfold isn't running</h2>
          <p>Start it with the Start Fourfold shortcut.</p>
          <p className="un-faint">This page will catch up by itself.</p>
        </div>
      </RoughBox>
    </div>
  );
}

/** What the browser shows when the page is (re)opened with the API off: nothing the app can change (Q1). */
function BrowserError({ onClose }: { onClose: () => void }) {
  return (
    <div className="un-browser">
      <div>
        <div className="un-browser-icon">☹</div>
        <h1>This site can’t be reached</h1>
        <p>
          <b>localhost</b> refused to connect.
        </p>
        <p className="un-browser-code">ERR_CONNECTION_REFUSED</p>
        <button onClick={onClose}>Reload (after starting Fourfold)</button>
      </div>
    </div>
  );
}

function App() {
  const [note, setNoteState] = useState<Note>(() => {
    const v = new URLSearchParams(location.search).get('note') ?? '';
    return v in NOTES ? (v as Note) : 'header';
  });
  const setNote = (n: Note) => {
    const url = new URL(location.href);
    url.searchParams.set('note', n);
    history.replaceState(null, '', url);
    setNoteState(n);
  };
  const [apiUp, setApiUp] = useState(true);
  const [status, setStatus] = useState<Status>('ok');
  const [reopened, setReopened] = useState(false);
  const backTimer = useRef<number>(undefined);

  // The app notices the API is gone when a change fails, or when the window regains focus and its re-fetch fails.
  const notice = () => {
    clearTimeout(backTimer.current);
    setStatus('down');
  };
  const store = useFlakyStore(!apiUp, notice);

  useEffect(() => {
    if (apiUp) return;
    window.addEventListener('focus', notice);
    return () => window.removeEventListener('focus', notice);
  }, [apiUp]);

  // Once the API answers again (the real app keeps checking every few seconds while it's down), the page re-fetches
  // everything and says so briefly.
  useEffect(() => {
    if (!apiUp || status !== 'down') return;
    setStatus('back');
    backTimer.current = window.setTimeout(() => setStatus('ok'), BACK_MS);
  }, [apiUp]);

  const shown: Status = note === 'none' ? 'ok' : status;
  const down = shown === 'down';

  return (
    <>
      {reopened ? (
        <BrowserError onClose={() => apiUp && setReopened(false)} />
      ) : (
        <Variant
          store={store}
          strike="zigzag"
          headerNote={(note === 'header' || note === 'paused') && <HeaderNote status={shown} text={note === 'paused' ? PAUSED_TEXT : DOWN_TEXT} />}
          belowHeader={note === 'strip' && <Strip status={shown} />}
          overlay={note === 'overlay' && down && <Overlay />}
          paused={(note === 'paused' || note === 'overlay') && down}
        />
      )}
      <div className="proto-switcher">
        <button onClick={() => setApiUp((u) => !u)} className={apiUp ? '' : 'on'}>
          API: {apiUp ? 'running' : 'stopped'}
        </button>
        <button onClick={() => !apiUp && notice()} disabled={apiUp} title="Simulates switching back to this window: its re-fetch fails">
          refocus
        </button>
        <button onClick={() => setReopened(true)} title="Close and reopen the page (Q1)">
          reopen page
        </button>
        <span className="proto-sep" />
        <select value={note} onChange={(e) => setNote(e.target.value as Note)} className="un-select">
          {(Object.keys(NOTES) as Note[]).map((k) => (
            <option key={k} value={k}>
              {k}: {NOTES[k]}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

const FONTS = ['700 26px Caveat', '19px Kalam'];
const timeout = new Promise((r) => setTimeout(r, 3000));
Promise.race([Promise.all(FONTS.map((f) => document.fonts.load(f))), timeout]).finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
