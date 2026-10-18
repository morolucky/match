// Procedural textures and the shared material table MT
import * as THREE from 'three';
import { fx } from '../scene/shaders.js';

/* ===== 3D window / door models v2: profiled architrave, cornice+dentils, corbels, sash with glazing bars, arched door; baked + merged per material ===== */
const PI_ = Math.PI, mkm = (o) => new THREE.MeshStandardMaterial(o), DB = THREE.DoubleSide;
function mkTex(f) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); f(g); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function nrm(t, k) { const s = t.image, n = s.width, g = s.getContext('2d').getImageData(0, 0, n, n).data, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), o = x.createImageData(n, n), L = (i, j) => { const p = (((j + n) % n) * n + ((i + n) % n)) * 4; return (g[p] + g[p+1] + g[p+2]) / 765; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const dx = (L(i+1, j) - L(i-1, j)) * k, dy = (L(i, j+1) - L(i, j-1)) * k, l = Math.hypot(dx, dy, 1), p = (j * n + i) * 4; o.data[p] = (-dx / l * .5 + .5) * 255; o.data[p+1] = (dy / l * .5 + .5) * 255; o.data[p+2] = (1 / l * .5 + .5) * 255; o.data[p+3] = 255; }
  x.putImageData(o, 0, 0); const r = new THREE.CanvasTexture(c); r.wrapS = r.wrapT = THREE.RepeatWrapping; r.anisotropy = 8; return r; }
const noise = (g, base, a) => { g.fillStyle = base; g.fillRect(0, 0, 256, 256); const id = g.getImageData(0, 0, 256, 256), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * a; d[i] += n; d[i+1] += n; d[i+2] += n * .9; } g.putImageData(id, 0, 0); };
const tStone = mkTex((g) => { noise(g, '#d9c6a2', 30); g.strokeStyle = 'rgba(90,70,40,.13)'; for (let i = 0; i < 40; i++) { g.lineWidth = Math.random() * 2; g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.random() * 40 - 20; y += Math.random() * 40 - 20; g.lineTo(x, y); } g.stroke(); } });
const tWood = mkTex((g) => { g.fillStyle = '#7c4322'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 160; i++) { g.strokeStyle = i % 2 ? 'rgba(40,18,6,.25)' : 'rgba(200,125,65,.18)'; g.lineWidth = Math.random() * 2.5 + .5; const x = Math.random() * 256; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 256; y += 16) g.lineTo(x + Math.sin(y * .04 + i) * 4, y); g.stroke(); } });
const matW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .05, metalness: .9, transparent: true, opacity: .42, depthWrite: false });
fx(matW, 'fx-wglass', { color: 'diffuseColor.rgb=vec3(.42,.55,.66)*(.8+.2*fxn(vGP.xy*2.));', rough: 'roughnessFactor=.035+.03*fxn(vGP.xy*3.);', metal: 'metalnessFactor=.5;',
  emis: 'float glit=step(.58,vS.z);vec3 gwm=mix(vec3(1.,.74,.42),vec3(.7,.85,1.),step(.9,vS.z));totalEmissiveRadiance+=gwm*glit*uNightG*2.2*(.75+.25*fxn(vec2(vS.z*50.,vW.y*2.)))*(.6+.4*smoothstep(0.,vS.y,vW.y));' });
const MT = { stone: mkm({ map: tStone, normalMap: nrm(tStone, 3), normalScale: new THREE.Vector2(.9, .9), roughness: .85 }), glass: matW,
  iron: mkm({ color: 0x101012, roughness: .4, metalness: .85 }), brass: mkm({ color: 0xc59a45, roughness: .25, metalness: 1 }), frame: mkm({ color: 0x15181d, roughness: .4, metalness: .4 }), room: mkm({ color: 0x4a3c30, emissive: 0x2e2013, roughness: 1, side: DB }), curt: mkm({ color: 0xf0e8d8, emissive: 0x241d14, roughness: .95, side: DB }), cb: mkm({ color: 0xd2bb94, emissive: 0x201a10, roughness: .95, side: DB }), cg: mkm({ color: 0x8c98a8, emissive: 0x15181c, roughness: .95, side: DB }), cr: mkm({ color: 0x7c2f3b, emissive: 0x1e0b0e, roughness: .95, side: DB }), cs: mkm({ color: 0x8a9b7c, emissive: 0x12160f, roughness: .95, side: DB }), cw: mkm({ color: 0xfbf8f1, emissive: 0x2a2620, roughness: .9, side: DB }),
  d1: mkm({ color: 0x131416, roughness: .35, side: DB }), d2: mkm({ color: 0x0e4a42, roughness: .4, side: DB }), d3: mkm({ color: 0x2b241f, roughness: .3, metalness: .5, side: DB }),
  d4: mkm({ map: tWood, normalMap: nrm(tWood, 2.5), color: 0xc9b5a5, roughness: .5, side: DB }), dglass: mkm({ color: 0x1b2733, roughness: .06, metalness: .92, side: DB }) };
const mkAwn = (c) => mkTex((g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f1ede2' : c; g.fillRect(i * 32, 0, 32, 256); } });
['#2f55a4', '#b3262e', '#d8c7a4', '#2f6b45'].forEach((c, i) => { MT['awn' + i] = mkm({ map: mkAwn(c), roughness: 0.9, side: DB }); });
MT.pot = mkm({ color: 0x9a4f31, roughness: 0.85 }); MT.leaf = mkm({ color: 0x3f7a35, roughness: 0.8, side: DB }); MT.acu = mkm({ color: 0xe6e9ec, roughness: 0.55 });
MT.fr1 = mkm({ color: 0x2a5c8f, roughness: 0.45, metalness: 0.1 }); MT.fr2 = mkm({ color: 0xe9e6de, roughness: 0.5 }); MT.fr3 = mkm({ color: 0x4a2e1c, roughness: 0.55 });
MT.shutB = mkm({ color: 0x3d7fb8, roughness: 0.6, side: DB }); MT.shutG = mkm({ color: 0x3a5a40, roughness: 0.6, side: DB });
let FR = 'frame', SH = 'shut';
MT.d6 = mkm({ color: 0x2f6f95, roughness: 0.5, side: DB });
MT.shut = mkm({ color: 0x2d3b4e, roughness: 0.62, metalness: 0.1, side: DB });
MT.d5 = mkm({ color: 0x3d434b, roughness: 0.5, metalness: 0.45, side: DB });
const matL = new THREE.MeshStandardMaterial({ color: 0xfff1d0, roughness: 0.2, metalness: 0 });
fx(matL, 'fx-lamp', { emis: 'totalEmissiveRadiance+=vec3(1.,.78,.45)*uNightG*4.;' }); MT.lampg = matL;
MT.zinc = mkm({ color: 0xb9c2c4, roughness: 0.5, metalness: 0.4, side: DB }); // low metalness: fully-metal parts only reflect the (dim) traced sky and read as black
const DST = { 1: { m: 'd1', gl: 0 }, 2: { m: 'd2', gl: 'q', arch: 1 }, 3: { m: 'd3', gl: 'g' }, 4: { m: 'd4', gl: 'i' }, 5: { m: 'd5', arch: 1, roll: 1 }, 6: { m: 'd6', arch: 1, gl: 0 } };
const DST_N = 6;

export { PI_, mkm, DB, mkTex, nrm, noise, tStone, tWood, matW, MT, mkAwn, FR, SH, matL, DST, DST_N };
