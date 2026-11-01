# Poster companion site

A small public website behind the QR code on the SLAMPhosphene poster ("From live 3D scans to real-time navigation cues in phosphene vision"). Visitors open it on their phone and replay three real recordings in 3D, turning the view and scrubbing through time. It is a plain static site so it can stay online for free on GitHub Pages for as long as the account exists, with no server of ours running.

## Architecture

| Part | Role |
|------|------|
| `index.html` | Landing page the QR code opens. Three scan pictures, each linking to its replay, no text. |
| `room.html` | Replay 1, how fast a whole room is scanned. |
| `navigation.html` | Replay 2, the scan with the walking line the server sent to the phone. |
| `moving.html` | Replay 3, pushing a chair while scanning, seen over the phone's shoulder with its camera photo as an inset. |
| `viewer.js` | The one full-screen 3D replay player all three pages share (three.js point cloud, phone marker, track, line, play button and time slider). |
| `style.css` | Shared look for phone and desktop. |
| `data/*.js` | One recording per page (`window.REPLAY`). Replacing a recording means replacing only this file. |
| `vendor/` | Pinned copy of three.js 0.165.0 and its OrbitControls, so the site never depends on a third-party link. |
| `img/` | Card pictures on the landing page, screenshots of each replay. |
| `tools/` | Recorder and builder that turn a new live scan into a `data/*.js` file. See `tools/README.md`. |
| `qr/` | The QR code for the poster, as SVG (for print) and PNG. |

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
 poster QR ──> index.html ──> room.html / navigation.html / moving.html ──> viewer.js
```

1. During a live scan, `tools/record_scan.py` listens to the same monitor stream the viewer's Monitor page uses and saves every message with its arrival time.
2. After the scan, `tools/build_replay.py` turns that file into one `data/<page>.js`, with the scan as 3 cm cells (each with the time spans it existed), the phone track, the path lines and, if the scan kept its frames, the camera photos.
3. Each page loads its data file, sets a few options in `window.PAGE` (clip start, line on or off, default camera) and runs `viewer.js`.
4. GitHub Pages serves the folder as it is. The QR code points at the landing page.

## Key choices

- No visible text anywhere, by the user's request. The pages show only the scans, with icon buttons (back, reset view, play or pause) and a time slider.
- Static files on GitHub Pages rather than a claude.ai artifact or our own server, because the link must keep working at every future poster session without anyone being logged in or anything running.
- A separate public repository, because the SLAMPhosphene code repository is private.
- The QR code points at the landing page only, so replays can be swapped or added later without reprinting the poster.
- three.js is copied into `vendor/` instead of loaded from a CDN, so a CDN change cannot break the page years later.
- Each recording lives in its own data file, so a final scan replaces a placeholder without touching any page code.

## Requirements

| Need | Version or note |
|------|-----------------|
| Visitor's browser | Any recent phone or desktop browser with WebGL and `DecompressionStream` (Safari 16.4 or newer, Chrome 80 or newer) |
| Hosting | GitHub Pages on a public repository |
| Building new data | Python 3 with numpy, plus opencv-python when photos are included |
| Recording | The SLAMPhosphene live server on 127.0.0.1:8765, and `websockets` for Python |
| QR code | `segno` for Python |

## Directory tree

```
phosphene-poster/
├── index.html, room.html, navigation.html, moving.html
├── viewer.js, style.css
├── data/      room.js, navigation.js, moving.js
├── img/       room.jpg, navigation.jpg, moving.jpg
├── qr/        poster-qr.svg, poster-qr.png
├── tools/     record_scan.py, build_replay.py, make_qr.py, README.md
└── vendor/    three.module.js, OrbitControls.js
```

## Current recordings

All three are placeholders taken from earlier test scans.

| Page | Placeholder source |
|------|--------------------|
| `room.html` | scannav, 29 Oct 2026 (the same recording as replay 2, with the line hidden) |
| `navigation.html` | scannav, 29 Oct 2026, 350 path lines |
| `moving.html` | handart2, 29 Oct 2026, the last 6 s, rebuilt after the scan with DepthART |

## Replacing a placeholder

1. Record the new scan with `tools/record_scan.py` (start it before the scan, see `tools/README.md`). Switch on "keep frames" in the app if the page should show camera photos.
2. Build the data file, for example `python tools/build_replay.py chair_monitor.bin data/moving.js --frames <scenes>/chair/00_live/frames`.
3. In the page, set `start` in `window.PAGE` to where the clip should begin.
4. Retake the card picture in `img/` (a screenshot of the replay, 4 by 3), then commit and push. The QR code stays the same.

## Documentation maintenance

- New or removed page, update the Architecture table, the tree and the cards in `index.html`.
- New option in `window.PAGE`, document it in the header comment of `viewer.js`.
- Data format change in `tools/build_replay.py`, update its docstring and `tools/README.md`.
- Placeholder replaced, update the Current recordings table.
- Site address change (repository renamed or moved), regenerate the QR code with `tools/make_qr.py` and reprint it.
