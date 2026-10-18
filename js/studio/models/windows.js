// 3D window models: architraves, curtains, sashes, crowns
import * as THREE from 'three';
import { D } from '../params.js';
import { PI_ } from '../materials.js';
import { PP, bx } from '../kit.js';
import { planter } from './streetLife.js';
import { shutters } from './details.js';
import { S } from '../../core/state.js';

// rectangular frame ring with bevelled edges: hole iw wide, from y=-dn to y=h, band width t, projecting dp from z=zf
function ring(g, m, iw, h, dn, t, dp, zf, b) { const ih = h + dn, cy = (h - dn) / 2, ow = iw + 2 * t - 2 * b, oh = ih + 2 * t - 2 * b, hw = iw + 2 * b, hh = ih + 2 * b, sh = new THREE.Shape();
  sh.moveTo(-ow / 2, -oh / 2); sh.lineTo(ow / 2, -oh / 2); sh.lineTo(ow / 2, oh / 2); sh.lineTo(-ow / 2, oh / 2); sh.closePath();
  const hp = new THREE.Path(); hp.moveTo(-hw / 2, -hh / 2); hp.lineTo(-hw / 2, hh / 2); hp.lineTo(hw / 2, hh / 2); hp.lineTo(hw / 2, -hh / 2); hp.closePath(); sh.holes.push(hp);
  PP(g, new THREE.ExtrudeGeometry(sh, { depth: dp, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1 }), m, 0, cy, zf); }
function corbel(g, x, yTop, s) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(.17, 0); sh.lineTo(.17, -.07); sh.quadraticCurveTo(.15, -.2, .05, -.25); sh.quadraticCurveTo(.1, -.31, 0, -.34); sh.closePath();
  const ge = new THREE.ExtrudeGeometry(sh, { depth: .15, bevelEnabled: false, curveSegments: 4 }); ge.translate(0, 0, -.075); ge.rotateY(-PI_ / 2); PP(g, ge, 'stone', x, yTop, 0);
  const v = PP(g, new THREE.TorusGeometry(.045, .018, 4, 10, PI_ * 1.5), 'stone', x, yTop - .15, .175); v.rotation.z = s * .6; for (let k = -1; k <= 1; k++) PP(g, new THREE.CylinderGeometry(.006, .012, .16, 5), 'stone', x + k * .045, yTop - .1, .17); }
function facade(g, w, h, dn) { ring(g, 'stone', w, h, dn, .10, .045, 0, .012); ring(g, 'stone', w + .2, h + .1, dn + .1, .12, .085, 0, .012);
  const W2 = w / 2 + .22, yt = h + .22, nd = Math.floor(W2 * 2 / .075);
  for (let i = 0; i < nd; i++) bx(g, 'stone', .04, .05, .07, -W2 + (i + .5) * 2 * W2 / nd, yt + .025, .12);
  bx(g, 'stone', 2 * W2 + .34, .07, .22, 0, yt + .085, .11); bx(g, 'stone', 2 * W2 + .42, .05, .28, 0, yt + .145, .14); bx(g, 'stone', .16, .34, .14, 0, h + .12, .1);
  for (const s of [-1, 1]) { corbel(g, s * (W2 + .08), yt + .05, s); const ro = PP(g, new THREE.CylinderGeometry(.055, .055, .03, 8), 'stone', s * (w / 2 + .1), h + .1, .1); ro.rotation.x = PI_ / 2; PP(g, new THREE.SphereGeometry(.02, 5, 4), 'brass', s * (w / 2 + .1), h + .1, .125); }
  const ks2 = PP(g, new THREE.SphereGeometry(.055, 6, 5), 'stone', 0, h + .12, .17); ks2.scale.z = .5;
  const nbd = Math.floor((w + 2 * h) / .085); for (let i = 0; i < nbd; i++) { const L = w + 2 * h, d = i / (nbd - 1) * L; let x, y; if (d < h) { x = -w / 2 - .035; y = d; } else if (d < h + w) { x = -w / 2 + (d - h); y = h + .035; } else { x = w / 2 + .035; y = h - (d - h - w); } PP(g, new THREE.SphereGeometry(.02, 5, 3), 'stone', x, y, .075); } }
function archF(g, w, h) { const a = w / 2, yS = h - a, E = (sh) => new THREE.ExtrudeGeometry(sh, { depth: .06, bevelEnabled: false, curveSegments: 10 });
  for (const k of [-1, 1]) { const s = new THREE.Shape(); s.moveTo(k * a, yS); s.lineTo(k * a, h); s.lineTo(0, h); s.absarc(0, yS, a, PI_ / 2, k > 0 ? 0 : PI_, k > 0); PP(g, E(s), 'stone', 0, 0, 0); }
  const B = new THREE.Shape(); B.moveTo(-a - .28, 0); B.lineTo(-a, 0); B.absarc(0, 0, a, PI_, 0, true); B.lineTo(a + .28, 0); B.absarc(0, 0, a + .28, 0, PI_, false);
  PP(g, new THREE.ExtrudeGeometry(B, { depth: .1, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1, curveSegments: 14 }), 'stone', 0, yS, 0);
  { const B2 = new THREE.Shape(); B2.moveTo(-a - .1, 0); B2.lineTo(-a - .02, 0); B2.absarc(0, 0, a + .02, PI_, 0, true); B2.lineTo(a + .1, 0); B2.absarc(0, 0, a + .1, 0, PI_, false); PP(g, new THREE.ExtrudeGeometry(B2, { depth: .16, bevelEnabled: true, bevelSize: .01, bevelThickness: .01, bevelSegments: 1, curveSegments: 14 }), 'stone', 0, yS, 0); }
  for (const s of [-1, 1]) { const x = s * (a + .14); bx(g, 'stone', .28, yS, .12, x, yS / 2, .06); bx(g, 'stone', .4, .12, .2, x, yS + .02, .1); bx(g, 'stone', .4, .3, .24, x, .15, .1); }
  const ks = new THREE.Shape(); ks.moveTo(-.09, 0); ks.lineTo(.09, 0); ks.lineTo(.14, .46); ks.lineTo(-.14, .46); ks.closePath(); PP(g, new THREE.ExtrudeGeometry(ks, { depth: .17, bevelEnabled: false }), 'stone', 0, yS + a - .06, 0); }
function reveal(g, w, h, d) { bx(g, 'stone', .04, h, d, -w / 2 - .02, h / 2, -d / 2); bx(g, 'stone', .04, h, d, w / 2 + .02, h / 2, -d / 2); bx(g, 'stone', w + .08, .04, d, 0, h + .02, -d / 2); bx(g, 'stone', w + .08, .05, d, 0, -.025, -d / 2); bx(g, 'room', w + .3, h + .3, .02, 0, h / 2, -d - .02); }
function drape(g, mt, x0, s, cw, top, bot, fz, amp, fr, pT, pK, ph) { const hh = top - bot, cg = new THREE.PlaneGeometry(cw, hh, Math.round(fr * 3), 8), p = cg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), t = (y + hh / 2) / hh, pin = 1 - pK * Math.exp(-(((t - pT) * 4.5) ** 2)); p.setZ(i, Math.sin(x / cw * PI_ * fr + ph) * amp * (.5 + .5 * t)); p.setX(i, x * pin + s * cw / 2 * (1 - pin)); }
  cg.computeVertexNormals(); PP(g, cg, mt, x0, (top + bot) / 2, fz); }
function curtains(g, w, h, r) { const fz = -.31, top = h - .1, bot = .2, hh = top - bot, a = (r * 97.13) % 1, b = (r * 311.7) % 1, c = (r * 53.9) % 1, k = Math.floor(r * 9), mt = ['curt', 'cb', 'cg', 'cr', 'cs', 'cw'][Math.floor(a * 6)];
  if (k == 8) return;
  const rod = () => { const rd = PP(g, new THREE.CylinderGeometry(.012, .012, w - .04, 6), 'brass', 0, h - .05, fz); rd.rotation.z = PI_ / 2; for (const s of [-1, 1]) PP(g, new THREE.SphereGeometry(.025, 6, 5), 'brass', s * (w / 2 - .02), h - .05, fz); };
  const tie = (s, t) => PP(g, new THREE.SphereGeometry(.02, 5, 4), 'brass', s * (w / 2 - .04), bot + hh * t, fz + .045);
  if (k == 0 || k == 7) { const cw = w * (.28 + .12 * b), pT = .3 + .25 * b; for (const s of [-1, 1]) { drape(g, mt, s * (w / 2 - cw / 2 - .04), s, cw, top, bot, fz, .03 + .03 * c, 5 + Math.floor(c * 3), pT, .22 + .22 * c, s); tie(s, pT); } rod(); }
  if (k == 7) { const vg = new THREE.PlaneGeometry(w - .08, .17, 24, 2), p = vg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 22) * .018); if (p.getY(i) < 0) p.setY(i, p.getY(i) - .045 * Math.abs(Math.sin(x * 11))); } vg.computeVertexNormals(); PP(g, vg, mt, 0, top - .02, fz + .035); }
  if (k == 1) { for (const s of [-1, 1]) drape(g, mt, s * w / 4, s, w / 2 - .03, top, bot, fz, .035, 7, .4, 0, s); rod(); }
  if (k == 2) { const s = b > .5 ? 1 : -1, cw = w * .34; drape(g, mt, s * (w / 2 - cw / 2 - .04), s, cw, top, bot, fz, .045, 5, .38, .3, 0); tie(s, .38); rod(); }
  if (k == 3) { drape(g, 'cw', 0, 1, w - .1, top, bot, fz, .02, 10, .4, 0, 0); rod(); }
  if (k == 4) { const f = .3 + .55 * b; PP(g, new THREE.PlaneGeometry(w - .1, hh * f), 'cw', 0, top - hh * f / 2, fz + .02); bx(g, 'frame', w - .1, .025, .025, 0, top - hh * f, fz + .02); bx(g, 'frame', w - .08, .05, .05, 0, top + .02, fz + .02); }
  if (k == 5) { const n = Math.floor(hh * (.35 + .55 * b) / .045); for (let i = 0; i < n; i++) bx(g, 'cw', w - .12, .012, .03, 0, top - i * .045, fz + .03); bx(g, 'frame', w - .08, .04, .04, 0, top + .02, fz + .03); bx(g, 'frame', w - .12, .02, .03, 0, top - n * .045, fz + .03); }
  if (k == 6) { const cw = w * .2; for (const s of [-1, 1]) drape(g, mt, s * (w / 2 - cw / 2 - .04), s, cw, top, bot, fz, .03, 4, .4, 0, s); rod(); } }
function curtainsOld(g, w, h) { const fz = -.31, top = h - .1, bot = .2, hh = top - bot, cw = w * .36;
  for (const s of [-1, 1]) { const cg = new THREE.PlaneGeometry(cw, hh, 16, 8), p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), t = (y + hh / 2) / hh, pin = 1 - .32 * Math.exp(-(((t - .42) * 4.5) ** 2)); p.setZ(i, Math.sin(x / cw * PI_ * 6 + s) * .04 * (.5 + .5 * t)); p.setX(i, x * pin + s * cw / 2 * (1 - pin)); }
    cg.computeVertexNormals(); PP(g, cg, 'curt', s * (w / 2 - cw / 2 - .04), (top + bot) / 2, fz); PP(g, new THREE.SphereGeometry(.02, 5, 4), 'brass', s * (w / 2 - .04), bot + hh * .42, fz + .045); PP(g, new THREE.SphereGeometry(.025, 6, 5), 'brass', s * (w / 2 - .02), h - .05, fz); }
  const rd = PP(g, new THREE.CylinderGeometry(.012, .012, w - .04, 6), 'brass', 0, h - .05, fz); rd.rotation.z = PI_ / 2; }
function sash(g, w, h, r) { const fz = -.2, ty = h > 1.8 ? h * .72 : h;
  ring(g, S.FR, w - .12, h - .06, -.06, .06, .07, fz, .01); bx(g, S.FR, .05, h - .1, .08, 0, h / 2, fz); if (h > 1.8) bx(g, S.FR, w - .1, .045, .08, 0, ty, fz);
  for (const s of [-1, 1]) for (let i = 1; i < 3; i++) bx(g, S.FR, w / 2 - .07, .02, .03, s * w / 4, .06 + (ty - .06) * i / 3, fz + .035);
  PP(g, new THREE.PlaneGeometry(w - .1, h - .1), 'glass', 0, h / 2, fz - .02, r); for (const s of [-1, 1]) bx(g, 'brass', .02, .16, .03, s * .05, h * .45, fz + .06);
  if (h > 1.8) for (const s of [-1, 1]) bx(g, S.FR, .02, h - ty - .05, .03, s * w / 4, (ty + h) / 2, fz + .035);
  for (const s of [-1, 1]) for (const f of [.15, .5, .85]) bx(g, 'brass', .02, .07, .03, s * (w / 2 - .035), h * f, fz + .045);
  curtains(g, w, h, r); }
function balc(g, w) { const Rw = w + .6, z = .52; bx(g, 'stone', w + .9, .1, .58, 0, -.05, .29); for (const s of [-1, 1]) bx(g, 'stone', .14, .24, .36, s * w * .32, -.22, .18);
  for (const s of [-1, 1]) { PP(g, new THREE.CylinderGeometry(.03, .035, .95, 6), 'iron', s * Rw / 2, .475, z); PP(g, new THREE.SphereGeometry(.045, 6, 5), 'iron', s * Rw / 2, .98, z); bx(g, 'iron', .04, .04, .48, s * Rw / 2, .95, z - .24); bx(g, 'iron', .035, .035, .48, s * Rw / 2, .12, z - .24); }
  bx(g, 'iron', Rw, .045, .05, 0, .95, z); bx(g, 'iron', Rw, .035, .04, 0, .12, z); bx(g, 'iron', Rw, .03, .04, 0, .82, z); bx(g, 'stone', w + .74, .34, .04, 0, -.27, .02); bx(g, 'stone', w + .5, .2, .055, 0, -.27, .03);
  const nb = Math.floor(Rw / .11); for (let i = 0; i < nb; i++) { const x = -Rw / 2 + (i + .5) * Rw / nb; bx(g, 'iron', .012, .8, .012, x, .53, z); if (i % 4 == 2) PP(g, new THREE.ConeGeometry(.018, .08, 5), 'iron', x, .99, z); }
  const nc = Math.max(1, Math.round(Rw / .3)); for (let i = 0; i < nc; i++) { const x = -Rw / 2 + (i + .5) * Rw / nc; PP(g, new THREE.TorusGeometry(.1, .01, 4, 12), 'iron', x, .5, z + .008); PP(g, new THREE.TorusGeometry(.055, .008, 4, 10), 'iron', x, .5, z + .008); PP(g, new THREE.SphereGeometry(.014, 5, 4), 'brass', x, .5, z + .015); } if (Rw > .9) PP(g, new THREE.TorusGeometry(.17, .014, 4, 16), 'brass', 0, .5, z + .02); }
function winCrown(g, w, h, v) { const b = w / 2 + 0.36;
  if (v == 1) { const sh = new THREE.Shape(); sh.moveTo(-b, 0); sh.lineTo(b, 0); sh.lineTo(0, 0.4); sh.closePath(); PP(g, new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }), 'stone', 0, h + 0.37, 0.05);
    const ro = PP(g, new THREE.SphereGeometry(0.06, 8, 6), 'stone', 0, h + 0.52, 0.16); ro.scale.z = 0.4; }
  else if (v == 2) { const sh = new THREE.Shape(); sh.moveTo(-b, 0); sh.lineTo(b, 0); sh.quadraticCurveTo(0, 0.7, -b, 0); PP(g, new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 12 }), 'stone', 0, h + 0.37, 0.05); } }
function winSimple(g, w, h) { ring(g, 'stone', w, h, 0, 0.09, 0.05, 0, 0.01); bx(g, 'stone', w + 0.42, 0.1, 0.2, 0, h + 0.14, 0.1); bx(g, 'stone', w + 0.3, 0.05, 0.1, 0, h + 0.21, 0.07); }
function winM(g, w, h, bal, r, mode, fk) { // fk = per-FLOOR key: every window on a floor shares model, frame colour, shutter colour and planter set; r only varies the interior (curtains, lit rooms)
  const wv = D.wst > 0 ? D.wst - 1 : Math.floor(fk * 4), ci = Math.floor(((fk * 37.3) % 1) * 4), hasSh = ((fk * 5.7) % 1) < 0.6;
  S.FR = ['frame', 'fr1', 'fr2', 'fr3'][ci]; S.SH = ['shut', 'shutB', 'shutG', 'shut'][Math.floor(((fk * 13.1) % 1) * 4)];
  reveal(g, w, h, .34); sash(g, w, h, r);
  if (mode == 'arch' && h > w / 2 + 0.6) { archF(g, w, h); S.FR = 'frame'; return; }
  if (wv == 3) winSimple(g, w, h); else { facade(g, w, h, 0); winCrown(g, w, h, wv); }
  if (mode != 'cont' && D.detail && !bal && hasSh) shutters(g, w, h, 0, 0);
  if (bal) { balc(g, w); if (D.detail) { const Rw = w + 0.6, n2 = (fk * 9.3) % 1 > 0.5; planter(g, n2 ? -Rw * 0.2 : 0, 0.34, 3, fk); if (n2) planter(g, Rw * 0.22, 0.34, 2, fk + 0.3); } }
  else if (mode != 'cont') bx(g, 'stone', w + .66, .07, .28, 0, -.255, .14);
  S.FR = 'frame'; }

export { ring, corbel, facade, archF, reveal, drape, curtains, curtainsOld, sash, balc, winCrown, winSimple, winM };
