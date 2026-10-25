# Reference reels

Drop reference videos here and I can read their style.

```bash
cd video
# a file you already have
./scripts/analyze-reference.sh ~/Downloads/reference.mp4 reel-name

# a direct .mp4 link
./scripts/analyze-reference.sh https://example.com/reel.mp4 reel-name

# a TikTok link (yt-dlp is used automatically)
./scripts/analyze-reference.sh https://www.tiktok.com/@user/video/123 reel-name
```

The script writes, per reference:

| File | What it tells me |
|---|---|
| `contact-sheet.jpg` | the whole reel on one page — how it's framed, cut and captioned |
| `frames/*.jpg` | one frame every 0.5 s, for close reading of a single moment |
| `cuts.txt` | the cut list (timestamp + how big the change was) = the editing rhythm |
| `motion.txt` | frame-to-frame difference per frame = how much the picture moves |
| `loudness.txt` | the RMS curve of the sound = where the hits land |
| `audio.wav` | the sound itself, for watching the mix |
| `stats.txt` | duration, fps, resolution, average colour, peak/RMS levels |

`source.mp4` (the downloaded original) is a working copy — delete it once the
analysis is done, it is the biggest file in the folder.

## What I can and cannot fetch

| Source | Bytes |
|---|---|
| Direct `.mp4` URL | ✅ |
| A local file | ✅ |
| TikTok | ✅ |
| YouTube | ⚠️ title/duration only — the CDN returns 403 from this machine |
| Instagram / Facebook / Vimeo | ❌ need account cookies |

For the last three, give me the file instead: a screen recording of the reel
playing, a download of the file, or a folder of screenshots. A screen
recording is the best of the three — it keeps the motion, which is the part I
need most.
