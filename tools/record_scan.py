"""One-off recorder for the next live scan: waits for a scan session to open,
listens on /ws/monitor/<scene> like the viewer's Monitor (pose, path line,
cloud changes) and writes every message with its arrival time to
<out_dir>/<scene>_monitor.bin, then exits when the session ends.
Nothing in the server changes; stopping this script removes all of it.

Record layout: float64 seconds since the session opened, uint8 kind
(0 text, 1 binary), uint32 length, payload.
"""
import asyncio, json, struct, sys, time, urllib.request
from pathlib import Path
import websockets

LIVE = "127.0.0.1:8765"
out_dir = Path(sys.argv[1])


def sessions():
    try:
        with urllib.request.urlopen(f"http://{LIVE}/sessions", timeout=2) as r:
            return json.load(r)
    except Exception:
        return None


async def main():
    print("waiting for a scan session", flush=True)
    while True:
        s = sessions()
        if s:
            break
        await asyncio.sleep(0.2)
    scene = s[0]["scene"]
    t0 = time.monotonic()
    path = out_dir / f"{scene}_monitor.bin"
    print(f"recording {scene} -> {path}", flush=True)
    counts = [0, 0]
    with open(path, "wb") as f:
        async with websockets.connect(f"ws://{LIVE}/ws/monitor/{scene}", max_size=None) as ws:
            async def watch():
                gone = None
                while True:
                    await asyncio.sleep(0.5)
                    s = sessions()
                    alive = bool(s) and any(x["scene"] == scene for x in s)
                    if alive:
                        gone = None
                    elif gone is None:
                        gone = time.monotonic()
                    elif time.monotonic() - gone > 3.0:
                        await ws.close()
                        return
            w = asyncio.create_task(watch())
            try:
                async for msg in ws:
                    kind = 1 if isinstance(msg, bytes) else 0
                    data = msg if kind else msg.encode()
                    f.write(struct.pack("<dBI", time.monotonic() - t0, kind, len(data)))
                    f.write(data)
                    counts[kind] += 1
            except websockets.ConnectionClosed:
                pass
            w.cancel()
    print(f"done: {counts[0]} text, {counts[1]} binary messages, {path.stat().st_size / 1e6:.1f} MB", flush=True)


asyncio.run(main())
