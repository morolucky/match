import { samples } from '../geom/path.js';
import { sweep, ribbon } from '../geom/sweep.js';

// Façade ornament: floor string courses (bandeaux), pilasters, corner quoins, zellige frieze.

export function ornament(ctx) {
  const st = ctx.st, lay = ctx.lay, path = ctx.path;
  const all = samples(path, 0, path.L, true);
  if (st.strings) for (let i = 1; i < lay.levels.length; i++) {
    if (i > 1 && lay.program[i - 1].bal === 'cont') continue; // the balcony slab already marks this floor
    ctx.add(sweep(all, [[-0.05, -0.12], [0.06, -0.12], [0.09, -0.06], [0.09, 0.05], [-0.05, 0.05]], { y: lay.levels[i], closed: true }), 'a_trim');
  }
  const mainF = path.faces.filter((f) => f.main);
  if (st.pilasters) for (const f of mainF) {
    if (f.kind === 'arc' || f.bays.length < 2) continue;
    for (const b of f.bays.slice(1)) {
      const M = ctx.frame(b.s0, 0, f), y0 = st.gh + 0.05, y1 = lay.H - 0.05;
      ctx.bbox('a_trim', M, -0.2, y0, 0, 0.2, y1 - 0.35, 0.06); ctx.bbox('a_trim', M, -0.26, y1 - 0.35, 0, 0.26, y1, 0.1);
    }
  }
  if (st.quoins) for (const f of path.faces) for (const [s, dir] of [[f.s0, 1], [f.s1, -1]]) {
    if (f.kind === 'arc') continue;
    const M = ctx.frame(s, 0, f);
    for (let y = st.gh, k = 0; y < lay.H - 0.2; y += 0.42, k++) { const L = k % 2 ? 0.35 : 0.65; ctx.bbox('a_trim', M, dir > 0 ? 0 : -L, y + 0.02, 0, dir > 0 ? L : 0, y + 0.4, 0.035); }
  }
  if (st.zellige) {
    const a = Math.min(...mainF.map((f) => f.s0)), b = Math.max(...mainF.map((f) => f.s1)), closed = st.sides === 'all';
    const S = samples(path, a, b, closed);
    ctx.add(ribbon(S, 0.015, lay.H - 0.62, lay.H - 0.18, 1), 'a_zel');
    if (st.ground !== 'arcade') ctx.add(ribbon(S, 0.015, st.gh - 0.45, st.gh - 0.1, 1), 'a_zel');
  }
}
