// Scene (re)build: classic studio + Algiers designer
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AVG, L } from '../lighting/layers.js';
import { $, err } from '../core/dom.js';
import { D, PAL } from '../studio/params.js';
import { OPN, dens, makeGeo, nIsl } from '../studio/generator.js';
import { cam, ll, mat, oc, renderer } from '../scene/scene.js';
import { matC, matG, matR } from '../scene/shaders.js';
import { MT } from '../studio/materials.js';
import { bake } from '../studio/kit.js';
import { winM } from '../studio/models/windows.js';
import { doorM } from '../studio/models/doors.js';
import { buildCornice, buildLamp } from '../studio/models/details.js';
import { buildCont } from '../studio/models/balconies.js';
import { buildDrain } from '../studio/models/drainage.js';
import { S } from '../core/state.js';
import { rgb } from '../studio/params.js';
import { buildAlgiers } from '../algiers/builder.js';
import { design } from '../algiers/design.js';
import { TYPES } from '../algiers/types.js';

function buildModels() {
  if (S.MG) { ll.level.remove(S.MG); S.MG.children.forEach((o) => o.geometry.dispose()); S.MG = null; }
  if (!D.models && !D.drain && !D.detail) return; S.ACC = {};
  if (D.models) for (const o of OPN) { const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.makeBasis(new THREE.Vector3(o.dir[0], 0, o.dir[2]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(o.n[0], 0, o.n[2])).setPosition(o.p[0], o.p[1], o.p[2]);
    const r = Math.abs((Math.sin(o.p[0] * 12.9898 + o.p[2] * 78.233 + o.p[1] * 37.719) * 43758.5453) % 1); o.t == 'door' ? doorM(g, o.w, o.h, o.fk) : winM(g, o.w, o.h, o.bal, r, o.m, o.fk); bake(g); }
  buildCont();
  if (D.detail) { buildCornice(); buildLamp(); }
  if (D.drain) buildDrain();
  S.MG = new THREE.Group(); for (const m in S.ACC) { const geo = mergeGeometries(S.ACC[m], false); S.ACC[m].forEach((a) => a.dispose()); const me = new THREE.Mesh(geo, MT[m]); me.castShadow = me.receiveShadow = true; S.MG.add(me); }
  ll.level.add(S.MG); S.ACC = {};
}
const WALL_AVG = AVG[L.WALL].slice();
const disposeGroup = (g) => { ll.level.remove(g); g.children.forEach((o) => o.geometry.dispose()); };
function clearAlg() { if (S.AG) { disposeGroup(S.AG); S.AG = null; } }
function clearStudio() { if (S.bm) { ll.level.remove(S.bm); S.bm.geometry.dispose(); S.bm = null; } if (S.MG) { disposeGroup(S.MG); S.MG = null; } }

/** lighting bounds + Lumina city description for a single w×d building of height H */
function relight(H, w, d) {
  const ext = Math.max(45, w / 2 + 25, d / 2 + 25), sq = [[-ext, -ext], [ext, -ext], [ext, ext], [-ext, ext]];
  ll.setBounds(new THREE.Box3(new THREE.Vector3(-ext, 0, -ext), new THREE.Vector3(ext, H + 6, ext)));
  ll.lumina.setAlbedo(AVG);
  ll.lumina.setCity({ blocks: [{ curb: sq, lot: sq, lawn: false }], buildings: [{ cx: 0, cz: 0, w, d, angle: 0, style: H > 32 ? 'tower' : 'haussmann', wall: L.WALL, roofLayer: L.ROOF, tint: [1, 1, 1] }] });
  ll.patch(ll.level); ll.setFocus(new THREE.Vector3(0, H * 0.4, 0)); try { ll.rebuild(); } catch (e) {
    ll.params.lumina = false; ll.lumina.ready = false; if ($('gi')) $('gi').checked = false;
    const g = renderer.getContext(), ex = (n) => !!g.getExtension(n);
    err('⚠ تعطّل Lumina GI على هذا الجهاز، وتم الرجوع للإضاءة العادية.\nالسبب: ' + (e && e.message || e) + '\nGPU: ' + g.getParameter(g.RENDERER) + ' · maxTex ' + g.getParameter(g.MAX_TEXTURE_SIZE) + ' · units ' + g.getParameter(g.MAX_TEXTURE_IMAGE_UNITS) + ' · colorBufFloat ' + ex('EXT_color_buffer_float') + ' · halfFloatLinear ' + ex('OES_texture_half_float_linear') + '\n\n' + (e && e.stack || ''));
  }
  ll.taa.reset(); ll.resetExposure();
}

let framed = '';
/** frame the camera on the building when the type (or first build) changes */
function frameView(st, peak) {
  const key = st.type + '|' + st.sides; if (framed === key) return; framed = key;
  const r = Math.max(st.W, st.D * 1.2, peak * 1.25), dir = new THREE.Vector3(0.62, 0.32, 0.95).normalize();
  oc.target.set(st.W * 0.08, peak * 0.42, st.D * 0.05); cam.position.copy(oc.target).addScaledVector(dir, r * 1.7); oc.update(); ll.taa.reset();
}

/** Algiers designer mode */
function buildAlg() {
  clearStudio(); clearAlg();
  const st = design.state, t0 = performance.now(), r = buildAlgiers(st), ms = performance.now() - t0;
  S.AG = r.group; ll.level.add(S.AG);
  AVG[L.WALL] = rgb(st.wallColor).map((c) => c * 0.8); AVG[L.ROOF] = [0.2, 0.21, 0.22];
  relight(r.peak, st.W, st.D); frameView(st, r.peak);
  $('st').textContent = `${TYPES[st.type] ? TYPES[st.type].name : ''} · ${st.floors} طوابق · ارتفاع ${r.lay.H.toFixed(1)} م (القمة ${r.peak.toFixed(1)} م) · ${Math.round(r.tris / 1000)}k مثلث · ${r.meshes} مادة · هندسة ${Math.round(ms)} ms`;
}

function build() {
  S.busy = true;
  if (S.mode === 'alg') { try { buildAlg(); } finally { S.busy = false; } return; }
  clearAlg(); AVG[L.WALL] = WALL_AVG.slice();
  PAL.roof = D.fxRoof ? '#a4472c' : '#7a8fa6'; AVG[L.ROOF] = D.fxRoof ? [0.38, 0.16, 0.09] : [0.18, 0.21, 0.26];
  if (S.bm) { ll.level.remove(S.bm); S.bm.geometry.dispose(); }
  S.bm = new THREE.Mesh(makeGeo(), S.texMode ? mat : [mat, matG, matC, matR]); S.bm.castShadow = S.bm.receiveShadow = true; ll.level.add(S.bm); buildModels();
  relight(D.gh + (D.floors - 1) * D.fh + (D.roof != 'flat' ? D.mh + 3 : 0), D.w, D.d);
  $('st').textContent = `UV islands: ${nIsl} · ${dens.toFixed(1)} px/m · ${(D.gh + (D.floors - 1) * D.fh).toFixed(1)} m`; S.busy = false;
}
let lt = 0;
function later() { $('st').textContent = 'Rebuilding lighting…'; clearTimeout(lt); lt = setTimeout(() => { try { build(); } catch (e) { err(e.stack || e); } }, 30); }

export { buildModels, build, later };
