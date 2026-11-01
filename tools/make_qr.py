"""Make the poster's QR code for the site's landing page.

    python tools/make_qr.py [url]

Writes qr/poster-qr.svg (for print, scales without blur) and qr/poster-qr.png.
Error correction is high (H) so a scuffed or partly covered print still scans.
"""
import sys
from pathlib import Path

import segno

URL = sys.argv[1] if len(sys.argv) > 1 else "https://papadopouloslefteris.github.io/phosphene-poster/"
out = Path(__file__).resolve().parent.parent / "qr"
out.mkdir(exist_ok=True)
q = segno.make(URL, error="h")
q.save(out / "poster-qr.svg", scale=10, border=4, dark="#000000", light="#ffffff")
q.save(out / "poster-qr.png", scale=20, border=4, dark="#000000", light="#ffffff")
print(URL, "version", q.version, "error", q.error)
