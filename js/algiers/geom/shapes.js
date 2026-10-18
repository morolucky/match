import * as THREE from 'three';

// 2D shape library: arches, archivolts, pediments, consoles (corbels) and lathe profiles.

export const ARCHES = ['round', 'seg', 'horse', 'basket', 'flat', 'pointed'];

/**
 * Intrados of an arch spanning x ∈ [-a, a] with springing line at y = yS,
 * from the right foot over the crown to the left foot. Returns {pts:[[x,y]], nrm:[[nx,ny]], top}.
 */
export function archCurve(kind, a, yS, n = 18, maxHalf = Infinity) {
  const pts = [], nrm = [];
  const circ = (cx, cy, R, t0, t1) => { for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, c = Math.cos(t), s = Math.sin(t); pts.push([cx + R * c, cy + R * s]); nrm.push([c, s]); } };
  if (kind === 'flat') { pts.push([a, yS], [-a, yS]); nrm.push([0, 1], [0, 1]); return { pts, nrm, top: yS }; }
  if (kind === 'round') circ(0, yS, a, 0, Math.PI);
  else if (kind === 'seg') { const h = a * 0.36, R = (a * a + h * h) / (2 * h), cy = yS + h - R, t0 = Math.atan2(yS - cy, a); circ(0, cy, R, t0, Math.PI - t0); }
  else if (kind === 'horse') { const R = Math.min(a * 1.16, maxHalf - 0.04), cy = yS + Math.sqrt(Math.max(R * R - a * a, 0)), t0 = Math.atan2(yS - cy, a); circ(0, cy, R, t0, Math.PI - t0); }
  else if (kind === 'basket') { for (let i = 0; i <= n; i++) { const t = Math.PI * i / n, c = Math.cos(t), s = Math.sin(t); pts.push([a * c, yS + a * 0.62 * s]); const nx = c / a, ny = s / (a * 0.62), l = Math.hypot(nx, ny); nrm.push([nx / l, ny / l]); } }
  else if (kind === 'pointed') { // two-centred (Moorish/gothic) arch
    const R = a * 1.45, h = n >> 1, tA = Math.acos((R - a) / R); // right arc centred at (a-R, yS)
    for (let i = 0; i <= h; i++) { const t = (i / h) * tA, c = Math.cos(t), s = Math.sin(t); pts.push([a - R + R * c, yS + R * s]); nrm.push([c, s]); }
    for (let i = h - 1; i >= 0; i--) { const t = (i / h) * tA, c = Math.cos(t), s = Math.sin(t); pts.push([-(a - R + R * c), yS + R * s]); nrm.push([-c, s]); }
  }
  let top = -Infinity; for (const p of pts) top = Math.max(top, p[1]);
  return { pts, nrm, top };
}

/** wall piece filling an opening's head above the arch: x ∈ [-hw, hw], y ∈ [yS, yTop] minus the arch */
export function spandrelShape(kind, a, hw, yS, yTop) {
  const { pts } = archCurve(kind, a, yS, 20, hw);
  const s = new THREE.Shape();
  s.moveTo(-hw, yS); s.lineTo(-hw, yTop); s.lineTo(hw, yTop); s.lineTo(hw, yS);
  for (const p of pts) s.lineTo(p[0], Math.min(p[1], yTop - 0.02));
  s.lineTo(-hw, yS);
  return s;
}

/** archivolt band of thickness t around the intrados */
export function archRingShape(kind, a, yS, t) {
  const { pts, nrm } = archCurve(kind, a, yS, 20);
  const s = new THREE.Shape();
  pts.forEach((p, i) => { const q = [p[0] + nrm[i][0] * t, p[1] + nrm[i][1] * t]; i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1]); });
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(pts[i][0], pts[i][1]);
  return s;
}

export function extrude(shape, depth, seg = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -depth); return g; // front face at z = 0, body goes into the wall
}

/** console / corbel: profile in (out, up) extruded along the façade; top at y = 0, front of wall at z = 0 */
export function consoleGeo(style, D, H, width) {
  const s = new THREE.Shape();
  if (style === 'simple') { s.moveTo(0, 0); s.lineTo(D, 0); s.lineTo(D, -0.08); s.quadraticCurveTo(D * 0.25, -0.12, 0, -H); }
  else if (style === 'heavy') {
    s.moveTo(0, 0); s.lineTo(D, 0); s.lineTo(D, -0.12); s.bezierCurveTo(D * 0.92, -0.32, D * 0.55, -0.3, D * 0.5, -H * 0.45);
    s.bezierCurveTo(D * 0.45, -H * 0.62, D * 0.3, -H * 0.8, D * 0.2, -H * 0.86); s.quadraticCurveTo(D * 0.3, -H, D * 0.12, -H); s.lineTo(0, -H);
  } else { // scroll (ogee + volute)
    s.moveTo(0, 0); s.lineTo(D, 0); s.lineTo(D, -0.09); s.bezierCurveTo(D * 0.62, -0.1, D * 0.7, -H * 0.55, D * 0.3, -H * 0.72);
    s.quadraticCurveTo(D * 0.16, -H * 0.82, D * 0.2, -H * 0.92); s.quadraticCurveTo(D * 0.1, -H, 0, -H);
  }
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 8 });
  g.rotateY(-Math.PI / 2); g.translate(width / 2, 0, 0); return g;
}

export function triangleShape(b, h) { const s = new THREE.Shape(); s.moveTo(-b, 0); s.lineTo(b, 0); s.lineTo(0, h); s.lineTo(-b, 0); return s; }
export function segmentShape(b, h) { const s = new THREE.Shape(); const R = (b * b + h * h) / (2 * h), cy = h - R, t0 = Math.atan2(-cy, b); s.moveTo(-b, 0); s.lineTo(b, 0); s.absarc(0, cy, R, t0, Math.PI - t0, false); s.lineTo(-b, 0); return s; }

const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
export const LATHE = {
  baluster: V2([[0, 0], [0.07, 0], [0.07, 0.06], [0.05, 0.08], [0.085, 0.24], [0.09, 0.32], [0.05, 0.45], [0.035, 0.52], [0.05, 0.56], [0.06, 0.6], [0.06, 0.64], [0, 0.64]]),
  hemi: V2(Array.from({ length: 13 }, (_, i) => { const t = (i / 12) * Math.PI / 2; return [Math.cos(t), Math.sin(t) * 0.95]; })),
  imperial: V2([[1, 0], [1.02, 0.08], [0.98, 0.3], [0.86, 0.6], [0.6, 0.85], [0.42, 0.95], [0.3, 1.1], [0.22, 1.32], [0, 1.36]]),
  onion: V2([[0.82, 0], [0.98, 0.18], [1.04, 0.4], [0.94, 0.66], [0.66, 0.92], [0.34, 1.12], [0.12, 1.3], [0.04, 1.42], [0, 1.46]]),
  lanternCap: V2([[0, 0], [0.14, 0], [0.16, 0.03], [0.1, 0.12], [0.03, 0.2], [0.04, 0.26], [0, 0.3]]),
  lanternGlass: V2([[0, 0], [0.07, 0], [0.12, 0.18], [0.13, 0.3], [0, 0.3]]),
  poleBase: V2([[0, 0], [0.22, 0], [0.22, 0.12], [0.16, 0.2], [0.17, 0.45], [0.12, 0.55], [0.1, 0.9], [0.08, 1.0], [0, 1.0]]),
  pot: V2([[0, 0], [0.14, 0], [0.19, 0.28], [0.21, 0.3], [0, 0.3]]),
  dish: V2(Array.from({ length: 8 }, (_, i) => { const r = 0.4 * i / 7; return [r, r * r * 0.9]; })),
  tank: V2([[0, 0], [0.55, 0], [0.55, 1.1], [0.45, 1.25], [0, 1.28]]),
};
