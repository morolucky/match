import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createMaterials } from './materials.js';
import { buildStadium } from './stadium.js';
import { buildPitch } from './pitch.js';

const $ = (id) => document.getElementById(id);

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.info.autoReset = false;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9fb4c8, 0.0009);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.25, 20000);

const manager = new THREE.LoadingManager();
manager.onProgress = (_, loaded, total) => { $('bar').style.width = `${(loaded / total) * 100}%`; };
manager.onLoad = () => { $('loader').classList.add('done'); };

const M = createMaterials(renderer, manager);
const stadium = buildStadium(M);
const pitch = buildPitch(M);
stadium.gAssets.add(pitch.root);
scene.add(stadium.root);

// ---------- Sky, sun, floodlights ----------
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);
const skyEnv = new Sky();
skyEnv.scale.setScalar(10000);
const envScene = new THREE.Scene();
envScene.add(skyEnv);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.camera.left = sun.shadow.camera.bottom = -150;
sun.shadow.camera.right = sun.shadow.camera.top = 150;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 700;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x3a4a2a, 0.4);
scene.add(hemi);

const floods = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  const s = new THREE.SpotLight(0xfff4e5, 0, 0, 0.75, 0.6, 0);
  s.position.set(Math.cos(a) * 72, 42, Math.sin(a) * 56);
  s.target.position.set(Math.cos(a) * 18, 0, Math.sin(a) * 12);
  scene.add(s, s.target);
  floods.push(s);
}

const TIMES = {
  day: { elev: 52, azim: 150, sun: 3.4, sunColor: 0xffffff, exposure: 0.55, flood: 0, lens: 0, glaze: 0, hemi: 0.45, fog: 0x9fb4c8, turbidity: 6, rayleigh: 1.2, bloom: [0.15, 0.6, 1.2] },
  sunset: { elev: 4.5, azim: 255, sun: 2.6, sunColor: 0xffa860, exposure: 0.5, flood: 1.2, lens: 8, glaze: 0.6, hemi: 0.25, fog: 0xd29a78, turbidity: 9, rayleigh: 2.6, bloom: [0.45, 0.5, 0.9] },
  night: { elev: -8, azim: 255, sun: 1.6, sunColor: 0xdfe8ff, exposure: 0.85, flood: 2.6, lens: 18, glaze: 1.2, hemi: 0.06, fog: 0x0b1120, turbidity: 2, rayleigh: 0.4, bloom: [0.7, 0.45, 0.85] },
};
let timeMode = 'sunset';

function setTime(mode) {
  timeMode = mode;
  const T = TIMES[mode];
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - T.elev), THREE.MathUtils.degToRad(T.azim));
  for (const s of [sky, skyEnv]) {
    const u = s.material.uniforms;
    u.sunPosition.value.copy(sunDir);
    u.turbidity.value = T.turbidity;
    u.rayleigh.value = T.rayleigh;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
  }
  // At night the key light becomes an overhead "floodlight" so shadows stay crisp.
  const keyDir = mode === 'night' ? new THREE.Vector3(0.25, 1, 0.35).normalize() : sunDir;
  sun.position.copy(keyDir).multiplyScalar(400);
  sun.color.set(T.sunColor);
  sun.intensity = T.sun;
  hemi.intensity = T.hemi;
  floods.forEach((f) => (f.intensity = T.flood));
  M.flood.emissiveIntensity = T.lens;
  M.glazing.emissiveIntensity = T.glaze;
  scene.fog.color.set(T.fog);
  renderer.toneMappingExposure = T.exposure;
  [bloom.strength, bloom.radius, bloom.threshold] = T.bloom;
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene);
  scene.environment = envRT.texture;
  scene.environmentIntensity = mode === 'night' ? 0.15 : 1;
  document.querySelectorAll('[data-time]').forEach((b) => b.classList.toggle('on', b.dataset.time === mode));
}

// ---------- Post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Quality ----------
const QUALITY = {
  low: { pr: 1, shadows: false, map: 1024, bloom: false },
  medium: { pr: 1, shadows: true, map: 2048, bloom: true },
  high: { pr: Math.min(devicePixelRatio, 2), shadows: true, map: 4096, bloom: true },
};
function setQuality(q) {
  const Q = QUALITY[q];
  renderer.setPixelRatio(Q.pr);
  composer.setPixelRatio(Q.pr);
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  sun.castShadow = Q.shadows;
  if (sun.shadow.mapSize.x !== Q.map) {
    sun.shadow.mapSize.set(Q.map, Q.map);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  bloom.enabled = Q.bloom;
  document.querySelectorAll('[data-quality]').forEach((b) => b.classList.toggle('on', b.dataset.quality === q));
}

// ---------- Cameras ----------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.07;
orbit.maxDistance = 900;
orbit.minDistance = 2;
orbit.maxPolarAngle = Math.PI * 0.497;

const PRESETS = {
  broadcast: { pos: [0, 29.5, 72], target: [0, 0, 0] },
  corner: { pos: [-54.8, 1.7, 36.4], target: [-30, 6, -8] },
  goal: { pos: [70, 7, 0], target: [0, 2, 0] },
  aerial: { pos: [150, 210, 190], target: [0, 0, 0] },
  upper: { pos: [-20, 42, -86], target: [0, 0, 0] },
  exterior: { pos: [-230, 32, 210], target: [0, 22, 0] },
};
let tween = null;
function goTo(name, instant = false) {
  const p = PRESETS[name];
  const to = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target) };
  if (instant) { camera.position.copy(to.pos); orbit.target.copy(to.target); orbit.update(); return; }
  tween = { from: { pos: camera.position.clone(), target: orbit.target.clone() }, to, t: 0 };
}

const walk = new PointerLockControls(camera, renderer.domElement);
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
walk.addEventListener('lock', () => { orbit.enabled = false; $('walkhint').classList.add('show'); });
walk.addEventListener('unlock', () => {
  orbit.enabled = true;
  $('walkhint').classList.remove('show');
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  orbit.target.copy(camera.position).addScaledVector(fwd, 20);
});
function updateWalk(dt) {
  if (!walk.isLocked) return;
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 18 : 6) * dt;
  if (keys.KeyW) walk.moveForward(sp);
  if (keys.KeyS) walk.moveForward(-sp);
  if (keys.KeyD) walk.moveRight(sp);
  if (keys.KeyA) walk.moveRight(-sp);
  if (keys.Space) camera.position.y += sp;
  if (keys.KeyC || keys.ControlLeft) camera.position.y -= sp;
  camera.position.y = Math.max(0.4, camera.position.y);
}

// ---------- UI ----------
document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => setTime(b.dataset.time)));
document.querySelectorAll('[data-quality]').forEach((b) => b.addEventListener('click', () => setQuality(b.dataset.quality)));
document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.cam)));
$('walk').addEventListener('click', () => {
  if (camera.position.y > 30 || camera.position.length() > 150) { camera.position.set(0, 1.7, 30); camera.lookAt(0, 1.7, 0); }
  walk.lock();
});
$('roof').addEventListener('change', (e) => { stadium.gPanels.visible = e.target.checked; });
$('seats').addEventListener('change', (e) => { stadium.gSeats.visible = e.target.checked; });
$('explode').addEventListener('input', (e) => {
  const v = +e.target.value;
  stadium.explode.forEach(({ obj, level }) => { obj.position.y = v * level * 16; });
});
$('export').addEventListener('click', async () => {
  const btn = $('export');
  btn.disabled = true;
  btn.textContent = 'Exporting…';
  try {
    const glb = await new GLTFExporter().parseAsync(stadium.root, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
    Object.assign(document.createElement('a'), { href: url, download: 'aaa_stadium.glb' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    console.error(err);
    alert(`Export failed: ${err.message}`);
  }
  btn.disabled = false;
  btn.textContent = 'Export GLB';
});
$('seatcount').textContent = stadium.stats.seats.toLocaleString();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------- Loop ----------
const clock = new THREE.Clock();
let fpsAcc = 0, fpsFrames = 0, lastSecond = -1;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 1.6);
    const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
    camera.position.lerpVectors(tween.from.pos, tween.to.pos, k);
    orbit.target.lerpVectors(tween.from.target, tween.to.target, k);
    if (tween.t >= 1) tween = null;
  }
  if (orbit.enabled) orbit.update();
  updateWalk(dt);
  M.adsTex.offset.x = (t * 0.04) % 1;
  pitch.update(t);
  const sec = Math.floor(t);
  if (sec !== lastSecond) { lastSecond = sec; M.drawScore(sec); }

  renderer.info.reset();
  composer.render(dt);

  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 0.5) {
    $('fps').textContent = Math.round(fpsFrames / fpsAcc);
    $('tris').textContent = (renderer.info.render.triangles / 1e6).toFixed(2) + 'M';
    $('calls').textContent = renderer.info.render.calls;
    fpsAcc = 0; fpsFrames = 0;
  }
  requestAnimationFrame(frame);
}

setQuality(matchMedia('(pointer: coarse)').matches ? 'low' : 'medium');
setTime(timeMode);
goTo('broadcast', true);
requestAnimationFrame(frame);

// Debug / automation hook.
window.STADIUM = { scene, camera, renderer, setTime, setQuality, goTo, stadium, orbit };
