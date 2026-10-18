// Procedural tileable PBR generator, extracted verbatim from "Facade Bake Lab" (HD generator):
// seeded noise, 28 material presets (MATS), makeShader (albedo/roughness/height/AO) and makeNormals.
// Only the bake-free part is kept; js/pbr/library.js drives it over a flat tile.
/* eslint-disable */
  var clamp = function (x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return x < a ? a : x > b ? b : x; };
  var mix = function (a, b, t) { return a + (b - a) * t; };
  var sstep = function (a, b, x) { var t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  /* ---------- tileable noise ---------- */
  function hash(ix, iy, s) {
    var h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, f, s) {
    var X = x * f, Y = y * f, ix = Math.floor(X), iy = Math.floor(Y), fx = X - ix, fy = Y - iy;
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var x0 = ((ix % f) + f) % f, x1 = (x0 + 1) % f, y0 = ((iy % f) + f) % f, y1 = (y0 + 1) % f;
    var a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
    return mix(mix(a, b, sx), mix(c, d, sx), sy);
  }
  function fbm(x, y, f, o, s) {
    var sum = 0, amp = 0.5, norm = 0;
    for (var i = 0; i < o; i++) { sum += amp * vnoise(x, y, f, s + i * 17); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  }
  function rgb2hsv(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 1e-6) {
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h /= 6; if (h < 0) h += 1;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsv2rgb(h, s, v) {
    h = ((h % 1) + 1) % 1;
    var i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) { case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t]; case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q]; }
  }
  function hsvAdj(c, dh, ds, dv) { var a = rgb2hsv(c[0], c[1], c[2]); return hsv2rgb(a[0] + dh, clamp(a[1] + ds), clamp(a[2] + dv)); }
  function hex2rgb(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }

  /* ---------- materials (pattern + palette) ---------- */
  var MATS = {
    brick: { group: "Brick", label: "Brick", layout: "running", rows: 8, cols: 4, mortar: 0.006, bevel: 0.008, relief: 0.08, rough: 0.85, A: [0.48, 0.17, 0.12], B: [0.7, 0.33, 0.21], M: [0.6, 0.57, 0.52] },
    smallbrick: { group: "Brick", label: "Small brick", layout: "running", rows: 20, cols: 10, mortar: 0.003, bevel: 0.004, relief: 0.05, rough: 0.85, A: [0.4, 0.14, 0.1], B: [0.62, 0.28, 0.18], M: [0.58, 0.55, 0.5] },
    clinker: { group: "Brick", label: "Clinker brick", layout: "running", rows: 12, cols: 5, mortar: 0.004, bevel: 0.006, relief: 0.12, rough: 0.7, A: [0.26, 0.1, 0.09], B: [0.42, 0.2, 0.17], M: [0.5, 0.47, 0.43] },
    whitebrick: { group: "Brick", label: "Whitewashed brick", layout: "running", rows: 10, cols: 5, mortar: 0.005, bevel: 0.008, relief: 0.1, rough: 0.85, A: [0.8, 0.78, 0.72], B: [0.92, 0.9, 0.85], M: [0.62, 0.6, 0.55] },
    ashlar: { group: "Stone", label: "Ashlar stone", layout: "ashlar", rows: 6, cols: 3, mortar: 0.004, bevel: 0.006, relief: 0.05, rough: 0.8, A: [0.74, 0.64, 0.48], B: [0.88, 0.79, 0.64], M: [0.54, 0.5, 0.44] },
    limestone: { group: "Stone", label: "Limestone blocks", layout: "ashlar", rows: 5, cols: 3, mortar: 0.003, bevel: 0.005, relief: 0.1, rough: 0.85, A: [0.8, 0.76, 0.66], B: [0.9, 0.87, 0.78], M: [0.55, 0.52, 0.46] },
    sandstone: { group: "Stone", label: "Sandstone rough", layout: "ashlar", rows: 6, cols: 3, mortar: 0.005, bevel: 0.02, relief: 0.45, rough: 0.95, A: [0.62, 0.45, 0.28], B: [0.78, 0.6, 0.4], M: [0.35, 0.27, 0.2] },
    granite: { group: "Stone", label: "Granite blocks", layout: "ashlar", rows: 6, cols: 3, mortar: 0.004, bevel: 0.008, relief: 0.15, rough: 0.55, A: [0.36, 0.36, 0.38], B: [0.56, 0.56, 0.58], M: [0.14, 0.14, 0.15] },
    rough: { group: "Stone", label: "Rough stone", layout: "ashlar", rows: 5, cols: 3, mortar: 0.006, bevel: 0.03, relief: 0.8, rough: 0.9, A: [0.3, 0.3, 0.31], B: [0.5, 0.5, 0.5], M: [0.12, 0.12, 0.12] },
    cornice: { group: "Stone", label: "Cornice molding", layout: "bands", rows: 2, cols: 1, mortar: 0.004, bevel: 0.006, relief: 0.05, rough: 0.8, A: [0.74, 0.64, 0.48], B: [0.86, 0.76, 0.6], M: [0.54, 0.5, 0.44] },
    cobble: { group: "Ground", label: "Cobblestones", layout: "cells", rows: 1, cols: 7, mortar: 0.008, bevel: 0.012, relief: 0.3, rough: 0.85, A: [0.34, 0.33, 0.32], B: [0.55, 0.53, 0.5], M: [0.12, 0.11, 0.1] },
    flagstone: { group: "Ground", label: "Flagstones", layout: "cells", rows: 1, cols: 4, mortar: 0.006, bevel: 0.008, relief: 0.15, rough: 0.8, A: [0.45, 0.43, 0.4], B: [0.62, 0.6, 0.55], M: [0.15, 0.14, 0.12] },
    mud: { group: "Ground", label: "Dry cracked earth", layout: "cells", rows: 1, cols: 6, mortar: 0.012, bevel: 0.012, relief: 0.35, rough: 1, A: [0.5, 0.38, 0.25], B: [0.68, 0.54, 0.38], M: [0.14, 0.1, 0.07] },
    asphalt: { group: "Ground", label: "Asphalt", layout: "none", rows: 4, cols: 2, mortar: 0.004, bevel: 0.006, relief: 0.45, rough: 0.92, A: [0.1, 0.1, 0.11], B: [0.2, 0.2, 0.21], M: [0.1, 0.1, 0.11] },
    oak: { group: "Wood", label: "Oak planks", layout: "running", rows: 10, cols: 2, mortar: 0.003, bevel: 0.005, relief: 0.08, rough: 0.6, A: [0.4, 0.25, 0.13], B: [0.62, 0.42, 0.23], M: [0.06, 0.04, 0.025], aniso: true },
    darkoak: { group: "Wood", label: "Dark walnut floor", layout: "running", rows: 12, cols: 3, mortar: 0.003, bevel: 0.005, relief: 0.06, rough: 0.45, A: [0.24, 0.13, 0.07], B: [0.4, 0.24, 0.13], M: [0.04, 0.025, 0.018], aniso: true },
    fence: { group: "Wood", label: "Weathered boards", layout: "running", rows: 8, cols: 2, mortar: 0.004, bevel: 0.006, relief: 0.15, rough: 0.9, A: [0.34, 0.3, 0.26], B: [0.55, 0.5, 0.44], M: [0.05, 0.045, 0.04], aniso: true, rot: true },
    galv: { group: "Metal", label: "Galvanized sheet", layout: "corrug", rows: 1, cols: 10, mortar: 0.004, bevel: 0.006, relief: 0.05, rough: 0.4, A: [0.58, 0.6, 0.63], B: [0.72, 0.74, 0.77], M: [0.58, 0.6, 0.63] },
    rustmetal: { group: "Metal", label: "Rusty corrugated", layout: "corrug", rows: 1, cols: 10, mortar: 0.004, bevel: 0.006, relief: 0.1, rough: 0.75, A: [0.4, 0.18, 0.08], B: [0.58, 0.3, 0.14], M: [0.4, 0.18, 0.08] },
    ceramic: { group: "Tile & plaster", label: "Ceramic tile", layout: "tiles", rows: 8, cols: 8, mortar: 0.005, bevel: 0.012, relief: 0.02, rough: 0.25, A: [0.85, 0.84, 0.8], B: [0.93, 0.92, 0.88], M: [0.5, 0.48, 0.45] },
    terracotta: { group: "Tile & plaster", label: "Terracotta tile", layout: "tiles", rows: 6, cols: 6, mortar: 0.006, bevel: 0.01, relief: 0.1, rough: 0.7, A: [0.6, 0.28, 0.15], B: [0.78, 0.42, 0.24], M: [0.4, 0.36, 0.3] },
    mosaic: { group: "Tile & plaster", label: "Blue mosaic", layout: "tiles", rows: 16, cols: 16, mortar: 0.004, bevel: 0.008, relief: 0.04, rough: 0.2, A: [0.05, 0.22, 0.45], B: [0.2, 0.55, 0.72], M: [0.6, 0.58, 0.55] },
    marble: { group: "Tile & plaster", label: "Marble tiles", layout: "tiles", rows: 4, cols: 4, mortar: 0.002, bevel: 0.004, relief: 0.02, rough: 0.18, A: [0.88, 0.88, 0.86], B: [0.97, 0.97, 0.95], M: [0.5, 0.5, 0.48], veins: true },
    concrete: { group: "Tile & plaster", label: "Concrete panels", layout: "panels", rows: 3, cols: 2, mortar: 0.0015, bevel: 0.003, relief: 0.12, rough: 0.8, A: [0.46, 0.46, 0.45], B: [0.6, 0.6, 0.58], M: [0.25, 0.25, 0.25] },
    plaster: { group: "Tile & plaster", label: "Plaster", layout: "none", rows: 4, cols: 2, mortar: 0.004, bevel: 0.006, relief: 0.2, rough: 0.9, A: [0.7, 0.58, 0.42], B: [0.82, 0.7, 0.52], M: [0.7, 0.58, 0.42] },
    stucco: { group: "Tile & plaster", label: "White stucco", layout: "none", rows: 4, cols: 2, mortar: 0.004, bevel: 0.006, relief: 0.25, rough: 0.9, A: [0.86, 0.84, 0.8], B: [0.94, 0.92, 0.88], M: [0.86, 0.84, 0.8] },
    slate: { group: "Roof", label: "Slate roof", layout: "shingles", rows: 8, cols: 8, mortar: 0.002, bevel: 0.004, relief: 0.25, rough: 0.6, A: [0.14, 0.16, 0.2], B: [0.3, 0.32, 0.36], M: [0.04, 0.04, 0.05] },
    clayroof: { group: "Roof", label: "Clay roof tile", layout: "shingles", rows: 8, cols: 6, mortar: 0.004, bevel: 0.006, relief: 0.2, rough: 0.7, A: [0.58, 0.25, 0.13], B: [0.78, 0.4, 0.2], M: [0.1, 0.05, 0.03] },
    woodshingle: { group: "Roof", label: "Wood shingles", layout: "shingles", rows: 10, cols: 8, mortar: 0.003, bevel: 0.005, relief: 0.2, rough: 0.85, A: [0.36, 0.26, 0.16], B: [0.55, 0.4, 0.25], M: [0.04, 0.03, 0.02], aniso: true }
  };
  function matP(n) { var m = MATS[n]; return { mat: n, rows: m.rows, cols: m.cols, mortar: m.mortar, bevel: m.bevel, relief: m.relief, rough: m.rough }; }
  var STREAK = [[0.42, 0.17, 0.04], [0.22, 0.3, 0.08], [0.9, 0.9, 0.85]];

  function vnoise2(x, y, fx, fy, s) {
    var X = x * fx, Y = y * fy, ix = Math.floor(X), iy = Math.floor(Y), tx = X - ix, ty = Y - iy;
    var sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    var x0 = ((ix % fx) + fx) % fx, x1 = (x0 + 1) % fx, y0 = ((iy % fy) + fy) % fy, y1 = (y0 + 1) % fy;
    return mix(mix(hash(x0, y0, s), hash(x1, y0, s), sx), mix(hash(x0, y1, s), hash(x1, y1, s), sx), sy);
  }
  function worleyEdge(u, v, f, s) {
    var X = u * f, Y = v * f, ix = Math.floor(X), iy = Math.floor(Y), fx = X - ix, fy = Y - iy, d1 = 9, d2 = 9;
    for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
      var cx = (((ix + i) % f) + f) % f, cy = (((iy + j) % f) + f) % f;
      var dx = i + hash(cx, cy, s) - fx, dy = j + hash(cx, cy, s + 31) - fy, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
    }
    return d2 - d1;
  }
  var WC = { edge: 0, id: 0 };
  function worleyCell(u, v, f, s) {
    var X = u * f, Y = v * f, ix = Math.floor(X), iy = Math.floor(Y), fx = X - ix, fy = Y - iy, d1 = 9, bid = 0, p1x = 0, p1y = 0, i, j, cx, cy, qx, qy, dd;
    for (j = -2; j <= 2; j++) for (i = -2; i <= 2; i++) {
      cx = (((ix + i) % f) + f) % f; cy = (((iy + j) % f) + f) % f; qx = i + hash(cx, cy, s); qy = j + hash(cx, cy, s + 31);
      dd = (qx - fx) * (qx - fx) + (qy - fy) * (qy - fy);
      if (dd < d1) { d1 = dd; p1x = qx; p1y = qy; bid = hash(cx, cy, s + 57); }
    }
    var best = 9;
    for (j = -2; j <= 2; j++) for (i = -2; i <= 2; i++) {
      cx = (((ix + i) % f) + f) % f; cy = (((iy + j) % f) + f) % f; qx = i + hash(cx, cy, s); qy = j + hash(cx, cy, s + 31);
      var ex = qx - p1x, ey = qy - p1y, el = Math.sqrt(ex * ex + ey * ey); if (el < 1e-6) continue;
      var t = (((p1x + qx) * 0.5 - fx) * ex + ((p1y + qy) * 0.5 - fy) * ey) / el; if (t < best) best = t;
    }
    WC.edge = best / f; WC.id = bid;
  }
  function rowEdges(R, n, vari, s) {
    var E = [];
    for (var r = 0; r < R; r++) {
      var w = [], sum = 0, k;
      for (k = 0; k < n; k++) { var x = 1 - vari / 2 + hash(k, r, s + 200) * vari; w.push(x); sum += x; }
      var e = [0], acc = 0;
      for (k = 0; k < n; k++) { acc += w[k] / sum; e.push(acc); }
      E.push({ e: e, o: hash(r, 7, s + 201) });
    }
    return E;
  }

  /* ---------- parameters ---------- */
  var DEFAULTS = Object.assign({
    shape: "box", W: 2, H: 2.4, D: 2, bakeRes: 512, rays: 20, aoDist: 1.2,
    seed: 7, micro: 0.5, wet: 0, bevel3d: 0.012, sky: "sunny", exposure: 1, reflect: 1, aoSmooth: 1, nSmooth: 1, rotSpeed: 1, camSmooth: 0.7, live: true, tile: 1.6, variation: 0.6, grain: 0.6, aoStr: 0.8, nStr: 1,
    cavity: 0.6, gravity: 0.45, edgeWear: 0.55, edgeW: 0.07, topType: 0, topAmt: 0.5,
    sunOn: true, sunAmt: 0.5, sunScale: 3,
    moldOn: true, moldCover: 0.3, moldScale: 6, moldSoft: 0.14,
    effOn: true, effCover: 0.25, effScale: 8, effSoft: 0.14,
    crackOn: false, crackAmt: 0.5, crackScale: 5,
    spOn: true, spCover: 0.18, spScale: 6, spSoft: 0.08, spDepth: 0.4,
    streakOn: false, streakCover: 0.35, streakType: 0
  }, matP("brick"));
  var TOPC = [null, [0.6, 0.53, 0.4], [0.17, 0.28, 0.06], [0.94, 0.95, 0.98]];
  function makeShader(K, S) {
    var MT = MATS[S.mat] || MATS.brick, lay = MT.layout, A = MT.A, B = MT.B, Mc = MT.M, s = S.seed | 0;
    var R = Math.max(1, S.rows | 0), C = Math.max(1, S.cols | 0); if (lay === "running" && (R & 1)) R++;
    var tilePx = Math.max(8, K.dens * S.tile), mw = Math.max(S.mortar, 1.2 / tilePx), bv = Math.max(S.bevel, 2 / tilePx);
    var edges = lay === "ashlar" ? rowEdges(R, C, 0.9, s) : lay === "shingles" ? rowEdges(R, C, 0.3, s) : null;
    var sunS = Math.round(S.sunScale), moldS = Math.round(S.moldScale), effS = Math.round(S.effScale), spS = Math.round(S.spScale), cS = Math.max(2, Math.round(S.crackScale));
    var skC = STREAK[S.streakType | 0] || STREAK[0], topC = TOPC[S.topType | 0], res = K.res, mfreq = Math.max(32, Math.min(512, Math.round(tilePx * 0.7)));
    var out = { alb: new Float32Array(res * res * 3), rgh: new Float32Array(res * res), hgt: new Float32Array(res * res), ao: new Float32Array(res * res), edge: new Float32Array(res * res) };
    function range(a, b2) {
      for (var i = a; i < b2; i++) {
        if (!K.valid[i]) { out.alb[i * 3] = out.alb[i * 3 + 1] = out.alb[i * 3 + 2] = 0.25; out.rgh[i] = 0.9; out.hgt[i] = 0.3; out.ao[i] = 1; out.edge[i] = 0; continue; }
        var ppx = K.pat[i * 2] / S.tile, ppy = K.pat[i * 2 + 1] / S.tile, u = ppx - Math.floor(ppx), v = ppy - Math.floor(ppy);
        if (MT.rot) { var tq = u; u = v; v = tq; }
        var row = Math.floor(v * R), lv = v * R - row, odd = row & 1, d = 1, id = 0.5, id2 = 0.5, hole = 0;
        if (lay === "running") {
          var u2 = u * C + (odd ? 0.5 : 0), bI = Math.floor(u2), lu = u2 - bI, bc = ((bI % C) + C) % C;
          d = Math.min(Math.min(lu, 1 - lu) / C, Math.min(lv, 1 - lv) / R); id = hash(bc, row, s); id2 = hash(bc, row, s + 99);
        } else if (lay === "panels" || lay === "tiles") {
          var pu = u * C, pI = Math.floor(pu), pl = pu - pI, pc = ((pI % C) + C) % C;
          d = Math.min(Math.min(pl, 1 - pl) / C, Math.min(lv, 1 - lv) / R); id = hash(pc, row, s); id2 = hash(pc, row, s + 99);
          var hx = Math.abs(pl - 0.5) > 0.36 ? (pl < 0.5 ? 0.12 : 0.88) : -1, hy = Math.abs(lv - 0.5) > 0.3 ? (lv < 0.5 ? 0.14 : 0.86) : -1;
          if (lay === "panels" && hx >= 0 && hy >= 0) { var hd = Math.sqrt(((pl - hx) / C) * ((pl - hx) / C) + ((lv - hy) / R) * ((lv - hy) / R)); hole = 1 - sstep(0.0035, 0.0055, hd); }
        } else if (lay === "ashlar" || lay === "shingles") {
          var E = edges[row], uu = u - E.o; uu -= Math.floor(uu);
          var ei = 0, ee = E.e; while (ei < ee.length - 2 && uu >= ee[ei + 1]) ei++;
          var du = Math.min(uu - ee[ei], ee[ei + 1] - uu);
          d = lay === "ashlar" ? Math.min(du, Math.min(lv, 1 - lv) / R) : Math.min(du, (1 - lv) / R);
          id = hash(ei, row, s); id2 = hash(ei, row, s + 99);
        } else if (lay === "cells") {
          worleyCell(u, v, Math.max(2, C), s + 300); d = WC.edge; id = WC.id; id2 = hash(Math.floor(WC.id * 1000), 3, s);
        } else if (lay === "corrug") {
          id = hash(Math.floor(u * Math.max(1, C / 3)), 0, s); id2 = hash(Math.floor(u * C), 1, s);
        } else { id = fbm(u, v, 3, 2, s + 5); id2 = fbm(u, v, 5, 2, s + 6); }
        var bm = sstep(mw, mw + bv, d), g = fbm(u, v, 24, 4, s + 1), g2 = fbm(u, v, 64, 2, s + 2);
        if (MT.aniso) { g = vnoise2(u, v, 4, 40, s + 1) * 0.6 + vnoise2(u, v, 8, 90, s + 4) * 0.4; g2 = vnoise2(u, v, 12, 120, s + 2); }
        var t = clamp(id * S.variation + (1 - S.variation) * 0.5), val = 1 + (id2 - 0.5) * S.variation * 0.5, gf = 1 + (g - 0.5) * S.grain * 1.1;
        var br = mix(A[0], B[0], t) * val * gf, bg = mix(A[1], B[1], t) * val * gf, bb = mix(A[2], B[2], t) * val * gf, mf = 1 + (g2 - 0.5) * 0.6;
        var cr = mix(Mc[0] * mf, br, bm), cg = mix(Mc[1] * mf, bg, bm), cb = mix(Mc[2] * mf, bb, bm), baseC = [br, bg, bb];
        if (MT.veins) { var vn = Math.abs(fbm(u, v, 3, 5, s + 7) - 0.5) * 2, vm = (1 - sstep(0, 0.07, vn)) * bm; cr = mix(cr, 0.42, vm * 0.55); cg = mix(cg, 0.42, vm * 0.55); cb = mix(cb, 0.45, vm * 0.55); }
        var rel = S.relief * ((fbm(u, v, 10, 4, s + 3) - 0.5) * 1.2 + 0.4 * sstep(mw, mw + 0.03, d)), hb = 0.62 + (g - 0.5) * 0.5 * S.grain + rel;
        if (lay === "cells") hb = 0.4 + 0.45 * Math.sqrt(clamp(d * Math.max(2, C) * 2.5)) + (g - 0.5) * 0.4 * S.grain + rel * 0.5;
        if (lay === "corrug") hb = 0.5 + 0.35 * Math.sin(6.2831853 * u * C) + (g - 0.5) * 0.1 * S.grain;
        if (lay === "shingles") hb = 0.45 + 0.4 * lv + (g - 0.5) * 0.3 * S.grain + rel * 0.5;
        if (lay === "bands") hb = 0.3 + 0.4 * (sstep(0.1, 0.16, lv) - sstep(0.3, 0.36, lv)) + 0.25 * (sstep(0.55, 0.62, lv) - sstep(0.7, 0.76, lv)) + 0.15 * sstep(0.8, 0.95, lv) + (g - 0.5) * 0.15 * S.grain + rel * 0.3;
        var h = mix(0.12 + (g2 - 0.5) * 0.12, hb, bm), a = (0.55 + 0.45 * sstep(0, mw + bv * 1.5, d)) * (0.92 + 0.16 * g2);
        if (lay === "shingles") a *= 0.55 + 0.45 * sstep(0, 0.3, lv);
        if (lay === "bands") a = 0.65 + 0.35 * clamp(hb * 1.2);
        if (lay === "corrug") a = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(6.2831853 * u * C));
        if (hole > 0.002) { h -= 0.35 * hole; a *= 1 - 0.7 * hole; cr *= 1 - 0.8 * hole; cg *= 1 - 0.8 * hole; cb *= 1 - 0.8 * hole; }
        var rg = mix(0.95, S.rough, bm) + (g - 0.5) * 0.2 * S.grain, k = mix(1, a, S.aoStr); cr *= k; cg *= k; cb *= k;

        var aoM = K.ao[i], cav = 1 - aoM, ed = K.edge[i], ny = K.nrm[i * 3 + 1], wy = clamp((K.pos[i * 3 + 1] - K.minY) / K.hY), moist = (1 - wy) * (1 - wy) * S.gravity;
        var grime = clamp(Math.pow(cav, 1.3) * S.cavity * 1.4);
        if (grime > 0.002) { cr = mix(cr, cr * 0.3 + 0.02, grime * 0.8); cg = mix(cg, cg * 0.3 + 0.018, grime * 0.8); cb = mix(cb, cb * 0.3 + 0.015, grime * 0.8); rg = mix(rg, 0.95, grime); }
        if (S.sunOn) {
          var m = sstep(0.38, 0.7, fbm(u, v, sunS, 3, s + 10)) * S.sunAmt * (0.6 + 0.8 * wy);
          if (m > 0.002) { var q = hsvAdj([cr, cg, cb], 0.015 * m, -0.35 * m, 0.22 * m); cr = q[0]; cg = q[1]; cb = q[2]; }
        }
        if (S.moldOn) {
          var n = 0.65 * fbm(u, v, moldS, 4, s + 20) + 0.35 * (1 - h) + moist * 0.3 + cav * S.cavity * 0.25, thr = 0.72 - S.moldCover * 0.5, mk = sstep(thr, thr + S.moldSoft, n);
          if (mk > 0.002) { var kk = mk * 0.88; cr = cr * (1 - kk) + 0.025 * kk; cg = cg * (1 - kk) + 0.034 * kk; cb = cb * (1 - kk) + 0.024 * kk; rg = mix(rg, 0.9, mk * 0.6); h += mk * 0.01; }
        }
        if (S.effOn) {
          var n2 = 0.6 * fbm(u, v, effS, 4, s + 30) + 0.4 * (1 - bm) + moist * 0.2, thr2 = 0.78 - S.effCover * 0.5, ek = sstep(thr2, thr2 + S.effSoft, n2);
          if (ek > 0.002) { var am = ek * 0.8; cr = 1 - (1 - cr) * (1 - am * 0.96); cg = 1 - (1 - cg) * (1 - am * 0.96); cb = 1 - (1 - cb) * (1 - am * 0.92); rg = mix(rg, 0.97, ek); h += 0.03 * ek; }
        }
        if (S.crackOn) {
          var gate = sstep(0.7 - S.crackAmt * 0.4, 0.8 - S.crackAmt * 0.4, fbm(u, v, 3, 3, s + 61));
          if (gate > 0.002) {
            var ew = worleyEdge(u, v, cS, s + 60) + (fbm(u, v, 40, 2, s + 62) - 0.5) * 0.07, cm = (1 - sstep(0, 0.05, ew)) * gate;
            if (cm > 0.002) { cr *= 1 - 0.85 * cm; cg *= 1 - 0.85 * cm; cb *= 1 - 0.85 * cm; h -= 0.18 * cm; rg = mix(rg, 1, cm); a *= 1 - 0.6 * cm; }
          }
        }
        var sm = 0;
        if (S.spOn) {
          var n3 = fbm(u, v, spS, 5, s + 40), thr3 = 0.8 - S.spCover * 0.5; sm = sstep(thr3, thr3 + S.spSoft, n3) * bm;
          if (sm > 0.002) {
            var raw = hsvAdj(baseC, 0.012, 0.04, 0.06), rf = 0.9 * (0.85 + 0.3 * g2);
            cr = mix(cr, raw[0] * rf, sm); cg = mix(cg, raw[1] * rf, sm); cb = mix(cb, raw[2] * rf, sm); h -= sm * S.spDepth * 0.45; rg = mix(rg, 0.96, sm); a *= 1 - 0.25 * sm;
          }
        }
        if (S.streakOn) {
          var sv = vnoise2(u, v, 24, 2, s + 70) * 0.65 + vnoise2(u, v, 48, 3, s + 71) * 0.35, sgate = fbm(u, v, 3, 3, s + 72);
          var sk = sstep(0.9 - S.streakCover * 0.55, 1.05 - S.streakCover * 0.55, 0.55 * sv + 0.5 * sgate) * (0.6 + 0.4 * vnoise2(u, v, 24, 6, s + 73));
          if (sk > 0.002) { var sf = 0.7 + 0.5 * g2, sa = sk * 0.85; cr = mix(cr, skC[0] * sf, sa); cg = mix(cg, skC[1] * sf, sa); cb = mix(cb, skC[2] * sf, sa); rg = mix(rg, 0.85, sk); h += 0.008 * sk; }
        }
        if (S.edgeWear > 0.001) {
          var wm = 1 - sstep(0.15 * S.edgeW, S.edgeW, ed);
          if (wm > 0.002) {
            wm *= clamp(S.edgeWear * (0.5 + 1.4 * fbm(u, v, 24, 3, s + 80)));
            if (wm > 0.002) { var xr = hsvAdj(baseC, 0.01, -0.12, 0.18); cr = mix(cr, xr[0], wm); cg = mix(cg, xr[1], wm); cb = mix(cb, xr[2], wm); h -= 0.14 * wm; rg = mix(rg, 0.95, wm); a *= 1 - 0.2 * wm; }
          }
        }
        if (topC && S.topAmt > 0.001) {
          var tn = sstep(0.45, 0.85, ny);
          if (tn > 0.002) {
            var tvv = tn * (0.45 + 1.1 * fbm(u, v, 10, 4, s + 90)), tm = sstep(1.25 - S.topAmt, 1.4 - S.topAmt, tvv) * 0.95;
            if (tm > 0.002) {
              var tf = S.topType === 2 ? 0.7 + 0.6 * g2 : 1, ty = S.topType;
              cr = mix(cr, topC[0] * tf, tm); cg = mix(cg, topC[1] * tf, tm); cb = mix(cb, topC[2] * tf, tm);
              rg = mix(rg, ty === 3 ? 0.65 : ty === 2 ? 0.85 : 0.95, tm); h += tm * (ty === 3 ? 0.07 : ty === 2 ? 0.03 : 0.015);
            }
          }
        }
        if (S.micro > 0.001) {
          var mn = fbm(u, v, mfreq, 2, s + 5) - 0.5, cj = vnoise(u, v, mfreq >> 1, s + 8) - 0.5;
          cr *= 1 + mn * 0.28 * S.micro + cj * 0.06 * S.micro; cg *= 1 + mn * 0.28 * S.micro; cb *= 1 + mn * 0.28 * S.micro - cj * 0.06 * S.micro;
          h += mn * 0.03 * S.micro; rg += mn * 0.18 * S.micro;
        }
        if (S.wet > 0.001) {
          var wt = clamp(S.wet * (0.45 + 0.9 * (moist + cav * 0.6)));
          cr *= 1 - 0.38 * wt; cg *= 1 - 0.38 * wt; cb *= 1 - 0.38 * wt; rg = mix(rg, 0.1, wt * 0.85);
        }
        out.alb[i * 3] = clamp(cr); out.alb[i * 3 + 1] = clamp(cg); out.alb[i * 3 + 2] = clamp(cb);
        out.rgh[i] = clamp(rg); out.hgt[i] = clamp(h); out.ao[i] = clamp(aoM * mix(1, a, 0.6)); out.edge[i] = 1 - sstep(0, S.edgeW * 1.5, ed);
      }
    }
    return { out: out, range: range };
  }
  function blurHeight(K, h, passes) {
    var R = K.res;
    for (var p = 0; p < passes; p++) {
      var o = new Float32Array(h.length);
      for (var y = 0; y < R; y++) for (var x = 0; x < R; x++) {
        var i = y * R + x; if (!K.valid[i]) { o[i] = h[i]; continue; }
        var sum = 0, w = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= R || yy >= R) continue;
          var j = yy * R + xx; if (!K.valid[j]) continue; var wt = dx === 0 && dy === 0 ? 2 : 1; sum += h[j] * wt; w += wt;
        }
        o[i] = sum / w;
      }
      h = o;
    }
    return h;
  }
  function makeNormals(K, hgt, S, step) {
    step = step || 1; var R = K.res, AR = K.atlasRes || R, nrm = new Float32Array(R * R * 3), depth = 0.03 * S.nStr;
    if (S.nSmooth > 0) hgt = blurHeight(K, hgt, S.nSmooth | 0);
    for (var y = 0; y < R; y++) for (var x = 0; x < R; x++) {
      var i = y * R + x;
      if (!K.valid[i]) { nrm[i * 3 + 2] = 1; continue; }
      var h0 = hgt[i], xl = x - step, xr = x + step, yu = y - step, yd = y + step;
      var hl = xl >= 0 && K.valid[i - step] ? hgt[i - step] : h0, hr = xr < R && K.valid[i + step] ? hgt[i + step] : h0;
      var hu = yu >= 0 && K.valid[i - step * R] ? hgt[i - step * R] : h0, hd = yd < R && K.valid[i + step * R] ? hgt[i + step * R] : h0;
      var ku = AR * K.ruv[i * 2] * 0.5 * depth / step, kv = AR * K.ruv[i * 2 + 1] * 0.5 * depth / step;
      var nx = -(hr - hl) * ku, ny = -(hu - hd) * kv, l = Math.sqrt(nx * nx + ny * ny + 1);
      nx /= l; ny /= l; var nz = 1 / l;
      if (S.bevel3d > 0 && K.edge) {
        var ed = K.edge[i], tu = 1 / (AR * K.ruv[i * 2]), tv = 1 / (AR * K.ruv[i * 2 + 1]), wb = Math.max(S.bevel3d, 2.5 * Math.max(tu, tv));
        if (ed < wb) {
          var e0 = ed, el = x > 0 && K.valid[i - 1] ? K.edge[i - 1] : e0, er = x < R - 1 && K.valid[i + 1] ? K.edge[i + 1] : e0, eu = y > 0 && K.valid[i - R] ? K.edge[i - R] : e0, edn = y < R - 1 && K.valid[i + R] ? K.edge[i + R] : e0;
          var gx = (er - el) / (2 * tu), gy = (eu - edn) / (2 * tv), gl = Math.sqrt(gx * gx + gy * gy);
          if (gl > 1e-6) {
            var tt = 1 - ed / wb, th = tt * tt * (3 - 2 * tt) * 0.9, sn = Math.sin(th);
            nx += -gx / gl * sn; ny += -gy / gl * sn; nz *= Math.cos(th);
            var l2 = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= l2; ny /= l2; nz /= l2;
          }
        }
      }
      nrm[i * 3] = nx; nrm[i * 3 + 1] = ny; nrm[i * 3 + 2] = nz;
    }
    return nrm;
  }

export { MATS, DEFAULTS, makeShader, makeNormals, matP };
