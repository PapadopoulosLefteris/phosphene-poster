"""Turn one recorded live scan into a replay data file for the site.

    python tools/build_replay.py <scene>_monitor.bin data/room.js [--frames <scene>/00_live/frames]

Input is the file tools/record_scan.py writes while the scan runs (every message of
the live server's /ws/monitor/<scene> stream with its arrival time). Output is
`window.REPLAY = {...};`, read by viewer.js:

  vox        cell size in metres (3 cm)
  floor_y    floor height (median of the path line points, or the lowest 2 % of the scan)
  cloud      {o: origin, n: number of on-intervals, gz: base64 gzip of
              int16 cell index xyz | uint8 rgb | uint16 on time | uint16 off time (tenths of s, 65535 = kept)}
  view       [x0, x1, z0, z1] floor rectangle of the finished scan
  frames     [t, x, z, yaw degrees, phone height y] per phone pose
  lines      [t, status, [[x, y, z], ...]] every path line the server sent (ok, blocked, no_floor)
  photos     [t, base64 jpeg] every 2nd camera photo, 240 x 320, only with --frames
  body_r     radius of the walker disc

A cell gets one on-interval for every stretch of time it had a surface, so things
that move (an arm, a pushed chair) appear and disappear. Stretches under 0.2 s are dropped.
"""
import argparse, base64, gzip, json, struct
from pathlib import Path

import numpy as np

V = 0.03


def read_messages(path):
    raw = Path(path).read_bytes()
    o, out = 0, []
    while o < len(raw):
        t, k, n = struct.unpack_from("<dBI", raw, o); o += 13
        out.append((t, k, raw[o:o + n])); o += n
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("monitor")
    ap.add_argument("out")
    ap.add_argument("--frames", help="folder of the scan's kept camera photos (<scene>/00_live/frames)")
    ap.add_argument("--rotate", type=int, default=90, help="clockwise rotation for the photos (0 or 90)")
    a = ap.parse_args()

    id_vox, cnt, on_since, col, iv = {}, {}, {}, {}, []
    poses, fid_t, paths = [], [], []
    for t, k, p in read_messages(a.monitor):
        if k == 0:
            m = json.loads(p)
            if m["type"] == "pose":
                M = np.array(m["pose_world"]["matrix"]).reshape(4, 4); f = -M[:3, 2]
                poses.append([t, M[0, 3], M[1, 3], M[2, 3], float(np.degrees(np.arctan2(-f[0], -f[2])))])
                if "frame_id" in m:
                    fid_t.append((m["frame_id"], t))
            elif m["type"] == "path":
                paths.append([t, m["status"], m["waypoints"]])
            continue
        na, nr, reset, layer = struct.unpack_from("<4I", p)
        if layer:
            continue
        touched = set()
        if reset:
            touched.update(id_vox.values()); id_vox.clear()
            for v in list(cnt):
                cnt[v] = 0
        ids = np.frombuffer(p, "<f8", na, 16).astype(np.int64)
        gone = np.frombuffer(p, "<f8", nr, 16 + 8 * na).astype(np.int64)
        q = 16 + 8 * (na + nr)
        xyz = np.frombuffer(p, "<f4", 3 * na, q).reshape(-1, 3)
        rgb = np.frombuffer(p, np.uint8, 3 * na, q + 12 * na).reshape(-1, 3)
        for g in gone.tolist():
            v = id_vox.pop(g, None)
            if v is not None:
                cnt[v] -= 1; touched.add(v)
        for i, key in enumerate(map(tuple, np.floor(xyz / V).astype(np.int64).tolist())):
            old = id_vox.get(int(ids[i]))
            if old is not None:
                cnt[old] -= 1; touched.add(old)
            id_vox[int(ids[i])] = key; cnt[key] = cnt.get(key, 0) + 1; col[key] = rgb[i]; touched.add(key)
        for v in touched:
            live = cnt.get(v, 0) > 0
            if live and v not in on_since:
                on_since[v] = t
            elif not live and v in on_since:
                iv.append((v, on_since.pop(v), t))
    if not poses:
        raise SystemExit("no phone poses in the recording")
    T0 = poses[0][0]
    iv += [(v, s, 1e9) for v, s in on_since.items()]
    iv = [x for x in iv if x[2] - x[1] >= 0.2]
    K = np.array([x[0] for x in iv], np.int64)
    ton = np.array([x[1] for x in iv]) - T0
    toff = np.array([x[2] for x in iv]) - T0
    C = np.array([col[x[0]] for x in iv], np.uint8)
    o3 = K.min(0); ki = (K - o3).astype(np.int16)
    tenth = lambda x: np.clip(np.round(np.maximum(x, 0) * 10), 0, 65534).astype(np.uint16)
    tonq = tenth(ton); toffq = np.where(toff > 1e8, 65535, tenth(toff)).astype(np.uint16)
    order = np.lexsort((ki[:, 0], ki[:, 2]))
    blob = b"".join([np.ascontiguousarray(ki[order]).tobytes(), C[order].tobytes(), tonq[order].tobytes(), toffq[order].tobytes()])
    gz = base64.b64encode(gzip.compress(blob, 9)).decode()

    fin = K[toff > 1e8] * V
    ys = [w[1] for _, _, wp in paths for w in wp]
    floor = float(np.median(ys)) if ys else float(np.percentile(fin[:, 1], 2))
    P = np.array(poses); P[:, 0] -= T0
    frames = [[round(r[0], 3), round(r[1], 3), round(r[3], 3), round(r[4], 1), round(r[2], 3)] for r in P.tolist()]
    lines = [[round(t - T0, 3), s, [[round(v, 3) for v in w] for w in wp]] for t, s, wp in paths]

    photos = []
    if a.frames and fid_t:
        import cv2
        fi = np.array(fid_t, float)
        for j in sorted(Path(a.frames).glob("*.jpg"))[::2]:
            t = float(np.interp(int(j.stem), fi[:, 0], fi[:, 1])) - T0
            im = cv2.resize(cv2.imread(str(j)), (320, 240), interpolation=cv2.INTER_AREA)
            if a.rotate == 90:
                im = cv2.rotate(im, cv2.ROTATE_90_CLOCKWISE)
            ok, b = cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 70])
            photos.append([round(t, 3), base64.b64encode(b.tobytes()).decode()])

    data = {"vox": V, "floor_y": round(floor, 3), "cloud": {"o": (o3 * V).tolist(), "n": int(len(K)), "gz": gz},
            "view": [float(fin[:, 0].min()), float(fin[:, 0].max() + V), float(fin[:, 2].min()), float(fin[:, 2].max() + V)],
            "frames": frames, "lines": lines, "photos": photos, "body_r": 0.1}
    Path(a.out).write_text("window.REPLAY=" + json.dumps(data, separators=(",", ":")) + ";", encoding="utf-8", newline="")
    print(f"{a.out}: {frames[-1][0]:.1f} s, {len(frames)} poses, {len(lines)} lines, {len(photos)} photos, "
          f"{len(K)} cell intervals ({int((toff > 1e8).sum())} kept), {Path(a.out).stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
