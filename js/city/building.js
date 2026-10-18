import { footprintFromPolygon, samples } from '../algiers/geom/path.js';
import { mulberry } from '../algiers/ctx.js';
import { wallBand, core, plinth } from '../algiers/parts/walls.js';
import { upperWindow } from '../algiers/parts/windows.js';
import { balcony } from '../algiers/parts/balconies.js';
import { groundFloor } from '../algiers/parts/ground.js';
import { roof } from '../algiers/parts/roof.js';
import { ornament } from '../algiers/parts/ornament.js';
import { facadeLife } from '../algiers/parts/street.js';
import { upperOpenings } from '../algiers/layout.js';

// Runs one OSM building footprint through the *same* Algiers building generator used by the
// single-building designer (ground floor, upper windows, balconies wrapping every corner,
// cornice, parapet) instead of a simplified box — same parts, same MT materials.
// `ctx` already belongs to the caller (one Ctx per building here, merged by the caller); this
// just repoints it at a fresh footprint/layout/style for this building.
// Ground floor stays 'shops' (flat shopfront wall) rather than 'arcade': real OSM footprints
// can have very irregular, acute corners, and the arcade's arch/pillar geometry is both the
// most expensive part to generate and the most sensitive to degenerate corners at city scale.

/** @param {{x:number,z:number}[]} poly world-space footprint @param {number} floors
 *  @param {number} seed @param {object} baseSt Algiers design state shared by the whole city */
export function addCityBuilding(ctx, poly, floors, seed, baseSt) {
  const path = footprintFromPolygon(poly);
  if (path.faces.length < 3 || path.L < 3) return;
  floors = Math.max(1, Math.min(9, floors | 0));
  const nUp = Math.max(0, floors - 1), levels = [0];
  for (let i = 0; i < nUp; i++) levels.push(baseSt.gh + i * baseSt.fh);
  const H = baseSt.gh + nUp * baseSt.fh;
  for (const f of path.faces) {
    f.bays = [];
    if (f.len < 1.2) continue;
    const n = Math.max(1, Math.round(f.len / baseSt.bay)), w = f.len / n;
    for (let k = 0; k < n; k++) { const b = { face: f, k, n, s0: f.s0 + k * w, s1: f.s0 + (k + 1) * w, w }; b.sc = (b.s0 + b.s1) / 2; f.bays.push(b); }
  }
  const allBays = path.faces.flatMap((f) => f.bays);
  const program = Array.from({ length: nUp }, (_, i) => baseSt.program[i] || baseSt.program[baseSt.program.length - 1] || { bal: 'single', crown: 'flat' });
  const st = { ...baseSt, seed, floors, ground: 'shops' };
  const lay = { path, nUp, levels, H, bays: allBays, entrance: allBays[0] || null, program };
  ctx.st = st; ctx.lay = lay; ctx.path = path; ctx.rng = mulberry(seed * 9973 + 17);

  groundFloor(ctx);
  for (const f of path.faces) if (!(f.main && st.ground === 'arcade')) plinth(ctx, samples(path, f.s0, f.s1), false, f.main ? 'a_ground' : 'a_wall');

  for (let i = 0; i < nUp; i++) {
    const y0 = levels[i + 1], prog = program[i];
    for (const f of path.faces) {
      const ops = upperOpenings(st, lay, f, i);
      wallBand(ctx, path, f, y0, y0 + st.fh, ops, 'a_wall');
      for (const o of ops) { upperWindow(ctx, o); facadeLife(ctx, o); }
    }
    if (prog.bal === 'cont') {
      const at = []; for (const f of path.faces) for (const b of f.bays) at.push(b.s0 + 0.2, b.s1 - 0.2);
      balcony(ctx, 0, path.L, y0, true, at.filter((s, k, A) => A.findIndex((x) => Math.abs(x - s) < 0.3) === k));
    } else if (prog.bal === 'single') for (const f of path.faces) for (const b of f.bays) {
      const w = Math.min(st.winW, b.w - 0.55); if (w < 0.5) continue;
      const s0 = Math.max(b.s0 + 0.08, b.sc - w / 2 - 0.35), s1 = Math.min(b.s1 - 0.08, b.sc + w / 2 + 0.35);
      balcony(ctx, s0, s1, y0, false, [s0 + 0.18, s1 - 0.18]);
    }
  }
  core(ctx, st, lay, 0);
  ornament(ctx);
  roof(ctx);
}
