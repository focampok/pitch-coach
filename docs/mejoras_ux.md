# Pitch Coach — UX/UI improvements

Review of **5 Oct 2026** (America/Guatemala), on the local tree at
`/home/focampo/Proyectos/pitch-coach`, HEAD `48519996` (`feat(ui): propuesta de
valor en masthead y pie con atribución`). It includes the **uncommitted** changes
from the same day in `src/components/DashboardResultado.tsx` and
`src/styles/dashboard-resultado.css`.

**Nothing in the project was modified in this pass.** There were only reads, a
local WCAG 2.x contrast calculation on the tokens, and a web search about
Emergent. The dev server was not started, nothing was committed, and nothing was deployed.

## 1. Verdict

The design **does not need a style overhaul**. The "El Acta" system is
coherent, disciplined, and above average: real tokens, dark mode by reassigning
roles, text contrast that passes AA in both modes,
44 px touch targets forced in CSS, focus handling, and `aria-live`
announcements. The remaining work is **finish**, not direction, and it
concentrates on three things: **drift between `DESIGN.md` and the code**, **accessibility
semantics in the selectors**, and **hairline legibility**.

On the 10 Emergent credits: **they are not useful for improving this app** (§7).

## 2. Scope and method

Read in this pass:

- `DESIGN.md`, `docs/README.md`, `PRODUCT.md` (context).
- `src/app/globals.css`, `src/styles/dashboard-resultado.css` (tokens and styles).
- `src/app/page.tsx`, `src/app/layout.tsx`.
- `src/components/DashboardResultado.tsx`, `GrabadorVoz.tsx`, `AnilloSenal.tsx`,
  `SelectorTipoPitch.tsx`, `PiePagina.tsx`.
- `git log` of `DESIGN.md` and `DashboardResultado.tsx`; file mtimes.

Verified in a reproducible way:

- WCAG contrast of 23 token pairs (light and dark) with a local script
  (relative luminance formula). Results in §5.
- ARIA semantics of the selectors by inspection (`grep` of `aria-pressed`,
  `role`, `aria-checked`).
- Presence of the TTS fallback by inspection of `ReproductorVeredicto.tsx`.

**Not covered by this pass:** the app was not started and was not tested with a real
screen reader, nor with an automated audit (axe/Lighthouse). Performance was not
verified, nor behavior on physical devices.

## 3. What is already in good shape (leave it alone)

Verified in the code, not assumed:

- **Text contrast: passes AA in both modes on every pair measured.** The
  16 text pairs came out ≥ 4.87:1 (most of them AAA). The `2px` focus ring on
  signal is **7.86:1** in light and **9.91:1** in dark.
- **Tokens are real:** there are no loose hex values in the components; dark mode
  reassigns roles, it does not invert the palette. The "The One Hue Rule" holds:
  olive is the only hue, and terracotta appears only in counts and errors.
- **44 px touch targets forced in CSS** with the cited rule
  (`src/app/globals.css:92`), including the transport pills
  (`.pc-transporte-btn`, `min-width/min-height: 44px`).
- **Focus handling and announcements:** `role="status"` / `role="alert"`, `aria-live`
  for the coach message (`GrabadorVoz.tsx:463`), and `scrollIntoView` when the
  result and the Ultra analysis arrive, which **respects `prefers-reduced-motion`**
  (`DashboardResultado.tsx:471-492`).
- **The scrolling transcript box** has `role="region"` +
  `aria-labelledby` + `tabIndex=0`, with the reason commented
  (`DashboardResultado.tsx:737-749`): it is keyboard-focusable and it has a name.
- **Typefaces via `next/font`** (the face that loads is the face that is used,
  `layout.tsx:12-21`), and transitions are disabled under reduced motion
  (`globals.css:203-208`, `dashboard-resultado.css:331-336`).

It is a system with a point of view. The remaining work is finish.

## 4. Prioritized findings

### P1 — Drift between documentation and code (two instances)

`CLAUDE.md` declares that `DESIGN.md` is the "source of truth for the design", and
`docs/README.md:7-11` insists: "If there is any visual discrepancy, `DESIGN.md`
wins". But the doc contradicts the code on the rubric row:

- `DESIGN.md:273` — "**The first unmet rubric** carries the open class:
  tint background… **Met or not does not change the point's color.**"
- `DESIGN.md:286` — Do: "mark the first rubric that is **missing** with the tint".

The code does the opposite:

- `dashboard-resultado.css:184` — `.pc-rubrica-item.cumplido { background: var(--signal-tint) }`
- `dashboard-resultado.css:198-201` — the mark **does** change to `--field`/`--bone`
  when the point is met.
- `DashboardResultado.tsx:93-110` — a check for met, a dot for pending.

The mtimes confirm it: `DESIGN.md` is from 02 Oct; the "met" row comes from
commit `fc6f081` (`feat(resultado): mark covered rubric points`, 04 Oct) and from
today's uncommitted edits (`dashboard-resultado.css` and
`DashboardResultado.tsx`, 05 Oct 09:01).

**Risk:** a future agent that follows `CLAUDE.md` to the letter will
"correct" the code so it matches the doc, and will delete the covered-points
feature. It is the same trap `CLAUDE.md` warns about with English.

**Second instance:** `docs/README.md:36` describes `DESIGN.md` as "(today
pre-redesign, anti-reference)", while lines 7-11 of the **same file**
declare it the "only formal home of the visual system". It contradicts
itself: the doc already describes "El Acta" and says "the previous world is retired".

**Recommended action:** the code change is *better* than what is documented — the
state is read by **shape** (check vs. dot), not only by color, which is what
the `color-not-only` rule itself requires. So: update `DESIGN.md`
(§Components → *Rubric row* + a Named Rule "The Covered Mark Rule") and correct
`docs/README.md:36`. Alternative: revert the code. They should stop contradicting each other.

### P1 — The selectors are single-select announced as toggles

`SelectorTipoPitch.tsx:37`, `SelectorDuracion.tsx:28`, and `SelectorIdioma.tsx:38`
use `aria-pressed` on independent buttons. For a mutually
exclusive choice, the correct contract is `role="radiogroup"` + `role="radio"` with
`aria-checked` (or native inputs). Today:

- The screen reader says "pressed / not pressed" instead of "3 of 4,
  selected".
- **There is no arrow-key navigation** inside the group (Tab only).

It is a CRITICAL category in the UX guide (`keyboard-nav`, `nav-label-icon`). The
fix is local and does not change the look.

### P2 — The hairline is the only thing delimiting the panels, and it is almost invisible

- `--border` against its surface = **1.42:1** in light and **1.55:1** in dark.
  WCAG 1.4.11 asks for 3:1 for boundaries that identify components.
- The "sunken" step is barely perceptible: `ground #f9f8f6` vs.
  `sunken #f1f0ed` ≈ **1.1:1**.

The system's depth ("by sinking, without shadow") then rests
on a 1.42:1 hairline. It is a deliberate decision, but the sinking is
too subtle to carry it alone. Options: raise the hairline to ~3:1, or widen the
ground/sunken delta. It does not break "El Acta".

### P2 — Textarea without an accessible name

`GrabadorVoz.tsx:517-524`: the fallback `<textarea>` has a `placeholder` and a
help `<p>` above it, but **nothing associated programmatically** (no `<label>`, no
`aria-label`, no `aria-describedby`). The placeholder is not a label. A
one-line fix.

### P2 — The verdict voice falls back to SpeechSynthesis

`ReproductorVeredicto.tsx:88-118` falls back to `window.speechSynthesis` when ElevenLabs
fails. According to a previous check, `/api/tts` returns 402 on the free tier, so the
fallback is what the user hears. It is **the biggest perceived-quality risk in the UI**: the
product promises a "spoken verdict", and a robotic browser voice weighs more on
perception than any border contrast. The decision to leave it is
made; it is noted as the first place where quality would be spent if the plan is upgraded.

### P3 — Minor

- **Nested scroll:** `.pc-transcripcion-cuerpo` (14rem + `overflow-y:auto`,
  `dashboard-resultado.css:264-276`) inside the page scroll is a scroll
  trap on mobile. The doc wants it fixed; below `< 640px` an "expand"
  disclosure would be better.
- **Duplicate score announcement:** `AnilloSenal` has an `aria-label` with the score
  (`DashboardResultado.tsx:184`) and next to it is the visible number `{score}` +
  `/100` (`:186-187`). The reader says it twice. Mark the legend with
  `aria-hidden`.
- **Demo chrome in the UI:** "Acta de comité" shows the raw `jobId`
  (`DashboardResultado.tsx:608-613`) and polls every 20 s. It makes sense for the
  hackathon demo; for a public product it is developer noise.
- **`--elevated` is unused** (`globals.css:11,30`; already admitted in `DESIGN.md:174`).

## 5. Contrast data (reproducible)

Measured with a local script against the `:root` values in `globals.css`.
WCAG thresholds: AA = 4.5:1 (normal text), AAA = 7:1, UI/large = 3:1.

| Pair | Light | Dark |
| --- | --- | --- |
| Primary text / canvas | 16.55 AAA | 17.28 AAA |
| Low ink / canvas | 5.23 AA | 7.35 AAA |
| Low ink / sunken (rubric comment, chips, date) | 4.87 AA | 6.68 AA |
| Signal / canvas (session line, links) | 7.86 AAA | 9.91 AAA |
| Signal / sunken | 7.32 AAA | 9.01 AAA |
| Signal / tint (met row, filler word) | 6.75 AA | 5.99 AA |
| Attention / sunken (error, filler-word count) | 5.28 AA | 5.45 AA |
| Attention / canvas | 5.67 AA | 6.00 AA |
| Bone / field (primary button) | 10.45 AAA | 10.45 AAA |
| Bone / peak (primary hover, light only) | 12.86 AAA | — |
| **Hairline / canvas** | **1.42 FAIL** | **1.55 FAIL** |
| **Hairline / sunken** | **1.32 FAIL** | — |
| Rest / canvas (time bar, arc at rest) | — | 3.99 UI |

Reading: **all text passes.** The only failure is the hairline, which is a
component boundary, not text (see P2).

## 6. Ordered action plan

1. **Update `DESIGN.md`** to the "met" row (or revert the code) and
   correct `docs/README.md:36`. The source of truth should stop contradicting the
   code.
2. **`role="radiogroup"` + arrow keys** on the three selectors.
3. **Raise the hairline contrast** or widen the sunken step.
4. **An associated `<label>`** on the fallback textarea.
5. **New README screenshots** and close-out of the UX/UI phase (the current screenshot
   is deliberately out of date).

Steps 1-4 are local changes, with no redesign. Step 5 depends on 1-4
being done.

## 7. On the 10 Emergent credits

**Recommendation: do not spend them on this app.** Three concrete reasons:

1. **It generates a new app; it does not improve yours.** Emergent produces
   React/Next.js + FastAPI + MongoDB from scratch. It does not read `DESIGN.md`, it does not know
   "El Acta", and it does not respect the olive ramp. Best case: a parallel visual language
   that cannot be merged.
2. **The 10-credit tier is for evaluation, not for delivery.** It does not deploy (the
   preview links expire after 30 min) and it has no GitHub integration or
   custom domains.
3. **The numbers do not work.** Each run consumes ~5 credits by default → **10
   credits ≈ 2 generations**. A deploy is **50 credits/month**: that does not cover even
   one. With 2 runs nothing gets iterated.

**The only use that makes sense:** burn them on purpose on a **throwaway**
artifact where "new app" *is* the goal — for example a single-page prototype
(a teaser or landing page for the hackathon submission). Treat it as a **sketch**:
capture what came out, discard it, and reimplement it in the repo with the existing
system.

**What is free inside the repo:** do steps 1-5 of §6. It costs no
credits and it actually moves the needle.

Sources consulted (Emergent pricing changes; check them against the live page):

- [Emergent Credits Explained: What a Run, a Deploy and a Chatbot Cost](https://rationalgo.ai/resources/app-builder/pricing-guides/how-emergent-credits-work)
- [Emergent Deployment Cost: What 50 Credits Buys, and Why Preview Costs Nothing](https://rationalgo.ai/resources/app-builder/pricing-guides/emergent-deployment-credit-cost)
- [Emergent Free Trial: How Long It Lasts and What 10 Credits Cover](https://rationalgo.ai/resources/app-builder/pricing-guides/emergent-free-trial)
- [Emergent pricing in 2026: plans, credits and what an app really costs](https://cadrant.ai/blog/emergent-pricing)

## 8. What this pass did not close

- The app was not run, nor an automated audit (axe/Lighthouse), nor a test with a
  real screen reader: the semantics findings come from code inspection,
  not from a user test.
- Performance was not verified (LCP/CLS), nor the TTS fallback behavior
  in a specific browser.
- Contrast was measured on the `:root` tokens; not on every
  background/text pair that results from combinations at runtime (for example a pill on a
  sunken card). The values cover the pairs the CSS declares.
