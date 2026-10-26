#!/usr/bin/env bash
# analyze-reference.sh — turn a reference video into something I can study.
#
# I cannot "watch" a video: I read images. So this script does the watching
# for me and leaves behind the evidence:
#
#   frames/            one frame every 0.5 s
#   contact-sheet.jpg  the whole reel on one page — my fastest read
#   cuts.txt           the cut list = the editing rhythm
#   motion.txt         how much the picture moves, second by second
#   audio.wav          the sound, plus a loudness curve
#   stats.txt          duration, fps, resolution, average colour, levels
#
# Usage:
#   ./analyze-reference.sh <video-file-or-url> [name]
#
# A direct .mp4 URL, a TikTok link, or a local file all work. For a YouTube /
# Instagram / Facebook link, use yt-dlp first:
#   yt-dlp -o ref.mp4 "<url>" && ./analyze-reference.sh ref.mp4 reel-name
set -euo pipefail

SRC="${1:?usage: analyze-reference.sh <video-file-or-url> [name]}"
NAME="${2:-reference}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../references/$NAME"
FFMPEG="${FFMPEG:-ffmpeg}"
FFPROBE="${FFPROBE:-ffprobe}"

mkdir -p "$OUT/frames"

# A URL is downloaded first (yt-dlp understands YouTube/TikTok/…; a plain
# .mp4 URL is handled by curl).
WORK="$OUT/source.mp4"
if [[ "$SRC" =~ ^https?:// ]]; then
  if command -v yt-dlp >/dev/null 2>&1; then
    yt-dlp --no-warnings -o "$WORK" "$SRC" || curl -sL -o "$WORK" "$SRC"
  else
    curl -sL -o "$WORK" "$SRC"
  fi
else
  cp "$SRC" "$WORK"
fi

echo "→ stats"
{
  echo "name: $NAME"
  echo "source: $SRC"
  "$FFPROBE" -v error -show_entries format=duration,bit_rate,size \
    -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames \
    -of default=noprint_wrappers=1 "$WORK" || true
} > "$OUT/stats.txt"

echo "→ frames (every 0.5 s)"
"$FFMPEG" -v error -y -i "$WORK" -vf "fps=2,scale=540:-2" -q:v 3 "$OUT/frames/%05d.jpg"

echo "→ analysis"
python3 - "$OUT" <<'PY'
import glob, math, os, struct, sys, wave
from PIL import Image, ImageStat

out = sys.argv[1]
files = sorted(glob.glob(os.path.join(out, 'frames', '*.jpg')))
print(f'frames: {len(files)}')

# --- how much the picture changes, and where the cuts are -------------------
prev = None
diffs = []
for i, f in enumerate(files):
    im = Image.open(f).convert('L').resize((96, 170))
    stat = ImageStat.Stat(im)
    diffs.append(stat.mean[0])
    prev = im

def frame_delta(a, b):
    """Mean absolute difference between two frames (0..255)."""
    pa, pb = a.tobytes(), b.tobytes()
    return sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa)

deltas = []
prev = None
for f in files:
    im = Image.open(f).convert('L').resize((96, 170))
    if prev is not None:
        deltas.append((len(deltas) * 0.5, frame_delta(prev, im)))
    prev = im

if deltas:
    mean = sum(d for _, d in deltas) / len(deltas)
    std = (sum((d - mean) ** 2 for _, d in deltas) / len(deltas)) ** 0.5
    threshold = max(6.0, mean + 2.2 * std)
    cuts = [(t, d) for t, d in deltas if d >= threshold]
    with open(os.path.join(out, 'cuts.txt'), 'w') as fh:
        for t, d in cuts:
            fh.write(f'{t:.2f}\t{d:.1f}\n')
    with open(os.path.join(out, 'motion.txt'), 'w') as fh:
        fh.write('# second\tmean frame delta (0-255) — how much the picture moves\n')
        for t, d in deltas:
            fh.write(f'{t:.2f}\t{d:.2f}\n')
    print(f'motion: mean delta {mean:.1f}, {len(cuts)} cuts over threshold {threshold:.1f}')

# --- average colour --------------------------------------------------------
if files:
    small = Image.open(files[0]).convert('RGB').resize((1, 1))
    r, g, b = small.getpixel((0, 0))
    with open(os.path.join(out, 'stats.txt'), 'a') as fh:
        fh.write(f'avg_colour: rgb({r},{g},{b})\n')

# --- the sound --------------------------------------------------------------
wav = os.path.join(out, 'audio.wav')
if os.path.exists(wav):
    w = wave.open(wav)
    n, sr = w.getnframes(), w.getframerate()
    s = struct.unpack(f'<{n}h', w.readframes(n))
    peak = max((abs(x) for x in s), default=0) / 32768
    rms = (sum(x * x for x in s) / n) ** 0.5 / 32768 if n else 0
    clip = sum(1 for x in s if abs(x) >= 32700)
    # loudness curve, 0.5 s windows
    win = sr // 2
    curve = []
    for i in range(0, max(1, n - win), win):
        seg = s[i:i + win]
        curve.append((sum(x * x for x in seg) / len(seg)) ** 0.5 / 32768)
    with open(os.path.join(out, 'loudness.txt'), 'w') as fh:
        fh.write('# second\trms\n')
        for i, v in enumerate(curve):
            fh.write(f'{i * 0.5:.2f}\t{v:.4f}\n')
    with open(os.path.join(out, 'stats.txt'), 'a') as fh:
        fh.write(f'audio_peak_dbfs: {20 * math.log10(peak):.1f}\n')
        fh.write(f'audio_rms_dbfs: {20 * math.log10(rms):.1f}\n')
        fh.write(f'audio_clipped_samples: {clip}\n')
    print(f'audio: {n / sr:.1f}s peak {20 * math.log10(peak):.1f} dBFS rms {20 * math.log10(rms):.1f} dBFS clipped {clip}')
PY

echo "→ contact sheet"
python3 - "$OUT" <<'PY'
import glob, os, sys
from PIL import Image
out = sys.argv[1]
files = sorted(glob.glob(os.path.join(out, 'frames', '*.jpg')))
if not files:
    raise SystemExit('no frames')
cols = 8
w, h = Image.open(files[0]).size
tw, th = w // 3, h // 3
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), '#cccccc')
for i, f in enumerate(files):
    sheet.paste(Image.open(f).resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
sheet.save(os.path.join(out, 'contact-sheet.jpg'), quality=88)
print('contact sheet:', len(files), 'frames')
PY

echo
echo "done → $OUT"
ls -la "$OUT"
