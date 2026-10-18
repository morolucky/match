import * as THREE from 'three';
import { footprint, samples, polygon, at } from '../geom/path.js';
import { sweep, ribbon } from '../geom/sweep.js';
import { consoleGeo, extrude, triangleShape, LATHE } from '../geom/shapes.js';
import { wallBand } from './walls.js';
import { MAIN_FACES } from '../layout.js';

// Crowning of the building: main cornice (simple / dentils / modillions), parapets
// (solid, balustrade, iron, Moorish merlons), zinc mansard with dormers, set-back attic,
// corner domes (imperial / hemispherical / onion), chimneys and rooftop water tanks.

const CORNICE = {
  none: [[-0.1, 0], [0.04, 0], [0.04, 0.12], [-0.1, 0.12]],
  simple: [[-0.1, 0], [0.05, 0], [0.08, 0.06], [0.2, 0.18], [0.3, 0.24], [0.3, 0.34], [-0.1, 0.34]],
  dentil: [[-0.1, -0.05], [0.06, -0.05], [0.06, 0.1], [0.14, 0.14], [0.14, 0.28], [0.46, 0.4], [0.52, 0.46], [0.52, 0.6], [-0.1, 0.6]],
  modillion: [[-0.1, -0.05], [0.06, -0.05], [0.06, 0.1], [0.14, 0.14], [0.14, 0.42], [0.6, 0.46], [0.68, 0.54], [0.68, 0.7], [-0.1, 0.7]],
};

function shapeOf(pts, flip = 1) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z * flip) : s.moveTo(x, -z * flip))); return s; }
function deck(ctx, path, y, mat) { const g = new THREE.ShapeGeometry(shapeOf(polygon(path))); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); ctx.add(g, mat); }

export function roof(ctx) {
  const st = ctx.st, lay = ctx.lay, path = ctx.path, H = lay.H;
  const all = samples(path, 0, path.L, true);
  const prof = CORNICE[st.cornice] || CORNICE.simple, ch = prof[prof.length - 1][1];
  ctx.add(sweep(all, prof, { y: H, closed: true }), 'a_trim');
  const mainS = path.faces.filter((f) => f.main);
  if (st.cornice === 'dentil') for (const f of mainS) for (let s = f.s0 + 0.12; s < f.s1 - 0.06; s += 0.2) ctx.bbox('a_trim', ctx.frame(s, 0, f), -0.045, H + 0.14, 0.06, 0.045, H + 0.26, 0.15);
  if (st.cornice === 'modillion') for (const f of mainS) for (let s = f.s0 + 0.3; s < f.s1 - 0.15; s += 0.62) { const g = consoleGeo('scroll', 0.5, 0.28, 0.13); g.translate(0, H + 0.46, 0); ctx.add(g, 'a_trim', ctx.frame(s, 0, f)); }
  const top = H + ch;
  deck(ctx, footprint(st.W, st.D, st.corner, st.cornerSize, 0.15), top - 0.03, 'a_terr');
  let peak = top + 1;
  if (st.roof === 'mansard') peak = mansard(ctx, top);
  else if (st.roof === 'attic') { parapet(ctx, all, top, st.parapet === 'none' ? 'iron' : st.parapet); peak = attic(ctx, top); }
  else { parapet(ctx, all, top, st.parapet); peak = top + 1.1; }
  if (st.dome !== 'none' && st.sides !== 'front') peak = Math.max(peak, dome(ctx, top));
  rooftop(ctx, st.roof === 'mansard' ? top + st.mh : top);
  return peak;
}

function parapet(ctx, S, y, kind) {
  if (kind === 'none') return;
  if (kind === 'iron') { ctx.add(ribbon(S, -0.05, y, y + 1.0), 'a_rail'); ctx.add(sweep(S, [[-0.09, 0.98], [-0.02, 0.98], [-0.02, 1.04], [-0.09, 1.04]], { y, closed: true }), 'a_iron'); return; }
  if (kind === 'balustrade') {
    ctx.add(sweep(S, [[-0.3, 0], [0.02, 0], [0.02, 0.2], [-0.3, 0.2]], { y, closed: true }), 'a_trim');
    ctx.add(sweep(S, [[-0.32, 0.84], [0.06, 0.84], [0.06, 0.96], [-0.32, 0.96]], { y, closed: true }), 'a_trim');
    const path = ctx.path;
    for (const f of path.faces) {
      if (!f.main) { ctx.add(sweep(samples(path, f.s0, f.s1), [[-0.25, 0.2], [-0.02, 0.2], [-0.02, 0.84], [-0.25, 0.84]], { y }), 'a_trim'); continue; }
      const n = Math.max(1, Math.round(f.len / 0.27));
      for (let k = 0; k < n; k++) { const s = f.s0 + (k + 0.5) * f.len / n, M = ctx.frame(s, 0, f), g = new THREE.LatheGeometry(LATHE.baluster, 8); g.translate(0, y + 0.2, -0.13); ctx.add(g, 'a_trim', M); }
      for (const b of f.bays) ctx.bbox('a_trim', ctx.frame(b.s0, 0, f), -0.17, y + 0.2, -0.3, 0.17, y + 0.84, 0.03);
    }
    return;
  }
  ctx.add(sweep(S, [[-0.25, 0], [0.02, 0], [0.02, 0.85], [-0.25, 0.85]], { y, closed: true }), 'a_wall');
  ctx.add(sweep(S, [[-0.3, 0.85], [0.06, 0.85], [0.06, 0.95], [-0.3, 0.95]], { y, closed: true }), 'a_trim');
  if (kind === 'crenel') for (const f of ctx.path.faces) for (let s = f.s0 + 0.35; s < f.s1 - 0.2; s += 0.8) {
    const M = ctx.frame(s, 0, f); ctx.bbox('a_wall', M, -0.24, y + 0.95, -0.25, 0.24, y + 1.3, 0.02); ctx.bbox('a_wall', M, -0.14, y + 1.3, -0.2, 0.14, y + 1.52, -0.02);
    const c = new THREE.ConeGeometry(0.12, 0.2, 4); c.rotateY(Math.PI / 4); c.translate(0, y + 1.62, -0.11); ctx.add(c, 'a_wall', M);
  }
}

function mansard(ctx, top) {
  const st = ctx.st, path = ctx.path, mh = st.mh, inn = Math.min(0.9, mh * 0.3);
  const all = samples(path, 0, path.L, true);
  ctx.add(sweep(all, [[-inn - 0.6, 0], [0.02, 0], [-inn, mh], [-inn - 0.6, mh]], { y: top, closed: true }), 'a_zinc');
  deck(ctx, footprint(st.W, st.D, st.corner, st.cornerSize, inn + 0.02), top + mh, 'a_zinc');
  ctx.add(sweep(samples(path, 0, path.L, true), [[-inn - 0.05, 0], [-inn + 0.05, 0], [-inn + 0.05, 0.12], [-inn - 0.05, 0.12]], { y: top + mh, closed: true }), 'a_iron');
  if (st.dormers) for (const f of path.faces) {
    if (!f.main || f.kind === 'arc') continue;
    for (const b of f.bays) {
      const M = ctx.frame(b.sc, 0, f), dw = Math.min(1.0, b.w * 0.45), zf = -inn * 0.32, yb = top + mh * 0.3, dh = Math.min(mh * 0.62, 1.5);
      ctx.bbox('a_trim', M, -dw / 2 - 0.16, yb, zf - 1.4, dw / 2 + 0.16, yb + dh, zf);
      ctx.add(new THREE.PlaneGeometry(dw, dh - 0.25).translate(0, yb + (dh - 0.25) / 2 + 0.1, zf + 0.01), 'glass', M, ctx.rng());
      ctx.bbox('a_frame', M, -0.025, yb + 0.1, zf, 0.025, yb + dh - 0.15, zf + 0.03);
      if (st.ornament > 0.45) { const c = new THREE.CylinderGeometry(dw / 2 + 0.2, dw / 2 + 0.2, 1.5, 14, 1, false, -Math.PI / 2, Math.PI); c.rotateX(Math.PI / 2); c.translate(0, yb + dh, zf - 0.7); ctx.add(c, 'a_zinc', M); }
      else ctx.add(extrude(triangleShape(dw / 2 + 0.28, 0.45), 1.5).translate(0, yb + dh, zf + 0.05), 'a_zinc', M);
    }
  }
  return top + mh + 1;
}

function attic(ctx, top) {
  const st = ctx.st, inset = 1.6, h = st.fh * 0.92;
  const inner = footprint(st.W, st.D, st.corner, st.cornerSize, inset, new Set(MAIN_FACES[st.sides]));
  for (const f of inner.faces) {
    const n = Math.max(1, Math.round(f.len / st.bay)), w = Math.min(st.winW, f.len / n - 0.6);
    const ops = w > 0.5 && f.len > 1.6 ? Array.from({ length: n }, (_, k) => { const sc = f.s0 + (k + 0.5) * f.len / n; return { sc, s0: sc - w / 2, s1: sc + w / 2, y0: top + 0.05, y1: top + h * 0.82, w }; }) : [];
    wallBand(ctx, inner, f, top, top + h, ops, 'a_wall', 0.3);
    for (const o of ops) { const M = ctx.frame(o.sc, 0, f, inner); ctx.add(new THREE.PlaneGeometry(o.w, o.y1 - o.y0).translate(0, (o.y0 + o.y1) / 2, -0.15), 'glass', M, ctx.rng()); ctx.bbox('a_frame', M, -0.03, o.y0, -0.16, 0.03, o.y1, -0.12); if (st.shutter === 'persienne') { ctx.bbox('a_shut', M, -o.w, o.y0, 0.02, -o.w / 2, o.y1, 0.05); ctx.bbox('a_shut', M, o.w / 2, o.y0, 0.02, o.w, o.y1, 0.05); } }
  }
  const S = samples(inner, 0, inner.L, true);
  ctx.add(sweep(S, CORNICE.simple, { y: top + h, closed: true }), 'a_trim');
  deck(ctx, inner, top + h + 0.3, 'a_terr');
  parapet(ctx, S, top + h + 0.34, 'solid');
  return top + h + 1.4;
}

function dome(ctx, top) {
  const st = ctx.st, p = ctx.path, prof = LATHE[st.dome] || LATHE.imperial;
  const base = top, drumH = Math.max(1.6, st.fh * 0.7) + (st.roof === 'mansard' ? 0.5 : 0.95);
  // drum: cylinder on a round corner, octagon on a chamfer, square pavilion on a sharp corner
  let cx, cz, ap, seg, rot;
  if (st.corner === 'round' && p.k > 0.8) { ap = p.k - 0.03; cx = p.hw - p.k; cz = p.hd - p.k; seg = 32; rot = 0; }
  else if (st.corner === 'chamfer' && p.k > 0.5) { ap = Math.min(2.6, 1.5 * p.k); const d = p.k / 2 + ap / Math.SQRT2; cx = p.hw - d; cz = p.hd - d; seg = 8; rot = Math.PI / 8; }
  else { ap = 1.8; cx = p.hw - ap; cz = p.hd - ap; seg = 4; rot = Math.PI / 4; }
  const R = seg > 8 ? ap : ap / Math.cos(Math.PI / seg), M = new THREE.Matrix4().makeTranslation(cx, 0, cz);
  const cyl = (r, h, y, mat) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.rotateY(rot); g.translate(0, y, 0); ctx.add(g, mat, M); };
  cyl(R, drumH, base + drumH / 2, 'a_wall'); cyl(R * 1.05, 0.25, base + drumH - 0.1, 'a_trim'); cyl(R * 1.03, 0.2, base + 0.1 + (st.roof === 'mansard' ? 0 : 0.95), 'a_trim');
  const nw = seg > 8 ? 8 : seg;
  for (let i = 0; i < nw; i++) { // oculi on every drum face
    const th = i * Math.PI * 2 / nw, W = new THREE.Matrix4().makeRotationY(th).setPosition(cx + Math.sin(th) * ap, 0, cz + Math.cos(th) * ap), y = base + drumH * 0.6;
    ctx.add(new THREE.CircleGeometry(0.32, 16).translate(0, y, 0.02), 'glass', W, ctx.rng());
    ctx.add(new THREE.TorusGeometry(0.37, 0.06, 6, 16).translate(0, y, 0.03), 'a_trim', W);
  }
  const k = st.dome === 'onion' ? 1.2 : 1, d = new THREE.LatheGeometry(prof, seg); d.scale(R, R * k, R); d.rotateY(rot); d.translate(0, base + drumH, 0); ctx.add(d, 'a_dome', M);
  const hTop = base + drumH + R * k * prof[prof.length - 1].y;
  const lan = new THREE.CylinderGeometry(0.26, 0.3, 0.6, 8); lan.translate(0, hTop + 0.2, 0); ctx.add(lan, 'a_trim', M);
  const cap = new THREE.LatheGeometry(LATHE.lanternCap, 8); cap.scale(2.2, 2, 2.2); cap.translate(0, hTop + 0.5, 0); ctx.add(cap, 'a_dome', M);
  ctx.add(new THREE.CylinderGeometry(0.025, 0.04, 1.2, 6).translate(0, hTop + 1.5, 0), 'brass', M);
  ctx.add(new THREE.SphereGeometry(0.1, 10, 8).translate(0, hTop + 1.25, 0), 'brass', M);
  if (st.dome === 'onion') { const cr = new THREE.TorusGeometry(0.18, 0.03, 6, 14, Math.PI * 1.6); cr.rotateZ(Math.PI * 0.7); cr.translate(0, hTop + 2.05, 0); ctx.add(cr, 'brass', M); }
  return hTop + 2.2;
}

function rooftop(ctx, y) {
  const st = ctx.st, p = ctx.path, L = st.life, R = ctx.rng;
  const hx = p.hw - 2.2, hz = p.hd - 2.2; if (hx < 0.5 || hz < 0.5) return;
  const spot = () => [-hx + R() * hx * 1.6, -hz + R() * hz * 1.2]; // keep the corner (dome) free
  if (st.chimneys) for (let i = 0; i < 2 + Math.floor(p.hw / 6); i++) {
    const [x, z] = spot(), M = new THREE.Matrix4().makeTranslation(x, 0, z), w = 0.6 + R() * 0.8;
    ctx.bbox('a_wall', M, -w / 2, y, -0.3, w / 2, y + 1.3, 0.3); ctx.bbox('a_trim', M, -w / 2 - 0.08, y + 1.3, -0.38, w / 2 + 0.08, y + 1.42, 0.38);
    for (let k = 0; k < Math.max(1, Math.round(w / 0.35)); k++) { const c = new THREE.CylinderGeometry(0.07, 0.09, 0.35, 8); c.translate(-w / 2 + 0.18 + k * 0.32, y + 1.6, 0); ctx.add(c, 'p_pot', M); }
  }
  if (L.tanks && st.roof !== 'mansard') for (let i = 0; i < 2 + Math.floor(R() * 4); i++) {
    const [x, z] = spot(), t = new THREE.LatheGeometry(LATHE.tank, 14); if (R() < 0.5) { t.rotateZ(Math.PI / 2); t.translate(-0.55, 0.6, 0); } t.translate(x, y + 0.05, z); ctx.add(t, R() < 0.6 ? 'a_ac' : 'a_metal');
  }
  if (L.dishes) for (let i = 0; i < 2 + Math.floor(R() * 4); i++) { const [x, z] = spot(); dishAt(ctx, new THREE.Matrix4().makeRotationY(R() * 6.28).setPosition(x, y, z), 0); }
}

/** satellite dish on a short mast, local origin at its foot */
export function dishAt(ctx, M, y) {
  ctx.bbox('a_metal', M, -0.02, y, -0.02, 0.02, y + 0.7, 0.02);
  const d = new THREE.LatheGeometry(LATHE.dish, 12); d.rotateX(Math.PI / 2 - 0.6); d.translate(0, y + 0.75, 0.05); ctx.add(d, 'a_ac', M);
  ctx.bbox('a_metal', M, -0.015, y + 0.75, 0.05, 0.015, y + 0.78, 0.45);
}

export { at };
