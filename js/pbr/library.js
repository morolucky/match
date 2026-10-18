import * as THREE from 'three';
import { MATS, DEFAULTS, makeShader } from './labGen.js';

// HD PBR generator front-end. Runs the Facade Bake Lab shader (labGen.js) over a flat,
// seamlessly tiling patch and returns albedo / normal / ORM (R=AO, G=roughness, B=metalness)
// plus the raw height. One patch covers `tile` metres, so materials keep real-world scale.

/** wrap-around blur + normal map so tiles repeat without seams */
function wrapNormals(hgt, R, dens, strength, smooth) {
  let h = hgt;
  for (let p = 0; p < smooth; p++) {
    const o = new Float32Array(h.length);
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += h[((y + dy + R) % R) * R + ((x + dx + R) % R)];
      o[y * R + x] = s / 9;
    }
    h = o;
  }
  const n = new Float32Array(R * R * 3), k = dens * 0.5 * 0.03 * strength;
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const i = y * R + x, hl = h[y * R + (x + R - 1) % R], hr = h[y * R + (x + 1) % R], hu = h[((y + R - 1) % R) * R + x], hd = h[((y + 1) % R) * R + x];
    let nx = -(hr - hl) * k, ny = -(hu - hd) * k; const l = Math.sqrt(nx * nx + ny * ny + 1); n[i * 3] = nx / l; n[i * 3 + 1] = ny / l; n[i * 3 + 2] = 1 / l;
  }
  return n;
}

/** flat-tile bake context expected by makeShader (no mesh bake: AO=1, no baked edges) */
function flatTile(R, tile) {
  const N = R * R, dens = R / tile, K = { res: R, dens, valid: new Uint8Array(N).fill(1), pat: new Float32Array(N * 2), ao: new Float32Array(N).fill(1), edge: new Float32Array(N).fill(99), nrm: new Float32Array(N * 3), pos: new Float32Array(N * 3), minY: 0, hY: tile };
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) { const i = y * R + x; K.pat[i * 2] = (x + 0.5) / dens; K.pat[i * 2 + 1] = (y + 0.5) / dens; K.pos[i * 3 + 1] = tile * 0.5; }
  return K;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * @param {string} name key of MATS  @param {object} o {res, tile, seed, over: param overrides, onProgress}
 * @returns {Promise<{albedo,normal,orm: HTMLCanvasElement, tile:number}>}
 */
export async function genMaps(name, o = {}) {
  const R = o.res || 512, base = MATS[name] || MATS.plaster;
  const S = Object.assign({}, DEFAULTS, { mat: name, rows: base.rows, cols: base.cols, mortar: base.mortar, bevel: base.bevel, relief: base.relief, rough: base.rough }, { tile: o.tile || 1.6, seed: o.seed || 7, gravity: 0, edgeWear: 0.3, aoStr: 0.6, nStr: 1.1, nSmooth: 1, sunOn: false, topType: 0 }, o.over || {});
  const K = flatTile(R, S.tile), sh = makeShader(K, S), N = R * R, step = 6000;
  for (let a = 0; a < N; a += step) { sh.range(a, Math.min(N, a + step)); if ((a / step) % 12 === 0) { o.onProgress && o.onProgress(a / N); await tick(); } }
  const out = sh.out, nrm = wrapNormals(out.hgt, R, K.dens, S.nStr, S.nSmooth | 0);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = R; return c; };
  const ca = mk(), cn = mk(), co = mk(), ia = new ImageData(R, R), inn = new ImageData(R, R), io = new ImageData(R, R);
  const metal = o.metal || 0, aoK = o.aoStrength == null ? 1 : o.aoStrength;
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    ia.data[j] = out.alb[i * 3] * 255; ia.data[j + 1] = out.alb[i * 3 + 1] * 255; ia.data[j + 2] = out.alb[i * 3 + 2] * 255; ia.data[j + 3] = 255;
    inn.data[j] = (nrm[i * 3] * 0.5 + 0.5) * 255; inn.data[j + 1] = (nrm[i * 3 + 1] * 0.5 + 0.5) * 255; inn.data[j + 2] = (nrm[i * 3 + 2] * 0.5 + 0.5) * 255; inn.data[j + 3] = 255;
    io.data[j] = (1 - (1 - out.ao[i]) * aoK) * 255; io.data[j + 1] = out.rgh[i] * 255; io.data[j + 2] = metal * 255; io.data[j + 3] = 255;
  }
  // render textures: 2 samplers only (lighting already uses ~11 of the usual 16 units):
  // RGB = albedo × AO, A = roughness (read by the shader patch in algiers/materials.js)
  const pk = new Uint8Array(N * 4), pn = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const j = i * 4, ao = 1 - (1 - out.ao[i]) * aoK;
    pk[j] = Math.min(255, out.alb[i * 3] * ao * 255); pk[j + 1] = Math.min(255, out.alb[i * 3 + 1] * ao * 255); pk[j + 2] = Math.min(255, out.alb[i * 3 + 2] * ao * 255); pk[j + 3] = Math.min(255, out.rgh[i] * 255);
    pn[j] = inn.data[j]; pn[j + 1] = inn.data[j + 1]; pn[j + 2] = inn.data[j + 2]; pn[j + 3] = 255;
  }
  ca.getContext('2d').putImageData(ia, 0, 0); cn.getContext('2d').putImageData(inn, 0, 0); co.getContext('2d').putImageData(io, 0, 0);
  o.onProgress && o.onProgress(1);
  return { albedo: ca, normal: cn, orm: co, packed: pk, packedN: pn, res: R, tile: S.tile };
}

/** packed data → THREE textures (DataTexture: no canvas premultiplication of the alpha channel) */
export function toTextures(m, aniso = 8) {
  const t = (data, srgb) => { const x = new THREE.DataTexture(data, m.res, m.res, THREE.RGBAFormat); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = aniso; x.magFilter = THREE.LinearFilter; x.minFilter = THREE.LinearMipmapLinearFilter; x.generateMipmaps = true; if (srgb) x.colorSpace = THREE.SRGBColorSpace; x.needsUpdate = true; return x; };
  return { map: t(m.packed, true), normalMap: t(m.packedN, false) };
}

export const MATERIAL_LIST = Object.entries(MATS).map(([k, m]) => ({ key: k, group: m.group, label: m.label }));
export { MATS };
