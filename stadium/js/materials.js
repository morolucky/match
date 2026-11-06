import * as THREE from 'three';

const TEX = './assets/textures/';

function canvasTexture(w, h, draw, { srgb = true, wrap = THREE.RepeatWrapping } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = wrap;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.userData.ctx = ctx;
  return t;
}

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const SPONSORS = [
  ['AWERE', '#0b3d91', '#fff'], ['NOVA AIR', '#e4002b', '#fff'], ['KICKSTAR', '#111', '#ffd200'],
  ['ORBIT BANK', '#00a3e0', '#fff'], ['PULSE', '#6a1b9a', '#fff'], ['TITAN TYRES', '#ff6a00', '#111'],
  ['GOAL+', '#00843d', '#fff'], ['VOLTA', '#fafafa', '#0b3d91'],
];

export function createMaterials(renderer, manager) {
  const loader = new THREE.TextureLoader(manager);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const load = (name, srgb) => {
    const t = loader.load(TEX + name);
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // --- PBR sets sliced from the supplied atlases ---
  const concreteMap = load('concrete_albedo.jpg', true);
  const concreteNormal = load('concrete_normal.jpg');
  const concreteAO = load('concrete_ao.jpg');
  const grassMap = load('grass_albedo.jpg', true);
  const grassNormal = load('grass_normal.jpg');
  const grassRough = load('grass_roughness.jpg');

  const concrete = new THREE.MeshStandardMaterial({
    name: 'Concrete', map: concreteMap, normalMap: concreteNormal, aoMap: concreteAO, aoMapIntensity: 0.9, roughness: 0.92,
  });
  const concreteTier = concrete.clone();
  concreteTier.name = 'Concrete_Precast';
  concreteTier.color.set(0xc9ccd0);
  const grass = new THREE.MeshStandardMaterial({
    name: 'Grass', map: grassMap, normalMap: grassNormal, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: grassRough, roughness: 1,
  });

  // --- Procedural detail textures (no extra downloads) ---
  const tartanTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#7a2a22'; g.fillRect(0, 0, w, h);
    const r = rand(7);
    for (let i = 0; i < 26000; i++) {
      const v = r();
      g.fillStyle = v > 0.5 ? 'rgba(160,70,55,0.5)' : 'rgba(40,10,8,0.5)';
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  });
  tartanTex.repeat.set(0.3, 0.3);
  tartanTex.anisotropy = aniso;
  const tartan = new THREE.MeshStandardMaterial({ name: 'Tartan', map: tartanTex, roughness: 0.95 });

  const roofTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#d7dbde'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = '#9aa1a7'; g.fillRect(x, 0, 3, h);
      g.fillStyle = '#f4f6f7'; g.fillRect(x + 3, 0, 2, h);
    }
  });
  roofTex.anisotropy = aniso;
  const roofMetal = new THREE.MeshStandardMaterial({
    name: 'Roof_Metal', map: roofTex, metalness: 0.55, roughness: 0.38, side: THREE.DoubleSide,
  });

  const polyTex = canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(235,242,248,0.42)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(200,205,210,1)';
    g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 10, h);
    g.fillStyle = 'rgba(200,205,210,0.9)'; g.fillRect(w / 2 - 2, 0, 4, h);
  });
  polyTex.anisotropy = aniso;
  const polycarbonate = new THREE.MeshStandardMaterial({
    name: 'Polycarbonate', map: polyTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.25, metalness: 0,
  });

  const glazeR = rand(3);
  const glazingTex = canvasTexture(256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#2b4b63'); grd.addColorStop(1, '#14283a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9d2d8';
    for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 5, h);
    for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 9);
  });
  const glazingEmissive = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) for (let y = 0; y < h; y += 128) {
      if (glazeR() > 0.35) { g.fillStyle = `rgba(255,${200 + glazeR() * 40 | 0},140,${0.5 + glazeR() * 0.5})`; g.fillRect(x + 6, y + 10, 56, 116); }
    }
  });
  const glazing = new THREE.MeshStandardMaterial({
    name: 'Glazing', map: glazingTex, metalness: 0.7, roughness: 0.12, emissive: 0xffffff, emissiveMap: glazingEmissive, emissiveIntensity: 0,
  });

  const netTex = canvasTexture(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
  });
  netTex.repeat.set(1 / 0.14, 1 / 0.14);
  const net = new THREE.MeshStandardMaterial({ name: 'Net', map: netTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });

  const adsTex = canvasTexture(2048, 128, (g, w, h) => {
    SPONSORS.forEach(([name, bg, fg], i) => {
      const x = i * 256;
      g.fillStyle = bg; g.fillRect(x, 0, 256, h);
      g.fillStyle = fg; g.font = '900 46px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(name, x + 128, h / 2 + 2, 236);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 254, 0, 2, h);
    });
  });
  adsTex.anisotropy = aniso;
  const led = new THREE.MeshStandardMaterial({
    name: 'LED_Board', color: 0x000000, emissive: 0xffffff, emissiveMap: adsTex, emissiveIntensity: 1.1, roughness: 0.35,
  });
  const ledRibbon = led.clone();
  ledRibbon.name = 'LED_Ribbon';

  // Scoreboard: redrawn once per second with a running match clock.
  const scoreTex = canvasTexture(1024, 448, () => {});
  const drawScore = (seconds) => {
    const g = scoreTex.userData.ctx, w = 1024, h = 448;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#061a3a'); grd.addColorStop(1, '#020812');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0b3d91'; g.fillRect(0, 0, w, 70);
    g.fillStyle = '#fff'; g.font = '800 40px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('AWERE ARENA  •  MATCHDAY 12', w / 2, 37);
    g.font = '900 64px Arial, sans-serif';
    g.fillStyle = '#ffd200'; g.fillText('LIONS', 170, 190, 280);
    g.fillStyle = '#5ec8ff'; g.fillText('FALCONS', 854, 190, 280);
    g.fillStyle = '#fff'; g.font = '900 130px Arial, sans-serif'; g.fillText('2 - 1', w / 2, 190, 300);
    const t = 3900 + seconds, mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
    g.fillStyle = '#e4002b'; g.fillRect(w / 2 - 120, 290, 240, 76);
    g.fillStyle = '#fff'; g.font = '800 60px "Courier New", monospace'; g.fillText(`${mm}:${ss}`, w / 2, 330);
    g.fillStyle = '#9fb3cc'; g.font = '700 30px Arial, sans-serif'; g.fillText('ATTENDANCE 58,420', w / 2, 410);
    scoreTex.needsUpdate = true;
  };
  drawScore(0);
  const scoreboard = new THREE.MeshStandardMaterial({
    name: 'Scoreboard', color: 0x000000, emissive: 0xffffff, emissiveMap: scoreTex, emissiveIntensity: 1.2,
  });

  const flagTex = canvasTexture(64, 64, (g, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#e4002b' : '#ffd200'; g.fillRect(i * 16, j * 16, 16, 16);
    }
  });

  const M = {
    concrete, concreteTier, grass, tartan, roofMetal, polycarbonate, glazing, net, led, ledRibbon, scoreboard,
    adsTex, drawScore,
    flag: new THREE.MeshStandardMaterial({ name: 'Flag_Fabric', map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }),
    steel: new THREE.MeshStandardMaterial({ name: 'Steel', color: 0xb9bec4, metalness: 0.9, roughness: 0.32 }),
    paintedSteel: new THREE.MeshStandardMaterial({ name: 'Painted_Steel', color: 0xeceef0, metalness: 0.35, roughness: 0.45 }),
    darkSteel: new THREE.MeshStandardMaterial({ name: 'Dark_Steel', color: 0x2a2e33, metalness: 0.6, roughness: 0.5 }),
    seatBlue: new THREE.MeshStandardMaterial({ name: 'Plastic_Seat_Blue', color: 0x1d5fd6, roughness: 0.42 }),
    seatNavy: new THREE.MeshStandardMaterial({ name: 'Plastic_Seat_Navy', color: 0x16337a, roughness: 0.4 }),
    seatRed: new THREE.MeshStandardMaterial({ name: 'Plastic_Seat_Red', color: 0xc8102e, roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({
      name: 'Glass', color: 0xa9cfe0, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
    }),
    fabric: new THREE.MeshStandardMaterial({
      name: 'Fabric_Canopy', color: 0x2a6fd6, roughness: 0.6, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
    }),
    // Untextured for scaled unit-box instances, where tiled maps would stretch.
    concretePlain: new THREE.MeshStandardMaterial({ name: 'Concrete_Plain', color: 0x9a9da1, roughness: 0.9 }),
    tunnel: new THREE.MeshStandardMaterial({ name: 'Tunnel_Dark', color: 0x060708, roughness: 1 }),
    whitePaint: new THREE.MeshStandardMaterial({ name: 'White_Paint', color: 0xffffff, roughness: 0.3 }),
    flood: new THREE.MeshStandardMaterial({ name: 'Floodlight_Lens', color: 0x222222, emissive: 0xfff6e8, emissiveIntensity: 0 }),
    plazaGround: new THREE.MeshStandardMaterial({ name: 'Landscape', color: 0x46553a, roughness: 1 }),
  };
  return M;
}
