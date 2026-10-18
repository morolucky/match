// LevelLighting: sky, shadows, SSAO/SSR, bloom, AA and Lumina orchestration
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AutoExposurePass } from '../postfx/AutoExposurePass.js';
import { TAAPass } from '../postfx/TAAPass.js';
import { LUMINA_APPLY, LUMINA_GLSL, Lumina } from './Lumina.js';

const {SAO_GLSL,LevelLighting} = (() => {
/**
 * LevelLighting — ported from "LevelLighting – reusable lighting kit" (three r160) and extended for a city:
 *  - procedural sky dome + PMREM sky IBL, sun with camera-following, texel-snapped shadow frustum
 *  - day/night cycle (sun/moon, sky gradient, stars, fog, night factor uniform for emissive windows & lamps)
 *  - live GI probe (throttled), geometry-derived contact AO (half-float top-down height map)
 *  - SSAO, screen-space colour bleed, bloom, SMAA, colour grade
 */












const VS = 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';

// contact AO: samples the level's top-down height map around the shaded point (from the lighting kit)
const SAO_GLSL = `uniform sampler2D uH;uniform vec4 uBox;uniform float uMinY,uYs,uR,uStr;
vec3 saoC(vec3 p,vec3 n){float R=uR;vec2 c=p.xz+n.xz*R;float occ=0.,ws=0.;
for(int i=0;i<16;i++){float f=float(i)+.5;float a=f*2.39996;float r=sqrt(f/16.)*R*.9;vec2 q=c+vec2(cos(a),sin(a))*r;
vec2 uv=vec2((q.x-uBox.x)/uBox.z,(uBox.y-q.y)/uBox.w);float H=texture2D(uH,uv).r*uYs+uMinY;float w=1.-r/R;
occ+=clamp((H-p.y-.2)/(R*.8),0.,1.)*w;ws+=w;}
occ/=ws;float gr=(1.-smoothstep(0.,R*.7,p.y-uMinY))*(1.-abs(n.y));
float ao=1.-uStr*clamp(occ*1.15+gr*.6,0.,1.)*.75;
return mix(vec3(.5,.36,.27),vec3(1.),smoothstep(.2,1.,ao));}`;

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class LevelLighting {
  constructor(renderer, scene, camera, opts = {}) {
    const o = this.opts = { shadowMap: 4096, probeSize: 128, probeDistance: 30, probeInterval: 1.2, aoMapSize: 2048, ...opts };
    const R = this.R = renderer, cam = this.cam = camera;
    this.scene = scene;
    this.params = {
      exposure: 1, autoExposure: true, bloom: 0.32, saturation: 1.22, bounce: 0.25, contactAO: 0.55, ssao: false, probe: false,
      time: 17.0, sunAzOffset: 0, shadowRadius: 220,
      aa: 'taa', dlss: 1.0, sharpen: 0.45, lumina: true, gi: 1.15, spec: 1.25, fog: 1, godRays: 1.2, glare: 1, clouds: 1,
      ssr: 0.85, gtao: 0.65, cloudShadows: 1, dof: 0, chroma: 0, grain: 0, wet: 0, rt: 1,
      trr: true, rtSteps: 36, rtDist: 700,
    };
    this.uniforms = { uNight: { value: 0 } }; // shared with city materials
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace;

    this.level = new THREE.Group(); this.level.name = 'level'; scene.add(this.level);
    this.trees = null;
    this.sv = new THREE.Vector3(0, 1, 0); this.lastProbe = new THREE.Vector3(1e9, 0, 0); this._probeT = 0;
    this.focus = new THREE.Vector3();
    this._levelBox = new THREE.Box3(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 10, 50));

    // visible sky: gradient dome following the camera, with volumetric 3D cloud strata, sun glow and night stars
    this.domeU = {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color() }, uNight: this.uniforms.uNight, uClouds: { value: 1 }, uTime: { value: 0 },
    };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.domeU,
      vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform vec3 uTop,uHor,uSun,uSunCol;uniform float uNight,uClouds,uTime;varying vec3 p;
        float h3(vec3 x){return fract(sin(dot(x,vec3(127.1,311.7,74.7)))*43758.5453);}
        float h2(vec2 q){q=fract(q*vec2(123.34,456.21));q+=dot(q,q+45.32);return fract(q.x*q.y);}
        float vn(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.),f.x),f.y);}
        float fbm(vec2 q){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(q);q=q*2.03+vec2(1.7,9.2);a*=.5;}return s;}
        void main(){vec3 d=normalize(p);float h=clamp(d.y,0.,1.);vec3 sunD=normalize(uSun);
        vec3 c=mix(uHor,uTop,pow(smoothstep(0.,.55,h),.85));
        if(d.y<0.)c=uHor*mix(1.,.55,smoothstep(0.,-.2,d.y));
        float s=max(dot(d,sunD),0.);
        c+=uSunCol*(pow(s,700.)*28.+pow(s,16.)*.32+pow(s,3.)*.14)*(1.-uNight);
        if(d.y>0.&&uClouds>0.){ // UE5-style multi-layered volumetric cloud strata with Beer-Powder scattering
          vec2 wind=vec2(uTime*.004,uTime*.0015);
          vec2 cp=d.xz/(d.y+.11)*1.45+wind;
          vec2 sunStep=sunD.xz*0.045;
          float n0=fbm(cp)*.62+fbm(cp*2.6+3.1)*.26+fbm(cp*6.2-1.7)*.12;
          float nSun=fbm(cp+sunStep)*.65+fbm((cp+sunStep)*2.6+3.1)*.35;
          float cov=smoothstep(.48,.78,n0)*smoothstep(0.,.16,d.y)*uClouds;
          float shadow=clamp((nSun-n0)*3.2+smoothstep(.52,.92,n0)*.65,0.,1.);
          float powder=1.-exp(-cov*3.2);
          float hg=pow(s,6.)*.85+pow(s,2.)*.25+.15;
          vec3 cloudAmb=mix(uTop*.55+uHor*.45,vec3(.02,.028,.045),uNight*.92);
          vec3 cloudSun=uSunCol*(1.9*hg*(1.-shadow*.72)*(0.6+0.4*powder))*(1.-uNight*.9);
          vec3 lit=cloudAmb*(1.-shadow*.42)+cloudSun;
          c=mix(c,lit,clamp(cov,0.,1.));
        }
        vec3 g=floor(d*420.);float st=step(.9985,h3(g))*smoothstep(.05,.3,d.y)*uNight;c+=vec3(st*1.6);
        gl_FragColor=vec4(c,1.);}`,
    }));
    this.dome.renderOrder = -1; this.dome.frustumCulled = false; scene.add(this.dome);

    // physical sky used only for the environment light
    this.sky = new Sky(); this.sky.scale.setScalar(4e5);
    const U = this.sky.material.uniforms; U.turbidity.value = 2.2; U.rayleigh.value = 2.4; U.mieCoefficient.value = 0.002; U.mieDirectionalG.value = 0.8;
    this.envScene = new THREE.Scene(); this.envScene.add(this.sky);
    this.pm = new THREE.PMREMGenerator(R);
    scene.fog = null; // atmosphere is a post pass (height fog + god rays)
    this.fogColor = new THREE.Color();

    // lights
    const s = this.sun = new THREE.DirectionalLight(0xfff0d8, 4.5); s.castShadow = true;
    s.shadow.mapSize.set(o.shadowMap, o.shadowMap); s.shadow.bias = -0.0003; s.shadow.radius = 2;
    this.hemi = new THREE.HemisphereLight(0xd8dce6, 0x8a7a68, 0.25);
    this.amb = new THREE.AmbientLight(0xffe0c0, 0.2);
    scene.add(s, s.target, this.hemi, this.amb);

    // live GI probe
    this.cubeRT = new THREE.WebGLCubeRenderTarget(o.probeSize, { type: THREE.HalfFloatType });
    this.cube = new THREE.CubeCamera(0.5, 3000, this.cubeRT); scene.add(this.cube);

    // contact-AO height map (half float: tall towers would band in 8 bit)
    this.sao = { uH: { value: null }, uBox: { value: new THREE.Vector4() }, uMinY: { value: 0 }, uYs: { value: 1 }, uR: { value: 4 }, uStr: { value: 0.7 } };
    this.hRT = new THREE.WebGLRenderTarget(o.aoMapSize, o.aoMapSize, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.sao.uH.value = this.hRT.texture;
    this.lumina = new Lumina(R, this.sao);
    this.hMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: { y0: this.sao.uMinY, ys: this.sao.uYs },
      vertexShader: `uniform float y0,ys;varying float h;void main(){vec4 w=vec4(position,1.);
        #ifdef USE_INSTANCING
        w=instanceMatrix*w;
        #endif
        w=modelMatrix*w;h=(w.y-y0)/ys;gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader: 'varying float h;void main(){gl_FragColor=vec4(clamp(h,0.,1.),0.,0.,1.);}',
    });

    // post stack
    const sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio();
    this._w = sz.x; this._h = sz.y;
    const w0 = Math.max(1, Math.round(sz.x * pr)), h0 = Math.max(1, Math.round(sz.y * pr));
    this.inRes = { w: w0, h: h0, wOut: w0, hOut: h0, scale: 1 };
    const comp = this.comp = new EffectComposer(R);
    comp._hiRT1 = comp.renderTarget1; comp._hiRT2 = comp.renderTarget2;
    comp._loRT1 = comp.renderTarget1.clone(); comp._loRT2 = comp.renderTarget2.clone();
    comp._loRT1.samples = 4; comp._loRT2.samples = 4;
    comp.addPass(new RenderPass(scene, cam));
    const ssao = this.ssao = new SSAOPass(scene, cam, w0, h0);
    ssao.kernelRadius = 1.5; ssao.minDistance = 0.00002; ssao.maxDistance = 0.0012; comp.addPass(ssao);
    ssao.render = (...a) => { // keep thin / transparent helpers out of the normal pass & keep projection matrices synced
      for (const m of [ssao.ssaoMaterial, ssao.depthRenderMaterial]) {
        m.uniforms.cameraNear.value = cam.near;
        m.uniforms.cameraFar.value = cam.far;
      }
      ssao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(cam.projectionMatrix);
      ssao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(cam.projectionMatrixInverse);
      const h = [], hide = (x) => { if (x.visible) { x.visible = false; h.push(x); } };
      scene.traverse((x) => { if (x.isPoints || x.isSprite || x.userData.isLodFade || x.name === 'trees' || (x.material && !Array.isArray(x.material) && (x.material.transparent || x.material.alphaTest > 0 || x.material.colorWrite === false))) hide(x); });
      hide(this.dome); R.shadowMap.autoUpdate = false;

      const [renderer, writeBuffer, readBuffer] = a;
      // 1. Render normal and depth of the scene (buildings, streets, props)
      ssao.overrideVisibility();
      ssao.renderOverride(renderer, ssao.normalMaterial, ssao.normalRenderTarget, 0x7777ff, 1.0);
      ssao.restoreVisibility();

      // 2. Render trees with alpha-tested normal materials into normalRenderTarget (keeping depth & normals)
      if (this.trees) {
        renderer.setRenderTarget(ssao.normalRenderTarget);
        renderer.autoClear = false;
        this.trees.renderNormal(renderer, cam);
        renderer.autoClear = true;
      }

      // 3. Compute SSAO if enabled, or pass through readBuffer
      if (this.params.ssao) {
        ssao.ssaoMaterial.uniforms['kernelRadius'].value = ssao.kernelRadius;
        ssao.ssaoMaterial.uniforms['minDistance'].value = ssao.minDistance;
        ssao.ssaoMaterial.uniforms['maxDistance'].value = ssao.maxDistance;
        ssao.renderPass(renderer, ssao.ssaoMaterial, ssao.ssaoRenderTarget);
        ssao.renderPass(renderer, ssao.blurMaterial, ssao.blurRenderTarget);
        ssao.copyMaterial.uniforms['tDiffuse'].value = readBuffer.texture;
        ssao.copyMaterial.blending = THREE.NoBlending;
        ssao.renderPass(renderer, ssao.copyMaterial, ssao.renderToScreen ? null : writeBuffer);
        ssao.copyMaterial.uniforms['tDiffuse'].value = ssao.blurRenderTarget.texture;
        ssao.copyMaterial.blending = THREE.CustomBlending;
        ssao.renderPass(renderer, ssao.copyMaterial, ssao.renderToScreen ? null : writeBuffer);
      } else {
        ssao.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
        ssao.copyMaterial.blending = THREE.NoBlending;
        ssao.renderPass(renderer, ssao.copyMaterial, writeBuffer);
      }
      R.shadowMap.autoUpdate = true; h.forEach((x) => (x.visible = true));
    };

    // UE5-style GTAO (Ground Truth Ambient Occlusion + Multi-Bounce) & Smart Hybrid Ray-Traced Reflections (HSSR)
    this.ssr = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, tNormal: { value: null },
        uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uSsr: { value: 0.85 }, uGtao: { value: 0.65 }, uWet: { value: 0 }, uFrame: { value: 0 }, uRt: { value: 1.0 },
        uTrr: { value: 1.0 }, uRtSteps: { value: 36.0 }, uRtDist: { value: 700.0 },
        uH: { value: null }, uBox: { value: new THREE.Vector4() }, uMinY: { value: 0 }, uYs: { value: 1 },
        uLmS: { value: null }, uLmWall: { value: null }, uLmTop: { value: null },
        uLmSunDir: { value: new THREE.Vector3() }, uLmSunE: { value: new THREE.Vector3() },
        uLmSkyHor: { value: new THREE.Vector3() }, uLmSkyTop: { value: new THREE.Vector3() },
        uLmTopY: { value: 200 }, uNight: this.uniforms.uNight,
      }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse,tDepth,tNormal;
        uniform sampler2D uH,uLmS,uLmWall,uLmTop;
        uniform vec4 uBox;
        uniform float uMinY,uYs,uLmTopY,uNight,uRt,uTrr,uRtSteps,uRtDist;
        uniform vec3 uLmSunDir,uLmSunE,uLmSkyHor,uLmSkyTop,uCamPos;
        uniform mat4 uProj,uInvProj,uCamWorld;
        uniform float uSsr,uGtao,uWet,uFrame;varying vec2 v;

        vec3 getVP(vec2 uv,float z){vec4 p=uInvProj*vec4(uv*2.-1.,z*2.-1.,1.);return p.xyz/p.w;}
        vec2 lmUV(vec2 xz){return vec2((xz.x-uBox.x)/uBox.z,(uBox.y-xz.y)/uBox.w);}
        bool lmOut(vec2 uv){return uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.;}
        vec3 lmSky(vec3 d){
          if(d.y<0.)return mix(uLmSkyHor,vec3(.08,.07,.06),smoothstep(0.,-.2,d.y));
          return mix(uLmSkyHor,uLmSkyTop,smoothstep(0.,.45,d.y));
        }
        float lmH21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}

        vec3 traceWorldRefl(vec3 p, vec3 d) {
          float t = 0.8, tMax = max(uRtDist, 200.0);
          float texel = uBox.z / 2048.0;
          int maxSteps = int(clamp(uRtSteps, 12.0, 56.0));
          for (int i = 0; i < 56; i++) {
            if (i >= maxSteps || t > tMax) break;
            vec3 q = p + d * t;
            if (q.y > uLmTopY && d.y >= 0.) break;
            if (q.y <= 0.08 && d.y < -1e-4) {
              float tg = clamp((0.05 - p.y) / d.y, 0., tMax);
              vec3 qg = p + d * tg; vec2 uvg = lmUV(qg.xz);
              if (lmOut(uvg)) break;
              vec3 alb = textureLod(uLmTop, uvg, 0.).rgb;
              float sH = textureLod(uLmS, uvg, 0.).r;
              float lit = smoothstep(sH - .4, sH + .4, .25);
              return alb * 0.31830988 * (uLmSunE * max(uLmSunDir.y, 0.) * lit + uLmSkyTop * .45);
            }
            vec2 uv = lmUV(q.xz);
            if (lmOut(uv)) break;
            float h = textureLod(uH, uv, 0.).r * uYs + uMinY;
            if (q.y < h) {
              float t0 = max(0.5, t - texel * 1.5), t1 = t;
              for (int b = 0; b < 2; b++) {
                float tm = 0.5 * (t0 + t1);
                vec3 qm = p + d * tm;
                float hm = textureLod(uH, lmUV(qm.xz), 0.).r * uYs + uMinY;
                if (qm.y < hm) t1 = tm; else t0 = tm;
              }
              q = p + d * t1; uv = lmUV(q.xz); h = textureLod(uH, uv, 0.).r * uYs + uMinY;
              float eps = texel * 1.4 / uBox.z;
              float hx = (textureLod(uH, uv + vec2(eps, 0.), 0.).r - textureLod(uH, uv - vec2(eps, 0.), 0.).r) * uYs;
              float hz = (textureLod(uH, uv + vec2(0., -eps), 0.).r - textureLod(uH, uv - vec2(0., eps), 0.).r) * uYs;
              vec2 g2 = vec2(-hx, -hz);
              vec3 nW = dot(g2, g2) > 1e-4 ? normalize(vec3(g2.x, 0., g2.y)) : normalize(vec3(-d.x, 0., -d.z) + vec3(1e-4, 0., 0.));
              if (dot(nW, d) > 0.) nW = -nW;
              bool isRoof = abs(q.y - h) < 0.65 && d.y < -0.05;
              vec2 uvOut = uv + vec2(nW.x, -nW.z) * eps * 1.5;
              float sH = textureLod(uLmS, isRoof ? uv : uvOut, 0.).r;
              float litW = smoothstep(sH - .65, sH + .65, q.y);
              if (isRoof) {
                vec3 alb = textureLod(uLmTop, uv, 0.).rgb;
                return alb * 0.31830988 * (uLmSunE * max(uLmSunDir.y, 0.) * litW + uLmSkyTop * .55);
              }
              vec4 wa = textureLod(uLmWall, uv, 0.);
              vec3 alb = wa.a > .02 ? wa.rgb / max(wa.a, .1) : vec3(.52, .49, .45);
              vec3 Lw = alb * 0.31830988 * (uLmSunE * max(dot(nW, uLmSunDir), 0.) * litW + uLmSkyHor * .45);
              float uCoord = dot(q.xz, vec2(nW.z, -nW.x));
              float fl = fract(q.y / 3.4), bay = fract(uCoord / 2.9);
              float win = step(.26, fl) * step(fl, .88) * step(.14, bay) * step(bay, .86) * step(3.0, h);
              if (win > .5) {
                vec2 cell = floor(vec2(uCoord / 2.9, q.y / 3.4));
                vec3 roomCol = mix(vec3(1., .76, .46), vec3(.78, .88, 1.), step(.65, lmH21(cell + 7.3)));
                vec3 room = roomCol * step(lmH21(cell), mix(.18, .52, uNight)) * mix(.42, 1.85, uNight);
                vec3 glassRefl = lmSky(reflect(d, nW)) * (.22 + .35 * pow(1. - max(dot(-d, nW), 0.), 3.));
                Lw = mix(Lw, Lw * .12 + glassRefl + room, win);
              }
              return Lw;
            }
            float hEnv = textureLod(uLmS, uv, 0.).b;
            float clearance = q.y - hEnv;
            float stepSz = clearance > 2.0 ? max(texel * 1.5, min(clearance * 0.6, 16.0)) : max(texel, 0.6 + t * 0.015);
            t += stepSz;
          }
          return lmSky(d);
        }

        void main(){
          vec4 c=texture2D(tDiffuse,v);float z=texture2D(tDepth,v).r;
          if(z>.99995){gl_FragColor=c;return;}
          vec3 vp=getVP(v,z);
          vec3 vn=normalize(texture2D(tNormal,v).xyz*2.-1.);
          vec3 wn=normalize((uCamWorld*vec4(vn,0.)).xyz);
          float dist=-vp.z;
          float ign=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
          // 1. Ground Truth Ambient Occlusion (GTAO) with Multi-Bounce Color Bleed
          if(uGtao>.01&&dist<380.){
            float occ=0.,rad=clamp(1.6/max(dist,2.5),.0018,.028);
            for(int i=0;i<8;i++){
              float fi=float(i)+.5;
              float a=fi*2.39996+ign*6.2831853;
              vec2 dir=vec2(cos(a),sin(a));
              float rStep=rad*sqrt(fi/8.);
              vec2 suv=v+dir*rStep;
              if(suv.x>0.&&suv.x<1.&&suv.y>0.&&suv.y<1.){
                float sz=texture2D(tDepth,suv).r;
                if(sz<.9999){
                  vec3 svp=getVP(suv,sz),dv=svp-vp;
                  float l=length(dv);
                  if(l>.08&&l<4.2){
                    float h=dot(dv/l,vn),w=1.-smoothstep(.9,4.2,l);
                    occ+=clamp(h-.12,0.,1.)*w;
                  }
                }
              }
            }
            float ao=clamp(1.-(occ/8.)*1.45*uGtao*(1.-smoothstep(220.,380.,dist)),.22,1.);
            vec3 alb=clamp(c.rgb/(max(max(c.r,c.g),max(c.b,.001))+.15),.08,.92);
            vec3 mb=ao/(1.-alb*(1.-ao)*.65);
            c.rgb*=mix(vec3(ao),mb,.6);
          }
          // 2. Hybrid Screen-Space + World-Space Ray-Traced Reflections (HSSR) strictly on wet streets/puddles
          if(uSsr>.01&&uWet>.01&&dist<240.){
            vec3 V=normalize(vp);
            float ndv=max(dot(-V,vn),0.);
            float fres=0.04+0.96*pow(1.-ndv,5.);
            float lum=dot(c.rgb,vec3(.299,.587,.114));
            float darkAsphalt=smoothstep(.48,.18,lum);
            vec3 wp=(uCamWorld*vec4(vp,1.)).xyz;
            float isGround=smoothstep(0.85, 0.35, wp.y);
            float roadMask=smoothstep(.94,.995,wn.y)*uWet*darkAsphalt*(.25+.75*fres)*isGround;
            float refl=clamp(roadMask*uSsr*(1.-smoothstep(150.,240.,dist)),0.,.75);
            if(refl>.02){
              vec3 R=reflect(V,vn);
              vec3 wR=normalize((uCamWorld*vec4(R,0.)).xyz);
              if(R.z<.1&&wR.y>.02){
                // Temporal Ray Reconstruction (TRR): Checkerboard pixel interlacing with temporal integration
                float checker = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y) + mod(uFrame, 2.0), 2.0);
                int marchSteps = (uTrr > 0.5 && checker > 0.5) ? 8 : 16;
                float stepL=max(.28,dist*.018);
                vec3 rp=vp+vn*.12+R*(stepL*(.5+.5*ign));
                vec3 hitC=vec3(0.);float hitA=0.;
                for(int i=0;i<18;i++){
                  if(i >= marchSteps) break;
                  rp+=R*stepL;stepL*=1.2;
                  vec4 cl=uProj*vec4(rp,1.);
                  vec2 suv=(cl.xy/cl.w)*.5+.5;
                  if(suv.x<0.||suv.x>1.||suv.y<0.||suv.y>1.)break;
                  float sz=texture2D(tDepth,suv).r;
                  if(sz>.9999)continue;
                  vec3 svp=getVP(suv,sz);
                  float dz=svp.z-rp.z;
                  if(dz>.05&&dz<max(stepL*1.05,.38)){
                    vec3 mp=rp-R*(stepL*.45);
                    vec4 mcl=uProj*vec4(mp,1.);
                    vec2 muv=(mcl.xy/mcl.w)*.5+.5;
                    vec2 ed=min(muv,1.-muv);
                    float vig=smoothstep(0.,.08,min(ed.x,ed.y));
                    hitC=texture2D(tDiffuse,muv).rgb;
                    hitA=vig*(1.-float(i)/float(marchSteps));
                    break;
                  }
                }
                // Smart Hybrid Fallback: When screen-space reflection exits screen borders or gets occluded, height-field RT seamlessly takes over!
                if(hitA<.92&&uRt>.01){
                  vec3 rtCol=traceWorldRefl(wp+wn*.15,wR);
                  hitC=mix(rtCol,hitC,hitA);
                  hitA=1.0;
                }
                c.rgb=mix(c.rgb,hitC,hitA*refl);
              }
            }
          }
          gl_FragColor=c;
        }`,
    });
    comp.addPass(this.ssr);

    // diffuse screen-space light bounce: cosine-weighted hemisphere GI with normal + depth bilateral filtering (zero coplanar ghosting)
    this.bounceP = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, tNormal: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        px: { value: new THREE.Vector2(1 / (sz.x * pr), 1 / (sz.y * pr)) },
        bounce: { value: 0.6 }, uFrame: { value: 0 },
      }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse,tDepth,tNormal;uniform mat4 uInvProj;uniform vec2 px;uniform float bounce,uFrame;varying vec2 v;
        vec3 getVP(vec2 uv,float z){vec4 p=uInvProj*vec4(uv*2.-1.,z*2.-1.,1.);return p.xyz/p.w;}
        void main(){
          vec4 c=texture2D(tDiffuse,v);
          if(bounce<=.005){gl_FragColor=c;return;}
          float z=texture2D(tDepth,v).r;
          if(z>.99995){gl_FragColor=c;return;}
          vec3 vp=getVP(v,z);
          vec3 vn=normalize(texture2D(tNormal,v).xyz*2.-1.);
          float dist=-vp.z;
          if(dist>280.){gl_FragColor=c;return;}
          float ign=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
          float rad=clamp(1.8/max(dist,2.0),.002,.022);
          vec3 acc=vec3(0.);float wTot=0.;
          for(int i=0;i<12;i++){
            float fi=float(i)+.5;
            float t=fi*2.39996+ign*6.2831853;
            vec2 off=vec2(cos(t),sin(t))*(sqrt(fi/12.)*rad);
            vec2 suv=v+off;
            if(suv.x>0.&&suv.x<1.&&suv.y>0.&&suv.y<1.){
              float sz=texture2D(tDepth,suv).r;
              if(sz<.99995){
                vec3 svp=getVP(suv,sz);
                vec3 dv=svp-vp;
                float dz=length(dv);
                if(dz<.12||dz>4.5)continue;
                vec3 dir=dv/dz;
                vec3 svn=normalize(texture2D(tNormal,suv).xyz*2.-1.);
                // Only transfer bounce light between non-coplanar surfaces facing each other (prevents flat road/crosswalk ghosting)
                float cosRecv= clamp(dot(vn,dir)-.12,0.,1.);
                float cosEmit= clamp(1.-dot(vn,svn),0.,1.);
                float dw=cosRecv*cosEmit*exp(-dz*.9)*(1.-smoothstep(1.8,4.5,dz));
                if(dw>.001){
                  vec3 s=min(texture2D(tDiffuse,suv).rgb,vec3(1.15));
                  acc+=s*dw;wTot+=dw;
                }
              }
            }
          }
          if(wTot>.01){
            vec3 a=acc/max(wTot,.25);
            float l=dot(c.rgb,vec3(.2126,.7152,.0722));
            float sh=(1.-smoothstep(.05,.6,l))*(1.-smoothstep(180.,280.,dist));
            c.rgb+=a*bounce*.32*sh*(c.rgb+.1);
          }
          gl_FragColor=c;
        }`,
    });
    comp.addPass(this.bounceP); this.bounceP.enabled = false;

    // atmosphere: analytic height fog + god rays marched through Lumina's shadow-height map
    this.atmo = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, uLmS: { value: null }, uBox: { value: null }, // linked after ShaderPass clones
        uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Vector3() }, uFogCol: { value: new THREE.Vector3() },
        uDens: { value: 0.0016 }, uFall: { value: 70 }, uRay: { value: 1 }, uFrame: { value: 0 }, uTopY: { value: 200 },
      }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse,tDepth,uLmS;uniform vec4 uBox;uniform mat4 uInvProj,uCamWorld;uniform vec3 uCamPos,uSunDir,uSunCol,uFogCol;
        uniform float uDens,uFall,uRay,uFrame,uTopY;varying vec2 v;
        float lit(vec3 p){vec2 uv=vec2((p.x-uBox.x)/uBox.z,(uBox.y-p.z)/uBox.w);if(p.y>uTopY||uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return 1.;
          float S=texture2D(uLmS,uv).r;return smoothstep(S-1.,S+1.,p.y);}
        void main(){vec4 c=texture2D(tDiffuse,v);float z=texture2D(tDepth,v).r;
          vec4 vp=uInvProj*vec4(v*2.-1.,z*2.-1.,1.);vp/=vp.w;vec3 wp=(uCamWorld*vec4(vp.xyz,1.)).xyz;
          vec3 rd=wp-uCamPos;float dist=length(rd);rd/=dist;bool sky=z>.99999;if(sky)dist=2500.;
          float k=rd.y/uFall,y0=max(uCamPos.y,0.);
          float od=uDens*exp(-y0/uFall)*(abs(k)>1e-5?(1.-exp(-k*dist))/k:dist);
          float T=exp(-od);
          float mu=dot(rd,uSunDir),g=.62,ph=(1.-g*g)/(12.566*pow(1.+g*g-2.*g*mu,1.5));
          float L=min(dist,320.),acc=0.,ws=0.,j=fract(52.9829189*fract(dot(gl_FragCoord.xy+uFrame*5.588,vec2(.06711056,.00583715))));
          for(int i=0;i<20;i++){float t=(float(i)+j)/20.*L;vec3 q=uCamPos+rd*t;float w=exp(-max(q.y,0.)/uFall);acc+=lit(q)*w;ws+=w;}
          float litF=(acc/max(ws,1e-4)*L+max(dist-L,0.))/dist;
          vec3 ins=uFogCol+uSunCol*ph*litF*uRay*3.;
          c.rgb=c.rgb*T+ins*(1.-T);gl_FragColor=c;}`,
    });
    comp.addPass(this.atmo);
    // TAA / DLSS / TSR on the HDR image after fog and bounce, before exposure / bloom (stable input for bloom)
    this.taa = new TAAPass(cam, ssao.normalRenderTarget.depthTexture, comp); comp.addPass(this.taa);
    this.autoExp = new AutoExposurePass(); comp.addPass(this.autoExp);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(sz.x * pr, sz.y * pr), 0.25, 0.5, 0.9); comp.addPass(this.bloom);
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, sat: { value: 1.15 }, night: this.uniforms.uNight, tDepth: { value: null },
        uSunUV: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Vector3() }, uGlare: { value: 1 }, uAspect: { value: 1 },
        uChroma: { value: 0 }, uDof: { value: 0 }, uGrain: { value: 0 }, uFrame: { value: 0 },
      }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse,tDepth;uniform float sat,night,uGlare,uAspect,uChroma,uDof,uGrain,uFrame;uniform vec3 uSunUV,uSunCol;varying vec2 v;
        vec3 glare(){if(uSunUV.z<=0.||uGlare<=0.)return vec3(0.);float vis=0.;for(int i=0;i<9;i++){vec2 o=vec2(float(i%3)-1.,float(i/3)-1.)*.012;vis+=step(.99999,texture2D(tDepth,uSunUV.xy+o).r);}vis/=9.;if(vis<=0.)return vec3(0.);
        vec2 d=(v-uSunUV.xy)*vec2(uAspect,1.);float r=length(d);vec3 g=uSunCol*(exp(-r*9.)*.35+exp(-r*2.5)*.08+exp(-abs(d.y)*260.)*exp(-abs(d.x)*3.)*.12);
        vec2 axis=vec2(.5)-uSunUV.xy;for(int k=1;k<4;k++){vec2 gp=uSunUV.xy+axis*(float(k)*.55);float gr=length((v-gp)*vec2(uAspect,1.));g+=uSunCol*vec3(.35,.5,.8)*smoothstep(.05,.0,abs(gr-.03*float(k)))*.04;}
        return g*vis*uSunUV.z*uGlare;}
        vec3 sampleChroma(vec2 uv){
          if(uChroma<.001)return texture2D(tDiffuse,uv).rgb;
          vec2 cd=uv-.5;float r2=dot(cd,cd);vec2 off=cd*r2*.008*uChroma;
          return vec3(texture2D(tDiffuse,clamp(uv+off,0.,1.)).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,clamp(uv-off,0.,1.)).b);
        }
        void main(){
          vec4 c=texture2D(tDiffuse,v);
          c.rgb=sampleChroma(v);
          if(uDof>.001){
            float z=texture2D(tDepth,v).r,fz=texture2D(tDepth,vec2(.5,.5)).r;
            float coc=clamp(abs(z-fz)*24.*uDof,0.,1.);
            if(coc>.04){
              vec3 acc=c.rgb;float w=1.,rad=coc*.0065;
              for(int i=0;i<8;i++){
                float fi=float(i)+1.,a=fi*2.39996,r=sqrt(fi/8.)*rad;
                vec2 o=vec2(cos(a)/uAspect,sin(a))*r;
                acc+=texture2D(tDiffuse,clamp(v+o,0.,1.)).rgb;w+=1.;
              }
              c.rgb=acc/w;
            }
          }
          c.rgb+=glare();
          float d=distance(v,vec2(.5));c.rgb*=mix(.78,1.,smoothstep(1.05,.32,d));
          float l=dot(c.rgb,vec3(.2126,.7152,.0722));float k=smoothstep(0.,.6,l);
          c.rgb=mix(vec3(l),c.rgb,sat*(1.+.12*(1.-k)));
          c.rgb*=mix(mix(vec3(1.05,.97,.88),vec3(.84,.95,1.16),night),mix(vec3(1.09,1.,.87),vec3(1.,1.,1.02),night),k);
          c.rgb=.18*pow(max(c.rgb,0.)/.18,vec3(1.15));
          if(uGrain>.001){
            float gr=(fract(52.9829189*fract(dot(gl_FragCoord.xy+uFrame*11.3,vec2(.06711056,.00583715))))-.5)*.022*uGrain;
            c.rgb=max(c.rgb+gr,0.);
          }
          gl_FragColor=vec4(c.rgb,c.a);
        }`,
    });
    comp.addPass(this.grade);
    comp.addPass(new OutputPass());
    this.smaa = new SMAAPass(sz.x * pr, sz.y * pr);
    this.smaa.clear = true;
    this.smaa.materialEdges.defines.SMAA_THRESHOLD = '0.05';
    this.smaa.materialEdges.needsUpdate = true;
    comp.addPass(this.smaa);
    // ShaderPass clones uniforms (render-target textures become null, shared objects get copied): re-link them
    const depth = ssao.normalRenderTarget.depthTexture;
    this.bounceP.uniforms.tDepth.value = depth; this.bounceP.uniforms.tNormal.value = ssao.normalRenderTarget.texture;
    this.ssr.uniforms.tDepth.value = depth; this.ssr.uniforms.tNormal.value = ssao.normalRenderTarget.texture;
    this.ssr.uniforms.uH.value = this.sao.uH.value;
    this.ssr.uniforms.uBox = this.sao.uBox;
    this.ssr.uniforms.uLmS.value = this.lumina.S.texture;
    this.ssr.uniforms.uLmWall.value = this.lumina.wallTex;
    this.ssr.uniforms.uLmTop.value = this.lumina.topTex;
    this.ssr.uniforms.uNight = this.uniforms.uNight;
    this.atmo.uniforms.tDepth.value = depth; this.atmo.uniforms.uLmS.value = this.lumina.S.texture; this.atmo.uniforms.uBox = this.sao.uBox;
    this.grade.uniforms.tDepth.value = depth; this.grade.uniforms.night = this.uniforms.uNight;

    this.setTime(this.params.time);
  }

  /* ---------- public API ---------- */
  /** Patch a MeshStandardMaterial-derived shader with contact AO (call from onBeforeCompile). */
  injectSAO(shader) {
    Object.assign(shader.uniforms, this.sao, this.lumina.u);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSaoP;varying vec3 vSaoN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 sp=vec4(transformed,1.);vec3 sn=objectNormal;
        #ifdef USE_INSTANCING
        sp=instanceMatrix*sp;sn=mat3(instanceMatrix)*sn;
        #endif
        vSaoP=(modelMatrix*sp).xyz;vSaoN=normalize(mat3(modelMatrix)*sn);}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSaoP;varying vec3 vSaoN;\n' + SAO_GLSL + LUMINA_GLSL)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace('vDirectionalShadowCoord[ i ] ) : 1.0;',
        'vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\tdirectLight.color *= ( directLight.visible && receiveShadow ) ? lmFarShadow( vDirectionalShadowCoord[ i ], vSaoP, normalize( vSaoN ) ) : 1.0;'))
      .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + LUMINA_APPLY)
      .replace('vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
        '{ vec3 saoK = saoC(vSaoP, normalize(vSaoN)); reflectedLight.indirectDiffuse *= saoK; reflectedLight.indirectSpecular *= saoK; }\nvec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;');
  }
  /** Patch plain standard materials (props) with contact AO. */
  patch(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      [].concat(o.material).forEach((m) => {
        if (!m || !m.isMeshStandardMaterial || m.userData.sao) return; m.userData.sao = 1;
        const prev = m.onBeforeCompile;
        m.onBeforeCompile = (s, r) => { prev && prev.call(m, s, r); this.injectSAO(s); };
        const pk = m.customProgramCacheKey.bind(m);
        m.customProgramCacheKey = () => pk() + '|sao'; m.needsUpdate = true;
      });
    });
  }

  setBounds(box) { this._levelBox.copy(box); }
  setFocus(v) { this.focus.copy(v); }

  /** time in hours (0..24) drives sun, moon, sky, fog and the night factor */
  setTime(h) {
    const p = this.params; if (h !== undefined) p.time = h;
    const t = (p.time - 6) / 12; // 0 sunrise .. 1 sunset
    const elev = Math.sin(t * Math.PI) * 62; // degrees
    const az = 100 + t * 160 + p.sunAzOffset;
    const night = smooth(4, -6, elev);
    this.uniforms.uNight.value = night;
    this.sunEl = elev;

    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(elev);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - e, a);
    this.sky.material.uniforms.sunPosition.value.copy(sunDir);
    // light direction: sun by day, moon by night
    if (night < 0.5) this.sv.copy(sunDir); else this.sv.setFromSphericalCoords(1, Math.PI / 2 - THREE.MathUtils.degToRad(42), a + Math.PI);
    if (this.sv.y < 0.08) { this.sv.y = 0.08; this.sv.normalize(); }

    const golden = smooth(25, 2, elev) * (1 - night);
    const sunCol = new THREE.Color().setHSL(0.09 - golden * 0.04, 1, 0.62 + 0.2 * Math.sin(Math.max(e, 0)) - golden * 0.1);
    const moonCol = new THREE.Color(0x8fa8d8);
    this.sun.color.copy(sunCol).lerp(moonCol, night);
    this.sun.intensity = THREE.MathUtils.lerp(4.5 * smooth(-2, 10, elev) + 0.001, 0.35, night);
    this.hemi.intensity = THREE.MathUtils.lerp(0.25, 0.1, night);
    this.amb.intensity = THREE.MathUtils.lerp(0.08, 0.05, night);
    this.hemi.color.setRGB(0.85, 0.86, 0.9).lerp(new THREE.Color(0.35, 0.45, 0.75), night);

    const dayTop = new THREE.Color(0.1, 0.38, 1.15), dayHor = new THREE.Color(0.55, 0.8, 1.25);
    const setTop = new THREE.Color(0.18, 0.25, 0.6), setHor = new THREE.Color(1.4, 0.62, 0.32);
    const nTop = new THREE.Color(0.004, 0.008, 0.025), nHor = new THREE.Color(0.02, 0.035, 0.07);
    const top = dayTop.clone().lerp(setTop, golden).lerp(nTop, night), hor = dayHor.clone().lerp(setHor, golden).lerp(nHor, night);
    this.domeU.uTop.value.copy(top); this.domeU.uHor.value.copy(hor);
    this.domeU.uSun.value.copy(sunDir); this.domeU.uSunCol.value.copy(sunCol);
    this.fogColor.copy(hor).multiplyScalar(0.75);

    if (this.skyEnv) this.skyEnv.dispose();
    this.skyEnv = this.pm.fromScene(this.envScene);
    if (!this.probeEnv || !p.probe) this.scene.environment = this.skyEnv.texture;
    this.scene.environmentIntensity = 1;
    this.lastProbe.set(1e9, 0, 0);
  }

  /** SSAOPass caches near/far at construction; call after changing the camera's clip planes */
  resetExposure() { this.autoExp.reset(); }
  syncCamera() {
    for (const m of [this.ssao.ssaoMaterial, this.ssao.depthRenderMaterial]) { m.uniforms.cameraNear.value = this.cam.near; m.uniforms.cameraFar.value = this.cam.far; }
    this.ssao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.cam.projectionMatrix);
    this.ssao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.cam.projectionMatrixInverse);
  }
  rebuild() {
    this._buildSAO(); this.lumina.rebuild(); this.lumina.updateSun(this.sv, true);
    this.lumina.updateCaches(this.cam.position, true); // complete gather once; later updates are progressive
    this.lastProbe.set(1e9, 0, 0);
  }
  setDlss(scale) {
    this.params.dlss = scale;
    if (scale < 0.99 && this.params.aa !== 'taa') this.params.aa = 'taa';
    this.resize(this._w, this._h);
    this.taa.reset();
  }
  resize(w = this._w, h = this._h) {
    this._w = w; this._h = h;
    const pr = this.R.getPixelRatio();
    const wOut = Math.max(1, Math.round(w * pr)), hOut = Math.max(1, Math.round(h * pr));
    const scale = this.params.aa === 'taa' ? (this.params.dlss || 1) : 1;
    const wIn = Math.max(1, Math.round(wOut * scale)), hIn = Math.max(1, Math.round(hOut * scale));
    this.inRes = { w: wIn, h: hIn, wOut, hOut, scale };
    this.comp._hiRT1.setSize(wOut, hOut); this.comp._hiRT2.setSize(wOut, hOut);
    this.comp._loRT1.setSize(wIn, hIn); this.comp._loRT2.setSize(wIn, hIn);
    this.ssao.setSize(wIn, hIn);
    this.taa.setSize(wOut, hOut);
    this.bloom.setSize(wOut, hOut);
    this.smaa.setSize(wOut, hOut);
    this.bounceP.uniforms.px.value.set(1 / wIn, 1 / hIn);
  }
  render(dt = 0.016) {
    const p = this.params, R = this.R, cam = this.cam, n = this.uniforms.uNight.value;
    cam.updateMatrixWorld();
    // auto: exposure compensation on top of eye adaptation; manual: fixed exposure as before
    this.autoExp.enabled = p.autoExposure;
    this.autoExp.u.uMaxE.value = THREE.MathUtils.lerp(6, 1.6, n);
    R.toneMappingExposure = p.autoExposure ? p.exposure : p.exposure * 0.62 * (1 + n * 0.9);
    this.bloom.strength = p.bloom * (1 + n * 1.6); this.bloom.threshold = THREE.MathUtils.lerp(0.9, 0.6, n);
    this.grade.uniforms.sat.value = p.saturation;
    this.bounceP.uniforms.bounce.value = p.bounce; this.bounceP.enabled = p.bounce > 0.005; this.sao.uStr.value = p.contactAO;
    this.dome.position.copy(cam.position); this.dome.scale.setScalar(cam.far * 0.8 / 500);
    this._fitShadow();
    this._probeT += dt;
    if (p.probe && this._probeT > this.opts.probeInterval && cam.position.distanceTo(this.lastProbe) > this.opts.probeDistance) this._probe();
    if (!p.probe && this.probeEnv) { this.probeEnv.dispose(); this.probeEnv = null; this.scene.environment = this.skyEnv.texture; }
    const taa = p.aa === 'taa';
    const wantScale = taa ? (p.dlss || 1) : 1;
    if (this.inRes.scale !== wantScale) this.resize(this._w, this._h);
    this.taa.enabled = taa; this.smaa.enabled = p.aa === 'smaa' || taa; this.taa.su.uSharp.value = p.sharpen;
    this.comp.writeBuffer = this.comp._loRT1;
    this.comp.readBuffer = this.comp._loRT2;
    if (taa) this.taa.begin(this.inRes.w, this.inRes.h);
    this._updateLumina(dt);
    this.comp.render();
    if (taa) this.taa.end(); else this.taa.reset();
  }

  _updateLumina(dt) {
    const p = this.params, Lm = this.lumina, u = Lm.u, cam = this.cam, n = this.uniforms.uNight.value;
    u.uLmOn.value = p.lumina ? 1 : 0; u.uLmGI.value = p.gi; u.uLmSpec.value = p.spec;
    // with Lumina the analytic fill lights are replaced by traced sky + bounce
    this.hemi.visible = this.amb.visible = !p.lumina;
    Lm.setLighting(this.sv, this.sun.color, this.sun.intensity, this.domeU.uTop.value, this.domeU.uHor.value, n);
    if (p.lumina) { Lm.updateSun(this.sv); Lm.updateCaches(cam.position); }
    this.domeU.uClouds.value = p.clouds; this.domeU.uTime.value += dt;
    u.uLmClouds.value = p.clouds; u.uLmTime.value = this.domeU.uTime.value; u.uLmCloudSh.value = p.cloudShadows;
    // atmosphere
    const A = this.atmo.uniforms; this.atmo.enabled = p.fog > 0;
    A.uInvProj.value.copy(cam.projectionMatrixInverse); A.uCamWorld.value.copy(cam.matrixWorld); A.uCamPos.value.copy(cam.position);
    A.uSunDir.value.copy(this.sv); A.uSunCol.value.copy(u.uLmSunE.value).multiplyScalar(n > 0.5 ? 0.05 : 0.07);
    const hor = this.domeU.uHor.value; A.uFogCol.value.set(hor.r, hor.g, hor.b).multiplyScalar(0.4).lerp(u.uLmSunE.value.clone().multiplyScalar(0.08), 0.45);
    A.uDens.value = 0.0005 * p.fog; A.uRay.value = p.lumina ? p.godRays : 0; A.uFrame.value = (A.uFrame.value + 1) % 64; A.uTopY.value = u.uLmTopY.value;
    // screen-space bounce
    const Bp = this.bounceP.uniforms;
    Bp.bounce.value = p.bounce;
    this.bounceP.enabled = p.bounce > 0.005;
    Bp.uInvProj.value.copy(cam.projectionMatrixInverse);
    Bp.uFrame.value = A.uFrame.value;
    // UE5 SSR + GTAO + Multi-bounce color bleed + Smart Hybrid Ray Tracing (HSSR)
    const S = this.ssr.uniforms;
    this.ssr.enabled = p.ssr > 0.01 || p.gtao > 0.01;
    S.uProj.value.copy(cam.projectionMatrix); S.uInvProj.value.copy(cam.projectionMatrixInverse); S.uCamWorld.value.copy(cam.matrixWorld);
    S.uCamPos.value.copy(cam.position);
    S.uSsr.value = p.ssr; S.uGtao.value = p.gtao; S.uWet.value = p.wet; S.uFrame.value = A.uFrame.value;
    S.uRt.value = p.rt ? 1 : 0;
    S.uTrr.value = p.trr ? 1 : 0;
    S.uRtSteps.value = p.rtSteps || 36;
    S.uRtDist.value = p.rtDist || 700;
    S.uMinY.value = this.sao.uMinY.value; S.uYs.value = this.sao.uYs.value;
    S.uLmSunDir.value.copy(this.sv); S.uLmSunE.value.copy(u.uLmSunE.value);
    S.uLmSkyHor.value.copy(this.domeU.uHor.value); S.uLmSkyTop.value.copy(this.domeU.uTop.value);
    S.uLmTopY.value = u.uLmTopY.value;
    u.uLmRt.value = p.rt ? 1 : 0;
    // sun glare + UE5 camera lens (Chromatic Aberration + Bokeh DoF + Film Grain)
    const G = this.grade.uniforms, sp = this.sv.clone().multiplyScalar(1000).add(cam.position).project(cam);
    const on = sp.z < 1 && Math.abs(sp.x) < 1.2 && Math.abs(sp.y) < 1.2 && this.sv.dot(cam.getWorldDirection(new THREE.Vector3())) > 0;
    G.uSunUV.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5, on ? (1 - n) * THREE.MathUtils.smoothstep(this.sunEl, -1, 6) : 0);
    G.uSunCol.value.copy(u.uLmSunE.value).multiplyScalar(0.12); G.uGlare.value = p.glare; G.uAspect.value = cam.aspect;
    G.uChroma.value = p.chroma; G.uDof.value = p.dof; G.uGrain.value = p.grain; G.uFrame.value = A.uFrame.value;
  }

  /* ---------- internals ---------- */
  _fitShadow() {
    // Adaptive shadow frustum: shrinks when zoomed in for razor-sharp (~2cm/texel) close-up shadows while lmFarShadow handles the city
    const s = this.sun, c = this.focus.clone();
    const camDist = Math.max(this.cam.position.distanceTo(c), 28);
    const r = THREE.MathUtils.clamp(camDist * 0.72, 42, this.params.shadowRadius);
    const fwd = this.sv.clone().negate(), up = Math.abs(fwd.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize(), u2 = new THREE.Vector3().crossVectors(right, fwd);
    const texel = (2 * r) / this.opts.shadowMap;
    const x = Math.round(c.dot(right) / texel) * texel - c.dot(right), y = Math.round(c.dot(u2) / texel) * texel - c.dot(u2);
    c.addScaledVector(right, x).addScaledVector(u2, y);
    s.target.position.copy(c);
    const far = r * 2 + 600;
    Object.assign(s.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far });
    s.shadow.camera.updateProjectionMatrix(); s.shadow.normalBias = texel * 1.4; // scales with shadow texel size
    s.position.copy(this.sv).multiplyScalar(far * 0.5).add(c);
    s.target.updateMatrixWorld();
  }
  _probe() {
    const R = this.R, scene = this.scene; if (!this.skyEnv) return;
    this._probeT = 0;
    scene.environment = this.skyEnv.texture; this.cube.position.copy(this.cam.position);
    this.cube.position.y = Math.max(this.cube.position.y, 2);
    R.shadowMap.autoUpdate = false; this.cube.update(R, scene); R.shadowMap.autoUpdate = true;
    if (this.probeEnv) this.probeEnv.dispose();
    this.probeEnv = this.pm.fromCubemap(this.cubeRT.texture); scene.environment = this.probeEnv.texture; this.lastProbe.copy(this.cam.position);
  }
  _buildSAO() {
    const R = this.R, S = this.sao, b = this._levelBox; if (b.isEmpty()) return;
    const sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), half = Math.max(sz.x, sz.z) / 2 + 1;
    S.uMinY.value = b.min.y; S.uYs.value = Math.max(sz.y, 0.1); S.uBox.value.set(c.x - half, c.z + half, half * 2, half * 2);
    const oc = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, sz.y + 4);
    oc.position.set(c.x, b.max.y + 2, c.z); oc.up.set(0, 0, -1); oc.lookAt(c.x, b.min.y, c.z); oc.updateMatrixWorld();
    const hidden = [], sw = [];
    this.level.traverse((o) => {
      if ((o.isPoints || o.userData.noAO) && o.visible) { o.visible = false; hidden.push(o); }
      else if (o.isMesh) { sw.push([o, o.material]); o.material = this.hMat; }
    });
    const cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha(), pr = R.getRenderTarget();
    R.setRenderTarget(this.hRT); R.setClearColor(0, 1); R.clear(); R.render(this.level, oc);
    R.setRenderTarget(pr); R.setClearColor(cc, ca);
    sw.forEach(([o, m]) => (o.material = m));
    hidden.forEach((o) => (o.visible = true));
  }
}

return {SAO_GLSL,LevelLighting};
})();

export { SAO_GLSL, LevelLighting };
