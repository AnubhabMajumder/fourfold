# Research: Accessible Completed Tasks and reduced motion

Ticket: #22 (part of #1). Researched 2026-09-29.

## Question

1. The scribbled strike-through on a Completed Task is drawn as SVG vector lines (rough.js / perfect-freehand), and screen readers don't reliably announce `<s>`/`<del>`. What is the well-supported way to expose a Task's "completed" state?
2. How should scribble animations respect `prefers-reduced-motion`, and what does WCAG require?

## Answer in brief

- **Expose "completed" as the `checked` state of a native `<input type="checkbox">` whose `<label>` is the Task text.** This satisfies WCAG 4.1.2 and 1.3.1 with standard HTML, is announced by every major screen reader ("checked"/"not checked") together with the Task text, and announces state changes for free. The SVG scribble is pure decoration: `aria-hidden="true"`. Don't rely on `<s>`/`<del>` or on `aria-checked` on a list item (not allowed there).
- **Where no control is available** (e.g. a read-only rendering), put visually-hidden text ("Completed") inside the Task, not `aria-label` on a `div`/`span` (naming is prohibited on generic roles).
- **Reduced motion:** WCAG's only requirement specific to interaction-triggered animation is SC 2.3.3 (**AAA**, not required for AA). SC 2.2.2 (A) doesn't apply because a completion scribble is triggered by the user and lasts under 5 s. Recommended anyway (cheap, and technique C39 is the sufficient technique): when `prefers-reduced-motion: reduce`, **skip the draw-on animation and show the finished scribble straight away**. The scribble itself (the state) must still appear; only the motion is non-essential. For JS-driven animation use `matchMedia('(prefers-reduced-motion: reduce)')` and listen for `change`.
- **Contrast:** the scribble is the only visual sign of the state, so it should have at least **3:1** contrast against the background it sits on (SC 1.4.11, AA).

## Findings

### 1. `<s>` / `<del>` and strike-through styling are not a reliable carrier of meaning

- MDN, `<del>`: "The presence of the `del` element is not announced by most screen reading technology in its default configuration." MDN's workaround is visually-hidden `::before`/`::after` content ("[deletion start]"), with a warning not to overuse it because it adds verbosity. — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/del
- TPGi/Vispero (Steve Faulkner, 2023, tested JAWS, NVDA, Narrator, VoiceOver macOS/iOS with default settings): support for `del` and `s` is inconsistent. JAWS and NVDA convey `del`; `s` is indicated only by NVDA ("deleted"); VoiceOver on macOS gives no indication for either; Narrator "does not convey any HTML semantics". — https://vispero.com/resources/screen-readers-support-for-text-level-html-semantics/
- In Fourfold the strike is an SVG overlay, not `text-decoration`, so screen readers' "report formatting" features wouldn't pick it up either. The meaning has to be encoded some other way.

### 2. What WCAG requires

- **SC 1.3.1 Info and Relationships (A):** "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text." "Completed" is conveyed only by the scribble, so it has to be programmatically determinable or available in text. — https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html
- **SC 4.1.2 Name, Role, Value (A):** for UI components, "states … that can be set by the user can be programmatically set; and notification of changes to these items is available to user agents, including assistive technologies." The Understanding doc notes "standard HTML controls already meet this success criterion when used according to specification." Completing a Task is a user-settable state, so the control that toggles it falls under 4.1.2. — https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
- **SC 1.4.11 Non-text Contrast (AA):** "Visual information required to identify user interface components and states" and "Parts of graphics required to understand the content" need 3:1 against adjacent colours. The Understanding doc applies this explicitly to custom checkbox check marks. — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- **SC 1.4.1 Use of Color (A):** the scribble is a shape, not just a colour change, so it already works as a non-colour cue. Don't mark completion with colour alone (e.g. greying out). — https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html

### 3. Checkbox semantics are the recommended carrier

- Use native HTML before ARIA. WAI-ARIA 1.2: "WAI-ARIA is intended to be used as a supplement for native language semantics, not a replacement." See also the First Rule of ARIA Use. — https://www.w3.org/TR/wai-aria-1.2/ , https://www.w3.org/TR/using-aria/
- `aria-checked` is only valid on the roles `checkbox`, `menuitemcheckbox`, `option`, `radio`, `switch` (inherited by `menuitemradio`, `treeitem`). **Not `listitem`**, so `<li aria-checked="true">` is invalid. — https://www.w3.org/TR/wai-aria-1.2/#aria-checked
- ARIA in HTML: `aria-label`/`aria-labelledby` are prohibited on `div`/`span` exposed as `generic`, so "name the div 'Completed: Buy milk'" is non-conforming. `svg` may take `aria-hidden="true"`. — https://www.w3.org/TR/html-aria/
- WAI-ARIA APG Checkbox Pattern: role `checkbox`, `aria-checked` true/false, Space toggles, label from content or `aria-labelledby`/`aria-label`. A native `<input type="checkbox">` gives all of this built in. — https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
- Inclusive Components, "A Todo List" (Heydon Pickering): for todo items, "checkboxes feel like the semantically correct way … You don't press or switch off todo items; you check them off." Pattern: `<input type="checkbox" id="todo-N">` + `<label for="todo-N">` with the strike-through styled off `:checked + label`. — https://inclusive-components.design/a-todo-list/

### 4. Visually-hidden text (fallback / supplement)

- WebAIM: hide text visually with off-screen/clip CSS (a `.sr-only` class) so screen readers still read it. `display:none` and `visibility:hidden` hide it from screen readers too. Don't hide focusable elements this way. — https://webaim.org/techniques/css/invisiblecontent/
- Use this only where there is no checkbox (e.g. a Completed Task rendered read-only), e.g. `<span class="sr-only">Completed: </span>Buy milk`. MDN's verbosity warning applies: don't add it *as well as* a checkbox, or users hear "Completed" twice.

### 5. Reduced motion

- **SC 2.3.3 Animation from Interactions (AAA):** "Motion animation triggered by interaction can be disabled, unless the animation is essential to the functionality or the information being conveyed." Motion animation is "addition of steps between conditions to create the illusion of movement or to give a sense of a smooth transition". Changes of colour or opacity that don't change perceived size, shape or position are excluded. A stroke drawing itself on arguably counts as motion. AAA, so not required for an AA target. — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- **SC 2.2.2 Pause, Stop, Hide (A)** applies only to motion that "starts automatically, lasts more than five seconds, and is presented in parallel with other content". A sub-second completion scribble triggered by the user's click is outside it. Idle "wobble"/"boiling line" loops, if ever added, *would* fall under it: auto-start, indefinite. — https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- **Technique C39** (sufficient for 2.3.3): wrap motion in `@media (prefers-reduced-motion: no-preference) { … }` or override it in `@media (prefers-reduced-motion: reduce) { … }`. Test: with the OS setting on, "either the motion animation is essential or the motion animation is suppressed." — https://www.w3.org/WAI/WCAG22/Techniques/css/C39
- **MDN `prefers-reduced-motion`:** values `no-preference` / `reduce`. `reduce` means remove non-essential motion, reduce duration or intensity, or swap motion for alternatives such as a dissolve. Baseline widely available since January 2020. Set via Windows 11 Settings > Accessibility > Visual effects > Animation effects, macOS Reduce motion, iOS/Android equivalents. — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

## Recommendation for the Fourfold web client

```tsx
<li className="task">
  <input type="checkbox" id={`task-${id}`} checked={completed}
         onChange={toggle} disabled={!canComplete} />
  <label htmlFor={`task-${id}`} className="task-text">{text}</label>
  {completed && <Scribble seed={id} aria-hidden="true" focusable="false" />}
</li>
```

1. The Task text stays real text inside the `<label>`, so the accessible name is the Task and the state is `checked`. A screen reader reads "Buy milk, checkbox, checked", and toggling announces the new state with no live region needed. The checkbox can be styled to look hand-drawn (e.g. visually replaced) as long as it stays a real, focusable `input` with a visible focus indicator.
2. The scribble SVG gets `aria-hidden="true"` (plus `focusable="false"` for old Edge/IE-era SVG focus quirks). It is decoration layered over state that is already exposed.
3. Don't use `<s>`/`<del>` as the carrier. If added for semantics they only help some screen readers and would double-announce alongside the checkbox.
4. When a Task can't be completed (it sits in the Task List or a Frozen Matrix), don't render a working checkbox. In a Frozen Matrix, render the checkbox `disabled` (the state is still announced), or render read-only with a visually hidden "Completed" prefix. Pick one per view; never both.
5. The scribble's stroke colour should reach at least 3:1 against the Quadrant background (SC 1.4.11).
6. Motion: animate the scribble drawing on only in response to the completing interaction, never on page load or re-render. Under `prefers-reduced-motion: reduce`, render the final scribble instantly (the state is essential, the motion isn't). A short opacity fade is still acceptable, since opacity is excluded from "motion animation". CSS-driven (`stroke-dashoffset` transitions): gate with the C39 media query. JS-driven: read `window.matchMedia('(prefers-reduced-motion: reduce)')` and subscribe to its `change` event, e.g. a `usePrefersReducedMotion()` hook. Strictly this is AAA (2.3.3), but it costs almost nothing.
7. No looping or idle line animations. If any are ever added, they need a pause/stop mechanism (2.2.2, Level A) once they run longer than 5 s.

## Open points (not answered by sources; product decisions)

- Frozen Matrix: disabled checkbox vs read-only text. CONTEXT.md says a Frozen Matrix "looks like any other Matrix", which favours keeping the (disabled) checkbox. Note that disabled controls are skipped by Tab, though screen readers still reach them in browse mode.
- Whether to verify with a quick manual pass on NVDA + Firefox/Chrome and VoiceOver + Safari once the component exists.
