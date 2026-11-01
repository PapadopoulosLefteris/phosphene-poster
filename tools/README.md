# tools

Scripts that turn a live SLAMPhosphene scan into a replay data file for the site, and make the poster's QR codes. They run on the scanning computer, never on the website.

## record_scan.py

Records one live scan for later replay. Start it before the scan.

`python tools/record_scan.py <out_dir>`

Waits until a scan session opens on the live server (`127.0.0.1:8765`, the `LIVE` constant), then saves every message of `/ws/monitor/<scene>` (phone pose, path line, cloud changes) with its arrival time to `<out_dir>/<scene>_monitor.bin`. Stops by itself 3 s after the session ends. Changes nothing on the server. Depends on `websockets`.

File layout per message is float64 seconds since the session opened, uint8 kind (0 text, 1 binary), uint32 length, then the payload.

## build_replay.py

`python tools/build_replay.py <scene>_monitor.bin data/<page>.js [--frames <scene>/00_live/frames] [--rotate 0|90]`

Replays the recorded messages to rebuild the scan as 3 cm cells, giving each cell one time span for every stretch it had a surface (so moving things appear and vanish), and writes `window.REPLAY` for `viewer.js`. The path lines come straight from the recording, so they are exactly what the phone received. With `--frames` it adds every second camera photo, timed by the frame numbers the poses carried. The live server only saves those photos when the scan ran with "keep frames" on. `--rotate 90` (default) turns the landscape photos upright. The data format is in the script's docstring. Depends on numpy, and on opencv-python with `--frames`.

Checked on 2026-11-01 against the scannav recording, it gives the same 1731 poses, 350 lines and 63,791 kept cells as the placeholder data.

## make_qr.py

`python tools/make_qr.py [url]`

Writes `qr/<page>.svg` and `qr/<page>.png` for each replay page (`room.html`, `navigation.html`, `moving.html` under the default site `https://papadopouloslefteris.github.io/phosphene-poster/`), with the highest error correction so a worn print still scans. Use the SVGs on the poster. Depends on `segno`.

## Documentation maintenance

Update this file when a script is added, removed or renamed, when its arguments change, or when the data format in `build_replay.py` changes.
