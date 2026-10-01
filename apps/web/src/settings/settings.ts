// The user's settings: colour scheme and strike style. They belong to this laptop rather than to the Tasks, so
// they're kept in the browser's local storage for this origin, not in the database.
import { useSyncExternalStore } from 'react';
import { SCHEMES, type SchemeName } from './schemes.ts';

/** The strike styles, as the settings pop-over offers them. */
export const STRIKE_STYLES = [
  { style: 'zigzag', name: 'zigzag' },
  { style: 'rough-line', name: 'rough line' },
] as const;

export type StrikeStyle = (typeof STRIKE_STYLES)[number]['style'];

export type Settings = { scheme: SchemeName; strike: StrikeStyle };

const KEYS = { scheme: 'fourfold.scheme', strike: 'fourfold.strike' } as const;
const DEFAULTS: Settings = { scheme: 'plain', strike: 'zigzag' };

/** A saved value if it's one of the choices (a stale or hand-edited one isn't), else the default. */
function read<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return choices.find((c) => c === saved) ?? fallback;
  } catch {
    // Storage can be blocked; the defaults still work.
    return fallback;
  }
}

let current: Settings = {
  scheme: read(KEYS.scheme, SCHEMES.map((s) => s.name), DEFAULTS.scheme),
  strike: read(KEYS.strike, STRIKE_STYLES.map((s) => s.style), DEFAULTS.strike),
};
const listeners = new Set<() => void>();

/** Sets the colour scheme's tokens as the page's CSS custom properties. */
function applyScheme() {
  const scheme = SCHEMES.find((s) => s.name === current.scheme)!;
  const root = document.documentElement.style;
  for (const [token, value] of Object.entries(scheme.tokens)) root.setProperty(`--${token}`, value);
  // Native parts (scrollbars, the text cursor) follow the scheme's lightness.
  root.colorScheme = scheme.dark ? 'dark' : 'light';
}

applyScheme();

/** Changes a setting, remembering it on this laptop. */
export function changeSettings(change: Partial<Settings>) {
  current = { ...current, ...change };
  try {
    localStorage.setItem(KEYS.scheme, current.scheme);
    localStorage.setItem(KEYS.strike, current.strike);
  } catch {
    // Not remembered, but still used until the page is closed.
  }
  applyScheme();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current settings, re-rendering when they change. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => current);
}
