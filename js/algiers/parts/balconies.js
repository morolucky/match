import * as THREE from 'three';
import { samples, at } from '../geom/path.js';
import { sweep, ribbon } from '../geom/sweep.js';
import { consoleGeo, LATHE } from '../geom/shapes.js';

// Balconies: individual (one bay) or continuous (whole decorated façade, wrapping the corner).
// Both are sweeps along the footprint, so curved corners get curved slabs and railings for free.

/**
 * @param {number} s0,s1 arc-length range  @param {number} y slab top  @param {boolean} closed whole loop
 * @param {number[]} consoleAt arc lengths of the corbels under the slab
 */
export function balcony(ctx, s0, s1, y, closed, consoleAt) {
  const st = ctx.st, d = st.balDepth, path = ctx.path;
  const S = samples(path, s0, s1, closed);
  if (S.length < 2) return;
  const T = 'a_trim';
  ctx.add(sweep(S, [[-0.05, -0.2], [d - 0.07, -0.2], [d - 0.02, -0.15], [d, -0.13], [d, 0.02], [d - 0.02, 0.04], [-0.05, 0.04]], { y, closed, caps: !closed }), T);
  const rz = d - 0.07, rh = 1.0;
  ctx.add(ribbon(S, rz, y + 0.04, y + rh, 1), 'a_rail');
  ctx.add(sweep(S, [[rz - 0.03, rh - 0.02], [rz + 0.035, rh - 0.02], [rz + 0.035, rh + 0.035], [rz - 0.03, rh + 0.035]], { y, closed, caps: !closed }), 'a_iron');
  if (!closed) for (const s of [s0, s1]) { // side railings back to the wall
    const M = ctx.frame(s, 0, null), g = new THREE.PlaneGeometry(rz, rh - 0.04); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setX(i, u.getX(i) * rz);
    g.rotateY(Math.PI / 2); g.translate(s === s0 ? 0.03 : -0.03, y + 0.04 + (rh - 0.04) / 2, rz / 2); ctx.add(g, 'a_rail', M);
    ctx.bbox('a_iron', M, -0.03, y + rh - 0.02, 0, 0.03, y + rh + 0.035, rz);
  }
  if (st.consoles !== 'none') {
    const big = st.consoles === 'heavy', D = d * (big ? 0.95 : 0.8), H = big ? 0.85 : 0.6, w = big ? 0.26 : 0.18;
    for (const s of consoleAt) { const g = consoleGeo(st.consoles, D, H, w); g.translate(0, y - 0.2, 0); ctx.add(g, T, ctx.frame(s, 0, null)); }
  }
  balconyLife(ctx, S, y, d);
}

/** pots, laundry and chairs on balconies (street-life switches) */
function balconyLife(ctx, S, y, d) {
  const L = ctx.st.life, len = S[S.length - 1].s - S[0].s;
  if (L.plants) for (let s = S[0].s + 0.4; s < S[S.length - 1].s - 0.3; s += 0.9 + ctx.rng() * 2.5) {
    if (ctx.rng() > 0.45) continue;
    const M = ctx.frame(s, 0, null), pot = new THREE.LatheGeometry(LATHE.pot, 8); pot.translate(0, y + 0.04, d - 0.3); ctx.add(pot, 'p_pot', M);
    const b = new THREE.IcosahedronGeometry(0.22 + ctx.rng() * 0.12, 0); b.scale(1, 1.3, 1); b.translate(0, y + 0.5, d - 0.3); ctx.add(b, 'a_plant', M);
  }
  if (L.laundry && len > 1.5 && ctx.rng() < 0.18) {
    const s0 = S[0].s + 0.2 + ctx.rng() * Math.max(0, len - 2.2), s1 = s0 + Math.min(len - 0.4, 1.6 + ctx.rng());
    const M = ctx.frame(s0, 0, null), M2 = ctx.frame(s1, 0, null), a = new THREE.Vector3(0, y + 1.55, d - 0.12).applyMatrix4(M), b = new THREE.Vector3(0, y + 1.55, d - 0.12).applyMatrix4(M2);
    const dir = b.clone().sub(a), l = dir.length(); const n = Math.floor(l / 0.45);
    for (let i = 0; i < n; i++) { const p = a.clone().addScaledVector(dir, (i + 0.5) / n), hh = 0.35 + ctx.rng() * 0.35, g = new THREE.PlaneGeometry(0.34, hh); g.lookAt(new THREE.Vector3(-dir.z, 0, dir.x)); g.translate(p.x, p.y - hh / 2, p.z); ctx.add(g, 'a_cloth' + Math.floor(ctx.rng() * 6)); }
    const g = new THREE.CylinderGeometry(0.005, 0.005, l, 3); g.rotateZ(Math.PI / 2); g.rotateY(-Math.atan2(dir.z, dir.x)); g.translate((a.x + b.x) / 2, a.y, (a.z + b.z) / 2); ctx.add(g, 'a_dark');
  }
}

export { at };
