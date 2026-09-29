# PROTOTYPE: Visual direction (#8)

Throwaway. Answers one question: **how far does the hand-drawn feel extend — the whole UI, or only the Matrix?**

```sh
cd prototypes/visual-direction
npm install
npm run dev
```

Flip variants with the bottom bar (or ←/→ keys). State (placements, completions) carries across variants.

| `?variant=` | Hand-drawn reach |
| --- | --- |
| `A` Matrix only | Clean sans chrome and Task List; pencil (rough.js) dividers, script Quadrant labels. Task text stays sans. |
| `B` Ink Matrix, plain chrome | Plain header, Task List as a chip tray; felt-pen (perfect-freehand) dividers, handwriting Task text, axis labels outside the Matrix. |
| `C` Whole notebook | Paper grain, ruled Task List page, sketchy boxes/checkboxes/buttons, arrowed axes, handwriting everywhere. |
| `D` Your picks (default) | Built from the feedback on A–C: A's partitioning (header / Task List / Matrix, input and Add apart), B's urgent / important axis headers and felt-pen dividers, C's sketched controls and handwriting. No Current Matrix pill; date navigation on the right. Drag-and-drop placement (into a Quadrant at a position, between Quadrants, back to the Task List), with a non-drag fallback in the Task List (a sketched mini-Matrix icon that swaps for four small Quadrant buttons). The sketched × (hover-revealed, no undo) deletes Tasks in the Task List only. Completed Tasks keep full ink; the tick and the strike share the theme's strike colour. A Quadrant whose Tasks are all Completed is hatched across its whole frame, even when its list scrolls. A sketched settings gear in the Matrix's bottom-right corner holds the colour schemes. |

`?strike=zigzag|rough` switches the Completed Task strike-through (felt-pen `|/|/|/|` zigzag that starts and ends on a down stroke, the default / rough.js pencil line).

D only, also set from the settings gear:

- `?theme=plain|ivory-navy|ivory-black|noir-ivory|noir-chalk|noir-midnight|noir-redpen` switches the colour scheme: plain, ivory with a navy or black pen, or one of four dark bases still being tried (ivory ink on warm black, chalk on slate, midnight navy, black with a red pen). The doodled gear in the Matrix's bottom-right corner sets it too.

Per the in-Quadrant layout decision (#6): Quadrants are plain ordered lists, Tasks drawn straight, Completed Tasks stay in place. In A–C the placement buttons are a stand-in (append to end of Quadrant).

Known gaps: B overflows horizontally at phone width; no ~200-Task stress test; D's drag has no keyboard equivalent beyond the place/return buttons, and on touch the whole Task is the drag handle (blocks scrolling on it).

Screenshots in `screenshots/`.
