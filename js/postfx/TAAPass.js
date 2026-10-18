// Temporal AA / temporal upscaling pass
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

const {TAAPass} = (() => {
// Temporal Super Resolution & Anti-Aliasing (DLSS / UE5 TSR style):
// Sub-pixel Halton jitter, low-to-high resolution temporal reconstruction, 5-tap Catmull-Rom
// upsampling, YCoCg velocity-adaptive variance clipping, and Contrast-Adaptive Sharpening (CAS).


const VS = 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const JITTER = Array.from({ length: 16 }, (_, i) => [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5]);

const RESOLVE = /* glsl */`
uniform sampler2D tDiffuse, tHistory, tDepth;
uniform mat4 uInvProj, uCamWorld, uPrevVP;
uniform vec2 uRes, uInRes, uJitter;
uniform float uValid, uAlpha;
varying vec2 v;
vec3 toYC(vec3 c) { return vec3(dot(c, vec3(.25, .5, .25)), dot(c, vec3(.5, 0., -.5)), dot(c, vec3(-.25, .5, -.25))); }
vec3 fromYC(vec3 y) { return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }
vec3 tm(vec3 c) { return c / (1. + max(c.r, max(c.g, c.b))); }          // reversible tonemap (Karis)
vec3 itm(vec3 c) { return c / max(1. - max(c.r, max(c.g, c.b)), 1e-4); }
vec3 sampleCR(sampler2D tex, vec2 uv, vec2 res) { // 5-tap Catmull-Rom: sharp upsampling without ringing
  vec2 sp = uv * res, tp = floor(sp - .5) + .5, f = sp - tp;
  vec2 w0 = f * (-.5 + f * (1. - .5 * f)), w1 = 1. + f * f * (-2.5 + 1.5 * f), w2 = f * (.5 + f * (2. - 1.5 * f)), w3 = f * f * (-.5 + .5 * f);
  vec2 w12 = w1 + w2, o12 = w2 / max(w12, 1e-5);
  vec2 t0 = (tp - 1.) / res, t3 = (tp + 2.) / res, t12 = (tp + o12) / res;
  vec3 r = texture2D(tex, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y)
         + texture2D(tex, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y)
         + texture2D(tex, t12).rgb * (w12.x * w12.y)
         + texture2D(tex, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
         + texture2D(tex, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
  return r / (w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y);
}
vec3 clipBox(vec3 q, vec3 mn, vec3 mx) {
  vec3 c = .5 * (mx + mn), e = .5 * (mx - mn) + 1e-4, d = q - c, a = abs(d / e);
  float m = max(a.x, max(a.y, a.z));
  return m > 1. ? c + d / m : q;
}
void main() {
  vec2 pxIn = 1. / uInRes;
  float scale = uInRes.x / max(uRes.x, 1.);
  bool upscaling = scale < 0.96;
  // Un-jittered Catmull-Rom reconstruction when DLSS upscaling is active
  vec2 uvIn = upscaling ? clamp(v + uJitter * pxIn * 0.35, vec2(0.), vec2(1.)) : v;
  vec3 cur = upscaling ? max(sampleCR(tDiffuse, uvIn, uInRes), 0.) : texture2D(tDiffuse, v).rgb;
  if (uValid < .5) { gl_FragColor = vec4(cur, 1.); return; }
  vec3 m1 = vec3(0.), m2 = vec3(0.); float dMin = 1.; vec2 oMin = vec2(0.);
  vec3 mn = vec3(1e4), mx = vec3(-1e4), mnC = vec3(1e4), mxC = vec3(-1e4);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec3 c_raw = texture2D(tDiffuse, v + o * pxIn).rgb;
    vec3 s = toYC(tm(c_raw));
    m1 += s; m2 += s * s;
    mn = min(mn, s); mx = max(mx, s);
    if (i == 0 || j == 0) { mnC = min(mnC, s); mxC = max(mxC, s); }
    float d = texture2D(tDepth, v + o * pxIn).r; if (d < dMin) { dMin = d; oMin = o; }
  }
  mn = mix(mn, mnC, 0.5); mx = mix(mx, mxC, 0.5);
  vec3 mu = m1 / 9., sig = sqrt(max(m2 / 9. - mu * mu, 0.));
  // reproject the closest-depth neighbour using unjittered matrices (vel == 0 when camera is stationary)
  vec2 uvD = v + oMin * pxIn;
  vec4 vp = uInvProj * vec4(uvD * 2. - 1., dMin * 2. - 1., 1.); vp /= vp.w;
  vec4 pc = uPrevVP * (uCamWorld * vec4(vp.xyz, 1.));
  vec2 vel = (pc.xy / pc.w * .5 + .5) - uvD, prevUV = v + vel;
  if (pc.w <= 0. || any(lessThan(prevUV, vec2(0.))) || any(greaterThan(prevUV, vec2(1.)))) { gl_FragColor = vec4(cur, 1.); return; }
  float vLen = length(vel * uRes);
  vec3 hRaw = vLen < 0.02 ? texture2D(tHistory, v).rgb : sampleCR(tHistory, prevUV, uRes);
  vec3 h = toYC(tm(max(hRaw, 0.)));
  // Velocity-adaptive Karis variance clipping: wide when stationary (accumulates sub-pixel DLSS detail), tight on motion
  float motion = clamp(vLen / 1.5, 0., 1.);
  float gamma = mix(upscaling ? 2.6 : 2.2, 0.85, motion);
  vec3 boxMin = mix(mn - sig * 0.55, max(mn, mu - sig * gamma), motion);
  vec3 boxMax = mix(mx + sig * 0.55, min(mx, mu + sig * gamma), motion);
  h = clipBox(h, boxMin, boxMax);
  if (vLen > 0.15) h = clamp(h, mn, mx);
  // DLSS sub-pixel sample confidence weight
  vec2 subOff = fract(v * uInRes - uJitter - 0.5) - 0.5;
  float subW = upscaling ? mix(0.45, 1.15, exp(-dot(subOff, subOff) * 2.8)) * clamp(scale * 1.15, 0.45, 1.0) : 1.0;
  float a = mix(uAlpha * subW, 0.65, clamp(vLen / 2.5, 0., 1.));
  gl_FragColor = vec4(itm(fromYC(mix(h, toYC(tm(cur)), a))), 1.);
}`;

const SHARPEN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uRes; uniform float uSharp; varying vec2 v;
vec3 tm(vec3 c) { return c / (1. + max(c.r, max(c.g, c.b))); }
vec3 itm(vec3 c) { return c / max(1. - max(c.r, max(c.g, c.b)), 1e-4); }
void main() {
  vec2 px = 1. / uRes;
  vec3 c = tm(texture2D(tSrc, v).rgb);
  vec3 n = tm(texture2D(tSrc, v + vec2(0., px.y)).rgb), s = tm(texture2D(tSrc, v - vec2(0., px.y)).rgb);
  vec3 e = tm(texture2D(tSrc, v + vec2(px.x, 0.)).rgb), w = tm(texture2D(tSrc, v - vec2(px.x, 0.)).rgb);
  vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
  // Contrast-Adaptive Sharpening (CAS): sharpens surface textures while preserving anti-aliased high-contrast edges
  vec3 amp = sqrt(clamp(min(mn, 1. - mx) / max(mx, 1e-4), 0., 1.));
  vec3 sharp = clamp(c + (c - (n + s + e + w) * .25) * (uSharp * amp * 1.35), mn, mx);
  gl_FragColor = vec4(itm(sharp), 1.);
}`;

class TAAPass extends Pass {
  constructor(camera, depthTexture, comp = null) {
    super();
    this.camera = camera; this.comp = comp;
    this.frame = 0; this.cur = 0; this.valid = false; this.still = 0; this._lastM = new THREE.Matrix4();
    this.unjit = new THREE.Matrix4(); this.unjitInv = new THREE.Matrix4();
    this.prevVP = new THREE.Matrix4(); this.prevPos = new THREE.Vector3(1e9, 0, 0);
    this.hist = [null, null]; this.size = new THREE.Vector2();
    this.u = {
      tDiffuse: { value: null }, tHistory: { value: null }, tDepth: { value: depthTexture },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() },
      uRes: { value: new THREE.Vector2(1, 1) }, uInRes: { value: new THREE.Vector2(1, 1) }, uJitter: { value: new THREE.Vector2(0, 0) },
      uValid: { value: 0 }, uAlpha: { value: 0.08 },
    };
    this.su = { tSrc: { value: null }, uRes: this.u.uRes, uSharp: { value: 0.35 } };
    this.resolve = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: RESOLVE, depthTest: false, depthWrite: false }));
    this.sharpen = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: this.su, vertexShader: VS, fragmentShader: SHARPEN, depthTest: false, depthWrite: false }));
  }

  reset() { this.valid = false; this.still = 0; }

  /** jitter the projection matrix by a sub-pixel Halton offset (w, h = internal render-target size) */
  begin(w, h) {
    const cam = this.camera, P = cam.projectionMatrix, j = JITTER[this.frame % JITTER.length];
    this.unjit.copy(P);
    this.unjitInv.copy(P).invert();
    this.u.uJitter.value.set(j[0], j[1]);
    P.elements[8] += (2 * j[0]) / w; P.elements[9] += (2 * j[1]) / h;
    cam.projectionMatrixInverse.copy(P).invert();
  }
  end() {
    this.camera.projectionMatrix.copy(this.unjit);
    this.camera.projectionMatrixInverse.copy(this.unjitInv);
  }

  setSize(w, h) {
    if (this.size.x === w && this.size.y === h) return;
    this.size.set(w, h); this.u.uRes.value.set(w, h);
    this.hist.forEach((r) => r && r.dispose());
    this.hist = [0, 1].map(() => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }));
    this.valid = false;
  }

  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera, u = this.u;
    const wOut = this.comp && this.comp._hiRT1 ? this.comp._hiRT1.width : readBuffer.width;
    const hOut = this.comp && this.comp._hiRT1 ? this.comp._hiRT1.height : readBuffer.height;
    if (!this.hist[0] || this.size.x !== wOut || this.size.y !== hOut) this.setSize(wOut, hOut);
    u.uInRes.value.set(readBuffer.width, readBuffer.height);
    if (cam.position.distanceTo(this.prevPos) > 20) this.valid = false; // teleport / city rebuild
    // adaptive accumulation: while the camera is still, history weight shrinks (1/N-like) so jittered samples converge toward a true supersampled image
    const moved = !this._lastM.equals(cam.matrixWorld); this._lastM.copy(cam.matrixWorld);
    this.still = moved ? 0 : Math.min(this.still + 1, 96);
    u.uAlpha.value = moved ? 0.08 : Math.max(0.035, 0.96 / (this.still + 12));
    u.tDiffuse.value = readBuffer.texture; u.tHistory.value = this.hist[this.cur].texture;
    u.uInvProj.value.copy(this.unjitInv); u.uCamWorld.value.copy(cam.matrixWorld);
    u.uPrevVP.value.copy(this.prevVP); u.uValid.value = this.valid ? 1 : 0;
    const next = 1 - this.cur;
    renderer.setRenderTarget(this.hist[next]); this.resolve.render(renderer);
    this.su.tSrc.value = this.hist[next].texture;
    // Switch composer buffers to native output resolution (non-MSAA) for all downstream post passes
    if (this.comp && this.comp._hiRT1) {
      this.comp.writeBuffer = this.comp._hiRT1;
      this.comp.readBuffer = this.comp._hiRT2;
      writeBuffer = this.comp.writeBuffer;
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.sharpen.render(renderer);
    this.cur = next; this.valid = true; this.frame++;
    this.prevVP.multiplyMatrices(this.unjit, cam.matrixWorldInverse); this.prevPos.copy(cam.position);
  }

  dispose() { this.hist.forEach((r) => r && r.dispose()); this.resolve.dispose(); this.sharpen.dispose(); }
}

return {TAAPass};
})();

export { TAAPass };
