import { describe, expect, it } from 'vitest';
import { contrast, SCHEMES } from '../src/settings/schemes.ts';

describe('the colour schemes', () => {
  it('are the six of the design, plain first', () => {
    expect(SCHEMES.map((s) => s.name)).toEqual(['plain', 'ivory & navy', 'ivory & black', 'chalkboard', 'noir & cobalt strike', 'noir & steel lines']);
  });

  // The Quadrants are drawn straight on the page's background.
  it.each(SCHEMES.map((s) => [s.name, s.tokens] as const))('%s has a strike with at least 3:1 contrast against the Quadrant background', (_, t) => {
    expect(contrast(t.strike, t.bg)).toBeGreaterThanOrEqual(3);
  });

  it('measures contrast as WCAG does', () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21);
    expect(contrast('#fff', '#fff')).toBe(1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
