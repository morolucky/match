// Texture import and exports
import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { $, err } from '../core/dom.js';
import { Q, R, drawGuide, drawUV } from '../studio/generator.js';
import { ll, mat, renderer } from '../scene/scene.js';
import { S } from '../core/state.js';

/* ================= textures from Facade Bake Lab, exports ================= */
$('fiBtn').onclick = () => $('fi').click();
$('fi').onchange = (e) => {
  if (!S.bm) { alert('خامات Bake Lab تخص الاستوديو الكلاسيكي: افتح تبويب «الاستوديو» أولاً.'); e.target.value = ''; return; }
  const ld = new THREE.TextureLoader(); S.texMode = true; S.bm.material = mat; mat.vertexColors = false; mat.color.set(0xffffff);
  [...e.target.files].forEach((f) => { const n = f.name.toLowerCase(), url = URL.createObjectURL(f);
    ld.load(url, (t) => { t.anisotropy = 8;
      if (n.includes('albedo') || n.includes('color')) { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; }
      else if (n.includes('normal')) mat.normalMap = t; else if (n.includes('rough')) { mat.roughnessMap = t; mat.roughness = 1; } else if (n.includes('ao')) { mat.aoMap = t; S.bm.geometry.setAttribute('uv1', S.bm.geometry.getAttribute('uv')); }
      mat.needsUpdate = true; }); });
};
async function save(name, data) {
  const d = window.claude && await window.claude.use('downloads');
  if (d) { try { await d.save({ filename: name, data }); } catch (e) { if (e.code != 'declined') alert('تعذر الحفظ: ' + e.code); } return; }
  // plain browser: regular anchor download
  const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const png = (c) => new Promise((r) => c.toBlob(r, 'image/png'));
const studioOnly = () => { if (S.mode !== 'alg' && Q) return true; alert('UV Layout و Guide خاصّان بالاستوديو الكلاسيكي (افتح تبويب «الاستوديو»).'); return false; };
$('e1').onclick = async () => studioOnly() && save('uv_layout.png', await png(drawUV())); $('e2').onclick = async () => studioOnly() && save('guide_segmentation.png', await png(drawGuide()));
$('e3').onclick = () => {
  if (S.mode === 'alg') { if (S.AG) save('alger_building.obj.txt', new Blob([new OBJExporter().parse(S.AG)], { type: 'text/plain' })); return; }
  let s = '# smart building\n', n = 1, f = ''; for (const q of Q) { q.p.forEach((p) => s += `v ${p[0].toFixed(4)} ${p[1].toFixed(4)} ${p[2].toFixed(4)}\n`); q.a.forEach((a) => s += `vt ${(a[0]/R).toFixed(5)} ${(1 - a[1]/R).toFixed(5)}\n`); f += `f ${n}/${n} ${n+1}/${n+1} ${n+2}/${n+2}\nf ${n}/${n} ${n+2}/${n+2} ${n+3}/${n+3}\n`; n += 4; } save('building.obj.txt', new Blob([s + f], { type: 'text/plain' })); };
$('glb').onclick = () => { const root = S.mode === 'alg' ? S.AG : S.mode === 'city' ? S.CG : ll.level; if (!root) return; new GLTFExporter().parse(root, (b) => save(S.mode === 'city' ? 'algiers_city.glb' : 'building.glb', new Blob([b], { type: 'model/gltf-binary' })), (e) => err(e.message || e), { binary: true }); };
$('shot').onclick = async () => { ll.render(0.016); save('building.png', await png(renderer.domElement)); };

export { save, png };
