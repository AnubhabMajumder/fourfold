import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SEEDS } from '../sketch/geometry.ts';
import { Gear, SketchBox, SketchPanel, Swatch } from '../sketch/Sketch.tsx';
import { SCHEMES, type SchemeName } from './schemes.ts';
import { changeSettings, useSettings, type StrikeStyle } from './settings.ts';
import './settings.css';

/** The colour schemes as the pop-over groups them: each choice shows only what its group's caption doesn't say. */
const GROUPS: { caption?: string; choices: [SchemeName, string][] }[] = [
  { choices: [['plain', 'plain']] },
  { caption: 'ivory &', choices: [['ivory & navy', 'navy'], ['ivory & black', 'black']] },
  { caption: 'dark', choices: [['chalkboard', 'chalkboard']] },
  { caption: 'noir &', choices: [['noir & cobalt strike', 'cobalt strike'], ['noir & steel lines', 'steel lines']] },
];

const STRIKES: [StrikeStyle, string][] = [
  ['zigzag', 'zigzag'],
  ['rough-line', 'rough line'],
];

/**
 * The doodled gear in the Matrix's bottom-right corner, and the sketched pop-over it opens, where the user picks a
 * colour scheme and the strike style. The pop-over is the browser's own, so Esc and clicking elsewhere close it.
 */
export function SettingsGear() {
  const settings = useSettings();
  const id = useId();
  const gear = useRef<HTMLButtonElement>(null);
  // Its contents exist only while it's open, so they're not part of the page's text the rest of the time.
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  return (
    <div className="settings">
      <button ref={gear} type="button" className="icon-button gear" aria-label="Settings" popoverTarget={id}>
        <Gear seed={SEEDS.gear} />
      </button>
      <div
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Settings"
        className="settings-popover"
        style={place}
        onBeforeToggle={(e) => {
          const opening = e.newState === 'open';
          if (opening) {
            // Just above the gear, its right edge in line with the gear's.
            const r = gear.current!.getBoundingClientRect();
            setPlace({ right: innerWidth - r.right, bottom: innerHeight - r.top + 6 });
          }
          setOpen(opening);
        }}
      >
        {open && (
          <SketchPanel seed={SEEDS.settings}>
            <fieldset>
              <legend>Colours</legend>
              {GROUPS.map((g, i) => (
                <div key={i} className="settings-group">
                  {g.caption && (
                    <div className="caption" aria-hidden="true">
                      {g.caption}
                    </div>
                  )}
                  <div className="choices">
                    {g.choices.map(([name, shown]) => {
                      const index = SCHEMES.findIndex((s) => s.name === name);
                      const { tokens } = SCHEMES[index]!;
                      return (
                        <Choice
                          key={name}
                          seed={SEEDS.settings + 1 + index}
                          group={`${id}-scheme`}
                          name={name}
                          checked={settings.scheme === name}
                          onChoose={() => changeSettings({ scheme: name })}
                        >
                          <Swatch seed={SEEDS.settings + 11 + index} bg={tokens.bg} ink={tokens.ink} strike={tokens.strike} />
                          {shown}
                        </Choice>
                      );
                    })}
                  </div>
                </div>
              ))}
            </fieldset>
            <fieldset>
              <legend>Strike</legend>
              <div className="choices">
                {STRIKES.map(([style, name], i) => (
                  <Choice
                    key={style}
                    seed={SEEDS.settings + 21 + i}
                    group={`${id}-strike`}
                    name={name}
                    checked={settings.strike === style}
                    onChoose={() => changeSettings({ strike: style })}
                  >
                    {name}
                  </Choice>
                ))}
              </div>
            </fieldset>
          </SketchPanel>
        )}
      </div>
    </div>
  );
}

/** One choice: a native radio button, hidden behind what it shows, with a sketched box round it while chosen. */
function Choice({
  seed,
  group,
  name,
  checked,
  onChoose,
  children,
}: {
  seed: number;
  group: string;
  name: string;
  checked: boolean;
  onChoose: () => void;
  children: ReactNode;
}) {
  return (
    <SketchBox seed={seed} className={`choice${checked ? ' is-chosen' : ''}`}>
      <label>
        <input type="radio" name={group} aria-label={name} checked={checked} onChange={onChoose} />
        {children}
      </label>
    </SketchBox>
  );
}
