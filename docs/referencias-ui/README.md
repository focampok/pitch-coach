# Design references — Pitch Coach

Working folder for the UX/UI phase. It lives **inside the repo**, in
`docs/referencias-ui/`, versioned in git. (It used to live outside, in
`~/Proyectos/pitch-coach-refs/`; that copy became obsolete and was deleted.)

## Scope of this folder (and the design source of truth)

A project has **one** design-reference folder: this one, inside the
repo. The outside copy became obsolete and was deleted; do not create a new one.

This folder is **pre-direction**: captures and notes for **deciding** the visual
world. The tokens, values, and rules further down (palette, ramp, animation)
are a **proposal derived from the captures**, meant as input to the redesign
— **they are not yet the product's visual contract**.

The only formal source of truth for the visual system lives in [`DESIGN.md`](../../DESIGN.md)
at the repo root. Today that document records the **world before the redesign**
and is **anti-reference**; when the redesign starts, `DESIGN.md` is the destination
for the approved tokens and the official visual direction. Product design context
(users, brand commitments, accessibility): [`PRODUCT.md`](../../PRODUCT.md).

Practical rule: if a value appears here and later also in `DESIGN.md`,
**`DESIGN.md` wins**. Adopted tokens are not duplicated here.

Direction status: **proposal**. The color, type, and hierarchy direction in this
document **has not yet been chosen** by the user; it is material for deliberation,
not a closed decision.

Hand-collected captures go here; the ones already seeded come
from inspo/awwwards (MCP, 2026-10-02) and were **visually verified**, not only
by metadata.

## How to add references

What helps most: **a filename that names the product** (`linear-inbox.png`,
`granola-recording.png`) and, if possible, **one line on what you liked about that
capture**. Pixels can describe what is there, but they do not always reveal which
*element* caught your attention — and that is what is needed to curate
against the project's direction.

## Validation criteria

The real criterion of seriousness, measured in the core captures (Tana, Harvard,
Lucid, Railway), **is not the chosen hue but the discipline**:

1. **One color carrier per frame.** Tana: black + one green. Harvard:
   wine + white. Lucid: photo + tan + white.
2. **Very few corner radii.** Wealthsimple uses exactly two across the whole
   page (`0px` and `12px`).
3. **Generous spacing rhythm:** 80–160px between sections (measured median:
   96px). Below ~64px two sections read as one cramped block.
4. **The hero fits in the first viewport** (~1280×800). Overflow below the
   fold is the most common failure of AI-generated pages.

**Quick test:** does the palette survive as the only color in the frame?
## Proposed palette — olive, a single hue

> **Proposal, not a contract.** What follows is the color exploration derived from
> `color.png`, and it is there to deliberate the redesign. It is **not** yet the
> product's token system: the formal record lives in [`DESIGN.md`](../../DESIGN.md)
> and, when the redesign starts, the approved tokens are consolidated there.

Designed with **animation as a first-class constraint**. The live indicator
needs a hue with a usable range in both modes, and everything else
has to be colorless — because "live" only reads as live if it is the only
thing with color on the screen.


Base: the olive `#285828` extracted from `color.png`. It was extended into an eleven-step
ramp, and each step was checked against both backgrounds.

### The ramp — one hue covers both modes

| Step | On light `#F9F8F6` | On dark `#0F0F0E` |
|---|---|---|
| 950 `#16301A` | 13.44:1 AA | 1.34:1 |
| 900 `#1E4022` | 10.92:1 AA | 1.65:1 |
| 800 `#285828` ← your choice | 7.86:1 AA | 2.30:1 |
| 700 `#356B34` | 5.99:1 AA | 3.02:1 graphic |
| 600 `#457F42` ← **pivot / rest** | 4.53:1 AA | 3.99:1 graphic |
| 500 `#5C9655` | 3.33:1 graphic | 5.43:1 AA |
| 400 `#7FA86B` | 2.56:1 | 7.05:1 AA |
| 300 `#A3C48F` | 1.82:1 | 9.91:1 AA |
| 200 `#C2DAB4` | 1.42:1 | 12.77:1 AA |
| 100 `#DFEBD6` | 1.16:1 | 15.52:1 AA |
| 50 `#F0F5EB` | 1.04:1 | 17.32:1 AA |

The crossover falls between 600 and 500, and **step 600 clears the graphic threshold on
both backgrounds** (4.53 light / 3.99 dark). That is the pivot of the whole system.

This is what olive buys and bordeaux does not: when you lighten the wine so it
works on dark, it becomes a dusty rose — *another color*. Lightened olive
is still olive; it only turns sage. **One hue, stable identity in both
modes.**

### Tokens (working proposal)

> The values below are the palette's **working proposal**. They do **not** yet
> live in the code or in [`DESIGN.md`](../../DESIGN.md); when the redesign adopts
> them, they are consolidated there and this block becomes historical. Until then, the
> app uses the current tokens (the pre-redesign world documented in `DESIGN.md`).

**Light** — background `#F9F8F6` · surface `#F1F0ED` · elevated `#FFFFFF`

| Token | Value | Contrast |
|---|---|---|
| `text` | `#1A1917` | 16.55:1 on background · 17.57:1 on elevated |
| `text-muted` | `#6B6862` | 5.23:1 |
| `text-subtle` | `#726E67` | 4.78:1 |
| `signal` | `#285828` | 7.86:1 · 8.34:1 on elevated |
| `signal-peak` | `#16301A` | 13.44:1 |
| `signal-rest` | `#457F42` | 4.53:1 |
| `signal-tint` | `#DFEBD6` | active row, see below |
| `field` | `#1E4022` | olive field, bone text 10.92:1 |
| `attention` | `#9E4A38` | 5.67:1 — findings only, never the score |
| `border` | `#D6D2C9` | 1.42:1 |
| `border-strong` | `#CCC8BF` | 1.57:1 |

**Dark** — background `#0F0F0E` · surface `#1A1A18` · elevated `#242422`

| Token | Value | Contrast |
|---|---|---|
| `text` | `#F4F3F0` | 17.28:1 on background |
| `text-muted` | `#A3A099` | 7.35:1 |
| `text-subtle` | `#807D76` | 4.67:1 |
| `signal` | `#A3C48F` | 9.91:1 · 9.01:1 on surface |
| `signal-peak` | `#DFEBD6` | 15.52:1 |
| `signal-rest` | `#457F42` | 3.99:1 |
| `signal-tint` | `#1E4022` | active row |
| `field` | `#1E4022` | olive field, bone text 10.45:1 |
| `attention` | `#C97C68` | 6.00:1 |
| `border` | `#35352F` | 1.55:1 |
| `border-strong` | `#454540` | 1.99:1 |

Note: `border` is deliberately low (1.4–1.6:1). A border is not text; below
~1.3:1 it stops being visible. The values tested here read without shouting.

### Active row (pattern taken from `layout.png`)

Your `layout.png` already solved this well: an icon on a tint of the same hue. Verified:

- Light: `signal` `#285828` on `signal-tint` `#DFEBD6` → **6.75:1 AA**
- Dark: `signal` `#A3C48F` on `signal-tint` `#1E4022` → **5.99:1 AA**

This is the pattern for the open section of a rubric accordion.

## Animation — rules the palette has to hold

> **Proposal, not a contract.** Same as the palette: the rules below describe
> how the coach animation should behave. They are a direction target, not
> an implemented specification. What exists in the app today is the text
> indicator in [`alcance.md` §5.1](../alcance.md); the animated replacement arrives in
> the UX/UI phase.

### 1. One hue, and rest is 600 in both modes

The indicator **never introduces a second color**. The animation moves *one step of
the same ramp*, and moves away from 600 according to the mode's polarity:

| | rest (no audio) | live | peak |
|---|---|---|---|
| Light | `#457F42` 4.53:1 | `#285828` 7.86:1 | `#16301A` 13.44:1 |
| Dark | `#457F42` 3.99:1 | `#A3C48F` 9.91:1 | `#DFEBD6` 15.52:1 |

On light the signal **darkens** as amplitude rises; on dark it **lightens**.
That is counterintuitive, and it is the correct move: each mode moves away from its background. And because
rest is the same `#457F42` in both, the behavior is described once.

### 2. No glow, no gradient

The AI look we are avoiding comes from *material* + *glow*. The rule:
**the animation varies height and opacity, never luminescence.** If a decay
trail is needed, it is the same `signal` at ~40% opacity — not a glow.

### 3. The motifs come from your own reference

`color.png` already contains all three, used as a data language:

- **Bars** — the "Order volume" chart *is* an equalizer: thin bars
  on a dotted baseline. The shortest step. The baseline uses `border`, **not**
  `signal`, so the hue stays exclusive to the live element.
- **Ring** — the one in "Registrations" (`73.37K`). A ring that segments or
  thickens with the audio is the best anti-orb answer: geometric, not a sphere,
  and already justified by the product's own system.
- **Signal line** — the one in "NPS", with an area fill. The same motif as the
  Wealthsimple precedent.

A **wireframe** polygon also works, but only if it is structural: a flat
outline, vertices moved by frequency bands, one color, no shading. A
shiny polyhedron slips back into the cliché — it is the sphere's cousin, not an alternative to it.

### 4. Continuity from recording to result

The strongest version: **the live indicator becomes the score.** While you
record, the bars or the ring respond to the microphone; when recording ends, that same
element settles and becomes the score visualization. No cut and no new
screen — and it serves the "large, immediate score" hierarchy directly, because the
element that was live *is* the verdict.

The score panel is `field` `#1E4022` with bone text (10.92:1 light / 10.45:1
dark): the same panel works in both modes with the same text color.

### 5. Green cannot mean "approved"

Green in UI reads as *success*. If green is the color carrier, a 3/10 score
still reads as "fine" — the same problem red had, mirrored (there a low score
read as "error"). **Color is identity and structure; score valence is
communicated another way**: typographic weight and size, position, and an
explicit label ("Strong" / "Needs work") with a dot, not a wash of color.

`attention` stays reserved for concrete findings and error states (microphone
permission denied) — never for the score.

### 6. Optional secondary — only when there are two series

If a chart needs two distinguishable series (e.g. this session vs. the previous one):

- **Preferred:** two steps of the same ramp (`signal` + `signal-peak`). That keeps
  the single-carrier discipline.
- **If a distinct hue is required:** slate `#46586B` on light (6.90:1) and
  `#7E8FA3` on dark (5.79:1). Subordinate and desaturated on purpose: it does not compete
  with the olive.

Do not add a third hue.

## Verified contrasts (WCAG, calculated)

> The table below is the earlier exploration (bordeaux vs. navy). It is
> kept because it documents *why* they were discarded: no wine and no navy
> works as an accent on a dark background, and olive does survive being lightened.

`>= 4.5:1` normal text · `>= 3:1` large display only

| Color | on near-black `#0E0B0C` | on bone `#FAF7F2` |
|---|---|---|
| Bordeaux `#6E1D2E` | **1.75:1 — fails** | **10.46:1 — AA** |
| Deep bordeaux `#5C1A2B` | 1.53:1 — fails | 12.00:1 — AA |
| Harvard crimson `#A4293A` | 2.76:1 — fails | 6.65:1 — AA |
| Harvard wine `#681521` | 1.60:1 — fails | 11.44:1 — AA |
| Navy `#1B2A4A` | **1.38:1 — fails** | **13.31:1 — AA** |
| Navy on navy `#152853` | **1.00:1 — invisible** | 13.46:1 — AA |
| Oxidized wine `#B8637A` | 4.76:1 — AA | 3.85:1 — display |
| Powdered rose `#C9808C` | 6.48:1 — AA | 2.83:1 — fails |
| bone `#FAF7F2` on bordeaux `#6E1D2E` | — | **10.46:1** (bordeaux as a field) |

### The three conclusions from that table

1. **No wine and no navy works as a small accent on a dark background.**
   The failure is luminance, not taste. It is physics, not aesthetics.
2. **Harvard uses the wine as a *field*, not as an accent** — and that is the only
   way wine works on dark. Bone on `#6E1D2E` = 10.46:1.
3. **On dark backgrounds the accent has to be lightened**, and lightening pushes
   any saturated hue toward pastel — which is exactly the lavender of the
   AI cliché (Railway's accent is `#b4a4d5`, a *light* violet). The "AI" look
   is partly a move forced by contrast. Knowing that makes it possible to
   challenge it instead of enduring it.

## Seeded references → what to take from each

| Capture | What to take, exactly |
|---|---|
| `03-tipografia/railway-com-tipografia.png` | The type system: IBM Plex Serif with strong negative tracking (−1.96px at 54px) over a body sans with a wide line-height (1.63), on a dark background. **Discard the button violet.** |
| `02-color/harvard-edu.png` | Proof that wine reads as institutional gravity, not as stridency — and that it belongs as a **field** with light type on top. |
| `03-tipografia/tana-inc.png` | The discipline: pure black, large `Source Serif 4`, and **a single colored element** in the whole viewport. The model for "large, immediate score and verdict". |
| `04-jerarquia-resultado/lucidmotors-com.png` | The metrics strip: **small caps + large value + a thin vertical rule**, in a row. This is the hierarchy for the score. |
| `01-visualizador-audio/wealthsimple-com.png` | A full-width white **signal line** that threads through cards and ends in a sharp peak. The best formal precedent for the "market-style line" approach. |
| `03-tipografia/moshimoshimusic-com.png` | Serif (`Libre Baskerville`) at small size, used as a **label**, on a grid. A device for collapsible sections. |
| `02-color/copilot-money.png` | **Counter-reference.** It is fintech, dark, and bento — it meets the criteria and still reads playful. A warning of what happens when decorative color enters without discipline. |
| `03-tipografia/furoweb-eu.png` | `Instrument Serif` on dark, warm register. |
| `03-tipografia/danielsun-space.png` | `LT Superior Serif` on dark, warm register. |
| `04-jerarquia-resultado/basement-studio.png` | Extreme dark and art-directed; useful as a ceiling of restraint. The register is too "creative studio" for us. |
| `color.png` **(added by the user)** | Capture from the main set (it lives here, in the canonical folder). Background `#f8f8f8` and cards `#f0f0f0` (note: the card is *darker* than the background — a sunken surface, not an elevated one). Data in olive `#285828` + navy `#284078` + lavender `#a0b0f0`. It contains the three animation motifs: equalizer bars, ring, and signal line. The **proposed** palette ramp comes from here. |
| `layout.png` **(added by the user)** | Capture from the main set (it lives here, in the canonical folder). The row pattern: icon on a tint of the same hue + title + mono badge + description. The selected state is solved with tint + text in the same hue (AA verified). This is the model for rubric rows and for the accordion's open section. |

## Discard and correction log

Applied on 2026-10-02 across the full batch, to leave a clean checkpoint. The
files are deleted, and **the decision is kept**.

### Discarded images (13)

**Landings with no live visualizer (9).** They were captured, but they show no
recording UI, so they contribute nothing: `howlerjs-1280-inicio`, `descript-1280-inicio`,
`descript-390-inicio`, `riverside-1280-inicio`, `riverside-390-inicio`,
`podcastle-1280-inicio`, `adobe-podcast-1280-inicio`, `tldv-1280-inicio`,
`tldv-390-inicio`.

**Exact duplicates from seeding the folder (4).** There is now one copy per
image:

- `02-color/wealthsimple-senal.png` → kept as `01-visualizador-audio/wealthsimple-com.png`
- `02-color/lucidmotors-com.png` → kept as `04-jerarquia-resultado/lucidmotors-com.png`
- `04-jerarquia-resultado/copilot-money.png` → kept as `02-color/copilot-money.png`
- `02-color/railway-com.png` → kept as `03-tipografia/railway-com-tipografia.png`

### Moves

`otter-1280-transcribiendo.png` and `fireflies-1280-transcribiendo.png` →
`04-jerarquia-resultado/`. They are transcription screens, not visualizer screens.

### Corrections applied

1. **`zencastr` was misclassified.** It was listed as `ring/meter` with a
   "red recording ring". Verified: it is a **marketing landing with a
   phone mockup**, and the "ring" is a **circular record button**. The
   ring motif **has no product precedent** in the batch — it is an
   extrapolation from `color.png`, and that is worth knowing.
2. **`audiomotion` rainbow gradient.** All three captures use the same
   frequency gradient (red→blue). Only the radial one was marked as a counterexample;
   **it applies to the whole family**.
3. **`FICHAS.md`** had a headerless table (5 unlabeled columns) and was
   duplicated byte for byte. Rebuilt with headers, a single copy, in
   `01-visualizador-audio/`.
4. **Unverified claim removed:** that the `wavesurfer` Record button
   stayed disabled.
5. **Canonical copy:** a reference to `/workspace/` that pointed at a
   nonexistent environment was removed. This folder is the canonical one.
6. **Width:** the new captures are **1280px**, not the 1440px the
   prompt asked for. Defensible (this file's own measured guide is "first viewport
   ~1280×800"), but they are **not 1:1 comparable** with the inspo captures, which are 1440.

## Audio visualizer

Status: **closed in the essentials.** See `01-visualizador-audio/FICHAS.md` for the
per-capture detail, including the two in-house passes (`vivo/` and `nativas/`).

`01-visualizador-audio/` holds 12 captures, but of the 22 that were swept, **11
were product landings with no live visualizer**. The usable material came from
**library demos** (`wavesurfer`, `peaksjs`, `audiomotion`) and from a mockup
(`zencastr`) — not from live product UI.

**The learning that matters: public landings of recording products do not
expose their visualizer.** MCP sources do not cover it either — inspo returns
audio *brand* sites (SoundCloud, Dolby, Epidemic Sound, ElevenLabs), and
awwwards returned one site.

That was resolved with two in-house sweeps: **live states** captured with
Chromium and a synthetic microphone (`vivo/`), and **native captures** of real apps
from the Google Play listing at 1080px (`nativas/`).

What this category did settle, verified by looking at the images:

- **The rest state is an empty plane**, not a waiting pulse
  (`audiomotion` active vs. no-audio).
- **The empty wave panel + "Press Record"** in `wavesurfer` is the state before
  microphone permission, which is specifically a web state, and no native capture
  shows it.
- **Bars that are indicator and control at once** (the 9 faders in `wavesurfer`).
- **The held peak LED** (`audiomotion-minimal`): the peak stays for an instant
  and then falls. It is "rest with memory" — it solves the rest state without a
  decorative pulse.
- **The native composition of the recording state** (`app-recorder-grabando`): a giant
  timer as the hero, a circular button with a halo, and a full-width waveform at the foot.
- **The timer inline between two waveform halves** (`app-otter-grabando`), with
  Summary / Transcript / AI Chat tabs above — the pattern for our sections.
- **Motif convergence:** the five recording-app icons downloaded and then
  discarded were **all** bars or a waveform. That is the category's universal
  language, which is why it needs its own treatment so it does not become the default.

## Sources

- inspo — `https://inspomcp.dev/api/mcp` · per-site DESIGN.md at
  `https://inspomcp.dev/d/<slug>/DESIGN.md`
- awwwards — `npx -y awwwards-mcp`
- Original captures `hero.1440.webp` at
  `https://0nme3pk5am3urwa9.public.blob.vercel-storage.com/captures/<slug>/`
  (also `full.1440`, `mobile.384`)
