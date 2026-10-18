// Render loop, GPU timing, dynamic resolution
import { $, err } from '../core/dom.js';
import { V, cam, ll, oc, renderer } from '../scene/scene.js';
import { S } from '../core/state.js';

let last = performance.now();
const gl_ = renderer.getContext(), tq_ = gl_.getExtension('EXT_disjoint_timer_query_webgl2'); let q_ = null, q_on = false, gpuMs = 0, cpuMs = 0, pf = 0;
const DRS_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0], drs = { on: false, i: 5, acc: 0, n: 0, base: 1e9, cool: 0, warm: 0 };
function drsTick(ms) { // dynamic resolution: keep frame interval near the display's refresh; hysteresis + cooldown avoid costly RT resizes back and forth
  if (!drs.on || ms > 200) return; if (drs.warm < 60) { drs.warm++; return; }
  drs.acc += ms; if (++drs.n < 30) return; const avg = drs.acc / drs.n; drs.acc = drs.n = 0;
  drs.base = Math.max(6.5, Math.min(drs.base, avg)); if (drs.cool > 0) { drs.cool--; return; }
  let i = drs.i; if (avg > drs.base * 1.3 && i > 0) i--; else if (avg < drs.base * 1.1 && i < 5) i++;
  if (i !== drs.i) { drs.i = i; drs.cool = 4; ll.setDlss(DRS_STEPS[i]); }
}
function gpuBegin() { if (!tq_) return; if (q_) { const ok = gl_.getQueryParameter(q_, gl_.QUERY_RESULT_AVAILABLE), dis = gl_.getParameter(tq_.GPU_DISJOINT_EXT); if (ok && !dis) gpuMs = gpuMs * .9 + gl_.getQueryParameter(q_, gl_.QUERY_RESULT) / 1e6 * .1; if (ok || dis) { gl_.deleteQuery(q_); q_ = null; } } if (!q_) { q_ = gl_.createQuery(); gl_.beginQuery(tq_.TIME_ELAPSED_EXT, q_); q_on = true; } }
function gpuEnd() { if (tq_ && q_on) { gl_.endQuery(tq_.TIME_ELAPSED_EXT); q_on = false; } }
(function loop() { requestAnimationFrame(loop); if (S.busy) return; const n = performance.now(), dt = Math.min(0.1, (n - last) / 1000); drsTick(n - last); last = n; try { oc.update(); ll.setFocus(oc.target); const t0 = performance.now(); gpuBegin(); try { ll.render(dt); } finally { gpuEnd(); } cpuMs = cpuMs * .9 + (performance.now() - t0) * .1;
  if (++pf % 20 == 0) $('perf').textContent = `${ll.lumina.lite ? 'Lite' : 'Legacy'} · CPU ${cpuMs.toFixed(1)} ms · ` + (tq_ ? `GPU ${gpuMs.toFixed(1)} ms` : 'GPU timer غير متاح') + ` · الكاش: ${ll.lumina.cacheBusy ? 'يتحدّث' : 'ساكن'} · scale ${(ll.params.dlss || 1).toFixed(2)}`; } catch (e) { S.busy = true; err(e.stack || e); } })();
new ResizeObserver(() => { const w = V.clientWidth, h = V.clientHeight; if (w < 10 || h < 10) return; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); ll.resize(w, h); ll.syncCamera(); }).observe(V);

export { last, gl_, tq_, q_, q_on, gpuMs, cpuMs, pf, DRS_STEPS, drs, drsTick, gpuBegin, gpuEnd };
