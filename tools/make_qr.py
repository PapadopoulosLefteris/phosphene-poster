"""Make the poster's QR codes, one per replay page.

    python tools/make_qr.py [site_url]

Writes qr/<page>.svg (for print, scales without blur) and qr/<page>.png for
room, navigation and moving. Error correction is high (H) so a scuffed or partly
covered print still scans.
"""
import sys
from pathlib import Path

import segno

SITE = sys.argv[1] if len(sys.argv) > 1 else "https://papadopouloslefteris.github.io/phosphene-poster/"
PAGES = ["room", "navigation", "moving"]
out = Path(__file__).resolve().parent.parent / "qr"
out.mkdir(exist_ok=True)
for page in PAGES:
    url = SITE + page + ".html"
    q = segno.make(url, error="h")
    q.save(out / f"{page}.svg", scale=10, border=4, dark="#000000", light="#ffffff")
    q.save(out / f"{page}.png", scale=20, border=4, dark="#000000", light="#ffffff")
    print(url, "version", q.version, "error", q.error)
