---
name: TrainLog
description: Solid soft-UI dose card — white surfaces, light-carved depth, saturated colour cells for state.
colors:
  board: "#f0f5f5"
  card: "#FEFEFD"
  panel: "#F3F8F8"
  well: "#EAF2F2"
  glass-fill: "#FEFEFD8C"
  shade: "#7E9EA0"
  rule: "#7E9EA03D"
  scrim: "#00000038"
  ink: "#141A2A"
  ink-2: "#3C465C"
  ink-3: "#4E586E"
  on-fill: "#FFFFFF"
  on-live: "#3A2400"
  planned: "#2F62F0"
  planned-ink: "#1F49C4"
  planned-wash: "#E7EDFE"
  actual: "#0F9B67"
  actual-ink: "#0A7049"
  actual-deep: "#08603E"
  actual-wash: "#E2F5EE"
  progress: "#6D3FE0"
  progress-ink: "#5A2FC4"
  progress-wash: "#EDE7FD"
  missed: "#DE3B45"
  missed-ink: "#B32530"
  missed-deep: "#951C26"
  missed-wash: "#FCE8E9"
  live: "#F5A524"
  live-ink: "#8A5200"
  live-rail: "#FFD489"
  live-wash: "#FEF2DE"
  overlay-shadow: "#1E2A40"
typography:
  load:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 7vw, 4rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.045em"
    fontFeature: "tabular-nums"
  clock:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.045em"
    fontFeature: "tabular-nums"
  page-title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 6vw, 4.2rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  readout:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontFeature: "tabular-nums"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.012em"
  lede:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  measure:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
    fontFeature: "tabular-nums"
  measure-sm:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tabular-nums"
  lot:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
  label:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.12em"
  micro:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.5625rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.09em"
rounded:
  line: "2px"
  hair: "6px"
  field: "12px"
  control: "14px"
  card: "20px"
  frame-sm: "22px"
  frame: "30px"
  cell: "999px"
  chip: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "72px"
components:
  dome-planned:
    backgroundColor: "{colors.card}"
    textColor: "{colors.planned-ink}"
    rounded: "{rounded.cell}"
    size: "76px"
    typography: "{typography.measure}"
  dome-live:
    backgroundColor: "{colors.live}"
    textColor: "{colors.on-live}"
    rounded: "{rounded.cell}"
    size: "96px"
  dome-logged:
    backgroundColor: "{colors.actual-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.cell}"
    size: "76px"
  dome-suggested:
    backgroundColor: "{colors.progress}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.cell}"
    size: "76px"
  dome-missed:
    backgroundColor: "{colors.missed-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.cell}"
    size: "76px"
  dome-locked:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.cell}"
    size: "76px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.s-5}"
  well:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "{spacing.s-3}"
  button-primary:
    backgroundColor: "{colors.actual-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.actual-deep}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.planned-ink}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.planned-wash}"
  button-destructive:
    backgroundColor: "{colors.missed-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
    height: "48px"
  button-destructive-hover:
    backgroundColor: "{colors.missed-deep}"
  button-disabled:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
    height: "48px"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "14px 12px"
    height: "48px"
  chip-planned:
    backgroundColor: "{colors.planned-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.chip}"
    padding: "6px 12px"
    typography: "{typography.label}"
  chip-actual:
    backgroundColor: "{colors.actual-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.chip}"
    padding: "6px 12px"
  chip-progress:
    backgroundColor: "{colors.progress}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.chip}"
    padding: "6px 12px"
  chip-missed:
    backgroundColor: "{colors.missed-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.chip}"
    padding: "6px 12px"
  chip-live:
    backgroundColor: "{colors.live}"
    textColor: "{colors.on-live}"
    rounded: "{rounded.chip}"
    padding: "6px 12px"
  chip-neutral:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.chip}"
    padding: "6px 12px"
  alert-missed:
    backgroundColor: "{colors.missed-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  alert-progress:
    backgroundColor: "{colors.progress}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  timer-shell:
    backgroundColor: "{colors.live-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.card}"
    padding: "{spacing.s-5}"
  nav-item-active:
    backgroundColor: "{colors.planned-ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.control}"
    padding: "8px 4px"
---

# Design System: TrainLog

Extracted from `design/preview.html`, the first built surface of this world. Re-run
`/impeccable document` once app code exists so the tokens track the implementation.

## Overview

**Creative North Star: "The Dose Card"**

A weekly compliance dose card: a white board, a clear film, and rows of cells you press one at a
time. The card carries the plan, printed and permanent. Pressing a dome does not change the card, it
changes one cell. A Placement is an unpressed dome, a Session is a pressed cell, and history is the
card you can no longer un-press.

Three materials, and each one has one job. **Solid white** is the ground and the resting state of
everything — flat fills, no gradients on surfaces. **Light** carves the depth: a restrained pair of
soft shadows, cool below-right and white above-left, small enough to give a component a body without
becoming the aesthetic. **Saturated colour** provides the contrast the white would otherwise lack —
recorded and active cells are filled solid with their hue, not tinted with a pale wash. Glass appears
rarely and only where it can actually be seen, floating over colour, so that translucency reads as a
distinct material rather than as decoration.

Light by decision, not by category: the scene is a gym floor at arm's length, one hand occupied,
under bright fluorescents or window glare. A solid coloured cell is legible there; a pale wash is
not.

Three rejected worlds, all explicit. The category standard: dark ground, one neon accent, glowing
progress ring, centred hero metric. **Cloud Quarry**, the earlier chamfered-edge, blue-only world in
PRODUCT.md, superseded by rounded cells and the five-hue set. And **2010s neumorphism**: gradient-
faced blobs, heavy symmetric shadows, everything the same monochrome grey-white, with state readable
only by squinting. The soft depth stayed; the gradient faces, the shadow weight and the monochrome
did not.

**Key Characteristics:**

- One near-white face for every surface, on a board a full step darker than it.
- Objects sit *on* the board with a soft drop beneath them. Nothing is carved into it.
- Colour is the contrast device: state cells are filled solid, not washed.
- Glass appears only over colour, where blur is visible and doing work.
- Two depth states carry meaning: raised is pressable, flat is settled.
- One authored motion moment — the press — that every other transition inherits.
- One weight range carries display and UI alike; mono is measurement only.

## Colors

Five saturated hues, each owning exactly one concept from [CONTEXT.md](./CONTEXT.md), over solid
white surfaces. The `-ink` variants are the fill values, chosen so white labels clear 4.5:1; the
lighter base hue is for strokes, rings and chart series where nothing sits on top.

### Primary

- **Instrument Blue** (`{colors.planned}`): everything the programme said. Planned targets, a
  Placement on the calendar, the planned chart series, the focus ring. A planned dome stays white
  with a 2 px `{colors.planned-wash}` inner ring — the plan is marked, not yet filled, because it
  has not happened. Filled uses `{colors.planned-ink}`.
- **Foil Green** (`{colors.actual}`): everything that actually happened. A logged cell fills solid
  `{colors.actual-ink}`. It is also the primary action colour, because the primary action here is
  always "record what happened", deepening to `{colors.actual-deep}` on hover.

### Secondary

- **Derived Violet** (`{colors.progress}`): values the progression engine computed rather than
  observed. Suggestions, PRs, the derived chart segment, the progression alert. Violet marks a
  number nobody entered, which is the only honest way to show a suggestion beside a record.
- **Errata Red** (`{colors.missed}`): a Missed Placement, a Deviation, a semantic validation error.
  Fills with `{colors.missed-ink}`. Never used for emphasis or for destructive-sounding-but-safe
  actions.

### Tertiary

- **Signal Amber** (`{colors.live}`): only what is happening right now — the active Set, today's
  calendar cell, the rest timer shell (which uses the darker `{colors.live-ink}` so white text
  clears). Amber is the one hue that takes dark ink (`{colors.on-live}`) rather than white.

### Neutral

- **Board** (`{colors.board}`): the ground, and the only tinted surface in the system. It sits a
  full step below the card so a near-white face separates from it on value alone — the previous
  palette put four surfaces within 1.13 contrast of each other, which meant nothing could be told
  from anything and every control needed a ring to be found.
- **Card** (`{colors.card}`): one near-white paint for everything that sits on the board.
  **Panel** (`{colors.panel}`) survives only for neutral chips. **Well** (`{colors.well}`) is the
  tint for what is inert or receiving — a rest day, a disabled control, a recessed readout, and
  every form field: a field is a cavity something goes into, and painting it card-white said the
  opposite.
- **Glass Fill** (`{colors.glass-fill}`): the translucent sheet, used with `blur(20px)
  saturate(1.8)`, only over colour.
- **Shade** (`{colors.shade}`): the shadow hue, drawn from the board's own family so a drop reads
  as the board darkening under an object rather than as grey smoke on top of it.
- **Board Ink** (`{colors.ink}`) for primary text and load numerals, `{colors.ink-2}` for secondary
  copy, `{colors.ink-3}` for measure labels and passive metadata. `{colors.on-fill}` is white text
  on any filled cell.

### Named Rules

**The Solid Surface Rule.** Component faces are flat solid fills. No gradient stands in for depth —
if a surface needs to look raised, that is the shadow's job, not a two-stop ramp across its face.
The only gradients in the system are the ambient colour bloom behind glass and the chart's own
strokes.

**The Fill-Not-Wash Rule.** State is carried by a solid saturated fill with white (or, for amber,
dark) text. Pale washes are decoration and they disappear in gym light; they survive only as the
planned dome's inner ring, the ghost alerts' hover, and chart tints.

**The One Concept Per Hue Rule.** A hue names a state and nothing else. Green is not "success", it
is *actual*. Red is not "danger", it is *missed or deviated*. Never reach for a hue because a
control needs emphasis; emphasis comes from size and depth.

**The Ink Floor Rule.** Every text token is verified against the composited surface it actually sits
on, translucency included. Filled cells always use the `-ink` variant, never the base hue, because
white on the base hue fails at 3.5:1.

## Typography

**Display / UI Font:** Inter (variable, `wght` 100–900, `opsz` 14–32), self-hosted woff2
**Measure Font:** Martian Mono (variable), self-hosted woff2

**Character:** Inter is a neutral UI grotesque drawn for screens, with an optical-size axis that
redraws it for the size it is set at — which matters in a product whose type runs from a 9 px field
caption to a 64 px load numeral. It is deliberately unopinionated: the character in this world comes
from the material, the depth and the five hues, not from the letterforms. Martian Mono is engineered
and slightly over-wide, which is exactly right for a column of weights that must line up and be read
in a glance. There is no third face and no decorative face.

Inter has no width axis, so display sizes carry their emphasis in weight and size alone. That is the
trade this system accepted when it chose a neutral face: the load numeral is large and heavy rather
than large and wide.

### Hierarchy

- **Load** (800, clamp 2.5–4rem, 0.92, −0.045em, tabular): working weight, the largest
  type in the product. **Clock** (3.5rem) is the same voice for the rest timer.
- **Page title** (800, clamp 2.6–4.2rem): documentation and marketing surfaces only.
- **Display** (800, 2rem): exercise name, screen title. **Headline** (700, 1.75rem) is
  its section-level sibling. **Readout** (800, 1.875rem, tabular) is the weight/reps/RIR
  value inside a recessed field.
- **Title** (700, 1.125rem, −0.012em): card and modal headings.
- **Lede** (400, 1.0625rem) / **Body** (400, 1rem/1.6, 65–75ch) / **Body-sm** (400, 0.9375rem) /
  **Caption** (400, 0.875rem): prose, in descending prominence.
- **Measure** (Martian Mono 500, 0.8125rem, tabular) and **Measure-sm** (0.75rem): weight, reps,
  RIR, dates, durations, units.
- **Lot** (Martian Mono 500, 0.6875rem, 0.08em, uppercase): screen slugs and provenance lines.
- **Label** (Martian Mono 600, 0.625rem, 0.12em, uppercase): field captions and chips.
  **Micro** (0.5625rem, 0.09em) is the nav and dome sub-label.

### Named Rules

**The Measurement-Only Mono Rule.** Mono is for data — numbers, units, dates, identifiers. It is
never used to make prose look technical. If it is a sentence, it is Inter.

**The Weight-and-Size Rule.** Emphasis comes from weight and size, never from a second family and
never from a colour. 800 for load, clock, page title, display and readout; 700 for headline and
title; 400 for everything that is prose. A hue is a state, so it can never also be emphasis.

## Layout

Mobile-first at a 390 px design width; the app is a phone PWA and every screen is authored there
first. Screens are a single vertical column of cards with `{spacing.s-4}` between them and
`{spacing.s-5}` inside them (`{spacing.s-4}` inside a phone frame). Documentation and desktop
surfaces widen to a 1180 px sheet.

Spacing is an 8-based scale with a 4 px half-step, `{spacing.s-1}` through `{spacing.s-8}`. Tight
groups use `s-2`/`s-3`; separated regions use `s-4`/`s-5`; page sections use `s-8`. Headings carry
more space above than below.

**Thumb-zone ordering.** On training screens the reading order is inverted relative to the tap
order: context sits at the top, the active Set and its primary action sit in the lower third where
the thumb already rests, and navigation is the last thing on the page.

**The colour bloom.** Each screen carries a low-alpha radial bloom of blue, violet and green at its
bottom edge, behind the glass nav. It exists so the glass has something to blur — glass over flat
white is invisible, and an invisible material is a lie.

A floating bar earns the same film a second way. A task screen's top bar does not reach any edge:
board runs above and beside it, and the column scrolls *underneath* rather than up to it. What the
blur is working on there is the content itself — cards, rules and ink sliding past behind the sheet
— which is the Visible-Glass Rule satisfied by movement instead of by a bloom. The bloom does not
transfer: mirrored to the top edge it lands at a different density behind a bar half the nav's
height, so it reads as a third colour rather than as the nav's.

Wide content — the progress chart in particular — scrolls inside its own `overflow-x: auto`
container. The page body never scrolls horizontally at any width.

### Named Rules

**The 48 Rule.** Every interactive control is at least 48 px tall. The single exemption is the
7-column calendar week grid, where day cells land at ~41 px because seven columns will not fit a
390 px viewport otherwise; they keep 6 px of separation and are never the only route to a day.

## Elevation & Depth

Depth is low-amplitude and structural, and it now says exactly one thing: **whether you can act on
this**. Two positions, plus one rare material.

- **Raised (`--dome`, `--lift`)** — a solid near-white face with a single soft drop beneath it,
  drawn in the board's own hue. Means *pressable*, or *a container sitting on the board*. `--dome`
  is the shallower of the two and belongs to rows, buttons and day cells; `--lift` carries cards.
- **Flat (no shadow)** — the same face with nothing under it. Means *settled*: a trained day, the
  current tab, a disabled control, a readout. A record is not a control, and it should not look
  like one.
- **Glass (`--glass`)** — an inner top highlight over a wide soft drop, on a translucent sheet with
  `blur(20px) saturate(1.8)`. Used only over the colour bloom, at the bottom nav.

Hover raises `--dome` to `--dome-lift` and lifts 2 px; it never changes hue. Overlays and device
frames use `--overlay`, the one large structural shadow in the system.

### Shadow Vocabulary

- **`--dome`** (`0 1px 2px rgba(126,158,160,.16), 0 4px 10px -2px rgba(126,158,160,.22)`): resting
  pressable surface — rows, secondary buttons, steppers, day cells.
- **`--dome-lift`**: hover, and the live cell.
- **`--lift`**: cards, panels, chart shell, timer shell, filled buttons.
- **`--glass`**: the nav film.
- **`--overlay`** (`0 24px 52px -22px rgba(30,42,64,.26)`): modals and device frames only.
- **`--edge`**: the soft cool hairline, for the rare case a face needs an outline as well.

### Named Rules

**The On-Top Rule.** Objects sit on the board; nothing is carved into it. The earlier recipe paired
a cool shadow below-right with a white counter-light above-left, which reads as moulded putty —
that white half is gone, and with it the whole inset vocabulary. If a thing needs to look raised,
one soft drop does it.

**The Two-Position Rule.** Depth has exactly two values and they are not decorative: a shadow means
you can press it, no shadow means it is done. Colour still says *what* a thing is — green is
actual, red is missed — and depth says only whether it is still yours to act on.

**The Low-Amplitude Rule.** Drops stay soft and shallow. If a component looks moulded out of putty,
the shadow is doing the design's job instead of the colour's.

**The Board-Hue Shadow Rule.** Shadows are `rgba(126,158,160,…)`, the board's own family at low
alpha — never black, never chromatic. A drop should read as the board darkening beneath an object,
not as grey smoke laid on top of it.

**The Visible-Glass Rule.** Glass only goes where there is colour behind it. Frosted white over a
flat surface is an invisible material and a wasted `backdrop-filter`; if there is nothing to blur,
use a solid face with `--lift`.

## Shapes

Everything is rounded, and the radius encodes what the thing is:

- **Cells, chips and buttons** (`{rounded.cell}` / `{rounded.chip}`, 999px): domes, status pills and
  everything you press. Fully round, because a blister cell is round — and a button is the same
  kind of object, a whole thing lifted off the board rather than a panel with softened corners.
- **Device frames** (`{rounded.frame}` 30px, `{rounded.frame-sm}` 22px below 560 px).
- **Cards** (`{rounded.card}`, 20px): the board and its panels.
- **Controls** (`{rounded.control}`, 14px): nav items, day cells, tabs, steppers, alerts, menu rows.
- **Fields** (`{rounded.field}`, 12px): inputs and recessed readouts, one step tighter than the
  control beside them.
- **Details** (`{rounded.hair}` 6px, `{rounded.line}` 2px): inline code, legend rules.

Borders are hairlines in `{colors.rule}` only. There are no coloured left-borders, no zero-blur
block shadows, and no chamfers or cut corners anywhere. Raised faces carry a single 1 px inner top
highlight — a specular edge, not a gradient across the face.

## Implementation — Tailwind v4 & shadcn

Everything above is the specification. Tailwind and shadcn are how it gets built, and neither is
allowed to change it: **Tailwind renders the tokens, shadcn supplies behaviour, appearance comes
from this file.** A screen that looks like default shadcn is a defect, not a shortcut.
[PRD §8](./docs/PRD.md) fixes the stack; this section is the binding between that stack and the
tokens above, written so it can be pasted into a repository and compiled.

### Where it lives

```text
src/styles/theme.css        @font-face · @theme · shadcn bridge · @utility type scale
src/lib/utils.ts            cn() = clsx + tailwind-merge
src/components/ui/          shadcn — behaviour only, geometry re-skinned on arrival
src/components/             ours — Dome, Button, Card, Chip, Field, Well, Nav, Alert, Empty
src/assets/fonts/           inter-*.woff2, martianmono-*.woff2
```

`theme.css` is the single declaration of this system. Every value in the frontmatter of this
document appears there exactly once, and nowhere else in the tree.

### 1. Fonts — self-hosted, variable, no runtime request

`font-optical-sizing` stays at its default `auto`, so Inter's `opsz` axis redraws the face for the
size it is set at — the reason no size here declares it by hand. Both families ship as two subsets
(latin, latin-ext).

```css
@font-face {
  font-family: Inter;
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("../assets/fonts/inter-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
                 U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
                 U+2212, U+2215, U+FEFF, U+FFFD;
}
/* …inter-latin-ext.woff2, plus martianmono-latin.woff2 and its -ext subset
   (font-weight 300 700, font-stretch 75% 112.5%) — same shape. The exact
   unicode-range values are in src/styles/theme.css. */
```

### 2. `@theme` — the tokens become the utilities

```css
@import "tailwindcss";

@theme {
  /* surfaces */
  --color-board: #D9E6E7;          --color-card: #FEFEFD;
  --color-panel: #F3F8F8;
  --color-well: #EAF2F2;           --color-glass-fill: #FEFEFD8C;
  --color-rule: #7E9EA03D;         --color-scrim: #00000038;

  /* ink */
  --color-ink: #141A2A;            --color-ink-2: #3C465C;
  --color-ink-3: #4E586E;          --color-on-fill: #FFFFFF;
  --color-on-live: #3A2400;

  /* the five hues — base for strokes, -ink for fills, -wash for tints */
  --color-planned: #2F62F0;  --color-planned-ink: #1F49C4;  --color-planned-wash: #E7EDFE;
  --color-actual: #0F9B67;   --color-actual-ink: #0A7049;   --color-actual-wash: #E2F5EE;
  --color-actual-deep: #08603E;
  --color-progress: #6D3FE0; --color-progress-ink: #5A2FC4; --color-progress-wash: #EDE7FD;
  --color-missed: #DE3B45;   --color-missed-ink: #B32530;   --color-missed-wash: #FCE8E9;
  --color-missed-deep: #951C26;
  --color-live: #F5A524;     --color-live-ink: #8A5200;     --color-live-wash: #FEF2DE;
  --color-live-rail: #FFD489;

  /* radii */
  --radius-line: 2px;     --radius-hair: 6px;      --radius-field: 12px;
  --radius-control: 14px; --radius-card: 20px;     --radius-frame-sm: 22px;
  --radius-frame: 30px;   --radius-cell: 999px;    --radius-chip: 999px;

  /* elevation */
  --shadow-dome: 0 1px 2px rgba(126,158,160,.16), 0 4px 10px -2px rgba(126,158,160,.22);
  --shadow-dome-lift: 0 2px 4px rgba(126,158,160,.18), 0 10px 22px -4px rgba(126,158,160,.28);
  --shadow-lift: 0 1px 2px rgba(126,158,160,.16), 0 8px 20px -8px rgba(126,158,160,.30);
  --shadow-glass: 0 10px 30px -14px rgba(126,158,160,.55);
  --shadow-overlay: 0 24px 52px -22px rgba(30,42,64,.26);
  --shadow-edge: 0 0 0 1px rgba(126,158,160,.24);
  --inset-shadow-glass: inset 0 1px 0 rgba(255,255,255,.85);
  --inset-shadow-glass: 0 1px 0 rgba(255,255,255,.85);

  /* type families and motion */
  --font-face: Inter, system-ui, sans-serif;
  --font-measure: "Martian Mono", ui-monospace, monospace;
  --ease-press: cubic-bezier(.22, 1, .36, 1);
  --ease-snap: cubic-bezier(.4, 0, 1, 1);
  --animate-breathe: breathe 2.6s ease-in-out infinite;
  --animate-pulse-well: pulse-well 1.6s ease-in-out infinite;
}
```

That yields `bg-planned-ink`, `text-ink-3`, `rounded-cell`, `shadow-dome`,
`font-measure`, `ease-press` and `animate-breathe` — the vocabulary of this document, spelled the
same way in the markup.

Three notes the compiler cares about:

- **`--shade` is not a colour token.** It is the `126,158,160` triplet the shadow recipes
  interpolate. Declared inside `@theme` as `--color-shade` it would generate a `bg-shade` utility
  resolving to garbage, so it stays a plain `:root` custom property — or is inlined into the shadow
  values, as above.
- **Glass is two tokens plus a filter.** `backdrop-filter` cannot be expressed as a shadow, so the
  nav film is `shadow-glass inset-shadow-glass backdrop-blur-[20px] backdrop-saturate-[1.8]`, and
  that blur/saturate pair is a sanctioned arbitrary value.
- **Spacing is Tailwind's default 4 px rhythm.** `s-1…s-8` (4/8/12/16/24/32/48/72) are already
  `1, 2, 3, 4, 6, 8, 12, 18`. Do not redeclare a spacing scale.

Keyframes sit at the top level of the same file:

```css
@keyframes breathe    { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
@keyframes pulse-well { 0%, 100% { opacity: 1; }         50% { opacity: .48; } }
```

### 3. The shadcn bridge — bind the names, don't strip them

shadcn's components are authored against a fixed set of semantic variables (`bg-background`,
`text-muted-foreground`, `border-border`, `ring-ring`, and radii derived from `--radius`). There are
two ways to keep them from looking like shadcn: edit those references out of every copied file, or
declare the names once and point them at our palette. **We bind.** Stripping means repeating the
same edits per component and again on every upgrade; binding means a component lands already wearing
our colours, and what is left to fix by hand is geometry and elevation.

```css
@theme {
  /* …tokens above… */

  /* shadcn bridge — their names, our values. No new colour is introduced here. */
  --color-background: var(--color-board);
  --color-foreground: var(--color-ink);
  --color-card-foreground: var(--color-ink);        /* --color-card is ours already, and agrees */
  --color-popover: var(--color-card);
  --color-popover-foreground: var(--color-ink);
  --color-primary: var(--color-actual-ink);         /* the primary action is: record what happened */
  --color-primary-foreground: var(--color-on-fill);
  --color-secondary: var(--color-card);
  --color-secondary-foreground: var(--color-ink);
  --color-muted: var(--color-well);
  --color-muted-foreground: var(--color-ink-3);
  --color-accent: var(--color-planned-wash);
  --color-accent-foreground: var(--color-planned-ink);
  --color-destructive: var(--color-missed-ink);
  --color-destructive-foreground: var(--color-on-fill);
  --color-border: var(--color-rule);
  --color-input: var(--color-rule);
  --color-ring: var(--color-planned);
}

:root {
  --shade: 126, 158, 160;
  --radius: 14px;                                   /* = --radius-control; shadcn derives sm/md/lg */
}
```

`--color-primary` reads green because in this product the primary action is always *record what
happened*, so a shadcn `Button` with no variant is already the right button. `--color-accent` lands
on `planned-wash` because accent is what shadcn uses for hover and selected rows — exactly the
ghost-button hover in §Buttons.

**Verify rather than assume.** The CLI's variable set moves between versions, so after the first
`add`, enumerate what the copied files actually reference:

```bash
grep -rhoE "var\(--[a-z0-9-]+\)|(bg|text|border|ring|fill|stroke)-[a-z0-9-]+" src/components/ui | sort -u
```

Anything unbound is either a name to add to the bridge or a reference to delete. `chart-1…5` and the
`sidebar-*` family are deleted rather than bound: charts take their strokes from §Charts, and a
phone PWA with four nav items has no sidebar.

### 4. The type scale is `@utility`, not `@apply`

Each named style in the frontmatter becomes one utility carrying family, size, weight, line height,
tracking, `font-variation-settings` and `font-feature-settings` **together**, because those
properties are only correct as a set. `fontVariation` maps to `font-variation-settings`,
`fontFeature` to `font-feature-settings`.

```css
@utility type-load {
  font-family: var(--font-face);
  font-size: clamp(2.5rem, 7vw, 4rem);
  font-weight: 800;
  line-height: .92;
  letter-spacing: -.045em;
  font-feature-settings: "tnum";
}

@utility type-readout {
  font-family: var(--font-face);
  font-size: 1.875rem; font-weight: 800; line-height: 1.1; letter-spacing: -.03em;
  font-feature-settings: "tnum";
}

@utility type-label {
  font-family: var(--font-measure);
  font-size: .625rem; font-weight: 600; line-height: 1.4; letter-spacing: .12em;
  text-transform: uppercase;
}
```

The remaining styles — clock, page-title, display, headline, title, lede, body, body-sm, caption,
measure, measure-sm, lot, micro — follow mechanically from the frontmatter. `type-*` is the only
prefix, and a size utility used without its scale mate (`text-2xl font-bold`) is outside the system.

### 5. shadcn — behaviour, not appearance

Take shadcn where the behaviour is expensive and easy to get subtly wrong on a screen operated
one-handed: focus traps, portals, escape and outside-dismiss, ARIA roles, typeahead,
controlled/uncontrolled state.

| Take from shadcn | Re-skin on arrival |
| --- | --- |
| Dialog, AlertDialog | `rounded-card shadow-overlay bg-card`, overlay `bg-scrim`, padding `p-6` |
| Sheet / Drawer | same, plus `rounded-t-card` and a `bg-well` grab rail |
| Popover, Tooltip, Select | `rounded-control shadow-lift shadow-edge bg-card`, items `type-body-sm` |
| Tabs | triggers are domes: `rounded-control shadow-dome`; active `bg-planned-ink shadow-none` |
| Switch | track `bg-well`, thumb `bg-card shadow-dome`, checked `bg-actual-ink` |
| Accordion | hairline `border-rule` only, chevron from `lucide-react` at 1.75 |
| Sonner | `bg-card shadow-lift rounded-control`; hued variants use the `-ink` fills |
| Progress | track `bg-well`, indicator `bg-actual` |

Write it plainly where the behaviour is not hard — buttons, cards, chips, fields, wells, nav items,
alerts, empty states. A wrapper around `<button>` buys indirection, not accessibility.

**The Dome is ours.** No shadcn component, variant or slot models a Set. It is hand-written, and it
is the only component carrying all five hues and both depth states.

### 6. Variants close, not open

`cva` defines the variant surface, `cn()` (clsx + tailwind-merge) is the only place classes are
combined, and the 48 Rule lives in the variant base — never at the call site.

```ts
export const button = cva(
  "inline-flex items-center justify-center gap-2 min-h-12 rounded-control type-title " +
  "transition-[box-shadow,transform,background-color] duration-[110ms] ease-snap " +
  "active:scale-[.975] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-planned " +
  "focus-visible:shadow-[0_0_0_3px_var(--color-planned-wash)] disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-actual-ink text-on-fill shadow-lift hover:bg-actual-deep",
        secondary: "bg-card text-ink shadow-dome hover:shadow-dome-lift hover:-translate-y-0.5",
        ghost: "bg-transparent text-planned-ink hover:bg-planned-wash",
        danger: "bg-missed-ink text-on-fill shadow-lift hover:bg-missed-deep",
      },
      size: { control: "px-[22px] py-3.5", compact: "px-4 py-2", lg: "w-full min-h-[60px] px-6" },
    },
    compoundVariants: [
      { variant: "primary", class: "disabled:bg-well disabled:text-ink-3 disabled:shadow-none " +
        "disabled:shadow-none" },
    ],
    defaultVariants: { variant: "primary", size: "control" },
  },
);
```

The Dome takes the same shape, keyed on Set state rather than emphasis — `planned | live | logged |
suggested | missed | locked` × `compact | default | live` — where `logged` and `missed` carry
`shadow-none` and `disabled`, and every instance carries an `aria-label` spelling out set
number, state and load.

### Named Rules

**The Token-Only Rule.** No arbitrary values for colour, radius, shadow, or type in application
code: `bg-[#2F62F0]`, `rounded-[20px]`, `shadow-[4px_4px…]` are banned. If a value is worth using it
is worth naming in `@theme`. Arbitrary values survive only where no token describes the value — the
41 px calendar cell, the glass `backdrop-blur-[20px] backdrop-saturate-[1.8]`, the focus halo, a
chart container height.

**The Bridge-Not-Strip Rule.** shadcn's semantic names are bound once, in `@theme`, to tokens that
already exist in this document; they are not edited out of components one file at a time, and the
bridge never introduces a value of its own. The failure mode this rule exists to prevent is still
the half-skinned component — our colours on their borders, their radii and their flat elevation — so
binding covers colour only, and the arrival re-skin must still fix radius, shadow and padding by
hand, per the table in §5.

**The No-Dark-Variant Rule.** The shadcn CLI writes a dark theme. Delete the `.dark` block, and do
not let the bridge grow a `prefers-color-scheme` twin. Dark was rejected from the use scene, and a
`.dark` block left in the tree is an invitation to ship one. Settings offers no theme control.

**The Offline Rule outranks the CLI.** `npx shadcn@latest add` runs at author time only. Anything it
pulls in that would fetch at runtime — remote fonts, hosted icon sets, telemetry — is removed before
the commit. Icons come from `lucide-react`, bundled, stroked at 1.75.

## Components

### The Dome — signature component

One dome is one Set. It is the product's whole thesis and the only component that carries all five
hues.

- **Shape:** circle (`{rounded.cell}`), 76 px default, 96 px when live, 60 px in a compact strip.
- **Planned:** solid white, `{colors.planned-ink}` numerals, `--dome` plus a 2 px
  `{colors.planned-wash}` inner ring. Marked, not filled — it has not happened yet.
- **Live:** solid `{colors.live}` with `{colors.on-live}` text, `--dome-lift`, breathing at 2.6 s.
  Largest object on screen.
- **Logged:** solid `{colors.actual-ink}`, white text, flat, disabled. Shows what was performed
  (`80` / `8 · 2`), never the target it was measured against.
- **Suggested:** solid `{colors.progress}`, white text, `--dome-lift` — raised, because a suggestion
  is still pressable.
- **Missed:** solid `{colors.missed-ink}`, white text, flat, disabled.
- **Locked:** `{colors.well}`, flat, with `{colors.ink-3}` text.
- **Press:** 220 ms `cubic-bezier(.22,1,.36,1)` from raised white to flat green, with a single
  480 ms foil ring bursting outward from `scale(.72)` to `scale(1.34)` and fading. Fires once.
- Every dome carries an `aria-label` spelling out set number, state and load.

### Buttons

- **Shape:** `{rounded.control}` (14px), minimum 48 px tall; `btn-lg` is 60 px and full width.
- **Primary:** solid `{colors.actual-ink}`, white label, inner top highlight plus `--lift`.
- **Secondary:** solid white with `--dome`. It is a dome, so it lifts on hover.
- **Ghost:** transparent, `{colors.planned-ink}` text, `{colors.planned-wash}` on hover.
- **Destructive:** solid `{colors.missed-ink}`, deepening to `{colors.missed-deep}`. It is red **at
  rest**, not only once armed: a control that deletes must be identifiable before it is touched, and
  an affordance that changes colour under the finger is worse than one that never hid. This is the
  one place Errata Red names an action rather than a state, and it is the exception the
  One-Concept-Per-Hue Rule allows.
- **Destructive, armed:** the second press of a two-press confirm keeps the same red and sinks into
  goes flat, with the label naming the consequence (`Remove` → `Remove it`) and an escape appearing
  beside it. The hue is already spent saying *destructive*, so depth carries the escalation —
  raised means "this asks", flat means "this does".
- **Disabled:** `{colors.well}`, flat — nothing under it, so there is nothing to press.
- **Loading:** the label becomes a verb in progress ("Importing") beside a 16 px spinner.
- **Active:** `scale(.975)` at 110 ms.

### Chips

Status only, never actions. `{rounded.chip}`, Label type, solid saturated fill, a 7 px dot in
`currentColor`, no shadow. One chip per state word from the glossary: Planned, Completed, Suggested,
Missed, Resting, Unplanned. Unplanned is the only unfilled chip — `{colors.panel}` with `--edge`.

### Cards / Containers

`{rounded.card}` (20px), solid `{colors.card}`, `--edge` plus `--lift`, `{spacing.s-5}` padding.
Cards never nest inside cards.

**The One Surface Rule.** A screen region is *one* bounded surface. Inside it, groups are separated
by a hairline in `{colors.rule}` and by space — never by a second surface. Board → card → well is
three stacked containers for what one can hold, and it is the nested-card mistake wearing a
different name.

A **well** therefore means only what it says: a genuine cavity — an empty state, a recessed readout,
something locked or disabled. It sits *on the board* as a region in its own right, not inside a
card, and it is never a box for grouping. A list inside a card is rows divided by hairlines; a block
set off from what precedes it takes a single `border-t`. The only surfaces that legitimately sit
inside another are form controls, because a field is a cavity something goes into.

### Inputs / Fields

Filled with `{colors.well}`, flat, with a hairline in `{colors.rule}`. The tint is what finds the
control: on a card, a field painted the card's own white had only its hairline to exist by. Focus adds a
3 px `{colors.planned-wash}` halo with a 1 px `{colors.planned}` ring. Invalid adds a 1 px
`{colors.missed}` ring and an error line below that names both the problem and the fix ("Min reps
(12) is above max reps (8). Lower it to 8 or below to accept the import."), wired with
`aria-invalid` and `aria-describedby`.

The set logger's weight/reps/RIR readouts use `{colors.well}`, flat, the value in Readout
type and the unit named in the Label above it.

**Adjustment is by ±stepper domes first, and by typing second.** The steppers are the default path
and the one the scene is designed around: one hand occupied, phone on a bench, and a numeric keypad
over the bottom half of the screen is a bad thing to put between a lifter and the button they came
to press. The step is the exercise's own increment where its rule declares one, not a fixed 2.5.

The readouts are nonetheless real inputs, because steppers alone cost too much at the edges — going
from 20 to 90 is 28 presses, and the first set of an exercise is when the jump is largest. The
readout *is* the input rather than a second control beside it, so the two edit one value and cannot
disagree. Typing commits on blur and on Enter; anything that is not a non-negative number falls back
to the last good value rather than raising an error nobody can read mid-set. The cavity carries the
focus halo on behalf of the borderless input inside it.

### Rest timer

The one full-bleed coloured surface: a solid `{colors.live-ink}` shell with white Clock type, a
`{colors.scrim}` track along the bottom edge and a `{colors.live-rail}` fill that scales down as the
rest runs out. Labels inside it invert to white at 88–92% opacity.

### Navigation

Four items — Today, Calendar, Progress, More — on a glass film over the screen's colour bloom. Micro
type, 20 px stroked icons at 1.75 weight from one drawn set. Active is white on
`{colors.planned-ink}`, flat, so the current tab reads as settled rather than pressable. Never more
than four.

### Charts (Recharts)

- `CartesianGrid` `strokeDasharray="3 5"`, `stroke` `{colors.rule}`, horizontal only. No axis lines,
  no tick lines.
- Axis text is Label type in `{colors.ink-3}`.
- **Planned** series: `{colors.planned}`, 2 px, `strokeDasharray="6 5"`.
- **Actual** series: `{colors.actual}`, 3.5 px solid, dots `r=4.5` filled white with a 2.5 px stroke;
  the latest point is `r=6`.
- **Derived** segment: `{colors.progress}`, 2.5 px, `strokeDasharray="2 6"`, terminating in a
  `{colors.progress-wash}` dot with its value labelled in Measure-sm type.
- No area gradients, no drop shadows on series, no second Y axis.
- Every chart carries `role="img"` and an `aria-label` stating the trend in words, and lives inside
  an `overflow-x: auto` container.

### States

- **Empty:** a flat well with a stroked icon, a title naming the state in product
  language ("Saturday is open"), one sentence of what to do, and a secondary button.
- **Loading:** recessed bars pulsing 1 → 0.48 opacity at 1.6 s. No sweeping shimmer.
- **Alert:** a solid band in the relevant `-ink` hue with white text, stroked icon, bold line, one
  supporting sentence.

## Do's and Don'ts

### Do

- **Do** fill component faces with a flat solid colour and let the shadow carry the depth.
- **Do** keep drops soft and shallow — a body, not a moulding.
- **Do** fill state cells solid with the `-ink` hue and white text (amber takes
  `{colors.on-live}` instead).
- **Do** pick the hue from the concept, not the emotion: blue = Planned, green = Actual,
  violet = Progression, red = Missed, amber = Live.
- **Do** let a shadow mean "pressable" and its absence mean "already done".
- **Do** put glass only where the blur is visible: over the colour bloom, or over content that
  scrolls beneath a floating bar.
- **Do** make the active Set the largest object on screen and place it in the lower third.
- **Do** keep every interactive control at or above 48 px, and set load numerals at weight 800 with
  tight tracking so they survive glare at arm's length.
- **Do** verify text against the composited surface, translucency included.
- **Do** show what was performed on a logged dome, never the target it was measured against.
- **Do** name the problem *and* the recovery in every error string.
- **Do** self-host every font as woff2 — the app makes no runtime network requests.
- **Do** name a value in `@theme` before using it; the utility and the token are the same thing.
- **Do** take shadcn for anything focus-trapped, portalled or dismissible, and re-skin it in the
  same commit.

### Don't

- **Don't** put a gradient on a component face. Depth is light, not a two-stop ramp.
- **Don't** raise the shadow amplitude to make something feel tactile; that is 2010s neumorphism and
  it turns the whole UI into grey putty.
- **Don't** stack near-identical surfaces. If two faces are within a hair of each other in value,
  one of them is not carrying its weight — delete it or move it a real step.
- **Don't** signal state with a pale wash. Washes vanish in gym light; fills do not.
- **Don't** add a white counter-light above-left to make a face look moulded; that world is gone.
- **Don't** use `backdrop-filter` where there is no colour behind it.
- **Don't** let the board drift up toward the card. It is a full step darker on purpose: that step
  is what separates every surface in the product, and without it nothing reads.
- **Don't** re-enable a recorded cell. A record is not a control.
- **Don't** introduce chamfers, cut corners, or hard block shadows — that is the discarded Cloud
  Quarry world, not this one.
- **Don't** set prose in Martian Mono, or any measurement in Inter.
- **Don't** nest a card inside a card; use a recessed well.
- **Don't** add a sixth hue, a second display face, or a dark theme. Dark was rejected from the use
  scene, not from taste.
- **Don't** animate `width`, `height`, or `padding`; the rest-timer rail scales, it does not resize.
- **Don't** loop an animation. The press fires once, and only the live dome and the loading state
  are allowed to repeat.
- **Don't** ship a shadcn component wearing its default geometry — its radii, its flat elevation,
  its padding. The bridge rewrites the colour behind `bg-background`, `border-input` and `ring-ring`;
  it does not rewrite the shape, and it never survives the generated `.dark` block.
- **Don't** reach for arbitrary Tailwind values (`bg-[#…]`, `rounded-[20px]`) or rebuild the type
  scale with `@apply`; that is what `@theme`, `@utility` and `cva` are for.
