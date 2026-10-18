// Street-life kit: awnings, A/C units, dishes, planters, laundry
import * as THREE from 'three';
import { PI_ } from '../materials.js';
import { PP, bx } from '../kit.js';
import { pipeSeg } from './drainage.js';

/* ===== street-life kit (second reference sheet): striped shop awnings, A/C condensers, satellite dishes, balcony planters, laundry ===== */
function awning(g, w, h, r) { const wa = w + 0.7, yT = h + 0.05, zT = 0.2, drop = 0.65, zF = 1.2, m = 'awn' + (Math.floor(r * 40) % 4), L = Math.hypot(drop, zF - zT);
  const sl = new THREE.PlaneGeometry(wa, L); sl.rotateX(-Math.atan2(zF - zT, drop)); PP(g, sl, m, 0, yT - drop / 2, (zT + zF) / 2);
  PP(g, new THREE.PlaneGeometry(wa, 0.22), m, 0, yT - drop - 0.11, zF);
  for (const sg of [-1, 1]) { pipeSeg(g, [sg * wa / 2, yT - 0.12, zT], [sg * wa / 2, yT - drop, zF], 0.012, 'iron'); } }
function dish(g, x, y) { bx(g, 'iron', 0.04, 0.04, 0.32, x, y, 0.16); const d = PP(g, new THREE.SphereGeometry(0.3, 18, 8, 0, PI_ * 2, 0, 0.9), 'acu', x, y + 0.05, 0.4); d.rotation.x = PI_ / 2 - 0.35; d.scale.z = 0.55; PP(g, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5), 'iron', x, y + 0.05, 0.55).rotation.x = PI_ / 2 - 0.35; }
function planter(g, x, z, n, r) { bx(g, 'pot', 0.5, 0.2, 0.22, x, 0.1, z); for (let i = 0; i < n; i++) { const b = PP(g, new THREE.SphereGeometry(0.13 + 0.04 * ((r * 17 + i * 3.1) % 1), 8, 6), 'leaf', x + (i - (n - 1) / 2) * 0.17, 0.3, z); b.scale.y = 1.2; } }
function laundry(g, Rw, z, r) { const n = 2 + Math.floor(r * 9) % 3, ms = ['cb', 'cr', 'cw', 'cg']; for (let i = 0; i < n; i++) PP(g, new THREE.PlaneGeometry(0.3, 0.42 + 0.1 * ((i * 7 + r * 5) % 1)), ms[(i + Math.floor(r * 10)) % 4], -Rw / 2 + 0.3 + i * Math.min(0.42, (Rw - 0.5) / n), 0.73, z + 0.04); }
function wallKit(g, w, h, bal, r) { if (bal || r < 0.88) return; dish(g, (r > 0.94 ? -1 : 1) * (w / 2 + 0.92), h * 0.65); }

export { awning, dish, planter, laundry, wallKit };
