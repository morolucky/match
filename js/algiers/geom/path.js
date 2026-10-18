// Footprint outline of a city-block corner building, as a closed path of faces.
// Walk order (seen from above): front (+z) left→right, corner, right side (+x) front→back, back, left.
// For a face with tangent t=(tx,tz) the outward normal is n=(-tz,tx).
// Every façade element is placed by arc length s along this path, so straight, chamfered
// and rounded corners share one code path.

const SQ2 = Math.SQRT2;

/**
 * @param {number} W front length (x)  @param {number} D side length (z)
 * @param {'sharp'|'chamfer'|'round'} corner  @param {number} k corner size (chamfer leg / radius)
 * @param {number} inset inward offset of the whole outline
 * @param {Set<string>} main names of faces that carry the decorated façade
 */
export function footprint(W, D, corner, k, inset = 0, main = new Set(['front', 'corner', 'side'])) {
  const hw = W / 2 - inset, hd = D / 2 - inset;
  if (corner === 'chamfer') k = Math.max(0, k - inset * (2 - SQ2));
  else if (corner === 'round') k = Math.max(0, k - inset);
  else k = 0;
  k = Math.min(k, hw * 1.6, hd * 1.6);
  const faces = [];
  const line = (name, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len > 1e-4) faces.push({ name, kind: 'line', a, b, len, t: [dx / len, dz / len] }); };
  line('front', [-hw, hd], [hw - k, hd]);
  if (k > 0 && corner === 'chamfer') line('corner', [hw - k, hd], [hw, hd - k]);
  if (k > 0 && corner === 'round') faces.push({ name: 'corner', kind: 'arc', c: [hw - k, hd - k], r: k, th0: Math.PI / 2, th1: 0, len: k * Math.PI / 2 });
  line('side', [hw, hd - k], [hw, -hd]);
  line('back', [hw, -hd], [-hw, -hd]);
  line('left', [-hw, -hd], [-hw, hd]);
  let s = 0;
  for (const f of faces) { f.s0 = s; s += f.len; f.s1 = s; f.main = main.has(f.name); }
  return { faces, L: s, corner, k, hw, hd, inset };
}

/** point/tangent/normal at arc length s (clamped into the face that contains it) */
export function at(path, s, face) {
  const f = face || faceAt(path, s);
  const u = Math.min(Math.max(s - f.s0, 0), f.len);
  if (f.kind === 'line') { const [tx, tz] = f.t; return { x: f.a[0] + tx * u, z: f.a[1] + tz * u, tx, tz, nx: -tz, nz: tx, face: f }; }
  const th = f.th0 + (f.th1 - f.th0) * (u / f.len), c = Math.cos(th), si = Math.sin(th);
  return { x: f.c[0] + f.r * c, z: f.c[1] + f.r * si, tx: si, tz: -c, nx: c, nz: si, face: f };
}

export function faceAt(path, s) {
  const F = path.faces; for (const f of F) if (s <= f.s1 + 1e-6) return f; return F[F.length - 1];
}

/** tangent frame (local x along façade, y up, z outward) as a Matrix4 */
export function frame(THREE, path, s, y, out = 0, face) {
  const p = at(path, s, face);
  return new THREE.Matrix4().makeBasis(new THREE.Vector3(p.tx, 0, p.tz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.nx, 0, p.nz))
    .setPosition(p.x + p.nx * out, y, p.z + p.nz * out);
}

/**
 * Samples for sweeps between s0 and s1. Each sample: {s, x, z, mx, mz, nx, nz}
 * (m = miter offset per metre of profile offset, n = shading normal).
 * Sharp joints are emitted twice (one per face) so shading stays crisp.
 */
export function samples(path, s0 = 0, s1 = path.L, closed = false, arcStep = 0.12) {
  const out = [], eps = 1e-5;
  const F = path.faces, n = F.length;
  const push = (s, p, mx, mz, nx = p.nx, nz = p.nz) => out.push({ s, x: p.x, z: p.z, mx, mz, nx, nz });
  for (let i = 0; i < n; i++) {
    const f = F[i]; const a = Math.max(s0, f.s0), b = Math.min(s1, f.s1); if (b - a < eps) continue;
    const steps = f.kind === 'arc' ? Math.max(1, Math.ceil(((b - a) / f.r) / arcStep)) : 1;
    for (let j = 0; j <= steps; j++) {
      const s = a + (b - a) * (j / steps), p = at(path, s, f);
      let mx = p.nx, mz = p.nz;
      const atStart = j === 0 && Math.abs(s - f.s0) < eps, atEnd = j === steps && Math.abs(s - f.s1) < eps;
      const nb = atStart ? (i > 0 ? F[i - 1] : closed ? F[n - 1] : null) : atEnd ? (i < n - 1 ? F[i + 1] : closed ? F[0] : null) : null;
      const inside = nb && (atStart ? (i > 0 ? s0 < f.s0 - eps : closed) : (i < n - 1 ? s1 > f.s1 + eps : closed));
      if (inside) { // miter with the neighbouring face
        const q = atStart ? at(path, nb.s1, nb) : at(path, nb.s0, nb);
        let bx = p.nx + q.nx, bz = p.nz + q.nz; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
        const c = bx * p.nx + bz * p.nz || 1; mx = bx / c; mz = bz / c;
      }
      if (j === 0 && out.length && Math.hypot(out[out.length - 1].x - p.x, out[out.length - 1].z - p.z) < eps && out[out.length - 1].nx * p.nx + out[out.length - 1].nz * p.nz > 0.999) continue;
      push(s, p, mx, mz);
    }
  }
  return out;
}

/** footprint polygon (x,z) for slabs; arcs subdivided */
export function polygon(path, arcStep = 0.15) {
  const pts = [];
  for (const f of path.faces) {
    if (f.kind === 'line') pts.push([f.a[0], f.a[1]]);
    else { const st = Math.max(2, Math.ceil(f.len / f.r / arcStep)); for (let j = 0; j < st; j++) { const p = at(path, f.s0 + f.len * j / st, f); pts.push([p.x, p.z]); } }
  }
  return pts;
}

/**
 * Footprint built directly from an arbitrary closed polygon in world (x,z) — e.g. an OSM
 * building outline — instead of the rectangle+corner recipe above. Winding is normalized so
 * the outward-normal convention (n = (-tz, tx)) matches footprint() above, and every edge is
 * a decorated ("main") face, since dense city blocks show a façade on every side.
 * The returned path is flagged `poly: true`: ground.js/roof.js use insetPoly() instead of
 * rebuilding a rectangle when they need an inset copy (roof deck, arcade shopfront wall).
 */
export function footprintFromPolygon(pts) {
  let P = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.3);
  if (P.length > 2 && Math.hypot(P[0].x - P[P.length - 1].x, P[0].z - P[P.length - 1].z) < 0.3) P = P.slice(0, -1);
  if (P.length < 3) return { faces: [], L: 0, corner: 'sharp', k: 0, hw: 0, hd: 0, inset: 0, poly: true };
  let area = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a.x * b.z - b.x * a.z; }
  if (area > 0) P = P.slice().reverse(); // footprint() above winds so signed area < 0; match it
  const faces = []; let s = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 0.35) continue;
    faces.push({ name: 'f' + i, kind: 'line', a: [a.x, a.z], b: [b.x, b.z], len, t: [dx / len, dz / len], s0: s, s1: s + len, main: true });
    s += len;
  }
  return { faces, L: s, corner: 'sharp', k: 0, hw: 0, hd: 0, inset: 0, poly: true };
}

function lineIntersect(a1, a2, b1, b2) {
  const d1x = a2[0] - a1[0], d1z = a2[1] - a1[1], d2x = b2[0] - b1[0], d2z = b2[1] - b1[1];
  const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1;
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 0.08 * l1 * l2) return null; // near-straight joint: naive offset endpoints are already close
  const t = ((b1[0] - a1[0]) * d2z - (b1[1] - a1[1]) * d2x) / den;
  return [a1[0] + d1x * t, a1[1] + d1z * t];
}

/** shrink an all-line, polygon-based footprint inward by `d`, re-mitering corners, keeping the
 *  same face count/order/names (so callers can map outer↔inner faces by name like footprint()'s
 *  own inset does). Only used for `poly` footprints; the rectangle case keeps using footprint().
 *  Real OSM corners can be very acute or nearly degenerate, so a plain line-intersection miter
 *  would occasionally shoot off to an enormous point; any miter farther than a few metres from
 *  the original corner is rejected and that corner is left as a small bevel instead. */
export function insetPoly(path, d) {
  const off = path.faces.map((f) => { const nx = -f.t[1], nz = f.t[0]; return { name: f.name, a: [f.a[0] - nx * d, f.a[1] - nz * d], b: [f.b[0] - nx * d, f.b[1] - nz * d] }; });
  const n = off.length;
  for (let i = 0; i < n; i++) {
    const cur = off[i], nxt = off[(i + 1) % n], p = lineIntersect(cur.a, cur.b, nxt.a, nxt.b);
    const corner = path.faces[i].b;
    if (p && Math.hypot(p[0] - corner[0], p[1] - corner[1]) < Math.max(6, d * 4)) { cur.b = p; nxt.a = p; }
  }
  const faces = []; let s = 0;
  for (const f of off) {
    const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    faces.push({ name: f.name, kind: 'line', a: f.a, b: f.b, len, t: [dx / len, dz / len], s0: s, s1: s + len, main: true });
    s += len;
  }
  return { faces, L: s, corner: 'sharp', k: 0, hw: 0, hd: 0, inset: (path.inset || 0) + d, poly: true };
}
