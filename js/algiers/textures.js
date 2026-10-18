import * as THREE from 'three';

// Procedural canvas textures for the Algiers designer (all tintable: drawn light/neutral,
// the material colour carries the user's palette choice).

function canvas(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); f(g, w, h); return c; }
export function tex(c, srgb = true, aniso = 8) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }

let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function grain(g, w, h, amp) { const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0); }
function blotches(g, w, h, n, col, rmax) { for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, r = rnd() * rmax + 4, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }

/** lime plaster; weather 0..1 adds rain streaks and grime (texture spans 3 m) */
export function plaster(weather = 0.4) {
  seed = 11;
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#f2f0ec'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 60, 'rgba(160,150,135,0.10)', 70); blotches(g, w, h, 40, 'rgba(255,255,255,0.25)', 50);
    g.globalAlpha = 0.5 * weather;
    for (let i = 0; i < 90 * weather; i++) { const x = rnd() * w, y = rnd() * h * 0.6, len = 60 + rnd() * 260, gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, 'rgba(70,62,52,0.35)'); gr.addColorStop(1, 'rgba(70,62,52,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + rnd() * 7, len); }
    g.globalAlpha = 1; grain(g, w, h, 16);
  });
}

/** dressed stone, used for mouldings, cornices, pillars */
export function stone() { seed = 5; return canvas(256, 256, (g, w, h) => { g.fillStyle = '#efe9df'; g.fillRect(0, 0, w, h); blotches(g, w, h, 50, 'rgba(150,135,110,0.12)', 30); grain(g, w, h, 22); }); }

/** rusticated ashlar courses (bossage) for ground floors: 4 courses per texture height (2 m) */
export function ashlar(weather = 0.4) {
  seed = 7;
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#ece6da'; g.fillRect(0, 0, w, h); blotches(g, w, h, 40, 'rgba(140,125,100,0.14)', 40);
    const ch = h / 4; for (let r = 0; r < 4; r++) { const off = r % 2 ? w / 4 : 0; g.fillStyle = 'rgba(60,50,40,0.55)'; g.fillRect(0, r * ch, w, 5); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, r * ch + 5, w, 2); for (let k = 0; k < 3; k++) { const x = (off + k * w / 2) % w; g.fillStyle = 'rgba(60,50,40,0.45)'; g.fillRect(x, r * ch, 4, ch); } }
    g.globalAlpha = weather * 0.6; blotches(g, w, h, 30, 'rgba(60,55,45,0.25)', 60); g.globalAlpha = 1; grain(g, w, h, 18);
  });
}

/** persienne louvres (vertical tiling: texture spans one leaf) */
export function louvre() {
  return canvas(128, 256, (g, w, h) => {
    g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, w, h);
    const fr = 9; g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, fr); g.fillRect(0, h - fr, w, fr); g.fillRect(0, 0, fr, h); g.fillRect(w - fr, 0, fr, h); g.fillRect(0, h * 0.5 - 4, w, 8);
    for (let y = fr + 2; y < h - fr; y += 7) { if (Math.abs(y - h * 0.5) < 7) continue; const gr = g.createLinearGradient(0, y, 0, y + 7); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#bdbdbd'); gr.addColorStop(1, '#5c5c5c'); g.fillStyle = gr; g.fillRect(fr, y, w - fr * 2, 7); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  });
}

export function roller() { return canvas(64, 128, (g, w, h) => { for (let y = 0; y < h; y += 6) { const gr = g.createLinearGradient(0, y, 0, y + 6); gr.addColorStop(0, '#f0f0f0'); gr.addColorStop(1, '#8a8a8a'); g.fillStyle = gr; g.fillRect(0, y, w, 6); } }); }

/** wrought-iron railing patterns, white on transparent, one tile = 1 m wide × 1 m tall */
export const IRON = ['classic', 'nouveau', 'deco', 'moorish', 'bars', 'grille'];
export function iron(kind) {
  return canvas(256, 256, (g, w, h) => {
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    const rail = (y, t) => g.fillRect(0, y, w, t);
    rail(0, 12); rail(h - 14, 14); g.lineWidth = 7;
    const L = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    const C = (x, y, r, a0 = 0, a1 = Math.PI * 2) => { g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke(); };
    if (kind === 'classic') { // bars + rings + C-scrolls (the dominant Algiers type)
      for (let x = 16; x < w; x += 32) L(x, 12, x, h - 14);
      g.lineWidth = 5; for (let x = 0; x <= w; x += 64) { C(x + 32, 40, 13); C(x + 32, h - 44, 13); }
      L(0, 70, w, 70); L(0, h - 72, w, h - 72);
      for (let x = 0; x < w; x += 64) { C(x + 16, 128, 22, -Math.PI / 2, Math.PI / 2); C(x + 48, 128, 22, Math.PI / 2, Math.PI * 1.5); }
    } else if (kind === 'nouveau') {
      g.lineWidth = 6; for (let x = 0; x < w; x += 128) {
        g.beginPath(); g.moveTo(x, h - 14); g.bezierCurveTo(x + 10, h * 0.3, x + 110, h * 0.7, x + 64, 30); g.stroke();
        g.beginPath(); g.moveTo(x + 128, h - 14); g.bezierCurveTo(x + 118, h * 0.3, x + 18, h * 0.7, x + 64, 30); g.stroke();
        C(x + 64, 30 + 22, 18); C(x + 64, h * 0.62, 26); C(x + 30, h * 0.45, 12); C(x + 98, h * 0.45, 12);
        g.beginPath(); g.ellipse(x + 64, h * 0.62, 8, 16, 0, 0, Math.PI * 2); g.fill();
      }
      for (let x = 0; x <= w; x += 128) L(x, 12, x, h - 14);
    } else if (kind === 'deco') { // stepped chevrons and sunbursts (1930s)
      g.lineWidth = 6; for (let x = 0; x < w; x += 128) {
        for (let k = 0; k < 4; k++) { const s = 18 + k * 22; g.strokeRect(x + 64 - s, h / 2 - s, s * 2, s * 2); }
        for (let a = 0; a < 7; a++) { const t = Math.PI + a * Math.PI / 6; L(x + 64, h - 14, x + 64 + Math.cos(t) * 60, h - 14 + Math.sin(t) * 60); }
      }
      for (let x = 0; x <= w; x += 128) { g.fillRect(x - 4, 12, 8, h - 26); }
    } else if (kind === 'moorish') { // 8-point star lattice
      g.lineWidth = 5; const cell = 64;
      for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) { const cx = x + 32, cy = y + 32, r = 22; g.strokeRect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4); g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); g.restore(); L(x, y, x + cell, y + cell); L(x + cell, y, x, y + cell); }
    } else if (kind === 'grille') { // dense square mesh + diagonal (balcony grilles, image 6)
      g.lineWidth = 4; for (let x = 0; x <= w; x += 21) L(x, 0, x, h); for (let y = 0; y <= h; y += 42) L(0, y, w, y); g.lineWidth = 5; for (let x = -w; x < w; x += 64) { L(x, h, x + h, 0); L(x + h, h, x, 0); }
    } else { for (let x = 12; x < w; x += 25) L(x, 12, x, h - 14); }
  });
}

/** moucharabieh lattice, wood on transparent */
export function lattice() { return canvas(128, 128, (g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 5; for (let i = -w; i < w * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } g.fillStyle = '#fff'; for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); } g.lineWidth = 10; g.strokeRect(0, 0, w, h); }); }

/** zellige frieze (one tile = 0.5 m) */
export function zellige() {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#f3efe4'; g.fillRect(0, 0, w, h);
    const star = (cx, cy, r, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * 0.55 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    for (let y = 0; y <= h; y += 128) for (let x = 0; x <= w; x += 128) { star(x, y, 60, '#1f6f5c'); star(x, y, 30, '#f3efe4'); star(x, y, 18, '#c79a2b'); }
    for (let y = 64; y < h; y += 128) for (let x = 64; x < w; x += 128) { star(x, y, 40, '#264d8c'); star(x, y, 16, '#f3efe4'); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  });
}

/** sidewalk: Algiers grey/white square pavers (texture = 1.2 m) */
export function pavers() { seed = 3; return canvas(256, 256, (g, w, h) => { const n = 4, s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 170 + rnd() * 40 + ((x + y) % 2 ? 25 : 0); g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(x * s, y * s, s, s); } g.strokeStyle = 'rgba(40,40,40,.5)'; g.lineWidth = 3; for (let i = 0; i <= w; i += s) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } grain(g, w, h, 20); }); }
export function asphalt() { seed = 9; return canvas(256, 256, (g, w, h) => { g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, w, h); blotches(g, w, h, 30, 'rgba(20,20,22,0.25)', 40); grain(g, w, h, 30); }); }

const SIGNS = [['PHARMACIE', '#1b7f3b', '#fff'], ['مقهى', '#7a1f1f', '#f6e7c1'], ['Pâtisserie', '#f1e3c8', '#6a3b14'], ['Net Services', '#1d1d22', '#fff'], ['مخبزة', '#2b4f8a', '#fff'], ['Librairie', '#24323f', '#e8d48a'], ['BOUCHERIE', '#9d2a2a', '#fff'], ['مطعم', '#0f5b57', '#f8f0d8'], ['Optique', '#e9e9e9', '#1a3d6d'], ['ALGÉRIE POSTE', '#f2c200', '#0b3a75']];
export const SIGN_N = SIGNS.length;
export function sign(i) { const [t, bg, fg] = SIGNS[i % SIGNS.length]; return canvas(512, 96, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.globalAlpha = 0.5; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.globalAlpha = 1; g.fillStyle = fg; g.font = `bold ${/[a-z]/i.test(t) ? 54 : 60}px Tahoma, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2 + 3); }); }

/** small swatch for UI previews of the iron patterns */
export function ironPreview(kind, color = '#222', bg = 'transparent') { const src = iron(kind); return canvas(96, 48, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0, 256, 256, 0, 0, 48, 48); g.drawImage(src, 0, 0, 256, 256, 48, 0, 48, 48); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h); }).toDataURL(); }
