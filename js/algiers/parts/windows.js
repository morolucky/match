import * as THREE from 'three';
import { archCurve, archRingShape, extrude, consoleGeo, triangleShape, segmentShape } from '../geom/shapes.js';
import { archHead, WALL_T } from './walls.js';
import { archRise } from '../layout.js';
import { SIGN_N } from '../textures.js';

// Openings: frames, glazing, persiennes / roller shutters, balconnets, mouldings, crowns,
// moucharabieh boxes, fabric awnings; ground-floor entrance doors and shopfronts.

const PI = Math.PI;
/** plane in local xy, centred at (x,y,z); u scaled to metres when uMetric */
function plane(w, h, x, y, z, uMetric) { const g = new THREE.PlaneGeometry(w, h); if (uMetric) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setX(i, u.getX(i) * w); } g.translate(x, y, z); return g; }

function glazing(ctx, M, w, y0, y1, door, inset = -0.17) {
  const h = y1 - y0, fz = inset;
  ctx.add(plane(w - 0.06, h - 0.04, 0, y0 + h / 2, fz), 'glass', M, ctx.rng());
  const F = 'a_frame', t = 0.07, z0 = fz - 0.03, z1 = fz + 0.035;
  ctx.bbox(F, M, -w / 2, y0, z0, -w / 2 + t, y1, z1); ctx.bbox(F, M, w / 2 - t, y0, z0, w / 2, y1, z1);
  ctx.bbox(F, M, -w / 2, y1 - t, z0, w / 2, y1, z1); ctx.bbox(F, M, -w / 2, y0, z0, w / 2, y0 + (door ? 0.12 : t), z1);
  ctx.bbox(F, M, -0.03, y0, z0, 0.03, y1, z1); // meeting stiles of the two casements
  if (h > 1.9) ctx.bbox(F, M, -w / 2, y0 + h * 0.78, z0, w / 2, y0 + h * 0.78 + 0.05, z1);
  if (door) ctx.bbox(F, M, -w / 2, y0 + 0.12, z0, w / 2, y0 + 0.75, z1 - 0.01); // solid lower panels
  if (ctx.rng() < 0.45) { const cw = w * (0.3 + ctx.rng() * 0.25); ctx.add(plane(cw, h * 0.92, (ctx.rng() < 0.5 ? -1 : 1) * (w / 2 - cw / 2 - 0.04), y0 + h * 0.48, fz - 0.12), ['curt', 'cw', 'cb', 'cg'][Math.floor(ctx.rng() * 4)], M); }
}

function persiennes(ctx, M, w, y0, y1, zh, st) {
  const lw = w / 2, h = y1 - y0, p = ctx.rng();
  const phi = p < st.shutterOpen * 0.8 ? PI * (0.97 + ctx.rng() * 0.03) : p < st.shutterOpen ? PI * (0.35 + ctx.rng() * 0.3) : ctx.rng() < 0.25 ? PI * 0.12 : 0;
  for (const sg of [1, -1]) {
    const g = new THREE.BoxGeometry(lw - 0.01, h, 0.035); g.translate(-sg * (lw / 2), y0 + h / 2, 0); g.rotateY(sg * phi); g.translate(sg * w / 2, 0, zh); ctx.add(g, 'a_shut', M);
  }
}

function rollerShutter(ctx, M, w, y0, y1, st) {
  ctx.bbox('a_roller', M, -w / 2 - 0.03, y1 - 0.02, -0.12, w / 2 + 0.03, y1 + 0.22, 0.08);
  const d = (1 - st.shutterOpen) * (0.2 + ctx.rng() * 0.8) * (y1 - y0);
  if (d > 0.05) ctx.add(plane(w - 0.02, d, 0, y1 - d / 2, -0.09), 'a_roller', M);
}

/** iron railing panel (local plane) with a top bar */
export function railPanel(ctx, M, w, y0, h, z) { ctx.add(plane(w, h, 0, y0 + h / 2, z, true), 'a_rail', M); ctx.bbox('a_iron', M, -w / 2, y0 + h - 0.03, z - 0.03, w / 2, y0 + h + 0.03, z + 0.03); ctx.bbox('a_iron', M, -w / 2, y0, z - 0.025, w / 2, y0 + 0.04, z + 0.025); }

function awning(ctx, M, w, y1, mat) {
  const L = 1.0, g = new THREE.PlaneGeometry(w + 0.2, L); g.rotateX(-PI / 2 + 0.75); g.translate(0, y1 + 0.05 - Math.sin(0.75) * L / 2 * 0.0 - L * Math.cos(PI / 2 - 0.75) / 2 + 0.1, 0.05 + L * Math.cos(0.75) / 2);
  ctx.add(g, mat, M); ctx.bbox('a_iron', M, -w / 2 - 0.1, y1 - 0.62, 0.78, w / 2 + 0.1, y1 - 0.58, 0.82);
}

function moucharabieh(ctx, M, w, y0, y1) {
  const d = 0.55, W2 = w / 2 + 0.12, h = y1 - y0, b = y0 + h * 0.12, t = y1 + 0.1;
  ctx.bbox('a_wood', M, -W2, b - 0.12, 0, W2, b, d); ctx.bbox('a_wood', M, -W2 - 0.05, t, 0, W2 + 0.05, t + 0.1, d + 0.08);
  for (const x of [-W2, W2]) ctx.bbox('a_wood', M, x - 0.04, b, d - 0.08, x + 0.04, t, d);
  ctx.add(plane(W2 * 2, t - b, 0, (b + t) / 2, d - 0.04), 'a_lat', M);
  for (const sg of [-1, 1]) { const g = plane(d - 0.08, t - b, 0, (b + t) / 2, 0); g.rotateY(PI / 2); g.translate(sg * W2, 0, (d - 0.08) / 2); ctx.add(g, 'a_lat', M); }
  for (const x of [-W2 + 0.15, W2 - 0.15]) { const c = consoleGeo('simple', d, 0.35, 0.1); c.translate(x, b - 0.12, 0); ctx.add(c, 'a_wood', M); }
}

/** mouldings around an opening (level 0..3), returns nothing */
function surround(ctx, M, o, st, yS) {
  const lvl = o.main ? st.surround : Math.min(st.surround, 1); if (!lvl) return;
  const { w, y0, y1 } = o, T = 'a_trim', bw = 0.15, pz = 0.05;
  const sideTop = o.arch ? yS : y1;
  ctx.bbox(T, M, -w / 2 - bw, y0, 0, -w / 2, sideTop, pz); ctx.bbox(T, M, w / 2, y0, 0, w / 2 + bw, sideTop, pz);
  if (o.arch) ctx.add(extrude(archRingShape(o.arch, w / 2, yS, bw), pz).translate(0, 0, pz), T, M);
  else ctx.bbox(T, M, -w / 2 - bw, y1, 0, w / 2 + bw, y1 + bw, pz);
  if (!o.door) { ctx.bbox(T, M, -w / 2 - 0.2, y0 - 0.1, -0.05, w / 2 + 0.2, y0, 0.16); if (lvl >= 2) for (const sg of [-1, 1]) { const c = consoleGeo('simple', 0.14, 0.24, 0.12); c.translate(sg * (w / 2 + 0.05), y0 - 0.1, 0); ctx.add(c, T, M); } }
  if (lvl < 2) return;
  const top = o.arch ? archCurve(o.arch, w / 2, yS, 8).top + bw : y1 + bw;
  if (o.arch) { // keystone
    const k = new THREE.Shape(); k.moveTo(-0.11, -0.05); k.lineTo(0.11, -0.05); k.lineTo(0.16, 0.32); k.lineTo(-0.16, 0.32); k.lineTo(-0.11, -0.05);
    ctx.add(extrude(k, 0.1).translate(0, top - bw, 0.1), T, M);
    if (lvl >= 3 && st.ornament > 0.4) { const s = new THREE.SphereGeometry(0.1, 10, 8); s.scale(1, 1.2, 0.6); s.translate(0, top + 0.06, 0.12); ctx.add(s, T, M); }
  } else if (o.crown === 'cornice' || o.crown === 'tri' || o.crown === 'seg') {
    ctx.bbox(T, M, -w / 2 - bw, top, 0, w / 2 + bw, top + 0.2, 0.06); // frieze
    ctx.bbox(T, M, -w / 2 - 0.32, top + 0.2, -0.02, w / 2 + 0.32, top + 0.3, 0.2); // cornice
    for (const sg of [-1, 1]) { const c = consoleGeo('scroll', 0.18, 0.42, 0.12); c.translate(sg * (w / 2 + 0.2), top + 0.2, 0); ctx.add(c, T, M); }
    if (o.crown === 'tri') ctx.add(extrude(triangleShape(w / 2 + 0.34, 0.45), 0.16).translate(0, top + 0.3, 0.16), T, M);
    if (o.crown === 'seg') ctx.add(extrude(segmentShape(w / 2 + 0.34, 0.32), 0.16).translate(0, top + 0.3, 0.16), T, M);
    if (lvl >= 3 && st.ornament > 0.5) { const s = new THREE.SphereGeometry(0.12, 10, 8); s.scale(1.3, 1, 0.5); s.translate(0, top + 0.1, 0.07); ctx.add(s, T, M); }
  }
  if (lvl >= 3 && !o.door && st.ornament > 0.3) { // allège panel under the sill
    const p0 = Math.max(o.y0 - 0.85, o.y0 - (o.y0 - (o.floor ? 0 : 0)) + 0.2);
    ctx.bbox(T, M, -w / 2, p0, 0, w / 2, p0 + 0.05, 0.03); ctx.bbox(T, M, -w / 2, o.y0 - 0.17, 0, w / 2, o.y0 - 0.12, 0.03);
    ctx.bbox(T, M, -w / 2, p0, 0, -w / 2 + 0.05, o.y0 - 0.12, 0.03); ctx.bbox(T, M, w / 2 - 0.05, p0, 0, w / 2, o.y0 - 0.12, 0.03);
  }
}

/** a complete upper-floor opening (o from layout.upperOpenings) */
export function upperWindow(ctx, o) {
  const st = ctx.st, M = ctx.frame(o.sc, 0, o.face);
  const yS = o.arch ? archHead(ctx, M, o.arch, o.w, o.y1) : o.y1;
  glazing(ctx, M, o.w, o.y0, o.y1, o.door);
  const mouch = st.mouch && o.main && !o.door && ctx.rng() < 0.6;
  if (mouch) moucharabieh(ctx, M, o.w, o.y0, o.y1);
  else if (st.shutter === 'persienne') persiennes(ctx, M, o.w, o.y0, o.arch ? yS + archRise(o.arch, o.w / 2) * 0.55 : o.y1, o.main && st.surround ? 0.075 : 0.03, st);
  else if (st.shutter === 'roller') rollerShutter(ctx, M, o.w, o.y0, yS, st);
  if (o.door && o.bal === 'none') railPanel(ctx, M, o.w - 0.04, o.y0, 0.95, -0.06); // balconnet in the reveal
  surround(ctx, M, o, st, yS);
  if (o.door && o.bal !== 'none' && ctx.rng() < st.awnings) awning(ctx, M, o.w, o.y1, ctx.rng() < 0.7 ? 'a_awn' : 'awn' + Math.floor(ctx.rng() * 4));
}

/** rear / plain ground-floor window with a security grille */
export function groundWindow(ctx, o) {
  const M = ctx.frame(o.sc, 0, o.face);
  glazing(ctx, M, o.w, o.y0, o.y1, false);
  for (let x = -o.w / 2 + 0.12; x < o.w / 2; x += 0.14) ctx.bbox('a_iron', M, x - 0.012, o.y0, 0.02, x + 0.012, o.y1, 0.045);
  ctx.bbox('a_trim', M, -o.w / 2 - 0.15, o.y0 - 0.1, -0.05, o.w / 2 + 0.15, o.y0, 0.14);
}

/** porte cochère: double wooden door under a glazed fanlight */
export function entryDoor(ctx, o, M = ctx.frame(o.sc, 0, o.face), thk = WALL_T) {
  const { w, y0, y1 } = o, yS = archHead(ctx, M, 'round', w, y1, thk, 'a_trim');
  const z = -0.22, dh = yS - y0 - 0.05;
  for (const sg of [-1, 1]) { ctx.bbox('a_wood', M, sg < 0 ? -w / 2 : 0.01, y0, z - 0.06, sg < 0 ? -0.01 : w / 2, y0 + dh, z); for (let k = 0; k < 3; k++) ctx.bbox('a_wood', M, sg * w / 4 - w / 6, y0 + 0.3 + k * dh / 3.2, z, sg * w / 4 + w / 6, y0 + 0.3 + k * dh / 3.2 + dh / 4.2, z + 0.04); }
  ctx.bbox('brass', M, -0.06, y0 + dh * 0.45, z, 0.06, y0 + dh * 0.45 + 0.12, z + 0.06);
  ctx.add(plane(w, yS + w / 2 - (y0 + dh), 0, (y0 + dh + yS + w / 2) / 2, z - 0.03), 'glass', M, 0.95);
  for (let a = 1; a < 6; a++) { const t = PI * a / 6, r = w / 2; ctx.bbox('a_iron', M, Math.cos(t) * r / 2 - 0.015, yS + Math.sin(t) * r / 2 - 0.015, z - 0.01, Math.cos(t) * r / 2 + 0.015, yS + Math.sin(t) * r / 2 + 0.015, z + 0.01); }
  ctx.bbox('a_trim', M, -w / 2 - 0.25, y0, 0, -w / 2, yS, 0.08); ctx.bbox('a_trim', M, w / 2, y0, 0, w / 2 + 0.25, yS, 0.08);
  ctx.add(extrude(archRingShape('round', w / 2, yS, 0.25), 0.08).translate(0, 0, 0.08), 'a_trim', M);
  ctx.bbox('a_trim', M, -w / 2 - 0.45, yS + w / 2 + 0.3, -0.02, w / 2 + 0.45, yS + w / 2 + 0.45, 0.25);
}

/** shopfront in an opening: glazing, sign board, half-lowered roller shutter, optional awning */
export function shopFront(ctx, o, M = ctx.frame(o.sc, 0, o.face), thk = WALL_T, awn = false) {
  const st = ctx.st, { w, y0, y1 } = o;
  const yS = o.arch ? archHead(ctx, M, o.arch, w, y1, thk) : y1;
  const top = yS - (st.signs ? 0.55 : 0), z = -0.2;
  ctx.add(plane(w - 0.1, top - y0 - 0.1, 0, (top + y0) / 2, z), 'a_shop', M);
  ctx.bbox('a_dark', M, -w / 2, y0, z - 0.04, -w / 2 + 0.08, top, z + 0.04); ctx.bbox('a_dark', M, w / 2 - 0.08, y0, z - 0.04, w / 2, top, z + 0.04); ctx.bbox('a_dark', M, w * 0.12 - 0.04, y0, z - 0.04, w * 0.12 + 0.04, top, z + 0.04);
  ctx.bbox('a_dark', M, -w / 2, y0, z - 0.04, w / 2, y0 + 0.4, z + 0.02);
  if (st.signs) ctx.add(plane(w - 0.1, 0.5, 0, top + 0.27, -0.04), 'a_sign' + Math.floor(ctx.rng() * SIGN_N), M);
  if (ctx.rng() < st.shopShutters) { const d = (0.3 + ctx.rng() * 0.7) * (top - y0); ctx.add(plane(w - 0.04, d, 0, top - d / 2, -0.08), 'a_roller', M); }
  if (awn && ctx.rng() < 0.55) { const L = 1.3, g = new THREE.PlaneGeometry(w, L); g.rotateX(-PI / 2 + 0.6); g.translate(0, top + 0.1 - Math.sin(0.97) * L / 2 + 0.0, L * Math.cos(0.97) / 2 + 0.05); ctx.add(g, 'awn' + Math.floor(ctx.rng() * 4), M); }
}
