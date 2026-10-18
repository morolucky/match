// Detail pass: shutters, cornice, parapet, street lamp, roller shutters
import * as THREE from 'three';
import { D } from '../params.js';
import { PI_ } from '../materials.js';
import { PP, bake, bx } from '../kit.js';
import { corbel } from './windows.js';
import { S } from '../../core/state.js';

/* ===== detail pass (from reference sheet): louvred shutters, dentil cornice + corbels, rooftop parapet, scroll street lamp, roller-shutter shop opening ===== */
function shutterLeaf(g, hx, sgn, sw, h, phi) { const L = new THREE.Group(); L.position.set(hx, 0, 0.06); L.rotation.y = sgn > 0 ? -phi : PI_ + phi; g.add(L);
  const th = 0.04, y0 = -0.02, hh = h + 0.04;
  for (const x of [0.03, sw - 0.03]) bx(L, S.SH, 0.06, hh, th, x, y0 + hh / 2, 0);
  for (const y of [y0 + 0.03, y0 + hh - 0.03]) bx(L, S.SH, sw, 0.06, th, sw / 2, y, 0);
  bx(L, S.SH, sw - 0.1, 0.05, th, sw / 2, y0 + hh * 0.5, 0);
  for (let y = y0 + 0.1; y < y0 + hh - 0.08; y += 0.07) { const o = bx(L, S.SH, sw - 0.1, 0.045, 0.012, sw / 2, y, 0.004); o.rotation.x = 0.55; }
  const kn = PP(L, new THREE.SphereGeometry(0.02, 6, 4), 'brass', sw - 0.08, hh * 0.5, 0.03); }
function shutters(g, w, h, bal, r) { if (bal) return; const sw = Math.min(w / 2 - 0.02, 0.62), phi = 1.35;
  for (const sg of [-1, 1]) shutterLeaf(g, sg * (w / 2 + 0.27), sg, sw, h, phi); }
function buildCornice() {
  const Ht = D.gh + (D.floors - 1) * D.fh, w = D.w, d = D.d, flat = D.roof == 'flat', cg = new THREE.Group();
  const side = (L, px, pz, ry) => { const g = new THREE.Group(); g.position.set(px, 0, pz); g.rotation.y = ry; cg.add(g);
    bx(g, 'stone', L + 0.06, 0.22, 0.06, 0, Ht - 0.55, 0.03);
    for (let x = -L / 2 + 0.1; x < L / 2 - 0.05; x += 0.16) bx(g, 'stone', 0.07, 0.1, 0.1, x, Ht - 0.33, 0.08);
    bx(g, 'stone', L + 0.2, 0.06, 0.22, 0, Ht - 0.25, 0.11); bx(g, 'stone', L + 0.36, 0.1, 0.36, 0, Ht - 0.17, 0.18); bx(g, 'stone', L + 0.42, 0.06, 0.42, 0, Ht - 0.09, 0.2);
    const nC = Math.max(2, Math.round(L / 2.4)); for (let i = 0; i < nC; i++) corbel(g, -L / 2 + (i + 0.5) * L / nC, Ht - 0.17, i % 2 ? 1 : -1);
    if (flat) { bx(g, 'stone', L, 0.8, 0.22, 0, Ht + 0.4, 0.08); bx(g, 'stone', L + 0.3, 0.09, 0.36, 0, Ht + 0.845, 0.075); bx(g, 'stone', L - 0.6, 0.42, 0.025, 0, Ht + 0.4, 0.2);
      const nP = Math.max(1, Math.round(L / 3.2)); for (let i = 0; i <= nP; i++) { const x = -L / 2 + i * L / nP; bx(g, 'stone', 0.42, 0.86, 0.3, x, Ht + 0.43, 0.1); bx(g, 'stone', 0.54, 0.07, 0.42, x, Ht + 0.9, 0.1); } } };
  side(w, 0, d / 2, 0); side(w, 0, -d / 2, PI_); side(d, w / 2, 0, PI_ / 2); side(d, -w / 2, 0, -PI_ / 2); bake(cg); }
function buildLamp() {
  const w = D.w, d = D.d, lg = new THREE.Group(); lg.position.set(w / 2 + 2, 0, d / 2 + 2); lg.rotation.y = -PI_ / 4;
  PP(lg, new THREE.CylinderGeometry(0.2, 0.22, 0.18, 10), 'iron', 0, 0.09, 0); PP(lg, new THREE.CylinderGeometry(0.1, 0.17, 0.62, 10), 'iron', 0, 0.49, 0);
  for (const [y, rr] of [[0.82, 0.085], [1.6, 0.06], [2.9, 0.06]]) { const t = PP(lg, new THREE.TorusGeometry(rr, 0.022, 6, 14), 'iron', 0, y, 0); t.rotation.x = PI_ / 2; }
  PP(lg, new THREE.CylinderGeometry(0.04, 0.055, 4.3, 8), 'iron', 0, 2.95, 0);
  const curve = new THREE.CatmullRomCurve3([[0, 4.9, 0], [0, 5.3, 0], [0.2, 5.65, 0], [0.62, 5.7, 0], [0.92, 5.45, 0], [0.95, 5.2, 0]].map((a) => new THREE.Vector3(...a)));
  PP(lg, new THREE.TubeGeometry(curve, 28, 0.028, 6), 'iron', 0, 0, 0); PP(lg, new THREE.TorusGeometry(0.3, 0.018, 6, 26), 'iron', 0.03, 5.45, 0);
  PP(lg, new THREE.ConeGeometry(0.17, 0.2, 8), 'iron', 0.95, 5.12, 0); PP(lg, new THREE.CylinderGeometry(0.12, 0.085, 0.32, 8), 'lampg', 0.95, 4.86, 0);
  PP(lg, new THREE.CylinderGeometry(0.09, 0.05, 0.08, 8), 'iron', 0.95, 4.66, 0); PP(lg, new THREE.SphereGeometry(0.03, 6, 5), 'iron', 0.95, 5.26, 0);
  bake(lg); }
function rollerM(g, w, h) { const a = w / 2, ys = h - a, pz = -0.09, sh = new THREE.Shape(); sh.moveTo(-a, 0); sh.lineTo(a, 0); sh.lineTo(a, ys); sh.absarc(0, ys, a, 0, PI_, false); sh.closePath();
  PP(g, new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 14 }), 'd5', 0, 0, pz);
  for (let y = 0.12; y < h - 0.1; y += 0.08) { const dy = y - ys, c = dy > 0 ? 2 * Math.sqrt(Math.max(0, a * a - dy * dy)) : 2 * a; if (c > 0.12) bx(g, 'iron', c - 0.04, 0.014, 0.012, 0, y, pz + 0.046); }
  bx(g, 'iron', w - 0.04, 0.08, 0.07, 0, 0.05, pz + 0.04); bx(g, 'brass', 0.1, 0.03, 0.02, 0, 0.3, pz + 0.05); }

export { shutterLeaf, shutters, buildCornice, buildLamp, rollerM };
