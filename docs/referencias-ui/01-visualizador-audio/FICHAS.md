# Sheets — audio visualizer

Captures in `01-visualizador-audio/`. Columns: **motif** (visualizer
shape) · **reaction to audio** · **at rest** (no audio) · **composition**
(where it sits relative to the button / timer / title) · **390px**.

`✔` verified by looking at the image · `~` claimed in the original sheet, not verified · `⚠` warning

## Library demos

| File | Motif | Reaction to audio | At rest | Composition | 390px |
|---|---|---|---|---|---|
| `wavesurfer-1280-ecualizador.png` | **bars (faders)** | The wave is complemented by **9 vertical bars with a knob** — EQ bands ✔ | Loaded wave stays visible; faders at neutral | Wave on top, player and faders below ✔ | not captured |
| `wavesurfer-1280-mic-permiso.png` | wave (empty) | While recording it draws a continuous or scrolling wave; timer at 00:00 | **EMPTY wave panel** + "Press Record to start recording" ✔ | Record button + mic select + checkbox above; empty panel below ✔ | not captured |
| `wavesurfer-1280-escuchando.png` | wave | Static magenta wave of preloaded audio | The reference wave remains | The wave fills the panel; controls do not dominate | not captured |
| `wavesurfer-390-escuchando.png` | wave | Preloaded wave in a compact module; static | Same, with no live crop | The wave leads; nav and notice stack | ✔ narrow panel, wave cropped/scrollable |
| `peaksjs-1280-escuchando.png` | wave + line | Main waveform with overview and a top line, time, and play | Gray shape, play at 00:00 | The visualizer takes almost the whole screen | not captured |
| `howlerjs-1280-reproductor.png` | wave | Soft wave as a track-progress indicator | Keeps the line and the controls while paused | The player and play/pause are the focus | not captured |

**Demo notes:**

- ⚠ The two `wavesurfer` captures are **documentation pages**, not product
  UI: two thirds of the screen is a code editor, and there is an advertising
  notice. The original sheet described the demo panel and left this out.
  **Do not use them as a composition reference** — do use them as a reference for the *element*.
- `~` The original sheet claims that on `mic-permiso` the Record button "stays
  disabled". In the image it looks like a normal button. Not verified.
- **The real contribution of `wavesurfer-1280-ecualizador`:** 9 vertical bars with
  a knob — a bar visualizer that *is also a control*. The indicator and the
  control are the same element.

## FFT analyzer (audioMotion)

| File | Motif | Reaction to audio | At rest | Composition | 390px |
|---|---|---|---|---|---|
| `audiomotion-1280-activo.png` | bars / meter | A4 test oscillator: **narrow peak in the center band** ✔ | — | Analyzer on top, controls and test tone below | not captured |
| `audiomotion-1280-sin-audio.png` | bars / meter | — | **Completely empty black canvas** + frequency scale ✔ | The canvas dominates; secondary controls | not captured |
| `audiomotion-1280-radial-contra-ejemplo.png` | ring / radial bars | Radial preset: a radial ray on an animated background ✔ | Minimal ring and ray on a dark background | The visualizer dominates completely | not captured |

**Analyzer notes:**

- ⚠ **The counterexample marking was incomplete in the original sheet.** All three
  captures use the **same rainbow frequency gradient** (red → orange →
  green → blue). The original marked only the radial one as a counterexample. If the
  gradient is a counterexample signal, **it applies to the whole family**.
- **The most useful finding in the batch:** the `activo` / `sin-audio` pair answers
  the rest-state question. **Rest = an empty plane**, not a waiting pulse.

## Product

| File | Motif | Reaction to audio | At rest | Composition | 390px |
|---|---|---|---|---|---|
| `zencastr-1280-grabando.png` | **record button** | **There is no amplitude visualizer.** It is a **magenta circular button** next to the timer 01:01 ✔ | not captured | Phone mockup inside a landing | see the 390 version |
| `zencastr-390-grabando.png` | **record button** | Same: button + timer 01:02, fixed bottom CTA | not captured | Mobile mockup + sticky CTA | ✔ minimal header, stacked mockup |

**Product notes:**

- ⚠ **Important correction.** The original sheet classified `zencastr` as
  `ring/meter` and described a "red recording ring". Verified: it is a
  **marketing landing with a phone mockup**, and what sits inside is a
  **circular record button**, not an amplitude ring. It works as a reference
  for the *recording state* (button + timer together) and **not** as a precedent for the
  ring motif.
- The background is a blue gradient — outside our direction.

## Formal precedent (not an audio app)

| File | Motif | Note |
|---|---|---|
| `wealthsimple-com.png` | signal line | **Full-width white line** that threads through photographic cards and ends in a sharp peak. It contributes the "market-style line" motif. It also serves as a color reference and as an editorial-serif reference. |

## Sweep balance

22 screens were captured; **11 were product landings with no live visualizer**
and were discarded (riverside ×2, descript ×2, otter, fireflies, tldv ×2, podcastle,
adobe podcast, howlerjs inicio). Two transcription screens were moved to
`04-jerarquia-resultado/`.

**Conclusion of the first sweep: public landings of recording products
do not expose their visualizer.** The material came from library demos (`wavesurfer`,
`peaksjs`, `audiomotion`) and from a mockup (`zencastr`). That was resolved later with
the two sweeps below.

## In-house captures — live states (`vivo/`)

Captured with automated Chromium and a **synthetic microphone enabled**
(`--use-fake-device-for-media-stream`), so a real signal is running.

| File | What it shows |
|---|---|
| `audiomotion-index-1440-vivo.png` | **All four motifs running at once**: linear bars, **segmented radial ring**, filled area, bar matrix |
| `audiomotion-index-390-vivo.png` | The same at phone width |
| `audiomotion-minimal-1440-vivo.png` | **Full live spectrum.** The most useful finding: thin bars on a baseline **with a held peak LED** above — the dots that stay floating for an instant after the peak |
| `audiomotion-minimal-390-vivo.png` | At phone width |
| `mdn-voice-visualizer-1440-vivo.png` | A real microphone app (MDN), bars rising from a baseline. The signal is weak because of the synthetic device, but it is a real implementation |

⚠ All five use the **rainbow gradient** by frequency. They serve as a reference for
**shape and motion**, not for color.

**The usable idea is the held peak LED:** it is literally "rest with
memory" — the peak stays for an instant and then falls. It solves the rest state **without
needing a decorative pulse**, which is exactly what we were looking for.

## Native captures — real apps (`nativas/`)

Downloaded from the Google Play listing at full resolution (1080×1920).

| File | What it shows |
|---|---|
| `app-recorder-grabando.png` | **The best finding of the native sweep.** A giant timer as the hero (`0H 00M 00S`), a circular microphone button with a halo, and a **full-width waveform, symmetric about a center line**, at the foot of the screen |
| `app-otter-grabando.png` | The timer **inline, flanked by two waveform halves**: `00:14` between mirrored bars. Above, Summary / Transcript / AI Chat tabs — the pattern for our collapsible sections |
| `app-recorder-prerecord.png` | Pre-record state: "is ready to start" + a circular button. Rest as an empty screen with a single control |
| `app-recorder-lista.png` | List hierarchy: name + duration + format + size per row, **with the active item marked in the accent color** |

**Convergent data point:** of the icons downloaded and then discarded, **all five were bars or
a waveform**. The bars/waveform motif is the universal language of recording
apps — which validates our choice and, at the same time, warns that it needs
**its own treatment**, because it is everyone's default.

## Gap status

**Closed in the essentials.** We have: live shape and motion (`vivo/`),
the composition of the recording state in a real product (`nativas/`), the rest
state settled by evidence (empty plane + peak LED), and the three motifs
backed by a capture (bars, ring, line).

What there is **not**, and what no longer needs searching: a product precedent for the
ring in our direction — the ring shows up in `audiomotion-index` (radial) and
in your `color.png`, but always in another color register. It is our own design
decision, not a copy.
