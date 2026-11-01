# Poster companion site

A small public website behind the three QR codes on the SLAMPhosphene poster ("From live 3D scans to real-time navigation cues in phosphene vision"). Visitors open it on their phone and replay three real recordings in 3D, turning the view and scrubbing through time. It is a plain static site so it can stay online for free on GitHub Pages for as long as the account exists, with no server of ours running.

## Architecture

| Part | Role |
|------|------|
| `index.html` | Overview page with the poster title, authors and one titled card per replay. |
| `room.html` | Replay 1, how fast a whole room is scanned, with the phone's camera photos alongside and a phosphene view under them (edges, objects, obstacles or floor, chosen with buttons). |
| `navigation.html` | Replay 2, the scan with the walking line the server sent to the phone, with camera photos and a phosphene view that adds the path. |
| `moving.html` | Replay 3, pushing a chair while scanning, seen over the phone's shoulder, with the phone's camera photos alongside. |
| `viewer.js` | The one 3D replay player all three pages share (three.js point cloud, phone marker, track, line, readouts, time controls). |
| `style.css` | Shared look, light and dark, phone and desktop layouts. |
| `data/*.js` | One recording per page (`window.REPLAY`). Replacing a recording means replacing only this file. |
| `data/phos/<recording>_<mode>.mp4` | Phosphene videos, one per mode, played in step with the replay. |
| `data/cam/<recording>.mp4` | Camera feed as a video, for recordings with too many frames to ship as photos (`PAGE.camVideo`). |
| `vendor/` | Pinned copy of three.js 0.165.0 and its OrbitControls, so the site never depends on a third-party link. |
| `img/` | Card pictures on the landing page, screenshots of each replay. |
| `tools/` | Recorder and builder that turn a new live scan into a `data/*.js` file. See `tools/README.md`. |
| `qr/` | One QR code per replay page (`room`, `navigation`, `moving`), as SVG (for print) and PNG. |

## Data flow

```
 phone ──stream──> live server (SLAMPhosphene) ──/ws/monitor/<scene>──> tools/record_scan.py
                                                                            │
                                                              <scene>_monitor.bin
                                                                            │
                     <scene>/00_live/frames (photos, optional) ──> tools/build_replay.py
                                                                            │
                                                                     data/<page>.js
                                                                            │
 <scene>_monitor.bin + finished scan ──> phosphene_replay.py (SLAMPhosphene, live container)
                                          ──> PNG sequences ──> tools/phosphene_videos.py ──> data/phos/*.mp4
                                                                            │
 poster QR codes ──> room.html / navigation.html / moving.html ──> viewer.js   (index.html links all three)
```

1. The scan runs with the server option "keep frames" (every frame, its pose and depth, and `timeline.jsonl`). Afterwards SLAMPhosphene's `services/live/tools/rebuild_monitor.py` feeds those frames through the server's own TSDF code, fusing the frames the scan fused, and plans the walking line on the scan's clock, writing a recording in the format below. `tools/record_scan.py` (listening to the monitor stream during the scan) gives the same file but made the server skip frames and the Monitor lag, so it is no longer used during scans.
2. After the scan, `tools/build_replay.py` turns that file into one `data/<page>.js`, with the scan as 3 cm cells (each with the time spans it existed), the phone track, the path lines and, if the scan kept its frames, the camera photos.
3. For the phosphene view, SLAMPhosphene's `services/live/tools/phosphene_replay.py` looks at the finished scan from the phone's pose 20 times a second, builds each mode's stimulus with the phosphene walk's own functions and steps the dynaphos simulator once per frame. `tools/phosphene_videos.py` turns those images into one video per mode.
4. Each page loads its data file, sets a few options in `window.PAGE` (clip start, line on or off, default camera, phosphene videos and modes) and runs `viewer.js`, which keeps the phosphene video on the replay's clock.
5. GitHub Pages serves the folder as it is. Each QR code opens its replay page directly.

## Key choices

- No explanatory paragraphs and no summary number tiles, by the user's request. Pages keep titles, the colour legend, the readouts beside the scan, the camera photo and the controls.
- Every page links its stylesheet, script and data with a `?v=` number. Raise it in all pages after changing `style.css`, `viewer.js`, a data file or a card picture, because GitHub Pages lets browsers keep old copies for 10 minutes and a new page with an old script shows nothing.
- Static files on GitHub Pages rather than a claude.ai artifact or our own server, because the link must keep working at every future poster session without anyone being logged in or anything running.
- A separate public repository, because the SLAMPhosphene code repository is private.
- One QR code per replay, each pointing at a fixed page address (`room.html`, `navigation.html`, `moving.html`), so recordings can be swapped later without reprinting the poster as long as those file names stay.
- three.js is copied into `vendor/` instead of loaded from a CDN, so a CDN change cannot break the page years later.
- Each recording lives in its own data file, so a final scan replaces a placeholder without touching any page code.
- Phosphene views are videos rather than images in the data file. At the simulator's 20 frames a second a 46 s recording is 930 frames per mode, about 1 to 2 MB as video against tens of MB as separate pictures.
- Phosphene views come from the finished scan, so parts not yet scanned at a moment can already light up. The path mode uses the line the phone really received at that moment.

## Requirements

| Need | Version or note |
|------|-----------------|
| Visitor's browser | Any recent phone or desktop browser with WebGL and `DecompressionStream` (Safari 16.4 or newer, Chrome 80 or newer) |
| Hosting | GitHub Pages on a public repository |
| Building new data | Python 3 with numpy, plus opencv-python when photos are included |
| Recording | The SLAMPhosphene live server on 127.0.0.1:8765, and `websockets` for Python |
| QR code | `segno` for Python |
| Phosphene views | The SLAMPhosphene live image (dynaphos, GPU) and ffmpeg |

## Directory tree

```
phosphene-poster/
├── index.html, room.html, navigation.html, moving.html
├── viewer.js, style.css
├── data/      room.js, navigation.js, moving.js
├── img/       room.jpg, navigation.jpg, moving.jpg
├── qr/        room, navigation, moving (.svg and .png)
├── tools/     record_scan.py, build_replay.py, make_qr.py, README.md
└── vendor/    three.module.js, OrbitControls.js
```

## Current recordings

All three are final recordings.

| Page | Placeholder source |
|------|--------------------|
| `room.html` | The navigation page's recording (scan nav) with the line hidden, camera video `data/cam/nav.mp4` and phosphene videos `data/phos/nav_*.mp4`. `data/room.js` is a copy of `data/navigation.js`. Scan a (1 Nov, internet link, laggy) was used before. |
| `navigation.html` | Final recording, scan nav, 1 Nov 2026, iPhone over the USB cable, 52.2 s, 2982 frames (about 57 a second). Rebuilt afterwards from the kept frames with `rebuild_monitor.py`, walking line replanned for a 20 cm wide person (469 lines). Camera feed as a 60 fps video `data/cam/nav.mp4`. |
| `moving.html` | Final recording, scan chair, 1 Nov 2026, iPhone over the USB cable, 12.2 s, the chair pushed across the room. All 387 camera frames that reached the server (about 32 a second). |

## Replacing a placeholder

1. Record the new scan with `tools/record_scan.py` (start it before the scan, see `tools/README.md`). Switch on "keep frames" in the app, otherwise the camera feed cannot play at the camera's real frame rate.
2. Build the data file, for example `python tools/build_replay.py chair_monitor.bin data/moving.js --frames <scenes>/chair/00_live/frames`.
3. In the page, set `start` in `window.PAGE` to where the clip should begin.
4. Make the phosphene videos, `phosphene_replay.py` in the live container then `python tools/phosphene_videos.py <out> <recording>`, and point `phos.src` in the page at them.
5. Retake the card picture in `img/` (a screenshot of the replay), raise the `?v=` number in every page, then commit and push. The QR codes stay the same.

## Documentation maintenance

- New or removed page, update the Architecture table, the tree and the cards in `index.html`.
- New option in `window.PAGE`, document it in the header comment of `viewer.js`.
- Data format change in `tools/build_replay.py`, update its docstring and `tools/README.md`.
- Placeholder replaced, update the Current recordings table.
- Site address or page file name change, regenerate the QR codes with `tools/make_qr.py` and reprint them.
