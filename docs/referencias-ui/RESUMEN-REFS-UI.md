# Curated summary — UI refs · Pitch Coach (web)

Visual reference document for the direction phase. No code.
Sources: this folder's [`README.md`](README.md) + local captures (read only) + public products (web, no Mobbin/Refero).
Date: 2026-10-02.

> **Scope and source of truth.** This file is a **pre-direction summary**
> (captures + public refs) for deciding the redesign; the direction it proposes is
> a **proposal**, not a closed decision. The source of truth *for references*
> is this folder; the source of truth *for the visual system* is
> [`DESIGN.md`](../../DESIGN.md) at the repo root, and the product context is in
> [`PRODUCT.md`](../../PRODUCT.md). If anything here is adopted, it is consolidated in
> `DESIGN.md`.

---

## 1. Audio visualizer

Direction: a **live** mic indicator that reacts to real audio. **No glowing orb.** Explore EQ/waveform as the hero, an angular shape that pulses, or a market-signal line.

### Motifs already present in local refs

`color.png` (user) already contains the three data languages the README proposes reusing as animation:

| Motif | In `color.png` | Proposed use |
|---|---|---|
| **Bars / EQ** | "Order volume" card — thin bars + dotted baseline | Recording hero; the shortest to implement |
| **Angular ring** | "Registrations" card — thick progress ring (not a sphere) | Anti-orb: geometric; thickens/segments with amplitude |
| **Signal line** | "NPS" card — line + area | Formal continuity with Wealthsimple |

README rules (**proposal**, to keep if the direction is approved): a single hue; animate **height/opacity**, never glow; rest = ramp step 600; continuity from recording → score (the same element settles and *is* the verdict).

### Approaches (2–3 variants per family)

#### A. EQ / waveform as the hero

1. **Frequency bars (multiband)** — 12–24 thin bars, center-aligned or rising from a baseline; height = mic FFT bands. Rest: all at minimum + `signal-rest`. Peak: `signal-peak`. Fits "Order volume" in `color.png`.
2. **Time-domain waveform** — a continuous stroke in the Voice Memos / Descript manner: canvas with AnalyserNode, a 1–2px line, no glow fill. Better for "I am recording a pitch" (the feel of a tool, not of an agent).
3. **Sparse bars (5–7)** — LiveKit Bar / ElevenLabs BarVisualizer style with `state` (listening/thinking). More "voice agent"; usable if it is desaturated and the neon look is removed.

#### B. Angular shape that pulses (anti-orb)

1. **Segmented ring / arc** — the "Registrations" one: flat outline, thickness or opening modulated by RMS amplitude. No 3D shading.
2. **Wireframe polygon** — N vertices (hex/octagon) pushed by frequency bands; one color, no fill. If it fills or glows → it slips back into the orb cliché.
3. **Cross / chevron / diamond** — an editorial shape (institutional mark) that scales 1.0→1.08 and changes opacity; more "serious coach" than "AI listening blob".

#### C. Market-signal line

1. **Full-width line** — Wealthsimple precedent (`01-visualizador-audio/wealthsimple-com.png`): a white/signal stroke that threads the viewport and ends in a sharp peak. In pitch-coach: the stroke is drawn live from the audio envelope.
2. **Sparkline + area** — like NPS in `color.png`: line + fill at ~20–40% opacity of the same hue (not glow). Ideal in a compact header during recording.
3. **Ticker / tape** — a line that advances left to right like a quote; silence = flat, voice = controlled noise. Very "investor"; risk of looking decorative if it is not tied to the AnalyserNode.

### What fits "serious coach / investor"

| Priority | Approach | Why |
|---|---|---|
| **1st** | Dashboard-style EQ bars (`color.png` Order volume) | Already the product's data language; it does not shout "AI" |
| **1st, tied** | Wealthsimple / NPS signal line | Editorial fintech precedent; hero or transition into the score |
| **2nd** | Segmented ring (Registrations) | Clear anti-orb; a good bridge from recording to a circular score |
| Avoid / adapt | LiveKit·Deepgram·GodUI·ChatGPT Voice aura/orb | They are the cliché; only if stripped to wireframe + one hue |
| Avoid | Neon gradients, rainbow corona, glow blur | Explicitly outside the direction |

⚠ **Caveat on the ring.** The ring motif was left **without a real product
precedent** in the local batch. The `zencastr` capture the original sheet
classified as a "ring" is actually a **circular record button** inside
a landing mockup, not an amplitude ring. The ring remains a
valid option (it comes from `color.png`, the "Registrations" card), but it is worth knowing that
**it is not backed by a product capture** — it is an extrapolation from the
data language of `color.png` itself.

⚠ **The rainbow-gradient contrast.** The `audiomotion` captures (active,
no-audio, and radial) all use the same rainbow frequency gradient
(red→blue). The original sheet marked only the radial one as a counterexample; the
gradient **applies to the whole family** and contradicts the single-hue direction.

### Public examples (by category)

#### Voice assistant (2–4)
| Product | URL | Note |
|---|---|---|
| LiveKit Agents UI — visualizers | https://docs.livekit.io/frontends/agents-ui/audio-visualizer/prebuilt/ | Bar / Grid / Radial / Wave / Aura — **take Bar and Wave; discard Aura** |
| ElevenLabs BarVisualizer | https://ui.elevenlabs.io/docs/components/bar-visualizer | listening/speaking/thinking states + a real MediaStream |
| ChatGPT Voice | https://help.openai.com/en/articles/20001274-chatgpt-voice | Orb = **counter-reference** (exactly what we do not want) |
| Orb-UI guide (states) | https://orb-ui.com/docs/guides/voice-agent-ui | Useful for the idle→listening→thinking→speaking state machine; not for the orb |

#### Audio waveform visualizer (2–4)
| Product | URL | Note |
|---|---|---|
| Deepgram UI (LiveWaveform / BarVisualizer) | https://github.com/deepgram/ui/tree/main/packages/ui | Canvas waveform + bars; green/cyan brand colors → **change the hue** |
| audio-pulse (React) | https://github.com/kirandhudhat/audio-pulse | Light/dark canvas waveform, configurable |
| LiveKit Wave visualizer | https://docs.livekit.io/frontends/agents-ui/audio-visualizer/prebuilt/ | Horizontal Wave variant |
| Voice UI Kit (Figma, free) | https://www.figma.com/community/file/1656021062890107334/voice-ui-kit-waveforms-stt-transcription-free | idle/recording/playback states — a kit reference, not a product |

#### Recording app (2–4)
| Product | URL | Note |
|---|---|---|
| Descript Voice Recorder | https://www.descript.com/tools/voice-recorder | Recorder + real-time transcript; pro-tool tone |
| Otter.ai | https://otter.ai/ai-notetaker · https://otter.ai/mobile | Mic + live transcript; sober UI |
| Apple Voice Memos (guide) | https://support.apple.com/guide/voice-memos/play-a-recording-vma2c8c0a040/mac | Overview waveform + playhead — a serious native pattern |
| Granola | https://www.granola.ai/ | AI notepad for meetings; **no bot, no orb** — investor tone |

#### AI listening state (2–4)
| Product | URL | Note |
|---|---|---|
| ElevenLabs BarVisualizer states | https://ui.elevenlabs.io/docs/components/bar-visualizer | connecting / listening / thinking / speaking |
| LiveKit agent state + audio | https://docs.livekit.io/frontends/agents-ui/audio-visualizer/prebuilt/ | Volume + agent state |
| Vapi / Orb-UI states | https://orb-ui.com/docs/guides/voice-agent-ui | Table of what each state must communicate |
| Deepgram Orb (counter) | https://github.com/deepgram/ui/tree/main/packages/ui | Audio-reactive hoop — useful as "what not to do" if it glows |

#### Investor / fintech dashboard dark mode (2–4)
| Product | URL | Note |
|---|---|---|
| Mercury (dark mode) | https://support.mercury.com/hc/en-us/articles/37538153196948-Enabling-dark-mode · https://mercury.com/insights | Startup bank; one hero number, calm charts |
| Copilot Money (analysis) | https://blakecrosley.com/guides/design/copilot-money | Dark navy canvas + bright data — **in the local refs it is a counterexample** (playful) |
| Wealthsimple | https://www.wealthsimple.com/ | Editorial serif + signal line; light/warm more than dark |
| Linear (dark tooling tone) | https://linear.app/ | One accent, serious densities — a discipline reference, not an audio one |

#### Coaching feedback / score screen (2–4)
| Product | URL | Note |
|---|---|---|
| Yoodli — Personalized Feedback | https://yoodli.ai/platform/ai-feedback | Immediate post-practice feedback, org rubrics |
| Yoodli Roleplays | https://yoodli.ai/platform/ai-roleplays | Pitch/roleplay + typed goals |
| shadcn AI Interview Coach block | https://www.shadcn.io/blocks/ai-interview-coach | Score /10 + strengths/improvements + rubric (a UI pattern, not a brand) |
| Local Lucid / Tana refs | `04-jerarquia-resultado/lucidmotors-com.png`, `03-tipografia/tana-inc.png` | Metrics in a row (Lucid); immediate score+verdict (Tana) |

### What the sweep yielded — the gap narrowed, **not** closed

22 screens were captured. **11 were product landings with no live visualizer**
and were discarded (riverside ×2, descript ×2, otter, fireflies, tldv ×2, podcastle,
adobe podcast, howlerjs inicio). Two transcription screens were moved to
`04-jerarquia-resultado/`.

**The underlying reason, which is the real learning: public landings of
recording products do not expose their visualizer.** The usable material came from **library
demos** (`wavesurfer`, `peaksjs`, `audiomotion`) and from a mockup (`zencastr`),
not from live product UI.

What this implies: real product captures require an **authenticated
session** or **native captures**. inspo/awwwards landings do not
cover recording apps either. The gap is narrowed; it is still open.

See `01-visualizador-audio/FICHAS.md` for the detail verified per capture.

---

## 2. Palette / color

### Requested evaluation: bordeaux (wine) vs. navy

Full numbers and tokens are in `README.md` (section "Proposed palette"). Here, only
the result:

- **Bordeaux `#6E1D2E`** — 1.75:1 on dark (fails) / 10.46:1 on light. It works on
  light and as a *field*, never as a small accent on a dark background.
- **Navy `#1B2A4A`** — 1.38:1 on dark (fails) / 13.31:1 on light. Navy on
  navy = 1.00:1.
- **Lightening either one for dark pushes it into pastel** (the wine
  becomes pink, which means it stops being wine). That is the mechanism of the "AI glow" cliché.

**Honest conclusions (README + evaluation):**

1. **Neither wine nor navy works as a small accent on a dark background.** It is luminance, not taste.
2. **Harvard uses the wine as a *field* (a block background), not as an accent** — bone on `#6E1D2E` = 10.46:1. That is the only serious path for bordeaux on dark.
3. Lightening wine/navy for dark pushes them into pastel (Railway lavender `#b4a4d5` is the same mechanism). The "AI glow" cliché is partly a contrast accident.
4. **Between wine and navy (if one had to choose without olive):**
   - **Light:** both work; wine = institutional gravity (Harvard); navy = data/fintech (`color.png` COGS).
   - **Dark as an accent:** both lose. Wine wins only if used as a **score field** (filled panel). Navy wins only as a **structural neutral** (not as signal).
   - **As the mic's live signal:** neither survives lightening without losing its identity.

### Olive

Base extracted from `color.png`: **`#285828`**. An 11-step ramp; the pivot **`#457F42`
(600)** clears the graphic threshold on light (4.53:1) and on dark (3.99:1). Lightening olive →
sage (it is still olive); lightening wine → pink (it stops being wine). **The
token table, the full ramp, and the animation rules are in `README.md`** — they are
not duplicated here.

### Color recommendation

| Role | Choice | Reason |
|---|---|---|
| **Single carrier / signal (mic + charts)** | **Olive ramp** | Stable identity in light+dark; already in `color.png`; anti-cliché |
| Bordeaux | Optional only as the **field** of a score block (Harvard mode), not as a UI accent | Meets the request to "evaluate wine" without misstating the contrast |
| Navy | Data secondary *only if* two series are needed; prefer two olive steps; otherwise the README slate `#46586B` / `#7E8FA3` | Avoids competing with the signal |
| Avoid | Purple/indigo glow, neon green-cyan, amber/gold | Explicit direction |

**Verdict, wine vs. navy vs. olive:** for a light+dark product with a live indicator, **olive wins**. Wine and navy fail the dark-accent test; wine only as an institutional field; navy only as a neutral. The request to evaluate them stands — they were evaluated, and they lose on WCAG physics, not on fashion.

---

## 3. Typography in context

Direction: a serif with character in titles/score (Fraunces / Newsreader-like) + a clean sans in body (IBM Plex Sans-like). **Avoid Inter / Geist.**

### Local refs → what to take

| Capture | Typography | Use in pitch-coach |
|---|---|---|
| `03-tipografia/railway-com-tipografia.png` | IBM Plex **Serif** display with strong negative tracking; body sans with line-height ~1.63 | The closest technical model to "Plex Sans + a serif with character". **Discard the CTA violet** |
| `03-tipografia/tana-inc.png` | Huge Source Serif 4, black, a single color in the viewport | **Score + verdict** at the fold |
| `03-tipografia/moshimoshimusic-com.png` | Small Libre Baskerville as a **label** | Labels for collapsible sections (rubric, fillers…) |
| `03-tipografia/furoweb-eu.png` | Instrument Serif on dark, warm | Display-serif alternative |
| `03-tipografia/danielsun-space.png` | Dark LT Superior Serif | Ceiling of editorial warmth |
| Wealthsimple (web + capture) | Tiempos-like serif + geometric sans | The "editorial investor" pair |

### Recommended pairs (web-safe / adjacent Google Fonts)

| Role | Primary | Alternatives | Notes |
|---|---|---|---|
| Display / score / verdict | **Fraunces** or **Newsreader** | Source Serif 4, Instrument Serif, Libre Baskerville (labels only) | Optical sizing if available; tracking −1% to −2% above 40px |
| Body / UI / transcript | **IBM Plex Sans** | IBM Plex Sans + Plex Mono for badges/rubric tags | Tabular nums (`tnum`) on scores and % |
| Avoid | Inter, Geist, generic system-ui as the brand voice | — | Too much "default AI SaaS" |

### In the context of screens

- **Recording:** sans for the timer/controls; the visualizer carries the personality (a serif on the mic is unnecessary).
- **Result:** a huge serif for the number + the verdict label ("Strong" / "Needs work"); sans for the rubric, fillers, transcript, and Tavily.
- **Score valence:** through typographic weight/size + an explicit label — **do not** wash the number in green/red (olive is identity, not "approved").

---

## 4. Hierarchy — result screen

Direction: **large score + verdict on top**; rubric / fillers / transcript / Tavily in **collapsible sections** below.

### Viewport model (first fold ~1280×800)

```
┌─────────────────────────────────────────────┐
│  [serif]  7.4          Strong               │  ← score + verdict (immediate)
│  [optional] same live motif → settled       │  ← bars/ring/line = score viz
│  ─ ─ Lucid metrics: Clarity · Pace · … ─ ─  │  ← small caps + value + thin rule
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ ▸ Rubric           (accordion, layout row)  │
│ ▸ Filler words                              │
│ ▸ Transcript                                │
│ ▸ Tavily sources                            │
└─────────────────────────────────────────────┘
```

### What to take from each ref

| Ref | Pattern |
|---|---|
| **Tana** (`03-tipografia/tana-inc.png`) | Monumental scale (one huge number/phrase) and a single color carrier across the whole viewport. In our product, the monumental phrase *is* the **score + verdict** at the fold (§3); everything else stays subordinate. |
| **Lucid** (`04-jerarquia-resultado/lucidmotors-com.png`) | Metrics strip: small caps + large value + vertical divider |
| **layout.png** (user) | Accordion row: icon on `signal-tint` + title + mono badge + description; open state = the same hue, AA |
| **Basement** (`04-…/basement-studio.png`) | Ceiling of art-directed darkness — **do not** copy the "creative studio" register |
| **Copilot Money** (local + web) | **Counter-reference:** dark fintech + bento + decorative color → reads playful |

### Hierarchy rules

1. Score + verdict fit **without scrolling** on desktop.
2. Lower sections: chevron + a small serif/sans label (moshimoshimusic); one open at a time, or several, but with rhythm ≥64–96px.
3. Findings (`attention`) only inside fillers/rubric — they never tint the score.
4. Continuity: if the mic was bars/ring/line, the score **reuses** that motif, frozen.

---

## Best fit — "serious coach, investor-like, not generic AI"

### Core to follow (in order)

1. **`color.png` + the README olive ramp** — identity, viz motifs, anti-pastel.
2. **`layout.png`** — rubric rows / accordion.
3. **Wealthsimple (signal line + editorial serif)** — recording hero or transition.
4. **Tana** — score+verdict at the fold.
5. **Lucid metrics strip** — sub-scores.
6. **Railway typography (without the violet)** — Plex serif/sans pairing.
7. **Harvard** — only if wine is wanted as a score *field*, not as a UI accent.
8. **Granola / Descript / Otter / Yoodli** — product tone (a working tool), not an awwwards landing.

### Counter-references (study so they are not copied)

- ChatGPT Voice / GodUI Voice Orb / LiveKit Aura / Deepgram Orb glow
- Copilot Money (local) — dark fintech that turns into a toy
- Railway violet CTA / any indigo-lavender glow
- Basement Studio — too much "creative agency"

### Short direction decision (proposal)

| Axis | Decision |
|---|---|
| Color | **Olive** as the single signal; wine/navy evaluated and discarded as a dark accent |
| Mic hero | **Dashboard EQ bars** or **signal line**; ring as the 2nd option |
| Type | **Newsreader/Fraunces + IBM Plex Sans** |
| Result | Serif score on top → accordions below (`layout.png`) |
| Mode | Light + dark on the same ramp; rest `#457F42` in both |

---

## Index of local files

```
docs/referencias-ui/
  README.md               ← canonical doc: criteria, palette, animation, discards
  RESUMEN-REFS-UI.md      ← this file: summary by category + public refs
  color.png · layout.png  ← the user's main set
  01-visualizador-audio/  ← 12 captures + FICHAS.md (verified sheets)
  02-color/               ← copilot-money (counter-ref), harvard-edu
  03-tipografia/          ← railway-com-tipografia, tana-inc, moshimoshimusic-com,
                             furoweb-eu, danielsun-space
  04-jerarquia-resultado/ ← lucidmotors-com, basement-studio,
                             otter-1280-transcribiendo, fireflies-1280-transcribiendo
```

Each image lives in **one** folder; what each one contributes is in the
`README.md` table.

**Canonical copy of the captures:** `docs/referencias-ui/`, versioned in git
inside the repo. It is the only source of truth **for references**. If a
copy exists outside the repo (e.g. `~/Proyectos/pitch-coach-refs/` or `/workspace/`),
it is out of date and should be discarded.

**Design source of truth:** the formal visual system lives in
[`DESIGN.md`](../../DESIGN.md). This folder is input to the direction, not its
contract; if a value is adopted, it is consolidated in `DESIGN.md`.
