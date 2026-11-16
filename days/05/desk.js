// Day 5: a 3D office desk full of things to slack with. Click the monitor to clock in to MöleMe.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { openOS, onOSClose, setOSClue } from './moleme.js';
import { BOOKS, MANUAL, openBook, setBookClue } from './books.js';
import { found, showRiddle, showLock, showCertificate, onChange, has, isSolved, solvedToast } from './puzzle.js';
setOSClue(found); setBookClue(found);

const $ = id => document.getElementById(id);
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------------- renderer, camera, lights ---------------- */
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1712);
const camera = new THREE.PerspectiveCamera(38, 1, 0.03, 50);
const HOME_WIDE = new THREE.Vector3(-1.6, 1.6, 2.3), HOME_NARROW = new THREE.Vector3(-2.3, 2.3, 3.4);
const HOME = { pos: (innerWidth / innerHeight < 0.8 ? HOME_NARROW : HOME_WIDE).clone(), target: new THREE.Vector3(0.1, 0.72, 0.0) };
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 1.1, maxDistance: 5.2, minPolarAngle: 0.35, maxPolarAngle: 1.42 });
controls.update();

// warm office light inside, cool blue hour coming through the window
scene.add(new THREE.HemisphereLight(0xffe2c0, 0x2a2230, 0.55));
const sun = new THREE.DirectionalLight(0xffd2a0, 1.35);   // warm ceiling light, front right
sun.position.set(1.8, 3.6, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 10 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun);
const windowLight = new THREE.DirectionalLight(0x6f8fe0, 0.9); windowLight.position.set(0.3, 2.2, -3); scene.add(windowLight);

/* ---------------- helpers ---------------- */
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const B = (w, h, d, r = 0.004) => r ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)) : new THREE.BoxGeometry(w, h, d);
const std = (color, rough = 0.7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function group(x = 0, y = 0, z = 0, parent = scene) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// clickable things: each has a label for the tooltip and an action
const hot = [];
function hotspot(obj, label, action) { obj.userData.hot = { label, action }; hot.push(obj); return obj; }

// tiny tween runner
const tweens = [];
function tween(d, update, done) { tweens.push({ t: 0, d, update, done }); }
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/* ---------------- sound (synthesised, no files) ---------------- */
let actx = null, muted = false;
function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return actx; }
function tone(freq, dur, { type = 'sine', gain = 0.2, slide } = {}) {
  const a = ac(); if (!a || muted) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { freq = 1000, q = 1, gain = 0.3, sweep } = {}) {
  const a = ac(); if (!a || muted) return;
  const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
  s.buffer = buf; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  g.gain.value = gain; s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
}
const SFX = {
  pop() { noise(0.05, { freq: 2400, q: 1.4, gain: 0.7 }); tone(1100, 0.04, { type: 'triangle', gain: 0.08 }); },
  click() { tone(rnd(1600, 2200), 0.025, { type: 'square', gain: 0.04 }); },
  whoosh() { noise(0.7, { freq: 500, q: 0.6, gain: 0.35, sweep: 2600 }); },
  tissue() { noise(0.35, { freq: 2600, q: 0.5, gain: 0.25, sweep: 6000 }); },
  drawer() { noise(0.3, { freq: 260, q: 0.8, gain: 0.45 }); tone(140, 0.12, { gain: 0.1 }); },
  sip() { noise(0.35, { freq: 480, q: 4, gain: 0.3 }); },
  water() { [0, 90, 170].forEach(dl => setTimeout(() => tone(rnd(500, 900), 0.08, { gain: 0.08, slide: 1400 }), dl)); },
  shimmer() { [1568, 2093, 2637, 3136].forEach((f, i) => setTimeout(() => tone(f, 0.45, { gain: 0.06 }), i * 70)); },
  thud() { tone(180, 0.15, { gain: 0.25, slide: 90 }); },
  munch() { [0, 110, 220].forEach(d => setTimeout(() => noise(0.07, { freq: rnd(900, 1600), q: 0.9, gain: 0.45 }), d)); },
  clop() { [0, 160].forEach(d => setTimeout(() => tone(rnd(700, 900), 0.06, { type: 'triangle', gain: 0.12, slide: 400 }), d)); },
  match() { noise(0.25, { freq: 3000, q: 0.7, gain: 0.3, sweep: 900 }); setTimeout(() => tone(220, 0.4, { gain: 0.04 }), 120); },
  cardboard() { noise(0.4, { freq: 380, q: 0.6, gain: 0.4, sweep: 900 }); },
};

/* ---------------- HUD: tooltip, toast, stats ---------------- */
const stats = { tissues: 0, bubbles: 0, spins: 0, shakes: 0, sips: 0, buns: 0 };
let onClock = 0;
function renderStats() {
  const m = Math.floor(onClock / 60), s = Math.floor(onClock % 60);
  $('stats').innerHTML = `<b>Desk report</b>
    <span>🧻 Tissues pulled <i>${stats.tissues}</i></span><span>🫧 Bubbles popped <i>${stats.bubbles}</i></span>
    <span>🪑 Chair spins <i>${stats.spins}</i></span><span>❄️ Globe shakes <i>${stats.shakes}</i></span><span>🌀 Buns eaten <i>${stats.buns}</i></span><span class="fk">🔎 Secret code <i>${isSolved() ? 'cracked ✓' : `${['F', 'I', 'K', 'A'].filter(has).length}/4`}</i></span>
    <span>⏱ Paid minutes here <i>${m}:${String(s).padStart(2, '0')}</i></span>`;
}
function bump(k) { stats[k]++; renderStats(); }
onChange(() => { if ($('stats')) renderStats(); });
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600);
}
$('mute').addEventListener('click', () => { muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; $('mute').setAttribute('aria-pressed', muted); });

/* ---------------- the room: floor, rug, window wall, blue hour outside ---------------- */
const floorTex = canvasTex(1024, 1024, (x, w, h) => {
  const pw = 128; x.fillStyle = '#5a3a24'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < w / pw; i++) for (let j = -1; j < 4; j++) {
    const off = (i % 2) * 128, y0 = j * 256 + off, l = 30 + Math.random() * 8;
    x.fillStyle = `hsl(26,${30 + Math.random() * 8}%,${l}%)`; x.fillRect(i * pw, y0, pw, 256);
    for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(40,20,8,${Math.random() * 0.12})`; x.fillRect(i * pw + Math.random() * pw, y0, 1 + Math.random() * 2, 256); }
    x.fillStyle = 'rgba(20,10,4,0.5)'; x.fillRect(i * pw, y0, 2, 256); x.fillRect(i * pw, y0, pw, 2);
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 2.4);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }));
floor.rotation.x = -Math.PI / 2; floor.position.z = 2.05; floor.receiveShadow = true; scene.add(floor);
const rugTex = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#e9dfcf'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#b5121b'; x.lineWidth = 10; x.strokeRect(24, 24, w - 48, h - 48); x.lineWidth = 4; x.strokeRect(46, 46, w - 92, h - 92);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(120,90,60,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
});
const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
rug.rotation.x = -Math.PI / 2; rug.position.set(0.15, 0.003, 0.45); rug.receiveShadow = true; scene.add(rug);

// window wall behind the desk
const WALLZ = -0.95, SILL = 0.98, HEAD = 2.75, WX = 1.55;
const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9cfc2, roughness: 0.95 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0xf6f1e8, roughness: 0.5 });
const wallBox = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), wallMat); m.position.set(x, y, WALLZ - 0.07); m.receiveShadow = true; scene.add(m); };
wallBox(9, SILL, 0, SILL / 2); wallBox(9, 3.6 - HEAD, 0, (HEAD + 3.6) / 2);
wallBox(4.5 - WX, HEAD - SILL, -(WX + 4.5) / 2, (SILL + HEAD) / 2); wallBox(4.5 - WX, HEAD - SILL, (WX + 4.5) / 2, (SILL + HEAD) / 2);
{ const side = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.6, 6), wallMat); side.position.set(2.6, 1.8, 2.0); side.receiveShadow = true; scene.add(side); }
const sill = new THREE.Mesh(new THREE.BoxGeometry(2 * WX + 0.1, 0.035, 0.26), frameMat); sill.position.set(0, SILL, WALLZ + 0.02); sill.castShadow = sill.receiveShadow = true; scene.add(sill);
const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), frameMat); m.position.set(x, y, WALLZ - 0.06); m.castShadow = true; scene.add(m); };
[-WX, -WX / 3, WX / 3, WX].forEach(x => bar(0.06, HEAD - SILL, x, (SILL + HEAD) / 2));
bar(2 * WX, 0.06, 0, HEAD); bar(2 * WX, 0.05, 0, SILL + 1.15);
const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(2 * WX, HEAD - SILL), new THREE.MeshPhysicalMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.06, roughness: 0.05, depthWrite: false }));
winGlass.position.set(0, (SILL + HEAD) / 2, WALLZ - 0.07); scene.add(winGlass);

// outside: blue hour over a snowy city, with lit windows
const skyTex = canvasTex(2048, 1024, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#08102b'); g.addColorStop(0.3, '#15265c'); g.addColorStop(0.55, '#2c4a99'); g.addColorStop(0.7, '#5a73c0'); g.addColorStop(0.78, '#a58fc0'); g.addColorStop(0.82, '#e3a3a0'); g.addColorStop(0.86, '#27325f'); g.addColorStop(1, '#121a36');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; x.fillRect(Math.random() * w, Math.random() * h * 0.35, 2, 2); }
  const horizon = h * 0.84;
  const skyline = (base, col, hMin, hMax, lit) => {
    let X = 0;
    while (X < w) {
      const bw = 50 + Math.random() * 120, bh = hMin + Math.random() * (hMax - hMin);
      x.fillStyle = col; x.fillRect(X, base - bh, bw, bh + 200);
      if (Math.random() < 0.25) { x.beginPath(); x.moveTo(X, base - bh); x.lineTo(X + bw / 2, base - bh - 40 - Math.random() * 40); x.lineTo(X + bw, base - bh); x.fill(); }
      if (lit) for (let yy = base - bh + 14; yy < base - 10; yy += 22) for (let xx = X + 10; xx < X + bw - 12; xx += 20) if (Math.random() < 0.38) {
        x.fillStyle = Math.random() < 0.85 ? `rgba(255,${190 + Math.random() * 40 | 0},${110 + Math.random() * 40 | 0},${0.6 + Math.random() * 0.4})` : 'rgba(255,240,200,0.95)'; x.fillRect(xx, yy, 9, 12);
      }
      X += bw + Math.random() * 8;
    }
  };
  skyline(horizon, '#36407a', 30, 90, false);
  // a church spire, very Stockholm
  x.fillStyle = '#1d2448'; x.fillRect(1180, horizon - 170, 50, 170); x.beginPath(); x.moveTo(1175, horizon - 170); x.lineTo(1205, horizon - 320); x.lineTo(1235, horizon - 170); x.fill();
  skyline(horizon + 20, '#1a2042', 50, 140, true);
  x.fillStyle = '#e8eefc'; x.fillRect(0, horizon + 18, w, 4);
  // rooftop snow
  x.fillStyle = 'rgba(230,238,255,0.5)'; for (let i = 0; i < 70; i++) x.fillRect(Math.random() * w, horizon - 30 - Math.random() * 110, 30 + Math.random() * 60, 3);
});
const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false }));
sky.position.set(0, 2.6, -6); scene.add(sky);
const SNOW = 700, sPos = new Float32Array(SNOW * 3);
for (let i = 0; i < SNOW; i++) { sPos[i * 3] = rnd(-3.5, 3.5); sPos[i * 3 + 1] = rnd(0, 4.5); sPos[i * 3 + 2] = rnd(-5.5, -1.2); }
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.85, depthWrite: false }));
snow.raycast = () => {}; scene.add(snow);
function stepSnow(dt, now) {
  for (let i = 0; i < SNOW; i++) { const j = i * 3; sPos[j + 1] -= dt * (0.25 + (i % 5) * 0.05); sPos[j] += Math.sin(now * 0.6 + i) * dt * 0.06; if (sPos[j + 1] < 0) sPos[j + 1] += 4.5; }
  snowGeo.attributes.position.needsUpdate = true;
}

// a Swedish paper star lamp (adventsstjärna) hanging in the window
const starShape = new THREE.Shape();
for (let i = 0; i < 16; i++) { const r = i % 2 ? 0.07 : 0.16, a = Math.PI / 2 + i * Math.PI / 8; const px = Math.cos(a) * r, py = Math.sin(a) * r; i ? starShape.lineTo(px, py) : starShape.moveTo(px, py); }
const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.01, bevelSegments: 1 }); starGeo.translate(0, 0, -0.025);
const starLamp = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: 0xb5121b, emissive: 0xe0301a, emissiveIntensity: 1.4, roughness: 0.8 }));
starLamp.position.set(-0.55, 2.05, WALLZ + 0.08); scene.add(starLamp);
const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, HEAD - 2.21), new THREE.MeshBasicMaterial({ color: 0x222222 }));
cord.position.set(-0.55, (HEAD + 2.21) / 2, WALLZ + 0.08); scene.add(cord);
const starLight = new THREE.PointLight(0xff9a5a, 1.2, 3.2, 1.6); starLight.position.set(-0.55, 2.0, WALLZ + 0.25); scene.add(starLight);

// floor lamp, back left: the warm pool of light
const lampG = new THREE.Group(); lampG.position.set(-1.25, 0, -0.55); scene.add(lampG);
const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.35, metalness: 0.8 });
const lampPart = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; lampG.add(m); return m; };
lampPart(new THREE.CylinderGeometry(0.14, 0.15, 0.03, 32), brass, 0.015);
lampPart(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 12), brass, 0.74);
const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf3e2c2, emissive: 0xffb76b, emissiveIntensity: 1.6, side: THREE.DoubleSide, roughness: 0.9 });
const shade = lampPart(new THREE.CylinderGeometry(0.15, 0.24, 0.3, 32, 1, true), shadeMat, 1.52); shade.castShadow = false;
const screenGlow = new THREE.PointLight(0x5fd0d0, 0.22, 1.1, 2); screenGlow.position.set(0.05, 1.0, 0.18); scene.add(screenGlow);
const lampLight = new THREE.PointLight(0xffb070, 1.6, 3.6, 1.6); lampLight.position.set(-1.25, 1.45, -0.55); scene.add(lampLight);

/* ---------------- materials ---------------- */
const woodTex = canvasTex(1024, 512, (x, w, h) => {
  x.fillStyle = '#dcc6a0'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 240; i++) {
    const y = Math.random() * h;
    x.strokeStyle = `rgba(${150 + (Math.random() * 40 | 0)},${112 + (Math.random() * 30 | 0)},${70 + (Math.random() * 20 | 0)},${0.04 + Math.random() * 0.1})`;
    x.lineWidth = 0.5 + Math.random() * 2.5; x.beginPath(); x.moveTo(0, y);
    for (let X = 0; X <= w; X += 64) x.lineTo(X, y + Math.sin(X * 0.01 + i) * 3 * Math.random());
    x.stroke();
  }
});
const wood = std(0xffffff, 0.6, 0, { map: woodTex });
const dark = std(0x2a2a2c, 0.5, 0.2);
const white = std(0xf7f6f3, 0.45);
const silver = std(0xd9dbdf, 0.35, 0.4);
const inner = std(0xe6d6b8, 0.8);

/* ---------------- desk ---------------- */
const TOP = 0.765;
mesh(B(1.4, 0.03, 0.7, 0.006), wood, 0, 0.75, 0);
mesh(B(0.03, 0.735, 0.7, 0.004), wood, -0.685, 0.3675, 0);
mesh(B(0.03, 0.735, 0.7, 0.004), wood, 0.685, 0.3675, 0);
mesh(B(1.34, 0.4, 0.02, 0.003), wood, 0, 0.53, -0.25);
mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.002, 24), dark, -0.58, TOP + 0.001, -0.28);   // cable grommet

/* ---------------- drawer pedestal ---------------- */
const PX = -0.46;
mesh(B(0.4, 0.58, 0.5, 0.004), wood, PX, 0.35, 0.05);
[[-0.16, -0.17], [0.16, -0.17], [-0.16, 0.25], [0.16, 0.25]].forEach(([dx, dz]) => mesh(new THREE.SphereGeometry(0.026, 12, 8), dark, PX + dx, 0.03, dz));
function drawer(yc, h, label, fillTray, msgOpen) {
  const g = group(PX, yc, 0.31);
  mesh(B(0.39, h - 0.008, 0.02, 0.003), wood, 0, 0, 0, g);
  mesh(B(0.13, 0.014, 0.02, 0.005), dark, 0, h * 0.18, 0.016, g);
  const tray = group(0, -h / 2 + 0.018, -0.01, g);
  mesh(B(0.35, 0.008, 0.42, 0), inner, 0, 0, -0.21, tray);
  [-0.171, 0.171].forEach(x => mesh(B(0.008, h * 0.6, 0.42, 0), inner, x, h * 0.3, -0.21, tray));
  mesh(B(0.35, h * 0.6, 0.008, 0), inner, 0, h * 0.3, -0.42, tray);
  fillTray(tray);
  g.userData.open = false;
  const toggle = () => {
    const open = !g.userData.open; g.userData.open = open; SFX.drawer();
    const from = g.position.z, to = open ? 0.62 : 0.31;
    tween(0.45, k => { g.position.z = from + (to - from) * easeOut(k); });
    if (open) toast(typeof msgOpen === 'function' ? msgOpen() : msgOpen);
    if (open && g.userData.onOpen) g.userData.onOpen();
  };
  hotspot(g, label, () => { if (g.userData.guard && !g.userData.open && !g.userData.guard(toggle)) return; toggle(); });
  return g;
}
const paperTex = canvasTex(256, 360, (x, w, h) => {
  x.fillStyle = '#fbfaf6'; x.fillRect(0, 0, w, h); x.fillStyle = '#222'; x.font = 'bold 20px Georgia'; x.fillText('RESIGNATION', 26, 48); x.fillText('LETTER', 26, 74);
  x.font = 'italic 15px Georgia'; x.fillText('draft #47', 26, 100); x.fillStyle = '#bbb';
  for (let y = 130; y < 330; y += 18) x.fillRect(26, y, 160 + Math.random() * 40, 3);
});
const certTex = canvasTex(256, 360, (x, w, h) => {
  x.fillStyle = '#fffaf0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c99a52'; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = '#b5121b'; x.textAlign = 'center'; x.font = 'bold 24px Georgia'; x.fillText('CERTIFIED', w / 2, 90); x.fillText('PROFESSIONAL', w / 2, 122); x.fillText('SLACKER', w / 2, 154);
  x.fillStyle = '#c99a52'; x.beginPath(); x.arc(w / 2, 250, 38, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 26px Georgia'; x.fillText('☕', w / 2, 260);
});
const gold = std(0xe2b33c, 0.25, 0.85);
const topDrawer = drawer(0.565, 0.13, 'Open the top drawer (locked)', t => {
  // the prize: a golden kanelbulle and a certificate
  mesh(spiralTube(2.3, 0.006, 0.036, 0.012, 0.022), gold, -0.08, 0.012, -0.15, t);
  mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.012, 24), gold, -0.08, 0.016, -0.15, t);
  const c = mesh(new THREE.PlaneGeometry(0.11, 0.15), std(0xffffff, 0.8, 0, { map: certTex }), 0.075, 0.006, -0.18, t); c.rotation.x = -Math.PI / 2; c.rotation.z = 0.12;
  hotspot(c, 'Read your certificate', () => showCertificate());
}, () => `The drawer slides open: a golden kanelbulle! ${solvedToast()}.`);
onChange(() => { if (isSolved()) topDrawer.userData.hot.label = 'Open the top drawer'; });
topDrawer.userData.guard = toggle => { if (isSolved()) return true; showLock(() => { SFX.shimmer(); toggle(); setTimeout(showCertificate, 900); }); return false; };
mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 16), silver, 0.15, 0, 0.014, topDrawer).rotation.x = Math.PI / 2;
drawer(0.39, 0.2, 'Open the middle drawer', t => {
  const ging = std(0xa8622e, 0.8), icing = std(0xffffff, 0.6);
  [[-0.1, -0.1], [-0.04, -0.14], [-0.09, -0.2], [-0.02, -0.08]].forEach(([x, z]) => {
    mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.008, 20), ging, x, 0.008, z, t);
    mesh(new THREE.TorusGeometry(0.019, 0.002, 6, 20), icing, x, 0.013, z, t).rotation.x = Math.PI / 2;
  });
  mesh(B(0.1, 0.035, 0.15, 0.01), std(0xf2c230, 0.4), 0.09, 0.022, -0.16, t).rotation.y = 0.2;
}, 'Middle drawer: a gingerbread stash your colleagues will never find.');
drawer(0.18, 0.2, 'Open the bottom drawer', t => {
  mesh(B(0.24, 0.06, 0.16, 0.025), std(0xbcd3ea, 0.95), 0, 0.034, -0.17, t);
  mesh(B(0.12, 0.012, 0.04, 0.006), std(0x222222, 0.8), 0.04, 0.07, -0.13, t).rotation.y = -0.3;
  const p = mesh(new THREE.PlaneGeometry(0.11, 0.15), std(0xffffff, 0.9, 0, { map: paperTex }), -0.07, 0.006, -0.32, t); p.rotation.x = -Math.PI / 2; p.rotation.z = -0.2;
}, "Bottom drawer: a nap kit and a resignation letter (draft #47). You didn't see this.");

/* ---------------- monitor ---------------- */
const mon = group(0.05, TOP, -0.17);
mesh(B(0.2, 0.012, 0.15, 0.005), silver, 0, 0.006, -0.02, mon);
const neck = mesh(B(0.07, 0.24, 0.015, 0.004), silver, 0, 0.13, -0.05, mon); neck.rotation.x = -0.12;
mesh(B(0.56, 0.42, 0.025, 0.012), silver, 0, 0.37, 0, mon);
mesh(new THREE.PlaneGeometry(0.54, 0.315), std(0x0b0b0c, 0.3), 0, 0.395, 0.0128, mon);
const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1024; screenCanvas.height = 576;
const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
function drawScreen(hover) {
  const x = screenCanvas.getContext('2d'), W = 1024, H = 576;
  x.fillStyle = '#008080'; x.fillRect(0, 0, W, H);
  const icons = [['My Computer', '#cfd8dc'], ['My Documents', '#f2c230'], ['My Inbox', '#a66e38'], ['Recycle Bin', '#b0bec5']];
  icons.forEach(([l, c], i) => {
    const y = 40 + i * 110; x.fillStyle = c; x.fillRect(46, y, 56, 46); x.fillStyle = '#0003'; x.fillRect(46, y + 40, 56, 6);
    x.fillStyle = '#fff'; x.font = '18px Tahoma, Verdana, sans-serif'; x.textAlign = 'center'; x.fillText(l, 74, y + 74);
  });
  // window in the middle
  const wx = 290, wy = 140, ww = 520, wh = 250;
  x.fillStyle = '#c0c0c0'; x.fillRect(wx, wy, ww, wh); x.fillStyle = '#fff'; x.fillRect(wx, wy, ww, 3); x.fillRect(wx, wy, 3, wh);
  x.fillStyle = '#808080'; x.fillRect(wx, wy + wh - 3, ww, 3); x.fillRect(wx + ww - 3, wy, 3, wh);
  x.fillStyle = '#000080'; x.fillRect(wx + 6, wy + 6, ww - 12, 34);
  x.fillStyle = '#fff'; x.font = 'bold 20px Tahoma, Verdana, sans-serif'; x.textAlign = 'left'; x.fillText('MöleMe.exe', wx + 16, wy + 30);
  x.fillStyle = '#000'; x.textAlign = 'center'; x.font = 'bold 34px Tahoma, Verdana, sans-serif'; x.fillText('Work hard, slack harder.', wx + ww / 2, wy + 110);
  x.fillStyle = hover ? '#000080' : '#c0c0c0'; x.fillRect(wx + ww / 2 - 150, wy + 150, 300, 60);
  x.strokeStyle = hover ? '#fff' : '#000'; x.lineWidth = 3; x.strokeRect(wx + ww / 2 - 150, wy + 150, 300, 60);
  x.fillStyle = hover ? '#fff' : '#000'; x.font = 'bold 26px Tahoma, Verdana, sans-serif'; x.fillText(hover ? '▶ Click to clock in' : 'Click to clock in', wx + ww / 2, wy + 190);
  // taskbar
  x.fillStyle = '#c0c0c0'; x.fillRect(0, H - 48, W, 48); x.fillStyle = '#fff'; x.fillRect(0, H - 48, W, 3);
  x.fillStyle = '#000080'; x.fillRect(10, H - 40, 70, 32); x.fillStyle = '#fff'; x.font = 'bold 18px Tahoma, Verdana, sans-serif'; x.fillText('Start', 45, H - 18);
  screenTex.needsUpdate = true;
}
drawScreen(false);
const screen = mesh(new THREE.PlaneGeometry(0.52, 0.293), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), 0, 0.395, 0.0132, mon);
screen.castShadow = false;
hotspot(mon, 'Clock in to MöleMe', () => enterScreen());
const noteTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#ffe36b'; x.fillRect(0, 0, w, h); x.fillStyle = '#00000014'; x.fillRect(0, 0, w, 30);
  x.fillStyle = '#2a2420'; x.textAlign = 'center'; x.font = 'bold 30px "Comic Sans MS", "Marker Felt", cursive';
  x.fillText('What am I?', w / 2, 100); x.font = 'bold 76px "Comic Sans MS", "Marker Felt", cursive'; x.fillText('? ? ? ?', w / 2, 190);
});
const note = mesh(new THREE.PlaneGeometry(0.085, 0.085), std(0xffffff, 0.85, 0, { map: noteTex }), 0.26, 0.2, 0.0145, mon);
note.rotation.z = -0.12; note.castShadow = false;
hotspot(note, 'Read the sticky note', () => { SFX.click(); showRiddle(); });

/* ---------------- keyboard & mouse ---------------- */
const keysTex = canvasTex(512, 176, (x, w, h) => {
  x.fillStyle = '#f2f2f0'; x.fillRect(0, 0, w, h);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) {
    const kw = (r === 4 && c > 3 && c < 9) ? 0 : 30; if (!kw) continue;
    x.fillStyle = '#ffffff'; x.fillRect(12 + c * 35, 10 + r * 32, kw, 26); x.strokeStyle = '#d6d6d4'; x.strokeRect(12 + c * 35, 10 + r * 32, kw, 26);
  }
  x.fillStyle = '#fff'; x.fillRect(12 + 4 * 35, 10 + 4 * 32, 170, 26); x.strokeRect(12 + 4 * 35, 10 + 4 * 32, 170, 26);
});
const kb = group(0.05, TOP, 0.13);
mesh(B(0.38, 0.014, 0.13, 0.005), white, 0, 0.007, 0, kb);
const keysTop = mesh(new THREE.PlaneGeometry(0.36, 0.115), std(0xffffff, 0.5, 0, { map: keysTex }), 0, 0.0145, 0, kb); keysTop.rotation.x = -Math.PI / 2;
const floatTex = {};
function floatText(txt, pos) {
  if (!floatTex[txt]) floatTex[txt] = canvasTex(256, 64, (x) => { x.font = 'bold 40px "Courier New", monospace'; x.fillStyle = '#000080'; x.textAlign = 'center'; x.fillText(txt, 128, 46); });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: floatTex[txt], transparent: true, depthWrite: false }));
  sp.scale.set(0.12, 0.03, 1); sp.position.copy(pos); scene.add(sp);
  const y0 = pos.y, x0 = pos.x + rnd(-0.12, 0.12);
  tween(1.1, k => { sp.position.set(x0, y0 + 0.2 * k, pos.z); sp.material.opacity = 1 - k; }, () => { scene.remove(sp); sp.material.dispose(); });
}
hotspot(kb, 'Type furiously to look busy', () => {
  const words = ['asdf', 'KPI', 'synergy', 'per my last email', 'ASAP', 'q4 roadmap', 'lgtm'];
  for (let i = 0; i < 8; i++) setTimeout(() => { SFX.click(); kb.position.y = TOP - 0.002; setTimeout(() => { kb.position.y = TOP; }, 40); }, i * 70);
  floatText(pick(words), new THREE.Vector3(0.05, TOP + 0.05, 0.13));
  toast(pick(['Typing furiously. Boss impressed.', 'asdfghjkl; (very important email)', 'Looking busy: 100%.']));
});
const mouse = mesh(new THREE.SphereGeometry(1, 24, 16), white, 0.32, TOP + 0.012, 0.14); mouse.scale.set(0.033, 0.016, 0.052);
hotspot(mouse, 'Jiggle the mouse', () => {
  const x0 = 0.32; SFX.click();
  tween(0.6, k => { mouse.position.x = x0 + Math.sin(k * Math.PI * 6) * 0.03 * (1 - k); });
  toast(pick(['Wiggled. Your status says: Active.', 'Mouse jiggler engaged.', 'Your laptop thinks you are working.']));
});

/* ---------------- plant ---------------- */
const plant = group(-0.56, TOP, -0.2);
mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.11, 28), white, 0, 0.055, 0, plant);
mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.005, 24), std(0x3b2a1e, 1), 0, 0.105, 0, plant);
const blades = group(0, 0.105, 0, plant);
const greens = [std(0x5e9e3a, 0.6), std(0x77b347, 0.6), std(0x4a8a30, 0.6)];
for (let i = 0; i < 22; i++) {
  const h = rnd(0.12, 0.22), b = mesh(new THREE.ConeGeometry(0.006, h, 5), greens[i % 3], 0, h / 2, 0, blades);
  const a = Math.random() * Math.PI * 2, r = rnd(0, 0.035);
  b.position.x = Math.cos(a) * r; b.position.z = Math.sin(a) * r;
  b.rotation.z = Math.cos(a) * rnd(0.05, 0.35); b.rotation.x = -Math.sin(a) * rnd(0.05, 0.35);
}
let growth = 1;
hotspot(plant, 'Water the plant', () => {
  SFX.water(); growth = Math.min(1.45, growth + 0.07);
  const g0 = blades.scale.y;
  tween(0.9, k => { blades.rotation.z = Math.sin(k * Math.PI * 5) * 0.08 * (1 - k); blades.scale.y = g0 + (growth - g0) * easeOut(k); });
  toast(growth >= 1.45 ? 'The plant is now taller than your career goals.' : pick(['+1 photosynthesis.', "It's growing. Unlike your salary.", 'The plant is the only one here hitting targets.']));
});

/* ---------------- books: each one opens in the reader ---------------- */
// spine colours, text colours and titles match BOOKS in books.js
const books = []; let bx = 0.36;
BOOKS.forEach((bk, i) => {
  const t = [0.034, 0.045, 0.03, 0.04, 0.036, 0.042][i], h = [0.24, 0.26, 0.22, 0.25, 0.23, 0.24][i];
  const spine = canvasTex(64, 512, (x, w, H) => {
    x.fillStyle = bk.spine; x.fillRect(0, 0, w, H);
    x.fillStyle = bk.ink; x.fillRect(0, 18, w, 3); x.fillRect(0, H - 21, w, 3);
    x.save(); x.translate(w / 2 + 9, H / 2); x.rotate(-Math.PI / 2);
    let fs = 26; x.font = `bold ${fs}px Georgia, serif`;
    while (x.measureText(bk.title).width > H - 70 && fs > 12) { fs--; x.font = `bold ${fs}px Georgia, serif`; }
    x.textAlign = 'center'; x.fillText(bk.title, 0, 0); x.restore();
  });
  const side = std(new THREE.Color(bk.spine), 0.7), pages = std(0xf4efe4, 0.9);
  // box faces: +x, -x, +y, -y, +z (spine, facing the viewer), -z
  const b = new THREE.Mesh(B(t, h, 0.17, 0.003), [side, side, pages, pages, std(0xffffff, 0.7, 0, { map: spine }), side]);
  b.position.set(bx + t / 2, TOP + h / 2, -0.25); b.castShadow = b.receiveShadow = true; scene.add(b);
  b.userData.z0 = -0.25; b.userData.book = i; books.push(b); bx += t + 0.002;
  hotspot(b, `Read "${bk.title}"`, () => {
    if (b.userData.busy) return; b.userData.busy = true; SFX.thud();
    tween(0.45, k => { b.position.z = b.userData.z0 + easeOut(k) * 0.12; }, () => {
      openBook(i, () => tween(0.45, k => { b.position.z = b.userData.z0 + 0.12 * (1 - easeOut(k)); }, () => { b.userData.busy = false; }));
    });
  });
});
mesh(B(0.006, 0.12, 0.15, 0.002), silver, bx + 0.006, TOP + 0.06, -0.25);

/* ---------------- pen cup ---------------- */
const penCup = group(0.63, TOP, -0.2);
mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.1, 24), std(0x6c5a8e, 0.5), 0, 0.05, 0, penCup);
const penCols = [0x1d4ed8, 0xc8102e, 0x111111, 0x15803d, 0xf59e0b];
const pens = penCols.map((c, i) => {
  const p = group(Math.cos(i * 1.3) * 0.015, 0.04, Math.sin(i * 1.3) * 0.015, penCup);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 8), std(0xf3f3f3, 0.4), 0, 0.07, 0, p);
  mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 8), std(c, 0.4), 0, 0.13, 0, p);
  p.rotation.z = Math.cos(i * 1.3) * 0.18; p.rotation.x = -Math.sin(i * 1.3) * 0.18; p.userData.r = [p.rotation.x, p.rotation.z];
  return p;
});
hotspot(penCup, 'Spin a pen', () => {
  const p = pick(pens); if (p.userData.busy) return; p.userData.busy = true; SFX.click();
  const y0 = p.position.y;
  tween(1, k => { p.position.y = y0 + Math.sin(k * Math.PI) * 0.12; p.rotation.y = k * Math.PI * 6; p.rotation.z = p.userData.r[1] + Math.sin(k * Math.PI) * 1.2; },
    () => { p.position.y = y0; p.rotation.z = p.userData.r[1]; p.userData.busy = false; SFX.click(); });
  toast(pick(['Pen-spinning: level up.', "That's a skill, technically.", 'Click click click.']));
});

/* ---------------- tissue box ---------------- */
const tissueBoxTex = canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = '#c8102e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffffffcc'; x.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const cx = Math.random() * w, cy = Math.random() * h, r = rnd(8, 16);
    for (let a = 0; a < 6; a++) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a * Math.PI / 3) * r, cy + Math.sin(a * Math.PI / 3) * r); x.stroke(); }
  }
});
const tbox = group(0.53, TOP, 0.13);
mesh(B(0.2, 0.09, 0.11, 0.006), std(0xffffff, 0.6, 0, { map: tissueBoxTex }), 0, 0.045, 0, tbox);
const slot = mesh(new THREE.CylinderGeometry(1, 1, 0.002, 24), std(0x2a0a0a, 1), 0, 0.0905, 0, tbox); slot.scale.set(0.07, 1, 0.022);
function tissueGeo() {
  const g = new THREE.PlaneGeometry(0.1, 0.09, 10, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 40) * 0.006 + Math.sin(y * 35 + x * 10) * 0.005); }
  g.computeVertexNormals(); return g;
}
const tissueMat = std(0xffffff, 0.95, 0, { side: THREE.DoubleSide });
const tissueGeom = tissueGeo();
const stub = mesh(tissueGeom, tissueMat, 0, 0.125, 0, tbox); stub.rotation.y = 0.1;
const floorTissues = [];
hotspot(tbox, 'Pull a tissue', () => {
  SFX.tissue(); bump('tissues');
  const t = mesh(tissueGeom, tissueMat); const start = new THREE.Vector3(); stub.getWorldPosition(start); t.position.copy(start);
  const dx = rnd(0.28, 0.62), dz = rnd(0.3, 0.7), rx = rnd(-1, 1), spin = rnd(2, 5);
  stub.visible = false; setTimeout(() => { stub.visible = true; stub.scale.set(0.2, 0.2, 0.2); tween(0.3, k => stub.scale.setScalar(0.2 + 0.8 * k)); }, 500);
  tween(2.6, k => {
    const rise = Math.min(1, k / 0.22), fall = Math.max(0, (k - 0.22) / 0.78);
    t.position.x = start.x + dx * fall + Math.sin(k * 14) * 0.04 * (1 - k);
    t.position.z = start.z + dz * fall;
    t.position.y = fall === 0 ? start.y + 0.28 * easeOut(rise) : (start.y + 0.28) * (1 - easeInOut(fall)) + 0.006 * easeInOut(fall);
    t.rotation.set((rx + Math.sin(k * 9) * 0.6) * (1 - fall) - (Math.PI / 2) * fall, spin * k, Math.cos(k * 11) * 0.4 * (1 - fall));
  }, () => { floorTissues.push(t); if (floorTissues.length > 40) scene.remove(floorTissues.shift()); });
  const n = stats.tissues;
  toast(n === 10 ? 'Ten tissues. HR has been notified.' : n === 25 ? 'The floor is now 40% tissue.' : pick(['Tissue pulled. Emotional damage: managed.', "That's not crying, that's allergies.", 'Another one for the pile.', 'Pfff. So soft. So free.']));
});

/* ---------------- coffee mug ---------------- */
const mugTex = canvasTex(512, 128, (x, w, h) => {
  x.fillStyle = '#c8102e'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(0, 50, w, 26);
  x.fillStyle = '#c8102e'; x.font = 'bold 22px Arial'; x.textAlign = 'center';
  for (let i = 0; i < 4; i++) x.fillText('✶ SLACK ✶', 64 + i * 128, 70);
});
const mug = group(-0.24, TOP, 0.02);
mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 32), std(0xffffff, 0.35, 0, { map: mugTex }), 0, 0.05, 0, mug);
const handle = mesh(new THREE.TorusGeometry(0.026, 0.007, 10, 24, Math.PI), std(0xc8102e, 0.35), 0.042, 0.05, 0, mug); handle.rotation.z = -Math.PI / 2;
const coffee = mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.002, 24), std(0x3b2314, 0.2), 0, 0.09, 0, mug);
const steamTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const steam = [0, 1, 2].map(i => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0.5 })); s.scale.set(0.05, 0.05, 1); s.userData.ph = i / 3; mug.add(s); return s; });
let coffeeLevel = 1;
hotspot(mug, 'Sip your coffee', () => {
  if (coffeeLevel <= 0) {
    toast('Refilling… (this counts as a paid coffee run)'); SFX.water();
    tween(0.8, k => { coffeeLevel = k; coffee.position.y = 0.012 + 0.078 * k; });
    return;
  }
  SFX.sip(); bump('sips');
  tween(0.9, k => { mug.rotation.z = Math.sin(k * Math.PI) * 0.6; mug.position.y = TOP + Math.sin(k * Math.PI) * 0.1; },
    () => { coffeeLevel = Math.max(0, coffeeLevel - 0.34); coffee.position.y = 0.012 + 0.078 * coffeeLevel;
      if (coffeeLevel <= 0) toast('Empty. Click again for a (paid) coffee run.'); });
  toast(pick(['Slurp.', 'Coffee: the only KPI that matters.', 'Still warm. Just like your inbox.']));
});

/* ---------------- snow globe ---------------- */
const globe = group(-0.6, TOP, 0.04);
mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.035, 32), std(0x6b2a1a, 0.5), 0, 0.0175, 0, globe);
mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.006, 32), std(0xd4a537, 0.3, 0.7), 0, 0.03, 0, globe);
const gIn = group(0, 0.083, 0, globe);
mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.004, 24), std(0xffffff, 0.9), 0, -0.03, 0, gIn);
mesh(new THREE.ConeGeometry(0.018, 0.045, 12), std(0x1f6b3a, 0.6), 0, -0.005, 0, gIn);
mesh(new THREE.OctahedronGeometry(0.005), std(0xffd54a, 0.3, 0.4, { emissive: 0x8a6a00 }), 0, 0.02, 0, gIn);
const glass = new THREE.Mesh(new THREE.SphereGeometry(0.056, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.03, clearcoat: 1, depthWrite: false }));
glass.position.y = 0.083; glass.renderOrder = 2; globe.add(glass);
const FLAKES = 90, fPos = new Float32Array(FLAKES * 3), fVel = new Float32Array(FLAKES * 3);
for (let i = 0; i < FLAKES; i++) { fPos[i * 3] = rnd(-0.035, 0.035); fPos[i * 3 + 1] = -0.026; fPos[i * 3 + 2] = rnd(-0.035, 0.035); }
const flakeGeo = new THREE.BufferGeometry(); flakeGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.0045 }));
flakes.raycast = () => {};   // points have a huge default pick radius and would swallow every click
gIn.add(flakes);
function stepFlakes(dt) {
  for (let i = 0; i < FLAKES; i++) {
    const j = i * 3;
    fVel[j + 1] -= 0.035 * dt; for (let a = 0; a < 3; a++) { fVel[j + a] *= 1 - 2.2 * dt; fPos[j + a] += fVel[j + a] * dt; }
    if (fPos[j + 1] < -0.026) { fPos[j + 1] = -0.026; fVel[j + 1] = 0; fVel[j] *= 0.5; fVel[j + 2] *= 0.5; }
    const r = Math.hypot(fPos[j], fPos[j + 1], fPos[j + 2]); if (r > 0.05) { const s = 0.05 / r; fPos[j] *= s; fPos[j + 1] *= s; fPos[j + 2] *= s; }
  }
  flakeGeo.attributes.position.needsUpdate = true;
}
hotspot(globe, 'Shake the snow globe', () => {
  SFX.shimmer(); bump('shakes');
  for (let i = 0; i < FLAKES; i++) { fVel[i * 3] = rnd(-0.25, 0.25); fVel[i * 3 + 1] = rnd(0.1, 0.4); fVel[i * 3 + 2] = rnd(-0.25, 0.25); }
  tween(0.7, k => { globe.rotation.z = Math.sin(k * Math.PI * 6) * 0.18 * (1 - k); globe.position.x = -0.6 + Math.sin(k * Math.PI * 6) * 0.01 * (1 - k); });
  toast(pick(['Let it snow. Let it slack.', "It's beginning to look a lot like slacking.", 'Shaken, not stirred.']));
});

/* ---------------- bubble wrap ---------------- */
const wrap = group(-0.38, TOP + 0.001, 0.2);
const sheet = mesh(new THREE.PlaneGeometry(0.21, 0.155), std(0xffffff, 0.2, 0, { transparent: true, opacity: 0.35 }), 0, 0, 0, wrap);
sheet.rotation.x = -Math.PI / 2; sheet.castShadow = false; wrap.rotation.y = 0.18;
const bubbleGeo = new THREE.SphereGeometry(0.0085, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const bubbleMat = std(0xffffff, 0.12, 0, { transparent: true, opacity: 0.6 });
const poppedMat = std(0xe8eef2, 0.6, 0, { transparent: true, opacity: 0.45 });
const bubbles = [];
for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
  const b = mesh(bubbleGeo, bubbleMat, -0.084 + c * 0.024 + (r % 2) * 0.012, 0.001, -0.06 + r * 0.024, wrap);
  b.scale.y = 0.75; b.castShadow = false; b.userData.bubble = true; bubbles.push(b);
}
const fTex = canvasTex(256, 192, (x, w, h) => { x.fillStyle = '#b5121b'; x.textAlign = 'center'; x.font = 'bold 130px Georgia'; x.fillText('F', w / 2 - 20, 140); x.font = 'bold 44px Georgia'; x.fillText('①', w / 2 + 62, 70); });
const fMark = mesh(new THREE.PlaneGeometry(0.12, 0.09), new THREE.MeshBasicMaterial({ map: fTex, transparent: true, depthWrite: false }), 0, 0.0008, 0, wrap);
fMark.rotation.x = -Math.PI / 2; fMark.castShadow = false; fMark.visible = has('F'); fMark.raycast = () => {};
function resetWrap() { bubbles.forEach(b => { b.userData.popped = false; b.material = bubbleMat; b.scale.set(1, 0.75, 1); }); }
hotspot(wrap, 'Pop the bubble wrap', hit => {
  let b = hit && hit.userData.bubble ? hit : null;
  if (!b || b.userData.popped) b = bubbles.find(x => !x.userData.popped);
  if (!b) return;
  b.userData.popped = true; b.material = poppedMat; b.scale.set(1.15, 0.12, 1.15); SFX.pop(); bump('bubbles');
  if (stats.bubbles % 20 === 0) toast(pick([`${stats.bubbles} bubbles. Incredibly productive.`, 'Pop. Pop. Pop. Therapy.', 'Bubble wrap: cheaper than a therapist.']));
  if (bubbles.every(x => x.userData.popped)) {
    fMark.visible = true;
    if (!has('F')) setTimeout(() => { found('F'); setTimeout(resetWrap, 2500); }, 500);
    else setTimeout(() => { resetWrap(); toast('Sheet cleared. A fresh one has been delivered.'); }, 900);
  }
});

/* ---------------- fairy lights along the back edge ---------------- */
const lights = group();
const lightCols = [0xff4a3a, 0xffc23a, 0x4fd070, 0x4f8dff];
const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3(-0.66 + 1.32 * t, TOP + 0.006 + Math.abs(Math.sin(t * Math.PI * 8)) * 0.006, -0.335)); }
mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.0015, 5), std(0x1d4d33, 0.6), 0, 0, 0, lights);
const bulbs = [];
for (let i = 0; i < 22; i++) {
  const t = (i + 0.5) / 22, c = lightCols[i % 4];
  const m = mesh(new THREE.SphereGeometry(0.0065, 10, 8), std(c, 0.3, 0, { emissive: c, emissiveIntensity: 2.4 }), -0.66 + 1.32 * t, TOP + 0.012, -0.335, lights);
  m.castShadow = false; m.userData.ph = Math.random() * 6; bulbs.push(m);
}
let lightsOn = true;
hotspot(lights, 'Toggle the fairy lights', () => {
  lightsOn = !lightsOn; SFX.click();
  toast(lightsOn ? 'Lights on. Festive productivity: up.' : 'Lights off. Mood: Monday.');
});

/* ---------------- office chair ---------------- */
const chair = group(0.36, 0, 0.66); chair.rotation.y = 0.55; chair.scale.setScalar(0.92);
const fabric = std(0x9a9ea4, 0.9), blk = std(0x1c1c1e, 0.45, 0.2);
for (let i = 0; i < 5; i++) {
  const a = i * Math.PI * 2 / 5, leg = mesh(B(0.3, 0.03, 0.045, 0.01), blk, Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15, chair);
  leg.rotation.y = -a; mesh(new THREE.SphereGeometry(0.028, 12, 8), blk, Math.cos(a) * 0.29, 0.028, Math.sin(a) * 0.29, chair);
}
mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), blk, 0, 0.08, 0, chair);
mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 16), std(0x9aa0a6, 0.25, 0.8), 0, 0.26, 0, chair);
mesh(B(0.2, 0.05, 0.2, 0.01), blk, 0, 0.42, 0, chair);
mesh(B(0.5, 0.09, 0.47, 0.035), fabric, 0, 0.47, 0, chair);
const back = mesh(B(0.46, 0.58, 0.07, 0.04), fabric, 0, 0.87, 0.26, chair); back.rotation.x = 0.12;
[-0.25, 0.25].forEach(x => { mesh(B(0.03, 0.16, 0.03, 0.008), blk, x, 0.57, 0.02, chair); mesh(B(0.06, 0.03, 0.26, 0.012), blk, x, 0.66, 0.0, chair); });
let chairBusy = false;
hotspot(chair, 'Spin the chair', () => {
  if (chairBusy) return; chairBusy = true; SFX.whoosh(); bump('spins');
  const r0 = chair.rotation.y;
  tween(1.5, k => { chair.rotation.y = r0 + easeOut(k) * Math.PI * 2; }, () => { chair.rotation.y = r0; chairBusy = false; });
  toast(stats.spins === 5 ? 'Five spins. The room is spinning too.' : pick(['Wheee.', 'Spin count +1. Productivity −1.', 'Dizzy, but on the clock.']));
});

/* ---------------- Swedish corner ---------------- */
// kanelbulle on a plate: three bites, then a fresh one (lussekatt in between)
const plate = group(-0.12, TOP, 0.265);
mesh(new THREE.CylinderGeometry(0.068, 0.052, 0.01, 32), white, 0, 0.005, 0, plate);
const dough = std(0xb5743a, 0.75), dough2 = std(0x9a5a28, 0.8), sugar = std(0xffffff, 0.5), saffron = std(0xf2b01e, 0.6);
function spiralTube(turns, r0, r1, tube, h) {
  const pts = []; for (let i = 0; i <= 80; i++) { const t = i / 80, a = t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t; pts.push(new THREE.Vector3(Math.cos(a) * r, h * (1 - t * 0.6), Math.sin(a) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, tube, 10);
}
const bun = group(0, 0.012, 0, plate);
function makeBun(kind) {
  bun.clear();
  if (kind === 'kanelbulle') {
    mesh(spiralTube(2.3, 0.006, 0.036, 0.012, 0.022), dough, 0, 0, 0, bun);
    mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.012, 24), dough2, 0, 0.004, 0, bun);
    for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28, r = Math.random() * 0.032; mesh(B(0.004, 0.004, 0.004, 0), sugar, Math.cos(a) * r, 0.034, Math.sin(a) * r, bun).rotation.y = a; }
  } else {   // lussekatt: an S-shaped saffron bun with two raisins
    const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60 * 2 - 1, a = t * Math.PI * 1.5; pts.push(new THREE.Vector3(t * 0.045, 0.012, Math.sin(a) * 0.022 * (t < 0 ? -1 : 1))); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.011, 10), saffron, 0, 0, 0, bun);
    [[-0.045, 0], [0.045, 0]].forEach(([x, z]) => mesh(new THREE.SphereGeometry(0.0055, 8, 6), std(0x2a0f0a, 0.4), x, 0.016, z, bun));
  }
  bun.userData.kind = kind; bun.userData.bites = 0; bun.scale.setScalar(1); bun.visible = true;
}
makeBun('kanelbulle');
hotspot(plate, 'Have a bun', () => {
  if (!bun.visible) {
    makeBun(stats.buns % 2 ? 'lussekatt' : 'kanelbulle'); bun.scale.setScalar(0.01);
    tween(0.4, k => bun.scale.setScalar(easeOut(k)));
    toast(bun.userData.kind === 'lussekatt' ? 'A lussekatt! Saffron season has started.' : 'A fresh kanelbulle. The coffee break never ends.');
    return;
  }
  SFX.munch(); bun.userData.bites++;
  const s0 = bun.scale.x, s1 = 1 - bun.userData.bites * 0.3;
  tween(0.25, k => { bun.scale.set(s0 + (s1 - s0) * k, 1, s0 + (s1 - s0) * k); });
  if (bun.userData.bites >= 3) { setTimeout(() => { bun.visible = false; }, 260); bump('buns');
    toast(stats.buns === 3 ? 'Three buns. That is not a snack, that is lunch.' : pick(['Mmm. Cardamom and cinnamon.', 'Cinnamon buns are a human right in Sweden.', 'Gone. Click the plate for another.'])); }
  else toast(pick(['Nom.', 'Pearl sugar everywhere.', 'This is a meeting now. A bun meeting.']));
});

// dala horse: red, with the traditional painted harness, hops when clicked
const dala = group(-0.4, TOP, -0.26); dala.rotation.y = 0.5;
const hs = new THREE.Shape();
[[-0.03, 0], [-0.03, 0.032], [-0.038, 0.04], [-0.034, 0.048], [-0.022, 0.05], [0.014, 0.05], [0.02, 0.062], [0.016, 0.078], [0.024, 0.086], [0.03, 0.082], [0.044, 0.07], [0.04, 0.062], [0.03, 0.064], [0.03, 0.044], [0.03, 0], [0.018, 0], [0.018, 0.026], [-0.018, 0.026], [-0.018, 0]].forEach(([x, y], i) => i ? hs.lineTo(x, y) : hs.moveTo(x, y));
const dalaGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2 }); dalaGeo.translate(0, 0, -0.008);
const dalaPaint = canvasTex(256, 256, (x) => {
  x.fillStyle = '#c8102e'; x.fillRect(0, 0, 256, 256);
  x.lineWidth = 6; x.strokeStyle = '#f6c400'; x.beginPath(); x.moveTo(40, 120); x.quadraticCurveTo(110, 170, 190, 110); x.stroke();
  x.fillStyle = '#1a6fb0'; x.beginPath(); x.arc(110, 120, 16, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(110, 120, 7, 0, 7); x.fill();
  x.fillStyle = '#2f9a55'; [[70, 140], [150, 140]].forEach(([a, b]) => { x.beginPath(); x.ellipse(a, b, 12, 6, 0.5, 0, 7); x.fill(); });
  x.fillStyle = '#fff'; [[60, 100], [160, 98], [200, 60]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 5, 0, 7); x.fill(); });
});
dalaPaint.repeat.set(10, 10); dalaPaint.offset.set(0.35, 0);
const dalaMesh = mesh(dalaGeo, [std(0xffffff, 0.35, 0, { map: dalaPaint }), std(0xc8102e, 0.35)], 0, 0, 0, dala);
dalaMesh.scale.setScalar(1.6);
hotspot(dala, 'Ride the Dala horse', () => {
  SFX.clop(); const r0 = dala.rotation.y;
  tween(0.8, k => { dala.position.y = TOP + Math.abs(Math.sin(k * Math.PI * 2)) * 0.05; dala.rotation.z = Math.sin(k * Math.PI * 4) * 0.2; dala.rotation.y = r0 + k * Math.PI * 2; }, () => { dala.position.y = TOP; dala.rotation.set(0, r0, 0); });
  toast(pick(['Dalahäst: hand-carved in Dalarna since the 1600s.', 'Giddy-up! (in Swedish: hopp hopp!)', 'The most Swedish horse there is.']));
});

// advent candle holder: four candles, one more lit for each Sunday of Advent
const advent = group(0.6, TOP, 0.27); advent.rotation.y = -0.15;
mesh(B(0.2, 0.018, 0.045, 0.006), std(0x1f5e3b, 0.6), 0, 0.009, 0, advent);
for (let i = 0; i < 8; i++) mesh(new THREE.SphereGeometry(0.007, 8, 6), std(i % 2 ? 0xc8102e : 0x2f9a55, 0.5), -0.09 + i * 0.026, 0.02, 0.02, advent);
const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc44d).multiplyScalar(4), toneMapped: false });
const glowTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 1, 32, 32, 30); g.addColorStop(0, 'rgba(255,214,120,0.95)'); g.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const candles = [0, 1, 2, 3].map(i => {
  const c = group(-0.069 + i * 0.046, 0.018, 0, advent);
  mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 16), std(0xfaf6ee, 0.6), 0, 0.035, 0, c);
  const f = mesh(new THREE.ConeGeometry(0.005, 0.018, 10), flameMat, 0, 0.082, 0, c); f.castShadow = false;
  const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false })); g.scale.set(0.06, 0.06, 1); g.position.y = 0.082; c.add(g);
  f.visible = g.visible = false; return { f, g };
});
let lit = 0;
const aTex = canvasTex(256, 160, (x, w, h) => { x.fillStyle = '#ffd27a'; x.textAlign = 'center'; x.shadowColor = '#ff9a3a'; x.shadowBlur = 18; x.font = 'bold 110px Georgia'; x.fillText('A', w / 2 - 22, 120); x.font = 'bold 40px Georgia'; x.fillText('④', w / 2 + 52, 58); });
const aMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: aTex, transparent: true, depthWrite: false, opacity: 0, color: new THREE.Color(2.2, 2.2, 2.2) }));
aMark.scale.set(0.13, 0.08, 1); aMark.position.set(0, 0.2, 0); aMark.raycast = () => {}; advent.add(aMark);
const candleLight = new THREE.PointLight(0xffa04a, 0, 1.2, 2); candleLight.position.set(0.6, TOP + 0.16, 0.3); scene.add(candleLight);
hotspot(advent, 'Light an advent candle', () => {
  if (lit === 4) { candles.forEach(c => { c.f.visible = c.g.visible = false; }); lit = 0; candleLight.intensity = 0; aMark.material.opacity = 0; toast('Candles blown out. Fire safety is also a KPI.'); return; }
  SFX.match(); candles[lit].f.visible = candles[lit].g.visible = true; lit++; candleLight.intensity = 0.08 * lit;
  toast(['First Sunday of Advent. Glögg season begins.', 'Second Sunday. The pepparkakor are out.', 'Third Sunday. Lucia is coming (13 December).', 'Fourth Sunday. Almost julafton. God jul!'][lit - 1]);
  if (lit === 4) { tween(1.2, k => { aMark.material.opacity = k; aMark.position.y = 0.14 + 0.06 * k; }); setTimeout(() => found('A'), 1300); }
});

// julbock: a big straw goat on the floor next to the desk
const bock = group(-0.88, 0, -0.5); bock.rotation.y = 0.5; bock.scale.setScalar(0.9);
const straw = std(0xe0b05a, 0.95), ribbon = std(0xc8102e, 0.5);
const strawTube = (pts, r) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 40, r, 8), straw, 0, 0, 0, bock);
strawTube([[-0.12, 0.26, 0], [0, 0.27, 0], [0.12, 0.26, 0]], 0.045);
[[-0.1, 0.06], [-0.1, -0.06], [0.1, 0.06], [0.1, -0.06]].forEach(([x, z]) => strawTube([[x, 0.25, z * 0.6], [x * 1.05, 0.12, z], [x * 1.1, 0, z * 1.1]], 0.016));
strawTube([[0.12, 0.27, 0], [0.18, 0.36, 0], [0.22, 0.4, 0]], 0.025);
strawTube([[0.2, 0.4, 0], [0.26, 0.39, 0], [0.29, 0.35, 0]], 0.022);
[-1, 1].forEach(sd => strawTube([[0.2, 0.42, 0.012 * sd], [0.16, 0.5, 0.03 * sd], [0.1, 0.52, 0.05 * sd], [0.06, 0.47, 0.06 * sd]], 0.01));
strawTube([[-0.12, 0.27, 0], [-0.17, 0.32, 0], [-0.19, 0.3, 0]], 0.01);
[-0.08, 0, 0.08].forEach(x => { const r = mesh(new THREE.TorusGeometry(0.048, 0.008, 6, 20), ribbon, x, 0.265, 0, bock); r.rotation.y = Math.PI / 2; });
const nr = mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 18), ribbon, 0.17, 0.37, 0, bock); nr.rotation.set(0, Math.PI / 2, 0.6);
let bockClicks = 0;
hotspot(bock, 'Pet the julbock', () => {
  bockClicks++; SFX.cardboard();
  tween(0.6, k => { bock.rotation.z = Math.sin(k * Math.PI * 4) * 0.05 * (1 - k); });
  toast(bockClicks === 1 ? 'A julbock: the straw Christmas goat.' : bockClicks === 2 ? "The giant one in Gävle gets set on fire almost every year." : bockClicks === 3 ? 'This one is safe. No candles nearby. Probably.' : pick(['Bää.', 'Still standing.', 'Straw: 100%. Fire risk: unclear.']));
});

// flat-pack box leaning against the desk, with an Allen key on the floor
const pack = group(0.98, 0, 0.05); pack.rotation.set(0, -0.55, 0);
const packTex = canvasTex(512, 720, (x, w, h) => {
  x.fillStyle = '#c8a46c'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(90,60,20,${Math.random() * 0.06})`; x.fillRect(0, Math.random() * h, w, 1 + Math.random() * 3); }
  x.fillStyle = '#0058a3'; x.fillRect(0, 70, w, 90); x.fillStyle = '#ffda1a'; x.fillRect(0, 160, w, 22);
  x.fillStyle = '#fff'; x.font = 'bold 64px Arial, sans-serif'; x.textAlign = 'center'; x.fillText('MÖLEMÖ', w / 2, 138);
  x.fillStyle = '#222'; x.font = 'bold 28px Arial'; x.fillText('1/1', w / 2, 240);
  x.font = '22px Arial'; x.fillText('Desk for professional slacking', w / 2, 280);
  x.strokeStyle = '#222'; x.lineWidth = 6; x.strokeRect(150, 330, 212, 120); x.beginPath(); x.moveTo(150, 330); x.lineTo(256, 270); x.lineTo(362, 330); x.stroke();
  x.font = 'bold 30px Arial'; x.fillText('248 parts', w / 2, 520); x.font = '22px Arial'; x.fillText('Assembly time: one coffee', w / 2, 560);
  x.fillText('⚠ 2 people recommended', w / 2, 640);
});
const packMesh = mesh(B(0.55, 0.78, 0.07, 0.006), [std(0xc8a46c, 0.9), std(0xc8a46c, 0.9), std(0xc8a46c, 0.9), std(0xc8a46c, 0.9), std(0xffffff, 0.85, 0, { map: packTex }), std(0xc8a46c, 0.9)], 0, 0.39, 0, pack);
packMesh.rotation.x = -0.12; packMesh.position.z = 0.05;
const keyMat = std(0x8b939c, 0.3, 0.9);
const key = group(0.82, 0.004, 0.42); key.rotation.y = 0.7;
mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6), keyMat, 0, 0, 0, key).rotation.z = Math.PI / 2;
mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.025, 6), keyMat, -0.035, 0, 0.0125, key).rotation.x = Math.PI / 2;
hotspot(pack, 'Read the assembly instructions', () => { SFX.cardboard(); openBook(MANUAL); });
hotspot(key, 'Pick up the Allen key', () => {
  SFX.click(); tween(0.8, k => { key.position.y = 0.004 + Math.sin(k * Math.PI) * 0.12; key.rotation.x = k * Math.PI * 4; }, () => key.rotation.set(0, 0.7, 0));
  toast(pick(['The Allen key. The most important tool in any Swedish home.', 'You will find seven more of these in a drawer later.']));
});

/* ---------------- picking ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(hot, true)[0];
  if (!hit) return null;
  let o = hit.object; while (o && !o.userData.hot) o = o.parent;
  return o ? { root: o, object: hit.object } : null;
}
let down = null, hoverRoot = null, busy = false, inOS = false;
const tip = $('tip');
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; ac(); });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || busy) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (moved > 6) return;
  const p = pickAt(e.clientX, e.clientY);
  if (p) { p.root.userData.hot.action(p.object); $('hint').classList.add('gone'); }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (busy || e.pointerType === 'touch') return;
  const p = pickAt(e.clientX, e.clientY), root = p ? p.root : null;
  if (root !== hoverRoot) {
    if (hoverRoot === mon || root === mon) drawScreen(root === mon);
    hoverRoot = root;
  }
  renderer.domElement.style.cursor = root ? 'pointer' : 'grab';
  if (root) { tip.textContent = root.userData.hot.label; tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`; tip.classList.add('on'); }
  else tip.classList.remove('on');
});
renderer.domElement.addEventListener('pointerleave', () => tip.classList.remove('on'));

/* ---------------- zoom into the screen ---------------- */
function enterScreen() {
  if (busy) return; busy = true; tip.classList.remove('on'); drawScreen(true);
  const target = new THREE.Vector3(); screen.getWorldPosition(target);
  const toPos = target.clone().add(new THREE.Vector3(0, 0, 0.44));
  const fromP = camera.position.clone(), fromT = controls.target.clone();
  tween(1.1, k => { const e = easeInOut(k); camera.position.lerpVectors(fromP, toPos, e); controls.target.lerpVectors(fromT, target, e); camera.lookAt(controls.target); },
    () => { document.body.classList.add('in-os'); setTimeout(() => { inOS = true; openOS(); }, 250); });
}
onOSClose(() => {
  inOS = false; document.body.classList.remove('in-os'); drawScreen(false);
  const fromP = camera.position.clone(), fromT = controls.target.clone();
  tween(1.1, k => { const e = easeInOut(k); camera.position.lerpVectors(fromP, HOME.pos, e); controls.target.lerpVectors(fromT, HOME.target, e); camera.lookAt(controls.target); },
    () => { busy = false; controls.update(); });
});

/* ---------------- post: bloom + a soft vignette ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.55 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= mix(1.0, smoothstep(0.85, 0.3, d), amount); gl_FragColor = c; }',
}));
composer.addPass(new OutputPass());

/* ---------------- loop ---------------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); camera.aspect = w / h;
  const narrow = w / h < 0.8; camera.fov = narrow ? 50 : 38; camera.updateProjectionMatrix();
  const want = narrow ? HOME_NARROW : HOME_WIDE;
  if (!HOME.pos.equals(want)) { HOME.pos.copy(want); if (!busy && !inOS) { camera.position.copy(want); controls.target.copy(HOME.target); controls.update(); } }
}
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(); let statT = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta()), now = clock.elapsedTime;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.d); tw.update(k);
    if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
  }
  stepFlakes(dt); stepSnow(dt, now);
  steam.forEach(s => { const p = (now * 0.35 + s.userData.ph) % 1; s.position.set(Math.sin(p * 6 + s.userData.ph * 5) * 0.01, 0.1 + p * 0.12, 0); s.material.opacity = coffeeLevel > 0 ? 0.45 * Math.sin(p * Math.PI) : 0; });
  bulbs.forEach(b => { b.material.emissiveIntensity = lightsOn ? 2.2 + Math.sin(now * 3 + b.userData.ph) * 1.2 : 0; });
  if (!inOS) {
    onClock += dt; statT += dt; if (statT > 1) { statT = 0; renderStats(); }
    if (!busy) controls.update();
    composer.render();
  }
  requestAnimationFrame(frame);
}
renderStats();
requestAnimationFrame(frame);
window.__desk = { camera, controls, scene, enterScreen, pick: (x, y) => { const p = pickAt(x, y); return p ? p.root.userData.hot.label + " | " + p.object.type + " " + (p.object.geometry?.type || "") : null; }, act: label => { const o = hot.find(h => h.userData.hot.label === label); if (o) o.userData.hot.action(); } };
