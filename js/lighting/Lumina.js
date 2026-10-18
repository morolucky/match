// Lumina: height-field GI for city scenes
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { L } from './layers.js';

const {LM_TH,LUMINA_GLSL,LUMINA_APPLY,Lumina} = (() => {
/**
 * LUMINA — height-field global illumination for cities (a WebGL2 take on Lumen's ideas).
 *
 * Scene representation ("global distance field" analogue): the city is 2.5D, so a top-down height map
 * describes it almost exactly. From it we build:
 *   - layered occupancy pyramid  occA/occB : fraction of a footprint taller than 8 height thresholds,
 *                                            mip-averaged -> exact soft coverage for any cone radius
 *   - shadow-height map S                  : lowest sunlit height per column (one march per texel)
 *   - layered sun-visibility pyramid       : fraction of a footprint lit at each threshold height
 *   - surface cache                        : top albedo (roofs, roads, lawns) + facade albedo
 *
 * Radiance cache (Lumen-style): probes = (cell, 12 height layers, 5 normal directions), each gathered with
 *   6 front-to-back cones through the occupancy pyramid; hits are shaded with the surface cache + sun
 *   visibility (1 bounce), misses with the sky. Probes inside buildings are relocated outward (DDGI-style).
 *   - near clipmap: 96x96 cells @1.25 m around the camera, double buffered, regenerated progressively
 *   - far cache: the whole city @~5 m, refreshed progressively when the sun or the city changes
 * Shading (injected into every standard material, tiered by distance — strong near, cheap far):
 *   - diffuse GI: ~6-12 texture reads per pixel (near clipmap blended into the far cache)
 *   - glossy reflections: one narrow cone along the reflection vector (facades show window grids)
 *   - far shadows: beyond the shadow map the shadow-height map takes over (whole-city sun occlusion)
 * Atmosphere (post): height fog + god rays marched through the shadow-height map.
 */



const LM_TH = [0.6, 3, 7, 12, 20, 35, 60, 110];
const hal2 = (i) => { let f = 1, r = 0; while (i > 0) { f /= 2; r += f * (i % 2); i = Math.floor(i / 2); } return r; }; // base-2 radical inverse (Halton)
const OCC_RES = 2048, LIT_RES = 1024, S_RES = 2048, ALB_RES = 1024;
const NEAR_N = 96, NEAR_CELL = 1.25, FAR_N = 192, DIRS = 5, LAYERS = 12;

// radiance cache generation: one texel = irradiance for (cell, height layer, normal direction)
const CACHE_FS = /* glsl */`
#include <common>
uniform sampler2D uH;
uniform float uMinY, uYs;
uniform vec4 uBox, uO;
uniform sampler2D uPrev; uniform vec2 uPrevSize; uniform float uAlpha;
__LUMINA__
void main() {
  vec2 px = floor(gl_FragCoord.xy); float N = uO.w;
  float di = floor(px.x / N), cx = px.x - di * N, li = floor(px.y / N), cz = px.y - li * N;
  vec3 P = vec3(uO.x + (cx + .5) * uO.z, LM_Y[int(li)], uO.y + (cz + .5) * uO.z);
  vec3 Nd = di < .5 ? vec3(0., 1., 0.) : di < 1.5 ? vec3(1., 0., 0.) : di < 2.5 ? vec3(-1., 0., 0.) : di < 3.5 ? vec3(0., 0., 1.) : vec3(0., 0., -1.);
  // probe relocation: step out of buildings along the probe direction (then upward)
  for (int k = 0; k < 24; k++) {
    vec2 uv = lmUV(P.xz);
    if (lmOut(uv) || lmOcc(uv, 0., P.y) < .5) break;
    P += (k < 16 ? Nd : vec3(0., 1., 0.)) * (k < 16 ? .6 : 2.5);
  }
  vec3 e = lmIrradiance(P, Nd, 0.);
  if (uAlpha < .999) e = mix(texture2D(uPrev, gl_FragCoord.xy / uPrevSize).rgb, e, uAlpha); // temporal EMA accumulation
  gl_FragColor = vec4(e, 1.);
}`;

const QVS = 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';

const LUMINA_GLSL = /* glsl */`
uniform sampler2D uLmOccA, uLmOccB, uLmLitA, uLmLitB, uLmWall, uLmTop, uLmS;
uniform float uLmOn, uLmGI, uLmSpec, uLmRt, uLmTexel, uLmTopY, uLmNear, uLmMid, uLmSteps, uLmNight, uLmFarSh, uLmCloudSh, uLmClouds, uLmTime, uLmCones, uLmRot, uLmRho, uLmLite;
uniform vec3 uLmSunDir, uLmSunE, uLmSkyE, uLmSkyTop, uLmSkyHor, uLmGround;
uniform sampler2D uLmNearC, uLmFarC;
uniform vec4 uLmNearO, uLmFarO; // radiance cache region: x0, z0, cell size, cells per side
uniform vec2 uLmNearSize, uLmFarSize;
uniform float uLmNearOn, uLmFarOn;
const float LM_Y[12] = float[12](.6, 2., 4., 7., 11., 16., 23., 32., 45., 65., 95., 140.);

vec2 lmUV(vec2 xz) { return vec2((xz.x - uBox.x) / uBox.z, (uBox.y - xz.y) / uBox.w); }
bool lmOut(vec2 uv) { return uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.; }

// piecewise-linear profile through the 8 threshold layers
float lmProfile(vec4 A, vec4 B, float y) {
  if (y < 3.) return mix(A.x, A.y, clamp((y - .6) / 2.4, 0., 1.));
  if (y < 7.) return mix(A.y, A.z, (y - 3.) / 4.);
  if (y < 12.) return mix(A.z, A.w, (y - 7.) / 5.);
  if (y < 20.) return mix(A.w, B.x, (y - 12.) / 8.);
  if (y < 35.) return mix(B.x, B.y, (y - 20.) / 15.);
  if (y < 60.) return mix(B.y, B.z, (y - 35.) / 25.);
  if (y < 110.) return mix(B.z, B.w, (y - 60.) / 50.);
  return B.w * (1. - smoothstep(110., 260., y));
}
float lmOcc(vec2 uv, float lod, float y) {
  vec4 A = y < 20. ? textureLod(uLmOccA, uv, lod) : vec4(0.);
  vec4 B = y > 12. ? textureLod(uLmOccB, uv, lod) : vec4(0.);
  return lmProfile(A, B, y);
}
float lmLitF(vec2 uv, float lod, float y) {
  vec4 A = y < 20. ? textureLod(uLmLitA, uv, lod) : vec4(1.);
  vec4 B = y > 12. ? textureLod(uLmLitB, uv, lod) : vec4(1.);
  return lmProfile(A, B, y);
}
vec3 lmSky(vec3 d) {
  if (d.y < 0.) return uLmGround;
  return mix(uLmSkyHor, uLmSkyTop, smoothstep(0., .45, d.y));
}
float lmH21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

/* ---- radiance cache lookup: 5 normal directions x 12 height layers, bilinear in xz ---- */
float lmLayerF(float y) {
  if (y <= LM_Y[0]) return 0.;
  for (int i = 0; i < 11; i++) if (y < LM_Y[i + 1]) return float(i) + (y - LM_Y[i]) / (LM_Y[i + 1] - LM_Y[i]);
  return 11.;
}
vec3 lmCacheDir(sampler2D C, vec4 O, vec2 size, float di, vec2 c, float l0, float l1, float f) {
  vec2 a = vec2(di * O.w, 0.) + c;
  return mix(texture(C, (a + vec2(0., l0 * O.w)) / size).rgb, texture(C, (a + vec2(0., l1 * O.w)) / size).rgb, f);
}
vec3 lmCacheE(sampler2D C, vec4 O, vec2 size, vec3 q, vec3 N) {
  vec2 c = clamp((q.xz - O.xy) / O.z, vec2(.5), vec2(O.w - .5));
  float lf = lmLayerF(q.y), l0 = floor(lf), l1 = min(l0 + 1., 11.), f = lf - l0;
  bool lt = uLmLite > .5;
  vec3 A = lt ? N * N : abs(N); // Lite: ambient-cube weights N^2 (sum == 1 for unit N, no renormalisation)
  float th = lt ? .004 : .02;
  vec3 E = vec3(0.); float w;
  w = N.y > 0. ? A.y : 0.;  if (w > th) E += w * lmCacheDir(C, O, size, 0., c, l0, l1, f);
  w = N.x > 0. ? A.x : 0.;  if (w > th) E += w * lmCacheDir(C, O, size, 1., c, l0, l1, f);
  w = N.x < 0. ? A.x : 0.;  if (w > th) E += w * lmCacheDir(C, O, size, 2., c, l0, l1, f);
  w = N.z > 0. ? A.z : 0.;  if (w > th) E += w * lmCacheDir(C, O, size, 3., c, l0, l1, f);
  w = N.z < 0. ? A.z : 0.;  if (w > th) E += w * lmCacheDir(C, O, size, 4., c, l0, l1, f);
  w = N.y < 0. ? A.y : 0.;  if (w > th) E += w * .35 * lmCacheDir(C, O, size, 0., c, 0., 0., 0.); // undersides: ground bounce
  return lt ? E : E / max(A.x + A.y + A.z, 1e-3);
}

// front-to-back cone march with Infinite Multi-Bounce GI feedback. rgb = gathered radiance, a = remaining transmittance
vec4 lmCone(vec3 p, vec3 d, float tanA, float t, float tMax, int steps, bool refl) {
  vec3 Lr = vec3(0.); float T = 1., litPrev = 1.;
  float mb = (uLmLite > .5 ? 0. : 1.) * uLmFarOn * clamp(uLmRt, 0., 1.5) * 0.52;
  for (int i = 0; i < 32; i++) {
    if (i >= steps || T < .02 || t > tMax) break;
    vec3 q = p + d * t;
    if (q.y > uLmTopY && d.y >= 0.) break; // escaped above the skyline
    float r = max(t * tanA, uLmTexel * .5), lod = log2(r / uLmTexel);
    vec2 uv = lmUV(q.xz);
    if (lmOut(uv)) break;
    if (q.y < .05) { // ground
      vec3 alb = textureLod(uLmTop, uv, lod - 1.).rgb;
      float lit = lmLitF(uv, lod - 1., .7);
      vec3 ind = mb > .01 ? lmCacheE(uLmFarC, uLmFarO, uLmFarSize, vec3(q.x, .8, q.z), vec3(0., 1., 0.)) * mb : uLmSkyE;
      Lr += T * alb * RECIPROCAL_PI * (uLmSunE * max(uLmSunDir.y, 0.) * lit + uLmSkyE * (1. - mb * .5) + ind);
      T = 0.; break;
    }
    float occ = lmOcc(uv, lod, q.y), free = 1. - occ;
    float lit = lmLitF(uv, lod - 1., q.y);
    float litW = free > .15 ? clamp(lit / free, 0., 1.) : litPrev; litPrev = litW; // lighting of the air in front of the wall
    if (occ > .004) {
      vec4 wa = textureLod(uLmWall, uv, lod - 1.);
      vec3 alb = wa.rgb / max(wa.a, .1);
      vec3 nW = normalize(vec3(-d.x, 0., -d.z) + vec3(1e-4, 0., 0.));
      vec3 ind = mb > .01 ? lmCacheE(uLmFarC, uLmFarO, uLmFarSize, q + nW * 1.2, nW) * mb : vec3(0.);
      vec3 Lw = alb * RECIPROCAL_PI * (uLmSunE * max(dot(nW, uLmSunDir), 0.) * litW + uLmSkyE * .5 * (1. - mb * .4) + ind);
      if (refl && lod < 3.5) { // window grid on reflected facades (glass reflects the sky, some rooms lit)
        float fl = fract(q.y / 3.4), bay = fract(dot(q.xz, vec2(nW.z, -nW.x)) / 2.9);
        float win = step(.3, fl) * step(fl, .88) * step(.12, bay) * step(bay, .88) * (1. - smoothstep(2., 3.5, lod));
        vec2 cell = floor(vec2(dot(q.xz, vec2(nW.z, -nW.x)) / 2.9, q.y / 3.4));
        vec3 room = vec3(1., .72, .42) * step(lmH21(cell), mix(.12, .5, uLmNight)) * mix(.35, 1.6, uLmNight);
        Lw = mix(Lw, Lw * .15 + lmSky(reflect(d, nW)) * .12 + room, win);
      }
      Lr += T * occ * Lw; T *= free;
    }
    t += max(r, uLmTexel) * 1.2 + (refl ? .25 : .5);
  }
  return vec4(Lr, T);
}

// Smart Exact Height-Field Ray Tracer (HFRT): envelope-accelerated ray march + 3-step binary bisection + true normal gradient
vec4 lmTraceExact(vec3 p, vec3 d, float tMax) {
  float t = 0.45, tPrev = 0.2;
  for (int i = 0; i < 28; i++) {
    if (t > tMax) break;
    vec3 q = p + d * t;
    if (q.y > uLmTopY && d.y >= 0.) break;
    if (q.y <= 0.08 && d.y < -1e-4) { // exact ground plane intersection
      float tg = clamp((0.05 - p.y) / d.y, 0., tMax);
      vec3 qg = p + d * tg; vec2 uvg = lmUV(qg.xz);
      if (lmOut(uvg)) break;
      vec3 alb = textureLod(uLmTop, uvg, 0.).rgb;
      float sH = texture2D(uLmS, uvg).r;
      float lit = smoothstep(sH - .4, sH + .4, .25);
      vec3 ind = uLmFarOn > .5 ? lmCacheE(uLmFarC, uLmFarO, uLmFarSize, vec3(qg.x, .8, qg.z), vec3(0., 1., 0.)) : uLmSkyE;
      return vec4(alb * RECIPROCAL_PI * (uLmSunE * max(uLmSunDir.y, 0.) * lit + ind), 0.);
    }
    vec2 uv = lmUV(q.xz);
    if (lmOut(uv)) break;
    float h = texture2D(uH, uv).r * uYs + uMinY;
    if (q.y < h) { // hit building: 3-step binary search refinement for sub-texel accuracy
      float t0 = tPrev, t1 = t;
      for (int b = 0; b < 3; b++) {
        float tm = 0.5 * (t0 + t1);
        vec3 qm = p + d * tm;
        float hm = texture2D(uH, lmUV(qm.xz)).r * uYs + uMinY;
        if (qm.y < hm) t1 = tm; else t0 = tm;
      }
      q = p + d * t1; uv = lmUV(q.xz); h = texture2D(uH, uv).r * uYs + uMinY;
      vec3 q0 = p + d * t0;
      float eps = uLmTexel * 1.4 / uBox.z;
      float hx = (texture2D(uH, uv + vec2(eps, 0.)).r - texture2D(uH, uv - vec2(eps, 0.)).r) * uYs;
      float hz = (texture2D(uH, uv + vec2(0., -eps)).r - texture2D(uH, uv - vec2(0., eps)).r) * uYs;
      vec2 g2 = vec2(-hx, -hz);
      vec3 nW = dot(g2, g2) > 1e-4 ? normalize(vec3(g2.x, 0., g2.y)) : normalize(vec3(-d.x, 0., -d.z) + vec3(1e-4, 0., 0.));
      if (dot(nW, d) > 0.) nW = -nW;
      bool isRoof = q0.y >= h - 0.15 && d.y < -0.05 && abs(q.y - h) < 0.65;
      vec2 uvOut = uv + vec2(nW.x, -nW.z) * eps * 1.5;
      float sH = texture2D(uLmS, isRoof ? uv : uvOut).r;
      float litW = smoothstep(sH - .65, sH + .65, q.y);
      vec3 nSurf = isRoof ? vec3(0., 1., 0.) : nW;
      vec3 ind = uLmFarOn > .5 ? lmCacheE(uLmFarC, uLmFarO, uLmFarSize, q + nSurf * 1.1, nSurf) : uLmSkyE * .55;
      if (isRoof) {
        vec3 alb = textureLod(uLmTop, uv, 0.).rgb;
        return vec4(alb * RECIPROCAL_PI * (uLmSunE * max(uLmSunDir.y, 0.) * litW + ind), 0.);
      }
      vec4 wa = textureLod(uLmWall, uv, 0.);
      vec3 alb = wa.a > .02 ? wa.rgb / max(wa.a, .1) : vec3(.52, .49, .45);
      vec3 Lw = alb * RECIPROCAL_PI * (uLmSunE * max(dot(nW, uLmSunDir), 0.) * litW + ind);
      // Ray-traced architectural windows on reflected facade
      float uCoord = dot(q.xz, vec2(nW.z, -nW.x));
      float fl = fract(q.y / 3.4), bay = fract(uCoord / 2.9);
      float win = step(.26, fl) * step(fl, .88) * step(.14, bay) * step(bay, .86) * step(3.0, h);
      if (win > .5) {
        vec2 cell = floor(vec2(uCoord / 2.9, q.y / 3.4));
        float rSeed = lmH21(cell);
        vec3 roomCol = mix(vec3(1., .76, .46), vec3(.78, .88, 1.), step(.65, lmH21(cell + 7.3)));
        vec3 room = roomCol * step(rSeed, mix(.18, .52, uLmNight)) * mix(.42, 1.85, uLmNight);
        vec3 glassRefl = lmSky(reflect(d, nW)) * (.22 + .35 * pow(1. - max(dot(-d, nW), 0.), 3.));
        Lw = mix(Lw, Lw * .12 + glassRefl + room, win);
      }
      return vec4(Lw, 0.);
    }
    tPrev = t;
    float hEnv = texture2D(uLmS, uv).b; // 3x3 neighborhood max height envelope
    float clearance = q.y - hEnv;
    float stepSz = clearance > 2.0 ? max(uLmTexel * 1.4, min(clearance * 0.55, 14.0)) : max(uLmTexel * 0.85, 0.5 + t * 0.014);
    t += stepSz;
  }
  return vec4(0., 0., 0., 1.);
}

vec3 lmIrradiance(vec3 P, vec3 N, float camD) {
  vec3 up = abs(N.y) < .95 ? vec3(0., 1., 0.) : vec3(1., 0., 0.);
  vec3 X = normalize(cross(up, N)), Y = cross(N, X);
  int tier = camD < uLmNear ? 0 : camD < uLmMid ? 1 : 2;
  int nc = tier == 0 ? int(clamp(uLmCones, 1., 6.)) : tier == 1 ? 3 : 1;
  int steps = int(uLmSteps) - tier * 3;
  float tanA = tier == 0 ? .6 : tier == 1 ? .9 : 1.6;
  bool red = tier == 0 && uLmLite > .5 && nc < 6; // reduced cones: Halton rotation + per-probe hash, accumulated by EMA
  float rot = red ? uLmRot : 0.; // same rotation for every probe in a pass: no spatial grain, only a smooth shift that EMA averages out
  float ringStep = 6.2832 / float(max(nc - 1, 1));
  vec3 p0 = P + N * .6, E = vec3(0.); float W = 0., Ts = 0.;
  for (int i = 0; i < 6; i++) {
    if (i >= nc) break;
    vec3 d; float w;
    if (i == 0) { d = N; w = 1.; }
    else { float a = (float(i) - 1.) * ringStep + .4 + rot; d = normalize(N * .6 + (X * cos(a) + Y * sin(a)) * .8); w = red ? 3. / float(nc - 1) : .6; }
    vec4 c = lmCone(p0, d, tanA, 1.2, 180., steps, false);
    E += w * (c.rgb + c.a * lmSky(d)); W += w; Ts += w * c.a;
  }
  vec3 Eo = PI * E / W;
  if (uLmLite > .5) { float svf = Ts / W; Eo /= max(1. - uLmRho * (1. - svf), .35); } // closed-form infinite bounce: 1/(1 - rho(1-SVF))
  return Eo;
}

vec3 lmRadiance(vec3 P, vec3 N, vec3 V, float rough, float camD) {
  vec3 R = normalize(reflect(-V, N));
  R.y = abs(R.y) < .015 ? .015 : R.y;
  float rtW = smoothstep(.42, .05, rough) * clamp(uLmRt, 0., 1.) * (1. - smoothstep(uLmNear, uLmMid, camD));
  if (rtW > .92) {
    vec4 rt = lmTraceExact(P + N * .28, R, 520.);
    return rt.rgb + rt.a * lmSky(R);
  }
  float tanA = .012 + rough * rough * 1.4;
  int steps = camD < uLmNear ? int(uLmSteps) + 8 : camD < uLmMid ? int(uLmSteps) : int(uLmSteps) / 2;
  vec4 c = lmCone(P + N * .25, R, tanA, .35, 700., steps, true);
  vec3 coneCol = c.rgb + c.a * lmSky(R);
  if (rtW > .02) {
    vec4 rt = lmTraceExact(P + N * .28, R, 480.);
    vec3 rtCol = rt.rgb + rt.a * lmSky(R);
    return mix(coneCol, rtCol, rtW);
  }
  return coneCol;
}

// near clipmap (fine) blended into the city-wide cache (coarse)
vec3 lmGI(vec3 P, vec3 N) {
  vec3 q = P + N * .4;
  vec3 E = lmCacheE(uLmFarC, uLmFarO, uLmFarSize, q, N);
  if (uLmNearOn > .5) {
    vec2 c = (q.xz - uLmNearO.xy) / uLmNearO.z;
    float m = min(min(c.x, c.y), uLmNearO.w - max(c.x, c.y));
    if (m > 1.) E = mix(E, lmCacheE(uLmNearC, uLmNearO, uLmNearSize, q, N), smoothstep(1., 10., m));
  }
  return E;
}

// Ray-Traced Contact-Hardening Soft Shadows (PCSS) using blocker distance in uLmS.g
float lmSunVis(vec3 P, vec3 N) {
  vec3 q = P + N * 1.1; vec2 uv = lmUV(q.xz);
  if (lmOut(uv)) return 1.;
  vec2 s0 = texture2D(uLmS, uv).rg;
  float penumbra = mix(1., clamp(.38 + s0.y * .028, .38, 2.9), clamp(uLmRt, 0., 1.));
  float t = (1.15 * penumbra) / ${S_RES}., bw = .55 * penumbra, vis = 0.;
  vis += smoothstep(-bw, bw, q.y - texture2D(uLmS, uv + vec2(-.32, -.41) * t).r);
  vis += smoothstep(-bw, bw, q.y - texture2D(uLmS, uv + vec2(.44, -.28) * t).r);
  vis += smoothstep(-bw, bw, q.y - texture2D(uLmS, uv + vec2(-.18, .52) * t).r);
  vis += smoothstep(-bw, bw, q.y - texture2D(uLmS, uv + vec2(.58, .39) * t).r);
  vis += smoothstep(-bw * 1.25, bw * 1.25, q.y - texture2D(uLmS, uv + vec2(-.78, .12) * t).r);
  vis += smoothstep(-bw * 1.25, bw * 1.25, q.y - texture2D(uLmS, uv + vec2(.15, -.82) * t).r);
  vis += smoothstep(-bw * 1.25, bw * 1.25, q.y - texture2D(uLmS, uv + vec2(.81, -.14) * t).r);
  vis += smoothstep(-bw * 1.25, bw * 1.25, q.y - texture2D(uLmS, uv + vec2(-.22, .88) * t).r);
  return vis * .125;
}
float lmVn(vec2 q) {
  vec2 i = floor(q), f = fract(q); f = f * f * (3. - 2. * f);
  return mix(mix(lmH21(i), lmH21(i + vec2(1., 0.)), f.x), mix(lmH21(i + vec2(0., 1.)), lmH21(i + 1.), f.x), f.y);
}
float lmCloudFbm(vec2 q) {
  float s = 0., a = .5;
  for (int i = 0; i < 4; i++) { s += a * lmVn(q); q = q * 2.03 + vec2(1.7, 9.2); a *= .5; }
  return s;
}
// Volumetric cloud shadow transmittance projected along sun direction onto world space
float lmCloudTrans(vec3 P) {
  if (uLmCloudSh < .01 || uLmClouds < .01 || uLmNight > .85) return 1.;
  vec2 sunXZ = uLmSunDir.xz / max(uLmSunDir.y, .18);
  vec2 cp = (P.xz + sunXZ * max(420. - P.y, 0.)) * .0016 + vec2(uLmTime * .004, uLmTime * .0015);
  float n = lmCloudFbm(cp) * .65 + lmCloudFbm(cp * 2.4 + 3.1) * .35;
  float cov = smoothstep(.52, .8, n) * clamp(uLmClouds, 0., 1.5);
  return 1. - clamp(cov * .62 * uLmCloudSh * (1. - uLmNight), 0., .75);
}
// fades from the shadow map to the height-field shadows at the edge of the shadow frustum + applies cloud shadows
float lmFarShadow(vec4 sc, vec3 P, vec3 N) {
  float cld = lmCloudTrans(P);
  if (uLmOn < .5 || uLmFarSh < .5) return cld;
  vec3 c = sc.xyz / sc.w; vec2 e = min(c.xy, 1. - c.xy);
  float inside = (c.z < 1. && e.x > 0. && e.y > 0.) ? smoothstep(0., .12, min(e.x, e.y)) : 0.;
  return mix(lmSunVis(P, N), 1., inside) * cld;
}
`;

// injected after <lights_fragment_maps>
const LUMINA_APPLY = /* glsl */`
if (uLmOn > .5) {
  vec3 lmN = normalize(inverseTransformDirection(normal, viewMatrix));
  vec3 lmV = normalize(cameraPosition - vSaoP);
  float lmD = length(cameraPosition - vSaoP);
  vec3 lmE = lmGI(vSaoP, lmN) * uLmGI;
  irradiance = vec3(0.);
  iblIrradiance = lmE;
  radiance = (material.roughness < .78 ? lmRadiance(vSaoP, lmN, lmV, material.roughness, lmD) : lmE * RECIPROCAL_PI) * uLmSpec;
}
`;

class Lumina {
  constructor(renderer, sao) {
    this.R = renderer; this.sao = sao;
    this.enabled = true; this.lite = true; this._hp = 0; this._farConv = 0; this._nearConv = 0; this.sunDirty = true; this._lastSun = new THREE.Vector3(); this._sunT = 0;
    const mk = (res, type = THREE.UnsignedByteType, mip = true) => {
      const rt = new THREE.WebGLRenderTarget(res, res, { type, depthBuffer: false, minFilter: mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: mip });
      rt.texture.generateMipmaps = mip; return rt;
    };
    this.occA = mk(OCC_RES); this.occB = mk(OCC_RES);
    this.S = mk(S_RES, THREE.HalfFloatType, false);
    this.litA = mk(LIT_RES); this.litB = mk(LIT_RES);
    const canvasTex = () => {
      const c = document.createElement('canvas'); c.width = c.height = ALB_RES;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; return t;
    };
    this.wallTex = canvasTex(); this.topTex = canvasTex();

    this.u = {
      uLmOccA: { value: this.occA.texture }, uLmOccB: { value: this.occB.texture },
      uLmLitA: { value: this.litA.texture }, uLmLitB: { value: this.litB.texture },
      uLmWall: { value: this.wallTex }, uLmTop: { value: this.topTex }, uLmS: { value: this.S.texture },
      uLmOn: { value: 1 }, uLmGI: { value: 1 }, uLmSpec: { value: 1 }, uLmRt: { value: 1 }, uLmTexel: { value: 0.5 }, uLmTopY: { value: 200 },
      uLmNear: { value: 140 }, uLmMid: { value: 450 }, uLmSteps: { value: 10 }, uLmNight: { value: 0 }, uLmFarSh: { value: 1 },
      uLmCloudSh: { value: 1 }, uLmClouds: { value: 1 }, uLmTime: { value: 0 }, uLmCones: { value: 6 }, uLmRot: { value: 0 }, uLmRho: { value: 0.4 }, uLmLite: { value: 1 },
      uLmSunDir: { value: new THREE.Vector3(0, 1, 0) }, uLmSunE: { value: new THREE.Vector3() }, uLmSkyE: { value: new THREE.Vector3() },
      uLmSkyTop: { value: new THREE.Vector3() }, uLmSkyHor: { value: new THREE.Vector3() }, uLmGround: { value: new THREE.Vector3() },
    };
    this.skyScale = 0.7; // sky radiance used for lighting relative to the visible dome

    // radiance caches (Lumen-style): double-buffered city-wide cache (for multi-bounce feedback) + double-buffered camera-centred fine clipmap
    const cacheRT = (n) => new THREE.WebGLRenderTarget(n * DIRS, n * LAYERS, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    this.farRT = [cacheRT(FAR_N), cacheRT(FAR_N)]; this.nearRT = [cacheRT(NEAR_N), cacheRT(NEAR_N)];
    Object.assign(this.u, {
      uLmNearC: { value: this.nearRT[0].texture }, uLmFarC: { value: this.farRT[0].texture },
      uLmNearO: { value: new THREE.Vector4(0, 0, NEAR_CELL, NEAR_N) }, uLmFarO: { value: new THREE.Vector4(0, 0, 1, FAR_N) },
      uLmNearSize: { value: new THREE.Vector2(NEAR_N * DIRS, NEAR_N * LAYERS) }, uLmFarSize: { value: new THREE.Vector2(FAR_N * DIRS, FAR_N * LAYERS) },
      uLmNearOn: { value: 0 }, uLmFarOn: { value: 0 },
    });
    const common = { uH: sao.uH, uMinY: sao.uMinY, uYs: sao.uYs };
    this.cacheMat = new THREE.ShaderMaterial({
      uniforms: { ...this.u, ...common, uBox: sao.uBox, uO: { value: new THREE.Vector4() }, uPrev: { value: null }, uPrevSize: { value: new THREE.Vector2(1, 1) }, uAlpha: { value: 1 } }, vertexShader: QVS, depthTest: false, depthWrite: false,
      fragmentShader: CACHE_FS.replace('__LUMINA__', LUMINA_GLSL),
    });
    this.cacheMat.uniforms.uBox = sao.uBox; // keep shared (ShaderMaterial clones uniforms)
    this.cacheMat.uniforms.uH = sao.uH; this.cacheMat.uniforms.uMinY = sao.uMinY; this.cacheMat.uniforms.uYs = sao.uYs;
    for (const k of Object.keys(this.u)) this.cacheMat.uniforms[k] = this.u[k];
    this.farJob = null; this.nearJob = null; this.farFront = 0; this.nearFront = 0; this.nearCentre = new THREE.Vector2(1e9, 1e9);
    this._farBounces = 0;
    this.budget = { far: 96, near: 144 }; // atlas rows per frame

    this.occMat = new THREE.ShaderMaterial({
      uniforms: { ...common, uTh: { value: new THREE.Vector4() } }, vertexShader: QVS, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D uH;uniform float uMinY,uYs;uniform vec4 uTh;varying vec2 v;void main(){float h=texture2D(uH,v).r*uYs+uMinY;gl_FragColor=step(uTh,vec4(h));}',
    });
    this.sMat = new THREE.ShaderMaterial({
      uniforms: { ...common, uBox: sao.uBox, uSun: { value: new THREE.Vector3(0, 1, 0) } }, vertexShader: QVS, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D uH;uniform float uMinY,uYs;uniform vec4 uBox;uniform vec3 uSun;varying vec2 v;
        void main(){
          float h0 = texture2D(uH, v).r * uYs + uMinY, S = h0, tHit = 0., hMax = h0;
          float px = 1. / ${S_RES}.;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            hMax = max(hMax, texture2D(uH, v + vec2(float(i), float(j)) * px).r * uYs + uMinY);
          }
          vec2 d = uSun.xz; float l = length(d);
          if (l > 1e-3) {
            d /= l; float tanE = uSun.y / l; vec2 duv = vec2(d.x, -d.y) / uBox.z; float t = .4, top = uMinY + uYs;
            for (int i = 0; i < 200; i++) {
              vec2 q = v + duv * t;
              if (q.x < 0. || q.y < 0. || q.x > 1. || q.y > 1. || t * tanE > top - S + 1.) break;
              float hRay = texture2D(uH, q).r * uYs + uMinY - t * tanE;
              if (hRay > S) { S = hRay; tHit = t; }
              t += .4 + t * .018;
            }
          }
          gl_FragColor = vec4(S, tHit, hMax, 1.);
        }`,
    });
    this.litMat = new THREE.ShaderMaterial({
      uniforms: { uS: { value: this.S.texture }, uTh: { value: new THREE.Vector4() } }, vertexShader: QVS, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D uS;uniform vec4 uTh;varying vec2 v;void main(){float s=texture2D(uS,v).r;gl_FragColor=step(vec4(s),uTh);}',
    });
    this.TH_A = LM_TH.slice(0, 4); this.TH_B = LM_TH.slice(4);
    this.quad = new FullScreenQuad(null);
    this.occMat.name = 'occupancy'; this.sMat.name = 'shadow-height'; this.litMat.name = 'sun-visibility'; this.cacheMat.name = 'radiance-cache';
  }

  /* ---------- radiance cache scheduling ---------- */
  _runRows(job, rows) {
    const rt = job.rt, W = rt.width, H = rt.height, y0 = job.row, h = Math.min(rows, H - y0);
    const cu = this.cacheMat.uniforms; cu.uO.value.copy(job.O);
    cu.uPrev.value = job.prev; cu.uPrevSize.value.set(W, H); cu.uAlpha.value = job.alpha;
    this.u.uLmCones.value = job.cones; this.u.uLmRot.value = job.rot;
    rt.scissor.set(0, y0, W, h); rt.scissorTest = true;
    this._pass(this.cacheMat, rt);
    rt.scissorTest = false;
    job.row += h;
    return job.row >= H;
  }
  /** start (or restart) cache jobs. far: whole city (2-pass multi-bounce); near: around the camera */
  invalidate() { this._farPending = true; this._nearPending = true; this._farBounces = this.lite ? 0 : 1; this._farConv = this.lite ? 6 : 0; this._nearConv = this.lite ? 4 : 0; } // running jobs finish first, then re-run
  updateCaches(camPos, full = false) {
    if (!this.ready) return;
    const box = this.sao.uBox.value, lite = this.lite, U = this.u, rotNext = () => hal2(++this._hp) * 6.2832;
    const farJob = () => ({ rt: this.farRT[1 - this.farFront], O: new THREE.Vector4(box.x, box.y - box.w, box.z / FAR_N, FAR_N), row: 0,
      prev: this.farRT[this.farFront].texture, cones: lite && !full ? 2 : 6, alpha: lite && !full && U.uLmFarOn.value > .5 ? 0.3 : 1, rot: rotNext() });
    if (this._farPending && !this.farJob) { this._farPending = false; this.farJob = farJob(); }
    if (this.farJob && this._runRows(this.farJob, full ? 1e9 : this.budget.far)) {
      this.farFront = 1 - this.farFront;
      U.uLmFarC.value = this.farRT[this.farFront].texture; U.uLmFarO.value.copy(this.farJob.O); U.uLmFarOn.value = 1;
      this.farJob = null;
      if (this._farBounces > 0) { // legacy second bounce pass
        this._farBounces--; this._farPending = true; this._nearPending = true;
        if (full) {
          this.farJob = farJob(); this._farPending = false; this._runRows(this.farJob, 1e9);
          this.farFront = 1 - this.farFront; U.uLmFarC.value = this.farRT[this.farFront].texture; this.farJob = null;
        }
      } else if (lite) { // Lite: a few cheap convergence passes, then the cache goes idle (cost ~ 0 for a static scene)
        if (full) this._farConv = 0;
        if (this._farConv > 0) { this._farConv--; this._farPending = true; }
      }
    }
    // near clipmap: recentre when the camera moved, regenerate into the back buffer, then swap
    const snap = (v) => Math.round(v / (NEAR_CELL * 4)) * NEAR_CELL * 4;
    const cx = snap(camPos.x), cz = snap(camPos.z), moved = Math.hypot(cx - this.nearCentre.x, cz - this.nearCentre.y) > 14;
    if (camPos.y > 160) { U.uLmNearOn.value = 0; return; } // high above the city the coarse cache is enough
    if (!this.nearJob && (moved || this._nearPending)) {
      this._nearPending = false;
      const half = (NEAR_N * NEAR_CELL) / 2, fresh = moved || U.uLmNearOn.value < .5;
      this.nearJob = { rt: this.nearRT[1 - this.nearFront], O: new THREE.Vector4(cx - half, cz - half, NEAR_CELL, NEAR_N), row: 0, centre: new THREE.Vector2(cx, cz),
        prev: this.nearRT[this.nearFront].texture, cones: lite && !full && !fresh ? 2 : 6, alpha: lite && !full && !fresh ? 0.25 : 1, rot: rotNext() };
      if (fresh) this._nearConv = 0; // recentred map is built at full quality, so no noisy follow-up passes while the camera moves
    }
    if (this.nearJob && this._runRows(this.nearJob, full ? 1e9 : this.budget.near)) {
      this.nearFront = 1 - this.nearFront;
      U.uLmNearC.value = this.nearRT[this.nearFront].texture; U.uLmNearO.value.copy(this.nearJob.O);
      this.nearCentre.copy(this.nearJob.centre); U.uLmNearOn.value = 1; this.nearJob = null;
      if (lite) { if (full) this._nearConv = 0; if (this._nearConv > 0) { this._nearConv--; this._nearPending = true; } }
    }
  }
  get cacheBusy() { return !!(this.farJob || this.nearJob); }

  _pass(mat, rt) {
    const R = this.R, prev = R.getRenderTarget();
    try { this.quad.material = mat; R.setRenderTarget(rt); this.quad.render(R); } catch (e) { R.setRenderTarget(prev); throw new Error('Lumina pass "' + (mat.name || '?') + '" (' + rt.width + 'x' + rt.height + ') failed: ' + (e && e.message || e)); }
    R.setRenderTarget(prev);
  }

  /** albedo of every material layer (linear), from the generated textures */
  setAlbedo(avg) { this.avg = avg; }
  setCity(layout) { this.layout = layout; }

  /** after the height map was rendered: occupancy pyramid, surface cache, sun visibility */
  rebuild() {
    const box = this.sao.uBox.value;
    this.u.uLmTexel.value = box.z / OCC_RES;
    this.u.uLmTopY.value = this.sao.uMinY.value + this.sao.uYs.value + 2;
    this.occMat.uniforms.uTh.value.fromArray(this.TH_A); this._pass(this.occMat, this.occA);
    this.occMat.uniforms.uTh.value.fromArray(this.TH_B); this._pass(this.occMat, this.occB);
    this._drawSurfaceCache(box);
    this.sunDirty = true; this.ready = !!(this.layout && this.avg);
    this.invalidate();
  }

  updateSun(dir, force) {
    if (!force && !this.sunDirty && dir.angleTo(this._lastSun) < 0.004) return;
    this._lastSun.copy(dir); this.sunDirty = false;
    this.sMat.uniforms.uSun.value.copy(dir);
    this._pass(this.sMat, this.S);
    this.litMat.uniforms.uTh.value.fromArray(this.TH_A); this._pass(this.litMat, this.litA);
    this.litMat.uniforms.uTh.value.fromArray(this.TH_B); this._pass(this.litMat, this.litB);
    this.invalidate(); // lighting changed: re-gather (progressively)
  }

  /** per-frame lighting uniforms (sun, sky) */
  setLighting(sunDir, sunColor, sunIntensity, skyTop, skyHor, night) {
    const u = this.u, k = this.skyScale;
    u.uLmSunDir.value.copy(sunDir);
    u.uLmSunE.value.set(sunColor.r, sunColor.g, sunColor.b).multiplyScalar(sunIntensity);
    u.uLmSkyTop.value.set(skyTop.r, skyTop.g, skyTop.b).multiplyScalar(k);
    u.uLmSkyHor.value.set(skyHor.r, skyHor.g, skyHor.b).multiplyScalar(k);
    u.uLmSkyE.value.copy(u.uLmSkyTop.value).multiplyScalar(0.55).addScaledVector(u.uLmSkyHor.value, 0.45).multiplyScalar(Math.PI);
    const desat = (v, k) => { const l = v.x * 0.2126 + v.y * 0.7152 + v.z * 0.0722; v.set(l + (v.x - l) * k, l + (v.y - l) * k, l + (v.z - l) * k); };
    desat(u.uLmSkyE.value, 0.55); desat(u.uLmSkyTop.value, 0.7); desat(u.uLmSkyHor.value, 0.7);
    const g = this.avg ? this.avg[L.ASPHALT] : [0.08, 0.08, 0.08];
    const gE = u.uLmSunE.value.clone().multiplyScalar(Math.max(sunDir.y, 0)).add(u.uLmSkyE.value).multiplyScalar(1 / Math.PI);
    u.uLmGround.value.set(g[0] * 2 * gE.x, g[1] * 2 * gE.y, g[2] * 2 * gE.z);
    u.uLmNight.value = night;
  }

  _drawSurfaceCache(box) {
    if (!this.layout || !this.avg) return;
    const N = ALB_RES, W = box.z, x0 = box.x, z0 = box.y - box.w, A = this.avg;
    const X = (x) => ((x - x0) / W) * N, Z = (z) => ((z - z0) / W) * N;
    const col = (c, a = 1) => `rgba(${Math.round(Math.min(1, c[0]) * 255)},${Math.round(Math.min(1, c[1]) * 255)},${Math.round(Math.min(1, c[2]) * 255)},${a})`;
    const poly = (g, P) => { g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.closePath(); };
    const corners = (b) => { const c = Math.cos(b.angle), s = Math.sin(b.angle); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const lx = (u * b.w) / 2, lz = (v * b.d) / 2; return [b.cx + lx * c + lz * s, b.cz - lx * s + lz * c]; }); };
    const WIN = { haussmann: [0.3, [0.05, 0.05, 0.05]], brick: [0.3, [0.05, 0.05, 0.05]], office: [0.45, [0.08, 0.1, 0.12]], tower: [0.85, [0.12, 0.16, 0.2]], townhouse: [0.2, [0.05, 0.05, 0.05]] };
    // top surfaces
    const top = this.topTex.image.getContext('2d');
    top.fillStyle = col(A[L.ASPHALT]); top.fillRect(0, 0, N, N);
    for (const b of this.layout.blocks) {
      top.fillStyle = col(A[L.PAVERS]); poly(top, b.curb); top.fill();
      if (b.lawn) { top.fillStyle = col(A[L.GRASS]); poly(top, b.lot); top.fill(); }
    }
    for (const b of this.layout.buildings) {
      if (b.demolished) continue;
      const r = A[b.roofLayer]; top.fillStyle = col(r); poly(top, corners(b)); top.fill();
    }
    // facades: footprint + a 2 m band around it, premultiplied by coverage (transparent elsewhere)
    const wall = this.wallTex.image.getContext('2d');
    wall.clearRect(0, 0, N, N); wall.lineJoin = 'round'; wall.lineWidth = (2 / W) * N * 2;
    for (const b of this.layout.buildings) {
      if (b.demolished) continue;
      const [wf, wc] = WIN[b.style], a = A[b.wall];
      const c = [0, 1, 2].map((i) => a[i] * b.tint[i] * (1 - wf) + wc[i] * wf);
      wall.fillStyle = wall.strokeStyle = col(c); poly(wall, corners(b)); wall.fill(); wall.stroke();
    }
    this.topTex.needsUpdate = true; this.wallTex.needsUpdate = true;
  }

  dispose() { [this.occA, this.occB, this.S, this.litA, this.litB, ...this.farRT, ...this.nearRT].forEach((r) => r.dispose()); this.wallTex.dispose(); this.topTex.dispose(); }
}

return {LM_TH,LUMINA_GLSL,LUMINA_APPLY,Lumina};
})();

export { LM_TH, LUMINA_GLSL, LUMINA_APPLY, Lumina };
