import { footprint } from './geom/path.js';
import { archCurve } from './geom/shapes.js';

// Turns the design state into a measured layout: footprint path, faces, bays, floor levels
// and every opening (window / French door / shop / arcade bay) with its exact position.

export const MAIN_FACES = { front: ['front'], corner: ['front', 'corner', 'side'], all: ['front', 'corner', 'side', 'back', 'left'] };
export const ARCH_OF = { arch: 'round', segarch: 'seg', horse: 'horse', basket: 'basket', pointed: 'pointed' };

export function layout(st) {
  const path = footprint(st.W, st.D, st.corner, st.cornerSize, 0, new Set(MAIN_FACES[st.sides]));
  const nUp = Math.max(0, st.floors - 1), levels = [0];
  for (let i = 0; i < nUp; i++) levels.push(st.gh + i * st.fh);
  const H = st.gh + nUp * st.fh;
  const bays = [];
  for (const f of path.faces) {
    f.bays = [];
    const minLen = f.name === 'corner' ? 1.8 : 1.2;
    if (f.len < minLen) continue;
    const n = Math.max(1, Math.round(f.len / st.bay)), w = f.len / n;
    for (let k = 0; k < n; k++) { const b = { face: f, k, n, s0: f.s0 + k * w, s1: f.s0 + (k + 1) * w, w }; b.sc = (b.s0 + b.s1) / 2; f.bays.push(b); bays.push(b); }
  }
  // building entrance: the main-face bay nearest the middle of the front
  const front = path.faces.find((f) => f.name === 'front');
  const entrance = front && front.bays.length ? front.bays[Math.floor((front.bays.length - 1) / 2)] : null;
  const program = Array.from({ length: nUp }, (_, i) => st.program[i] || st.program[st.program.length - 1] || { bal: 'single', crown: 'flat' });
  return { path, nUp, levels, H, bays, entrance, program };
}

/** rise of an arch head above its springing line for half-span a */
export function archRise(kind, a) { return kind && kind !== 'flat' ? archCurve(kind, a, 0, 12).top : 0; }

/** openings of one upper floor (index i ≥ 0 → level i+1) on face f */
export function upperOpenings(st, lay, f, i) {
  const y0 = lay.levels[i + 1], prog = lay.program[i], out = [];
  for (const b of f.bays) {
    const main = f.main, w = Math.min(st.winW * (main ? 1 : 0.9), b.w - 0.55);
    if (w < 0.5) continue;
    const bal = main ? prog.bal : 'none';
    const door = st.french === 'all' ? main || i === 0 : bal !== 'none';
    const top = y0 + Math.min(st.fh - 0.4, st.fh * st.winH);
    const bot = door ? y0 + 0.04 : y0 + Math.max(0.8, Math.min(1.0, st.fh * 0.3));
    const crown = main ? prog.crown : 'flat', arch = ARCH_OF[crown];
    out.push({ bay: b, face: f, s0: b.sc - w / 2, s1: b.sc + w / 2, sc: b.sc, w, y0: bot, y1: top, door, bal, crown, arch, main, floor: i + 1 });
  }
  return out;
}

/** ground floor openings for walls built on the street line (shops / plain / rear) */
export function groundOpenings(st, lay, f) {
  const out = [], gh = st.gh;
  for (const b of f.bays) {
    const ent = b === lay.entrance;
    if (f.main && st.ground === 'shops' && !ent) { const w = Math.max(1.2, b.w - 0.75); out.push({ bay: b, face: f, sc: b.sc, s0: b.sc - w / 2, s1: b.sc + w / 2, w, y0: 0.02, y1: gh * 0.8, kind: 'shop', arch: st.archShops ? st.arch : null }); }
    else if (ent && f.main) { const w = Math.min(2.2, b.w - 0.6); out.push({ bay: b, face: f, sc: b.sc, s0: b.sc - w / 2, s1: b.sc + w / 2, w, y0: 0.02, y1: Math.min(gh - 0.5, 3.9), kind: 'entry', arch: 'round' }); }
    else if (f.main || b.k % 2 === 0) { const w = Math.min(1.1, b.w - 0.8); if (w > 0.5) out.push({ bay: b, face: f, sc: b.sc, s0: b.sc - w / 2, s1: b.sc + w / 2, w, y0: gh * 0.32, y1: gh * 0.78, kind: 'win', arch: null }); }
  }
  return out;
}
