import * as THREE from 'three';
import { footprint, samples, insetPoly } from '../geom/path.js';
import { sweep } from '../geom/sweep.js';
import { spandrelShape, archRingShape, extrude, archCurve } from '../geom/shapes.js';
import { wallBand, WALL_T } from './walls.js';
import { groundOpenings, MAIN_FACES } from '../layout.js';
import { groundWindow, entryDoor, shopFront } from './windows.js';

// Ground floor: arcades (pillars + arches carrying the façade, shopfronts set back),
// rusticated shop bases, or plain bases; the rear faces always get a plain base.

export function groundFloor(ctx) {
  const st = ctx.st, lay = ctx.lay, path = ctx.path, gh = st.gh;
  const arcade = st.ground === 'arcade';
  for (const f of path.faces) {
    if (arcade && f.main) continue;
    const ops = groundOpenings(st, lay, f);
    wallBand(ctx, path, f, 0, gh, ops, f.main ? 'a_ground' : 'a_wall');
    for (const o of ops) o.kind === 'shop' ? shopFront(ctx, o, undefined, WALL_T, true) : o.kind === 'entry' ? entryDoor(ctx, o) : groundWindow(ctx, o);
  }
  if (arcade) arcades(ctx);
}

function arcades(ctx) {
  const st = ctx.st, lay = ctx.lay, path = ctx.path, gh = st.gh, pw = st.pillarW, pd = 0.7;
  const main = path.faces.filter((f) => f.main && f.bays.length);
  // pillars at every bay boundary (deduplicated where faces meet)
  const ps = []; const add = (s, f) => { if (!ps.some((p) => Math.abs(p.s - s) < 0.05)) ps.push({ s, f }); };
  for (const f of path.faces.filter((x) => x.main)) { if (!f.bays.length) { add(f.s0, f); add(f.s1, f); continue; } for (const b of f.bays) { add(b.s0, f); add(b.s1, f); } }
  const first = Math.min(...path.faces.filter((x) => x.main).map((x) => x.s0)), last = Math.max(...path.faces.filter((x) => x.main).map((x) => x.s1));
  const aMax = Math.max(0.5, ...main.flatMap((f) => f.bays.map((b) => b.w / 2 - pw / 2)));
  const yS = Math.max(2.3, gh - 0.5 - archCurve(st.arch, aMax, 0, 8).top); // springing line
  for (const p of ps) {
    let s = p.s; const closedLoop = st.sides === 'all';
    if (!closedLoop && Math.abs(s - first) < 0.05) s += pw / 2; if (!closedLoop && Math.abs(s - last) < 0.05) s -= pw / 2;
    const M = ctx.frame(Math.min(Math.max(s, 0), path.L), 0, null);
    pillar(ctx, M, pw, pd, yS);
  }
  // arches between pillars (flat chord panels, also on curved corners)
  for (const f of main) for (const b of f.bays) {
    const M = ctx.chord(b.s0, b.s1, f), hw = M.len / 2, a = hw - pw / 2;
    ctx.add(extrude(spandrelShape(st.arch, a, hw, yS, gh), pd), 'a_ground', M);
    if (st.surround) {
      ctx.add(extrude(archRingShape(st.arch, a, yS, 0.18), 0.05).translate(0, 0, 0.05), 'a_trim', M);
      const top = archCurve(st.arch, a, yS, 8).top;
      if (st.ornament > 0.25 && top < gh - 0.2) { const k = new THREE.Shape(); k.moveTo(-0.14, 0); k.lineTo(0.14, 0); k.lineTo(0.2, Math.min(0.5, gh - top - 0.05)); k.lineTo(-0.2, Math.min(0.5, gh - top - 0.05)); k.lineTo(-0.14, 0); ctx.add(extrude(k, 0.12).translate(0, top - 0.05, 0.12), 'a_trim', M); }
    }
    if (st.zellige) ctx.add(extrude(archRingShape(st.arch, a + 0.18, yS, 0.12), 0.02).translate(0, 0, 0.02), 'a_zel', M);
  }
  // shopfront wall set back by the arcade depth (its own inset outline)
  const inner = path.poly ? insetPoly(path, st.arcDepth) : footprint(st.W, st.D, st.corner, st.cornerSize, st.arcDepth, new Set(MAIN_FACES[st.sides]));
  for (const f of inner.faces) {
    if (!f.main) continue;
    const outer = path.faces.find((x) => x.name === f.name); if (!outer) continue;
    // keep the shop bays aligned with the arches by mapping the outer bays proportionally
    const ops = (outer.bays.length ? outer.bays : []).map((b) => {
      const t0 = (b.s0 - outer.s0) / outer.len, t1 = (b.s1 - outer.s0) / outer.len, s0 = f.s0 + t0 * f.len, s1 = f.s0 + t1 * f.len, w = Math.max(0.9, (s1 - s0) - 0.7), sc = (s0 + s1) / 2;
      const ent = b === lay.entrance;
      return { face: f, sc, s0: sc - w / 2, s1: sc + w / 2, w: ent ? Math.min(w, 2) : w, y0: 0.02, y1: ent ? Math.min(gh - 0.6, 3.6) : yS - 0.15, kind: ent ? 'entry' : 'shop', arch: null };
    }).filter((o) => o.s1 - o.s0 > 0.6);
    for (const o of ops) if (o.kind === 'entry') { o.s0 = o.sc - o.w / 2; o.s1 = o.sc + o.w / 2; }
    wallBand(ctx, inner, f, 0, gh, ops, 'a_wall', 0.3);
    for (const o of ops) { const M = ctx.frame(o.sc, 0, f, inner); o.kind === 'entry' ? entryDoor(ctx, o, M, 0.3) : shopFront(ctx, o, M, 0.3, false); }
  }
  // arcade floor tiles
  const S = samples(path, first, last, st.sides === 'all');
  ctx.add(sweep(S, [[0, 0], [-Math.min(st.arcDepth, st.corner === 'round' ? st.cornerSize : 9), 0]], { y: 0.16, closed: st.sides === 'all' }), 'a_pave');
}


function pillar(ctx, M, pw, pd, yS) {
  const st = ctx.st, G = 'a_ground', T = 'a_trim';
  if (st.pillar === 'round') {
    const r = pw * 0.42, c = new THREE.CylinderGeometry(r * 0.92, r, yS - 0.6, 20); c.translate(0, 0.45 + (yS - 0.6) / 2, -pd / 2); ctx.add(c, T, M);
    ctx.bbox(G, M, -pw / 2 - 0.06, 0, -pd - 0.06, pw / 2 + 0.06, 0.45, 0.06);
    ctx.bbox(T, M, -pw / 2 - 0.08, yS - 0.18, -pd - 0.08, pw / 2 + 0.08, yS, 0.08);
    const cap = new THREE.CylinderGeometry(pw * 0.55, r * 0.95, 0.25, 20); cap.translate(0, yS - 0.3, -pd / 2); ctx.add(cap, T, M);
    return;
  }
  ctx.bbox(G, M, -pw / 2 - 0.06, 0, -pd - 0.06, pw / 2 + 0.06, 0.5, 0.06);
  if (st.rustic) { for (let y = 0.5; y < yS - 0.3; y += 0.5) { ctx.bbox(G, M, -pw / 2, y, -pd, pw / 2, Math.min(y + 0.46, yS - 0.25), 0.02); ctx.bbox('a_groove', M, -pw / 2 + 0.03, y + 0.46, -pd + 0.03, pw / 2 - 0.03, y + 0.5, -0.01); } }
  else ctx.bbox(G, M, -pw / 2, 0.5, -pd, pw / 2, yS - 0.25, 0);
  ctx.bbox(T, M, -pw / 2 - 0.1, yS - 0.25, -pd - 0.05, pw / 2 + 0.1, yS - 0.05, 0.1); // impost moulding
  ctx.bbox(G, M, -pw / 2, yS - 0.05, -pd, pw / 2, st.gh, 0);
}
