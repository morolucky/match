// Rainwater system: gutters and downspouts
import * as THREE from 'three';
import { D } from '../params.js';
import { PI_ } from '../materials.js';
import { PP, bake, bx } from '../kit.js';

/* ===== rainwater system: half-round gutters on the cornice, offset downspouts at the four corners (jog around the cornice), wall brackets, ground grates ===== */
function pipeSeg(g, a, b, r, m) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length(); if (L < 1e-3) return;
  const o = PP(g, new THREE.CylinderGeometry(r, r, L, 10), m, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); }
function buildDrain() {
  const Ht = D.gh + (D.floors - 1) * D.fh, w = D.w, d = D.d, r = 0.095, pr = 0.05, g0 = 0.2, X = w / 2 + g0, Z = d / 2 + g0, y = Ht + 0.245, pg = new THREE.Group();
  const half = (len, alongX, x, z) => { const ge = new THREE.CylinderGeometry(r, r, len, 14, 1, true, PI_, PI_); ge.rotateZ(PI_ / 2); if (!alongX) ge.rotateY(PI_ / 2); PP(pg, ge, 'zinc', x, y, z); };
  const gut = D.roof != 'flat';
  if (gut) { half(2 * X + 2 * r, true, 0, Z); half(2 * X + 2 * r, true, 0, -Z); half(2 * Z + 2 * r, false, X, 0); half(2 * Z + 2 * r, false, -X, 0); }
  if (gut) for (const sg of [-1, 1]) { // rolled beads on both gutter lips, fascia plate behind the gutter, hangers every ~1.1 m
    for (const e of [-1, 1]) {
      const bX = new THREE.CylinderGeometry(0.014, 0.014, 2 * X + 2 * r, 6); bX.rotateZ(PI_ / 2); PP(pg, bX, 'zinc', 0, y, sg * (Z + e * r));
      const bZ = new THREE.CylinderGeometry(0.014, 0.014, 2 * Z + 2 * r, 6); bZ.rotateX(PI_ / 2); PP(pg, bZ, 'zinc', sg * (X + e * r), y, 0);
    }
    bx(pg, 'zinc', 2 * X + 2 * r, 0.32, 0.02, 0, y + 0.05, sg * (Z - r - 0.01));
    bx(pg, 'zinc', 0.02, 0.32, 2 * Z + 2 * r, sg * (X - r - 0.01), y + 0.05, 0);
    for (let x = -X + 0.6; x < X - 0.3; x += 1.1) bx(pg, 'iron', 0.03, 0.018, 2 * r + 0.04, x, y - r, sg * Z);
    for (let z = -Z + 0.6; z < Z - 0.3; z += 1.1) bx(pg, 'iron', 2 * r + 0.04, 0.018, 0.03, sg * X, y - r, z);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    if (gut) PP(pg, new THREE.SphereGeometry(r, 10, 6, 0, PI_ * 2, PI_ / 2, PI_ / 2), 'zinc', sx * X, y, sz * Z);
    // downspout hugs the wall face (0.45 m in from the corner, clear of window frames): it jogs out only to clear the cornice, then returns flush to the wall
    const xi = 0.45, o0 = pr + 0.012, oc = 0.52, Qf = (off, yy) => [sx * (w / 2 - xi), yy, sz * (d / 2 + off)], flat = D.roof == 'flat';
    const tail = [Qf(o0, 0.3), Qf(o0, 0.14), Qf(0.3, 0.1)];
    const pts = flat ? [Qf(o0, Ht - 0.75), Qf(oc, Ht - 0.75), Qf(oc, Ht - 0.95), Qf(o0, Ht - 1.15), ...tail]
      : [Qf(g0, Ht + 0.2), Qf(oc, Ht + 0.1), Qf(oc, Ht - 0.5), Qf(o0, Ht - 0.85), ...tail];
    if (flat) bx(pg, 'zinc', 0.22, 0.2, 0.22, sx * (w / 2 - xi), Ht - 0.75, sz * (d / 2 + oc));
    for (let i = 0; i < pts.length - 1; i++) pipeSeg(pg, pts[i], pts[i + 1], pr, 'zinc');
    for (let i = 1; i < pts.length - 1; i++) PP(pg, new THREE.SphereGeometry(pr * 1.2, 8, 6), 'zinc', pts[i][0], pts[i][1], pts[i][2]);
    const px = sx * (w / 2 - xi), pz = sz * (d / 2 + o0);
    for (let yy = Ht - 1.5; yy > 0.6; yy -= 1.6) { const t = PP(pg, new THREE.TorusGeometry(pr * 1.3, 0.012, 5, 12), 'iron', px, yy, pz); t.rotation.x = PI_ / 2;
      bx(pg, 'iron', 0.05, 0.03, o0, px, yy, sz * (d / 2 + o0 / 2)); }
    const gz = sz * (d / 2 + 0.25); bx(pg, 'frame', 0.5, 0.04, 0.5, px, 0.02, gz); for (let i = -2; i <= 2; i++) bx(pg, 'iron', 0.02, 0.03, 0.4, px + i * 0.09, 0.055, gz);
  }
  bake(pg);
}

export { pipeSeg, buildDrain };
