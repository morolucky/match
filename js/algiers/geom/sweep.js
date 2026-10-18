import * as THREE from 'three';

// Profile sweeps along footprint samples (see path.js).
// A profile is a list of [out, up] points in the façade's normal plane. Traversed counter-clockwise
// (out → right, up → up) it yields outward-facing triangles. u = arc length (m), v = profile length (m).

const tri = (P, N, U, a, b, c, na, nb, nc, ua, ub, uc) => { P.push(...a, ...b, ...c); N.push(...na, ...nb, ...nc); U.push(...ua, ...ub, ...uc); };

/**
 * @param {Array} S samples from path.samples()
 * @param {Array<[number,number]>} prof profile points
 * @param {object} o {y: base height, closed, caps, uScale}
 */
export function sweep(S, prof, o = {}) {
  const y0 = o.y || 0, us = o.uScale || 1, P = [], N = [], U = [];
  const ss = o.closed ? [...S, { ...S[0], s: S[S.length - 1].s + Math.hypot(S[0].x - S[S.length - 1].x, S[0].z - S[S.length - 1].z) }] : S;
  const vAcc = [0]; for (let j = 1; j < prof.length; j++) vAcc.push(vAcc[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
  const pos = (s, p) => [s.x + s.mx * p[0], y0 + p[1], s.z + s.mz * p[0]];
  for (let j = 0; j < prof.length - 1; j++) {
    const p = prof[j], q = prof[j + 1]; let ex = q[1] - p[1], ey = -(q[0] - p[0]); const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
    for (let i = 0; i < ss.length - 1; i++) {
      const A = ss[i], B = ss[i + 1]; if (Math.abs(B.s - A.s) < 1e-6 && Math.hypot(B.x - A.x, B.z - A.z) < 1e-6) continue;
      const na = [A.nx * ex, ey, A.nz * ex], nb = [B.nx * ex, ey, B.nz * ex];
      const a0 = pos(A, p), a1 = pos(A, q), b0 = pos(B, p), b1 = pos(B, q);
      const ua0 = [A.s * us, vAcc[j]], ua1 = [A.s * us, vAcc[j + 1]], ub0 = [B.s * us, vAcc[j]], ub1 = [B.s * us, vAcc[j + 1]];
      tri(P, N, U, a0, b0, b1, na, nb, nb, ua0, ub0, ub1); tri(P, N, U, a0, b1, a1, na, nb, na, ua0, ub1, ua1);
    }
  }
  if (o.caps && !o.closed && S.length > 1) {
    const ctr = prof.map((p) => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(ctr, []);
    for (const [smp, sgn] of [[S[0], -1], [S[S.length - 1], 1]]) {
      const tn = [smp.nz * sgn, 0, -smp.nx * sgn]; // tangent = (nz, -nx) for n = (-tz, tx)
      for (const t of tris) {
        let [a, b, c] = t.map((k) => pos(smp, prof[k]));
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        if (cr[0] * tn[0] + cr[1] * tn[1] + cr[2] * tn[2] < 0) [b, c] = [c, b];
        const uv = (v) => [v[0] + v[2], v[1]];
        tri(P, N, U, a, b, c, tn, tn, tn, uv(a), uv(b), uv(c));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return g;
}

/** vertical ribbon (railings, lattices): offset `out`, from y0 to y1, double sided material expected */
export function ribbon(S, out, y0, y1, uScale = 1) {
  return sweep(S, [[out, 0], [out, y1 - y0]], { y: y0, uScale });
}

/** horizontal strip between two offsets at height y, facing up (or down when flip) */
export function strip(S, o0, o1, y, flip = false) {
  return sweep(S, flip ? [[o0, 0], [o1, 0]] : [[o1, 0], [o0, 0]], { y });
}
