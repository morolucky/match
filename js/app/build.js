// Scene (re)build: classic studio + Algiers designer
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AVG, L } from '../lighting/layers.js';
import { $, err } from '../core/dom.js';
import { D, PAL } from '../studio/params.js';
import { OPN, dens, makeGeo, nIsl } from '../studio/generator.js';
import { ll, mat, renderer } from '../scene/scene.js';
import { matC, matG, matR } from '../scene/shaders.js';
import { MT } from '../studio/materials.js';
import { bake } from '../studio/kit.js';
import { winM } from '../studio/models/windows.js';
import { doorM } from '../studio/models/doors.js';
import { buildCornice, buildLamp } from '../studio/models/details.js';
import { buildCont } from '../studio/models/balconies.js';
import { buildDrain } from '../studio/models/drainage.js';
import { S } from '../core/state.js';

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
function build() {
  S.busy = true;
  PAL.roof = D.fxRoof ? '#a4472c' : '#7a8fa6'; AVG[L.ROOF] = D.fxRoof ? [0.38, 0.16, 0.09] : [0.18, 0.21, 0.26];
  if (S.bm) { ll.level.remove(S.bm); S.bm.geometry.dispose(); }
  S.bm = new THREE.Mesh(makeGeo(), S.texMode ? mat : [mat, matG, matC, matR]); S.bm.castShadow = S.bm.receiveShadow = true; ll.level.add(S.bm); buildModels();
  const H = D.gh + (D.floors - 1) * D.fh + (D.roof != 'flat' ? D.mh + 3 : 0), sq = [[-45,-45],[45,-45],[45,45],[-45,45]];
  ll.setBounds(new THREE.Box3(new THREE.Vector3(-45, 0, -45), new THREE.Vector3(45, H + 6, 45)));
  ll.lumina.setAlbedo(AVG);
  ll.lumina.setCity({ blocks: [{ curb: sq, lot: sq, lawn: false }], buildings: [{ cx: 0, cz: 0, w: D.w, d: D.d, angle: 0, style: D.floors > 9 ? 'tower' : 'haussmann', wall: L.WALL, roofLayer: L.ROOF, tint: [1, 1, 1] }] });
  ll.patch(ll.level); ll.setFocus(new THREE.Vector3(0, H * 0.4, 0)); try { ll.rebuild(); } catch (e) {
    ll.params.lumina = false; ll.lumina.ready = false; if ($('gi')) $('gi').checked = false;
    const g = renderer.getContext(), ex = (n) => !!g.getExtension(n);
    err('⚠ تعطّل Lumina GI على هذا الجهاز، وتم الرجوع للإضاءة العادية.\nالسبب: ' + (e && e.message || e) + '\nGPU: ' + g.getParameter(g.RENDERER) + ' · maxTex ' + g.getParameter(g.MAX_TEXTURE_SIZE) + ' · units ' + g.getParameter(g.MAX_TEXTURE_IMAGE_UNITS) + ' · colorBufFloat ' + ex('EXT_color_buffer_float') + ' · halfFloatLinear ' + ex('OES_texture_half_float_linear') + '\n\n' + (e && e.stack || ''));
  }
  ll.taa.reset(); ll.resetExposure();
  $('st').textContent = `UV islands: ${nIsl} · ${dens.toFixed(1)} px/m · ${(D.gh + (D.floors - 1) * D.fh).toFixed(1)} m`; S.busy = false;
}
function later() { $('st').textContent = 'Rebuilding lighting…'; setTimeout(() => { try { build(); } catch (e) { err(e.stack || e); } }, 30); }

export { buildModels, build, later };
