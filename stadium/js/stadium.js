import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLoop, frameAt, offsetPoint, sweep, rowSampler, tubes } from './geom.js';

// Bowl plan: superellipse around a 105 x 68 m pitch; outer footprint ≈ 236 x 202 m.
export const PLAN = { a: 62, b: 45, n: 4 };

const roofH = (d) => 44.6 + (d - 12) * (3.4 / 45);

const TIERS = [
  { name: 'Lower', d0: 0, frontBottom: 0, hFront: 1.3, rows: 22, depth: 0.8, riser: 0.33, inc: 0.004, flat: 3, backBottom: 0,
    aisles: 40, seat: 'seatBlue', portals: { count: 10, r0: 8, r1: 14, width: 3.2 } },
  { name: 'Middle', d0: 18.5, frontBottom: 12.2, hFront: 14.6, rows: 14, depth: 0.85, riser: 0.45, inc: 0.01, flat: 2, backBottom: 18,
    aisles: 44, seat: 'seatNavy', portals: { count: 11, r0: 8, r1: 13, width: 3 }, fascia: true },
  { name: 'Upper', d0: 29.5, frontBottom: 24.5, hFront: 27, rows: 20, depth: 0.85, riser: 0.55, inc: 0.012, flat: 1.5, backBottom: 35,
    aisles: 52, seat: 'seatBlue', portals: { count: 13, r0: 7, r1: 12, width: 3 }, fascia: true },
];

const SEAT_SECTORS = 12;

export function seatGeometry() {
  const parts = [];
  const box = (w, h, d, x, y, z, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    parts.push(g);
  };
  box(0.1, 0.36, 0.1, 0, 0.18, -0.05);
  box(0.46, 0.06, 0.42, 0, 0.4, 0.04);
  box(0.46, 0.44, 0.05, 0, 0.66, -0.17, -0.18);
  return mergeGeometries(parts);
}

function tierProfile(t) {
  const p = [[t.d0, t.frontBottom], [t.d0, t.hFront]];
  const rows = [];
  let d = t.d0, h = t.hFront;
  for (let r = 0; r < t.rows; r++) {
    rows.push({ d, h, depth: t.depth });
    p.push([d + t.depth, h]);
    d += t.depth;
    h += t.riser + r * t.inc;
    p.push([d, h]);
  }
  p.push([d + t.flat, h], [d + t.flat, t.backBottom]);
  return { profile: p, rows, dEnd: d + t.flat, hTop: h };
}

export function buildStadium(M) {
  const loop = makeLoop(PLAN.a, PLAN.b, PLAN.n, 384);
  const dense = makeLoop(PLAN.a, PLAN.b, PLAN.n, 4096);
  const explode = [];
  const stats = { seats: 0 };

  const group = (parent, name, level) => {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    if (level !== undefined) explode.push({ obj: g, level });
    return g;
  };
  const mesh = (parent, geo, mat, name, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  };
  const inst = (parent, geo, mat, matrices, name, { cast = true, receive = true } = {}) => {
    const m = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.computeBoundingSphere();
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  };
  // Matrix for an object oriented to the bowl at base fraction f, offset d, height h.
  const frameMatrix = (f, d, h, extra) => {
    const fr = frameAt(dense, f);
    const m = new THREE.Matrix4().makeRotationY(fr.yaw);
    m.setPosition(fr.x + fr.nx * d, h, fr.z + fr.nz * d);
    if (extra) m.multiply(extra);
    return m;
  };

  const root = new THREE.Group();
  root.name = 'Stadium';
  const gStructure = group(root, '01_Structure');
  const gBowlRoot = group(root, '02_Bowl');
  const gSeatsRoot = group(root, '03_Seats');
  const gRoofRoot = group(root, '04_Roof');
  const gAssets = group(root, '05_Assets');

  const gFoundation = group(gStructure, 'Foundation', 0);
  const gFrame = group(gStructure, 'Columns_Facade', 2);
  const gRing = group(gStructure, 'Ring_Beam', 3);
  const gBowl = group(gBowlRoot, 'Tiers', 1);
  const gSeats = group(gSeatsRoot, 'Seat_Arrays', 1);
  const gTruss = group(gRoofRoot, 'Roof_Truss', 4);
  const gPanels = group(gRoofRoot, 'Roof_Panels', 5);
  const gHung = group(gAssets, 'Hung_Screens', 4);

  // ---------- 1. Foundation & site ----------
  mesh(gFoundation, sweep(loop, [[50, 0], [50, 0.9], [58, 0.9], [58, 0.6], [59, 0.6], [59, 0.3], [60, 0.3], [60, 0]], { uTile: 6, vTile: 4 }),
    M.concrete, 'Podium_Steps');

  // ---------- 2. Bowl: tiers, concourse cores ----------
  const tiers = TIERS.map((t) => ({ ...t, ...tierProfile(t) }));
  tiers.forEach((t) => mesh(gBowl, sweep(loop, t.profile, { uTile: 6, vTile: 4 }), M.concreteTier, `Tier_${t.name}`));
  mesh(gBowl, sweep(loop, [[20.6, 0], [20.6, 10.5], [53, 10.5], [53, 0]], { uTile: 6, vTile: 4 }), M.concrete, 'Core_Concourse_L0');
  mesh(gBowl, sweep(loop, [[32.4, 10.5], [32.4, 35], [53, 35], [53, 10.5]], { uTile: 6, vTile: 4 }), M.concrete, 'Core_Concourse_L1');
  mesh(gFrame, sweep(loop, [[53.06, 9.8], [53.06, 0.9]], { closed: false, uTile: 6, vTile: 8.9 }), M.glazing, 'Glazing_Ground');
  mesh(gFrame, sweep(loop, [[53.06, 34.4], [53.06, 11.2]], { closed: false, uTile: 6, vTile: 7.7 }), M.glazing, 'Glazing_Upper');
  [11, 22.5, 34.8].forEach((h, i) =>
    mesh(gFrame, sweep(loop, [[53, h - 0.3], [53, h + 0.3], [55.2, h + 0.3], [55.2, h - 0.3]], { uTile: 6, vTile: 4 }), M.paintedSteel, `Facade_Band_${i}`));

  // Front railings: glass balustrade + steel handrail on every tier front.
  tiers.forEach((t) => {
    const d = t.d0 - 0.03, h0 = t.hFront, h1 = t.hFront + 1.0;
    mesh(gBowl, sweep(loop, [[d, h1], [d, h0]], { closed: false }), M.glass, `Balustrade_${t.name}`, { cast: false });
    mesh(gBowl, sweep(loop, [[d - 0.04, h1], [d - 0.04, h1 + 0.07], [d + 0.04, h1 + 0.07], [d + 0.04, h1]]), M.steel, `Handrail_${t.name}`, { cast: false });
    if (t.fascia) {
      const fb = t.frontBottom + 0.25, ft = t.hFront - 0.2;
      // Ribbon tile width keeps the 2:1 ad aspect for the fascia height.
      mesh(gBowl, sweep(loop, [[t.d0 - 0.06, fb], [t.d0 - 0.06, ft]], { closed: false, uTile: (ft - fb) * 16, vTile: ft - fb }),
        M.ledRibbon, `LED_Ribbon_${t.name}`, { cast: false });
    }
  });

  // ---------- Seats, aisles, vomitories ----------
  const seatGeo = seatGeometry();
  const stairGeo = new THREE.BoxGeometry(1, 1, 1);
  const stairMatrices = [];
  const portalOuter = [], portalInner = [];
  const tunnelF = 0.25;

  tiers.forEach((t, ti) => {
    const portals = [];
    for (let k = 0; k < t.portals.count; k++) {
      const f = (k + 0.5) / t.portals.count + 0.5 / t.aisles;
      if (ti === 0 && Math.abs(f - tunnelF) < 0.03) continue;
      portals.push({ f, r0: t.portals.r0, r1: t.portals.r1, width: t.portals.width, bottom: null });
    }
    if (ti === 0) portals.push({ f: tunnelF, r0: 0, r1: 7, width: 6, bottom: 0 });

    // Portal blocks: concrete surround + dark tunnel mouth.
    portals.forEach((p) => {
      const ra = t.rows[p.r0], rb = t.rows[p.r1];
      const bottom = p.bottom ?? ra.h, top = rb.h + 0.25, dd = rb.d - ra.d;
      const outer = new THREE.Matrix4().compose(
        new THREE.Vector3(0, (top + bottom) / 2, ra.d + dd / 2), new THREE.Quaternion(), new THREE.Vector3(p.width + 0.8, top - bottom, dd));
      const inner = new THREE.Matrix4().compose(
        new THREE.Vector3(0, (top - 0.3 + bottom) / 2, ra.d + dd / 2 - 0.15), new THREE.Quaternion(), new THREE.Vector3(p.width, top - 0.3 - bottom, dd));
      portalOuter.push(frameMatrix(p.f, 0, 0, outer));
      portalInner.push(frameMatrix(p.f, 0, 0, inner));
    });

    const seatBuckets = Array.from({ length: SEAT_SECTORS }, () => []);
    const m = new THREE.Matrix4();
    t.rows.forEach((row, r) => {
      const d = row.d + row.depth * 0.58;
      const rs = rowSampler(dense, d);
      const gaps = [];
      for (let a = 0; a < t.aisles; a++) {
        const f = a / t.aisles;
        const blocked = portals.some((p) => r >= p.r0 && r < p.r1 && Math.abs(p.f - f) * rs.P < p.width / 2 + 0.6);
        gaps.push({ s: rs.sOfFraction(f), w: 0.65 });
        if (!blocked && r < t.rows.length - 1) {
          const riser = t.rows[r + 1].h - row.h;
          const local = new THREE.Matrix4().compose(
            new THREE.Vector3(0, row.h + riser / 4, row.d + row.depth * 0.75), new THREE.Quaternion(), new THREE.Vector3(1.1, riser / 2, row.depth / 2));
          stairMatrices.push(frameMatrix(f, 0, 0, local));
        }
      }
      portals.forEach((p) => { if (r >= p.r0 && r < p.r1) gaps.push({ s: rs.sOfFraction(p.f), w: p.width / 2 + 0.4 }); });

      const n = Math.floor(rs.P / 0.5), spacing = rs.P / n;
      for (let c = 0; c < n; c++) {
        const s = (c + 0.5) * spacing;
        if (gaps.some((g) => { const dist = Math.abs(s - g.s); return Math.min(dist, rs.P - dist) < g.w; })) continue;
        const p = rs.at(s);
        m.makeRotationY(Math.atan2(-p.nx, -p.nz));
        m.setPosition(p.x, row.h, p.z);
        seatBuckets[Math.floor(p.f * SEAT_SECTORS) % SEAT_SECTORS].push(m.clone());
      }
    });

    // Sector-split instancing so off-screen seat blocks are frustum culled.
    const rnd = (() => { let s = 99 + ti; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const col = new THREE.Color();
    seatBuckets.forEach((mats, si) => {
      if (!mats.length) return;
      const im = inst(gSeats, seatGeo, M[t.seat], mats, `Seats_${t.name}_S${String(si).padStart(2, '0')}`, { cast: false });
      for (let i = 0; i < mats.length; i++) { const v = 0.82 + rnd() * 0.18; im.setColorAt(i, col.setRGB(v, v, v)); }
      stats.seats += mats.length;
    });
  });

  inst(gBowl, stairGeo, M.concreteTier, stairMatrices, 'Aisle_Steps', { cast: false });
  inst(gBowl, stairGeo, M.concretePlain, portalOuter, 'Vomitory_Surround');
  inst(gBowl, stairGeo, M.tunnel, portalInner, 'Vomitory_Tunnel', { cast: false });

  // ---------- 3. Columns + parametric facade fins ----------
  const COLS = 64;
  const colGeo = new THREE.CylinderGeometry(0.75, 1.1, 45.1, 16);
  const colMats = [], capMats = [];
  for (let i = 0; i < COLS; i++) {
    colMats.push(frameMatrix(i / COLS, 55, 0.9 + 45.1 / 2));
    capMats.push(frameMatrix(i / COLS, 55, 0.9 + 0.6));
  }
  inst(gFrame, colGeo, M.concrete, colMats, 'Columns');
  inst(gFrame, new THREE.CylinderGeometry(1.6, 1.8, 1.2, 16), M.concrete, capMats, 'Column_Footings');

  const FINS = 240;
  const finGeo = new THREE.BoxGeometry(0.32, 41, 1.9);
  const finMats = [];
  for (let i = 0; i < FINS; i++) {
    const twist = new THREE.Matrix4().makeRotationY(0.55 * Math.sin((i / FINS) * Math.PI * 8));
    finMats.push(frameMatrix((i + 0.5) / FINS, 54.4, 22, twist));
  }
  inst(gFrame, finGeo, M.paintedSteel, finMats, 'Facade_Fins');

  // ---------- 4. Ring beam ----------
  mesh(gRing, sweep(loop, [[55, 45.5], [55, 47.5], [57, 47.5], [57, 45.5]], { uTile: 6, vTile: 4 }), M.steel, 'Compression_Ring');

  // ---------- 5. Radial trusses, purlins, bracing ----------
  const segs = [];
  const nodes = [];
  const PANELS = 11, dOut = 56, dIn = 12;
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  const push = (a, b, r) => segs.push([a.x, a.y, a.z, b.x, b.y, b.z, r]);
  for (let i = 0; i < COLS; i++) {
    const idx = Math.round((i / COLS) * dense.count);
    const top = [], bot = [];
    for (let m = 0; m <= PANELS; m++) {
      const d = dOut - (m * (dOut - dIn)) / PANELS;
      const ht = roofH(d) - 0.3, depth = 1.6 + ((d - dIn) / (dOut - dIn)) * 3.4;
      top.push(offsetPoint(dense, idx, d, ht));
      bot.push(offsetPoint(dense, idx, d, ht - depth));
    }
    nodes.push({ top, bot });
    push(offsetPoint(dense, idx, 55, 46), top[0], 0.45);
    for (let m = 0; m < PANELS; m++) {
      push(top[m], top[m + 1], 0.32);
      push(bot[m], bot[m + 1], 0.32);
      push(m % 2 ? top[m] : bot[m], m % 2 ? bot[m + 1] : top[m + 1], 0.16);
    }
    for (let m = 0; m <= PANELS; m++) push(top[m], bot[m], 0.14);
  }
  for (let i = 0; i < COLS; i++) {
    const A = nodes[i], B = nodes[(i + 1) % COLS];
    for (let m = 0; m <= PANELS; m++) {
      push(A.top[m], B.top[m], 0.14);
      if (m % 3 === 0) push(A.bot[m], B.bot[m], 0.18);
      if (i % 4 === 0 && m < PANELS) { push(A.top[m], B.top[m + 1], 0.07); push(A.top[m + 1], B.top[m], 0.07); }
    }
  }
  const truss = tubes(segs, M.paintedSteel, 8);
  truss.name = 'Roof_Truss_Members';
  truss.castShadow = true;
  truss.receiveShadow = true;
  gTruss.add(truss);
  stats.trussMembers = segs.length;

  mesh(gTruss, sweep(loop, [[11.6, 42.6], [11.6, 43.6], [12.6, 43.6], [12.6, 42.6]]), M.steel, 'Tension_Ring');
  mesh(gTruss, sweep(loop, [[12.6, 41.55], [12.6, 41.7], [14.4, 41.7], [14.4, 41.55]]), M.darkSteel, 'Catwalk', { cast: false });

  // Floodlight array along the catwalk.
  const rsF = rowSampler(dense, 13.4);
  const nLights = Math.floor(rsF.P / 2.4);
  const housing = [], lens = [];
  const tilt = new THREE.Matrix4().makeRotationX(0.75);
  for (let i = 0; i < nLights; i++) {
    const p = rsF.at((i + 0.5) * (rsF.P / nLights));
    const base = new THREE.Matrix4().makeRotationY(Math.atan2(-p.nx, -p.nz)).setPosition(p.x, 42.05, p.z).multiply(tilt);
    housing.push(base.clone().multiply(new THREE.Matrix4().makeScale(1.0, 0.55, 0.6)));
    lens.push(base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.31)).multiply(new THREE.Matrix4().makeScale(0.9, 0.45, 1)));
  }
  inst(gTruss, new THREE.BoxGeometry(1, 1, 1), M.darkSteel, housing, 'Floodlight_Housings', { cast: false });
  inst(gTruss, new THREE.PlaneGeometry(1, 1), M.flood, lens, 'Floodlight_Lenses', { cast: false, receive: false });
  stats.floodlights = nLights;

  // ---------- 6. Roof deck ----------
  mesh(gPanels, sweep(loop, [[34, roofH(34)], [57.2, roofH(57.2)]], { closed: false, uTile: 6, vTile: 6 }), M.roofMetal, 'Roof_Metal_Deck');
  mesh(gPanels, sweep(loop, [[12, roofH(12)], [34, roofH(34)]], { closed: false, uTile: 5, vTile: 5 }), M.polycarbonate, 'Roof_Polycarbonate', { cast: false });
  mesh(gPanels, sweep(loop, [[57.2, roofH(57.2) + 0.4], [57.2, 44.4]], { closed: false, uTile: 6, vTile: 4 }), M.steel, 'Roof_Fascia_Outer');
  mesh(gPanels, sweep(loop, [[11.7, 43.5], [11.7, roofH(11.7) + 0.35]], { closed: false }), M.paintedSteel, 'Roof_Fascia_Inner');

  // ---------- Hung scoreboards ----------
  [0, 0.5].forEach((f, i) => {
    const g = new THREE.Group();
    g.name = `Scoreboard_${i}`;
    g.matrixAutoUpdate = false;
    g.matrix.copy(frameMatrix(f, 14, 35.5, new THREE.Matrix4().makeRotationY(Math.PI)));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(23, 10.2, 1.1), M.darkSteel);
    frame.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(22, 9.6), M.scoreboard);
    screen.position.z = 0.56;
    g.add(frame, screen);
    const hang = tubes([-9, 9].map((x) => [x, 5.1, 0, x, 7.4, 0, 0.08]), M.steel, 6);
    g.add(hang);
    gHung.add(g);
  });

  return { root, explode, stats, tiers, gAssets, gPanels, gSeats };
}
