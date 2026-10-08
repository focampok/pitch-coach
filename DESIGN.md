---
name: Pitch Coach
description: Spoken pitch practice, read as a one-hue record
colors:
  ground: "#f9f8f6"
  sunken: "#f1f0ed"
  text: "#1a1917"
  text-muted: "#6b6862"
  signal: "#285828"
  signal-peak: "#16301a"
  signal-rest: "#457f42"
  signal-tint: "#dfebd6"
  field: "#1e4022"
  bone: "#f4f3f0"
  attention: "#9e4a38"
  border: "#8d8880"
typography:
  display:
    fontFamily: "Alike, serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Alike, serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "Alike, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  xs: "3px"
  sm: "8px"
  row: "10px"
  md: "12px"
  pill: "999px"
spacing:
  tight: "6px"
  control: "12px"
  gutter: "24px"
  stack: "28px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.field}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    typography: "{typography.label}"
  button-quiet:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    typography: "{typography.label}"
  button-pill:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    minHeight: "44px"
  panel:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.md}"
    padding: "24px"
  alert:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.attention}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  row-covered:
    backgroundColor: "{colors.signal-tint}"
    textColor: "{colors.signal}"
    rounded: "{rounded.row}"
    padding: "11px 14px"
  score-ring:
    textColor: "{colors.signal}"
    width: "148px"
    height: "148px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: Pitch Coach

## Overview

**Creative North Star: "The Record"**

Pitch Coach reads as the record of an examination, not as a celebration board. The paper is bone, surfaces sink one step, and the only color with a voice is an olive. The geometric ring is the measurement: at rest it is a short arc, while speaking it grows with the voice, and when the result arrives that same arc is the score.

Density is that of a sheet, not of a dashboard. Up to 1120px, and from 960px in two columns, serif only on the sentence that is remembered (the verdict, the product name, the section title) and a sans for everything read in sequence. The covered rubric row is the only one that takes the tint. The rest of the list stays quiet. The four pitch types are presented with the same weight; the chosen one changes tint, not importance.

The previous world is retired: white canvas, emerald accent, Arial winning over a declared and unused Geist, an 88px score circle painted green, amber, or red, and a soup of blue, red, and yellow. No new screen is generated in that style.

**Key Characteristics:**

- A single hue, olive, on bone paper
- Depth by sinking, with no shadow
- The ring is the live signal and the settled score
- Alike for the sentence; Source Sans 3 for reading
- Attention (terracotta) only marks counts and errors, never the score
- Visible focus on every interactive control

## Colors

One olive and a warm paper. Green does not mean passed: the number and the words say what the score is worth.

The values below are light mode (`:root`). Dark mode reassigns the same roles; it does not invent a second palette.

### Primary

- **Signal olive** (`{colors.signal}`): the settled arc, the covered row, the session line, and focus. It is the color of the measurement.
- **Peak** (`{colors.signal-peak}`): the dark end of the same olive. In light mode it fills the primary button hover. Live, the arc reaches here only when the voice crosses the high threshold.
- **Rest** (`{colors.signal-rest}`): the middle step of the ramp. The silent arc and the time-bar fill use this value in both modes.
- **Tint** (`{colors.signal-tint}`): the field of the covered row and of the chosen pitch type. Also the background of a marked filler word inside the transcript.
- **Field** (`{colors.field}`): the primary button. Bone text on top.

### Neutral

- **Bone** (`{colors.ground}`): the canvas.
- **Sunken** (`{colors.sunken}`): panels, quiet rows, chips, and the quiet button.
- **Ink** (`{colors.text}`): the main text.
- **Low ink** (`{colors.text-muted}`): comments, metadata, and the "/100".
- **Button bone** (`{colors.bone}`): the text on the field. In dark mode it is also the main text.
- **Hairline** (`{colors.border}`): the border of panels, fields, and quiet buttons.

### Tertiary

- **Attention terracotta** (`{colors.attention}`): a filler-word count and the text of an error (microphone, analysis, alert). It does not color the score or a covered point.

### Dark mode

Same ramp, inverted in lightness. Rest does not change.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `{colors.ground}` | `#0f0f0e` |
| Sunken | `{colors.sunken}` | `#1a1a18` |
| Ink | `{colors.text}` | `#f4f3f0` |
| Low ink | `{colors.text-muted}` | `#a3a099` |
| Signal | `{colors.signal}` | `#a3c48f` |
| Peak | `{colors.signal-peak}` | `#dfebd6` |
| Rest | `{colors.signal-rest}` | `{colors.signal-rest}` |
| Tint | `{colors.signal-tint}` | `#1e4022` |
| Field | `{colors.field}` | `{colors.field}` |
| Attention | `{colors.attention}` | `#c97c68` |
| Hairline | `{colors.border}` | `#6b6a62` |

There is no elevation token. Depth is resolved by sinking, not by lifting: no surface is painted white or with a shadow (see the Sunken Rule).

### Named Rules

**The One Hue Rule.** Olive is the only chromatic voice. Terracotta is not a second accent: it appears on a count or an error, and nowhere else.

**The Rest Step Rule.** The silent arc uses the rest step, the same in light and dark. It does not go out to gray.

**The Score Is Not a Color Rule.** A 64 and a 90 use the same olive. What changes is the length of the arc, the number, and the sentence.

## Typography

**Display Font:** Alike (with a serif fallback)
**Body Font:** Source Sans 3 (with a sans-serif fallback)

**Character:** Alike is the sentence that is remembered, at weight 400, with no bold. Source Sans 3 is the working voice: buttons, comments, transcript. There is no brand mono.

### Hierarchy

- **Display** (400, 2.75rem, line-height 1): the score number, with tabular figures.
- **Headline** (400, 2rem, line-height 1.15): the verdict. The product name in practice uses the same face one step larger (2.25rem).
- **Title** (400, 1.5rem): section titles in practice. On the result, block titles drop to 1.25rem, same face and same weight.
- **Body** (400, 1rem, line-height 1.6): the transcript, with a max measure of 68ch and a max height of 14rem. What does not fit scrolls inside the box. The rubric comment is 0.9rem.
- **Label** (600, 0.875rem): buttons and the rubric-point name. The session line is 0.95rem in Source Sans 3, signal color, not serif.

### Named Rules

**The Face You Load Rule.** The face that is loaded is the face that is painted. Alike and Source Sans 3 come in through `next/font` and the body uses them. Arial and Geist are not the brand.

**The Serif Is the Sentence Rule.** Alike is not used for paragraphs, buttons, or metadata. If the sentence does not fit on one verdict line or in a title, it is Source Sans 3.

## Layout

The sheet reaches `max-width: 1120px`. From 960px, practice splits in two: on the left the type, the duration, and the summary; on the right the recorder, which stays fixed while scrolling. The result does the same under the ring: the rubric on the left, and on the right the actions, the cited figure, the filler words, and the transcript. The transcript does not grow with the pitch: it stays at 14rem and the rest scrolls inside. Below 960px everything returns to one column. There is no sidebar.

The four types move to two columns from 640px. Duration is a wrapping row. The ring (148px) sits beside the verdict.

The observed rhythm is 6px between rubric rows, 12px of vertical padding on controls, 24px of panel padding and horizontal margin, 28px between result blocks, and 32px between practice sections.

## Elevation & Depth

There are no shadows. Depth is one step down: the canvas, and on it a sunken panel. The covered row does not lift; it takes the tint. The ring has no halo.

### Named Rules

**The Sunken Rule.** A new surface is sunken or is the canvas itself. It is not lifted with white or with a shadow.

**The No Sunken-on-Sunken Rule.** Sinking a panel inside another sunken panel does not create depth: they are the same fill and only an extra hairline remains. What lives inside a sunken panel dissolves into it (no background or border of its own, like the recorder inside "Resolve findings") or is painted with the canvas.

## Shapes

Short corners and one geometry. The button is 8px. The panel and the alert are 12px. The rubric row is 10px. Pills (active language, listen, filler chip, time bar) close at 999px. The mark inside the transcript is 3px.

The ring is an arc, not a circle with a track. A stroke of 10 in a viewBox of 120, no background circle, start at twelve o'clock. At rest the arc is 14% of the circumference. Live it starts from that 14% and grows with amplitude. Settled, the arc is the score out of 100: a 64 occupies 64%. Opacity only moves live (from 0.5 to 1). There is never a glow, a scale, or a second stroke.

### Named Rules

**The Open Arc Rule.** The circular track is not drawn behind the arc. What is not measured is not painted.

## Components

### Buttons

- **Shape:** 8px. The listen action, inside the verdict, is a pill.
- **Primary:** field with bone text, padding 12px 16px, 600, 0.875rem. In light mode the hover fills with the peak. In dark mode the peak is light, so the hover keeps the field and only the hairline switches to the signal.
- **Hover / Focus:** the focus of every control is a 2px outline in the signal, offset 3px. There is no color transition.
- **Quiet:** sunken, ink text, hairline. The hover takes the tint. Disabled: opacity 0.6.
- **Pill (listen actions):** pill radius and 0.85rem, but **never below the 44px touch target** — the shape does not exempt the minimum. The base button supplies the mechanics; the pill only changes the shape. On a sunken card (the suggested data) it is painted with the canvas, not with another sunken fill: see the Sunken Rule.
- **Text (tertiary actions):** "Your progress", "Delete history". They read as an underlined link, but they keep the 44px height so they can be tapped.

### Chips

- **Style:** sunken pill, 0.85rem, padding 4px 11px. The word in quotes and the count beside it.
- **State:** read only. The count is terracotta and weight 700, with tabular figures.

### Cards / Containers

- **Corner Style:** 12px.
- **Background:** sunken on bone.
- **Shadow Strategy:** none. See Elevation.
- **Border:** 1px hairline.
- **Internal Padding:** 24px.

### Inputs / Fields

- **Style:** the text fallback is an area with canvas background, hairline, 12px radius, and 12px padding.
- **Focus:** the global 2px outline.
- **Error / Disabled:** the error is terracotta text, with no red filled box. The disabled button drops to opacity 0.6.

### Navigation

There is no persistent navigation. Language is a segment: the active option is field with bone text; the inactive one is low ink on sunken. The pitch type is a grid of equal buttons; the chosen one takes tint and signal text. The chosen duration takes field and bone text. No type is larger than another.

### Signal ring

The same component while recording and on the result (`AnilloSenal`). While recording it measures 72px and carries no number. On the result it measures 148px and the number (display) is centered over the arc, with "/100" in low ink at 0.85rem. Rest, live, and settled are three modes of the same stroke.

### Rubric row

Horizontal row, 10px radius, padding 11px 14px. A 28px mark: an 8px square in signal with a dot, or a check. The **covered** row carries the class `cumplido`: tint background, signal text, and the mark on the field (square in field, check in bone). **Pending** rows have no background of their own: a sunken mark with the dot in ink. State is read by shape (check or dot) and by color, never by color alone.

### Alert

Sunken panel with hairline and terracotta text, 12px radius, padding 12px 16px. Used for analysis, ultra, and sparring failures.

### Named Rules

**The Covered Mark Rule.** The tint marks the covered rubric point, not the one that is missing. The mark changes shape and color together: check on the field if covered, sunken dot if not. Color never reads alone.

## Do's and Don'ts

### Do:

- **Do** use the `:root` tokens and their dark reassignment. A new color has to be a step of this ramp or it does not exist.
- **Do** leave focus visible: 2px outline in the signal, 3px offset.
- **Do** treat the four pitch types with the same shape. Selection is tint, not hierarchy.
- **Do** mark the covered rubric point with the tint and the check, and leave the pending ones quiet.

### Don't:

- **Don't** revive the previous world: white canvas, emerald, Arial, brand Geist, an 88px circle in green/amber/red, or blue, red, or yellow as an accent.
- **Don't** paint the score as a traffic light. The settled arc is always the signal.
- **Don't** use an orb, a glow, a shadow, or a circular track behind the ring.
- **Don't** use emoji as a rubric icon.
- **Don't** put bone text on the peak when dark mode has lightened that step.
- **Don't** lift a surface. Sink it, or leave it on the canvas.
