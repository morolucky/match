// Classic studio + lighting panel bindings
import { $, err } from '../core/dom.js';
import { D } from '../studio/params.js';
import { cam, ll, mat, renderer } from '../scene/scene.js';
import { UC } from '../scene/shaders.js';
import { later } from '../app/build.js';
import { drs } from '../app/loop.js';
import { S } from '../core/state.js';

/* ================= UI ================= */
const SL = [['w','العرض (م)',6,40,.5],['d','العمق (م)',6,40,.5],['floors','الطوابق',1,14,1],['fh','ارتفاع الطابق',2.6,4.5,.1],['gh','ارتفاع الأرضي',3,6,.1],['bay','عرض الفتحة',2.2,6,.1],['mh','ارتفاع السقف',1.5,5,.1],['seed','Seed',1,999,1]];
$('sl').innerHTML = SL.map(([k,l,a,b,s]) => `<div class="r"><label>${l}</label><input type="range" id="s_${k}" min="${a}" max="${b}" step="${s}" value="${D[k]}"><span id="o_${k}">${D[k]}</span></div>`).join('');
SL.forEach(([k]) => { $('s_'+k).oninput = (e) => { D[k] = +e.target.value; $('o_'+k).textContent = D[k]; }; $('s_'+k).onchange = later; });
$('roof').onchange = (e) => { D.roof = e.target.value; later(); }; $('bal').onchange = (e) => { D.bal = +e.target.checked; later(); };
$('mdl').onchange = (e) => { D.models = e.target.checked; later(); }; $('drn').onchange = (e) => { D.drain = e.target.checked; later(); }; $('prog').onchange = (e) => { D.prog = +e.target.value; later(); }; $('wst').onchange = (e) => { D.wst = +e.target.value; later(); }; $('det').onchange = (e) => { D.detail = e.target.checked; later(); }; $('dst').onchange = (e) => { D.dst = +e.target.value; later(); };
const resetTex = () => { S.texMode = false; mat.vertexColors = true; mat.map = mat.normalMap = mat.roughnessMap = mat.aoMap = null; mat.needsUpdate = true; };
$('fxc').onchange = (e) => { D.fxConc = e.target.checked; resetTex(); later(); }; $('fxg').onchange = (e) => { D.fxGlass = e.target.checked; resetTex(); later(); }; $('fxr').onchange = (e) => { D.fxRoof = e.target.checked; resetTex(); later(); }; $('tile').oninput = (e) => { UC.uTileW.value = +e.target.value; };
$('grime').oninput = (e) => { UC.uGrime.value = +e.target.value; }; $('panel').oninput = (e) => { UC.uPanelW.value = +e.target.value; UC.uPanelH.value = +e.target.value / 2; };
const sync = () => { SL.forEach(([k]) => { $('s_'+k).value = D[k]; $('o_'+k).textContent = D[k]; }); $('roof').value = D.roof; $('bal').checked = !!D.bal; };
const PRE = {'هوسمان':{w:16,d:12,floors:6,fh:3.2,gh:4.2,bay:3.2,roof:'mansard',mh:3.4,bal:1},'عمارة':{w:26,d:14,floors:5,fh:3,gh:3.6,bay:3.6,roof:'flat',bal:1},'برج':{w:12,d:12,floors:14,fh:3.2,gh:4,bay:3,roof:'flat',bal:0},'فيلا':{w:12,d:9,floors:2,fh:3.4,gh:3.8,bay:3.4,roof:'mansard',mh:2.4,bal:1},'قرميد':{w:16,d:12,floors:4,fh:3.2,gh:4,bay:3.2,roof:'hip',mh:4,bal:1}};
$('pre').innerHTML = Object.keys(PRE).map((n) => `<button>${n}</button>`).join('');
$('pre').onclick = (e) => { const p = PRE[e.target.textContent]; if (!p) return; Object.assign(D, { mh: 3, custom: [] }, p); sync(); later(); };
sync(); let tq = 0; $('time').oninput = (e) => { $('o_time').textContent = (+e.target.value).toFixed(1); cancelAnimationFrame(tq); tq = requestAnimationFrame(() => { ll.setTime(+e.target.value); ll.taa.reset(); }); };
$('gi').onchange = (e) => { ll.params.lumina = e.target.checked; }; $('ssr').onchange = (e) => { ll.params.ssr = e.target.checked ? 0.85 : 0; ll.params.gtao = e.target.checked ? 0.65 : 0; };
$('ae').onchange = (e) => { ll.params.autoExposure = e.target.checked; ll.resetExposure(); }; $('aa').onchange = (e) => { ll.params.aa = e.target.value; ll.taa.reset(); ll.resize(); };
const setLite = (on) => { const L = ll.lumina; L.lite = on; L.u.uLmLite.value = on ? 1 : 0; L.farJob = L.nearJob = null; L.invalidate(); L.updateCaches(cam.position, true); ll.taa.reset(); };
$('lite').onchange = (e) => setLite(e.target.checked);
$('bm').onclick = () => { $('perf').textContent = '⏱ جارٍ القياس (≈ ثوانٍ)…'; S.busy = true; setTimeout(() => { try {
  const L = ll.lumina, was = L.lite, gl = renderer.getContext(), out = [];
  for (const lite of [false, true]) {
    setLite(lite); for (let i = 0; i < 15; i++) ll.render(0.016); gl.finish();
    L.invalidate(); // measure window includes the cache refresh passes
    const ts = []; for (let i = 0; i < 90; i++) { const t0 = performance.now(); ll.render(0.016); gl.finish(); ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b); out.push({ avg: ts.reduce((a, b) => a + b) / ts.length, p95: ts[Math.floor(ts.length * .95)], min: ts[0] });
  }
  setLite(was); $('lite').checked = was;
  $('perf').textContent = `Legacy: avg ${out[0].avg.toFixed(1)} · p95 ${out[0].p95.toFixed(1)} ms\nLite:   avg ${out[1].avg.toFixed(1)} · p95 ${out[1].p95.toFixed(1)} ms\nالتسريع ×${(out[0].avg / out[1].avg).toFixed(2)}`;
} catch (e) { err(e.stack || e); } S.busy = false; }, 50); };
$('dl').onchange = (e) => { if (e.target.value === 'auto') { drs.on = true; drs.i = 5; drs.warm = 0; drs.cool = 0; drs.acc = drs.n = 0; $('aa').value = 'taa'; ll.params.aa = 'taa'; } else { drs.on = false; ll.setDlss(+e.target.value); } }; $('ex').oninput = (e) => { ll.params.exposure = +e.target.value; };

export { SL, resetTex, sync, PRE, tq, setLite };
