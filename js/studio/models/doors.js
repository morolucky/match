// 3D door models
import * as THREE from 'three';
import { D } from '../params.js';
import { DST, DST_N, PI_ } from '../materials.js';
import { PP, bx } from '../kit.js';
import { archF, facade, reveal } from './windows.js';
import { awning } from './streetLife.js';
import { rollerM } from './details.js';

function holeP(p, k, lw, lh) { const xl = .12, xr = lw - .05, y1 = lh * (k == 'g' ? .26 : .38), yt = lh - .13; p.moveTo(xl, y1); p.lineTo(xr, y1);
  if (k == 'g') { p.lineTo(xr, yt); p.lineTo(xl, yt); return { y1, yt, xl, xr, top: () => yt }; }
  if (k == 'q') { const R = lw - xl, d = Math.asin(.05 / R); p.lineTo(xr, lh + R * Math.cos(d)); p.absarc(lw, lh, R, PI_ / 2 + d, PI_, false); return { y1, yt: lh + R, xl, xr, top: (x) => lh + Math.sqrt(Math.max(0, R * R - (x - lw) ** 2)) }; }
  const rr = (xr - xl) / 2, cx = (xl + xr) / 2, yc = yt - rr; p.lineTo(xr, yc); p.absarc(cx, yc, rr, 0, PI_, false); return { y1, yt, xl, xr, top: (x) => yc + Math.sqrt(Math.max(0, rr * rr - (x - cx) ** 2)) }; }
function leaf(s, lw, lh) { const g = new THREE.Group(), th = .06, m = s.m, sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(lw, 0);
  if (s.arch) { sh.lineTo(lw, lh + lw); sh.absarc(lw, lh, lw, PI_ / 2, PI_, false); } else { sh.lineTo(lw, lh); sh.lineTo(0, lh); } sh.closePath();
  if (s.gl) { const hp = new THREE.Path(); holeP(hp, s.gl, lw, lh); sh.holes.push(hp); }
  PP(g, new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 10 }), m, 0, 0, -th / 2);
  const pan = (x0, y0, x1, y1) => { for (const k of [-1, 1]) { bx(g, m, x1 - x0, y1 - y0, .016, (x0 + x1) / 2, (y0 + y1) / 2, k * (th / 2 + .008)); bx(g, m, x1 - x0 - .08, y1 - y0 - .08, .03, (x0 + x1) / 2, (y0 + y1) / 2, k * (th / 2 + .015)); bx(g, m, x1 - x0 - .18, y1 - y0 - .18, .042, (x0 + x1) / 2, (y0 + y1) / 2, k * (th / 2 + .021)); } };
  pan(.12, .12, lw - .06, lh * (s.gl == 'g' ? .2 : .26)); if (!s.gl) pan(.12, lh * .34, lw - .06, lh - .12);
  if (s.gl) { const gs = new THREE.Shape(), b = holeP(gs, s.gl, lw, lh); PP(g, new THREE.ShapeGeometry(gs, 8), 'dglass', 0, 0, 0); const xm = (b.xl + b.xr) / 2;
    if (s.gl == 'g') { for (const k of [-1, 1]) { bx(g, m, .025, b.yt - b.y1, .025, xm, (b.y1 + b.yt) / 2, k * .02); for (let i = 1; i < 4; i++) bx(g, m, b.xr - b.xl, .025, .025, xm, b.y1 + (b.yt - b.y1) * i / 4, k * .02); } }
    else { const rr = (b.xr - b.xl) * .23; for (const k of [-1, 1]) { bx(g, 'iron', .01, b.top(xm) - b.y1 - .05, .01, xm, (b.y1 + b.top(xm)) / 2 - .02, k * .012);
      for (const cx of [b.xl + (b.xr - b.xl) * .27, b.xl + (b.xr - b.xl) * .73]) for (let y = b.y1 + rr + .05; y + rr < b.top(cx) - .04; y += 2 * rr + .03) PP(g, new THREE.TorusGeometry(rr, .008, 4, 12), 'iron', cx, y, k * .012); } } }
  for (const k of [-1, 1]) { const z = k * (th / 2 + .05); if (s.gl != 'g') bx(g, 'brass', .18, .04, .02, lw * .5, lh * .31, k * (th / 2 + .03));
    if (!s.gl) PP(g, new THREE.SphereGeometry(.035, 8, 6), 'brass', lw - .13, lh * .4, z); else PP(g, new THREE.CylinderGeometry(.014, .014, .55, 6), 'brass', lw - .07, lh * .45, z);
    if (!s.gl) { PP(g, new THREE.TorusGeometry(.05, .009, 5, 12), 'brass', lw - .16, lh * .62, k * (th / 2 + .04)); PP(g, new THREE.SphereGeometry(.02, 5, 4), 'brass', lw - .16, lh * .62 + .06, k * (th / 2 + .03)); }
    for (const f of [.15, .5, .85]) bx(g, 'brass', .04, .1, .02, .02, lh * f, k * (th / 2 + .012)); }
  return g; }
function doorM(g, w, h, r = 0) { if (D.detail && r < 0.7) awning(g, w, h, r); const s = D.dst == 0 ? DST[1 + Math.floor(((r * 53.7) % 1) * DST_N)] : (DST[D.dst] || DST[1]), lw = w / 2, lh = s.arch ? h - lw : h; reveal(g, w, h, .34);
  if (s.roll) rollerM(g, w, h); else for (const k of [-1, 1]) { const L = new THREE.Group(); L.position.set(k * w / 2, 0, -.14); if (k > 0) L.scale.x = -1; L.add(leaf(s, lw, lh)); g.add(L); }
  if (s.arch) archF(g, w, h); else facade(g, w, h, .5); bx(g, 'stone', w + .8, .12, .75, 0, .06, .37); bx(g, 'stone', w + 1.1, .06, 1.1, 0, .03, .55); bx(g, 'stone', w, .06, .3, 0, .03, -.17); }

export { holeP, leaf, doorM };
