import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SEEDS } from '../sketch/geometry.ts';
import { Gear, SketchBox, SketchPanel, Swatch } from '../sketch/Sketch.tsx';
import { SCHEMES, type SchemeName } from './schemes.ts';
import { changeSettings, STRIKE_STYLES, useSettings } from './settings.ts';
import './settings.css';

/** A colour scheme as the pop-over offers it, showing only what its group's caption doesn't say. */
const choice = (name: SchemeName, shown: string) => {
  const index = SCHEMES.findIndex((s) => s.name === name);
  return { scheme: SCHEMES[index]!, index, shown };
};

/** The colour schemes as the pop-over groups them. */
const GROUPS: { caption?: string; choices: ReturnType<typeof choice>[] }[] = [
  { choices: [choice('plain', 'plain')] },
  { caption: 'ivory &', choices: [choice('ivory & navy', 'navy'), choice('ivory & black', 'black')] },
  { caption: 'dark', choices: [choice('chalkboard', 'chalkboard')] },
  { caption: 'noir &', choices: [choice('noir & cobalt strike', 'cobalt strike'), choice('noir & steel lines', 'steel lines')] },
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
  const popover = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // It's placed by the gear as it opens; rather than drift away from the gear, it closes if the window resizes.
    const close = () => popover.current!.hidePopover();
    addEventListener('resize', close);
    return () => removeEventListener('resize', close);
  }, [open]);
  return (
    <div className="settings">
      <button ref={gear} type="button" className="icon-button gear" aria-label="Settings" popoverTarget={id}>
        <Gear seed={SEEDS.gear} />
      </button>
      <div
        ref={popover}
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
                    {g.choices.map(({ scheme: { name, tokens }, index, shown }) => (
                      <Choice
                        key={name}
                        seed={SEEDS.schemeChoices + index}
                        group={`${id}-scheme`}
                        name={name}
                        checked={settings.scheme === name}
                        onChoose={() => changeSettings({ scheme: name })}
                      >
                        <Swatch seed={SEEDS.swatches + index} bg={tokens.bg} ink={tokens.ink} strike={tokens.strike} />
                        {shown}
                      </Choice>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <fieldset>
              <legend>Strike</legend>
              <div className="choices">
                {STRIKE_STYLES.map(({ style, name }, i) => (
                  <Choice
                    key={style}
                    seed={SEEDS.strikeChoices + i}
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
