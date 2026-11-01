// Replay of one recorded scan, shared by room.html, navigation.html and moving.html.
// Each page loads its recording (window.REPLAY, written by tools/build_replay.py) and
// its settings (window.PAGE) before this module runs.
//
// PAGE: { start: seconds to begin the clip at (default 0),
//         line: draw the path line the server sent to the phone (default false),
//         autoplay: start playing once the scan is loaded and loop until paused (default true),
//         view: "fit" frames the whole finished scan from above (default), "phone" looks over the phone's shoulder at the clip start,
//         foot: optional (REPLAY, facts) => text for an element with id foot,
//         phos: optional { src: "data/phos/<recording>", modes: [[mode, button label], ...] }, phosphene videos
//               <src>_<mode>.mp4 (tools/phosphene_videos.py) shown in the #phos panel in step with the replay }
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const D = window.REPLAY, P = Object.assign({ start: 0, line: false, autoplay: true }, window.PAGE || {});
const F = D.frames, L = P.line ? (D.lines || []) : [], FY = D.floor_y, PH = D.photos || [];
const $ = id => document.getElementById(id);
const lastAtOrBefore = (arr, t) => { let lo = -1, hi = arr.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m][0] <= t) lo = m; else hi = m - 1; } return lo; };
const put = (id, text) => { const e = $(id); if (e) e.textContent = text; };
let pal = {};
const css = n => pal[n] ??= getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const T0 = Math.max(0, P.start), T1 = F[F.length - 1][0];
const dist = [0];
for (let i = 1; i < F.length; i++) dist.push(dist[i - 1] + Math.hypot(F[i][1] - F[i - 1][1], F[i][2] - F[i - 1][2]));
const [X0, X1, Z0, Z1] = D.view;
const COL = { person: "#ff2bd6", ok: "#39ff14", short: "#ff8a00", track: "#ffe600", edge: "#000000" };

if ($("cam") && !PH.length) $("cam").parentElement.hidden = true;
if (matchMedia("(pointer: coarse)").matches) put("hint", "Drag to turn, pinch to zoom, two fingers to move");

const cv = $("map");
THREE.ColorManagement.enabled = false;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
const controls = new OrbitControls(camera, cv);
controls.screenSpacePanning = true; controls.maxPolarAngle = Math.PI * 0.49;
// the box the default view frames: the floor rectangle until the scan is loaded, then the finished scan itself
let box = new THREE.Box3(new THREE.Vector3(X0, FY, Z0), new THREE.Vector3(X1, FY + 0.5, Z1));
function resetView() {
  if (P.view === "phone") {
    const f = F[Math.max(0, lastAtOrBefore(F, T0))], a = f[3] * Math.PI / 180, fx = -Math.sin(a), fz = -Math.cos(a);
    controls.target.set(f[1] + fx * 1.8, FY + 0.3, f[2] + fz * 1.8);
    camera.position.set(f[1] - fx * 2.4, f[4] + 2.2, f[2] - fz * 2.4);
  } else {
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
    const half = Math.min(camera.fov / 2, THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)));
    const d = r / Math.sin(THREE.MathUtils.degToRad(half));
    controls.target.copy(c);
    camera.position.copy(c).add(new THREE.Vector3(0, 0.8, 0.6).multiplyScalar(d));
  }
  controls.update(); render();
}
function size() {
  const w = cv.parentElement.clientWidth || 760, h = Math.round(Math.max(300, Math.min(w * 0.8, 720)));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
  cv.style.height = h + "px";
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// the scan: per 3 cm cell its index, colour, and the tenths of a second it appeared and was erased (65535 = kept)
const uT = { value: 0 }, uAll = { value: 0 };
let tOn = null, tOff = null;
async function loadCloud() {
  const C = D.cloud, n = C.n, bin = Uint8Array.from(atob(C.gz), ch => ch.charCodeAt(0));
  const b = new Uint8Array(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  const ki = new Int16Array(b.slice(0, 6 * n).buffer), rgb = b.slice(6 * n, 9 * n);
  const on = new Uint16Array(b.slice(9 * n, 11 * n).buffer), off = new Uint16Array(b.slice(11 * n, 13 * n).buffer);
  const pos = new Float32Array(3 * n), v = D.vox;
  tOn = new Float32Array(n); tOff = new Float32Array(n);
  const footprint = new Set(), keptXYZ = [[], [], []];
  let kept = 0;
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) pos[3 * i + a] = C.o[a] + (ki[3 * i + a] + 0.5) * v;
    tOn[i] = on[i] / 10; tOff[i] = off[i] === 65535 ? 1e9 : off[i] / 10;
    if (off[i] === 65535) { kept++; footprint.add(ki[3 * i] * 65536 + ki[3 * i + 2]); for (let a = 0; a < 3; a++) keptXYZ[a].push(pos[3 * i + a]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(rgb, 3, true));
  g.setAttribute("tOn", new THREE.BufferAttribute(tOn, 1));
  g.setAttribute("tOff", new THREE.BufferAttribute(tOff, 1));
  const mat = new THREE.PointsMaterial({ size: 0.045, sizeAttenuation: true, vertexColors: true });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = uT; sh.uniforms.uAll = uAll;
    sh.vertexShader = "attribute float tOn; attribute float tOff; uniform float uT; uniform float uAll; varying float vFaint;\n" +
      sh.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
        bool live = uT >= tOn && uT < tOff;
        vFaint = live ? 0.0 : 1.0;
        if (!live && (uAll < 0.5 || tOff < 1e8)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`);
    sh.fragmentShader = "varying float vFaint;\n" +
      sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55), vFaint * 0.75);");
  };
  scene.add(new THREE.Points(g, mat));
  if (kept) {   // frame the middle 98 % of the finished scan on each axis, so stray far-away dots do not shrink it
    const lim = keptXYZ.map(c => { const s = Float32Array.from(c).sort(); return [s[Math.floor(s.length * 0.01)], s[Math.floor(s.length * 0.99)]]; });
    box = new THREE.Box3(new THREE.Vector3(lim[0][0], lim[1][0], lim[2][0]), new THREE.Vector3(lim[0][1], lim[1][1], lim[2][1]));
  }
  return { kept, area: footprint.size * v * v };
}

// a flat strip `w` wide over the floor through [x, y, z] points, with round joints
const DISC = 10, PER_SEG = 6 + DISC * 3;
function strip(pts, w, lift) {
  const out = new Float32Array(Math.max(0, pts.length - 1) * PER_SEG * 3);
  let k = 0; const h = w / 2;
  const add = (x, y, z) => { out[k++] = x; out[k++] = y + lift; out[k++] = z; };
  const disc = (x, y, z) => { for (let d = 0; d < DISC; d++) { const a0 = d / DISC * 2 * Math.PI, a1 = (d + 1) / DISC * 2 * Math.PI;
    add(x, y, z); add(x + h * Math.cos(a1), y, z + h * Math.sin(a1)); add(x + h * Math.cos(a0), y, z + h * Math.sin(a0)); } };
  for (let j = 0; j + 1 < pts.length; j++) {
    const [ax, ay, az] = pts[j], [bx, by, bz] = pts[j + 1], len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len * h, nz = (bx - ax) / len * h;
    add(ax + nx, ay, az + nz); add(ax - nx, ay, az - nz); add(bx + nx, by, bz + nz);
    add(bx + nx, by, bz + nz); add(ax - nx, ay, az - nz); add(bx - nx, by, bz - nz);
    disc(bx, by, bz);
  }
  return out;
}
const flat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthTest: false });
const onTop = (mesh, order) => { mesh.renderOrder = order; scene.add(mesh); return mesh; };
const edgeMat = flat(COL.edge);

const trackPts = F.map(f => [f[1], FY, f[2]]);
const trackGeom = new THREE.BufferGeometry(), trackEdge = new THREE.BufferGeometry();
trackGeom.setAttribute("position", new THREE.BufferAttribute(strip(trackPts, 0.06, 0.05), 3));
trackEdge.setAttribute("position", new THREE.BufferAttribute(strip(trackPts, 0.11, 0.05), 3));
onTop(new THREE.Mesh(trackEdge, edgeMat), 4);
onTop(new THREE.Mesh(trackGeom, flat(COL.track)), 6);

const lineGeom = new THREE.BufferGeometry(), lineEdge = new THREE.BufferGeometry(), lineMat = flat(COL.ok);
onTop(new THREE.Mesh(lineEdge, edgeMat), 3);
onTop(new THREE.Mesh(lineGeom, lineMat), 5);
let lineIdx = -2;

const walker = new THREE.Group(); scene.add(walker);
walker.visible = P.view !== "phone";             // over the shoulder the camera is the phone, the marker would only block the view
const onFloor = geo => geo.rotateX(-Math.PI / 2);
const bodyMat = flat(COL.person), rimMat = flat("#ffffff"), fanMat = flat(COL.person, 0.3);
const part = (geo, mat, order) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; walker.add(m); return m; };
part(onFloor(new THREE.CircleGeometry(1.6, 24, Math.PI / 2 - Math.PI / 6, Math.PI / 3)), fanMat, 7);
part(onFloor(new THREE.RingGeometry(D.body_r + 0.02, D.body_r + 0.045, 32)), edgeMat, 8);
part(onFloor(new THREE.RingGeometry(D.body_r, D.body_r + 0.02, 32)), rimMat, 9);
part(onFloor(new THREE.CircleGeometry(D.body_r, 32)), bodyMat, 9);
const pole = part(new THREE.CylinderGeometry(0.05, 0.05, 1, 10), edgeMat, 10);
const poleIn = part(new THREE.CylinderGeometry(0.03, 0.03, 1, 10), bodyMat, 11);
const head = part(new THREE.SphereGeometry(0.12, 16, 12), edgeMat, 10);
const headIn = part(new THREE.SphereGeometry(0.09, 16, 12), bodyMat, 11);

function render() { renderer.render(scene, camera); }
let pending = false;
controls.addEventListener("change", () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; render(); }); } });
$("view-reset").addEventListener("click", () => { $("follow").checked = false; resetView(); });

const lenOf = w => { let s = 0; for (let j = 1; j < w.length; j++) s += Math.hypot(w[j][0] - w[j - 1][0], w[j][2] - w[j - 1][2]); return s; };

let cur = T0, playing = false, last = 0, prevW = null, camIdx = -1;
function show(t) {
  cur = Math.max(T0, Math.min(T1, t));
  uT.value = cur;
  const i = Math.max(0, lastAtOrBefore(F, cur)), f = F[i];
  trackGeom.setDrawRange(0, i * PER_SEG); trackEdge.setDrawRange(0, i * PER_SEG);
  const n = F[Math.min(i + 1, F.length - 1)], u = n[0] > f[0] ? Math.max(0, Math.min(1, (cur - f[0]) / (n[0] - f[0]))) : 0;
  const turn = ((n[3] - f[3] + 540) % 360) - 180;
  const wx = f[1] + u * (n[1] - f[1]), wz = f[2] + u * (n[2] - f[2]), wy = f[4] + u * (n[4] - f[4]);
  const h = Math.max(0.3, wy - FY);
  walker.position.set(wx, FY + 0.06, wz);
  walker.rotation.y = (f[3] + u * turn) * Math.PI / 180;
  for (const p of [pole, poleIn]) { p.scale.y = h; p.position.y = h / 2; }
  for (const p of [head, headIn]) p.position.y = h;
  const li = lastAtOrBefore(L, cur), ln = li >= 0 ? L[li] : null;
  if (li !== lineIdx) {
    lineIdx = li;
    const w = ln && ln[1] !== "no_floor" ? ln[2] : [];
    lineGeom.setAttribute("position", new THREE.BufferAttribute(strip(w, 2 * D.body_r, 0.03), 3));
    lineEdge.setAttribute("position", new THREE.BufferAttribute(strip(w, 2 * D.body_r + 0.06, 0.03), 3));
    lineGeom.computeBoundingSphere(); lineEdge.computeBoundingSphere();
    lineMat.color.set(ln && ln[1] === "ok" ? COL.ok : COL.short);
  }
  if ($("follow").checked) {
    if (!prevW) { controls.target.set(wx, FY, wz); camera.position.set(wx, FY + 4.5, wz + 3); }
    else { const off = new THREE.Vector3(wx - prevW.x, 0, wz - prevW.z); controls.target.add(off); camera.position.add(off); }
    controls.update();
  }
  prevW = $("follow").checked ? { x: wx, z: wz } : null;
  render();
  put("r-t", (cur - T0).toFixed(1) + " s");
  if (tOn) { let c = 0; for (let k = 0; k < tOn.length; k++) if (cur >= tOn[k] && cur < tOff[k]) c++; put("r-n", c.toLocaleString("en") + " dots"); }
  put("r-d", (dist[i] - dist[Math.max(0, lastAtOrBefore(F, T0))]).toFixed(1) + " m");
  put("r-h", (wy - FY).toFixed(2) + " m");
  const s = $("r-s");
  if (s) {
    if (!ln) { s.textContent = "none yet"; s.className = "state-off"; put("r-l", "-"); }
    else {
      s.textContent = { ok: "clear ahead", blocked: "cut short", no_floor: "no floor in view" }[ln[1]] || ln[1];
      s.className = ln[1] === "ok" ? "state-ok" : ln[1] === "blocked" ? "state-warn" : "state-off";
      put("r-l", ln[1] === "no_floor" ? "-" : lenOf(ln[2]).toFixed(2) + " m");
    }
  }
  if (PH.length && $("cam")) {
    const k = Math.max(0, lastAtOrBefore(PH, cur));
    if (k !== camIdx) { camIdx = k; $("cam").src = "data:image/jpeg;base64," + PH[k][1]; }
  }
  put("clock", `${(cur - T0).toFixed(1)} / ${(T1 - T0).toFixed(1)} s`);
  syncPhos();
  $("scrub").value = Math.round((cur - T0) / (T1 - T0) * 1000);
}

// phosphene view: one video per mode, frame k at k / fps s of the recording; kept in step with the replay clock
const PV = $("phos");
if (PV && !P.phos) PV.closest(".phos").hidden = true;
if (PV && P.phos) {
  const box = $("phos-modes");
  P.phos.modes.forEach(([mode, label], i) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.mode = mode;
    b.addEventListener("click", () => setMode(mode));
    box.appendChild(b);
  });
  setMode(P.phos.modes[0][0]);
}
function setMode(mode) {
  for (const b of $("phos-modes").children) b.setAttribute("aria-pressed", b.dataset.mode === mode);
  PV.src = `${P.phos.src}_${mode}.mp4?v=${P.phos.v || 1}`;
  PV.addEventListener("loadedmetadata", () => { PV.currentTime = cur; syncPhos(); }, { once: true });
}
function syncPhos() {
  if (!PV || !P.phos || PV.readyState < 1) return;
  const want = Math.min(cur, PV.duration || cur);
  if (playing) {
    PV.playbackRate = +$("rate").value;
    if (PV.paused) PV.play().catch(() => {});
    if (Math.abs(PV.currentTime - want) > 0.25) PV.currentTime = want;
  } else {
    if (!PV.paused) PV.pause();
    if (Math.abs(PV.currentTime - want) > 0.03) PV.currentTime = want;
  }
}
function loop(now) {
  if (!playing) return;
  const dt = last ? (now - last) / 1000 : 0; last = now;
  const next = cur + dt * +$("rate").value;
  show(next > T1 ? T0 + (next - T1) : next);          // loops back to the start, so the replay runs on its own
  requestAnimationFrame(loop);
}
function play() {
  if (cur >= T1) cur = T0;
  playing = true; last = 0; put("play", "Pause"); requestAnimationFrame(loop);
}
$("play").addEventListener("click", () => { if (playing) { playing = false; put("play", "Play"); syncPhos(); } else play(); });
$("scrub").addEventListener("input", e => { playing = false; put("play", "Play"); show(T0 + (T1 - T0) * e.target.value / 1000); });
$("follow").addEventListener("change", () => { prevW = null; show(cur); });
$("final").addEventListener("change", e => { uAll.value = e.target.checked ? 1 : 0; render(); });

// marks over the timeline where the line started being cut short
const tk = $("ticks"); let wasShort = false;
if (tk) L.forEach(l => { const sh = l[1] !== "ok"; if (sh && !wasShort && l[0] >= T0) { const m = document.createElement("i"); m.style.left = ((l[0] - T0) / (T1 - T0) * 100) + "%"; tk.appendChild(m); } wasShort = sh; });

scene.background = new THREE.Color(css("--panel"));
size(); resetView(); show(T0);
let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { size(); show(cur); }, 120); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { pal = {}; scene.background = new THREE.Color(css("--panel")); render(); });

loadCloud().then(facts => {
  $("loading").hidden = true;
  if (!$("follow").checked) resetView();
  put("st-time", (T1 - T0).toFixed(0) + " s");
  put("st-area", facts.area.toFixed(0) + " m²");
  put("st-dots", facts.kept.toLocaleString("en"));
  put("st-walk", (dist[dist.length - 1] - dist[Math.max(0, lastAtOrBefore(F, T0))]).toFixed(1) + " m");
  if (P.foot) put("foot", P.foot(D, { frames: F.length, lines: L.length, photos: PH.filter(p => p[0] >= T0).length, seconds: T1 - T0, ...facts }));
  show(cur);
  if (P.autoplay && !matchMedia("(prefers-reduced-motion: reduce)").matches) play();
}).catch(err => { put("loading", "This browser could not open the scan (" + err.message + ")"); });
