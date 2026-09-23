# Research: hand-drawn rendering on the web

Ticket: [#3 Hand-drawn rendering on the web](https://github.com/AnubhabMajumder/fourfold/issues/3) (child of map #1). Consumed by the visual-direction prototype ticket (#8).

**Question:** What are the options for a hand-drawn / sketchy feel on the web, and what are their trade-offs? Covers rough.js and similar, handwriting fonts, SVG filters, animated scribble strike-throughs, and hand-drawn Quadrant dividers. For each: look, performance with many Tasks, accessibility/legibility, framework-agnosticism, and how well it carries to a future mobile client.

Sources were checked on 2026-09-24. Repo metadata comes from the GitHub API and versions come from the npm registry. Claims marked *(inference)* are my own reasoning, not something a source says. The prototype should check them.

---

## TL;DR

- **Draw sketchy lines as vectors with a seed, and keep text as real DOM text.** Use **rough.js**'s `RoughGenerator` for the Quadrant dividers and the strike-through. It returns plain SVG path strings with no DOM involved, and a stored `seed` makes the same Task look the same on every render. Excalidraw works this way: it keeps a `seed` on each element and caches the generated shapes in a `WeakMap`.
- **Draw the Completed Task strike-through ourselves** (rough.js or perfect-freehand path, animated with `stroke-dashoffset`). Wrap the text in `<s>` and add an accessible "completed" state. rough-notation already does this animation, but it adds one ResizeObserver and one sibling `<svg>` per annotation. Its last npm release was in 2020. Treat it as a reference, not a dependency.
- **Use a legible handwriting font from the OFL-1.1 set for Task text**, e.g. Excalifont, Caveat, Kalam, Patrick Hand or Architects Daughter. OFL fonts can be bundled in web and mobile apps.
- **Don't use SVG turbulence/displacement filters for anything with text in it.** They warp the rendered pixels, including glyphs, so legibility suffers. They also have no counterpart in react-native-svg, which doesn't implement `feTurbulence` or `feDisplacementMap`. At most, use them for a paper texture behind the Matrix.
- **Mobile:** geometry from rough.js and perfect-freehand is plain data (path strings or point arrays), so the same code can feed `react-native-svg` `<Path>` or React Native Skia. Skia also has a built-in `DiscretePathEffect` that jitters lines natively.

---

## 1. rough.js (and relatives)

**What it is.** A small library (the README says "<9 kB") that draws lines, rectangles, ellipses, polygons, arcs, curves and SVG paths so they look sketched. It draws to Canvas (`rough.canvas`) or SVG (`rough.svg`). Licence MIT, about 21k stars. Latest npm version is 4.6.6 (2023-11-20), and the repo was last pushed in July 2024. It is stable but rarely updated. [README](https://github.com/rough-stuff/rough), [API wiki](https://github.com/rough-stuff/rough/wiki)

**Options that matter to us** ([wiki](https://github.com/rough-stuff/rough/wiki)):
- `roughness` (default 1) and `bowing` (default 1) set how sketchy the lines look.
- `seed`: "sets the seed for creating random values used in shape generation. This is useful for creating the exact shape when re-generating with the same parameters." This is how a Task's strike-through can look the same on every re-render and on every device.
- `disableMultiStroke` and `preserveVertices` make lines calmer and cheaper.
- `fillStyle` (hachure, cross-hatch, zigzag, dots, …) gives sketchy fills, e.g. for Quadrant tints.

**Framework-agnostic core.** `RoughGenerator` builds a drawable without touching the DOM. `generator.toPaths(drawable)` returns `PathInfo[]` (`d`, stroke, fill), and `opsToPath()` returns a plain SVG path string ([src/generator.ts](https://github.com/rough-stuff/rough/blob/master/src/generator.ts)). Those path strings can go into React/Vue/Svelte JSX, a server render, or React Native.

**How Excalidraw uses it at scale** (primary source: the code):
- `packages/element/src/shape.ts` keeps one `RoughGenerator` and a `ShapeCache` `WeakMap` per element. It passes `seed: element.seed`, and it lowers roughness for small elements (`adjustRoughness`: `Math.min(roughness / (maxSize < 10 ? 3 : 2), 2.5)`). It sets `preserveVertices` or `disableMultiStroke` depending on style. ([shape.ts](https://github.com/excalidraw/excalidraw/blob/master/packages/element/src/shape.ts))
- `packages/element/src/renderElement.ts` draws each element once into its own offscreen canvas at `devicePixelRatio` and caches it in `elementWithCanvasCache` (`WeakMap`). ([renderElement.ts](https://github.com/excalidraw/excalidraw/blob/master/packages/element/src/renderElement.ts))
- Excalidraw also depends on `perfect-freehand` for free-draw strokes ([package.json](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/package.json)).
- Takeaway: **generate each shape once per (seed, size) and cache it.** Never regenerate on every frame or every React render.

**Trade-offs for Fourfold**
| Axis | Assessment |
|---|---|
| Look | The classic "Excalidraw" sketch look, with lots of control. Multi-stroke at roughness 1–1.5 reads well at divider and strike-through sizes. |
| Perf, many Tasks | Generation is pure JS math. A few paths per Task (one strike-through) is cheap if memoised by seed and width *(inference; Excalidraw's caching shows the pattern)*. As inline SVG, each Task adds only 1–2 `<path>` nodes. |
| A11y | Purely decorative. Use `aria-hidden="true"` on the SVG and keep the meaning in real text/semantics. |
| Framework-agnostic | Yes. The generator has no DOM dependency. |
| Mobile | Good. Path strings work in `react-native-svg` `<Path d>` or Skia `Skia.Path.MakeFromSVGString` *(inference: standard APIs, not tested here)*. A native Swift/Kotlin app would need a port, or Skia's `DiscretePathEffect` (see §6). |

**Relatives**
- **roughViz** ([repo](https://github.com/jwilber/roughViz)): hand-drawn *charts* built on D3 v5 and rough.js. MIT, last pushed April 2024. Not relevant to a task UI.
- **rough-notation** ([repo](https://github.com/rough-stuff/rough-notation)): hand-drawn annotations on DOM elements (underline, box, circle, highlight, **strike-through**, **crossed-off**, bracket). About 3.8 kB gzip, MIT. See §4.
- **tldraw**: the code is public but the licence is proprietary. Production use needs a licence key and shows a watermark ([LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md)). **Not an option to depend on.**

## 2. perfect-freehand

**What it is.** Takes input points (with optional pressure) and returns an **outline polygon** for a variable-width, ink-like stroke. You render it yourself as an SVG path or Canvas fill. Options: `size`, `thinning`, `smoothing`, `streamline`, `simulatePressure`. MIT. npm 1.2.3 (2026-02-01), actively maintained. There are ports to Dart, Rust, Python and Odin. [README](https://github.com/steveruizok/perfect-freehand)

**Use for Fourfold:** the most "pen-like" strike-through. Generate a jittered zig-zag or loop across the Task's text box (seeded), then run it through `getStroke` so the line tapers like ink. rough.js strokes look like a pencil with even width; perfect-freehand strokes look like a felt pen.

| Axis | Assessment |
|---|---|
| Look | Organic, tapered ink. Looks better than rough.js for a scribble, but we must write the scribble point generator ourselves. |
| Perf | Pure math over a few dozen points, so negligible per Task if memoised *(inference)*. |
| A11y | Decorative, same as rough.js. |
| Framework-agnostic | Yes. Output is a point array. |
| Mobile | The best of any option here: the JS runs as-is in React Native, and the Dart port makes Flutter possible too. |

## 3. Handwriting fonts

All of these are in [google/fonts](https://github.com/google/fonts) under `ofl/` with an `OFL.txt` (**SIL Open Font License 1.1**). OFL lets you use, embed and bundle the fonts in apps, web and mobile, including commercially. You can't sell the font by itself, and a modified version must use a new name.

| Font | Notes |
|---|---|
| **Excalifont** | Excalidraw's 2024 successor to Virgil, redrawn for legibility. OFL-1.1 ([Excalifont page](https://plus.excalidraw.com/excalifont)). Virgil is also OFL-1.1 ([excalidraw/virgil](https://github.com/excalidraw/virgil)). Instantly reads as "Excalidraw", which may be a pro or a con. |
| **Caveat** | Variable weight (`Caveat[wght].ttf`), so one file covers all weights. Casual handwriting look, but its small x-height makes it hard to read at small sizes *(inference)*. |
| **Kalam** | Light, Regular and Bold. Fairly legible, supports Devanagari. |
| **Patrick Hand** | Print-style handwriting, among the most legible for body text *(inference)*. |
| **Architects Daughter**, **Gochi Hand**, **Indie Flower**, **Shadows Into Light** | More stylised. Better for headings and Quadrant labels than for Task text. |
| **Comic Neue** | A handwriting-adjacent "fallback" with a full family, including italics. |

Trade-offs:
- **Legibility and a11y:** handwriting fonts cost reading speed, especially for long Task text and for users with dyslexia or low vision *(inference; general typography knowledge, not from a source here)*. Offer a "plain font" setting, or keep the handwriting font for Matrix labels and headings only. Real text keeps copy/paste, search, screen readers, zoom and WCAG text-spacing support.
- **Perf:** one WOFF2 per font. Subset it and use `font-display: swap`. Rendering cost doesn't depend on how many Tasks there are.
- **Framework-agnostic and mobile:** plain CSS `@font-face`. The same TTF/OTF files can be bundled into React Native (e.g. `expo-font`) or native apps under the OFL.
- **i18n:** most of these fonts only cover Latin. Excalidraw added a CJK fallback font (Xiaolai) for this reason ([blog](https://plus.excalidraw.com/blog/adding-hand-drawn-font-for-chinese-japanese-korean)). Tasks are written in the user's own words, so plan a fallback stack.

## 4. Animated scribble strike-through (Completed Task)

**How rough-notation does it** ([src/rough-notation.ts](https://github.com/rough-stuff/rough-notation/blob/master/src/rough-notation.ts), [src/render.ts](https://github.com/rough-stuff/rough-notation/blob/master/src/render.ts)):
- It inserts an absolutely positioned `<svg>` as a **sibling** of the target element and sets the target to `position: relative` if it is static.
- It measures with `getBoundingClientRect()`. It re-renders on window `resize` and on a **per-annotation `ResizeObserver`**.
- It animates each path with `stroke-dasharray = stroke-dashoffset = path.getTotalLength()` and a CSS `@keyframes` animation that draws the line on. `multiline: true` draws one stroke per line box. `annotationGroup` plays annotations in sequence.
- Its docs and source don't mention `prefers-reduced-motion`.
- Status: npm latest is **0.5.1, published 2020-10-30**, and the repo was last pushed in March 2024. Community wrappers exist for React, Vue, Svelte and Angular.

**Recommended in-house approach** (same technique, built for our needs):
1. Task text stays in the DOM. When completed, wrap it in `<s>` (semantics: "no longer relevant") and mark the Task's control as completed (e.g. a checkbox with `aria-checked`, or a "Completed" label). MDN: *"The presence of the `s` element is not announced by most screen reading technology in its default configuration"* ([MDN `<s>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/s)). So don't rely on the visual strike alone.
2. Overlay an `aria-hidden` SVG sized to the text's line boxes. Draw a rough.js line or perfect-freehand scribble per line, seeded by the Task id.
3. Animate on the completion event only, using `stroke-dashoffset`. Skip the animation under `@media (prefers-reduced-motion: reduce)` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)). Tasks that were already completed on load render with no animation.
4. Measure with **one shared** ResizeObserver for the Matrix, not one per Task.
5. Cache the path per (taskId seed, line widths).
6. Fallback / "plain" mode: CSS `text-decoration: line-through` with `text-decoration-thickness` / `-style` (MDN: [`text-decoration-thickness`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-decoration-thickness)). `wavy` is one of the valid style values. It costs nothing and wraps with the text automatically, but it looks mechanical.

| Axis | Assessment |
|---|---|
| Look | Strong. This is the product's signature moment. |
| Perf | One overlay SVG per *Completed* Task. Hundreds is fine. Re-measure only on resize or edit *(inference)*. |
| A11y | Good if the meaning comes from semantics, not the drawing, and motion respects the user's setting. |
| Framework-agnostic | Yes (DOM + SVG). |
| Mobile | The geometry code carries over. Measuring does not: RN uses `onTextLayout` line metrics instead of `getBoundingClientRect` *(inference)*. Animation is Reanimated or Skia path `end` trimming *(inference)*. |

## 5. SVG filters (feTurbulence + feDisplacementMap)

**What they are.** `<feTurbulence>` "creates an image using the Perlin turbulence function" (`baseFrequency`, `numOctaves`, `seed`, `type`, `stitchTiles`). `<feDisplacementMap>` moves pixels of `in` by `scale * (channel − 0.5)` taken from `in2`. Chaining the two makes a wobble effect ([MDN feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence), [MDN feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)). It can also be applied to HTML with CSS `filter: url(#id)`.

| Axis | Assessment |
|---|---|
| Look | Makes any existing vector or CSS border wobble, and needs no geometry code. Small `scale` gives a convincing "ink on paper" edge. Animating `seed`/`baseFrequency` gives the "boiling line" cartoon effect. |
| Perf | Works per pixel over the filtered region. A filter over a whole Matrix that is re-rasterised on every scroll, drag or animation is the risky case. A filter on static, thin dividers is fine *(inference; measure in the prototype)*. |
| A11y / legibility | **Poor for text.** It displaces rendered pixels, glyphs included, which blurs and warps Task text. Keep filters off text. |
| Framework-agnostic | Yes (pure SVG/CSS). |
| Mobile | **Doesn't port.** react-native-svg lists `FeTurbulence` and `FeDisplacementMap` as **unimplemented** ([USAGE.md](https://github.com/software-mansion/react-native-svg/blob/main/USAGE.md)). React Native Skia has `FractalNoise`/`Turbulence` shaders ([docs](https://shopify.github.io/react-native-skia/docs/shaders/perlin-noise/)), but the displacement step would need a custom shader. |

Verdict: at most, use it for a subtle paper-grain background. Not a main technique.

## 6. Hand-drawn Quadrant dividers

The Matrix is "divided into four sections using two intersecting lines" (`idea.md`). Options:

1. **rough.js lines in an SVG layer** behind the Quadrants (recommended). Use two `generator.line(...)` calls with a fixed seed. Regenerate only when the Matrix size changes, since the lines should scale with the layout. You could also add rough arrowheads and "Urgent / Important" axis labels in the handwriting font.
2. **perfect-freehand strokes** along a slightly jittered line, for a felt-pen look that matches the strike-through.
3. **A static hand-drawn SVG asset** (drawn once by hand) stretched with `preserveAspectRatio="none"` or used as a `border-image`. It's the cheapest option and gives the best "human" look. But stretching distorts stroke width, and the lines are the same every time *(inference)*.
4. **CSS border + SVG filter wobble** (§5). Very little code, but it doesn't port to mobile.

All options: mark the lines `aria-hidden`. The Quadrants' meaning comes from real headings/regions (e.g. `<section aria-labelledby>`), not from the lines. Keep the lines out of the drag hit-testing path (`pointer-events: none`).

Mobile: options 1–2 port as path data. Option 3 ports as an SVG asset. Skia's `DiscretePathEffect` ("breaks a path into segments of a certain length and randomly moves the endpoints away from the original path by a maximum deviation", with a `seed`) gives a native equivalent without JS geometry ([Skia path effects](https://shopify.github.io/react-native-skia/docs/path-effects/)).

---

## Comparison summary

| Approach | Look | Many Tasks | A11y / legibility | Framework-agnostic | Carries to mobile |
|---|---|---|---|---|---|
| rough.js (generator + cache) | Pencil sketch | Good if seeded and cached | Decorative only; fine | Yes | Yes (path strings) |
| perfect-freehand | Ink / felt pen | Good | Decorative only; fine | Yes | Yes (JS, plus a Dart port) |
| rough-notation | Pencil sketch, animated | ResizeObserver + SVG per annotation | No reduced-motion handling | Yes (+ wrappers) | No (DOM-bound); idea only |
| Handwriting font | Strongest "handwritten" signal | Unaffected | Real text, but slower to read; offer a plain option | Yes (CSS) | Yes (OFL bundling) |
| SVG turbulence filter | Wobble / ink bleed | Risky over large or animated areas | Warps text; bad | Yes | No (not in react-native-svg) |
| Static SVG asset | Most human | Best | Decorative | Yes | Yes |
| CSS `line-through` | Mechanical | Best | Good | Yes | Yes |

## Recommendation for the prototype (#8)

Try these, in this order:

1. **Strike-through bake-off:** show the same Completed Task three ways, side by side:
   (a) rough.js single or double line (roughness ~1.5, seeded by Task id),
   (b) perfect-freehand tapered scribble (seeded zig-zag through `getStroke`),
   (c) CSS `line-through` fallback.
   Each is drawn on with `stroke-dashoffset`, switched off under `prefers-reduced-motion`, and wrapped in `<s>` plus an explicit completed state.
2. **Dividers:** rough.js lines vs. a perfect-freehand line in an `aria-hidden` SVG layer, regenerated only on resize.
3. **Fonts:** Task text in Excalifont, Kalam or Patrick Hand vs. a clean sans, with the handwriting font kept for Quadrant labels. This is how to decide the "whole UI vs. Matrix only" extent.
4. **Stress test:** about 200 Tasks with about 50% completed. Check drag smoothness and re-layout cost with the shared-ResizeObserver plus seeded-cache design.
5. **Optional:** a subtle `feTurbulence` paper grain behind the Matrix only, off text. Drop it if it costs frames.

Don't adopt rough-notation as a dependency (stale since 2020, one observer per annotation, no reduced-motion handling). Don't use tldraw (proprietary licence).

## Implications for other tickets

- **Web framework:** no choice here requires a particular framework. The geometry libraries are plain TS that returns strings or arrays. React fits most naturally with a React Native mobile client (react-native-svg / Skia), but nothing rules out others.
- **Data model / sync:** store a **per-Task stable `seed`**, or derive it deterministically from the Task id, so the scribble looks the same across re-renders and devices. Deriving it from the id needs no schema change.
- **Visual direction:** the legibility cost of handwriting fonts on Task text is the main argument for applying the hand-drawn style to "Matrix chrome and strike-through" rather than to all text.
- **Mobile later:** avoid SVG filter effects in anything essential, because they don't port to react-native-svg.
