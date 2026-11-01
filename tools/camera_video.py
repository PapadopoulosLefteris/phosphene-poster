"""The phone's camera feed of one recording as a video, every frame at its own time.

    python tools/camera_video.py <scene>_monitor.bin <scene>/00_live/frames data/cam/<recording>.mp4 [--fps 60] [--width 360] [--rotate 90]

Each photo is timed like `build_replay.py` times them (its frame number placed
on the recording's clock through the frame numbers the poses carried, zero at
the first pose). The video runs at a fixed `--fps` (default 60, above the
phone's sending rate), each video frame showing the newest photo at or before
its time, so every photo that arrived is shown for as long as it was current.
H.264 baseline in yuv420p with the index at the front, which every phone
browser plays, keyframe every half second for quick scrubbing. Needs ffmpeg,
numpy and opencv-python.
"""
import argparse
import json
import struct
import subprocess
from pathlib import Path

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("monitor")
ap.add_argument("frames")
ap.add_argument("out")
ap.add_argument("--fps", type=float, default=60.0)
ap.add_argument("--width", type=int, default=360, help="output width after rotation (height is 4/3 of it)")
ap.add_argument("--rotate", type=int, default=90, help="clockwise rotation for the photos (0 or 90)")
a = ap.parse_args()

raw = Path(a.monitor).read_bytes()
o, fid_t, t0 = 0, [], None
while o < len(raw):
    t, k, n = struct.unpack_from("<dBI", raw, o); o += 13
    if k == 0:
        m = json.loads(raw[o:o + n])
        if m["type"] == "pose":
            t0 = t if t0 is None else t0
            if "frame_id" in m:
                fid_t.append((m["frame_id"], t))
    o += n
fi = np.array(fid_t, float)
photos = sorted(Path(a.frames).glob("*.jpg"))
times = np.array([float(np.interp(int(p.stem), fi[:, 0], fi[:, 1])) - t0 for p in photos])
order = np.argsort(times, kind="stable")
photos, times = [photos[i] for i in order], times[order]
duration = float(fi[-1, 1] - t0)
n = int(duration * a.fps) + 1
w = a.width - a.width % 2
h = round(w * 4 / 3); h -= h % 2
Path(a.out).parent.mkdir(parents=True, exist_ok=True)
ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}",
                       "-r", f"{a.fps:g}", "-i", "-", "-c:v", "libx264", "-profile:v", "baseline", "-pix_fmt", "yuv420p",
                       "-crf", "26", "-g", str(max(1, round(a.fps / 2))), "-movflags", "+faststart", "-an", a.out],
                      stdin=subprocess.PIPE)
cur, img, shown = -1, None, set()
for k in range(n):
    i = int(np.searchsorted(times, k / a.fps, side="right")) - 1
    i = max(i, 0)
    if i != cur:
        cur = i
        im = cv2.imread(str(photos[i]))
        if a.rotate == 90:
            im = cv2.rotate(im, cv2.ROTATE_90_CLOCKWISE)
        img = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
        shown.add(i)
    ff.stdin.write(img.tobytes())
ff.stdin.close()
ff.wait()
print(f"{a.out}: {n} video frames at {a.fps:g}/s over {duration:.1f} s, {len(shown)} of {len(photos)} photos shown, "
      f"{Path(a.out).stat().st_size / 1e6:.1f} MB")
