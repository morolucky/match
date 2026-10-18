import * as THREE from 'three';
import { at } from '../geom/path.js';
import { SW } from './street.js';

// PBR street props. Each prop is built in a local frame (x along the street, y up, z toward the
// road) and uses the p_* materials, which receive generated PBR maps (see js/pbr/roles.js).

const PI = Math.PI;
const PAINT = ['#d8d8d4', '#1f2b3a', '#8c1d1d', '#c9c6bd', '#2f4f6f', '#5b5f63', '#e7e0d0', '#18181a'];
const paint = (ctx, c) => { const k = 'p_paint_' + c.slice(1); return k; };

export const PROP_DEFS = [['bench', '🪑 مقاعد'], ['bin', '🗑 حاويات'], ['bollard', '⛔ أعمدة حماية'], ['tree', '🌳 أشجار'], ['planter', '🌿 أحواض'], ['kiosk', '📰 كشك'], ['car', '🚗 سيارات']];

function bench(ctx, M) {
  const W = 1.7;
  for (let i = 0; i < 5; i++) ctx.bbox('p_wood', M, -W / 2, 0.45, -0.22 + i * 0.1, W / 2, 0.5, -0.14 + i * 0.1);
  for (let i = 0; i < 3; i++) ctx.bbox('p_wood', M, -W / 2, 0.62 + i * 0.12, -0.27 - i * 0.03, W / 2, 0.7 + i * 0.12, -0.24 - i * 0.03);
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) { ctx.bbox('p_metal', M, x - 0.025, 0, -0.2, x + 0.025, 0.46, -0.16); ctx.bbox('p_metal', M, x - 0.025, 0, 0.2, x + 0.025, 0.46, 0.24); ctx.bbox('p_metal', M, x - 0.025, 0.45, -0.28, x + 0.025, 0.93, -0.24); ctx.bbox('p_metal', M, x - 0.03, 0.44, -0.26, x + 0.03, 0.47, 0.26); }
}

function bin(ctx, M) {
  const c = new THREE.CylinderGeometry(0.27, 0.22, 0.85, 14, 1, true); c.translate(0, 0.45, 0); ctx.add(c, 'p_metal', M);
  ctx.add(new THREE.CircleGeometry(0.22, 14).rotateX(-PI / 2).translate(0, 0.03, 0), 'p_metal', M);
  ctx.add(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 14).translate(0, 0.9, 0), 'p_metal', M);
  ctx.add(new THREE.TorusGeometry(0.27, 0.012, 5, 18).rotateX(PI / 2).translate(0, 0.3, 0), 'a_iron', M);
  ctx.add(new THREE.TorusGeometry(0.27, 0.012, 5, 18).rotateX(PI / 2).translate(0, 0.7, 0), 'a_iron', M);
}

function bollard(ctx, M) {
  ctx.add(new THREE.CylinderGeometry(0.1, 0.12, 0.85, 12).translate(0, 0.43, 0), 'p_conc', M);
  ctx.add(new THREE.SphereGeometry(0.1, 12, 6, 0, PI * 2, 0, PI / 2).translate(0, 0.85, 0), 'p_conc', M);
  ctx.add(new THREE.CylinderGeometry(0.125, 0.125, 0.07, 12).translate(0, 0.62, 0), 'a_mark', M);
}

function planter(ctx, M) {
  ctx.bbox('p_conc', M, -0.7, 0, -0.35, 0.7, 0.55, 0.35); ctx.bbox('p_conc', M, -0.75, 0.55, -0.4, 0.75, 0.62, 0.4);
  for (let i = 0; i < 4; i++) { const b = new THREE.IcosahedronGeometry(0.3 + ctx.rng() * 0.12, 1); b.scale(1, 0.85, 1); b.translate(-0.5 + i * 0.33, 0.9 + ctx.rng() * 0.12, (ctx.rng() - 0.5) * 0.3); ctx.add(b, 'p_leaf', M); }
}

function tree(ctx, M) {
  ctx.bbox('p_metal', M, -0.5, 0, -0.5, 0.5, 0.03, 0.5); // tree grate
  for (let x = -0.4; x <= 0.41; x += 0.2) { ctx.bbox('a_dark', M, x - 0.015, 0.03, -0.5, x + 0.015, 0.05, 0.5); ctx.bbox('a_dark', M, -0.5, 0.03, x - 0.015, 0.5, 0.05, x + 0.015); }
  const h = 3.2 + ctx.rng() * 1.2, t = new THREE.CylinderGeometry(0.12, 0.19, h, 9); t.translate(0, h / 2, 0); ctx.add(t, 'p_bark', M);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + ctx.rng(), br = new THREE.CylinderGeometry(0.04, 0.07, 1.4, 6); br.rotateZ(0.7); br.translate(0.55, 0, 0); br.rotateY(a); br.translate(0, h - 0.7, 0); ctx.add(br, 'p_bark', M); }
  for (let i = 0; i < 7; i++) { const a = i * 0.95, r = i ? 0.95 : 0, b = new THREE.IcosahedronGeometry(0.9 + ctx.rng() * 0.45, 1); b.scale(1, 0.8, 1); b.translate(Math.cos(a) * r, h + 0.35 + (i % 3) * 0.4, Math.sin(a) * r); ctx.add(b, 'p_leaf', M); }
}

function kiosk(ctx, M) {
  const W = 2.2, D = 1.7, H = 2.4;
  ctx.bbox('p_metal', M, -W / 2, 0.1, -D / 2, W / 2, H, D / 2); ctx.bbox('p_conc', M, -W / 2 - 0.05, 0, -D / 2 - 0.05, W / 2 + 0.05, 0.1, D / 2 + 0.05);
  ctx.bbox('p_metal', M, -W / 2 - 0.2, H, -D / 2 - 0.2, W / 2 + 0.2, H + 0.12, D / 2 + 0.55);
  ctx.add(new THREE.PlaneGeometry(W - 0.3, 1.0).translate(0, 1.45, D / 2 + 0.01), 'glass', M, 0.97);
  ctx.bbox('p_wood', M, -W / 2 + 0.1, 0.9, D / 2, W / 2 - 0.1, 0.98, D / 2 + 0.35);
  for (let i = 0; i < 6; i++) ctx.bbox(i % 2 ? 'a_cloth1' : 'a_cloth2', M, -W / 2 + 0.2 + i * 0.3, 1.55, D / 2 + 0.36, -W / 2 + 0.45 + i * 0.3, 1.9, D / 2 + 0.4);
  ctx.add(new THREE.PlaneGeometry(W - 0.2, 0.3).translate(0, H - 0.18, D / 2 + 0.01), 'a_sign3', M);
}

/** parked car: side profile extruded across the width, glasshouse, wheels, lights */
function car(ctx, M, color) {
  const L = 4.3, Wd = 1.78, S = new THREE.Shape();
  S.moveTo(-L / 2, 0.32); S.lineTo(-L / 2, 0.62); S.lineTo(-L / 2 + 0.25, 0.78); S.lineTo(-L / 2 + 0.95, 0.84); S.lineTo(-0.55, 1.32); S.lineTo(0.9, 1.34); S.lineTo(L / 2 - 0.65, 0.86); S.lineTo(L / 2 - 0.15, 0.8); S.lineTo(L / 2, 0.58); S.lineTo(L / 2, 0.32); S.lineTo(-L / 2, 0.32);
  const g = new THREE.ExtrudeGeometry(S, { depth: Wd, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }); g.translate(0, 0, -Wd / 2);
  const key = 'p_paint'; const mk = ctx.paintMat(color); ctx.add(g, mk, M);
  const gl = new THREE.Shape(); gl.moveTo(-0.5, 0.88); gl.lineTo(-0.1, 1.27); gl.lineTo(0.85, 1.29); gl.lineTo(1.4, 0.9); gl.lineTo(-0.5, 0.88);
  for (const sg of [-1, 1]) { const q = new THREE.ShapeGeometry(gl); q.translate(0, 0, sg * (Wd / 2 + 0.056)); ctx.add(q, 'a_shop', M); }
  ctx.add(new THREE.PlaneGeometry(Wd - 0.3, 0.45).rotateY(PI / 2).rotateZ(0.75).translate(-0.62, 1.1, 0), 'a_shop', M);
  for (const x of [-1.38, 1.32]) for (const z of [-1, 1]) {
    const w = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16); w.rotateX(PI / 2); w.translate(x, 0.33, z * (Wd / 2 - 0.08)); ctx.add(w, 'p_tire', M);
    const r = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12); r.rotateX(PI / 2); r.translate(x, 0.33, z * (Wd / 2 - 0.08)); ctx.add(r, 'p_metal', M);
  }
  for (const z of [-1, 1]) { ctx.bbox('lampg', M, L / 2 - 0.02, 0.62, z * 0.62 - 0.17, L / 2 + 0.04, 0.72, z * 0.62 + 0.17); ctx.bbox('cr', M, -L / 2 - 0.04, 0.62, z * 0.62 - 0.18, -L / 2 + 0.01, 0.72, z * 0.62 + 0.18); }
  ctx.bbox('p_tire', M, L / 2 - 0.01, 0.34, -Wd / 2, L / 2 + 0.07, 0.42, Wd / 2); ctx.bbox('p_tire', M, -L / 2 - 0.07, 0.34, -Wd / 2, -L / 2 + 0.01, 0.42, Wd / 2);
}

/** place props along the sidewalk and parking lane */
export function placeProps(ctx, info) {
  const st = ctx.st, P = st.props || {}, R = ctx.rng, d = st.propDensity == null ? 1 : st.propDensity, path = ctx.path;
  const { a, b, closed, sf } = info, len = b - a;
  const off = SW - 1.0; // inside the curb, between facade and road
  const place = (fn, s, out, rot = 0, ...args) => { const M = ctx.frame(s, out, null); if (rot) M.multiply(new THREE.Matrix4().makeRotationY(rot)); fn(ctx, M, ...args); };
  const spaced = (step, jit, fn) => { for (let s = a + step * 0.5; s < b - 0.5; s += step * (1 + R() * jit) / d) fn(s); };
  const onArc = (s) => at(path, s).face.kind === 'arc';
  const nearPillar = (s) => ctx.lay.bays.some((q) => q.face.main && (Math.abs(q.s0 - s) < 0.7 || Math.abs(q.s1 - s) < 0.7));
  if (P.bench) spaced(14, 0.4, (s) => { if (!onArc(s)) place(bench, s, off - 0.3, PI); });
  if (P.bin) spaced(11, 0.5, (s) => { if (!onArc(s)) place(bin, s + 2, off + 0.1); });
  if (P.bollard) spaced(2.4, 0.2, (s) => { if (!onArc(s)) place(bollard, s, SW - 0.55); });
  if (P.tree) spaced(10, 0.2, (s) => place(tree, s + 3.5, SW - 1.0));
  if (P.planter && st.ground !== 'arcade') spaced(9, 0.6, (s) => { if (!onArc(s) && !nearPillar(s)) place(planter, s, 1.1, PI); });
  if (P.kiosk && len > 18) place(kiosk, a + len * 0.72, SW - 1.4, 0);
  if (P.car) for (let s = a + 2.5; s < b - 3; s += 5.2 + R() * 2.2) { if (R() < 0.18) continue; const M = ctx.frame(s, SW + 1.55, null); M.multiply(new THREE.Matrix4().makeRotationY(PI + (R() - 0.5) * 0.06)); car(ctx, M, PAINT[Math.floor(R() * PAINT.length)]); }
}
