// Mesh helpers: PP/bx place meshes, bake() merges into S.ACC by material
import * as THREE from 'three';
import { MT } from './materials.js';
import { S } from '../core/state.js';

function fin(g, r) { if (g.index) g = g.toNonIndexed(); const n = g.attributes.position.count, u = new Float32Array(n * 2), s = new Float32Array(n * 3);
  if (r != null) { g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position; for (let i = 0; i < n; i++) { u[i*2] = p.getX(i) - b.min.x; u[i*2+1] = p.getY(i) - b.min.y; s[i*3] = b.max.x - b.min.x; s[i*3+1] = b.max.y - b.min.y; s[i*3+2] = r; } }
  g.setAttribute('wuv', new THREE.BufferAttribute(u, 2)); g.setAttribute('wsz', new THREE.BufferAttribute(s, 3)); return g; }
function PP(par, geo, m, x, y, z, r) { const o = new THREE.Mesh(fin(geo, r), MT[m]); o.userData.m = m; o.position.set(x, y, z); par.add(o); return o; }
const bx = (par, m, w, h, d, x, y, z) => PP(par, new THREE.BoxGeometry(w, h, d), m, x, y, z);
function flip(g) { for (const k in g.attributes) { const a = g.attributes[k], s = a.itemSize, A = a.array; for (let i = 0; i < a.count; i += 3) for (let j = 0; j < s; j++) { const t = A[(i+1)*s+j]; A[(i+1)*s+j] = A[(i+2)*s+j]; A[(i+2)*s+j] = t; } } }
function bake(root) { root.updateMatrixWorld(true); root.traverse((o) => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
  if (o.userData.m == 'stone') { const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; for (let i = 0; i < P.count; i++) { const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i)); let u, v; if (ax > ay && ax > az) { u = P.getZ(i); v = P.getY(i); } else if (ay > az) { u = P.getX(i); v = P.getZ(i); } else { u = P.getX(i); v = P.getY(i); } U.setXY(i, u * .8, v * .8); } }
  if (o.matrixWorld.determinant() < 0) flip(g); (S.ACC[o.userData.m] = S.ACC[o.userData.m] || []).push(g); o.geometry.dispose(); }); }

export { fin, PP, bx, flip, bake };
