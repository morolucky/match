import * as THREE from 'three';
import { MT } from '../studio/materials.js';
import { ground } from '../scene/scene.js';
import { genMaps, toTextures } from './library.js';
import { ROLES } from './roles.js';
import { setRepeat, ensureMaterials, resetLegacy } from '../algiers/materials.js';

// Generates the PBR set of every role with the Facade Bake Lab shader and applies it to the
// scene materials. Results are cached per (material, resolution, weathering), so changing
// the scale or the palette never regenerates, and the latest request always wins.

const cache = new Map(), maps = {}; let token = 0;

/** weathering slider → Facade Bake Lab effect parameters, scaled per role */
function weatherOver(w, k) {
  const a = w * k;
  return { moldOn: a > 0.05, moldCover: 0.02 + 0.22 * a, effOn: a > 0.1, effCover: 0.03 + 0.2 * a, crackOn: a > 0.7, crackAmt: 0.2 + 0.3 * a, spOn: a > 0.3, spCover: 0.02 + 0.1 * a, streakOn: false, variation: 0.25 + 0.3 * a, grain: 0.4 };
}

function assign(role, key, tex, scale) {
  const r = ROLES[role], tile = r.tile * scale;
  for (const k of r.mt) {
    const m = MT[k]; if (!m) continue;
    m.map = tex.map; m.normalMap = tex.normalMap; m.roughnessMap = tex.orm; m.metalnessMap = tex.orm; m.aoMap = tex.orm;
    m.roughness = 1; m.metalness = r.metal ? 1 : 0; m.aoMapIntensity = 0.85; m.normalScale = new THREE.Vector2(1, 1);
    if (!r.tint) m.color.set(0xffffff);
    setRepeat(m, tile); m.needsUpdate = true;
  }
  if (role === 'gnd') { for (const t of [tex.map, tex.normalMap, tex.orm]) t.repeat.set(400 / tile, 400 / tile); const g = ground.material; g.map = tex.map; g.normalMap = tex.normalMap; g.roughnessMap = tex.orm; g.aoMap = null; g.color.set(0xb4b2ae); g.roughness = 1; g.needsUpdate = true; }
}

function clearRole(role) {
  for (const k of ROLES[role].mt) { const m = MT[k]; if (!m) continue; m.map = m.normalMap = m.roughnessMap = m.metalnessMap = m.aoMap = null; m.roughness = 0.8; m.metalness = ROLES[role].metal ? 0.5 : 0; m.needsUpdate = true; }
}

/** apply (or clear) the PBR set for the current design; resolves when finished or superseded */
export async function applyPBR(st, onProgress = () => {}) {
  ensureMaterials();
  const my = ++token, roles = Object.keys(ROLES);
  if (!st.pbrOn) { roles.forEach(clearRole); resetLegacy(); ground.material.map = ground.material.normalMap = ground.material.roughnessMap = null; ground.material.color.set(0x4d4740); ground.material.needsUpdate = true; onProgress(1, ''); return false; }
  const res = st.pbrRes, wb = Math.round(st.weather * 10) / 10;
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i], r = ROLES[role], name = st.pbrMats[role] || r.def, rr = r.half ? Math.max(256, res >> 1) : res, key = `${name}|${rr}|${r.weather ? wb : 0}|${role}`;
    let tex = cache.get(key);
    if (!tex) {
      const m = await genMaps(name, { res: rr, tile: r.tile, seed: 11 + i * 7, metal: r.metal || 0, over: weatherOver(wb, r.weather), onProgress: (p) => onProgress((i + p) / roles.length, r.label) });
      if (my !== token) return false;
      tex = toTextures(m); tex.raw = m; cache.set(key, tex);
    }
    maps[role] = tex.raw; assign(role, key, tex, st.pbrScale);
    onProgress((i + 1) / roles.length, r.label);
    await new Promise((r) => setTimeout(r, 0)); if (my !== token) return false;
  }
  for (const [k, t] of cache) { const role = k.split('|')[3], rr = ROLES[role].half ? Math.max(256, res >> 1) : res; if (!k.includes(`|${rr}|`)) { for (const x of [t.map, t.normalMap, t.orm]) x.dispose(); cache.delete(k); } }
  return true;
}

/** cheap: change tile scale without regenerating */
export function rescalePBR(st) {
  if (!st.pbrOn) return;
  for (const [role, r] of Object.entries(ROLES)) if (r.mt.length || role === 'gnd') { for (const k of r.mt) MT[k] && setRepeat(MT[k], r.tile * st.pbrScale); }
}

export const roleMaps = (role) => maps[role];
export function clearCache() { for (const t of cache.values()) for (const x of [t.map, t.normalMap, t.orm]) x.dispose(); cache.clear(); }
