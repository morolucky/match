import { samples } from './geom/path.js';
import { layout, upperOpenings } from './layout.js';
import { Ctx } from './ctx.js';
import { ensureMaterials, applyLook } from './materials.js';
import { wallBand, core, plinth } from './parts/walls.js';
import { upperWindow } from './parts/windows.js';
import { balcony } from './parts/balconies.js';
import { groundFloor } from './parts/ground.js';
import { roof } from './parts/roof.js';
import { ornament } from './parts/ornament.js';
import { street, facadeLife } from './parts/street.js';
import { placeProps } from './parts/props.js';

// Orchestrates one Algiers building from a design state (see schema.js) and returns a
// merged THREE.Group plus measurements for lighting bounds and the status line.

export function buildAlgiers(st) {
  ensureMaterials(); applyLook(st);
  const lay = layout(st), ctx = new Ctx(st, lay), path = lay.path;
  const mainF = path.faces.filter((f) => f.main), closed = st.sides === 'all';
  const ma = Math.min(...mainF.map((f) => f.s0)), mb = Math.max(...mainF.map((f) => f.s1));

  groundFloor(ctx);
  for (const f of path.faces) if (!(f.main && st.ground === 'arcade')) plinth(ctx, samples(path, f.s0, f.s1), false, f.main ? 'a_ground' : 'a_wall');

  for (let i = 0; i < lay.nUp; i++) {
    const y0 = lay.levels[i + 1], prog = lay.program[i];
    for (const f of path.faces) {
      const ops = upperOpenings(st, lay, f, i);
      wallBand(ctx, path, f, y0, y0 + st.fh, ops, 'a_wall');
      for (const o of ops) { upperWindow(ctx, o); facadeLife(ctx, o); }
    }
    if (prog.bal === 'cont') {
      const at = []; for (const f of mainF) for (const b of f.bays) at.push(b.s0 + 0.2, b.s1 - 0.2);
      balcony(ctx, ma, mb, y0, closed, at.filter((s, k, A) => A.findIndex((x) => Math.abs(x - s) < 0.3) === k));
    } else if (prog.bal === 'single') for (const f of mainF) for (const b of f.bays) {
      const w = Math.min(st.winW, b.w - 0.55); if (w < 0.5) continue;
      const s0 = Math.max(b.s0 + 0.08, b.sc - w / 2 - 0.35), s1 = Math.min(b.s1 - 0.08, b.sc + w / 2 + 0.35);
      balcony(ctx, s0, s1, y0, false, [s0 + 0.18, s1 - 0.18]);
    }
  }
  core(ctx, st, lay, st.ground === 'arcade' ? st.arcDepth : 0);
  ornament(ctx);
  const peak = roof(ctx);
  placeProps(ctx, street(ctx));
  const group = ctx.finish();
  return { group, lay, peak, tris: ctx.tris, meshes: group.children.length };
}
