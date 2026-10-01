// The six colour schemes, as the CSS custom properties each one sets on the page (the tokens are named after them:
// `line-soft` is `--line-soft`). Plain data, so a later mobile app can share them.

export type Tokens = {
  bg: string;
  panel: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  'line-soft': string;
  divider: string;
  strike: string;
  danger: string;
  /** Hover and drop-target fill. */
  soft: string;
  /** The header's underline. */
  rule: string;
  shadow: string;
};

export type Scheme = { name: string; dark: boolean; tokens: Tokens };

const LIGHT_SHADOW = 'rgba(0,0,0,.15)';
const DARK_SHADOW = 'rgba(0,0,0,.6)';

const ivory = {
  bg: '#f7f3ea',
  panel: '#fffdf8',
  ink: '#161616',
  faint: '#b9ad93',
  line: '#e6dcc6',
  'line-soft': '#efe8d8',
  divider: '#161616',
  danger: '#8e2a1c',
  soft: '#f0e8d6',
  rule: '#cdbf9f',
  shadow: LIGHT_SHADOW,
};

const noir = {
  bg: '#121212',
  panel: '#191919',
  ink: '#ececec',
  faint: '#636363',
  line: '#2d2d2d',
  'line-soft': '#232323',
  danger: '#e8836e',
  soft: '#262626',
  rule: '#2d2d2d',
  shadow: DARK_SHADOW,
};

/** Every colour scheme, in the order the settings pop-over offers them. The first, plain, is the default. */
export const SCHEMES = [
  {
    name: 'plain',
    dark: false,
    tokens: {
      bg: '#fafaf9',
      panel: '#fff',
      ink: '#1c1c1c',
      muted: '#555',
      faint: '#aaa',
      line: '#e5e5e5',
      'line-soft': '#f0f0f0',
      divider: '#2b2b2b',
      strike: '#1c1c1c',
      danger: '#b0321f',
      soft: '#f0f0ee',
      rule: '#c4c4c4',
      shadow: LIGHT_SHADOW,
    },
  },
  { name: 'ivory & navy', dark: false, tokens: { ...ivory, muted: '#4a5d80', strike: '#1f3a68' } },
  { name: 'ivory & black', dark: false, tokens: { ...ivory, muted: '#5f594d', strike: '#161616' } },
  {
    name: 'chalkboard',
    dark: true,
    tokens: {
      bg: '#232b2a',
      panel: '#283230',
      ink: '#eceee6',
      muted: '#a8b4ad',
      faint: '#6f7c77',
      line: '#3a4644',
      'line-soft': '#313c3a',
      divider: '#e3e6dc',
      strike: '#f4f1e2',
      danger: '#f0a08a',
      soft: '#33403e',
      rule: '#3a4644',
      shadow: DARK_SHADOW,
    },
  },
  { name: 'noir & cobalt strike', dark: true, tokens: { ...noir, muted: '#9c9c9c', divider: '#e6e6e6', strike: '#5b8def' } },
  { name: 'noir & steel lines', dark: true, tokens: { ...noir, muted: '#95a3b5', divider: '#9fb3cc', strike: '#9fb3cc' } },
] as const satisfies readonly Scheme[];

export type SchemeName = (typeof SCHEMES)[number]['name'];

/** The WCAG contrast ratio between two `#rgb` or `#rrggbb` colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A colour's WCAG relative luminance. */
function luminance(hex: string): number {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
