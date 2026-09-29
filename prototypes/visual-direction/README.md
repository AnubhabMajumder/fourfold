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
| `D` Your picks (default) | Built from the feedback on A–C: A's partitioning (header / Task List / Matrix, input and Add apart), B's urgent / important axis headers and felt-pen dividers, C's sketched controls and handwriting. No Current Matrix pill; date navigation on the right. Drag-and-drop placement (into a Quadrant at a position, between Quadrants, back to the Task List), with a non-drag fallback in the Task List. The sketched × (hover-revealed, no undo) deletes Tasks in the Task List only. Completed Tasks keep full ink; the tick and the strike share the theme's strike colour. A Quadrant whose Tasks are all Completed gets marked. A settings gear (bottom right) holds the colour schemes and the prototype knobs. |

`?strike=zigzag|sawtooth|rough|ink|css` switches the Completed Task strike-through (loose hand zigzag with slanted, widening teeth that taper in and out, the default / round 3's `/|/|/|` sawtooth / rough.js line / perfect-freehand scribble / plain CSS).

D only, also set from the settings gear:

- `?theme=plain|terracotta|apricot|honey|ivory|noir|emerald|oxblood` switches the colour scheme (plain, then warm, then luxury).
- `?place=menu|rows` switches the Task List's non-drag placement: a sketched "place" button that opens a mini Matrix, or the four Quadrant buttons on a second line under the Task text.
- `?done=tick|hatch|none` switches how a Quadrant with every Task Completed is marked: a big felt-pen tick, a hatched wash, or nothing. Each comes with an "all done" note. Complete a Task to see the draw-on animation (skipped under `prefers-reduced-motion`).

Per the in-Quadrant layout decision (#6): Quadrants are plain ordered lists, Tasks drawn straight, Completed Tasks stay in place. In A–C the placement buttons are a stand-in (append to end of Quadrant).

Known gaps: B overflows horizontally at phone width; no ~200-Task stress test; D's drag has no keyboard equivalent beyond the place/return buttons, and on touch the whole Task is the drag handle (blocks scrolling on it).

Screenshots in `screenshots/`.
