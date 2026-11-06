import * as THREE from 'three';

/**
 * Closed superellipse loop (rounded-rectangle bowl plan) resampled at equal arc length.
 * All stadium geometry is expressed as (d, h): d = outward offset from this loop, h = height.
 */
export function makeLoop(a, b, n, count) {
  const D = 16384;
  const px = new Float64Array(D + 1), pz = new Float64Array(D + 1), cum = new Float64Array(D + 1);
  for (let i = 0; i <= D; i++) {
    const t = (i / D) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    px[i] = a * Math.sign(c) * Math.abs(c) ** (2 / n);
    pz[i] = b * Math.sign(s) * Math.abs(s) ** (2 / n);
    if (i) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
  }
  const P = cum[D];
  const x = new Float32Array(count), z = new Float32Array(count), s = new Float32Array(count);
  const nx = new Float32Array(count), nz = new Float32Array(count);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * P;
    while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    x[i] = px[j] + (px[j + 1] - px[j]) * f;
    z[i] = pz[j] + (pz[j + 1] - pz[j]) * f;
    s[i] = target;
  }
  for (let i = 0; i < count; i++) {
    const p = (i - 1 + count) % count, q = (i + 1) % count;
    const tx = x[q] - x[p], tz = z[q] - z[p], l = Math.hypot(tx, tz);
    nx[i] = tz / l;
    nz[i] = -tx / l;
  }
  return { count, x, z, s, nx, nz, P };
}

/** Position + outward normal at base fraction f (0..1) of the loop. */
export function frameAt(loop, f) {
  const N = loop.count;
  const t = (((f % 1) + 1) % 1) * N;
  const i = Math.floor(t) % N, j = (i + 1) % N, u = t - Math.floor(t);
  const x = loop.x[i] + (loop.x[j] - loop.x[i]) * u;
  const z = loop.z[i] + (loop.z[j] - loop.z[i]) * u;
  let nx = loop.nx[i] + (loop.nx[j] - loop.nx[i]) * u;
  let nz = loop.nz[i] + (loop.nz[j] - loop.nz[i]) * u;
  const l = Math.hypot(nx, nz);
  nx /= l; nz /= l;
  return { x, z, nx, nz, yaw: Math.atan2(nx, nz) };
}

export function offsetPoint(loop, i, d, h, target = new THREE.Vector3()) {
  const k = ((i % loop.count) + loop.count) % loop.count;
  return target.set(loop.x[k] + loop.nx[k] * d, h, loop.z[k] + loop.nz[k] * d);
}

/**
 * Sweep a 2D (d, h) profile around the loop. Each profile segment gets its own vertices so
 * creases stay sharp (stair treads/risers) while staying smooth around the bowl.
 * Closed profiles are traversed with the solid on the right; UVs are in metres / tile size.
 */
export function sweep(loop, profile, { closed = true, uTile = 4, vTile = 4 } = {}) {
  const N = loop.count, P = loop.P;
  const pos = [], nor = [], uv = [], idx = [];
  const segs = closed ? profile.length : profile.length - 1;
  let vAcc = 0;
  for (let j = 0; j < segs; j++) {
    const [d0, h0] = profile[j], [d1, h1] = profile[(j + 1) % profile.length];
    const dd = d1 - d0, dh = h1 - h0, len = Math.hypot(dd, dh);
    if (len < 1e-6) continue;
    const ln = -dh / len, ly = dd / len;
    const base = pos.length / 3;
    // offset curve perimeter = P + 2πd, keeps texel density even at any offset
    const k0 = (P + 2 * Math.PI * d0) / P, k1 = (P + 2 * Math.PI * d1) / P;
    for (let i = 0; i <= N; i++) {
      const k = i % N, s = i === N ? P : loop.s[k];
      const nx = loop.nx[k], nz = loop.nz[k];
      pos.push(loop.x[k] + nx * d0, h0, loop.z[k] + nz * d0, loop.x[k] + nx * d1, h1, loop.z[k] + nz * d1);
      nor.push(nx * ln, ly, nz * ln, nx * ln, ly, nz * ln);
      uv.push((s * k0) / uTile, vAcc / vTile, (s * k1) / uTile, (vAcc + len) / vTile);
    }
    const a = new THREE.Vector3().fromArray(pos, base * 3);
    const b = new THREE.Vector3().fromArray(pos, (base + 1) * 3);
    const c = new THREE.Vector3().fromArray(pos, (base + 2) * 3);
    const fn = new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(b, a));
    const flip = fn.dot(new THREE.Vector3().fromArray(nor, base * 3)) < 0;
    for (let i = 0; i < N; i++) {
      const v0 = base + 2 * i, v1 = v0 + 1, v2 = v0 + 2, v3 = v0 + 3;
      if (!flip) idx.push(v0, v2, v1, v1, v2, v3);
      else idx.push(v0, v1, v2, v1, v3, v2);
    }
    vAcc += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Arc-length sampler for the loop offset by d (used to lay out seat rows evenly). */
export function rowSampler(loop, d) {
  const N = loop.count;
  const cum = new Float64Array(N + 1);
  const X = (i) => loop.x[i % N] + loop.nx[i % N] * d;
  const Z = (i) => loop.z[i % N] + loop.nz[i % N] * d;
  for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + Math.hypot(X(i) - X(i - 1), Z(i) - Z(i - 1));
  const P = cum[N];
  return {
    P,
    sOfFraction(f) {
      const t = (((f % 1) + 1) % 1) * N, i = Math.floor(t), u = t - i;
      return cum[i] + (cum[Math.min(i + 1, N)] - cum[i]) * u;
    },
    at(s) {
      s = ((s % P) + P) % P;
      let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
      const u = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
      const k = lo % N, k2 = (lo + 1) % N;
      let nx = loop.nx[k] + (loop.nx[k2] - loop.nx[k]) * u, nz = loop.nz[k] + (loop.nz[k2] - loop.nz[k]) * u;
      const l = Math.hypot(nx, nz);
      nx /= l; nz /= l;
      return { x: X(lo) + (X(lo + 1) - X(lo)) * u, z: Z(lo) + (Z(lo + 1) - Z(lo)) * u, nx, nz, f: (lo + u) / N };
    },
  };
}

/** One InstancedMesh of cylinders for a list of [ax,ay,az, bx,by,bz, radius] members. */
export function tubes(segments, material, radial = 8) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, radial, 1, false);
  const mesh = new THREE.InstancedMesh(geo, material, segments.length);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), sc = new THREE.Vector3(), m = new THREE.Matrix4();
  segments.forEach((sgm, i) => {
    a.set(sgm[0], sgm[1], sgm[2]);
    b.set(sgm[3], sgm[4], sgm[5]);
    dir.subVectors(b, a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    sc.set(sgm[6], len, sgm[6]);
    m.compose(a.add(b).multiplyScalar(0.5), q, sc);
    mesh.setMatrixAt(i, m);
  });
  mesh.computeBoundingSphere();
  return mesh;
}

/** Scale a geometry's UVs so textures tile in metres. */
export function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}
