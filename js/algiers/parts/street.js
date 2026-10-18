import * as THREE from 'three';
import { samples, at } from '../geom/path.js';
import { sweep, strip } from '../geom/sweep.js';
import { LATHE } from '../geom/shapes.js';
import { dishAt } from './roof.js';

// Street: sidewalk with curb, road with lane dashes, Algiers candelabra lamps, pedestrian
// barriers; façade life: A/C units and satellite dishes.

export const SW = 3.6;

/** straight run-out of `E` metres past either end of the street faces so the road does not stop at the corner */
function runout(path, face, atStart, E) {
  const p = at(path, atStart ? face.s0 : face.s1, face), sg = atStart ? -1 : 1, q = (d) => ({ s: 0, x: p.x + p.tx * d, z: p.z + p.tz * d, mx: p.nx, mz: p.nz, nx: p.nx, nz: p.nz });
  return atStart ? [q(sg * E), q(0)] : [q(0), q(sg * E)];
}

export function street(ctx) {
  const st = ctx.st, path = ctx.path, L = st.life;
  // the street wraps every face that borders a road: front, corner and side (all faces for "all")
  const closed = st.sides === 'all', sf = path.faces.filter((f) => closed || ['front', 'corner', 'side'].includes(f.name));
  const a = Math.min(...sf.map((f) => f.s0)), b = Math.max(...sf.map((f) => f.s1)), E = 10;
  const S = samples(path, a, b, closed), first = sf[0], last = sf[sf.length - 1];
  const parts = closed ? [S] : [runout(path, first, true, E), S, runout(path, last, false, E)];
  if (L.street) for (const P of parts) {
    ctx.add(sweep(P, [[0, 0], [SW - 0.25, 0], [SW - 0.25, 0.15], [0, 0.15]], { caps: !closed }), 'a_pave');
    ctx.add(sweep(P, [[SW - 0.25, 0], [SW, 0], [SW, 0.16], [SW - 0.25, 0.16]], { caps: !closed }), 'a_curb');
    ctx.add(strip(P, SW, SW + 9, 0.012), 'a_asph');
  }
  if (L.street) { // lane dashes follow the curve (frames are tangent to the path, so arcs work too)
    for (let s = a + 1; s < b - 0.8; s += 3.2) ctx.bbox('a_mark', ctx.frame(s, 0, null), -0.75, 0.014, SW + 4.45, 0.75, 0.02, SW + 4.57);
    for (const [f, d] of [[first, -1], [last, 1]]) { const p = at(path, d < 0 ? f.s0 : f.s1, f); for (let k = 1; k * 3.2 < E; k++) { const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(p.tx, 0, p.tz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.nx, 0, p.nz)).setPosition(p.x + p.tx * d * k * 3.2, 0, p.z + p.tz * d * k * 3.2); ctx.bbox('a_mark', M, -0.75, 0.014, SW + 4.45, 0.75, 0.02, SW + 4.57); } }
  }
  const len = b - a;
  if (L.lamps) { const n = Math.max(1, Math.round(len / 15)); for (let i = 0; i < n; i++) lamp(ctx, ctx.frame(a + (i + 0.5) * len / n, SW - 0.55, null)); }
  if (L.barriers) for (const f of sf) if (f.kind === 'line') for (let s = f.s0 + 0.8; s < f.s1 - 1.5; s += 1.4) barrier(ctx, ctx.frame(s, SW - 0.4, f));
  return { a, b, closed, sf, SW };
}

/** cast-iron candelabra with five lanterns (Bd Che Guevara / Rue Larbi Ben M'hidi type) */
export function lamp(ctx, M) {
  const y = 0.15, D = 'a_dark';
  const base = new THREE.LatheGeometry(LATHE.poleBase, 12); base.translate(0, y, 0); ctx.add(base, D, M);
  ctx.add(new THREE.CylinderGeometry(0.05, 0.075, 4.0, 10).translate(0, y + 3.0, 0), D, M);
  for (const h of [1.2, 2.6, 4.4]) ctx.add(new THREE.TorusGeometry(0.08, 0.025, 6, 12).rotateX(Math.PI / 2).translate(0, y + h, 0), 'brass', M);
  const head = y + 5.0;
  const lantern = (x, yy, z) => {
    ctx.add(new THREE.LatheGeometry(LATHE.lanternGlass, 8).translate(x, yy, z), 'lampg', M);
    const c = new THREE.LatheGeometry(LATHE.lanternCap, 8); c.translate(x, yy + 0.3, z); ctx.add(c, D, M);
    ctx.add(new THREE.SphereGeometry(0.035, 6, 4).translate(x, yy + 0.62, z), 'brass', M);
  };
  for (let i = 0; i < 4; i++) {
    const t = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(t) * 0.55, z = Math.sin(t) * 0.55;
    const arm = new THREE.TorusGeometry(0.28, 0.022, 5, 10, Math.PI); arm.rotateY(-t); arm.translate(Math.cos(t) * 0.28, head - 0.3, Math.sin(t) * 0.28); ctx.add(arm, D, M);
    lantern(x, head - 0.32, z);
  }
  ctx.add(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8).translate(0, head + 0.05, 0), D, M);
  lantern(0, head + 0.3, 0);
}

function barrier(ctx, M) {
  const m = 'a_metal', w = 1.3, h = 0.95;
  ctx.bbox(m, M, -0.03, 0.15, -0.03, 0.03, 0.15 + h, 0.03); ctx.bbox(m, M, w - 0.03, 0.15, -0.03, w + 0.03, 0.15 + h, 0.03);
  ctx.bbox(m, M, 0, 0.15 + h - 0.05, -0.02, w, 0.15 + h, 0.02); ctx.bbox(m, M, 0, 0.3, -0.02, w, 0.35, 0.02);
  for (const sg of [1, -1]) { const g = new THREE.BoxGeometry(Math.hypot(w, h - 0.3), 0.04, 0.03); g.rotateZ(sg * Math.atan2(h - 0.3, w)); g.translate(w / 2, 0.15 + 0.2 + (h - 0.3) / 2, 0); ctx.add(g, m, M); }
}

/** A/C units and dishes next to a window (o from layout) */
export function facadeLife(ctx, o) {
  const L = ctx.st.life, R = ctx.rng;
  if (L.ac && R() < (o.main ? 0.16 : 0.3)) {
    const M = ctx.frame(o.sc, 0, o.face), sg = R() < 0.5 ? -1 : 1, x = sg * (o.w / 2 + 0.75);
    const onBal = o.bal !== 'none', y = onBal ? o.y0 + 0.02 : o.y0 + 0.2, z0 = onBal ? 0.06 : 0.02;
    ctx.bbox('a_ac', M, x - 0.4, y, z0, x + 0.4, y + 0.55, z0 + 0.28);
    ctx.add(new THREE.CircleGeometry(0.2, 14).translate(x + 0.08, y + 0.28, z0 + 0.285), 'a_dark', M);
    if (!onBal) { ctx.bbox('a_metal', M, x - 0.35, y - 0.04, 0, x - 0.31, y, z0 + 0.3); ctx.bbox('a_metal', M, x + 0.31, y - 0.04, 0, x + 0.35, y, z0 + 0.3); }
  }
  if (L.dishes && R() < 0.07) { const M = ctx.frame(o.sc + (R() < 0.5 ? -1 : 1) * (o.w / 2 + 0.5), 0, o.face); dishAt(ctx, M, o.y1 - 0.3); }
}
