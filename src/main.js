import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import './style.css';

const host = document.querySelector('#canvas-wrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#edebe5');
scene.fog = new THREE.Fog('#edebe5', 40, 90);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120);
camera.position.set(22, 15.3, 28);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
host.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.target.set(0, 6.2, 0);
controls.minDistance = 10;
controls.maxDistance = 52;
controls.maxPolarAngle = Math.PI * 0.48;
scene.add(new THREE.HemisphereLight('#fff9ec', '#786f62', 2.15));
const key = new THREE.DirectionalLight('#fff2d8', 3.5);
key.position.set(-14, 23, 18);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -25; key.shadow.camera.right = 25; key.shadow.camera.top = 28; key.shadow.camera.bottom = -8;
key.shadow.bias = -0.00035;
scene.add(key);
const fill = new THREE.DirectionalLight('#dce5f1', 1.2);
fill.position.set(12, 12, -16); scene.add(fill);

const settings = { floors: 5, bays: 7, weather: 32, roof: 'mansard', features: { windows: true, balconies: true, shops: true, details: true }, wire: false, shadows: true };
let building = new THREE.Group();
scene.add(building);
const shared = {};
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
function makeMaterial(color, roughness = 0.84, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness, ...extra }); }

function textureSet(patina) {
  const size = 1024;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cbbba1'; ctx.fillRect(0, 0, size, size);
  const img = ctx.createImageData(size, size);
  let seed = 54219;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4; const n = (rand() - 0.5) * 33;
    const wash = Math.sin(x * 0.018 + Math.sin(y * 0.011)) * 8 + Math.sin(y * 0.021) * 5;
    img.data[i] = 204 + n + wash; img.data[i + 1] = 190 + n + wash; img.data[i + 2] = 167 + n + wash; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 310 * patina / 32; i++) {
    const x = rand() * size, y = rand() * size, r = 1 + rand() * 20;
    ctx.fillStyle = rand() > .46 ? `rgba(112,89,61,${0.018 + rand() * .075})` : `rgba(255,246,226,${0.02 + rand() * .12})`;
    ctx.beginPath(); ctx.ellipse(x, y, r * (0.35 + rand() * 1.2), r * (.25 + rand() * .7), rand() * 3, 0, Math.PI * 2); ctx.fill();
  }
  for (let y = 0; y < size; y += 64) { ctx.fillStyle = 'rgba(110,91,67,.055)'; ctx.fillRect(0, y, size, 1); }
  const color = new THREE.CanvasTexture(canvas); color.colorSpace = THREE.SRGBColorSpace; color.wrapS = color.wrapT = THREE.RepeatWrapping; color.repeat.set(2, 2); color.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const roughCanvas = document.createElement('canvas'); roughCanvas.width = roughCanvas.height = size; const rc = roughCanvas.getContext('2d'); rc.drawImage(canvas, 0, 0);
  const pixels = rc.getImageData(0, 0, size, size); const roughPixels = rc.createImageData(size, size);
  for (let i = 0; i < pixels.data.length; i += 4) { const l = (pixels.data[i] * .3 + pixels.data[i + 1] * .59 + pixels.data[i + 2] * .11); const v = Math.max(0, Math.min(255, 198 + (l - 170) * .36)); roughPixels.data[i] = roughPixels.data[i + 1] = roughPixels.data[i + 2] = v; roughPixels.data[i + 3] = 255; }
  rc.putImageData(roughPixels, 0, 0);
  const rough = new THREE.CanvasTexture(roughCanvas); rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(2, 2);
  const normalPixels = rc.createImageData(size, size); const d = roughPixels.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, l = d[(y * size + ((x + size - 1) % size)) * 4], r = d[(y * size + ((x + 1) % size)) * 4], u = d[(((y + size - 1) % size) * size + x) * 4], down = d[(((y + 1) % size) * size + x) * 4];
    const nx = (l - r) / 16, ny = (u - down) / 16, nz = 1, mag = Math.hypot(nx, ny, nz);
    normalPixels.data[i] = (nx / mag * .5 + .5) * 255; normalPixels.data[i + 1] = (ny / mag * .5 + .5) * 255; normalPixels.data[i + 2] = (nz / mag * .5 + .5) * 255; normalPixels.data[i + 3] = 255;
  }
  const normalCanvas = document.createElement('canvas'); normalCanvas.width = normalCanvas.height = size; normalCanvas.getContext('2d').putImageData(normalPixels, 0, 0);
  const normal = new THREE.CanvasTexture(normalCanvas); normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.repeat.set(2, 2); normal.colorSpace = THREE.NoColorSpace;
  return { color, rough, normal, canvases: [canvas, roughCanvas, normalCanvas] };
}
let maps = textureSet(settings.weather);
function buildMaterials() {
  Object.assign(shared, {
    stone: new THREE.MeshStandardMaterial({ map: maps.color, roughnessMap: maps.rough, normalMap: maps.normal, normalScale: new THREE.Vector2(.36, .36), roughness: .94 }),
    cutStone: makeMaterial('#d8cbb6', .88), shadowStone: makeMaterial('#ad9e87', .94), iron: makeMaterial('#292a27', .53, { metalness: .58 }), ironEdge: makeMaterial('#5b5549', .4, { metalness: .65 }), glass: makeMaterial('#43505a', .2, { metalness: .45, roughness: .24, emissive: '#242322', emissiveIntensity: .12 }), glassLight: makeMaterial('#87929a', .2, { metalness: .42, roughness: .2 }), dark: makeMaterial('#262725', .83), wood: makeMaterial('#514438', .76), gold: makeMaterial('#a68a5c', .45, { metalness: .45 }), pavement: makeMaterial('#aaa398', .98), roof: makeMaterial('#55534e', .76), warm: makeMaterial('#e7c894', .38, { emissive: '#ad7840', emissiveIntensity: .26 }),
  });
}
buildMaterials();
function mesh(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, cast = true) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
function block(parent, x, y, z, sx, sy, sz, material = shared.stone) { return mesh(parent, boxGeometry, material, x, y, z, sx, sy, sz); }
function rod(parent, x1, y1, z1, x2, y2, z2, radius, material = shared.iron, radial = 6) {
  const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2), delta = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), radial), material); m.position.copy(a.add(b).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); m.castShadow = true; parent.add(m); return m;
}
function curve(parent, points, radius = .018, material = shared.iron) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(10, points.length * 4), radius, 5, false), material); m.castShadow = true; parent.add(m);
}
function ornament(parent, x, y, z, scale = 1, material = shared.cutStone) {
  block(parent, x, y, z, .44 * scale, .13 * scale, .12, material);
  const leaf = mesh(parent, new THREE.OctahedronGeometry(.16 * scale, 0), material, x, y + .17 * scale, z, .8, 1.35, .45);
  leaf.rotation.z = Math.PI / 4;
  for (const side of [-1, 1]) {
    curve(parent, [[x, y + .06 * scale, z], [x + side * .11 * scale, y + .16 * scale, z], [x + side * .2 * scale, y + .14 * scale, z], [x + side * .23 * scale, y + .04 * scale, z]], .025 * scale, material);
  }
}

function createWindow(parent, cx, base, w, h, detail, balcony) {
  const z = .34, frame = .105, innerW = w * .66, openingH = h * .71, bottom = base + .16;
  // A deep reveal, paired glazed leaves, louvered shutters and carved masonry surround.
  block(parent, cx, bottom + h * .39, .16, innerW + .12, openingH + .12, .15, shared.dark);
  block(parent, cx - w * .38, bottom + h * .38, z, frame, h * .88, .24, shared.cutStone);
  block(parent, cx + w * .38, bottom + h * .38, z, frame, h * .88, .24, shared.cutStone);
  block(parent, cx, bottom + h * .82, z, w * .88, frame * 1.12, .24, shared.cutStone);
  block(parent, cx, bottom + .07, .44, w * .98, .15, .58, shared.cutStone);
  block(parent, cx, bottom + .16, .64, w * 1.03, .055, .42, shared.shadowStone);
  block(parent, cx, bottom + openingH * .47, .29, innerW, openingH, .07, shared.glass);
  block(parent, cx - .015, bottom + openingH * .47, .335, .028, openingH * .98, .04, shared.cutStone);
  block(parent, cx, bottom + openingH * .18, .34, innerW * .96, .035, .06, shared.cutStone);
  for (const side of [-1, 1]) {
    const shutterX = cx + side * (w * .38 - .11);
    block(parent, shutterX, bottom + openingH * .48, .37, .16, openingH * .91, .1, shared.wood);
    for (let i = 0; i < 12; i++) block(parent, shutterX, bottom + .25 + i * (openingH * .72 / 12), .435, .15, .022, .024, shared.ironEdge);
    if (detail) {
      block(parent, cx + side * (w * .38), bottom + h * .37, .48, .19, .075, .17, shared.cutStone);
      block(parent, cx + side * (w * .38), bottom + h * .78, .48, .19, .075, .17, shared.cutStone);
    }
  }
  // A narrow fanlight and layered keystone crown articulate the window head.
  block(parent, cx, bottom + openingH + .11, .38, innerW + .13, .11, .21, shared.cutStone);
  block(parent, cx, bottom + openingH + .18, .4, w * .89, .08, .28, shared.cutStone);
  block(parent, cx, bottom + openingH + .25, .4, w * .68, .055, .3, shared.shadowStone);
  if (detail) ornament(parent, cx, bottom + openingH + .38, .49, .55, shared.cutStone);
  if (balcony) createBalcony(parent, cx, base + .15, w);
}

function createBalcony(parent, cx, floor, w) {
  const z = .93, width = w * .9, railH = .55, y = floor + .18;
  block(parent, cx, y, .68, width + .2, .1, .86, shared.cutStone);
  block(parent, cx, y + .08, .9, width, .045, .48, shared.ironEdge);
  rod(parent, cx - width / 2, y + railH, z, cx + width / 2, y + railH, z, .028, shared.ironEdge);
  rod(parent, cx - width / 2, y + .13, z, cx + width / 2, y + .13, z, .023, shared.iron);
  const count = Math.max(7, Math.floor(width / .16));
  for (let i = 0; i <= count; i++) {
    const x = cx - width / 2 + width * i / count;
    rod(parent, x, y + .13, z, x, y + railH, z, i % 3 === 0 ? .018 : .012, i % 3 === 0 ? shared.ironEdge : shared.iron, 5);
    if (i < count && i % 2 === 0) {
      const mid = x + width / count / 2, r = width / count * .36;
      curve(parent, [[mid - r, y + .22, z], [mid - r, y + .32, z], [mid, y + .36, z], [mid + r, y + .32, z], [mid + r, y + .22, z]], .013);
      mesh(parent, sphereGeometry, shared.gold, mid, y + .37, z, .028, .043, .028, false);
    }
  }
  for (const side of [-1, 1]) {
    const x = cx + side * width * .34;
    curve(parent, [[x, y + .18, z], [x + side * .05, y + .32, z], [x, y + .38, z], [x - side * .03, y + .35, z], [x, y + .26, z]], .017);
  }
}

function createShop(parent, cx, base, w, index, enabled) {
  const z = .32, bodyW = w * .83, h = 2.45;
  block(parent, cx, base + h * .5, .18, bodyW, h, .18, shared.dark);
  block(parent, cx, base + h * .48, .28, bodyW * .9, h * .73, .04, index % 3 === 1 ? shared.warm : shared.glass);
  if (index % 3 === 1) {
    block(parent, cx, base + h * .83, .38, bodyW * .93, .25, .08, shared.wood);
    for (let i = -2; i <= 2; i++) block(parent, cx + i * bodyW * .17, base + h * .83, .44, .025, .24, .02, shared.ironEdge);
  } else {
    block(parent, cx - bodyW * .19, base + h * .51, .39, .025, h * .68, .05, shared.cutStone);
    block(parent, cx + bodyW * .19, base + h * .51, .39, .025, h * .68, .05, shared.cutStone);
  }
  block(parent, cx, base + h + .11, .34, w * .97, .19, .4, shared.cutStone);
  block(parent, cx, base + h + .22, .35, w * .88, .055, .42, shared.shadowStone);
  if (enabled) {
    block(parent, cx - w * .43, base + h * .48, .4, .12, h * .9, .28, shared.cutStone);
    block(parent, cx + w * .43, base + h * .48, .4, .12, h * .9, .28, shared.cutStone);
    block(parent, cx, base + .08, .5, w * .91, .17, .36, shared.roof);
    if (index % 2 === 0) block(parent, cx, base + h + .37, .38, w * .73, .1, .43, shared.dark);
  }
}

function createFacade() {
  const group = new THREE.Group(), bay = 2.65, width = settings.bays * bay, ground = 3.45, level = 2.68, floorsAbove = settings.floors - 1, height = ground + level * floorsAbove;
  const features = settings.features, center = (settings.bays - 1) / 2;
  block(group, 0, height / 2, -.18, width + .18, height, .52, shared.stone);
  // Rusticated base and the continuous string courses that lock each module together.
  block(group, 0, .17, .16, width + .28, .34, .7, shared.roof);
  for (let x = -width / 2; x <= width / 2 + .01; x += bay / 2) block(group, x, .61, .14, bay * .49, .08, .54, shared.shadowStone);
  block(group, 0, ground - .09, .23, width + .36, .22, .82, shared.cutStone);
  for (let f = 1; f <= floorsAbove; f++) {
    const y = ground + (f - 1) * level;
    block(group, 0, y, .17, width + .25, .19, .72, shared.cutStone);
    block(group, 0, y + .12, .19, width + .32, .055, .78, shared.shadowStone);
  }
  for (let i = 0; i <= settings.bays; i++) {
    const x = -width / 2 + i * bay;
    if (i === 0 || i === settings.bays || i % 2 === 0) {
      block(group, x, height / 2, .19, .21, height - .35, .73, shared.cutStone);
      for (let f = 0; f < floorsAbove; f++) {
        const fy = ground + f * level;
        block(group, x, fy + level * .84, .21, .31, .12, .82, shared.shadowStone);
        block(group, x, fy + level * .84 + .08, .22, .38, .055, .87, shared.cutStone);
      }
    }
  }
  for (let i = 0; i < settings.bays; i++) {
    const x = -width / 2 + bay * (i + .5);
    if (features.shops) createShop(group, x, 0, bay, i, features.details);
    for (let f = 0; f < floorsAbove; f++) {
      const fy = ground + f * level;
      if (features.windows) createWindow(group, x, fy, 1.05, level * .91, features.details, features.balconies && f > 0);
      else block(group, x, fy + level * .5, .17, .86, level * .75, .08, shared.cutStone);
      if (features.details) {
        block(group, x - bay * .39, fy + level * .51, .21, .07, level * .62, .57, shared.cutStone);
        block(group, x + bay * .39, fy + level * .51, .21, .07, level * .62, .57, shared.cutStone);
        if (f === 0) {
          block(group, x, fy + level - .1, .27, bay * .91, .14, .8, shared.cutStone);
          ornament(group, x, fy + level + .1, .37, .58);
        }
      }
    }
  }
  // Dentils, projecting cornice, and an inhabited mansard silhouette.
  const corniceY = height + .13;
  block(group, 0, height - .12, .25, width + .42, .24, .9, shared.shadowStone);
  block(group, 0, corniceY, .3, width + .62, .16, 1.02, shared.cutStone);
  block(group, 0, corniceY + .14, .26, width + .78, .14, 1.13, shared.shadowStone);
  block(group, 0, corniceY + .25, .27, width + .92, .12, 1.2, shared.cutStone);
  for (let x = -width / 2 + .25; x < width / 2; x += .38) block(group, x, height - .31, .35, .13, .2, .3, shared.cutStone);
  if (settings.roof === 'mansard') {
    const roofTop = corniceY + 1.36;
    const profile = new THREE.Shape();
    profile.moveTo(-width / 2 - .08, corniceY);
    profile.lineTo(-width / 2 + 1.12, roofTop);
    profile.lineTo(width / 2 - 1.12, roofTop);
    profile.lineTo(width / 2 + .08, corniceY);
    profile.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(profile, { depth: 1.75, bevelEnabled: true, bevelThickness: .055, bevelSize: .06, bevelSegments: 1 }), shared.roof);
    roof.position.z = -.62; roof.castShadow = true; roof.receiveShadow = true; group.add(roof);
    block(group, 0, corniceY + .48, -.04, width + .32, .17, .72, shared.cutStone);
    for (let i = 0; i < settings.bays; i++) {
      const x = -width / 2 + bay * (i + .5);
      block(group, x, corniceY + .79, .08, .56, .54, .1, shared.dark);
      block(group, x, corniceY + .81, .14, .46, .41, .03, shared.glassLight);
      block(group, x, corniceY + 1.07, .1, .7, .11, .23, shared.cutStone);
      block(group, x, corniceY + .53, .13, .7, .1, .24, shared.cutStone);
      rod(group, x - .2, corniceY + .62, .2, x - .2, corniceY + .99, .2, .012, shared.iron);
      rod(group, x + .2, corniceY + .62, .2, x + .2, corniceY + .99, .2, .012, shared.iron);
    }
    if (features.details) {
      block(group, 0, roofTop, 0, width * .66, .18, .65, shared.cutStone);
      for (let i = 0; i <= settings.bays; i++) {
        const x = -width * .33 + i * (width * .66 / settings.bays);
        block(group, x, roofTop + .42, .16, .12, .7, .16, shared.cutStone);
        mesh(group, sphereGeometry, shared.cutStone, x, roofTop + .78, .16, .17, .12, .17);
      }
      block(group, 0, roofTop + .83, .16, width * .68, .15, .42, shared.cutStone);
      block(group, 0, roofTop + .95, .16, width * .7, .08, .47, shared.shadowStone);
    }
  } else if (settings.roof === 'parapet') {
    block(group, 0, corniceY + .5, .05, width + .3, .62, .5, shared.cutStone);
    block(group, 0, corniceY + .84, .08, width + .52, .14, .72, shared.shadowStone);
    for (let x = -width / 2; x < width / 2; x += .48) block(group, x + .24, corniceY + .55, .38, .12, .44, .15, shared.shadowStone);
  } else {
    block(group, 0, corniceY + .26, .03, width + .25, .27, .5, shared.roof);
  }
  return group;
}

const ground = mesh(scene, new THREE.PlaneGeometry(200, 200), shared.pavement, 0, -.07, 0, 1, 1, 1, false);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
const shadowPad = mesh(scene, new THREE.CircleGeometry(18, 64), makeMaterial('#c9c4b9', 1, { transparent: true, opacity: .38 }), 0, -.065, 0, 1, 1, .7, false);
shadowPad.rotation.x = -Math.PI / 2;

function rebuild() {
  const old = building; scene.remove(old);
  old.traverse(o => { if (o.isMesh && o.geometry !== boxGeometry && o.geometry !== sphereGeometry) o.geometry.dispose(); });
  building = createFacade(); scene.add(building);
  if (settings.wire) building.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.wireframe = true; });
  const width = settings.bays * 2.65;
  controls.target.set(0, (3.45 + (settings.floors - 1) * 2.68) * .51, 0);
  camera.position.set(width * .99, settings.floors * 2.8, width * 1.42);
  camera.lookAt(controls.target); controls.update();
  document.querySelector('#scene-stats').textContent = `${settings.floors} FLOORS · ${settings.bays} BAYS`;
  document.querySelector('#floor-output').textContent = `${settings.floors} floors`;
  document.querySelector('#bay-output').textContent = `${settings.bays} bays`;
}
rebuild();

function updateRange(input) { const pct = (input.value - input.min) / (input.max - input.min) * 100; input.style.setProperty('--fill', `${pct}%`); }
document.querySelectorAll('input[type=range]').forEach(updateRange);
function updateWeather(value) {
  settings.weather = Number(value); maps.color.dispose(); maps.rough.dispose(); maps.normal.dispose(); maps = textureSet(settings.weather);
  shared.stone.map = maps.color; shared.stone.roughnessMap = maps.rough; shared.stone.normalMap = maps.normal; shared.stone.needsUpdate = true;
  const swatch = document.querySelector('.material-swatch'); swatch.style.filter = `sepia(${settings.weather * .003}) contrast(${1 + settings.weather * .001})`;
  document.querySelector('#weather-output').textContent = `${settings.weather}%`;
}
document.querySelector('#floors').addEventListener('input', e => { settings.floors = Number(e.target.value); updateRange(e.target); rebuild(); });
document.querySelector('#bays').addEventListener('input', e => { settings.bays = Number(e.target.value); updateRange(e.target); rebuild(); });
document.querySelector('#roofline').addEventListener('change', e => { settings.roof = e.target.value; rebuild(); });
let weatherTimer;
document.querySelector('#weathering').addEventListener('input', e => {
  updateRange(e.target); document.querySelector('#weather-output').textContent = `${e.target.value}%`;
  clearTimeout(weatherTimer); weatherTimer = setTimeout(() => updateWeather(e.target.value), 120);
});
document.querySelectorAll('.toggle').forEach(button => button.addEventListener('click', () => {
  button.classList.toggle('active'); settings.features[button.dataset.feature] = button.classList.contains('active'); rebuild();
}));
let seedNo = 4;
document.querySelector('#randomize').addEventListener('click', () => {
  seedNo++; settings.bays = 5 + seedNo % 4; settings.floors = 4 + seedNo % 3; settings.roof = ['mansard', 'parapet', 'cornice'][seedNo % 3];
  document.querySelector('#bays').value = settings.bays; document.querySelector('#floors').value = settings.floors; document.querySelector('#roofline').value = settings.roof;
  updateRange(document.querySelector('#bays')); updateRange(document.querySelector('#floors')); rebuild(); toast(`FACADE STUDY ${String(seedNo).padStart(2, '0')} GENERATED`);
});
document.querySelector('#wireframe').addEventListener('click', e => {
  settings.wire = !settings.wire; building.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.wireframe = settings.wire; }); e.currentTarget.classList.toggle('selected', settings.wire);
});
document.querySelector('#shadows').addEventListener('click', e => { settings.shadows = !settings.shadows; renderer.shadowMap.enabled = settings.shadows; key.castShadow = settings.shadows; e.currentTarget.classList.toggle('selected', settings.shadows); rebuild(); });
document.querySelector('#reset-view').addEventListener('click', () => rebuild());
document.querySelector('#fullscreen').addEventListener('click', () => { if (!document.fullscreenElement) host.requestFullscreen?.(); else document.exitFullscreen?.(); });
let selectedModule = 'facade';
document.querySelectorAll('.kit-card').forEach(card => card.addEventListener('click', () => { document.querySelectorAll('.kit-card').forEach(c => c.classList.remove('selected')); card.classList.add('selected'); selectedModule = card.dataset.module; }));
document.querySelector('#add-module').addEventListener('click', () => {
  if (selectedModule === 'facade') {
    if (settings.bays >= 9) return toast('FACADE IS AT MAXIMUM WIDTH');
    settings.bays++;
    document.querySelector('#bays').value = settings.bays;
    updateRange(document.querySelector('#bays'));
  } else if (selectedModule === 'cornice') {
    settings.roof = 'cornice'; document.querySelector('#roofline').value = 'cornice';
  } else {
    const feature = selectedModule === 'window' ? 'windows' : selectedModule === 'balcony' ? 'balconies' : 'shops';
    settings.features[feature] = true;
    document.querySelector(`.toggle[data-feature="${feature}"]`).classList.add('active');
  }
  rebuild(); toast(`${selectedModule.toUpperCase()} MODULE ADDED TO FACADE`);
});
let toastTimer;
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
function downloadBlob(blob, name) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1200); }
document.querySelector('#export-textures').addEventListener('click', () => {
  clearTimeout(weatherTimer); updateWeather(document.querySelector('#weathering').value);
  ['albedo', 'roughness', 'normal'].forEach((name, index) => maps.canvases[index].toBlob(blob => downloadBlob(blob, `haussmann-limestone-${name}-1k.png`), 'image/png'));
  toast('PBR MAPS GENERATED · ALBEDO / ROUGHNESS / NORMAL');
});
document.querySelector('#export-model').addEventListener('click', () => {
  const button = document.querySelector('#export-model'); button.disabled = true; button.innerHTML = '<span>…</span> PREPARING GLB';
  new GLTFExporter().parse(building, result => {
    downloadBlob(new Blob([result], { type: 'model/gltf-binary' }), `parisian-facade-${settings.bays}bay.glb`);
    button.disabled = false; button.innerHTML = '<span>↓</span> EXPORT MODEL'; toast('GLB MODEL EXPORTED');
  }, error => { console.error(error); button.disabled = false; button.innerHTML = '<span>↓</span> EXPORT MODEL'; toast('MODEL EXPORT FAILED'); }, { binary: true, onlyVisible: true });
});

function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host); resize();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
document.querySelector('#loading').style.opacity = '0';
