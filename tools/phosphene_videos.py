"""Turn the phosphene image sequences of one recording into the site's videos.

    python tools/phosphene_videos.py <phos_dir> <name>

<phos_dir> is the output of SLAMPhosphene's `services/live/tools/phosphene_replay.py`
(meta.json and one folder of PNGs per mode). Writes data/phos/<name>_<mode>.mp4,
H.264 in a form every phone browser plays (baseline profile, yuv420p, index at
the front), at the sequence's own frame rate, with a keyframe every half second
so scrubbing lands quickly. Needs ffmpeg on the PATH.
"""
import json
import subprocess
import sys
from pathlib import Path

src, name = Path(sys.argv[1]), sys.argv[2]
meta = json.loads((src / "meta.json").read_text())
out = Path(__file__).resolve().parent.parent / "data" / "phos"
out.mkdir(parents=True, exist_ok=True)
fps = meta["fps"]
for mode in meta["modes"]:
    dst = out / f"{name}_{mode}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", f"{fps:g}", "-i", str(src / mode / "%05d.png"),
                    "-c:v", "libx264", "-profile:v", "baseline", "-pix_fmt", "yuv420p", "-crf", "20",
                    "-g", str(max(1, round(fps / 2))), "-movflags", "+faststart", "-an", str(dst)], check=True)
    print(dst, f"{dst.stat().st_size / 1e6:.2f} MB")
