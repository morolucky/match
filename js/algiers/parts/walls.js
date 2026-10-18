import * as THREE from 'three';
import { at, polygon } from '../geom/path.js';
import { sweep } from '../geom/sweep.js';
import { spandrelShape, extrude } from '../geom/shapes.js';
import { archRise } from '../layout.js';

// Walls with openings: a face is cut into intervals at every opening edge (and every few
// degrees on curved corners); each interval keeps only the solid height ranges.

export const WALL_T = 0.45;

function solidRanges(y0, y1, holes) {
  let r = [[y0, y1]];
  for (const [a, b] of holes) r = r.flatMap(([c, d]) => (b <= c || a >= d) ? [[c, d]] : [[c, a], [b, d]].filter(([p, q]) => q - p > 0.01));
  return r;
}

/** wall band on one face between heights y0..y1 with rectangular openings {s0,s1,y0,y1} */
export function wallBand(ctx, path, f, y0, y1, openings, mat, thk = WALL_T) {
  const cuts = new Set([f.s0, f.s1]);
  for (const o of openings) { if (o.s1 > f.s0 && o.s0 < f.s1) { cuts.add(Math.max(f.s0, o.s0)); cuts.add(Math.min(f.s1, o.s1)); } }
  if (f.kind === 'arc') { const n = Math.max(2, Math.ceil(f.len / 0.3)); for (let i = 1; i < n; i++) cuts.add(f.s0 + f.len * i / n); }
  const xs = [...cuts].sort((a, b) => a - b);
  const runs = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1]; if (b - a < 1e-4) continue;
    const m = (a + b) / 2, holes = openings.filter((o) => o.s0 <= m && m <= o.s1).map((o) => [o.y0, o.y1]);
    const rs = solidRanges(y0, y1, holes), key = rs.map((r) => r.join(',')).join(';');
    const last = runs[runs.length - 1];
    if (f.kind === 'line' && last && last.key === key && Math.abs(last.b - a) < 1e-6) last.b = b; else runs.push({ a, b, rs, key });
  }
  for (const { a, b, rs } of runs) {
    if (f.kind === 'line') { const M = ctx.frame(a, 0, f, path); for (const [p, q] of rs) ctx.bbox(mat, M, 0, p, -thk, b - a, q, 0); }
    else { const M = ctx.chord(a, b, f, path), ext = 0.02 + thk * (b - a) / f.r * 0.5; for (const [p, q] of rs) ctx.bbox(mat, M, -M.len / 2 - ext, p, -thk, M.len / 2 + ext, q, 0); }
  }
}

/** arched head infill inside a rectangular opening (flush with the façade) */
export function archHead(ctx, M, kind, w, yTop, thk = WALL_T, mat = 'a_wall') {
  const a = w / 2, rise = archRise(kind, a), yS = yTop - rise;
  if (rise <= 0.01) return yTop;
  ctx.add(extrude(spandrelShape(kind, a - 0.001, a, yS, yTop + 0.001), thk - 0.02), mat, M);
  return yS;
}

/** dark interior volumes so the building never reads as hollow through its windows */
export function core(ctx, st, lay, groundInset) {
  const { path, H } = lay; const pts = polygon(path);
  const shape = (inset) => { const s = new THREE.Shape(); const c = centroid(pts); pts.forEach(([x, z], i) => { const dx = x - c[0], dz = z - c[1]; const l = Math.hypot(dx, dz) || 1; const k = Math.max(0.2, 1 - inset / l); const X = c[0] + dx * k, Y = -(c[1] + dz * k); i ? s.lineTo(X, Y) : s.moveTo(X, Y); }); return s; };
  const slab = (inset, y0, y1, mat) => { const g = new THREE.ExtrudeGeometry(shape(inset), { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); ctx.add(g, mat); };
  slab(groundInset + 0.9, 0.05, st.gh - 0.02, 'room');
  if (lay.nUp) slab(1.1, st.gh, H - 0.05, 'room');
  // ceiling of the arcade / first-floor slab seen from the street
  const g = new THREE.ShapeGeometry(shape(0.02)); g.rotateX(Math.PI / 2); g.translate(0, st.gh - 0.01, 0); ctx.add(g, 'a_ceil');
  // roof deck
  const r = new THREE.ShapeGeometry(shape(0.05)); r.rotateX(-Math.PI / 2); r.translate(0, H + 0.02, 0); ctx.add(r, 'a_zinc');
}

function centroid(pts) { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; }

/** plinth along the given samples */
export function plinth(ctx, S, closed, mat = 'a_ground') { ctx.add(sweep(S, [[-0.1, 0], [0.06, 0], [0.06, 0.45], [0.03, 0.5], [0, 0.55], [-0.1, 0.55]], { closed, caps: !closed }), mat); }

export { at };
