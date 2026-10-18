// Continuous wrap-around balconies
import * as THREE from 'three';
import { D } from '../params.js';
import { LV, fMode } from '../generator.js';
import { PI_ } from '../materials.js';
import { PP, bake, bx } from '../kit.js';

/* ===== continuous wrap-around balconies (piano-nobile / top floor), ogee brackets under the slab, wrought-iron scroll railing ===== */
function contBalc(g, L, P, y, bracketCount) {
  bx(g, 'stone', L, 0.12, P, 0, y - 0.06, P / 2); bx(g, 'stone', L, 0.16, 0.05, 0, y - 0.1, P);
  const n = Math.max(2, Math.round(L / 1.1)); for (let i = 0; i <= n; i++) { const x = -L / 2 + i * L / n; PP(g, new THREE.CylinderGeometry(0.03, 0.035, 0.95, 6), 'iron', x, y + 0.475, P - 0.03); if (i % 2 == 0) PP(g, new THREE.SphereGeometry(0.045, 6, 5), 'iron', x, y + 0.98, P - 0.03); }
  bx(g, 'iron', L, 0.045, 0.05, 0, y + 0.95, P - 0.03); bx(g, 'iron', L, 0.035, 0.04, 0, y + 0.12, P - 0.03); bx(g, 'iron', L, 0.03, 0.04, 0, y + 0.82, P - 0.03);
  const nb = Math.floor(L / 0.12); for (let i = 0; i < nb; i++) bx(g, 'iron', 0.012, 0.7, 0.012, -L / 2 + (i + 0.5) * L / nb, y + 0.47, P - 0.03);
  const nc = Math.max(1, Math.round(L / 0.34)); for (let i = 0; i < nc; i++) PP(g, new THREE.TorusGeometry(0.1, 0.01, 4, 10), 'iron', -L / 2 + (i + 0.5) * L / nc, y + 0.47, P - 0.022);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(P - 0.05, 0); sh.lineTo(P - 0.05, -0.1); sh.quadraticCurveTo(P * 0.5, -0.2, 0.06, -0.52); sh.lineTo(0, -0.52); sh.closePath();
  const nB = Math.max(2, bracketCount); for (let i = 0; i < nB; i++) { const ge = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false, curveSegments: 6 }); ge.translate(0, 0, -0.07); ge.rotateY(-PI_ / 2); PP(g, ge, 'stone', -L / 2 + (i + 0.5) * L / nB, y - 0.12, 0); } }
function buildCont() { if (!D.prog) return; const nF = D.floors, w = D.w, d = D.d, P = 0.6, cg = new THREE.Group();
  for (let i = 1; i < nF; i++) { if (fMode(i, nF) != 'cont' || !LV[i]) continue; const y = LV[i][0] + 0.15;
    const mk = (L, px, pz, ry, e) => { const g = new THREE.Group(); g.position.set(px, 0, pz); g.rotation.y = ry; cg.add(g); contBalc(g, L + e, P, y, Math.round(L / 1.6)); };
    mk(w, 0, d / 2, 0, 2 * P); mk(w, 0, -d / 2, PI_, 2 * P); mk(d, w / 2, 0, PI_ / 2, 0); mk(d, -w / 2, 0, -PI_ / 2, 0); }
  bake(cg); }

export { contBalc, buildCont };
