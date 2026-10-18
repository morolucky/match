import * as THREE from 'three';
import { MT, nrm } from '../studio/materials.js';
import * as TX from './textures.js';

// Algiers materials live in the shared MT table under "a_*" keys so the merge/bake pipeline
// and LevelLighting.patch() treat them like every other material. Palette changes only
// recolour materials (no geometry rebuild).

const DB = THREE.DoubleSide;
const std = (o) => new THREE.MeshStandardMaterial(o);
let made = false, lastWeather = -1;
const ironTex = {};

/** materials whose UVs are re-projected from world position (metres / scale) */
export const WORLD_UV = { a_wall: 1 / 3, a_ground: 1 / 2, a_trim: 1 / 1.5, a_pave: 1 / 1.2, a_asph: 1 / 4, a_zinc: 1 / 1.5, a_zel: 1 / 0.5, a_curb: 1 / 1.5 };

export function ensureMaterials() {
  if (made) return; made = true;
  const tStone = TX.tex(TX.stone());
  MT.a_wall = std({ roughness: 0.9 });
  MT.a_ground = std({ roughness: 0.88 });
  MT.a_trim = std({ map: tStone, normalMap: nrm(tStone, 2), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.8 });
  MT.a_groove = std({ color: 0x6d655a, roughness: 1 });
  const tl = TX.tex(TX.louvre()); MT.a_shut = std({ map: tl, normalMap: nrm(tl, 3), roughness: 0.6, side: DB });
  MT.a_roller = std({ map: TX.tex(TX.roller()), roughness: 0.55, metalness: 0.2, side: DB });
  for (const k of TX.IRON) ironTex[k] = TX.tex(TX.iron(k), false, 4);
  MT.a_rail = std({ map: ironTex.classic, alphaTest: 0.5, roughness: 0.45, metalness: 0.35, side: DB });
  MT.a_iron = std({ roughness: 0.45, metalness: 0.35 });
  MT.a_frame = std({ color: 0xf3f1ea, roughness: 0.5 });
  MT.a_wood = std({ map: MT.d4.map, normalMap: MT.d4.normalMap, color: 0xb08f6c, roughness: 0.55, side: DB });
  MT.a_lat = std({ map: TX.tex(TX.lattice(), false), alphaTest: 0.5, color: 0x6b4a2e, roughness: 0.7, side: DB });
  MT.a_zinc = std({ roughness: 0.42, metalness: 0.45 });
  MT.a_dome = std({ roughness: 0.35, metalness: 0.15 });
  MT.a_zel = std({ map: TX.tex(TX.zellige()), roughness: 0.25, metalness: 0.05 });
  MT.a_shop = std({ color: 0x1a232b, roughness: 0.08, metalness: 0.8 });
  MT.a_awn = std({ roughness: 0.9, side: DB });
  MT.a_pave = std({ map: TX.tex(TX.pavers()), roughness: 0.85 });
  MT.a_curb = std({ map: tStone, color: 0xb9b2a6, roughness: 0.8 });
  MT.a_asph = std({ map: TX.tex(TX.asphalt()), roughness: 0.95 });
  MT.a_mark = std({ color: 0xeeeeee, roughness: 0.7 });
  MT.a_ac = std({ color: 0xe9ecee, roughness: 0.5 });
  MT.a_dark = std({ color: 0x15171a, roughness: 0.6 });
  MT.a_metal = std({ color: 0x8b9196, roughness: 0.4, metalness: 0.6 });
  MT.a_plant = std({ color: 0x3f7a35, roughness: 0.85 });
  MT.a_ceil = std({ color: 0xd8d2c6, roughness: 1 });
  for (let i = 0; i < TX.SIGN_N; i++) MT['a_sign' + i] = std({ map: TX.tex(TX.sign(i)), roughness: 0.6, emissive: 0x111111 });
  ['#f4f1ea', '#2e6fb5', '#c63b3b', '#f0c63a', '#5b8f4e', '#e88fb1'].forEach((c, i) => { MT['a_cloth' + i] = std({ color: c, roughness: 0.95, side: DB }); });
}

/** palette + weathering (cheap: recolours / regenerates two textures) */
export function applyLook(st) {
  ensureMaterials();
  MT.a_wall.color.set(st.wallColor); MT.a_trim.color.set(st.trimColor); MT.a_ground.color.set(st.groundColor);
  MT.a_shut.color.set(st.shutterColor); MT.a_roller.color.set(st.shutterColor);
  MT.a_rail.color.set(st.ironColor); MT.a_iron.color.set(st.ironColor);
  MT.a_zinc.color.set(st.roofColor); MT.a_dome.color.set(st.domeColor); MT.a_awn.color.set(st.awningColor);
  MT.a_frame.color.set(st.frameColor);
  if (MT.a_rail.map !== ironTex[st.iron]) { MT.a_rail.map = ironTex[st.iron] || ironTex.classic; MT.a_rail.needsUpdate = true; }
  if (Math.abs(lastWeather - st.weather) > 1e-3) {
    lastWeather = st.weather;
    for (const [k, f] of [['a_wall', TX.plaster], ['a_ground', TX.ashlar]]) {
      const m = MT[k]; m.map && m.map.dispose(); m.normalMap && m.normalMap.dispose();
      const t = TX.tex(f(st.weather)); m.map = t; m.normalMap = nrm(t, k === 'a_wall' ? 0.8 : 1.5); m.normalScale = new THREE.Vector2(0.4, 0.4); m.needsUpdate = true;
    }
  }
}
