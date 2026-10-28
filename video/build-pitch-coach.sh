#!/usr/bin/env bash
# Assemble the Pitch Coach demo from every video/raw/clip*.mp4, in numeric order.
# Paths are relative to the repo root. Re-running overwrites the same outputs.
# Nothing here is uploaded. Raw media, renders, and frames stay gitignored.
#
# Pipeline:
#   1. local transcription with faster-whisper (video/.venv) — never ElevenLabs or any API
#   2. cut detection: silence (-35 dB, >= 2 s) coinciding with a frozen picture,
#      0.5 s margins, never within 0.3 s of a word; loading waits (the post-Stop
#      hold and the Ultra spinner) keep 1 s when they run past 1 s
#   3. one seeked input per kept region, -threads 1 each (a single decoder feeding
#      every trim was OOM-killed before)
#   4. concat with re-encode and a short acrossfade on every join
#   5. two-pass loudnorm with the measurement read automatically, I=-14 TP=-1.5 LRA=11
#   6. verification, final transcript, six frames
#
# Options:
#   --retranscribe   ignore existing video/out/clipN-words.json and transcribe again
#   --reuse-cuts     keep video/out/cuts.txt instead of detecting cuts again
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Positive OFFSET_MS means the Bluetooth mic is late: that much audio is
# dropped from the start of each kept region so the voice lines up with the
# picture. Measured on the previous take: no clap transient and the first word
# arrives when the speaker starts, so the offset is 0.
OFFSET_MS=0
CUTS_FILE=video/out/cuts.txt
TARGET_LUFS=-14

FPS=30
CRF=18
XFADE=0.15
SILENCE_DB=-35
SILENCE_MIN=2.0
MARGIN=0.5
WORD_GUARD=0.3
LOADING_KEEP=1.0
# A silent+frozen gap this long, with speech on both sides, is a loading wait
# rather than a breath. The Ultra spinner is about 10 s.
LOADING_MIN=4.0
PY=video/.venv/bin/python
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
SUBTITLE_TEXT="Super's first pass is strict: it reads this take as a product description. Ultra gives the second opinion."
# End card: 3 s of card after a 0.3 s dissolve from the last content frame.
CARD_SECONDS=3.0
CARD_FADE=0.3
CARD_BG=0xf5f3ee
CARD_INK=0x1a1917

RETRANSCRIBE=0
REUSE_CUTS=0
for arg in "$@"; do
  case "$arg" in
    --retranscribe) RETRANSCRIBE=1 ;;
    --reuse-cuts) REUSE_CUTS=1 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

mkdir -p video/out/tmp video/frames
export PYTHONUNBUFFERED=1

if [[ ! -x "$PY" ]]; then
  echo "Missing $PY. The local faster-whisper venv belongs in video/.venv." >&2
  exit 1
fi
if [[ ! -f "$FONT" ]]; then
  echo "Missing drawtext font: $FONT" >&2
  exit 1
fi

shopt -s nullglob
CLIP_FILES=(video/raw/clip*.mp4)
if (( ${#CLIP_FILES[@]} == 0 )); then
  echo "No clips found in video/raw (expected video/raw/clip1.mp4, clip2.mp4, ...)" >&2
  exit 1
fi
# Numeric order, not lexicographic: clip2 comes before clip10.
mapfile -t SORTED < <(printf '%s\n' "${CLIP_FILES[@]}" | sort -V)
CLIPS=()
for f in "${SORTED[@]}"; do
  CLIPS+=("$(basename "$f" .mp4)")
done
for c in "${CLIPS[@]}"; do
  if [[ ! "$c" =~ ^clip[0-9]+$ ]]; then
    echo "Unexpected clip name: $c (expected clipN.mp4)" >&2
    exit 1
  fi
done
echo "clips: ${CLIPS[*]}"

probe_field() {
  local f="$1" stream="$2" field="$3"
  ffprobe -v error -select_streams "$stream" -show_entries "stream=$field" \
    -of default=nw=1:nk=1 "$f" | head -1
}

duration_of() {
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1"
}

SIZES=()
for clip in "${CLIPS[@]}"; do
  f="video/raw/${clip}.mp4"
  w="$(probe_field "$f" v:0 width)"
  h="$(probe_field "$f" v:0 height)"
  sr="$(probe_field "$f" a:0 sample_rate)"
  ch="$(probe_field "$f" a:0 channels)"
  if [[ -z "$w" || -z "$h" ]]; then
    echo "$f has no video stream" >&2
    exit 1
  fi
  if [[ -z "$sr" || -z "$ch" ]]; then
    echo "$f has no audio stream" >&2
    exit 1
  fi
  if (( w < 1920 || h < 1080 )); then
    echo "WARNING: $f is ${w}x${h}, below 1920x1080. Output stays at native size; nothing is scaled up." >&2
  fi
  SIZES+=("${w}x${h}")
  echo "$clip ${w}x${h} $(duration_of "$f")s ${sr}Hz ${ch}ch"
done
FIRST_SIZE="${SIZES[0]}"
for s in "${SIZES[@]}"; do
  if [[ "$s" != "$FIRST_SIZE" ]]; then
    echo "Clip sizes differ (${SIZES[*]}); concat needs one size." >&2
    exit 1
  fi
done

# ---------------------------------------------------------------- transcription
# Local only. Reuses clipN-words.json when it is newer than the clip.
"$PY" - "$RETRANSCRIBE" "${CLIPS[@]}" << 'PY'
import json, subprocess, sys
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

force = sys.argv[1] == "1"
clips = sys.argv[2:]
todo = []
for clip in clips:
    out = Path(f"video/out/{clip}-words.json")
    raw = Path(f"video/raw/{clip}.mp4")
    if force or not out.exists() or out.stat().st_mtime < raw.stat().st_mtime:
        todo.append(clip)
if not todo:
    print("transcripts: reusing " + ", ".join(clips), flush=True)
    sys.exit(0)

model = WhisperModel("small", device="cpu", compute_type="int8")
for clip in todo:
    path = f"video/raw/{clip}.mp4"
    raw = subprocess.check_output([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
        "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-",
    ])
    audio = np.frombuffer(raw, np.float32).copy()
    segments, info = model.transcribe(
        audio, language="en", word_timestamps=True, vad_filter=False, beam_size=5,
    )
    words, segs = [], []
    print(f"===== {clip}  {len(audio) / 16000:.2f}s =====", flush=True)
    for seg in segments:
        segs.append({"start": round(seg.start, 3), "end": round(seg.end, 3), "text": seg.text})
        print(f"[{seg.start:7.2f}-{seg.end:7.2f}] {seg.text}", flush=True)
        for w in seg.words or []:
            words.append({"start": round(w.start, 3), "end": round(w.end, 3), "word": w.word})
    Path(f"video/out/{clip}-words.json").write_text(
        json.dumps({"segments": segs, "words": words}, indent=2) + "\n"
    )
    print(f"saved {clip}: {len(words)} words, {len(segs)} segments", flush=True)
PY

# -------------------------------------------------------------- cut detection
# A cut is allowed only where a silence of at least SILENCE_MIN at or below
# SILENCE_DB overlaps a frozen picture. Shrink the overlap by MARGIN on each
# side and keep it WORD_GUARD away from every word. Loading waits keep
# LOADING_KEEP instead of a margin when they run past LOADING_MIN.
if (( REUSE_CUTS )) && [[ -f "$CUTS_FILE" ]]; then
  echo "cuts: reusing $CUTS_FILE"
else
  "$PY" - "$CUTS_FILE" "$SILENCE_DB" "$SILENCE_MIN" "$MARGIN" "$WORD_GUARD" \
    "$LOADING_KEEP" "$LOADING_MIN" "${CLIPS[@]}" << 'PY'
import json, math, re, struct, subprocess, sys
from pathlib import Path

(cuts_path, sil_db, sil_min, margin, guard,
 load_keep, load_min), clips = sys.argv[1:8], sys.argv[8:]
sil_db, sil_min = float(sil_db), float(sil_min)
margin, guard = float(margin), float(guard)
load_keep, load_min = float(load_keep), float(load_min)
WIN = 0.02

def duration(clip):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", f"video/raw/{clip}.mp4",
    ], text=True)
    return float(out.strip())

def audio_db(clip):
    raw = subprocess.check_output([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
        "-i", f"video/raw/{clip}.mp4", "-ac", "1", "-ar", "16000",
        "-f", "f32le", "-",
    ])
    n = len(raw) // 4
    samples = struct.unpack(f"<{n}f", raw)
    win = int(16000 * WIN)
    levels = []
    for i in range(0, n - win + 1, win):
        chunk = samples[i:i + win]
        rms = math.sqrt(sum(x * x for x in chunk) / win)
        levels.append(20 * math.log10(rms) if rms > 1e-8 else -120.0)
    return levels

def silences(levels):
    runs, start = [], None
    for i, level in enumerate(levels):
        t = i * WIN
        if level <= sil_db:
            if start is None:
                start = t
        elif start is not None:
            if t - start >= sil_min:
                runs.append((start, t))
            start = None
    end = len(levels) * WIN
    if start is not None and end - start >= sil_min:
        runs.append((start, end))
    return runs

def freezes(clip, dur):
    proc = subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "info",
        "-i", f"video/raw/{clip}.mp4", "-vf", "freezedetect=n=-60dB:d=2",
        "-an", "-f", "null", "-",
    ], capture_output=True, text=True)
    runs, open_at = [], None
    for line in proc.stderr.replace("\r", "\n").splitlines():
        m = re.search(r"freeze_start:\s*([\d.]+)", line)
        if m:
            if open_at is not None:
                runs.append((open_at, float(m.group(1))))
            open_at = float(m.group(1))
            continue
        m = re.search(r"freeze_end:\s*([\d.]+)", line)
        if m and open_at is not None:
            runs.append((open_at, float(m.group(1))))
            open_at = None
    if open_at is not None:
        runs.append((open_at, dur))
    return runs

def overlap(a, b):
    lo, hi = max(a[0], b[0]), min(a[1], b[1])
    return (lo, hi, hi - lo) if hi > lo else None

lines = [
    "# Pitch Coach demo cuts — generated by video/build-pitch-coach.sh",
    "# Source-clip seconds. A cut is silence at or below -35 dB for at least 2 s",
    "# that overlaps a frozen picture, shrunk 0.5 s on each side and kept at least",
    "# 0.3 s away from every Whisper word. Loading waits keep 1 s when they run past",
    "# 1 s (post-Stop hold, Ultra spinner). Format: clip start_s end_s reason",
]
for clip in clips:
    dur = duration(clip)
    levels = audio_db(clip)
    frozen = freezes(clip, dur)
    words = [
        (float(w["start"]), float(w["end"]), w["word"].strip())
        for w in json.loads(Path(f"video/out/{clip}-words.json").read_text())["words"]
    ]
    for s, e in silences(levels):
        parts = [p for f in frozen if (p := overlap((s, e), f))]
        cover = sum(p[2] for p in parts)
        if cover < 0.5:
            continue
        prev = [w for w in words if w[1] <= s + 0.05]
        after = [w for w in words if w[0] >= s]
        prev_end = max((w[1] for w in prev), default=0.0)
        next_start = min((w[0] for w in after), default=dur)
        trailing = e >= dur - 0.1 or next_start >= dur - 0.01
        loading = (not trailing) and bool(prev) and (e - s) >= load_min
        if loading:
            a, b = s + load_keep, e - margin
            kind = "loading wait"
        elif trailing:
            a, b = max(parts[0][0] + margin, prev_end + load_keep), dur
            kind = "trailing hold"
        else:
            a, b = parts[0][0] + margin, parts[-1][1] - margin
            kind = "still hold"
        a = max(a, prev_end + guard)
        if next_start < dur - 0.01:
            b = min(b, next_start - guard)
        if b - a < 0.4:
            print(f"skip {clip} {s:.2f}-{e:.2f}: only {b - a:.2f}s after guards")
            continue
        before = f" after '{prev[-1][2]}'" if prev else ""
        following = f", before '{after[0][2]}'" if after else ""
        reason = (
            f"{kind}: silence {s:.2f}-{e:.2f} ({e - s:.2f} s), "
            f"frozen {cover:.2f} s{before}{following}"
        )
        lines.append(f"{clip} {a:.3f} {b:.3f} {reason}")
        print(f"CUT {clip} {a:.3f}-{b:.3f} {reason}")
Path(cuts_path).write_text("\n".join(lines) + "\n")
PY
fi

if [[ ! -s "$CUTS_FILE" ]]; then
  echo "No cuts written to $CUTS_FILE" >&2
  exit 1
fi

# ----------------------------------------------------------------- validation
# Every cut must be silent and at least WORD_GUARD away from every word.
"$PY" - "$CUTS_FILE" "$WORD_GUARD" "${CLIPS[@]}" << 'PY'
import json, math, struct, subprocess, sys
from pathlib import Path

cuts_path, guard = sys.argv[1], float(sys.argv[2])
clips = sys.argv[3:]
WIN = 0.02

cuts = []
for line in Path(cuts_path).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    clip, a, b, *rest = line.split()
    cuts.append((clip, float(a), float(b), " ".join(rest)))

def audio(path, t0, t1):
    raw = subprocess.check_output([
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", f"{t0:.3f}", "-t", f"{max(0.02, t1 - t0):.3f}", "-i", path,
        "-ac", "1", "-ar", "16000", "-f", "f32le", "-",
    ])
    n = len(raw) // 4
    return struct.unpack(f"<{n}f", raw), 16000

def bursts(samples, rate, t0):
    win = int(rate * 0.02)
    found, run = [], None
    for i in range(0, len(samples) - win, win):
        chunk = samples[i:i + win]
        rms = math.sqrt(sum(x * x for x in chunk) / win)
        db = 20 * math.log10(rms) if rms > 1e-8 else -120
        t = t0 + i / rate
        if db > -35:
            run = (t, t + 0.02) if run is None else (run[0], t + 0.02)
        elif run is not None:
            found.append(run)
            run = None
    if run is not None:
        found.append(run)
    return found

protected = []
for clip in clips:
    data = json.loads(Path(f"video/out/{clip}-words.json").read_text())
    path = f"video/raw/{clip}.mp4"
    for w in data["words"]:
        start, end = float(w["start"]), float(w["end"])
        label = w["word"].strip()
        if end - start > 1.0:
            samples, rate = audio(path, max(0.0, start - 0.05), end + 0.05)
            spans = bursts(samples, rate, max(0.0, start - 0.05))
            if not spans:
                continue
            for a, b in spans:
                protected.append((clip, a - guard, b + guard, label))
        else:
            protected.append((clip, start - guard, end + guard, label))

report, bad = [], []
for clip, a, b, reason in cuts:
    if b <= a:
        bad.append(f"{clip} cut {a:.3f}-{b:.3f} is empty")
        continue
    samples, rate = audio(f"video/raw/{clip}.mp4", a, b)
    win = int(rate * 0.02)
    energy = ""
    for i in range(0, len(samples) - win, win):
        chunk = samples[i:i + win]
        rms = math.sqrt(sum(x * x for x in chunk) / win)
        db = 20 * math.log10(rms) if rms > 1e-8 else -120
        if db > -35:
            energy = f"energy {db:.1f} dB at {a + i / rate:.3f}"
            break
    if energy:
        bad.append(f"{clip} cut {a:.3f}-{b:.3f} has {energy}")
    for c, s, e, word in protected:
        if c == clip and a < e and b > s:
            bad.append(f"{clip} cut {a:.3f}-{b:.3f} is within {guard:.1f} s of '{word}' "
                       f"{s + guard:.3f}-{e - guard:.3f}")
    report.append(f"OK {clip} {a:.3f}-{b:.3f} silent and clear of words")

Path("video/out/tmp/cut-check.txt").write_text("\n".join(report) + "\n")
if bad:
    Path("video/out/tmp/cut-check.txt").write_text(
        "\n".join(bad + report) + "\n"
    )
    print("\n".join(bad), file=sys.stderr)
    sys.exit(1)
print(f"cuts clear speech ({len(cuts)} cuts, {len(protected)} protected spans)")
PY

# ----------------------------------------------------------------------- join
# One input per kept region, seeked on the input side and limited to one decoder
# thread. Each region after the first loses XFADE from its picture so the hard
# video concat has the same length as the audio acrossfade chain.
"$PY" - "$CUTS_FILE" "$OFFSET_MS" "$FPS" "$XFADE" "$FONT" "$SUBTITLE_TEXT" \
  "$CARD_SECONDS" "$CARD_FADE" "$CARD_BG" "$CARD_INK" "${CLIPS[@]}" << 'PY'
import json, subprocess, sys
from pathlib import Path

(cuts_path, offset_ms, fps, xfade, font, subtitle_text,
 card_seconds, card_fade, card_bg, card_ink) = sys.argv[1:11]
clips = sys.argv[11:]
offset = int(offset_ms) / 1000
fps = int(fps)
frame = 1 / fps
xfade = float(xfade)
card_seconds = float(card_seconds)
card_fade = float(card_fade)
score_clip = clips[-1]

def duration(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", path,
    ], text=True)
    return float(out.strip())

cuts = {clip: [] for clip in clips}
for line in Path(cuts_path).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    clip, a, b, *_ = line.split()
    if clip not in cuts:
        sys.exit(f"{cuts_path} names unknown clip {clip}")
    cuts[clip].append((float(a), float(b)))

def keeps(clip):
    dur = duration(f"video/raw/{clip}.mp4")
    t, out = 0.0, []
    for a, b in sorted(cuts[clip]):
        if a > t + 0.02:
            out.append((t, a))
        t = max(t, b)
    if dur - t > 0.02:
        out.append((t, dur))
    snapped = []
    for s, e in out:
        frames = int((e - s) / frame)
        if frames < 1:
            continue
        snapped.append((s, s + frames * frame))
    return snapped

regions = []
for clip in clips:
    kept = keeps(clip)
    if not kept:
        sys.exit(f"{clip} has no kept region")
    for s, e in kept:
        regions.append((clip, s, e))
    print(f"{clip} keeps {len(kept)}: " + " ".join(f"{a:.3f}-{b:.3f}" for a, b in kept))

# Does the narrator already say the low score is fair or expected?
spoken = " ".join(
    seg["text"] for seg in json.loads(
        Path(f"video/out/{score_clip}-words.json").read_text()
    )["segments"]
).lower()
markers = ("fair", "justified", "expected", "describes the tool",
           "meta-description", "not a real pitch")
add_subtitle = not any(m in spoken for m in markers)
Path("video/out/tmp/subtitle-meta.txt").write_text(
    ("added 0\n" if not add_subtitle else "added 1\n")
    + f"clip {score_clip}\ntext {subtitle_text}\n"
)
if add_subtitle:
    Path("video/out/tmp/subtitle.txt").write_text(subtitle_text)
    print(f"subtitle: added over {score_clip} (narrator never says the score is fair or expected)")
else:
    print("subtitle: not added (narrator already says the score is fair or expected)")

chains, vlabels, alabels, inputs = [], [], [], []
for i, (clip, s, e) in enumerate(regions):
    dur = e - s
    v_shift = xfade if i > 0 else 0.0
    v_start = s + v_shift
    v_dur = dur - v_shift
    if v_dur < frame:
        continue
    slack = 0.5
    inputs.append((v_start, v_dur + slack, f"video/raw/{clip}.mp4"))
    vi = len(inputs) - 1
    inputs.append((s + offset, dur + slack, f"video/raw/{clip}.mp4"))
    ai = len(inputs) - 1
    v, a = f"vc{i}", f"ac{i}"
    chains.append(
        f"[{vi}:v]fps={fps},format=yuv420p,setsar=1,"
        f"trim=duration={v_dur:.6f},setpts=PTS-STARTPTS[{v}]"
    )
    chains.append(
        f"[{ai}:a]aresample=48000,aformat=channel_layouts=stereo,apad,"
        f"atrim=duration={dur:.6f},asetpts=PTS-STARTPTS[{a}]"
    )
    vlabels.append(v)
    alabels.append(a)

if len(vlabels) < 2:
    sys.exit("the edit has fewer than two regions; nothing to join")
chains.append("".join(f"[{v}]" for v in vlabels) +
              f"concat=n={len(vlabels)}:v=1:a=0[vcat]")
prev = alabels[0]
for i in range(1, len(alabels)):
    out = f"ax{i}"
    chains.append(f"[{prev}][{alabels[i]}]acrossfade=d={xfade:.3f}:c1=tri:c2=tri[{out}]")
    prev = out

main_total = sum(b - a for _, a, b in regions) - (len(regions) - 1) * xfade

if add_subtitle:
    score_first = next(i for i, (c, _, _) in enumerate(regions) if c == score_clip)
    score_start = sum(b - a for _, a, b in regions[:score_first]) - score_first * xfade
    sub_start = score_start + 0.2
    sub_end = sub_start + 4.0
    chains.append(
        f"[vcat]drawtext=fontfile={font}:textfile=video/out/tmp/subtitle.txt:"
        f"fontsize=30:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12:"
        f"x=(w-text_w)/2:y=h-140:"
        f"enable='between(t,{sub_start:.3f},{sub_end:.3f})'[vmain]"
    )
    Path("video/out/tmp/subtitle-meta.txt").write_text(
        "added 1\n"
        f"clip {score_clip}\n"
        f"start_s {sub_start:.3f}\n"
        f"end_s {sub_end:.3f}\n"
        f"text {subtitle_text}\n"
    )
    print(f"subtitle window {sub_start:.3f}-{sub_end:.3f} in the final timeline")
else:
    chains.append("[vcat]null[vmain]")

# End card: a dissolve from the last content frame, then 3 s of card on
# silence. The main picture is padded to the exact audio length first: the
# video stream can end a frame or two before the audio, and xfade needs a
# full first input.
Path("video/out/tmp/card1.txt").write_text("Pitch Coach")
Path("video/out/tmp/card2.txt").write_text("pitch-coach.focampo.com")
Path("video/out/tmp/card3.txt").write_text("github.com/focampok/pitch-coach · MIT")
chains.append(
    f"[vmain]tpad=stop_mode=clone:stop_duration={card_fade + 1:.3f},"
    f"setpts=PTS-STARTPTS,settb=AVTB[vpad]"
)
chains.append(
    f"color=c={card_bg}:s=1920x1080:r={fps}:d={card_seconds + card_fade:.3f},"
    f"format=yuv420p,setsar=1,settb=AVTB,"
    f"drawtext=fontfile={font}:textfile=video/out/tmp/card1.txt:fontsize=96:"
    f"fontcolor={card_ink}:x=(w-text_w)/2:y=400,"
    f"drawtext=fontfile={font}:textfile=video/out/tmp/card2.txt:fontsize=44:"
    f"fontcolor={card_ink}:x=(w-text_w)/2:y=590,"
    f"drawtext=fontfile={font}:textfile=video/out/tmp/card3.txt:fontsize=30:"
    f"fontcolor={card_ink}:x=(w-text_w)/2:y=660[vcard]"
)
chains.append(
    f"[vpad][vcard]xfade=transition=fade:duration={card_fade:.3f}:"
    f"offset={main_total - card_fade:.6f},"
    f"trim=duration={main_total + card_seconds:.6f},setpts=PTS-STARTPTS,"
    f"format=yuv420p[v]"
)
chains.append(f"[{prev}]anull[a0]")
chains.append(
    f"anullsrc=channel_layout=stereo:sample_rate=48000,"
    f"aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000,"
    f"atrim=duration={card_seconds + card_fade:.3f},asetpts=PTS-STARTPTS[acard]"
)
chains.append(
    f"[a0][acard]acrossfade=d={card_fade:.3f}:c1=tri:c2=tri[a]"
)
Path("video/out/tmp/card-meta.txt").write_text(
    f"main_end_s {main_total:.3f}\ncard_s {card_seconds:.3f}\n"
)

Path("video/out/tmp/join.txt").write_text(";\n".join(chains) + "\n")
Path("video/out/tmp/inputs.txt").write_text("".join(
    f"{t0:.6f}|{t1:.6f}|{path}\n" for t0, t1, path in inputs
))
total = main_total + card_seconds
print(f"join graph: {len(regions)} regions, {len(regions) - 1} joins, "
      f"main {main_total:.2f}s + {card_seconds:.1f}s card = about {total:.2f}s")
PY

# One decoder thread per input: the peak stays at a few hundred MB.
ARGS=()
while IFS='|' read -r ss dur path; do
  ARGS+=(-threads 1 -ss "$ss" -t "$dur" -i "$path")
done < video/out/tmp/inputs.txt
if (( ${#ARGS[@]} == 0 )); then
  echo "join inputs are empty" >&2
  exit 1
fi

ffmpeg -y -nostdin -hide_banner -loglevel error -stats "${ARGS[@]}" \
  -filter_complex_threads 1 \
  -filter_complex_script video/out/tmp/join.txt \
  -map "[v]" -map "[a]" \
  -c:v libx264 -pix_fmt yuv420p -r "$FPS" -crf "$CRF" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart \
  video/out/tmp/rough.mp4

echo "rough $(duration_of video/out/tmp/rough.mp4)s"

# --------------------------------------------------------------- loudnorm x2
# Pass 1 prints JSON; pass 2 reads it. Nothing is pasted by hand.
ffmpeg -nostdin -hide_banner -loglevel info -i video/out/tmp/rough.mp4 \
  -af "loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11:print_format=json" \
  -f null - 2> video/out/tmp/loudnorm.txt

"$PY" - video/out/tmp/loudnorm.txt "$TARGET_LUFS" << 'PY'
import json, re, sys
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
matches = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", text, re.S)
if not matches:
    sys.exit("loudnorm JSON missing\n" + text[-2000:])
m = json.loads(matches[-1])
keys = {
    "measured_I": m["input_i"],
    "measured_TP": m["input_tp"],
    "measured_LRA": m["input_lra"],
    "measured_thresh": m["input_thresh"],
    "offset": m["target_offset"],
}
parts = [f"I={sys.argv[2]}", "TP=-1.5", "LRA=11", "linear=true"]
parts += [f"{k}={v}" for k, v in keys.items()]
open("video/out/tmp/loudnorm-af.txt", "w").write("loudnorm=" + ":".join(parts))
open("video/out/loudnorm-pass1.json", "w").write(json.dumps(m, indent=2) + "\n")
print("loudnorm pass 1", " ".join(f"{k}={v}" for k, v in keys.items()))
PY

ffmpeg -y -nostdin -hide_banner -loglevel error -stats \
  -i video/out/tmp/rough.mp4 \
  -af "$(cat video/out/tmp/loudnorm-af.txt)" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart \
  video/out/tmp/normalized.mp4

mv -f video/out/tmp/normalized.mp4 video/out/pitch-coach-demo.mp4

# -------------------------------------------- verification + final transcript
ffmpeg -nostdin -hide_banner -loglevel info -i video/out/pitch-coach-demo.mp4 \
  -af volumedetect -f null - 2> video/out/tmp/volume.txt
ffmpeg -nostdin -hide_banner -loglevel info -i video/out/pitch-coach-demo.mp4 \
  -af ebur128=peak=true -f null - 2> video/out/tmp/ebur.txt

VERIFY_FAILED=0
if ! "$PY" - video/out/pitch-coach-demo.mp4 video/out/tmp/volume.txt \
    video/out/tmp/ebur.txt "$CUTS_FILE" "${CLIPS[@]}" << 'PY'
import difflib, json, re, subprocess, sys
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

out_path, vol_path, ebur_path, cuts_path = sys.argv[1:5]
clips = sys.argv[5:]

def norm(word):
    return re.sub(r"[^a-z0-9]", "", word.lower())

dur = float(subprocess.check_output([
    "ffprobe", "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", out_path,
], text=True).strip())

vol = open(vol_path, encoding="utf-8", errors="replace").read()
mean = re.search(r"mean_volume:\s*(-?(?:inf|[\d.]+)) dB", vol)
mx = re.search(r"max_volume:\s*(-?(?:inf|[\d.]+)) dB", vol)
ebur = open(ebur_path, encoding="utf-8", errors="replace").read()
integrated = [float(x) for x in re.findall(r"^\s+I:\s+(-?[\d.]+) LUFS", ebur, re.M)]
peaks = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", ebur)
if not mean or not mx or mean.group(1) in {"inf", "-inf"} or mx.group(1) in {"inf", "-inf"}:
    sys.exit(f"volumedetect missing a finite level\n{vol}")
mean_v, max_v = float(mean.group(1)), float(mx.group(1))
if not integrated:
    sys.exit(f"ebur128 I missing\n{ebur[-2000:]}")
lufs = integrated[-1]
true_peak = float(peaks[-1]) if peaks else float("nan")

# Final transcript, stored for the frame picker.
raw = subprocess.check_output([
    "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
    "-i", out_path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-",
])
audio = np.frombuffer(raw, np.float32).copy()
model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    audio, language="en", word_timestamps=True, vad_filter=False, beam_size=5,
)
words, segs = [], []
for seg in segments:
    segs.append({"start": round(seg.start, 3), "end": round(seg.end, 3), "text": seg.text})
    print(f"[{seg.start:7.2f}-{seg.end:7.2f}] {seg.text}", flush=True)
    for w in seg.words or []:
        words.append({"start": round(w.start, 3), "end": round(w.end, 3), "word": w.word})
Path("video/out/demo-words.json").write_text(
    json.dumps({"segments": segs, "words": words}, indent=2) + "\n"
)

tokens = [t for t in (norm(w["word"]) for w in words) if t]
final_text = " ".join(tokens)

def has_seq(seq):
    n = len(seq)
    return any(tokens[i:i + n] == list(seq) for i in range(len(tokens) - n + 1))

two_ok = (has_seq(("two", "point", "two", "seconds"))
          or has_seq(("2", "2", "seconds"))
          or has_seq(("22", "seconds"))
          or "twopointtwo" in final_text)
nemotron_ok = "nemotron" in tokens
ultra_ok = "ultra" in tokens

# Coverage: every source segment of four or more words should survive in the
# final transcript. A half-cut segment loses about half its characters; ASR
# wording variants stay well above 0.70.
COVERAGE_MIN = 0.70
coverage = {}
for clip in clips:
    src = json.loads(Path(f"video/out/{clip}-words.json").read_text())
    ratios = []
    for seg in src["segments"]:
        toks = [t for t in (norm(x) for x in seg["text"].split()) if t]
        if len(toks) < 4:
            continue
        text = " ".join(toks)
        matcher = difflib.SequenceMatcher(None, text, final_text, autojunk=False)
        covered = sum(block.size for block in matcher.get_matching_blocks())
        ratios.append((covered / len(text), seg["text"].strip()))
    coverage[clip] = min(ratios) if ratios else (1.0, "no multi-word segments")

# The closing must carry the product name, in the transcript or on screen.
last_end = words[-1]["end"] if words else dur
closing = [norm(w["word"]) for w in words if w["start"] >= last_end - 12]
closing_spoken = any(t in {"focampo", "pitchcoach", "pitch", "coach"} for t in closing)
ocr_path = Path("video/out/tmp/closing-ocr.png")
subprocess.run([
    "ffmpeg", "-y", "-nostdin", "-hide_banner", "-loglevel", "error",
    "-ss", f"{max(0.0, dur - 0.5):.3f}", "-i", out_path,
    "-frames:v", "1", str(ocr_path),
], check=True)
try:
    ocr = subprocess.run(
        ["tesseract", str(ocr_path), "stdout"],
        capture_output=True, text=True, check=True,
    ).stdout.lower()
except (FileNotFoundError, subprocess.CalledProcessError):
    ocr = ""
closing_ocr = any(x in ocr for x in ("focampo", "pitch-coach", "pitchcoach"))
closing_ok = closing_spoken or closing_ocr

cut_rows = []
bad_cuts = []
for line in Path(cuts_path).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    clip, a, b, *rest = line.split()
    cut_rows.append((clip, float(a), float(b), " ".join(rest)))

check = Path("video/out/tmp/cut-check.txt").read_text()
cut_ok = ("BAD" not in check and check.count("OK ") == len(cut_rows)
          and len(cut_rows) > 0)

meta = Path("video/out/tmp/subtitle-meta.txt").read_text().splitlines()
subtitle_added = meta[0].strip() == "added 1"
subtitle_info = {k: v for k, v in (line.split(" ", 1) for line in meta[1:] if " " in line)}

checks = [
    ("duration under 170 s", dur < 170, f"{dur:.3f} s"),
    ("integrated loudness -15..-13 LUFS", -15 <= lufs <= -13, f"{lufs:.2f} LUFS"),
    ("true peak at or below -1.5 dBFS", true_peak <= -1.5, f"{true_peak:.2f} dBFS"),
    ("transcript coverage >= 0.70 per clip",
     all(ratio >= COVERAGE_MIN for ratio, _text in coverage.values()),
     ", ".join(f"{c} {coverage[c][0]:.3f}" for c in clips)),
    ("'two point two seconds' in the final", two_ok, "yes" if two_ok else "no"),
    ("'Nemotron' in the final", nemotron_ok, "yes" if nemotron_ok else "no"),
    ("'Ultra' in the final", ultra_ok, "yes" if ultra_ok else "no"),
    ("'pitch-coach' or 'focampo' in the closing", closing_ok,
     "on screen" if closing_ocr and not closing_spoken
     else ("spoken" if closing_spoken else "no")),
    ("no cut inside a word", cut_ok,
     f"{len(cut_rows)} cuts checked" if cut_ok else check),
]

lines = [
    "Pitch Coach demo — verification",
    f"output: {out_path}",
    "clips: " + ", ".join(clips),
    "",
    "audio (volumedetect)",
    f"  mean_volume_db {mean_v:.2f}",
    f"  max_volume_db {max_v:.2f}",
    "audio (ebur128, peak=true)",
    f"  integrated_lufs {lufs:.2f}",
    f"  true_peak_dbfs {true_peak:.2f}",
    "",
    "transcript coverage (final vs each source clip, threshold 0.70)",
]
for clip in clips:
    ratio, text = coverage[clip]
    lines.append(f"  {clip}: {ratio:.3f} — {text}")
lines.append("")
lines.append("keyword checks")
lines.append(f"  two point two seconds: {'PASS' if two_ok else 'FAIL'}")
lines.append(f"  Nemotron: {'PASS' if nemotron_ok else 'FAIL'}")
lines.append(f"  Ultra: {'PASS' if ultra_ok else 'FAIL'}")
lines.append(
    f"  pitch-coach/focampo in the closing: {'PASS' if closing_ok else 'FAIL'}"
    + (" (visible on screen in the closing frame)"
       if closing_ocr and not closing_spoken else
       (" (spoken)" if closing_spoken else ""))
)
lines.append("")
lines.append("cuts (source-clip seconds)")
for clip, a, b, reason in cut_rows:
    lines.append(f"  {clip} {a:.3f}-{b:.3f} {reason}")
lines.append("")
lines.append(f"no cut inside a word: {'PASS' if cut_ok else 'FAIL'}")
if not cut_ok:
    lines.append("  " + check.replace("\n", "\n  "))
lines.append("")
if subtitle_added:
    lines.append(
        f"subtitle: added over {subtitle_info.get('clip', '?')} "
        f"from {subtitle_info.get('start_s', '?')} to {subtitle_info.get('end_s', '?')} s"
    )
    lines.append(f"  \"{subtitle_info.get('text', '')}\"")
    lines.append("  (the narrator does not say the low score is fair or expected)")
else:
    lines.append("subtitle: not added (the narrator already says the score is fair or expected)")
lines.append("")
lines.extend(
    f"{'PASS' if ok else 'FAIL'}  {label}: {detail}" for label, ok, detail in checks
)
failed = [label for label, ok, _detail in checks if not ok]
lines.append("")
lines.append("RESULT: " + ("PASS" if not failed else "FAIL — " + "; ".join(failed)))
report = "\n".join(lines) + "\n"
Path("video/out/verify.txt").write_text(report)
print(report)
if failed:
    sys.exit(1)
PY
then
  VERIFY_FAILED=1
fi

# ------------------------------------------------------------------- frames
"$PY" - video/out/pitch-coach-demo.mp4 << 'PY'
import json, re, subprocess, sys
from pathlib import Path

path = sys.argv[1]
data = json.loads(Path("video/out/demo-words.json").read_text())
words = data["words"]
dur = float(subprocess.check_output([
    "ffprobe", "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", path,
], text=True).strip())

def norm(word):
    return re.sub(r"[^a-z0-9]", "", word.lower())

def first(prefix):
    return next((w for w in words if norm(w["word"]).startswith(prefix)), None)

frames = [("01-inicio.png", 0.40, "opening frame, app already on screen")]
rehearse = first("rehears")
frames.append(("02-pitch-grabando.png",
               (rehearse["start"] + 0.15) if rehearse else None,
               "word rehearse, screen is Recording"))
judged = first("judg")
frames.append(("03-puntaje-super.png",
               judged["start"] if judged else None,
               "word judged, 8/100 and the Super Model line under the ring"))
figures = [w for w in words if "figure" in norm(w["word"])]
fig = figures[1] if len(figures) > 1 else (figures[0] if figures else None)
frames.append(("04-tavily-datos.png",
               (fig["start"] + 0.15) if fig else None,
               "second figure word, Tavily data card and its source"))
reasoning = first("reasoning")
ultra = next((w for w in words
              if "ultra" in norm(w["word"]) and reasoning and w["start"] > reasoning["start"]),
             None)
frames.append(("05-ultra-traza.png",
               ultra["start"] if ultra else None,
               "Ultra after the reasoning word, trace and Ultra Model line"))
def meta(path):
    return dict(line.split(" ", 1)
                for line in Path(path).read_text().splitlines() if " " in line)

card = meta("video/out/tmp/card-meta.txt")
main_end = float(card["main_end_s"])
sub = meta("video/out/tmp/subtitle-meta.txt")
sub_added = Path("video/out/tmp/subtitle-meta.txt").read_text().startswith("added 1")
sub_mid = ((float(sub["start_s"]) + float(sub["end_s"])) / 2) if sub_added else None

# The video stream can end a few frames before the audio-driven container
# duration, so keep half a second of headroom.
frames.append(("06-cierre.png", max(0.0, main_end - 0.5),
               "last content frame before the card"))
frames.append(("07-subtitulo.png", sub_mid,
               "midpoint of the 4 s subtitle window"))
frames.append(("08-tarjeta.png", max(0.0, dur - 1.5),
               "midpoint of the 3 s end card"))

missing = [name for name, t, _why in frames if t is None]
if missing:
    print("could not place frames:", ", ".join(missing), file=sys.stderr)
    sys.exit(1)
Path("video/out/tmp/frames.txt").write_text("\n".join(
    f"{name}\t{t:.3f}\t{why}" for name, t, why in frames
) + "\n")
for name, t, why in frames:
    print(f"frame {name} t={t:.3f} {why}")
PY

while IFS=$'\t' read -r name t why; do
  # Accurate frame: input seek 1 s early, then output seek the rest.
  ss="$("$PY" -c "print(max(0.0, round(${t}-1.0, 3)))")"
  fine="$("$PY" -c "print(round(${t}-float('${ss}'), 3))")"
  ffmpeg -y -nostdin -hide_banner -loglevel error \
    -ss "$ss" -i video/out/pitch-coach-demo.mp4 -ss "$fine" -frames:v 1 \
    "video/frames/${name}"
  if [[ ! -s "video/frames/${name}" ]]; then
    echo "frame ${name} at ${t}s was not written" >&2
    exit 1
  fi
done < video/out/tmp/frames.txt

echo "demo $(duration_of video/out/pitch-coach-demo.mp4)s"
ls -lh video/out/pitch-coach-demo.mp4 video/frames/*.png

if (( VERIFY_FAILED )); then
  echo "Verification failed. See video/out/verify.txt" >&2
  exit 1
fi
