// DOM helpers + global error overlay
import * as THREE from 'three';

/* ================= smart building (generator + clean UV atlas) ================= */
const $ = (i) => document.getElementById(i), clamp = THREE.MathUtils.clamp;
const err = (m) => { const e = $('err'); e.hidden = false; e.textContent = String(m); e.scrollTop = 0; e.onclick = () => { e.hidden = true; }; };
addEventListener('error', (e) => err(e.message)); addEventListener('unhandledrejection', (e) => err((e.reason && e.reason.message) || e.reason));

export { $, clamp, err };
