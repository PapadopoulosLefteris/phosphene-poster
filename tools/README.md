# tools

Scripts that turn a live SLAMPhosphene scan into a replay data file for the site, and make the poster's QR codes. They run on the scanning computer, never on the website.

## record_scan.py

Records one live scan for later replay. Start it before the scan. Not recommended any more: as a second Monitor client it made the server skip frames (scan nav replayed into a test server, 1633 of 2982 frames skipped with it attached, 56 without) and the Monitor lag. Rebuild the recording afterwards from the kept frames with SLAMPhosphene's `services/live/tools/rebuild_monitor.py` instead, which writes the same format. An optional second argument points it at another server (`127.0.0.1:8766`).

`python tools/record_scan.py <out_dir>`

Waits until a scan session opens on the live server (`127.0.0.1:8765`, the `LIVE` constant), then saves every message of `/ws/monitor/<scene>` (phone pose, path line, cloud changes) with its arrival time to `<out_dir>/<scene>_monitor.bin`. Stops by itself 3 s after the session ends. Changes nothing on the server. Depends on `websockets`.

File layout per message is float64 seconds since the session opened, uint8 kind (0 text, 1 binary), uint32 length, then the payload.

## build_replay.py

`python tools/build_replay.py <scene>_monitor.bin data/<page>.js [--frames <scene>/00_live/frames] [--every N] [--rotate 0|90]`

Replays the recorded messages to rebuild the scan as 3 cm cells, giving each cell one time span for every stretch it had a surface (so moving things appear and vanish), and writes `window.REPLAY` for `viewer.js`. The path lines come straight from the recording, so they are exactly what the phone received. With `--frames` it adds every camera photo the phone sent, timed by the frame numbers the poses carried, so the feed plays at the camera's real frame rate (about 30 a second). That needs the scan to run with "keep frames" on, which saves every photo in `00_live/frames`. Without it only `00_live/keyframes` exist (about two a second), which is not the real frame rate. `--every N` thins the photos and should stay at its default of 1. `--rotate 90` (default) turns the landscape photos upright. The data format is in the script's docstring. Depends on numpy, and on opencv-python with `--frames`.

Checked on 2026-11-01 against the scannav recording, it gives the same 1731 poses, 350 lines and 63,791 kept cells as the placeholder data.

## camera_video.py

`python tools/camera_video.py <scene>_monitor.bin <scene>/00_live/frames data/cam/<recording>.mp4 [--fps 60] [--width 360] [--rotate 90]`

The phone's camera feed as a video for `PAGE.camVideo`, every photo timed like `build_replay.py` times them and shown for as long as it was the newest, at a fixed 60 frames a second (photos arriving within the same sixtieth of a second share a video frame). A 52 s iPhone scan of 2982 photos becomes 3.5 MB, against about 36 MB as pictures in the data file. Needs ffmpeg, numpy and opencv-python.

## phosphene_videos.py

`python tools/phosphene_videos.py <phos_dir> <recording>`

Turns the phosphene image sequences written by SLAMPhosphene's `services/live/tools/phosphene_replay.py` (`meta.json` plus one PNG folder per mode) into `data/phos/<recording>_<mode>.mp4`, H.264 baseline in yuv420p with the index at the front so phone browsers play it, at the sequence's own frame rate and with a keyframe every half second for quick scrubbing. Needs ffmpeg.

## make_qr.py

`python tools/make_qr.py [url]`

Writes `qr/<page>.svg` and `qr/<page>.png` for each replay page (`room.html`, `navigation.html`, `moving.html` under the default site `https://papadopouloslefteris.github.io/phosphene-poster/`), with the highest error correction so a worn print still scans. Use the SVGs on the poster. Depends on `segno`.

## Documentation maintenance

Update this file when a script is added, removed or renamed, when its arguments change, or when the data format in `build_replay.py` changes.
