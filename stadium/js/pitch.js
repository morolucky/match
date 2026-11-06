import * as THREE from 'three';
import { makeLoop, scaleUV, tubes } from './geom.js';
import { PLAN, seatGeometry } from './stadium.js';

const L = 105, W = 68; // FIFA pitch

function lineTexture() {
  const mx = 2, ppm = 38; // margin (m), pixels per metre
  const c = document.createElement('canvas');
  c.width = Math.round((L + mx * 2) * ppm);
  c.height = Math.round((W + mx * 2) * ppm);
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.scale(ppm, ppm);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 0.12;
  const rect = (x, y, w, h) => g.strokeRect(x, y, w, h);
  const arc = (x, y, r, a0, a1) => { g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke(); };
  const spot = (x, y, r = 0.12) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  rect(-L / 2, -W / 2, L, W);
  g.beginPath(); g.moveTo(0, -W / 2); g.lineTo(0, W / 2); g.stroke();
  arc(0, 0, 9.15, 0, Math.PI * 2);
  spot(0, 0, 0.2);
  for (const s of [-1, 1]) {
    const gx = (s * L) / 2;
    rect(s > 0 ? gx - 16.5 : gx, -20.16, 16.5, 40.32);
    rect(s > 0 ? gx - 5.5 : gx, -9.16, 5.5, 18.32);
    spot(gx - s * 11, 0);
    const a = Math.acos(5.5 / 9.15);
    if (s > 0) arc(gx - 11, 0, 9.15, Math.PI - a, Math.PI + a);
    else arc(gx + 11, 0, 9.15, -a, a);
    for (const t of [-1, 1]) {
      const cy = (t * W) / 2;
      const start = s > 0 ? (t > 0 ? Math.PI : Math.PI / 2) : (t > 0 ? -Math.PI / 2 : 0);
      arc(gx, cy, 1, start, start + Math.PI / 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, w: L + mx * 2, h: W + mx * 2 };
}

function goal(M) {
  const g = new THREE.Group();
  g.name = 'Goal';
  const HW = 3.66, H = 2.44, R = 0.06;
  const frame = tubes([
    [0, 0, -HW, 0, H, -HW, R], [0, 0, HW, 0, H, HW, R], [0, H, -HW - R, 0, H, HW + R, R],
  ], M.whitePaint, 16);
  frame.castShadow = true;
  const support = tubes([
    [0.05, H, -HW, 1, H, -HW, 0.025], [0.05, H, HW, 1, H, HW, 0.025], [1, H, -HW, 2, 0.02, -HW, 0.025],
    [1, H, HW, 2, 0.02, HW, 0.025], [2, 0.02, -HW, 2, 0.02, HW, 0.025], [1, H, -HW, 1, H, HW, 0.025],
  ], M.steel, 8);
  const top = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(1, 2 * HW), 1, 2 * HW), M.net);
  top.rotation.x = -Math.PI / 2;
  top.position.set(0.5, H, 0);
  const backLen = Math.hypot(1, H);
  const back = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(2 * HW, backLen), 2 * HW, backLen), M.net);
  back.position.set(1.5, H / 2, 0);
  back.rotation.y = -Math.PI / 2;
  back.rotateX(Math.atan2(1, H));
  const sideShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, H), new THREE.Vector2(1, H), new THREE.Vector2(2, 0)]);
  const sideGeo = new THREE.ShapeGeometry(sideShape);
  [-HW, HW].forEach((z) => { const s = new THREE.Mesh(sideGeo, M.net); s.position.z = z; g.add(s); });
  g.add(frame, support, top, back);
  g.traverse((o) => { if (o.isMesh && o.material === M.net) o.castShadow = true; });
  return g;
}

function dugout(M, seatGeo) {
  const g = new THREE.Group();
  g.name = 'Dugout';
  const len = 11;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 2.6), M.concrete);
  slab.position.y = 0.1;
  slab.receiveShadow = true;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, len, 32, 1, true, Math.PI * 0.42, Math.PI * 0.62), M.fabric);
  shell.rotation.z = Math.PI / 2;
  shell.position.set(0, 0.2, 0.3);
  shell.castShadow = true;
  const caps = [-len / 2, len / 2].map((x) => {
    const c = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24, -Math.PI * 0.04, Math.PI * 0.62), M.glass);
    c.rotation.y = Math.PI / 2;
    c.position.set(x, 0.2, 0.3);
    return c;
  });
  const n = 18, mats = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {
    const m = new THREE.Matrix4().makeTranslation(-len / 2 + 0.5 + i * ((len - 1) / (n - 1)), 0.2 + r * 0.35, 0.5 - r * 0.8);
    mats.push(m);
  }
  const seats = new THREE.InstancedMesh(seatGeo, M.seatRed, mats.length);
  mats.forEach((m, i) => seats.setMatrixAt(i, m));
  seats.computeBoundingSphere();
  const step = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.9), M.concrete);
  step.position.set(0, 0.375, -0.3);
  g.add(slab, shell, ...caps, seats, step);
  return g;
}

export function buildPitch(M) {
  const root = new THREE.Group();
  root.name = 'Pitch_Assets';
  const flags = [];

  // Site: plaza disc + landscape.
  const land = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), M.plazaGround);
  land.rotation.x = -Math.PI / 2;
  land.position.y = -0.4;
  land.receiveShadow = true;
  land.name = 'Landscape';
  const plaza = new THREE.Mesh(scaleUV(new THREE.CircleGeometry(190, 96), 380 / 6, 380 / 4), M.concrete);
  plaza.rotation.x = -Math.PI / 2;
  plaza.receiveShadow = true;
  plaza.name = 'Plaza';
  root.add(land, plaza);

  // Bowl floor (tartan apron) inside the front wall.
  const lp = makeLoop(PLAN.a, PLAN.b, PLAN.n, 256);
  const shape = new THREE.Shape(Array.from({ length: lp.count }, (_, i) => new THREE.Vector2(lp.x[i], -lp.z[i])));
  // polygonOffset layering avoids z-fighting between the stacked ground planes at distance.
  const apronMat = M.tartan;
  apronMat.polygonOffset = true;
  apronMat.polygonOffsetFactor = -2;
  apronMat.polygonOffsetUnits = -2;
  const apron = new THREE.Mesh(new THREE.ShapeGeometry(shape), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = 0.02;
  apron.receiveShadow = true;
  apron.name = 'Apron_Tartan';
  root.add(apron);

  // Pitch: PBR grass, mow stripes come from the albedo; ~5 m stripes.
  const GL = 117, GW = 82;
  Object.assign(M.grass, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const grass = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(GL, GW), GL / 40, GW / 26.6), M.grass);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.04;
  grass.receiveShadow = true;
  grass.name = 'Pitch_Grass';
  const lt = lineTexture();
  lt.tex.anisotropy = 16;
  const linesMat = new THREE.MeshStandardMaterial({
    name: 'Pitch_Lines', map: lt.tex, transparent: true, depthWrite: false, roughness: 0.85, color: 0xeeeeee,
    polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(lt.w, lt.h), linesMat);
  lines.rotation.x = -Math.PI / 2;
  lines.position.y = 0.05;
  lines.receiveShadow = true;
  lines.name = 'Pitch_Lines';
  root.add(grass, lines);

  // Goals.
  [1, -1].forEach((s) => {
    const g = goal(M);
    g.position.x = (s * L) / 2;
    if (s < 0) g.rotation.y = Math.PI;
    root.add(g);
  });

  // Corner flags.
  const flagGeo = new THREE.PlaneGeometry(0.45, 0.32, 10, 4);
  flagGeo.translate(0.225, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), M.whitePaint);
    pole.position.set((sx * L) / 2, 0.8, (sz * W) / 2);
    pole.castShadow = true;
    const fg = flagGeo.clone();
    const flag = new THREE.Mesh(fg, M.flag);
    flag.position.set((sx * L) / 2, 1.42, (sz * W) / 2);
    flag.castShadow = true;
    flag.userData.base = Float32Array.from(fg.attributes.position.array);
    flag.userData.phase = sx * 1.3 + sz * 0.7;
    flags.push(flag);
    root.add(pole, flag);
  }

  // Perimeter LED boards (2:1 ad blocks on a 0.9 m board → 14.4 m texture tile).
  const boardH = 0.9;
  const addBoard = (len, x, z, ry) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(len, boardH, 0.3), M.darkSteel);
    body.position.set(0, boardH / 2 + 0.05, -0.16);
    body.castShadow = true;
    const face = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(len, boardH), len / 14.4, 1), M.led);
    face.position.y = boardH / 2 + 0.05;
    g.add(body, face);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.name = 'LED_Board';
    root.add(g);
  };
  addBoard(108, 0, 38.5, Math.PI);
  addBoard(108, 0, -38.5, 0);
  [-1, 1].forEach((s) => {
    addBoard(26, s * 57, -24, -s * Math.PI / 2);
    addBoard(26, s * 57, 24, -s * Math.PI / 2);
  });

  // Dugouts on the near touchline.
  const seatGeo = seatGeometry();
  [-14, 14].forEach((x) => {
    const d = dugout(M, seatGeo);
    d.position.set(x, 0, 36.2);
    d.rotation.y = Math.PI;
    root.add(d);
  });

  root.traverse((o) => { if (o.isMesh && o.castShadow === false && o.name !== 'Landscape') o.receiveShadow = true; });

  function update(t) {
    for (const f of flags) {
      const pos = f.geometry.attributes.position, b = f.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3];
        pos.setZ(i, Math.sin(x * 9 - t * 6 + f.userData.phase) * 0.06 * (x / 0.45));
      }
      pos.needsUpdate = true;
    }
  }
  return { root, update };
}
